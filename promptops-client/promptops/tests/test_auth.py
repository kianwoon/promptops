"""
Tests for authentication manager
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timedelta

from promptops.auth import AuthenticationManager
from promptops.models import ClientConfig
from promptops.exceptions import AuthenticationError


@pytest.fixture
def config():
    """Create test configuration"""
    return ClientConfig(
        base_url="https://api.promptops.ai",
        api_key="test-api-key-12345678",
        timeout=30.0
    )


@pytest.fixture
def auth_manager(config):
    """Create authentication manager"""
    return AuthenticationManager(config)


@pytest.mark.asyncio
async def test_get_auth_headers_basic(auth_manager):
    """Test basic authentication header generation"""
    endpoint = "/api/prompts/test"
    method = "GET"

    headers = await auth_manager.get_auth_headers(endpoint, method)

    # Check required headers
    assert "Authorization" in headers
    assert "X-PromptOps-Timestamp" in headers
    assert "X-PromptOps-Nonce" in headers
    assert "X-PromptOps-Signature" in headers
    assert "User-Agent" in headers

    # Check header values
    assert headers["Authorization"] == "PromptOps test-api-key-12345678"
    assert headers["User-Agent"] == "promptops-client/1.0.0"


@pytest.mark.asyncio
async def test_get_auth_headers_with_body(auth_manager):
    """Test authentication headers with request body"""
    endpoint = "/api/prompts/test"
    method = "POST"
    body = '{"name": "test"}'

    headers = await auth_manager.get_auth_headers(endpoint, method, body)

    # Headers should include body hash
    assert "Authorization" in headers
    assert "X-PromptOps-Signature" in headers


@pytest.mark.asyncio
async def test_auth_header_caching(auth_manager):
    """Test authentication header caching"""
    endpoint = "/api/prompts/test"
    method = "GET"

    # First call should generate headers
    headers1 = await auth_manager.get_auth_headers(endpoint, method)

    # Second call should use cached headers
    headers2 = await auth_manager.get_auth_headers(endpoint, method)

    # Should be the same headers
    assert headers1 == headers2

    # Check that cache was used
    assert len(auth_manager._token_cache) == 1


@pytest.mark.asyncio
async def test_auth_header_cache_expiry(auth_manager):
    """Test authentication header cache expiry"""
    # Set very short cache TTL
    auth_manager._token_cache_ttl = timedelta(microseconds=1)

    endpoint = "/api/prompts/test"
    method = "GET"

    # First call
    headers1 = await auth_manager.get_auth_headers(endpoint, method)

    # Wait for cache expiry
    import time
    time.sleep(0.001)

    # Second call should generate new headers
    headers2 = await auth_manager.get_auth_headers(endpoint, method)

    # Signatures should be different (different nonce/timestamp)
    assert headers1["X-PromptOps-Signature"] != headers2["X-PromptOps-Signature"]


@pytest.mark.asyncio
async def test_validate_api_key_success(auth_manager):
    """Test successful API key validation"""
    result = await auth_manager.validate_api_key()
    assert result is True


@pytest.mark.asyncio
async def test_validate_api_key_empty():
    """Test API key validation with empty key"""
    config = ClientConfig(base_url="https://api.test.com", api_key="")
    auth_manager = AuthenticationManager(config)

    with pytest.raises(AuthenticationError, match="Invalid API key format"):
        await auth_manager.validate_api_key()


@pytest.mark.asyncio
async def test_validate_api_key_too_short():
    """Test API key validation with key that's too short"""
    config = ClientConfig(base_url="https://api.test.com", api_key="short")
    auth_manager = AuthenticationManager(config)

    with pytest.raises(AuthenticationError, match="Invalid API key format"):
        await auth_manager.validate_api_key()


@pytest.mark.asyncio
async def test_get_api_key_info(auth_manager):
    """Test getting API key information"""
    info = auth_manager.get_api_key_info()

    assert "key_prefix" in info
    assert "key_length" in info
    assert "has_special_chars" in info

    # Check expected values
    assert info["key_prefix"] == "test-api"
    assert info["key_length"] == 19
    assert info["has_special_chars"] is True


def test_generate_nonce(auth_manager):
    """Test nonce generation"""
    nonce1 = auth_manager._generate_nonce()
    nonce2 = auth_manager._generate_nonce()

    # Nonces should be different
    assert nonce1 != nonce2

    # Nonces should be strings
    assert isinstance(nonce1, str)
    assert isinstance(nonce2, str)

    # Nonces should be reasonable length
    assert len(nonce1) == 32  # MD5 hash length


