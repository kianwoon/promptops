"""
Cache manager for PromptOps client with multi-level caching support
"""

import json
import threading
import time
from datetime import datetime, timedelta
from typing import Any, Dict, Optional, Union

import structlog
from tenacity import retry, stop_after_attempt, wait_exponential

from .exceptions import CacheError
from .models import CacheConfig, CacheLevel, CacheStats

logger = structlog.get_logger(__name__)


class CacheManager:
    """Multi-level cache manager for PromptOps client"""

    def __init__(self, config: CacheConfig):
        self.config = config
        self._memory_cache: Dict[str, Dict[str, Any]] = {}
        self._memory_cache_lock = threading.RLock()
        self._redis_client = None
        self._stats = CacheStats()

        # Initialize Redis if configured
        if config.level in [CacheLevel.REDIS, CacheLevel.HYBRID] and config.redis_url:
            self._init_redis()

    def _init_redis(self) -> None:
        """Initialize Redis client"""
        try:
            import redis
            self._redis_client = redis.from_url(self.config.redis_url)
            # Test connection
            self._redis_client.ping()
            logger.info("Redis cache initialized", url=self.config.redis_url)
        except ImportError:
            logger.warning("Redis not available, falling back to memory cache")
            self.config.level = CacheLevel.MEMORY
        except Exception as e:
            logger.error("Redis initialization failed", error=str(e))
            self.config.level = CacheLevel.MEMORY

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        reraise=True
    )
    async def get(self, key: str) -> Optional[Any]:
        """
        Get value from cache

        Args:
            key: Cache key

        Returns:
            Cached value or None if not found
        """
        try:
            # Try memory cache first
            if self.config.level in [CacheLevel.MEMORY, CacheLevel.HYBRID]:
                value = self._get_memory(key)
                if value is not None:
                    self._stats.hits += 1
                    self._stats.update_hit_rate()
                    logger.debug("Cache hit (memory)", key=key)
                    return value

            # Try Redis cache
            if self.config.level in [CacheLevel.REDIS, CacheLevel.HYBRID]:
                value = await self._get_redis(key)
                if value is not None:
                    # Store in memory cache for faster access
                    if self.config.level == CacheLevel.HYBRID:
                        self._set_memory(key, value)
                    self._stats.hits += 1
                    self._stats.update_hit_rate()
                    logger.debug("Cache hit (redis)", key=key)
                    return value

            # Cache miss
            self._stats.misses += 1
            self._stats.update_hit_rate()
            logger.debug("Cache miss", key=key)
            return None

        except Exception as e:
            logger.error("Cache get failed", key=key, error=str(e))
            raise CacheError(f"Cache get failed: {str(e)}")

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        reraise=True
    )
    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """
        Set value in cache

        Args:
            key: Cache key
            value: Value to cache
            ttl: Time-to-live in seconds (overrides config)
        """
        try:
            if ttl is None:
                ttl = self.config.ttl

            # Set in memory cache
            if self.config.level in [CacheLevel.MEMORY, CacheLevel.HYBRID]:
                self._set_memory(key, value, ttl)

            # Set in Redis cache
            if self.config.level in [CacheLevel.REDIS, CacheLevel.HYBRID]:
                await self._set_redis(key, value, ttl)

            self._stats.size = len(self._memory_cache)
            logger.debug("Cache set", key=key, ttl=ttl)

        except Exception as e:
            logger.error("Cache set failed", key=key, error=str(e))
            raise CacheError(f"Cache set failed: {str(e)}")

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        reraise=True
    )
    async def delete(self, key: str) -> bool:
        """
        Delete value from cache

        Args:
            key: Cache key

        Returns:
            True if key was deleted, False if key didn't exist
        """
        try:
            deleted = False

            # Delete from memory cache
            if self.config.level in [CacheLevel.MEMORY, CacheLevel.HYBRID]:
                if self._delete_memory(key):
                    deleted = True

            # Delete from Redis cache
            if self.config.level in [CacheLevel.REDIS, CacheLevel.HYBRID]:
                if await self._delete_redis(key):
                    deleted = True

            self._stats.size = len(self._memory_cache)
            logger.debug("Cache delete", key=key, deleted=deleted)
            return deleted

        except Exception as e:
            logger.error("Cache delete failed", key=key, error=str(e))
            raise CacheError(f"Cache delete failed: {str(e)}")

    async def clear(self) -> None:
        """Clear all cache entries"""
        try:
            # Clear memory cache
            if self.config.level in [CacheLevel.MEMORY, CacheLevel.HYBRID]:
                with self._memory_cache_lock:
                    self._memory_cache.clear()

            # Clear Redis cache
            if self.config.level in [CacheLevel.REDIS, CacheLevel.HYBRID] and self._redis_client:
                # Clear keys with our prefix
                keys = self._redis_client.keys(f"{self.config.redis_prefix}*")
                if keys:
                    self._redis_client.delete(*keys)

            self._stats.size = 0
            logger.info("Cache cleared")

        except Exception as e:
            logger.error("Cache clear failed", error=str(e))
            raise CacheError(f"Cache clear failed: {str(e)}")

    def _get_memory(self, key: str) -> Optional[Any]:
        """Get value from memory cache"""
        with self._memory_cache_lock:
            if key not in self._memory_cache:
                return None

            entry = self._memory_cache[key]
            if datetime.utcnow() > entry['expires_at']:
                # Entry expired
                del self._memory_cache[key]
                self._stats.evictions += 1
                return None

            return entry['value']

    def _set_memory(self, key: str, value: Any, ttl: int) -> None:
        """Set value in memory cache"""
        with self._memory_cache_lock:
            # Check cache size limit
            if len(self._memory_cache) >= self.config.max_size:
                # Evict oldest entries
                oldest_key = min(
                    self._memory_cache.keys(),
                    key=lambda k: self._memory_cache[k]['expires_at']
                )
                del self._memory_cache[oldest_key]
                self._stats.evictions += 1

            self._memory_cache[key] = {
                'value': value,
                'expires_at': datetime.utcnow() + timedelta(seconds=ttl),
                'created_at': datetime.utcnow()
            }

    def _delete_memory(self, key: str) -> bool:
        """Delete value from memory cache"""
        with self._memory_cache_lock:
            if key in self._memory_cache:
                del self._memory_cache[key]
                return True
            return False

    async def _get_redis(self, key: str) -> Optional[Any]:
        """Get value from Redis cache"""
        if not self._redis_client:
            return None

        try:
            full_key = f"{self.config.redis_prefix}{key}"
            value = self._redis_client.get(full_key)
            if value is not None:
                return json.loads(value.decode('utf-8'))
            return None
        except Exception as e:
            logger.error("Redis get failed", key=key, error=str(e))
            return None

    async def _set_redis(self, key: str, value: Any, ttl: int) -> None:
        """Set value in Redis cache"""
        if not self._redis_client:
            return

        try:
            full_key = f"{self.config.redis_prefix}{key}"
            serialized_value = json.dumps(value, default=str)
            self._redis_client.setex(full_key, ttl, serialized_value)
        except Exception as e:
            logger.error("Redis set failed", key=key, error=str(e))
            raise CacheError(f"Redis set failed: {str(e)}")

    async def _delete_redis(self, key: str) -> bool:
        """Delete value from Redis cache"""
        if not self._redis_client:
            return False

        try:
            full_key = f"{self.config.redis_prefix}{key}"
            return bool(self._redis_client.delete(full_key))
        except Exception as e:
            logger.error("Redis delete failed", key=key, error=str(e))
            return False

    def get_stats(self) -> CacheStats:
        """Get cache statistics"""
        # Update current size
        self._stats.size = len(self._memory_cache)
        return self._stats.copy()

    def reset_stats(self) -> None:
        """Reset cache statistics"""
        self._stats = CacheStats()

    async def cleanup_expired(self) -> None:
        """Clean up expired entries from memory cache"""
        with self._memory_cache_lock:
            now = datetime.utcnow()
            expired_keys = [
                key for key, entry in self._memory_cache.items()
                if now > entry['expires_at']
            ]

            for key in expired_keys:
                del self._memory_cache[key]
                self._stats.evictions += 1

        logger.info("Cache cleanup completed", cleaned=len(expired_keys))

    def is_enabled(self) -> bool:
        """Check if caching is enabled"""
        return self.config.level != CacheLevel.NONE

    def get_cache_level(self) -> CacheLevel:
        """Get current cache level"""
        return self.config.level