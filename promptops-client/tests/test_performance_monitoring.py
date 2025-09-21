"""
Comprehensive tests for performance monitoring components
"""

import pytest
import asyncio
import time
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, AsyncMock
from typing import Dict, Any

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from promptops.performance import (
    PerformanceMonitor,
    PerformanceConfig,
    PerformanceMetric,
    RequestMetrics,
    CacheMetrics,
    MemoryMetrics,
    NetworkMetrics,
    PerformanceAlert,
    OptimizationRecommendation,
    MetricType,
    AlertSeverity,
    OptimizationStrategy
)
from promptops.performance.adaptive_retry import (
    AdaptiveRetryManager,
    AdaptiveRetryConfig,
    RetryStrategy,
    RetryDecision,
    RetryOutcome
)
from promptops.performance.smart_cache import (
    SmartCacheManager,
    SmartCacheConfig,
    CacheStrategy,
    CacheTier
)
from promptops.performance.connection_pool import (
    ConnectionPool,
    PoolConfig,
    PoolStrategy,
    PoolMetrics
)
from promptops.performance.opentelemetry import OpenTelemetryIntegration


class TestPerformanceMonitor:
    """Test cases for PerformanceMonitor"""

    @pytest.fixture
    def monitor_config(self):
        """Create test performance monitor configuration"""
        return PerformanceConfig(
            enabled=True,
            sample_rate=1.0,
            max_metrics_retention_hours=24,
            metrics_buffer_size=1000,
            time_series_max_points=100,
            enable_real_time_monitoring=True,
            enable_alerting=True,
            enable_optimization_recommendations=True
        )

    @pytest.fixture
    def performance_monitor(self, monitor_config):
        """Create performance monitor instance"""
        return PerformanceMonitor(monitor_config)

    def test_monitor_initialization(self, performance_monitor):
        """Test performance monitor initialization"""
        assert performance_monitor.config.enabled is True
        assert performance_monitor._enabled is True
        assert performance_monitor._running is True  # Auto-starts when enabled
        assert len(performance_monitor._alerts) > 0  # Default alerts

    def test_start_stop_monitor(self, performance_monitor):
        """Test starting and stopping the monitor"""
        # Start monitor
        performance_monitor.start()
        assert performance_monitor._running is True

        # Stop monitor
        performance_monitor.stop()
        assert performance_monitor._running is False

    def test_track_request_start(self, performance_monitor):
        """Test tracking request start"""
        request_id = performance_monitor.track_request_start("/api/test", "GET")
        assert request_id != ""
        assert request_id in performance_monitor._current_requests

        request_info = performance_monitor._current_requests[request_id]
        assert request_info.endpoint == "/api/test"
        assert request_info.method == "GET"
        assert request_info.cache_hit is False

    def test_track_request_end(self, performance_monitor):
        """Test tracking request end"""
        # Start request
        request_id = performance_monitor.track_request_start("/api/test", "GET")
        assert request_id in performance_monitor._current_requests

        # End request
        performance_monitor.track_request_end(
            request_id=request_id,
            status_code=200,
            cache_hit=True,
            retry_count=0,
            bytes_sent=100,
            bytes_received=1000
        )

        # Verify request was moved to completed
        assert request_id not in performance_monitor._current_requests
        assert len(performance_monitor._completed_requests) > 0

        completed_request = performance_monitor._completed_requests[-1]
        assert completed_request.status_code == 200
        assert completed_request.cache_hit is True
        assert completed_request.duration is not None

    def test_track_cache_operations(self, performance_monitor):
        """Test tracking cache operations"""
        # Track cache hit
        performance_monitor.track_cache_operation(True, 0.001)
        assert performance_monitor.cache_metrics.hits == 1
        assert performance_monitor.cache_metrics.hit_rate == 1.0

        # Track cache miss
        performance_monitor.track_cache_operation(False, 0.1)
        assert performance_monitor.cache_metrics.misses == 1
        assert performance_monitor.cache_metrics.hit_rate == 0.5

    def test_alert_triggering(self, performance_monitor):
        """Test alert triggering mechanism"""
        # Create test alert
        alert = PerformanceAlert(
            id="test_alert",
            metric_type=MetricType.REQUEST_LATENCY,
            condition="> 1.0",
            threshold=1.0,
            severity=AlertSeverity.WARNING,
            message="Test alert",
            enabled=True,
            cooldown_period=0
        )

        performance_monitor.add_custom_alert(alert)

        # Trigger alert
        alert_triggered = []

        def alert_callback(alert_obj):
            alert_triggered.append(alert_obj)

        performance_monitor.add_alert_callback(alert_callback)

        # Add some cache hits to avoid cache hit rate alert
        performance_monitor.cache_metrics.update_hit(0.1)
        performance_monitor.cache_metrics.update_hit(0.1)

        # Simulate high latency by tracking a slow request
        request_id = performance_monitor.track_request_start("/api/slow", "GET")
        # Simulate a slow response
        import time
        time.sleep(0.01)  # Small delay to ensure duration is calculated
        performance_monitor.track_request_end(request_id, status_code=200)

        # Verify alert was triggered
        assert len(alert_triggered) > 0
        assert alert_triggered[0].severity in [AlertSeverity.WARNING, AlertSeverity.CRITICAL]

    def test_performance_snapshot(self, performance_monitor):
        """Test getting performance snapshot"""
        # Add some test data
        performance_monitor.track_request_start("/api/test", "GET")
        performance_monitor.track_request_end(
            request_id=next(iter(performance_monitor._current_requests.keys())),
            status_code=200
        )

        snapshot = performance_monitor.get_performance_snapshot()

        assert isinstance(snapshot.timestamp, datetime)
        assert isinstance(snapshot.request_metrics, dict)
        assert isinstance(snapshot.cache_metrics, CacheMetrics)
        assert isinstance(snapshot.memory_metrics, MemoryMetrics)
        assert isinstance(snapshot.network_metrics, NetworkMetrics)

    def test_time_series_data(self, performance_monitor):
        """Test time series data collection"""
        # Add data points
        performance_monitor._add_time_series_point(MetricType.REQUEST_LATENCY, 1.0)
        performance_monitor._add_time_series_point(MetricType.REQUEST_LATENCY, 2.0)

        # Get time series data
        data = performance_monitor.get_time_series_data(MetricType.REQUEST_LATENCY)

        assert len(data) == 2
        assert data[0]["value"] == 1.0
        assert data[1]["value"] == 2.0

    def test_statistics_calculation(self, performance_monitor):
        """Test statistics calculation"""
        # Add test data
        for i in range(10):
            performance_monitor._add_time_series_point(MetricType.REQUEST_LATENCY, i + 1)

        stats = performance_monitor.get_statistics(MetricType.REQUEST_LATENCY)

        assert stats["count"] == 10
        assert stats["min"] == 1.0
        assert stats["max"] == 10.0
        assert stats["mean"] == 5.5

    def test_optimization_recommendations(self, performance_monitor):
        """Test optimization recommendations generation"""
        # Simulate low cache hit rate
        performance_monitor.cache_metrics.hits = 1
        performance_monitor.cache_metrics.misses = 9

        # Generate recommendations
        performance_monitor._generate_recommendations()

        # Check if recommendations were generated
        assert len(performance_monitor._recommendations) > 0

        # Verify recommendation structure
        rec = performance_monitor._recommendations[0]
        assert rec.strategy == OptimizationStrategy.SMART_CACHING
        assert rec.title is not None
        assert rec.description is not None
        assert rec.impact in ["low", "medium", "high"]
        assert rec.effort in ["low", "medium", "high"]
        assert 0.0 <= rec.confidence <= 1.0

    def test_summary_generation(self, performance_monitor):
        """Test performance summary generation"""
        summary = performance_monitor.get_summary()

        assert "enabled" in summary
        assert "running" in summary
        assert "cache_hit_rate" in summary
        assert "memory_usage_mb" in summary
        assert isinstance(summary["timestamp"], str)  # Returns ISO format string


