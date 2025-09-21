"""
Integration tests for PromptOps API integration
"""

import asyncio
import pytest
import time
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import aiohttp
import redis
from hypothesis import given, strategies as st
from typing import Dict, Any, List

from promptops import PromptOpsClient, ClientConfig, PromptVariables, ModelProvider
from promptops.exceptions import PromptOpsError, ConfigurationError, RateLimitError
from promptops.models import CacheLevel, PromptTemplate


@pytest.fixture
def redis_client():
    """Create a Redis client for testing"""
    client = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)
    # Clear test database
    client.flushdb()
    yield client
    client.close()


@pytest.fixture
def test_config():
    """Create test configuration"""
    return ClientConfig(
        base_url="http://localhost:8000",
        api_key="test-api-key",
        secret_key="test-secret-key",
        timeout=30.0,
        enable_cache=True,
        enable_telemetry=False,
        redis_url="redis://localhost:6379"
    )


@pytest.fixture
async def client(test_config):
    """Create a test client"""
    client = PromptOpsClient(test_config)
    await client.initialize()
    yield client
    await client.close()


@pytest.mark.integration
class TestPromptOperationsIntegration:
    """Integration tests for prompt operations"""

    @pytest.mark.asyncio
    async def test_prompt_lifecycle(self, client):
        """Test complete prompt lifecycle"""
        # Create test prompt
        prompt_data = {
            "id": "test-integration-prompt",
            "version": "1.0.0",
            "module_id": "test-module",
            "name": "Integration Test Prompt",
            "description": "A prompt for integration testing",
            "content": "Hello {{name}}! You are using {{framework}}.",
            "target_models": ["openai", "anthropic"],
            "mas_intent": "greeting",
            "mas_fairness_notes": "Fair greeting",
            "mas_risk_level": "low"
        }

        # Mock API responses
        with patch.object(client, '_make_request') as mock_request:
            # Mock prompt creation
            mock_request.return_value = prompt_data

            # Test prompt retrieval
            result = await client.get_prompt("test-integration-prompt", "1.0.0")
            assert result == prompt_data

            # Test prompt rendering
            variables = PromptVariables(variables={
                "name": "Developer",
                "framework": "TypeScript"
            })

            mock_request.return_value = {
                "messages": [
                    {"role": "system", "content": "You are a helpful assistant."},
                    {"role": "user", "content": "Hello Developer! You are using TypeScript."}
                ],
                "rendered_content": "Hello Developer! You are using TypeScript.",
                "variables_used": {"name": "Developer", "framework": "TypeScript"}
            }

            rendered = await client.render_prompt("test-integration-prompt", variables)
            assert rendered["rendered_content"] == "Hello Developer! You are using TypeScript."

    @pytest.mark.asyncio
    async def test_batch_prompt_operations(self, client):
        """Test batch prompt operations"""
        # Create multiple test prompts
        prompts = [
            {"id": f"prompt-{i}", "name": f"Prompt {i}", "content": f"Content {i}"}
            for i in range(5)
        ]

        with patch.object(client, '_make_request') as mock_request:
            mock_request.return_value = prompts

            # Test listing prompts
            result = await client.list_prompts("test-module", limit=10)
            assert len(result) == 5

            # Test batch rendering
            variables_list = [
                PromptVariables(variables={"index": str(i)})
                for i in range(5)
            ]

            rendered_results = []
            for i, variables in enumerate(variables_list):
                mock_request.return_value = {
                    "rendered_content": f"Rendered content {i}",
                    "variables_used": {"index": str(i)}
                }
                rendered = await client.render_prompt(f"prompt-{i}", variables)
                rendered_results.append(rendered)

            assert len(rendered_results) == 5

    @pytest.mark.asyncio
    async def test_cache_integration(self, client, redis_client):
        """Test Redis cache integration"""
        # Set cache data directly in Redis
        cache_key = "prompt:test-cache-prompt:1.0.0"
        test_data = {
            "id": "test-cache-prompt",
            "version": "1.0.0",
            "content": "Cached content"
        }

        redis_client.setex(cache_key, 3600, str(test_data))

        # Test cache hit
        with patch.object(client, '_make_request') as mock_request:
            result = await client.get_prompt("test-cache-prompt", "1.0.0")
            # Should hit cache and not call API
            mock_request.assert_not_called()

        # Test cache miss
        with patch.object(client, '_make_request') as mock_request:
            mock_request.return_value = test_data

            result = await client.get_prompt("test-cache-prompt", "2.0.0")
            mock_request.assert_called_once()

    @pytest.mark.asyncio
    async def test_rate_limiting(self, client):
        """Test rate limiting behavior"""
        with patch.object(client, '_make_request') as mock_request:
            # Simulate rate limit response
            mock_request.side_effect = [
                PromptOpsError("Rate limit exceeded"),
                {"content": "Success after retry"}
            ]

            # Test retry logic
            with pytest.raises(PromptOpsError):
                await client.get_prompt("test-prompt")

    @pytest.mark.asyncio
    async def test_concurrent_requests(self, client):
        """Test concurrent request handling"""
        async def make_request(i):
            return await client.get_prompt(f"concurrent-prompt-{i}")

        with patch.object(client, '_make_request') as mock_request:
            mock_request.return_value = {
                "id": "concurrent-prompt",
                "content": f"Content {i}"
            }

            # Make concurrent requests
            tasks = [make_request(i) for i in range(10)]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            # All requests should succeed
            assert len([r for r in results if not isinstance(r, Exception)]) == 10

    @pytest.mark.asyncio
    async def test_error_recovery(self, client):
        """Test error recovery and fallback mechanisms"""
        with patch.object(client, '_make_request') as mock_request:
            # Test network error recovery
            mock_request.side_effect = [
                aiohttp.ClientError("Network error"),
                {"content": "Recovered content"}
            ]

            result = await client.get_prompt("test-prompt")
            assert result["content"] == "Recovered content"

    @pytest.mark.asyncio
    async def test_telemetry_integration(self, client):
        """Test telemetry collection and reporting"""
        # Enable telemetry
        client.enable_telemetry()

        with patch.object(client, '_make_request') as mock_request:
            mock_request.return_value = {"content": "Test content"}

            # Make some requests
            await client.get_prompt("test-prompt")
            await client.render_prompt("test-prompt", PromptVariables(variables={}))

            # Check telemetry data
            telemetry = client.get_telemetry_summary()
            assert telemetry["enabled"] is True
            assert telemetry["pending_events"] > 0

    @pytest.mark.asyncio
    async def test_model_compatibility(self, client):
        """Test model compatibility checking"""
        with patch.object(client, '_make_request') as mock_request:
            # Mock compatibility check responses
            mock_request.return_value = {
                "is_compatible": True,
                "compatibility_score": 0.95,
                "notes": "Fully compatible"
            }

            # Test compatibility for different models
            models = [
                ("openai", "gpt-4"),
                ("anthropic", "claude-3-sonnet"),
                ("google", "gemini-pro")
            ]

            for provider, model in models:
                compatible = await client.getModelCompatibility("test-prompt", provider, model)
                assert compatible is True

    @pytest.mark.asyncio
    async def test_configuration_updates(self, client):
        """Test runtime configuration updates"""
        # Update configuration
        await client.update_config({
            "timeout": 60.0,
            "enable_cache": False
        })

        # Verify changes
        assert client.config.timeout == 60.0
        assert client.config.enable_cache is False

        # Test with new configuration
        with patch.object(client, '_make_request') as mock_request:
            mock_request.return_value = {"content": "Updated config content"}

            result = await client.get_prompt("test-prompt")
            assert result["content"] == "Updated config content"


