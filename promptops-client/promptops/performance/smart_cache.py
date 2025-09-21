"""
Smart caching strategies with intelligent hit/miss analysis and optimization
"""

import asyncio
import hashlib
import json
import time
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple, Callable, Union
from dataclasses import dataclass, field
import threading
from collections import defaultdict, deque
import logging
import statistics

import structlog

from .models import OptimizationStrategy

logger = structlog.get_logger(__name__)


class CacheStrategy(Enum):
    """Caching strategies"""
    LRU = "lru"  # Least Recently Used
    LFU = "lfu"  # Least Frequently Used
    FIFO = "fifo"  # First In First Out
    ADAPTIVE = "adaptive"  # Adaptive based on usage patterns
    PREDICTIVE = "predictive"  # Predictive prefetching
    HYBRID = "hybrid"  # Combination of strategies


class CacheTier(Enum):
    """Cache tiers"""
    HOT = "hot"  # Frequently accessed items
    WARM = "warm"  # Moderately accessed items
    COLD = "cold"  # Rarely accessed items
    FROZEN = "frozen"  # Very rarely accessed items


class PrefetchStrategy(Enum):
    """Prefetching strategies"""
    NONE = "none"
    ALWAYS = "always"
    ADAPTIVE = "adaptive"
    PREDICTIVE = "predictive"


@dataclass
class CacheItem:
    """Individual cache item with metadata"""
    key: str
    value: Any
    created_at: datetime
    last_accessed: datetime
    access_count: int = 0
    size_bytes: int = 0
    cost_to_fetch: float = 0.0
    access_pattern_score: float = 0.0
    tier: CacheTier = CacheTier.COLD
    tags: Set[str] = field(default_factory=set)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CacheAnalytics:
    """Cache analytics and performance metrics"""
    total_requests: int = 0
    hits: int = 0
    misses: int = 0
    forced_evictions: int = 0
    size_evictions: int = 0
    ttl_evictions: int = 0
    prefetch_hits: int = 0
    prefetch_misses: int = 0

    # Performance metrics
    average_hit_rate: float = 0.0
    average_miss_rate: float = 0.0
    average_access_time: float = 0.0
    average_item_lifetime: float = 0.0

    # Cost metrics
    total_fetch_cost: float = 0.0
    saved_fetch_cost: float = 0.0
    cache_efficiency: float = 0.0

    # Pattern analysis
    access_patterns: Dict[str, List[float]] = field(default_factory=dict)
    temporal_patterns: Dict[str, List[datetime]] = field(default_factory=dict)
    sequence_patterns: List[List[str]] = field(default_factory=list)

    # Tier distribution
    tier_distribution: Dict[CacheTier, int] = field(default_factory=lambda: {
        CacheTier.HOT: 0,
        CacheTier.WARM: 0,
        CacheTier.COLD: 0,
        CacheTier.FROZEN: 0
    })


@dataclass
class SmartCacheConfig:
    """Configuration for smart caching"""
    max_size: int = 1000
    max_memory_bytes: int = 100 * 1024 * 1024  # 100MB
    default_ttl: float = 3600.0  # 1 hour
    strategy: CacheStrategy = CacheStrategy.ADAPTIVE
    enable_tiering: bool = True
    enable_prefetching: bool = True
    prefetch_strategy: PrefetchStrategy = PrefetchStrategy.ADAPTIVE
    enable_pattern_analysis: bool = True
    enable_cost_analysis: bool = True
    enable_adaptive_ttl: bool = True
    enable_compression: bool = True
    compression_threshold: int = 1024  # 1KB
    analytics_retention_hours: int = 24
    pattern_window_minutes: int = 60
    prefetch_accuracy_threshold: float = 0.7
    adaptive_ttl_multiplier: float = 2.0
    hot_item_threshold: float = 0.8  # Access frequency
    warm_item_threshold: float = 0.5  # Access frequency