class TestAdaptiveRetryManager:
    """Test cases for AdaptiveRetryManager"""

    @pytest.fixture
    def retry_config(self):
        """Create test retry configuration"""
        return AdaptiveRetryConfig(
            max_attempts=3,
            base_delay=0.1,  # Short delay for testing
            max_delay=1.0,
            strategy=RetryStrategy.EXPONENTIAL_BACKOFF,
            enable_circuit_breaker=True,
            circuit_breaker_threshold=3,
            enable_rate_limit_detection=True
        )

    @pytest.fixture
    def retry_manager(self, retry_config):
        """Create retry manager instance"""
        return AdaptiveRetryManager(retry_config)

    @pytest.mark.asyncio
    async def test_successful_retry(self, retry_manager):
        """Test successful retry execution"""
        async def successful_operation():
            return "success"

        result = await retry_manager.execute_with_retry(
            successful_operation,
            "test_operation"
        )

        assert result.success is True
        assert result.attempts == 1
        assert result.last_error is None

    @pytest.mark.asyncio
    async def test_retry_with_failure(self, retry_manager):
        """Test retry with eventual success"""
        call_count = 0

        async def failing_then_successful():
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise Exception("Temporary failure")
            return "eventual_success"

        result = await retry_manager.execute_with_retry(
            failing_then_successful,
            "test_operation"
        )

        assert result.success is True
        assert result.attempts == 3
        assert result.last_error is None

    @pytest.mark.asyncio
    async def test_max_attempts_exceeded(self, retry_manager):
        """Test when max attempts are exceeded"""
        async def always_failing():
            raise Exception("Always fails")

        result = await retry_manager.execute_with_retry(
            always_failing,
            "test_operation"
        )

        assert result.success is False
        assert result.attempts == 3
        assert result.last_error is not None

    @pytest.mark.asyncio
    async def test_circuit_breaker(self, retry_manager):
        """Test circuit breaker functionality"""
        # Trigger circuit breaker
        for _ in range(5):  # Exceed threshold
            await retry_manager.execute_with_retry(
                lambda: (_ for _ in ()).throw(Exception("Failure")),
                "test_operation"
            )

        # Circuit breaker should be open
        result = await retry_manager.execute_with_retry(
            lambda: "success",
            "test_operation"
        )

        assert result.success is False
        assert "Circuit breaker" in str(result.last_error)

    @pytest.mark.asyncio
    async def test_rate_limit_detection(self, retry_manager):
        """Test rate limit detection"""
        # Simulate rate limit errors
        async def rate_limited_operation():
            raise Exception("Rate limit exceeded")

        # Trigger rate limit detection
        for _ in range(3):
            try:
                await retry_manager.execute_with_retry(
                    rate_limited_operation,
                    "test_operation"
                )
            except:
                pass

        # Check if rate limit was detected
        assert retry_manager._is_rate_limited("test_operation")

    def test_performance_summary(self, retry_manager):
        """Test performance summary generation"""
        # Add some test data
        retry_manager.request_history = [
            {"operation": "test", "success": True, "execution_time": 0.1},
            {"operation": "test", "success": False, "execution_time": 0.2}
        ]

        summary = retry_manager.get_performance_summary("test")

        assert "total_requests" in summary
        assert "success_rate" in summary
        assert summary["total_requests"] == 2

    def test_optimization_recommendations(self, retry_manager):
        """Test optimization recommendations"""
        # Simulate low success rate
        retry_manager.request_history = [
            {"operation": "test", "success": False} for _ in range(10)
        ]

        recommendations = retry_manager.get_optimization_recommendations()

        assert len(recommendations) > 0
        assert any("Low success rate" in rec["title"] for rec in recommendations)