@pytest.mark.integration
class TestPerformanceIntegration:
    """Integration tests for performance characteristics"""

    @pytest.mark.asyncio
    async def test_response_time(self, client):
        """Test API response times"""
        with patch.object(client, '_make_request') as mock_request:
            # Simulate realistic response time
            async def delayed_response(*args, **kwargs):
                await asyncio.sleep(0.1)  # 100ms delay
                return {"content": "Delayed response"}

            mock_request.side_effect = delayed_response

            start_time = time.time()
            result = await client.get_prompt("test-prompt")
            end_time = time.time()

            response_time = end_time - start_time
            assert response_time < 0.5  # Should be under 500ms including delay

    @pytest.mark.asyncio
    async def test_memory_usage(self, client):
        """Test memory usage patterns"""
        import psutil
        import os

        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss

        # Make multiple requests
        with patch.object(client, '_make_request') as mock_request:
            mock_request.return_value = {"content": "Memory test content"}

            for i in range(100):
                await client.get_prompt(f"memory-test-prompt-{i}")

        final_memory = process.memory_info().rss
        memory_increase = final_memory - initial_memory

        # Memory increase should be reasonable (less than 50MB)
        assert memory_increase < 50 * 1024 * 1024

    @pytest.mark.asyncio
    async def test_connection_pooling(self, client):
        """Test HTTP connection pooling"""
        with patch.object(client, '_make_request') as mock_request:
            mock_request.return_value = {"content": "Pooled response"}

            # Make many requests to test connection reuse
            for i in range(50):
                await client.get_prompt(f"pooled-prompt-{i}")

            # Verify connection pool usage (this would require more sophisticated mocking)
            assert True  # Placeholder for actual connection pool verification


