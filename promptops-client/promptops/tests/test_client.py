"""
Tests for PromptOps client
"""

import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from promptops import PromptOpsClient, ClientConfig, PromptVariables, ModelProvider
from promptops.exceptions import PromptOpsError, ConfigurationError
from promptops.models import CacheLevel


@pytest.fixture
def mock_config():
    """Create a mock configuration"""
    return ClientConfig(
        base_url="https://api.promptops.ai",
        api_key="test-api-key",
        timeout=30.0
    )


@pytest.fixture
def client(mock_config):
    """Create a test client"""
    return PromptOpsClient(mock_config)


@pytest.mark.asyncio
async def test_client_initialization(client):
    """Test client initialization"""
    with patch.object(client.auth_manager, 'test_connection', return_value=True):
        await client.initialize()
        assert client._initialized is True


@pytest.mark.asyncio
async def test_client_configuration_validation():
    """Test configuration validation"""
    # Test missing base URL
    with pytest.raises(ConfigurationError, match="Base URL is required"):
        config = ClientConfig(base_url="", api_key="test-key")
        client = PromptOpsClient(config)
        await client.initialize()

    # Test missing API key
    with pytest.raises(ConfigurationError, match="API key is required"):
        config = ClientConfig(base_url="https://api.test.com", api_key="")
        client = PromptOpsClient(config)
        await client.initialize()

    # Test invalid timeout
    with pytest.raises(ConfigurationError, match="Timeout must be positive"):
        config = ClientConfig(base_url="https://api.test.com", api_key="test-key", timeout=0)
        client = PromptOpsClient(config)
        await client.initialize()


