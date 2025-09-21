# Performance Monitoring and Optimization Guide

This guide covers the comprehensive performance monitoring and optimization features available in the PromptOps client libraries.

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Performance Monitoring Components](#performance-monitoring-components)
4. [Real-time Metrics Collection](#real-time-metrics-collection)
5. [Alerting and Notifications](#alerting-and-notifications)
6. [Optimization Recommendations](#optimization-recommendations)
7. [Adaptive Retry Mechanisms](#adaptive-retry-mechanisms)
8. [Smart Caching Strategies](#smart-caching-strategies)
9. [Connection Pool Optimization](#connection-pool-optimization)
10. [Performance Dashboards](#performance-dashboards)
11. [CLI Tools](#cli-tools)
12. [OpenTelemetry Integration](#opentelemetry-integration)
13. [Advanced Configuration](#advanced-configuration)
14. [Examples](#examples)
15. [Best Practices](#best-practices)

## Overview

The PromptOps client libraries include comprehensive performance monitoring and optimization capabilities that help you:

- **Monitor** real-time performance metrics
- **Detect** performance issues and anomalies
- **Optimize** client behavior with intelligent recommendations
- **Visualize** performance data with dashboards
- **Automate** performance tuning with adaptive algorithms

### Key Features

- 📊 **Real-time Metrics Collection**: Monitor requests, latency, cache performance, memory usage, and network metrics
- 🚨 **Intelligent Alerting**: Configurable alerts with severity levels and cooldown periods
- 💡 **Smart Recommendations**: AI-powered optimization suggestions based on usage patterns
- 🔄 **Adaptive Retry**: Intelligent retry mechanisms with circuit breakers and rate limiting detection
- 💾 **Smart Caching**: Multi-tier caching with predictive prefetching
- 🔗 **Connection Pooling**: Optimized connection management with health monitoring
- 📈 **Performance Dashboards**: Web-based dashboards for real-time monitoring
- 🛠️ **CLI Tools**: Command-line interface for performance management
- 🔍 **OpenTelemetry Integration**: Export metrics to external monitoring systems

## Quick Start

### Python Client

```python
import asyncio
from promptops import PromptOpsClient, ClientConfig, PerformanceConfig
from promptops.performance import PerformanceMonitor

async def main():
    # Configure performance monitoring
    perf_config = PerformanceConfig(
        enabled=True,
        enable_real_time_monitoring=True,
        enable_alerting=True,
        enable_optimization_recommendations=True,
        sample_rate=1.0
    )

    # Initialize client with performance monitoring
    config = ClientConfig(
        base_url="https://api.promptops.ai",
        api_key="your-api-key-here",
        timeout=30.0
    )

    async with PromptOpsClient(config) as client:
        # Initialize performance monitor
        monitor = PerformanceMonitor(perf_config)

        # Start monitoring
        monitor.start()

        try:
            # Use the client normally
            prompt = await client.get_prompt("my-prompt-id", "v1.0")
            print(f"Retrieved prompt: {prompt.name}")

            # Get performance summary
            summary = monitor.get_summary()
            print(f"Cache hit rate: {summary['cache_hit_rate']:.1%}")
            print(f"Memory usage: {summary['memory_usage_mb']:.1f} MB")

        finally:
            # Stop monitoring
            monitor.stop()

if __name__ == "__main__":
    asyncio.run(main())
```

### TypeScript/JavaScript Client

```typescript
import { PromptOpsClient } from 'promptops-client';
import { PerformanceMonitor } from 'promptops-client/src/performance/PerformanceMonitor';

async function main() {
  // Initialize client
  const client = new PromptOpsClient({
    baseUrl: 'https://api.promptops.ai',
    apiKey: 'your-api-key-here',
    timeout: 30000
  });

  await client.initialize();

  // Initialize performance monitor
  const monitor = new PerformanceMonitor({
    config: {
      enabled: true,
      enableRealTimeMonitoring: true,
      enableAlerting: true,
      enableOptimizationRecommendations: true,
      sampleRate: 1.0
    }
  });

  try {
    // Use the client
    const prompt = await client.getPrompt({
      promptId: 'my-prompt-id',
      version: '1.0.0'
    });

    console.log('Retrieved prompt:', prompt.name);

    // Get performance summary
    const summary = monitor.getSummary();
    console.log(`Cache hit rate: ${(summary.cacheHitRate * 100).toFixed(1)}%`);
    console.log(`Memory usage: ${summary.memoryUsageMB.toFixed(1)} MB`);

  } finally {
    // Cleanup
    monitor.destroy();
    await client.shutdown();
  }
}

main().catch(console.error);
```

## Performance Monitoring Components

### 1. PerformanceMonitor Class

The `PerformanceMonitor` class is the main component for collecting and analyzing performance metrics.

#### Key Features

- **Real-time metrics collection** for requests, cache, memory, and network
- **Configurable alerts** with severity levels and cooldown periods
- **Optimization recommendations** based on performance patterns
- **Time series data** storage and analysis
- **Background monitoring** with configurable intervals

#### Supported Metrics

| Metric Type | Description | Units |
|-------------|-------------|-------|
| `REQUEST_LATENCY` | Request/response time | Seconds |
| `MEMORY_USAGE` | Memory consumption | MB |
| `CPU_USAGE` | CPU utilization | Percentage |
| `NETWORK_LATENCY` | Network round-trip time | Seconds |
| `CACHE_HIT_RATE` | Cache effectiveness | Ratio (0-1) |
| `ERROR_RATE` | Request failure rate | Ratio (0-1) |
| `THROUGHPUT` | Requests per time period | Requests/second |
| `CONNECTION_POOL_SIZE` | Active connections | Count |
| `RETRY_COUNT` | Retry attempts | Count |
| `BATCH_SIZE` | Batch operation size | Count |
| `COMPRESSION_RATIO` | Data compression effectiveness | Ratio |

### 2. Alerting System

The alerting system monitors metrics and triggers notifications when thresholds are exceeded.

#### Alert Types

- **Info**: Informational alerts
- **Warning**: Performance degradations
- **Error**: Significant issues requiring attention
- **Critical**: Critical failures requiring immediate action

#### Example Configuration

```python
from promptops.performance import PerformanceAlert, AlertSeverity, MetricType

# Create custom alert
high_latency_alert = PerformanceAlert(
    id="high_latency_critical",
    metric_type=MetricType.REQUEST_LATENCY,
    condition="> 10.0",
    threshold=10.0,
    severity=AlertSeverity.CRITICAL,
    message="Critical request latency detected",
    enabled=True,
    cooldown_period=60
)

# Add to monitor
monitor.add_custom_alert(high_latency_alert)
```

### 3. Optimization Recommendations

The system automatically analyzes performance patterns and provides actionable recommendations.

#### Recommendation Categories

- **Caching**: Optimize cache settings and strategies
- **Connection Pooling**: Improve connection management
- **Retry Logic**: Enhance retry mechanisms
- **Memory Usage**: Optimize memory consumption
- **Network Performance**: Reduce latency and improve throughput

#### Example Recommendations

```json
{
  "strategy": "SMART_CACHING",
  "title": "Improve cache hit rate",
  "description": "Current cache hit rate is 45%. Consider increasing cache TTL or size.",
  "impact": "medium",
  "effort": "low",
  "confidence": 0.8,
  "current_value": 0.45,
  "target_value": 0.8,
  "estimated_improvement": "40% reduction in API calls"
}
```

## Real-time Metrics Collection

### Tracking Requests

```python
import time

# Track request start
request_id = monitor.track_request_start("/api/v1/prompts", "GET")

# Simulate request processing
time.sleep(0.5)

# Track request end
monitor.track_request_end(
    request_id=request_id,
    status_code=200,
    cache_hit=True,
    retry_count=0,
    bytes_sent=256,
    bytes_received=1024
)
```

### Monitoring Cache Operations

```python
# Track cache operations
monitor.track_cache_operation(hit=True, access_time=0.001)
monitor.track_cache_operation(hit=False, access_time=0.1)
```

### Memory and Network Metrics

```python
# Update memory metrics (automatically done in background)
monitor.update_memory_metrics()

# Update network metrics
monitor.update_network_metrics(
    connection_count=5,
    connection_pool_size=10,
    bandwidth_bps=1024*1024
)
```

## Adaptive Retry Mechanisms

The adaptive retry system provides intelligent retry logic with circuit breakers and rate limiting detection.

### Features

- **Multiple retry strategies**: Exponential backoff, linear, fixed, adaptive
- **Circuit breaker**: Prevents cascading failures
- **Rate limiting detection**: Automatically adjusts for API limits
- **Performance tracking**: Monitors retry effectiveness

### Configuration

```python
from promptops.performance.adaptive_retry import (
    AdaptiveRetryManager,
    AdaptiveRetryConfig,
    RetryStrategy
)

retry_config = AdaptiveRetryConfig(
    max_attempts=3,
    base_delay=1.0,
    max_delay=60.0,
    strategy=RetryStrategy.ADAPTIVE_BACKOFF,
    enable_circuit_breaker=True,
    circuit_breaker_threshold=5,
    enable_rate_limit_detection=True,
    success_rate_threshold=0.5
)

retry_manager = AdaptiveRetryManager(retry_config)

# Execute with adaptive retry
result = await retry_manager.execute_with_retry(
    func=api_call,
    operation_name="get_prompt"
)
```

## Smart Caching Strategies

The smart caching system provides multi-tier caching with intelligent optimization.

### Features

- **Multiple strategies**: LRU, LFU, FIFO, adaptive, predictive
- **Tiered storage**: Hot, warm, cold, frozen data
- **Prefetching**: Predictive and adaptive prefetching
- **Pattern analysis**: Learns access patterns
- **Compression**: Automatic data compression
- **Cost analysis**: Tracks fetch costs and savings

### Configuration

```python
from promptops.performance.smart_cache import (
    SmartCacheManager,
    SmartCacheConfig,
    CacheStrategy
)

cache_config = SmartCacheConfig(
    max_size=1000,
    max_memory_bytes=100*1024*1024,  # 100MB
    default_ttl=3600,  # 1 hour
    strategy=CacheStrategy.ADAPTIVE,
    enable_tiering=True,
    enable_prefetching=True,
    prefetch_strategy=PrefetchStrategy.ADAPTIVE,
    enable_compression=True
)

cache_manager = SmartCacheManager(cache_config, fetch_function=data_fetcher)
await cache_manager.initialize()

# Use cache
value = await cache_manager.get("prompt:my-prompt:v1.0")
if value is None:
    # Cache miss - fetch and store
    value = await fetch_data("my-prompt")
    await cache_manager.set("prompt:my-prompt:v1.0", value)
```

## Connection Pool Optimization

The connection pool provides optimized connection management with health monitoring.

### Features

- **Multiple strategies**: Fixed size, dynamic, adaptive
- **Health monitoring**: Regular connection health checks
- **Adaptive sizing**: Adjusts pool size based on demand
- **Background pruning**: Removes idle and unhealthy connections
- **Performance metrics**: Tracks connection efficiency

### Configuration

```python
from promptops.performance.connection_pool import (
    ConnectionPool,
    PoolConfig,
    PoolStrategy
)

pool_config = PoolConfig(
    min_size=2,
    max_size=10,
    max_idle_time=300,  # 5 minutes
    max_connection_age=3600,  # 1 hour
    health_check_interval=60,
    strategy=PoolStrategy.ADAPTIVE,
    enable_adaptive_sizing=True
)

async def create_connection():
    return aiohttp.ClientSession()

pool = ConnectionPool(pool_config, create_connection)
await pool.initialize()

# Use connection pool
async with await pool.acquire() as session:
    response = await session.get("https://api.promptops.ai/v1/prompts")
    data = await response.json()
```

## Performance Dashboards

The web-based dashboard provides real-time visualization of performance metrics.

### Features

- **Real-time updates**: Live metric updates via WebSocket
- **Multiple dashboards**: Overview, requests, cache, network, alerts
- **Interactive charts**: Line, bar, pie, gauge, heatmap charts
- **Export capabilities**: JSON, CSV export of historical data
- **Mobile responsive**: Works on all device sizes

### Starting the Dashboard

```python
from promptops.performance.dashboard import PerformanceDashboard

# Create dashboard
dashboard = PerformanceDashboard(
    performance_monitor=monitor,
    retry_manager=retry_manager,
    connection_pool=pool,
    cache_manager=cache_manager
)

await dashboard.start()

# Start web server
await dashboard.start_web_server(host="localhost", port=8080)
```

### Dashboard Types

1. **Overview Dashboard**: High-level system health and key metrics
2. **Requests Dashboard**: Detailed request performance and latency analysis
3. **Cache Dashboard**: Cache hit rates, access patterns, and optimization
4. **Network Dashboard**: Connection metrics and network performance
5. **Alerts Dashboard**: Active alerts and notification history

## CLI Tools

The CLI tool provides command-line access to performance monitoring features.

### Installation

```bash
# The CLI is included with the Python client
pip install promptops-client

# Make sure the CLI is executable
chmod +x /path/to/promptops-perf
```

### Basic Commands

```bash
# Monitor performance in real-time
promptops-perf monitor --duration 60 --interval 5

# Get performance summary
promptops-perf summary --window 30

# Export performance data
promptops-perf export --format json --output performance.json

# Optimize performance settings
promptops-perf optimize --cache --retry --auto-apply

# Run benchmarks
promptops-perf benchmark --duration 60 --concurrent 10

# Analyze performance
promptops-perf analyze --recommendations --issues --trends

# Show configuration
promptops-perf config --show
```

### Advanced CLI Usage

```bash
# Start web dashboard
promptops-perf monitor --web --port 8080

# Export specific metrics
promptops-perf export --metric-type REQUEST_LATENCY --start-time 2024-01-01T00:00:00

# Run targeted benchmarks
promptops-perf benchmark --prompt-id my-prompt --iterations 1000

# Monitor specific time windows
promptops-perf monitor --duration 3600 --interval 30
```

## OpenTelemetry Integration

Export metrics to external monitoring systems using OpenTelemetry.

### Configuration

```python
from promptops.performance.opentelemetry import initialize_opentelemetry

# Initialize OpenTelemetry
otel_integration = initialize_opentelemetry(
    service_name="promptops-client",
    endpoint="http://localhost:4317",  # OTLP endpoint
    enable_metrics=True,
    enable_traces=True
)

# Metrics will be automatically exported
```

### Custom Metrics

```python
from promptops.performance.opentelemetry import record_performance_metric
from promptops.performance.models import MetricType

# Record custom metrics
record_performance_metric(
    metric_type=MetricType.CUSTOM_METRIC,
    value=42.0,
    attributes={"custom_tag": "value"}
)
```

## Advanced Configuration

### Performance Monitor Configuration

```python
from promptops.performance import PerformanceConfig

config = PerformanceConfig(
    enabled=True,
    sample_rate=1.0,
    max_metrics_retention_hours=24,
    alert_cooldown_seconds=300,
    metrics_buffer_size=10000,
    time_series_max_points=1000,
    enable_real_time_monitoring=True,
    enable_historical_analysis=True,
    enable_alerting=True,
    enable_optimization_recommendations=True,
    opentelemetry_enabled=True,
    opentelemetry_endpoint="http://localhost:4317",
    custom_metrics_endpoint="https://metrics.example.com",
    dashboard_refresh_interval=30,
    optimization_auto_apply=False
)
```

### Custom Alerts

```python
from promptops.performance import PerformanceAlert, AlertSeverity, MetricType

# Create custom alert with complex condition
custom_alert = PerformanceAlert(
    id="memory_spike",
    metric_type=MetricType.MEMORY_USAGE,
    condition="> 2000",  # 2GB
    threshold=2000.0,
    severity=AlertSeverity.WARNING,
    message="Memory usage spike detected",
    enabled=True,
    cooldown_period=300
)

monitor.add_custom_alert(custom_alert)
```

### Callback Functions

```python
# Alert callback
def on_alert(alert):
    print(f"ALERT: {alert.severity.value} - {alert.message}")
    # Send to Slack, email, etc.

monitor.add_alert_callback(on_alert)

# Recommendation callback
def on_recommendation(rec):
    print(f"RECOMMENDATION: {rec.title}")
    # Log or implement recommendation

monitor.add_recommendation_callback(on_recommendation)
```

## Examples

### Example 1: Basic Monitoring Setup

```python
import asyncio
from promptops import PromptOpsClient
from promptops.performance import PerformanceMonitor, PerformanceConfig

async def basic_monitoring_example():
    # Setup performance monitoring
    perf_config = PerformanceConfig(
        enabled=True,
        enable_alerting=True,
        enable_optimization_recommendations=True
    )

    monitor = PerformanceMonitor(perf_config)
    monitor.start()

    # Setup client
    config = ClientConfig(
        base_url="https://api.promptops.ai",
        api_key="your-api-key"
    )

    async with PromptOpsClient(config) as client:
        try:
            # Use client normally
            for i in range(10):
                prompt = await client.get_prompt("example-prompt")
                print(f"Got prompt: {prompt.name}")
                await asyncio.sleep(1)

            # Get performance summary
            summary = monitor.get_summary()
            print(f"Performance Summary:")
            print(f"  Cache hit rate: {summary['cache_hit_rate']:.1%}")
            print(f"  Memory usage: {summary['memory_usage_mb']:.1f} MB")
            print(f"  Active requests: {summary['active_requests']}")

        finally:
            monitor.stop()

asyncio.run(basic_monitoring_example())
```

### Example 2: Advanced Optimization

```python
import asyncio
from promptops import PromptOpsClient
from promptops.performance import (
    PerformanceMonitor, AdaptiveRetryManager, SmartCacheManager,
    ConnectionPool, PerformanceDashboard
)

async def advanced_optimization_example():
    # Setup all optimization components
    monitor = PerformanceMonitor(PerformanceConfig(enabled=True))
    retry_manager = AdaptiveRetryManager(AdaptiveRetryConfig(
        max_attempts=3,
        strategy=RetryStrategy.ADAPTIVE_BACKOFF
    ))

    cache_manager = SmartCacheManager(
        SmartCacheConfig(strategy=CacheStrategy.ADAPTIVE),
        fetch_function=data_fetcher
    )

    pool_config = PoolConfig(
        min_size=2,
        max_size=8,
        strategy=PoolStrategy.ADAPTIVE
    )
    connection_pool = ConnectionPool(pool_config, create_session)

    # Initialize all components
    await cache_manager.initialize()
    await connection_pool.initialize()
    monitor.start()

    # Setup dashboard
    dashboard = PerformanceDashboard(
        monitor, retry_manager, connection_pool, cache_manager
    )
    await dashboard.start()

    # Use optimized client
    client = PromptOpsClient(ClientConfig(
        base_url="https://api.promptops.ai",
        api_key="your-api-key"
    ))
    await client.initialize()

    try:
        # Run optimized operations
        results = await run_optimized_operations(client, cache_manager, retry_manager)
        print(f"Completed {len(results)} optimized operations")

        # Get optimization recommendations
        snapshot = monitor.get_performance_snapshot()
        for rec in snapshot.recommendations:
            print(f"Recommendation: {rec.title} ({rec.impact} impact)")

    finally:
        # Cleanup
        await dashboard.stop()
        monitor.stop()
        await connection_pool.close()
        await cache_manager.close()
        await client.shutdown()

async def run_optimized_operations(client, cache_manager, retry_manager):
    """Run operations with optimization"""
    operations = []

    for i in range(20):
        # Use adaptive retry
        result = await retry_manager.execute_with_retry(
            lambda: cache_manager.get(f"operation_{i}"),
            f"get_operation_{i}"
        )

        if result is None:
            # Cache miss - fetch with retry
            result = await retry_manager.execute_with_retry(
                lambda: client.get_prompt(f"prompt_{i}"),
                f"fetch_prompt_{i}"
            )

            # Store in cache
            await cache_manager.set(f"operation_{i}", result)

        operations.append(result)

    return operations

asyncio.run(advanced_optimization_example())
```

### Example 3: Real-time Dashboard

```python
import asyncio
from promptops.performance.dashboard import PerformanceDashboard
from promptops.performance import PerformanceMonitor

async def dashboard_example():
    # Setup performance monitoring
    monitor = PerformanceMonitor(PerformanceConfig(enabled=True))
    monitor.start()

    # Create dashboard
    dashboard = PerformanceDashboard(monitor)
    await dashboard.start()

    # Start web server
    print("Starting dashboard on http://localhost:8080")
    print("Press Ctrl+C to stop")

    try:
        # Keep running
        await asyncio.sleep(float('inf'))
    except KeyboardInterrupt:
        print("\nStopping dashboard...")
    finally:
        await dashboard.stop()
        monitor.stop()

asyncio.run(dashboard_example())
```

## Best Practices

### 1. Monitoring Configuration

- **Enable sampling** for high-traffic applications to reduce overhead
- **Configure appropriate retention periods** based on your storage capacity
- **Set realistic alert thresholds** to avoid alert fatigue
- **Use cooldown periods** to prevent alert spam

### 2. Performance Optimization

- **Start with default settings** and adjust based on observed patterns
- **Monitor recommendations** regularly and implement high-impact changes
- **Test optimizations** in staging environments before production
- **Measure before and after** to quantify improvements

### 3. Resource Management

- **Set appropriate limits** for cache sizes and connection pools
- **Monitor memory usage** to prevent leaks
- **Clean up resources** properly when shutting down
- **Use context managers** for automatic resource cleanup

### 4. Production Deployment

- **Enable alerting** for critical metrics
- **Use OpenTelemetry** for integration with existing monitoring systems
- **Run regular benchmarks** to establish performance baselines
- **Monitor trends** over time to detect gradual degradation

### 5. Security Considerations

- **Protect API keys** and sensitive configuration
- **Use HTTPS** for dashboard access
- **Restrict network access** to monitoring endpoints
- **Audit access logs** regularly

## Troubleshooting

### Common Issues

1. **High Memory Usage**
   - Check cache configuration and sizes
   - Monitor for memory leaks in custom code
   - Review time series data retention settings

2. **Slow Performance**
   - Analyze request latency metrics
   - Check network connectivity and latency
   - Review cache hit rates and optimization recommendations

3. **Alert Fatigue**
   - Adjust alert thresholds and cooldown periods
   - Implement alert grouping and escalation
   - Review and refine alert conditions

4. **Connection Pool Issues**
   - Monitor connection pool metrics
   - Check for connection leaks
   - Adjust pool size based on demand

### Debug Mode

Enable verbose logging for detailed debugging:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Performance Profiling

Use Python's built-in profiling tools:

```bash
python -m cProfile -o profile.stats your_script.py
python -m pstats profile.stats
```

## API Reference

For detailed API documentation, see:

- [Python Client API Reference](./python-api.md)
- [TypeScript Client API Reference](./typescript-api.md)
- [Performance Monitoring API](./performance-api.md)
- [CLI Reference](./cli-reference.md)

## Contributing

To contribute to performance monitoring features:

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## Support

For issues and questions:

- **Documentation**: [PromptOps Docs](https://docs.promptops.ai)
- **Issues**: [GitHub Issues](https://github.com/promptops/promptops-client/issues)
- **Community**: [PromptOps Community](https://community.promptops.ai)
- **Email**: [support@promptops.ai](mailto:support@promptops.ai)

---

*Last updated: January 2024*