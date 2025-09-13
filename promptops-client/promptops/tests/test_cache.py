"""
Tests for cache manager
"""

import asyncio
import pytest
from unittest.mock import MagicMock, patch

from promptops.cache import CacheManager
from promptops.models import CacheConfig, CacheLevel


@pytest.fixture
def memory_config():
    """Create memory cache config"""
    return CacheConfig(
        level=CacheLevel.MEMORY,
        ttl=300,
        max_size=100
    )


@pytest.fixture
def redis_config():
    """Create Redis cache config"""
    return CacheConfig(
        level=CacheLevel.REDIS,
        ttl=300,
        max_size=100,
        redis_url="redis://localhost:6379"
    )


@pytest.fixture
def hybrid_config():
    """Create hybrid cache config"""
    return CacheConfig(
        level=CacheLevel.HYBRID,
        ttl=300,
        max_size=100,
        redis_url="redis://localhost:6379"
    )


@pytest.mark.asyncio
async def test_memory_cache_operations(memory_config):
    """Test memory cache operations"""
    cache = CacheManager(memory_config)

    # Test set and get
    await cache.set("test_key", "test_value")
    result = await cache.get("test_key")
    assert result == "test_value"

    # Test cache miss
    result = await cache.get("nonexistent_key")
    assert result is None

    # Test delete
    deleted = await cache.delete("test_key")
    assert deleted is True

    result = await cache.get("test_key")
    assert result is None

    # Test delete non-existent key
    deleted = await cache.delete("nonexistent_key")
    assert deleted is False


@pytest.mark.asyncio
async def test_cache_ttl(memory_config):
    """Test cache TTL"""
    cache = CacheManager(CacheConfig(
        level=CacheLevel.MEMORY,
        ttl=1,  # 1 second
        max_size=100
    ))

    # Set value
    await cache.set("test_key", "test_value")

    # Should be available immediately
    result = await cache.get("test_key")
    assert result == "test_value"

    # Wait for expiration
    await asyncio.sleep(1.1)

    # Should be expired
    result = await cache.get("test_key")
    assert result is None


@pytest.mark.asyncio
async def test_cache_size_limit(memory_config):
    """Test cache size limit"""
    cache = CacheManager(CacheConfig(
        level=CacheLevel.MEMORY,
        ttl=300,
        max_size=2  # Very small limit
    ))

    # Fill cache
    await cache.set("key1", "value1")
    await cache.set("key2", "value2")
    await cache.set("key3", "value3")  # Should evict oldest

    # Check eviction
    result = await cache.get("key1")
    assert result is None  # Should be evicted

    result = await cache.get("key2")
    assert result == "value2"

    result = await cache.get("key3")
    assert result == "value3"


@pytest.mark.asyncio
async def test_cache_clear(memory_config):
    """Test cache clear"""
    cache = CacheManager(memory_config)

    # Set some values
    await cache.set("key1", "value1")
    await cache.set("key2", "value2")

    # Verify they exist
    assert await cache.get("key1") == "value1"
    assert await cache.get("key2") == "value2"

    # Clear cache
    await cache.clear()

    # Verify they're gone
    assert await cache.get("key1") is None
    assert await cache.get("key2") is None


@pytest.mark.asyncio
async def test_cache_stats(memory_config):
    """Test cache statistics"""
    cache = CacheManager(memory_config)

    # Initial stats
    stats = cache.get_stats()
    assert stats.hits == 0
    assert stats.misses == 0
    assert stats.hit_rate == 0.0

    # Cache hit
    await cache.set("key1", "value1")
    await cache.get("key1")
    stats = cache.get_stats()
    assert stats.hits == 1
    assert stats.misses == 0
    assert stats.hit_rate == 1.0

    # Cache miss
    await cache.get("nonexistent")
    stats = cache.get_stats()
    assert stats.hits == 1
    assert stats.misses == 1
    assert stats.hit_rate == 0.5