def test_sign_string(auth_manager):
    """Test string signing"""
    string_to_sign = "test:GET:/api/prompts:1234567890:abc123"
    signature = auth_manager._sign_string(string_to_sign)

    # Signature should be a hex string
    assert isinstance(signature, str)
    assert len(signature) == 64  # SHA256 hex length

    # Same string should produce same signature
    signature2 = auth_manager._sign_string(string_to_sign)
    assert signature == signature2


def test_cleanup_token_cache(auth_manager):
    """Test token cache cleanup"""
    # Add some expired entries
    now = datetime.utcnow()
    expired_time = now - timedelta(hours=2)
    future_time = now + timedelta(hours=1)

    auth_manager._token_cache["expired1"] = ({}, expired_time)
    auth_manager._token_cache["expired2"] = ({}, expired_time)
    auth_manager._token_cache["valid"] = ({}, future_time)

    # Cleanup should remove expired entries
    auth_manager._cleanup_token_cache()

    # Only valid entry should remain
    assert len(auth_manager._token_cache) == 1
    assert "valid" in auth_manager._token_cache
    assert "expired1" not in auth_manager._token_cache
    assert "expired2" not in auth_manager._token_cache


@pytest.mark.asyncio
async def test_refresh_token(auth_manager):
    """Test token refresh"""
    # Add some cache entries
    auth_manager._token_cache["test1"] = ({}, datetime.utcnow() + timedelta(hours=1))

    # Refresh without force
    result = await auth_manager.refresh_token()
    assert result is True

    # Cache should still be there
    assert len(auth_manager._token_cache) == 1

    # Refresh with force
    result = await auth_manager.refresh_token(force=True)
    assert result is True

    # Cache should be cleared
    assert len(auth_manager._token_cache) == 0


@pytest.mark.asyncio
async def test_clear_cache(auth_manager):
    """Test clearing authentication cache"""
    # Add some cache entries
    auth_manager._token_cache["test1"] = ({}, datetime.utcnow() + timedelta(hours=1))
    auth_manager._token_cache["test2"] = ({}, datetime.utcnow() + timedelta(hours=1))

    # Clear cache
    auth_manager.clear_cache()

    # Cache should be empty
    assert len(auth_manager._token_cache) == 0


@pytest.mark.asyncio
async def test_test_connection_success(auth_manager):
    """Test successful connection test"""
    with patch.object(auth_manager, 'validate_api_key', new_callable=AsyncMock) as mock_validate:
        mock_validate.return_value = True

        result = await auth_manager.test_connection()

        assert result is True
        mock_validate.assert_called_once()


@pytest.mark.asyncio
async def test_test_connection_failure(auth_manager):
    """Test failed connection test"""
    with patch.object(auth_manager, 'validate_api_key', new_callable=AsyncMock) as mock_validate:
        mock_validate.side_effect = AuthenticationError("Invalid API key")

        with pytest.raises(AuthenticationError, match="Invalid API key"):
            await auth_manager.test_connection()


@pytest.mark.asyncio
async def test_get_auth_headers_error_handling(auth_manager):
    """Test error handling in get_auth_headers"""
    with patch.object(auth_manager, '_generate_auth_headers', side_effect=Exception("Test error")):
        with pytest.raises(AuthenticationError, match="Authentication failed: Test error"):
            await auth_manager.get_auth_headers("/api/test", "GET")


@pytest.mark.asyncio
async def test_url_parsing_with_query_params(auth_manager):
    """Test URL parsing with query parameters"""
    endpoint = "/api/prompts?module=test&limit=10"
    method = "GET"

    headers = await auth_manager.get_auth_headers(endpoint, method)

    # Should handle query parameters correctly
    assert "Authorization" in headers
    assert "X-PromptOps-Signature" in headers


@pytest.mark.asyncio
async def test_different_http_methods(auth_manager):
    """Test different HTTP methods"""
    endpoint = "/api/prompts/test"

    # Test GET
    get_headers = await auth_manager.get_auth_headers(endpoint, "GET")
    assert "Authorization" in get_headers

    # Test POST
    post_headers = await auth_manager.get_auth_headers(endpoint, "POST")
    assert "Authorization" in post_headers

    # Test PUT
    put_headers = await auth_manager.get_auth_headers(endpoint, "PUT")
    assert "Authorization" in put_headers

    # Test DELETE
    delete_headers = await auth_manager.get_auth_headers(endpoint, "DELETE")
    assert "Authorization" in delete_headers