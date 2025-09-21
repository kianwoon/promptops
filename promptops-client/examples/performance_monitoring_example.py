"""
Comprehensive performance monitoring example for PromptOps Python client

This example demonstrates:
1. Setting up performance monitoring
2. Using adaptive retry mechanisms
3. Implementing smart caching
4. Connection pool optimization
5. Real-time dashboard
6. CLI tool usage
"""

import asyncio
import time
import random
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from promptops import PromptOpsClient, ClientConfig
from promptops.performance import (
    PerformanceMonitor,
    PerformanceConfig,
    PerformanceAlert,
    AlertSeverity,
    MetricType
)
from promptops.performance.adaptive_retry import (
    AdaptiveRetryManager,
    AdaptiveRetryConfig,
    RetryStrategy
)
from promptops.performance.smart_cache import (
    SmartCacheManager,
    SmartCacheConfig,
    CacheStrategy,
    PrefetchStrategy
)
from promptops.performance.connection_pool import (
    ConnectionPool,
    PoolConfig,
    PoolStrategy
)
from promptops.performance.dashboard import PerformanceDashboard
from promptops.performance.opentelemetry import initialize_opentelemetry

import structlog

logger = structlog.get_logger(__name__)


class PerformanceMonitoringExample:
    """Comprehensive example demonstrating all performance monitoring features"""

    def __init__(self):
        self.client = None
        self.performance_monitor = None
        self.retry_manager = None
        self.cache_manager = None
        self.connection_pool = None
        self.dashboard = None
        self.opentelemetry_integration = None

    async def setup(self):
        """Setup all performance monitoring components"""
        print("🚀 Setting up performance monitoring components...")

        # 1. Initialize OpenTelemetry (optional)
        try:
            self.opentelemetry_integration = initialize_opentelemetry(
                service_name="promptops-example",
                enable_metrics=True,
                enable_traces=True
            )
            print("✅ OpenTelemetry initialized")
        except Exception as e:
            print(f"⚠️  OpenTelemetry initialization failed: {e}")

        # 2. Setup performance monitor
        perf_config = PerformanceConfig(
            enabled=True,
            sample_rate=1.0,
            enable_real_time_monitoring=True,
            enable_alerting=True,
            enable_optimization_recommendations=True,
            opentelemetry_enabled=self.opentelemetry_integration is not None
        )

        self.performance_monitor = PerformanceMonitor(perf_config)
        self.performance_monitor.start()
        print("✅ Performance monitor started")

        # 3. Setup adaptive retry manager
        retry_config = AdaptiveRetryConfig(
            max_attempts=3,
            base_delay=1.0,
            max_delay=30.0,
            strategy=RetryStrategy.ADAPTIVE_BACKOFF,
            enable_circuit_breaker=True,
            circuit_breaker_threshold=5,
            enable_rate_limit_detection=True,
            success_rate_threshold=0.5
        )

        self.retry_manager = AdaptiveRetryManager(retry_config)
        print("✅ Adaptive retry manager initialized")

        # 4. Setup smart cache manager
        cache_config = SmartCacheConfig(
            max_size=500,
            max_memory_bytes=50 * 1024 * 1024,  # 50MB
            default_ttl=1800,  # 30 minutes
            strategy=CacheStrategy.ADAPTIVE,
            enable_tiering=True,
            enable_prefetching=True,
            prefetch_strategy=PrefetchStrategy.ADAPTIVE,
            enable_compression=True,
            enable_pattern_analysis=True
        )

        async def mock_data_fetcher(key: str) -> Any:
            """Mock data fetcher for cache"""
            await asyncio.sleep(0.1)  # Simulate network delay
            return f"data_for_{key}_{datetime.utcnow().isoformat()}"

        self.cache_manager = SmartCacheManager(cache_config, mock_data_fetcher)
        await self.cache_manager.initialize()
        print("✅ Smart cache manager initialized")

        # 5. Setup connection pool
        pool_config = PoolConfig(
            min_size=2,
            max_size=8,
            max_idle_time=300,  # 5 minutes
            max_connection_age=3600,  # 1 hour
            health_check_interval=60,
            strategy=PoolStrategy.ADAPTIVE,
            enable_adaptive_sizing=True,
            enable_health_checks=True
        )

        async def create_connection():
            """Mock connection factory"""
            await asyncio.sleep(0.05)  # Simulate connection time
            return f"mock_connection_{datetime.utcnow().timestamp()}"

        self.connection_pool = ConnectionPool(pool_config, create_connection)
        await self.connection_pool.initialize()
        print("✅ Connection pool initialized")

        # 6. Setup dashboard
        self.dashboard = PerformanceDashboard(
            performance_monitor=self.performance_monitor,
            retry_manager=self.retry_manager,
            connection_pool=self.connection_pool,
            cache_manager=self.cache_manager
        )
        await self.dashboard.start()
        print("✅ Performance dashboard started")

        # 7. Setup custom alerts
        self._setup_custom_alerts()
        print("✅ Custom alerts configured")

        # 8. Setup client
        client_config = ClientConfig(
            base_url="https://api.promptops.ai",
            api_key="your-api-key-here",  # Replace with actual API key
            timeout=30.0
        )

        self.client = PromptOpsClient(client_config)
        await self.client.initialize()
        print("✅ PromptOps client initialized")

    def _setup_custom_alerts(self):
        """Setup custom performance alerts"""
        # High latency alert
        high_latency_alert = PerformanceAlert(
            id="high_latency_example",
            metric_type=MetricType.REQUEST_LATENCY,
            condition="> 5.0",
            threshold=5.0,
            severity=AlertSeverity.WARNING,
            message="Example: High request latency detected",
            enabled=True,
            cooldown_period=60
        )

        # Low cache hit rate alert
        low_cache_alert = PerformanceAlert(
            id="low_cache_example",
            metric_type=MetricType.CACHE_HIT_RATE,
            condition="< 0.3",
            threshold=0.3,
            severity=AlertSeverity.INFO,
            message="Example: Low cache hit rate detected",
            enabled=True,
            cooldown_period=300
        )

        self.performance_monitor.add_custom_alert(high_latency_alert)
        self.performance_monitor.add_custom_alert(low_cache_alert)

        # Setup alert callbacks
        self.performance_monitor.add_alert_callback(self._handle_alert)
        self.performance_monitor.add_recommendation_callback(self._handle_recommendation)

    def _handle_alert(self, alert):
        """Handle performance alerts"""
        print(f"🚨 ALERT: {alert.severity.value.upper()} - {alert.message}")
        # In production, you might send this to Slack, email, etc.

    def _handle_recommendation(self, recommendation):
        """Handle optimization recommendations"""
        print(f"💡 RECOMMENDATION: {recommendation.title} ({recommendation.impact} impact)")
        print(f"   {recommendation.description}")

    async def demonstrate_monitoring(self):
        """Demonstrate real-time monitoring"""
        print("\n📊 Demonstrating real-time monitoring...")

        # Simulate various operations
        for i in range(20):
            # Track request start
            request_id = self.performance_monitor.track_request_start(
                f"/api/v1/prompts/{i}", "GET"
            )

            # Simulate processing time
            processing_time = random.uniform(0.1, 2.0)
            await asyncio.sleep(processing_time)

            # Simulate cache operation
            cache_hit = random.random() > 0.3  # 70% cache hit rate
            self.performance_monitor.track_cache_operation(
                cache_hit, processing_time
            )

            # Track request end
            status_code = 200 if random.random() > 0.05 else 500  # 5% error rate
            self.performance_monitor.track_request_end(
                request_id=request_id,
                status_code=status_code,
                cache_hit=cache_hit,
                retry_count=random.randint(0, 2),
                bytes_sent=random.randint(100, 1000),
                bytes_received=random.randint(1000, 10000)
            )

            # Update memory and network metrics
            self.performance_monitor.update_memory_metrics()
            self.performance_monitor.update_network_metrics(
                connection_count=random.randint(1, 5),
                connection_pool_size=8,
                bandwidth_bps=random.uniform(100000, 1000000)
            )

            print(f"   Processed request {i+1}/20 (latency: {processing_time:.2f}s, cache: {'hit' if cache_hit else 'miss'})")

            # Small delay between requests
            await asyncio.sleep(0.5)

    async def demonstrate_retry_mechanisms(self):
        """Demonstrate adaptive retry mechanisms"""
        print("\n🔄 Demonstrating adaptive retry mechanisms...")

        async def flaky_operation(operation_id: str):
            """Simulate a flaky operation"""
            if random.random() < 0.3:  # 30% failure rate
                if random.random() < 0.5:
                    raise Exception("Network timeout")
                else:
                    raise Exception("Rate limit exceeded")
            return f"success_{operation_id}"

        # Test retry with different scenarios
        for i in range(5):
            print(f"\n   Testing operation {i+1}...")
            result = await self.retry_manager.execute_with_retry(
                lambda: flaky_operation(f"test_{i}"),
                f"flaky_operation_{i}"
            )

            if result.success:
                print(f"   ✅ Success after {result.attempts} attempts ({result.total_time:.2f}s)")
            else:
                print(f"   ❌ Failed after {result.attempts} attempts: {result.last_error}")

        # Show retry performance summary
        summary = self.retry_manager.get_performance_summary()
        print(f"\n   Retry Summary:")
        print(f"   Total requests: {summary['total_requests']}")
        print(f"   Overall success rate: {summary['overall_success_rate']:.1%}")

    async def demonstrate_smart_caching(self):
        """Demonstrate smart caching strategies"""
        print("\n💾 Demonstrating smart caching strategies...")

        # Test cache operations with different access patterns
        test_keys = [f"prompt_{i}" for i in range(10)]
        hot_keys = test_keys[:3]  # Frequently accessed keys

        # Simulate access patterns
        for iteration in range(5):
            print(f"\n   Cache iteration {iteration+1}:")

            # Access hot keys more frequently
            all_keys = hot_keys * 3 + test_keys  # Hot keys appear 3x more
            random.shuffle(all_keys)

            for key in all_keys[:15]:  # Access 15 keys per iteration
                start_time = time.time()

                # Try to get from cache
                value = await self.cache_manager.get(key)

                if value is None:
                    # Cache miss - fetch and store
                    print(f"     Cache miss for {key}")
                    value = f"data_{key}_{datetime.utcnow().isoformat()}"
                    await self.cache_manager.set(key, value, ttl=300)  # 5 minutes
                else:
                    print(f"     Cache hit for {key}")

                access_time = time.time() - start_time

            # Show cache statistics
            stats = self.cache_manager.get_cache_stats()
            print(f"     Cache stats: {stats['hit_rate']:.1%} hit rate, {stats['total_items']} items")

        # Show cache optimization recommendations
        recommendations = self.cache_manager.get_optimization_recommendations()
        if recommendations:
            print(f"\n   Cache Optimization Recommendations:")
            for rec in recommendations:
                print(f"     • {rec['title']} (priority: {rec['priority']})")

    async def demonstrate_connection_pool(self):
        """Demonstrate connection pool optimization"""
        print("\n🔗 Demonstrating connection pool optimization...")

        # Simulate connection usage
        async def use_connection():
            """Simulate using a connection"""
            try:
                # Acquire connection from pool
                connection = await self.connection_pool.acquire()
                print(f"     Acquired connection: {connection}")

                # Simulate work
                await asyncio.sleep(random.uniform(0.1, 0.5))

                # Release connection
                await self.connection_pool.release(connection)
                print(f"     Released connection: {connection}")

            except Exception as e:
                print(f"     Connection error: {e}")

        # Run concurrent connection operations
        tasks = []
        for i in range(10):
            task = asyncio.create_task(use_connection())
            tasks.append(task)

        await asyncio.gather(*tasks)

        # Show pool metrics
        metrics = self.connection_pool.get_metrics()
        print(f"\n   Connection Pool Metrics:")
        print(f"     Total connections: {metrics.total_connections}")
        print(f"     Active connections: {metrics.active_connections}")
        print(f"     Idle connections: {metrics.idle_connections}")
        print(f"     Pool utilization: {metrics.pool_utilization:.1%}")

        # Show optimization recommendations
        recommendations = self.connection_pool.get_optimization_recommendations()
        if recommendations:
            print(f"\n   Connection Pool Recommendations:")
            for rec in recommendations:
                print(f"     • {rec['title']} (priority: {rec['priority']})")

    async def demonstrate_dashboard(self):
        """Demonstrate performance dashboard"""
        print("\n📈 Demonstrating performance dashboard...")

        # Generate some dashboard data
        snapshot = self.performance_monitor.get_performance_snapshot()
        print(f"   Dashboard Data Snapshot:")
        print(f"     Timestamp: {snapshot.timestamp}")
        print(f"     Active requests: {len(snapshot.request_metrics)}")
        print(f"     Cache hit rate: {snapshot.cache_metrics.hit_rate:.1%}")
        print(f"     Memory usage: {snapshot.memory_metrics.rss_bytes / (1024*1024):.1f} MB")
        print(f"     Active alerts: {len([a for a in snapshot.alerts if a.enabled])}")
        print(f"     Recommendations: {len(snapshot.recommendations)}")

        # Show dashboard summary
        summary = self.performance_monitor.get_summary()
        print(f"\n   Performance Summary:")
        for key, value in summary.items():
            if isinstance(value, float):
                print(f"     {key}: {value:.2f}")
            else:
                print(f"     {key}: {value}")

        # Export dashboard data
        export_data = self.dashboard.export_dashboard_data("json")
        print(f"\n   Dashboard data exported (length: {len(export_data)} chars)")

    async def show_final_report(self):
        """Show comprehensive performance report"""
        print("\n📋 Final Performance Report")
        print("=" * 50)

        # Performance monitor summary
        summary = self.performance_monitor.get_summary()
        print(f"\n📊 Performance Monitor:")
        print(f"   Running: {summary['running']}")
        print(f"   Cache hit rate: {summary['cache_hit_rate']:.1%}")
        print(f"   Memory usage: {summary['memory_usage_mb']:.1f} MB")
        print(f"   Active alerts: {summary['alert_count']}")
        print(f"   Recommendations: {summary['recommendation_count']}")

        # Retry manager summary
        retry_summary = self.retry_manager.get_performance_summary()
        print(f"\n🔄 Retry Manager:")
        print(f"   Total requests: {retry_summary['total_requests']}")
        print(f"   Success rate: {retry_summary['overall_success_rate']:.1%}")
        print(f"   Circuit breaker state: {retry_summary['circuit_breaker_state']}")

        # Cache manager summary
        cache_stats = self.cache_manager.get_cache_stats()
        print(f"\n💾 Cache Manager:")
        print(f"   Total items: {cache_stats['total_items']}")
        print(f"   Hit rate: {cache_stats['hit_rate']:.1%}")
        print(f"   Average access time: {cache_stats['average_access_time']:.3f}s")
        print(f"   Cache efficiency: {cache_stats['cache_efficiency']:.1%}")

        # Connection pool summary
        pool_metrics = self.connection_pool.get_metrics()
        print(f"\n🔗 Connection Pool:")
        print(f"   Total connections: {pool_metrics.total_connections}")
        print(f"   Utilization: {pool_metrics.pool_utilization:.1%}")
        print(f"   Average response time: {pool_metrics.average_response_time:.3f}s")

        # Recommendations
        snapshot = self.performance_monitor.get_performance_snapshot()
        if snapshot.recommendations:
            print(f"\n💡 Optimization Recommendations:")
            for i, rec in enumerate(snapshot.recommendations, 1):
                print(f"   {i}. {rec.title}")
                print(f"      Impact: {rec.impact}, Effort: {rec.effort}")
                print(f"      Confidence: {rec.confidence:.1%}")

        # Alerts
        active_alerts = [alert for alert in snapshot.alerts if alert.enabled]
        if active_alerts:
            print(f"\n🚨 Active Alerts:")
            for alert in active_alerts:
                print(f"   • {alert.severity.value.upper()}: {alert.message}")
        else:
            print(f"\n✅ No active alerts")

    async def cleanup(self):
        """Cleanup all resources"""
        print("\n🧹 Cleaning up resources...")

        if self.client:
            await self.client.shutdown()
            print("✅ Client shutdown")

        if self.dashboard:
            await self.dashboard.stop()
            print("✅ Dashboard stopped")

        if self.connection_pool:
            await self.connection_pool.close()
            print("✅ Connection pool closed")

        if self.cache_manager:
            await self.cache_manager.close()
            print("✅ Cache manager closed")

        if self.performance_monitor:
            self.performance_monitor.stop()
            print("✅ Performance monitor stopped")

        if self.opentelemetry_integration:
            self.opentelemetry_integration.shutdown()
            print("✅ OpenTelemetry shutdown")

    async def run(self):
        """Run the complete performance monitoring example"""
        print("🎯 PromptOps Performance Monitoring Example")
        print("=" * 60)

        try:
            # Setup all components
            await self.setup()

            # Run demonstrations
            await self.demonstrate_monitoring()
            await self.demonstrate_retry_mechanisms()
            await self.demonstrate_smart_caching()
            await self.demonstrate_connection_pool()
            await self.demonstrate_dashboard()

            # Show final report
            await self.show_final_report()

            print("\n🎉 Performance monitoring example completed successfully!")

            print("\n💡 Next Steps:")
            print("   1. Start the web dashboard: await dashboard.start_web_server()")
            print("   2. Use the CLI tool: promptops-perf monitor --web")
            print("   3. Export metrics: promptops-perf export --format json")
            print("   4. Run benchmarks: promptops-perf benchmark --duration 60")

        except Exception as e:
            print(f"\n❌ Error running example: {e}")
            import traceback
            traceback.print_exc()
        finally:
            await self.cleanup()


async def main():
    """Main entry point"""
    example = PerformanceMonitoringExample()
    await example.run()


if __name__ == "__main__":
    asyncio.run(main())