@pytest.mark.asyncio
async def test_cache_cleanup_expired(memory_config):
    """Test cleanup of expired entries"""
    cache = CacheManager(CacheConfig(
        level=CacheLevel.MEMORY,
        ttl=1,  # 1 second
        max_size=100
    ))

    # Set values
    await cache.set("key1", "value1")
    await cache.set("key2", "value2")

    # Wait for expiration
    await asyncio.sleep(1.1)

    # Cleanup
    await cache.cleanup_expired()

    # Verify cleaned up
    assert await cache.get("key1") is None
    assert await cache.get("key2") is None


@pytest.mark.asyncio
async def test_cache_disabled():
    """Test disabled cache"""
    config = CacheConfig(level=CacheLevel.NONE)
    cache = CacheManager(config)

    # Should be disabled
    assert not cache.is_enabled()

    # Operations should work but not cache
    await cache.set("key1", "value1")
    result = await cache.get("key1")
    assert result is None


@pytest.mark.asyncio
async def test_redis_fallback(redis_config):
    """Test Redis fallback to memory when Redis unavailable"""
    with patch('promptops.cache.redis') as mock_redis:
        # Simulate Redis import error
        mock_redis.from_url.side_effect = ImportError("Redis not available")

        cache = CacheManager(redis_config)

        # Should fall back to memory cache
        assert cache.get_cache_level() == CacheLevel.MEMORY

        # Should still work with memory cache
        await cache.set("test_key", "test_value")
        result = await cache.get("test_key")
        assert result == "test_value"


@pytest.mark.asyncio
async def test_hybrid_cache_operations(hybrid_config):
    """Test hybrid cache operations"""
    with patch('promptops.cache.redis') as mock_redis:
        # Mock Redis client
        mock_redis_client = MagicMock()
        mock_redis_client.ping.return_value = True
        mock_redis_client.get.return_value = None
        mock_redis_client.setex.return_value = True
        mock_redis_client.delete.return_value = 1
        mock_redis_client.keys.return_value = []
        mock_redis.from_url.return_value = mock_redis_client

        cache = CacheManager(hybrid_config)

        # Should use hybrid cache
        assert cache.get_cache_level() == CacheLevel.HYBRID

        # Test operations
        await cache.set("test_key", "test_value")
        result = await cache.get("test_key")
        assert result == "test_value"

        # Verify Redis operations were called
        mock_redis_client.setex.assert_called_once()
        mock_redis_client.get.assert_called()


@pytest.mark.asyncio
async def test_cache_retry_behavior(memory_config):
    """Test cache retry behavior"""
    cache = CacheManager(memory_config)

    # Test that operations are retried on failure
    with patch.object(cache, '_get_memory', side_effect=[Exception("Failed"), "test_value"]):
        result = await cache.get("test_key")
        assert result == "test_value"  # Should succeed after retry


@pytest.mark.asyncio
async def test_cache_custom_ttl(memory_config):
    """Test custom TTL override"""
    cache = CacheManager(memory_config)

    # Set with custom TTL
    await cache.set("test_key", "test_value", ttl=5)

    # Should be available
    result = await cache.get("test_key")
    assert result == "test_value"

    # Test with zero TTL (should still work)
    await cache.set("test_key2", "test_value2", ttl=0)
    result = await cache.get("test_key2")
    assert result == "test_value2"


@pytest.mark.asyncio
async def test_cache_complex_values(memory_config):
    """Test caching complex values"""
    cache = CacheManager(memory_config)

    complex_value = {
        "text": "Hello",
        "numbers": [1, 2, 3],
        "nested": {"key": "value"}
    }

    await cache.set("complex_key", complex_value)
    result = await cache.get("complex_key")
    assert result == complex_value


@pytest.mark.asyncio
async def test_cache_reset_stats(memory_config):
    """Test resetting cache statistics"""
    cache = CacheManager(memory_config)

    # Generate some stats
    await cache.set("key1", "value1")
    await cache.get("key1")
    await cache.get("nonexistent")

    stats = cache.get_stats()
    assert stats.hits > 0
    assert stats.misses > 0

    # Reset stats
    cache.reset_stats()

    stats = cache.get_stats()
    assert stats.hits == 0
    assert stats.misses == 0
    assert stats.hit_rate == 0.0