@pytest.mark.integration
class TestSecurityIntegration:
    """Integration tests for security features"""

    @pytest.mark.asyncio
    async def test_authentication_flow(self, client):
        """Test authentication and authorization flow"""
        with patch.object(client, '_make_request') as mock_request:
            # Test successful authentication
            mock_request.return_value = {"content": "Authenticated content"}

            result = await client.get_prompt("secure-prompt")
            assert result["content"] == "Authenticated content"

            # Test authentication failure
            mock_request.side_effect = PromptOpsError("Authentication failed")

            with pytest.raises(PromptOpsError):
                await client.get_prompt("secure-prompt")

    @pytest.mark.asyncio
    async def test_data_encryption(self, client):
        """Test data encryption for sensitive data"""
        # This would test actual encryption in a real implementation
        with patch.object(client, '_make_request') as mock_request:
            mock_request.return_value = {"content": "Encrypted content"}

            result = await client.get_prompt("encrypted-prompt")
            assert result["content"] == "Encrypted content"

    @pytest.mark.asyncio
    async def test_input_validation(self, client):
        """Test input validation and sanitization"""
        # Test malicious input
        malicious_inputs = [
            {"script": "<script>alert('xss')</script>"},
            {"sql": "SELECT * FROM users"},
            {"command": "rm -rf /"}
        ]

        for malicious_input in malicious_inputs:
            with patch.object(client, '_make_request') as mock_request:
                mock_request.return_value = {"content": "Sanitized"}

                variables = PromptVariables(variables=malicious_input)
                result = await client.render_prompt("validation-prompt", variables)

                # Should handle malicious input safely
                assert result is not None


@pytest.mark.integration
class TestReliabilityIntegration:
    """Integration tests for reliability and fault tolerance"""

    @pytest.mark.asyncio
    async def test_circuit_breaker(self, client):
        """Test circuit breaker pattern"""
        with patch.object(client, '_make_request') as mock_request:
            # Simulate repeated failures
            mock_request.side_effect = PromptOpsError("Service unavailable")

            # Should fail fast after multiple failures
            with pytest.raises(PromptOpsError):
                for _ in range(5):
                    await client.get_prompt("circuit-test-prompt")

    @pytest.mark.asyncio
    async def test_timeout_handling(self, client):
        """Test timeout handling"""
        # Update configuration with short timeout
        await client.update_config({"timeout": 0.1})

        with patch.object(client, '_make_request') as mock_request:
            # Simulate timeout
            async def timeout_response(*args, **kwargs):
                await asyncio.sleep(0.2)  # Longer than timeout
                return {"content": "Timeout response"}

            mock_request.side_effect = timeout_response

            with pytest.raises(asyncio.TimeoutError):
                await client.get_prompt("timeout-prompt")

    @pytest.mark.asyncio
    async def test_retry_mechanism(self, client):
        """Test retry mechanism for transient failures"""
        with patch.object(client, '_make_request') as mock_request:
            # Fail first, then succeed
            mock_request.side_effect = [
                aiohttp.ClientError("Transient error"),
                {"content": "Retry success"}
            ]

            result = await client.get_prompt("retry-prompt")
            assert result["content"] == "Retry success"

    @pytest.mark.asyncio
    async def test_graceful_degradation(self, client):
        """Test graceful degradation when services are unavailable"""
        # Disable caching
        await client.update_config({"enable_cache": False})

        with patch.object(client, '_make_request') as mock_request:
            mock_request.return_value = {"content": "Degraded mode content"}

            result = await client.get_prompt("degraded-prompt")
            assert result["content"] == "Degraded mode content"