class TestSmartCacheManager:
    """Test cases for SmartCacheManager"""

    @pytest.fixture
    def cache_config(self):
        """Create test cache configuration"""
        return SmartCacheConfig(
            max_size=100,
            max_memory_bytes=1024 * 1024,  # 1MB
            default_ttl=3600,
            strategy=CacheStrategy.ADAPTIVE,
            enable_tiering=True,
            enable_prefetching=False,  # Disable for testing
            enable_compression=False
        )

    @pytest.fixture
    def cache_manager(self, cache_config):
        """Create cache manager instance"""
        async def mock_fetch(key: str):
            await asyncio.sleep(0.01)  # Simulate fetch time
            return f"value_for_{key}"

        return SmartCacheManager(cache_config, mock_fetch)

    @pytest.mark.asyncio
    async def test_cache_initialization(self, cache_manager):
        """Test cache manager initialization"""
        await cache_manager.initialize()
        assert cache_manager._running is True
        assert len(cache_manager.cache) == 0

    @pytest.mark.asyncio
    async def test_cache_get_set(self, cache_manager):
        """Test basic cache get/set operations"""
        await cache_manager.initialize()

        # Set value
        await cache_manager.set("test_key", "test_value")

        # Get value
        value = await cache_manager.get("test_key")
        assert value == "test_value"

        # Get non-existent value
        value = await cache_manager.get("non_existent")
        assert value is None

    @pytest.mark.asyncio
    async def test_cache_eviction(self, cache_manager):
        """Test cache eviction when full"""
        # Configure small cache for testing
        cache_manager.config.max_size = 3

        await cache_manager.initialize()

        # Fill cache
        await cache_manager.set("key1", "value1")
        await cache_manager.set("key2", "value2")
        await cache_manager.set("key3", "value3")

        # Add one more item to trigger eviction
        await cache_manager.set("key4", "value4")

        # Check that cache size is maintained
        assert len(cache_manager.cache) <= 3

    @pytest.mark.asyncio
    async def test_cache_tier_assignment(self, cache_manager):
        """Test cache tier assignment"""
        await cache_manager.initialize()

        # Set value and access multiple times
        await cache_manager.set("hot_key", "hot_value")
        for _ in range(10):
            await cache_manager.get("hot_key")

        # Check tier assignment
        hot_item = cache_manager.cache["hot_key"]
        assert hot_item.tier in [CacheTier.HOT, CacheTier.WARM]

    @pytest.mark.asyncio
    async def test_cache_statistics(self, cache_manager):
        """Test cache statistics"""
        await cache_manager.initialize()

        # Perform some operations
        await cache_manager.set("key1", "value1")
        await cache_manager.get("key1")  # Hit
        await cache_manager.get("key2")  # Miss

        stats = cache_manager.get_cache_stats()

        assert stats["total_items"] >= 1
        assert stats["hits"] == 1
        assert stats["misses"] == 1
        assert stats["hit_rate"] == 0.5

    @pytest.mark.asyncio
    async def test_cache_cleanup(self, cache_manager):
        """Test cache cleanup functionality"""
        # Set short TTL for testing
        cache_manager.config.default_ttl = 0.1  # 100ms

        await cache_manager.initialize()

        # Set value
        await cache_manager.set("test_key", "test_value")

        # Wait for expiration
        await asyncio.sleep(0.2)

        # Try to get expired value
        value = await cache_manager.get("test_key")
        assert value is None  # Should be expired and removed

    @pytest.mark.asyncio
    async def test_optimization_recommendations(self, cache_manager):
        """Test cache optimization recommendations"""
        await cache_manager.initialize()

        # Simulate low hit rate
        cache_manager.analytics.misses = 10
        cache_manager.analytics.hits = 2

        recommendations = cache_manager.get_optimization_recommendations()

        assert len(recommendations) > 0
        assert any("Low cache hit rate" in rec["title"] for rec in recommendations)

    @pytest.mark.asyncio
    async def test_cache_clear(self, cache_manager):
        """Test cache clearing"""
        await cache_manager.initialize()

        # Add some items
        await cache_manager.set("key1", "value1")
        await cache_manager.set("key2", "value2")

        # Clear cache
        await cache_manager.clear()

        assert len(cache_manager.cache) == 0
        assert len(cache_manager.access_order) == 0