@pytest.mark.asyncio
async def test_get_prompt(client):
    """Test getting a prompt"""
    mock_prompt_response = {
        "id": "test-prompt",
        "version": "v1.0",
        "module_id": "test-module",
        "name": "Test Prompt",
        "description": "A test prompt",
        "content": "Hello {name}",
        "target_models": ["openai"],
        "model_specific_prompts": [
            {
                "model_provider": "openai",
                "model_name": "gpt-3.5-turbo",
                "content": "Hello {name}",
                "instructions": "Be helpful"
            }
        ],
        "mas_intent": "Test",
        "mas_fairness_notes": "Fair test",
        "mas_risk_level": "low",
        "created_by": "test-user",
        "created_at": "2023-01-01T00:00:00Z",
        "updated_at": "2023-01-01T00:00:00Z"
    }

    with patch.object(client.prompt_manager, 'get_prompt', new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_prompt_response

        # Initialize client
        client._initialized = True

        # Get prompt
        result = await client.get_prompt("test-prompt", "v1.0")

        # Verify
        mock_get.assert_called_once_with("test-prompt", "v1.0", True)
        assert result == mock_prompt_response
        assert client._stats.total_requests == 1
        assert client._stats.successful_requests == 1


@pytest.mark.asyncio
async def test_render_prompt(client):
    """Test rendering a prompt"""
    mock_render_response = {
        "messages": [{"role": "user", "content": "Hello John"}],
        "rendered_content": "Hello John",
        "prompt_id": "test-prompt",
        "version": "v1.0",
        "variables_used": {"name": "John"},
        "applied_policies": [],
        "cache_key": "test-key",
        "cached": False
    }

    with patch.object(client.prompt_manager, 'render_prompt', new_callable=AsyncMock) as mock_render:
        mock_render.return_value = mock_render_response

        # Initialize client
        client._initialized = True

        # Render prompt
        variables = PromptVariables(variables={"name": "John"})
        result = await client.render_prompt("test-prompt", variables)

        # Verify
        mock_render.assert_called_once()
        assert result == mock_render_response
        assert client._stats.total_requests == 1
        assert client._stats.successful_requests == 1


@pytest.mark.asyncio
async def test_list_prompts(client):
    """Test listing prompts"""
    mock_prompts = [
        {
            "id": "prompt1",
            "version": "v1.0",
            "name": "Prompt 1",
            "module_id": "module1",
            "created_by": "user1",
            "created_at": "2023-01-01T00:00:00Z",
            "updated_at": "2023-01-01T00:00:00Z",
            "content": "Content 1",
            "target_models": ["openai"],
            "model_specific_prompts": [],
            "mas_intent": "Test",
            "mas_fairness_notes": "Fair",
            "mas_risk_level": "low"
        }
    ]

    with patch.object(client.prompt_manager, 'list_prompts', new_callable=AsyncMock) as mock_list:
        mock_list.return_value = mock_prompts

        # Initialize client
        client._initialized = True

        # List prompts
        result = await client.list_prompts(module_id="test-module", limit=10)

        # Verify
        mock_list.assert_called_once_with("test-module", 0, 10, True)
        assert result == mock_prompts
        assert client._stats.total_requests == 1
        assert client._stats.successful_requests == 1


@pytest.mark.asyncio
async def test_error_handling(client):
    """Test error handling"""
    with patch.object(client.prompt_manager, 'get_prompt', new_callable=AsyncMock) as mock_get:
        mock_get.side_effect = Exception("Test error")

        # Initialize client
        client._initialized = True

        # Get prompt should fail
        with pytest.raises(Exception, match="Test error"):
            await client.get_prompt("test-prompt")

        # Verify stats
        assert client._stats.total_requests == 1
        assert client._stats.failed_requests == 1


@pytest.mark.asyncio
async def test_cache_operations(client):
    """Test cache operations"""
    # Test getting cache stats
    with patch.object(client.cache_manager, 'is_enabled', return_value=True):
        stats = client.get_cache_stats()
        assert "enabled" in stats
        assert "hits" in stats
        assert "misses" in stats

    # Test cache disabled
    with patch.object(client.cache_manager, 'is_enabled', return_value=False):
        stats = client.get_cache_stats()
        assert stats["enabled"] is False

    # Test clear cache
    with patch.object(client.cache_manager, 'clear', new_callable=AsyncMock) as mock_clear:
        client.clear_cache()
        mock_clear.assert_called_once()


@pytest.mark.asyncio
async def test_telemetry_operations(client):
    """Test telemetry operations"""
    # Test getting telemetry summary
    summary = client.get_telemetry_summary()
    assert "session_id" in summary
    assert "enabled" in summary
    assert "pending_events" in summary

    # Test flush telemetry
    with patch.object(client.telemetry_manager, 'flush') as mock_flush:
        client.flush_telemetry()
        mock_flush.assert_called_once()

    # Test enable/disable telemetry
    with patch.object(client.telemetry_manager, 'enable') as mock_enable:
        client.enable_telemetry()
        mock_enable.assert_called_once()

    with patch.object(client.telemetry_manager, 'disable') as mock_disable:
        client.disable_telemetry()
        mock_disable.assert_called_once()


@pytest.mark.asyncio
async def test_stats_operations(client):
    """Test statistics operations"""
    # Test getting stats
    stats = client.get_stats()
    assert stats.total_requests == 0
    assert stats.successful_requests == 0
    assert stats.failed_requests == 0

    # Test reset stats
    with patch.object(client.cache_manager, 'reset_stats') as mock_reset:
        client.reset_stats()
        mock_reset.assert_called_once()


@pytest.mark.asyncio
async def test_context_manager():
    """Test async context manager"""
    with patch('promptops.client.PromptOpsClient.initialize', new_callable=AsyncMock) as mock_init:
        with patch('promptops.client.PromptOpsClient.close', new_callable=AsyncMock) as mock_close:
            config = ClientConfig(base_url="https://api.test.com", api_key="test-key")

            async with PromptOpsClient(config) as client:
                mock_init.assert_called_once()

            mock_close.assert_called_once()


@pytest.mark.asyncio
async def test_test_connection(client):
    """Test connection testing"""
    with patch.object(client.auth_manager, 'test_connection', new_callable=AsyncMock) as mock_test:
        mock_test.return_value = True

        # Initialize client
        client._initialized = True

        # Test connection
        result = await client.test_connection()

        # Verify
        mock_test.assert_called_once()
        assert result is True


@pytest.mark.asyncio
async def test_close_client(client):
    """Test closing client"""
    with patch.object(client.prompt_manager, 'close', new_callable=AsyncMock) as mock_close:
        with patch.object(client.telemetry_manager, 'flush') as mock_flush:
            await client.close()

            mock_flush.assert_called_once()
            mock_close.assert_called_once()
            assert client._closed is True


@pytest.mark.asyncio
async def test_ensure_initialized(client):
    """Test initialization check"""
    # Test with uninitialized client
    with pytest.raises(PromptOpsError, match="Client not initialized"):
        await client.get_prompt("test-prompt")

    # Test with initialized client
    client._initialized = True
    with patch.object(client.prompt_manager, 'get_prompt', new_callable=AsyncMock) as mock_get:
        mock_get.return_value = {"id": "test"}
        result = await client.get_prompt("test-prompt")
        assert result == {"id": "test"}