class SmartCacheManager:
    """Smart cache manager with intelligent optimization strategies"""

    def __init__(self, config: SmartCacheConfig, fetch_function: Callable[[str], Any]):
        self.config = config
        self.fetch_function = fetch_function

        # Cache storage
        self.cache: Dict[str, CacheItem] = {}
        self.access_order: deque = deque()
        self.access_frequency: Dict[str, int] = defaultdict(int)
        self.tier_cache: Dict[CacheTier, Set[str]] = {
            CacheTier.HOT: set(),
            CacheTier.WARM: set(),
            CacheTier.COLD: set(),
            CacheTier.FROZEN: set()
        }

        # Analytics
        self.analytics = CacheAnalytics()
        self.access_history: deque = deque(maxlen=10000)
        self.pattern_history: deque = deque(maxlen=1000)
        self.cost_history: deque = deque(maxlen=1000)

        # Prefetching
        self.prefetch_queue: asyncio.Queue = asyncio.Queue()
        self.prefetch_cache: Dict[str, Any] = {}
        self.prediction_model: Optional[Callable] = None

        # Background tasks
        self._analytics_task: Optional[asyncio.Task] = None
        self._prefetch_task: Optional[asyncio.Task] = None
        self._cleanup_task: Optional[asyncio.Task] = None
        self._adaptive_task: Optional[asyncio.Task] = None

        # Synchronization
        self._lock = asyncio.Lock()
        self._running = False

        # Initialize
        if self.config.enable_prefetching:
            self._start_prefetcher()

        if self.config.enable_pattern_analysis:
            self._start_analytics()

    async def initialize(self) -> None:
        """Initialize the smart cache manager"""
        if self._running:
            return

        self._running = True
        logger.info("Initializing smart cache manager", strategy=self.config.strategy)

        # Start background tasks
        if self.config.enable_pattern_analysis:
            self._analytics_task = asyncio.create_task(self._analytics_loop())

        if self.config.enable_prefetching:
            self._prefetch_task = asyncio.create_task(self._prefetch_loop())

        self._cleanup_task = asyncio.create_task(self._cleanup_loop())

        if self.config.strategy == CacheStrategy.ADAPTIVE:
            self._adaptive_task = asyncio.create_task(self._adaptive_loop())

    async def get(self, key: str) -> Optional[Any]:
        """
        Get value from cache with smart strategy

        Args:
            key: Cache key

        Returns:
            Cached value or None if not found
        """
        start_time = time.time()
        self.analytics.total_requests += 1

        # Check prefetch cache first
        if key in self.prefetch_cache:
            self.analytics.prefetch_hits += 1
            value = self.prefetch_cache.pop(key)
            await self._record_access(key, True, time.time() - start_time)
            return value

        # Check main cache
        async with self._lock:
            if key in self.cache:
                item = self.cache[key]
                if self._is_item_valid(item):
                    # Update access metrics
                    self._update_access_metrics(key, item)
                    self.analytics.hits += 1
                    self.analytics.saved_fetch_cost += item.cost_to_fetch

                    # Record access
                    await self._record_access(key, True, time.time() - start_time)

                    # Trigger prefetching if enabled
                    if self.config.enable_prefetching:
                        await self._trigger_prefetch(key)

                    return item.value
                else:
                    # Item expired, remove it
                    await self._remove_item(key)
                    self.analytics.ttl_evictions += 1

        # Cache miss
        self.analytics.misses += 1
        await self._record_access(key, False, time.time() - start_time)

        # Fetch the value
        try:
            fetch_start = time.time()
            value = await self.fetch_function(key)
            fetch_time = time.time() - fetch_start

            # Store in cache
            await self.set(key, value, cost_to_fetch=fetch_time)

            return value

        except Exception as e:
            logger.error("Failed to fetch value for key", key=key, error=str(e))
            return None

    async def set(self, key: str, value: Any, ttl: Optional[float] = None,
                 cost_to_fetch: float = 0.0, tags: Optional[Set[str]] = None) -> None:
        """
        Set value in cache with smart strategy

        Args:
            key: Cache key
            value: Value to cache
            ttl: Time to live in seconds
            cost_to_fetch: Cost to fetch this value
            tags: Tags for categorization
        """
        async with self._lock:
            # Calculate size
            size_bytes = self._calculate_size(value)

            # Apply compression if enabled
            if (self.config.enable_compression and
                size_bytes > self.config.compression_threshold):
                value = self._compress_value(value)
                size_bytes = len(str(value).encode('utf-8'))

            # Determine TTL
            if ttl is None:
                ttl = self._calculate_adaptive_ttl(key, cost_to_fetch)

            # Create cache item
            item = CacheItem(
                key=key,
                value=value,
                created_at=datetime.utcnow(),
                last_accessed=datetime.utcnow(),
                access_count=0,
                size_bytes=size_bytes,
                cost_to_fetch=cost_to_fetch,
                tags=tags or set()
            )

            # Check if we need to evict items
            await self._ensure_space(size_bytes)

            # Add to cache
            self.cache[key] = item
            self.access_order.append(key)
            self.access_frequency[key] += 1

            # Assign tier
            if self.config.enable_tiering:
                self._assign_tier(item)

            # Update analytics
            self.analytics.total_fetch_cost += cost_to_fetch

    async def _ensure_space(self, required_bytes: int) -> None:
        """Ensure there's enough space in the cache"""
        current_size = sum(item.size_bytes for item in self.cache.values())
        current_count = len(self.cache)

        # Check size constraints
        if (current_size + required_bytes <= self.config.max_memory_bytes and
            current_count < self.config.max_size):
            return

        # Eviction strategy based on configuration
        if self.config.strategy == CacheStrategy.LRU:
            await self._evict_lru(required_bytes)
        elif self.config.strategy == CacheStrategy.LFU:
            await self._evict_lfu(required_bytes)
        elif self.config.strategy == CacheStrategy.FIFO:
            await self._evict_fifo(required_bytes)
        elif self.config.strategy == CacheStrategy.ADAPTIVE:
            await self._evict_adaptive(required_bytes)
        else:
            await self._evict_adaptive(required_bytes)  # Default to adaptive

    async def _evict_lru(self, required_bytes: int) -> None:
        """Evict using Least Recently Used strategy"""
        evicted_bytes = 0
        evicted_count = 0

        while (evicted_bytes < required_bytes and
               len(self.cache) > self.config.max_size * 0.7):  # Keep 30% buffer

            if not self.access_order:
                break

            key = self.access_order.popleft()
            if key in self.cache:
                item = self.cache.pop(key)
                evicted_bytes += item.size_bytes
                evicted_count += 1
                self.analytics.size_evictions += 1

                # Remove from tier
                if self.config.enable_tiering:
                    self.tier_cache[item.tier].discard(key)

        logger.debug("LRU eviction completed",
                    evicted_count=evicted_count,
                    evicted_bytes=evicted_bytes)

    async def _evict_lfu(self, required_bytes: int) -> None:
        """Evict using Least Frequently Used strategy"""
        # Sort keys by access frequency
        sorted_keys = sorted(self.access_frequency.items(), key=lambda x: x[1])

        evicted_bytes = 0
        evicted_count = 0

        for key, frequency in sorted_keys:
            if evicted_bytes >= required_bytes:
                break

            if key in self.cache:
                item = self.cache.pop(key)
                evicted_bytes += item.size_bytes
                evicted_count += 1
                self.analytics.size_evictions += 1

                # Remove from tracking
                del self.access_frequency[key]
                if key in self.access_order:
                    self.access_order.remove(key)

                # Remove from tier
                if self.config.enable_tiering:
                    self.tier_cache[item.tier].discard(key)

        logger.debug("LFU eviction completed",
                    evicted_count=evicted_count,
                    evicted_bytes=evicted_bytes)

    async def _evict_fifo(self, required_bytes: int) -> None:
        """Evict using First In First Out strategy"""
        evicted_bytes = 0
        evicted_count = 0

        while (evicted_bytes < required_bytes and
               len(self.cache) > self.config.max_size * 0.7):

            if not self.access_order:
                break

            key = self.access_order.popleft()
            if key in self.cache:
                item = self.cache.pop(key)
                evicted_bytes += item.size_bytes
                evicted_count += 1
                self.analytics.size_evictions += 1

                # Remove from tier
                if self.config.enable_tiering:
                    self.tier_cache[item.tier].discard(key)

        logger.debug("FIFO eviction completed",
                    evicted_count=evicted_count,
                    evicted_bytes=evicted_bytes)

    async def _evict_adaptive(self, required_bytes: int) -> None:
        """Evict using adaptive strategy"""
        # Calculate eviction scores
        item_scores = []
        for key, item in self.cache.items():
            score = self._calculate_eviction_score(item)
            item_scores.append((key, score, item))

        # Sort by score (lower score = better eviction candidate)
        item_scores.sort(key=lambda x: x[1])

        evicted_bytes = 0
        evicted_count = 0

        for key, score, item in item_scores:
            if evicted_bytes >= required_bytes:
                break

            self.cache.pop(key)
            evicted_bytes += item.size_bytes
            evicted_count += 1
            self.analytics.size_evictions += 1

            # Remove from tracking
            if key in self.access_frequency:
                del self.access_frequency[key]
            if key in self.access_order:
                self.access_order.remove(key)

            # Remove from tier
            if self.config.enable_tiering:
                self.tier_cache[item.tier].discard(key)

        logger.debug("Adaptive eviction completed",
                    evicted_count=evicted_count,
                    evicted_bytes=evicted_bytes)

    def _calculate_eviction_score(self, item: CacheItem) -> float:
        """Calculate eviction score for an item"""
        # Factors to consider:
        # 1. Access frequency (higher frequency = lower score)
        # 2. Recency (more recent = lower score)
        # 3. Size (larger = higher score)
        # 4. Cost to fetch (higher cost = lower score)
        # 5. TTL (closer to expiry = higher score)

        frequency_score = 1.0 / (item.access_count + 1)
        recency_score = 1.0 / ((datetime.utcnow() - item.last_accessed).total_seconds() + 1)
        size_score = item.size_bytes / (1024 * 1024)  # Normalize to MB
        cost_score = 1.0 / (item.cost_to_fetch + 1)

        # Calculate age factor
        age = (datetime.utcnow() - item.created_at).total_seconds()
        ttl_factor = age / self.config.default_ttl

        # Weighted score
        score = (
            frequency_score * 0.3 +
            recency_score * 0.2 +
            size_score * 0.2 +
            cost_score * 0.2 +
            ttl_factor * 0.1
        )

        return score

    def _calculate_adaptive_ttl(self, key: str, cost_to_fetch: float) -> float:
        """Calculate adaptive TTL based on usage patterns"""
        if not self.config.enable_adaptive_ttl:
            return self.config.default_ttl

        # Base TTL
        ttl = self.config.default_ttl

        # Adjust based on cost to fetch
        if cost_to_fetch > 0:
            ttl *= min(cost_to_fetch, 10.0)  # Cap at 10x multiplier

        # Adjust based on access patterns
        if key in self.access_frequency:
            access_freq = self.access_frequency[key]
            if access_freq > 10:  # Frequently accessed
                ttl *= self.config.adaptive_ttl_multiplier

        return ttl

    def _assign_tier(self, item: CacheItem) -> None:
        """Assign cache tier to an item"""
        # Remove from current tier
        if item.tier in self.tier_cache:
            self.tier_cache[item.tier].discard(item.key)

        # Calculate access score
        total_accesses = sum(self.access_frequency.values())
        if total_accesses == 0:
            access_score = 0
        else:
            access_score = item.access_count / total_accesses

        # Assign tier based on access score
        if access_score >= self.config.hot_item_threshold:
            item.tier = CacheTier.HOT
        elif access_score >= self.config.warm_item_threshold:
            item.tier = CacheTier.WARM
        elif access_score > 0:
            item.tier = CacheTier.COLD
        else:
            item.tier = CacheTier.FROZEN

        # Add to new tier
        self.tier_cache[item.tier].add(item.key)

        # Update analytics
        self.analytics.tier_distribution[item.tier] += 1

    def _update_access_metrics(self, key: str, item: CacheItem) -> None:
        """Update access metrics for an item"""
        item.last_accessed = datetime.utcnow()
        item.access_count += 1

        # Update frequency
        self.access_frequency[key] += 1

        # Move to end of access order
        if key in self.access_order:
            self.access_order.remove(key)
        self.access_order.append(key)

        # Update tier if needed
        if self.config.enable_tiering:
            self._assign_tier(item)

    def _is_item_valid(self, item: CacheItem) -> bool:
        """Check if cache item is still valid"""
        age = (datetime.utcnow() - item.created_at).total_seconds()
        return age <= self.config.default_ttl

    async def _remove_item(self, key: str) -> None:
        """Remove item from cache"""
        if key in self.cache:
            item = self.cache.pop(key)
            if key in self.access_frequency:
                del self.access_frequency[key]
            if key in self.access_order:
                self.access_order.remove(key)

            # Remove from tier
            if self.config.enable_tiering:
                self.tier_cache[item.tier].discard(key)

    async def _record_access(self, key: str, hit: bool, access_time: float) -> None:
        """Record cache access for analytics"""
        self.access_history.append({
            "key": key,
            "hit": hit,
            "access_time": access_time,
            "timestamp": datetime.utcnow()
        })

        # Update average access time
        if hit:
            total_hits = self.analytics.hits
            self.analytics.average_access_time = (
                (self.analytics.average_access_time * total_hits + access_time) /
                (total_hits + 1)
            )

        # Update hit/miss rates
        total_requests = self.analytics.total_requests
        self.analytics.average_hit_rate = self.analytics.hits / total_requests
        self.analytics.average_miss_rate = self.analytics.misses / total_requests

    async def _trigger_prefetch(self, key: str) -> None:
        """Trigger prefetching based on access patterns"""
        if not self.config.enable_prefetching:
            return

        # Analyze access patterns
        predicted_keys = self._predict_next_accesses(key)

        for predicted_key in predicted_keys:
            if predicted_key not in self.cache and predicted_key not in self.prefetch_cache:
                await self.prefetch_queue.put(predicted_key)

    def _predict_next_accesses(self, current_key: str) -> List[str]:
        """Predict next keys to be accessed"""
        if self.config.prefetch_strategy == PrefetchStrategy.ALWAYS:
            # Simple: prefetch related keys
            return self._get_related_keys(current_key)
        elif self.config.prefetch_strategy == PrefetchStrategy.ADAPTIVE:
            # Use pattern analysis
            return self._analyze_patterns(current_key)
        elif self.config.prefetch_strategy == PrefetchStrategy.PREDICTIVE:
            # Use ML model if available
            if self.prediction_model:
                return self.prediction_model(current_key)
            else:
                return self._analyze_patterns(current_key)

        return []

    def _get_related_keys(self, key: str) -> List[str]:
        """Get related keys for prefetching"""
        # Simple implementation: get keys with similar prefixes
        key_parts = key.split(':')
        if len(key_parts) > 1:
            base_key = ':'.join(key_parts[:-1])
            related_keys = [f"{base_key}:{i}" for i in range(5)]
            return related_keys
        return []

    def _analyze_patterns(self, current_key: str) -> List[str]:
        """Analyze access patterns to predict next accesses"""
        # Find sequences that include current_key
        sequences = []
        for sequence in self.pattern_history:
            if current_key in sequence:
                idx = sequence.index(current_key)
                if idx < len(sequence) - 1:
                    sequences.append(sequence[idx + 1:])

        # Find most common next keys
        next_keys = []
        for seq in sequences:
            if seq:
                next_keys.append(seq[0])

        # Return most common predictions
        if next_keys:
            return list(set(next_keys))[:3]  # Top 3 predictions

        return []

    async def _prefetch_loop(self) -> None:
        """Background prefetching loop"""
        while self._running:
            try:
                # Get next key to prefetch
                key = await asyncio.wait_for(self.prefetch_queue.get(), timeout=1.0)

                try:
                    # Fetch and cache
                    value = await self.fetch_function(key)
                    self.prefetch_cache[key] = value

                    # Limit prefetch cache size
                    if len(self.prefetch_cache) > 100:
                        oldest_key = next(iter(self.prefetch_cache))
                        del self.prefetch_cache[oldest_key]

                except Exception as e:
                    logger.debug("Prefetch failed", key=key, error=str(e))
                    self.analytics.prefetch_misses += 1

            except asyncio.TimeoutError:
                # No items to prefetch
                pass
            except Exception as e:
                logger.error("Error in prefetch loop", error=str(e))
                await asyncio.sleep(10)

    async def _analytics_loop(self) -> None:
        """Background analytics processing loop"""
        while self._running:
            try:
                await self._process_analytics()
                await asyncio.sleep(60)  # Process every minute
            except Exception as e:
                logger.error("Error in analytics loop", error=str(e))
                await asyncio.sleep(120)

    async def _process_analytics(self) -> None:
        """Process cache analytics"""
        # Calculate efficiency
        if self.analytics.total_fetch_cost > 0:
            self.analytics.cache_efficiency = (
                self.analytics.saved_fetch_cost / self.analytics.total_fetch_cost
            )

        # Update average item lifetime
        if self.cache:
            lifetimes = [
                (datetime.utcnow() - item.created_at).total_seconds()
                for item in self.cache.values()
            ]
            self.analytics.average_item_lifetime = statistics.mean(lifetimes)

        # Analyze patterns
        await self._analyze_access_patterns()

        # Clean old analytics data
        self._cleanup_old_analytics()

    async def _analyze_access_patterns(self) -> None:
        """Analyze access patterns for better caching decisions"""
        # Extract recent access sequences
        recent_accesses = [
            access for access in self.access_history
            if (datetime.utcnow() - access["timestamp"]).total_seconds() < self.config.pattern_window_minutes * 60
        ]

        if len(recent_accesses) < 2:
            return

        # Create sequences
        sequence = [access["key"] for access in recent_accesses]
        self.pattern_history.append(sequence)

        # Keep only recent patterns
        if len(self.pattern_history) > 100:
            self.pattern_history.popleft()

    def _cleanup_old_analytics(self) -> None:
        """Clean old analytics data"""
        cutoff_time = datetime.utcnow() - timedelta(hours=self.config.analytics_retention_hours)

        # Clean access history
        self.access_history = deque(
            [access for access in self.access_history
             if access["timestamp"] > cutoff_time],
            maxlen=self.access_history.maxlen
        )

    async def _cleanup_loop(self) -> None:
        """Background cleanup loop"""
        while self._running:
            try:
                await self._cleanup_expired_items()
                await asyncio.sleep(300)  # Clean every 5 minutes
            except Exception as e:
                logger.error("Error in cleanup loop", error=str(e))
                await asyncio.sleep(600)

    async def _cleanup_expired_items(self) -> None:
        """Clean expired items from cache"""
        current_time = datetime.utcnow()
        expired_keys = []

        for key, item in self.cache.items():
            age = (current_time - item.created_at).total_seconds()
            if age > self.config.default_ttl:
                expired_keys.append(key)

        for key in expired_keys:
            await self._remove_item(key)
            self.analytics.ttl_evictions += 1

    async def _adaptive_loop(self) -> None:
        """Background adaptive optimization loop"""
        while self._running:
            try:
                await self._optimize_cache_parameters()
                await asyncio.sleep(300)  # Optimize every 5 minutes
            except Exception as e:
                logger.error("Error in adaptive loop", error=str(e))
                await asyncio.sleep(600)

    async def _optimize_cache_parameters(self) -> None:
        """Optimize cache parameters based on performance"""
        # Analyze hit rate
        hit_rate = self.analytics.average_hit_rate

        # Adjust TTL based on hit rate
        if hit_rate < 0.5:  # Low hit rate
            # Reduce TTL to free up space
            self.config.default_ttl *= 0.9
        elif hit_rate > 0.8:  # High hit rate
            # Increase TTL to keep items longer
            self.config.default_ttl *= 1.1

        # Cap TTL
        self.config.default_ttl = max(300, min(self.config.default_ttl, 86400))  # 5 min to 24 hours

    def _calculate_size(self, value: Any) -> int:
        """Calculate size of cached value in bytes"""
        try:
            return len(str(value).encode('utf-8'))
        except Exception:
            return 1024  # Default size

    def _compress_value(self, value: Any) -> Any:
        """Compress value for storage"""
        # Simple compression - in production, use proper compression libraries
        try:
            import zlib
            compressed = zlib.compress(str(value).encode('utf-8'))
            return compressed.decode('latin-1')
        except ImportError:
            return value

    def get_cache_stats(self) -> Dict[str, Any]:
        """Get detailed cache statistics"""
        total_size = sum(item.size_bytes for item in self.cache.values())
        total_items = len(self.cache)

        return {
            "total_items": total_items,
            "total_size_bytes": total_size,
            "total_size_mb": total_size / (1024 * 1024),
            "hit_rate": self.analytics.average_hit_rate,
            "miss_rate": self.analytics.average_miss_rate,
            "average_access_time": self.analytics.average_access_time,
            "cache_efficiency": self.analytics.cache_efficiency,
            "tier_distribution": {
                tier.name: len(keys) for tier, keys in self.tier_cache.items()
            },
            "strategy": self.config.strategy.value,
            "prefetch_hits": self.analytics.prefetch_hits,
            "prefetch_misses": self.analytics.prefetch_misses,
            "evictions": {
                "forced": self.analytics.forced_evictions,
                "size": self.analytics.size_evictions,
                "ttl": self.analytics.ttl_evictions
            }
        }

    def get_optimization_recommendations(self) -> List[Dict[str, Any]]:
        """Get optimization recommendations for the cache"""
        recommendations = []
        stats = self.get_cache_stats()

        # Check hit rate
        if stats["hit_rate"] < 0.5:
            recommendations.append({
                "strategy": OptimizationStrategy.SMART_CACHING,
                "title": "Low cache hit rate",
                "description": f"Cache hit rate is {stats['hit_rate']:.1%}. Consider adjusting TTL or cache size.",
                "current_value": stats["hit_rate"],
                "target_value": 0.8,
                "priority": "high"
            })

        # Check memory usage
        if stats["total_size_mb"] > self.config.max_memory_bytes / (1024 * 1024) * 0.9:
            recommendations.append({
                "strategy": OptimizationStrategy.SMART_CACHING,
                "title": "High memory usage",
                "description": f"Cache is using {stats['total_size_mb']:.1f}MB of memory. Consider increasing max_memory_bytes.",
                "current_value": stats["total_size_mb"],
                "target_value": self.config.max_memory_bytes / (1024 * 1024) * 0.7,
                "priority": "medium"
            })

        # Check prefetching effectiveness
        prefetch_total = stats["prefetch_hits"] + stats["prefetch_misses"]
        if prefetch_total > 0:
            prefetch_accuracy = stats["prefetch_hits"] / prefetch_total
            if prefetch_accuracy < self.config.prefetch_accuracy_threshold:
                recommendations.append({
                    "strategy": OptimizationStrategy.SMART_CACHING,
                    "title": "Low prefetch accuracy",
                    "description": f"Prefetch accuracy is {prefetch_accuracy:.1%}. Consider adjusting prefetch strategy.",
                    "current_value": prefetch_accuracy,
                    "target_value": self.config.prefetch_accuracy_threshold,
                    "priority": "medium"
                })

        return recommendations

    async def clear(self) -> None:
        """Clear all cached items"""
        async with self._lock:
            self.cache.clear()
            self.access_order.clear()
            self.access_frequency.clear()
            self.prefetch_cache.clear()

            # Clear tier caches
            for tier_keys in self.tier_cache.values():
                tier_keys.clear()

    async def close(self) -> None:
        """Close the smart cache manager"""
        self._running = False

        # Cancel background tasks
        if self._analytics_task:
            self._analytics_task.cancel()
        if self._prefetch_task:
            self._prefetch_task.cancel()
        if self._cleanup_task:
            self._cleanup_task.cancel()
        if self._adaptive_task:
            self._adaptive_task.cancel()

        # Clear cache
        await self.clear()

        logger.info("Smart cache manager closed")