class TestConnectionPool:
    """Test cases for ConnectionPool"""

    @pytest.fixture
    def pool_config(self):
        """Create test pool configuration"""
        return PoolConfig(
            min_size=2,
            max_size=5,
            max_idle_time=300,
            strategy=PoolStrategy.FIXED,
            enable_health_checks=False  # Disable for testing
        )

    @pytest.fixture
    def connection_pool(self, pool_config):
        """Create connection pool instance"""
        async def create_connection():
            await asyncio.sleep(0.01)  # Simulate creation time
            return f"connection_{time.time()}"

        return ConnectionPool(pool_config, create_connection)

    @pytest.mark.asyncio
    async def test_pool_initialization(self, connection_pool):
        """Test connection pool initialization"""
        await connection_pool.initialize()
        assert connection_pool._running is True
        assert len(connection_pool.connections) >= connection_pool.config.min_size

    @pytest.mark.asyncio
    async def test_connection_acquisition(self, connection_pool):
        """Test connection acquisition"""
        await connection_pool.initialize()

        # Acquire connection
        connection = await connection_pool.acquire()
        assert connection is not None
        assert len(connection_pool.active_connections) == 1

        # Release connection
        await connection_pool.release(connection)
        assert len(connection_pool.active_connections) == 0
        assert len(connection_pool.idle_connections) == 1

    @pytest.mark.asyncio
    async def test_pool_exhaustion(self, connection_pool):
        """Test behavior when pool is exhausted"""
        await connection_pool.initialize()

        # Acquire all connections
        connections = []
        for _ in range(connection_pool.config.max_size):
            conn = await connection_pool.acquire()
            connections.append(conn)

        # Try to acquire one more (should fail)
        with pytest.raises(Exception):
            await asyncio.wait_for(
                connection_pool.acquire(),
                timeout=0.1
            )

        # Release connections
        for conn in connections:
            await connection_pool.release(conn)

    @pytest.mark.asyncio
    async def test_connection_cleanup(self, connection_pool):
        """Test connection cleanup"""
        # Set short max age for testing
        connection_pool.config.max_connection_age = 0.1  # 100ms

        await connection_pool.initialize()

        # Get initial connection count
        initial_count = len(connection_pool.connections)

        # Wait for connections to age
        await asyncio.sleep(0.2)

        # Trigger cleanup
        await connection_pool._prune_connections()

        # Check that old connections were removed
        assert len(connection_pool.connections) < initial_count

    def test_pool_metrics(self, connection_pool):
        """Test pool metrics"""
        metrics = connection_pool.get_metrics()

        assert isinstance(metrics.total_connections, int)
        assert isinstance(metrics.active_connections, int)
        assert isinstance(metrics.idle_connections, int)
        assert isinstance(metrics.pool_utilization, float)

    def test_optimization_recommendations(self, connection_pool):
        """Test pool optimization recommendations"""
        # Simulate high utilization
        connection_pool.metrics.active_connections = 4
        connection_pool.metrics.total_connections = 5

        recommendations = connection_pool.get_optimization_recommendations()

        assert len(recommendations) > 0
        assert any("High pool utilization" in rec["title"] for rec in recommendations)


class TestOpenTelemetryIntegration:
    """Test cases for OpenTelemetry integration"""

    @pytest.fixture
    def otel_integration(self):
        """Create OpenTelemetry integration instance"""
        return OpenTelemetryIntegration(
            service_name="test-service",
            enable_metrics=True,
            enable_traces=False  # Disable for testing
        )

    def test_otel_initialization(self, otel_integration):
        """Test OpenTelemetry integration initialization"""
        assert otel_integration.service_name == "test-service"
        assert otel_integration.enable_metrics is True
        assert otel_integration.enable_traces is False

    def test_metric_recording(self, otel_integration):
        """Test metric recording"""
        if otel_integration.is_available():
            # This would normally send metrics to OpenTelemetry
            # For testing, we just verify the method doesn't crash
            otel_integration.record_metric(
                MetricType.REQUEST_LATENCY,
                1.5,
                {"endpoint": "/test"}
            )

            # Verify method was called (no exceptions)
            assert True
        else:
            # Skip tests if OpenTelemetry not available
            pytest.skip("OpenTelemetry not available")

    def test_otel_status(self, otel_integration):
        """Test OpenTelemetry status"""
        status = otel_integration.get_status()

        assert "available" in status
        assert "service_name" in status
        assert "metrics_enabled" in status


class TestPerformanceIntegration:
    """Integration tests for performance monitoring components"""

    @pytest.mark.asyncio
    async def test_full_monitoring_workflow(self):
        """Test complete monitoring workflow"""
        # Create performance monitor
        config = PerformanceConfig(enabled=True)
        monitor = PerformanceMonitor(config)

        # Create retry manager
        retry_config = AdaptiveRetryConfig(max_attempts=2, base_delay=0.01)
        retry_manager = AdaptiveRetryManager(retry_config)

        # Create cache manager
        cache_config = SmartCacheConfig(max_size=10, enable_prefetching=False)
        cache_manager = SmartCacheManager(cache_config, lambda x: f"value_{x}")

        # Initialize components
        monitor.start()
        await cache_manager.initialize()

        try:
            # Simulate workflow
            # 1. Track request
            request_id = monitor.track_request_start("/api/test", "GET")

            # 2. Use cache
            cache_value = await cache_manager.get("test_key")
            if cache_value is None:
                cache_value = "fetched_value"
                await cache_manager.set("test_key", cache_value)

            # 3. Use retry for operation
            async def test_operation():
                await asyncio.sleep(0.01)
                return "success"

            result = await retry_manager.execute_with_retry(test_operation, "test")

            # 4. Complete request
            monitor.track_request_end(
                request_id=request_id,
                status_code=200,
                cache_hit=(cache_value == "fetched_value")
            )

            # Verify results
            assert result.success is True
            assert await cache_manager.get("test_key") == "fetched_value"

            # Check monitor state
            summary = monitor.get_summary()
            assert summary["completed_requests"] >= 1

        finally:
            # Cleanup
            monitor.stop()
            await cache_manager.close()

    @pytest.mark.asyncio
    async def test_alerting_workflow(self):
        """Test alerting workflow"""
        config = PerformanceConfig(
            enabled=True,
            enable_alerting=True,
            alert_cooldown_seconds=0  # No cooldown for testing
        )
        monitor = PerformanceMonitor(config)

        alerts_received = []

        def alert_handler(alert):
            alerts_received.append(alert)

        monitor.add_alert_callback(alert_handler)
        monitor.start()

        try:
            # Simulate metric that should trigger alert
            monitor._add_time_series_point(MetricType.REQUEST_LATENCY, 10.0)  # High latency
            monitor._check_alerts()

            # Verify alert was received
            assert len(alerts_received) > 0
            assert any("latency" in alert.message.lower() for alert in alerts_received)

        finally:
            monitor.stop()

    @pytest.mark.asyncio
    async def test_optimization_workflow(self):
        """Test optimization recommendations workflow"""
        config = PerformanceConfig(
            enabled=True,
            enable_optimization_recommendations=True
        )
        monitor = PerformanceMonitor(config)

        recommendations_received = []

        def recommendation_handler(rec):
            recommendations_received.append(rec)

        monitor.add_recommendation_callback(recommendation_handler)
        monitor.start()

        try:
            # Simulate conditions that should generate recommendations
            # Low cache hit rate
            monitor.cache_metrics.hits = 1
            monitor.cache_metrics.misses = 9

            # Trigger recommendation generation
            monitor._generate_recommendations()

            # Verify recommendation was received
            assert len(recommendations_received) > 0
            assert any("cache" in rec.title.lower() for rec in recommendations_received)

        finally:
            monitor.stop()


# Performance benchmarks (optional - skip by default)
@pytest.mark.benchmark
class TestPerformanceBenchmarks:
    """Performance benchmarks for monitoring components"""

    @pytest.mark.asyncio
    async def test_monitor_overhead(self):
        """Test performance monitor overhead"""
        config = PerformanceConfig(
            enabled=True,
            sample_rate=1.0  # 100% sampling for benchmark
        )
        monitor = PerformanceMonitor(config)
        monitor.start()

        try:
            # Measure time for many operations
            start_time = time.time()

            for i in range(1000):
                request_id = monitor.track_request_start(f"/api/test/{i}", "GET")
                monitor.track_request_end(
                    request_id=request_id,
                    status_code=200,
                    cache_hit=i % 2 == 0
                )

            end_time = time.time()
            total_time = end_time - start_time

            # Verify reasonable performance (should be much less than 1 second)
            assert total_time < 1.0, f"Monitor overhead too high: {total_time:.3f}s for 1000 operations"

        finally:
            monitor.stop()

    @pytest.mark.asyncio
    async def test_cache_performance(self):
        """Test cache performance"""
        config = SmartCacheConfig(
            max_size=1000,
            enable_compression=False,
            enable_prefetching=False
        )

        cache_manager = SmartCacheManager(config, lambda x: f"value_{x}")
        await cache_manager.initialize()

        try:
            # Benchmark cache operations
            start_time = time.time()

            for i in range(1000):
                key = f"key_{i % 100}"  # Use 100 unique keys
                value = await cache_manager.get(key)
                if value is None:
                    await cache_manager.set(key, f"value_{key}")

            end_time = time.time()
            total_time = end_time - start_time
            ops_per_second = 1000 / total_time

            # Verify reasonable performance
            assert ops_per_second > 1000, f"Cache performance too low: {ops_per_second:.0f} ops/sec"

        finally:
            await cache_manager.close()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])