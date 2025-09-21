"""
Performance monitoring implementation for PromptOps client
"""

import asyncio
import psutil
import threading
import time
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Callable, Set
from collections import defaultdict, deque
import json
import logging
import statistics
from concurrent.futures import ThreadPoolExecutor

import structlog

from .models import (
    PerformanceConfig,
    PerformanceMetric,
    RequestMetrics,
    CacheMetrics,
    MemoryMetrics,
    NetworkMetrics,
    PerformanceAlert,
    OptimizationRecommendation,
    PerformanceSnapshot,
    TimeSeriesMetrics,
    MetricType,
    AlertSeverity,
    OptimizationStrategy
)

logger = structlog.get_logger(__name__)


class PerformanceMonitor:
    """Real-time performance monitoring for PromptOps client"""

    def __init__(self, config: PerformanceConfig):
        self.config = config
        self._enabled = config.enabled
        self._running = False
        self._lock = threading.RLock()

        # Metrics storage
        self._metrics_buffer = deque(maxlen=config.metrics_buffer_size)
        self._time_series = defaultdict(lambda: TimeSeriesMetrics(
            metric_type=MetricType.REQUEST_LATENCY,  # Default, will be overridden
            max_points=config.time_series_max_points
        ))
        self._current_requests = {}
        self._completed_requests = deque(maxlen=1000)

        # Performance components
        self.cache_metrics = CacheMetrics()
        self.memory_metrics = MemoryMetrics()
        self.network_metrics = NetworkMetrics()
        self.system_metrics = {}

        # Alerts and recommendations
        self._alerts: List[PerformanceAlert] = []
        self._recommendations: List[OptimizationRecommendation] = []
        self._alert_callbacks: List[Callable[[PerformanceAlert], None]] = []
        self._recommendation_callbacks: List[Callable[[OptimizationRecommendation], None]] = []

        # Background workers
        self._executor = ThreadPoolExecutor(max_workers=4)
        self._monitor_thread = None
        self._flush_thread = None

        # Initialize
        self._setup_default_alerts()
        if self._enabled:
            self.start()

    def start(self) -> None:
        """Start performance monitoring"""
        if self._running:
            return

        self._running = True
        logger.info("Starting performance monitor")

        # Start background threads
        self._monitor_thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self._monitor_thread.start()

        self._flush_thread = threading.Thread(target=self._flush_loop, daemon=True)
        self._flush_thread.start()

    def stop(self) -> None:
        """Stop performance monitoring"""
        if not self._running:
            return

        self._running = False
        logger.info("Stopping performance monitor")

        # Wait for threads to finish
        if self._monitor_thread:
            self._monitor_thread.join(timeout=5)
        if self._flush_thread:
            self._flush_thread.join(timeout=5)

        # Shutdown executor
        self._executor.shutdown(wait=True)

    def _setup_default_alerts(self) -> None:
        """Setup default performance alerts"""
        default_alerts = [
            PerformanceAlert(
                id="high_latency",
                metric_type=MetricType.REQUEST_LATENCY,
                condition="> 5.0",
                threshold=5.0,
                severity=AlertSeverity.WARNING,
                message="High request latency detected",
                cooldown_period=300
            ),
            PerformanceAlert(
                id="critical_latency",
                metric_type=MetricType.REQUEST_LATENCY,
                condition="> 10.0",
                threshold=10.0,
                severity=AlertSeverity.CRITICAL,
                message="Critical request latency detected",
                cooldown_period=60
            ),
            PerformanceAlert(
                id="low_cache_hit_rate",
                metric_type=MetricType.CACHE_HIT_RATE,
                condition="< 0.5",
                threshold=0.5,
                severity=AlertSeverity.WARNING,
                message="Low cache hit rate detected",
                cooldown_period=600
            ),
            PerformanceAlert(
                id="high_error_rate",
                metric_type=MetricType.ERROR_RATE,
                condition="> 0.1",
                threshold=0.1,
                severity=AlertSeverity.ERROR,
                message="High error rate detected",
                cooldown_period=300
            ),
            PerformanceAlert(
                id="high_memory_usage",
                metric_type=MetricType.MEMORY_USAGE,
                condition="> 1000",  # 1GB
                threshold=1000.0,
                severity=AlertSeverity.WARNING,
                message="High memory usage detected",
                cooldown_period=600
            )
        ]

        self._alerts.extend(default_alerts)

    def track_request_start(self, endpoint: str, method: str) -> str:
        """Track the start of a request"""
        if not self._enabled:
            return ""

        request_id = str(uuid.uuid4())
        request = RequestMetrics(
            request_id=request_id,
            endpoint=endpoint,
            method=method,
            start_time=datetime.utcnow()
        )

        with self._lock:
            self._current_requests[request_id] = request

        return request_id

    def track_request_end(self, request_id: str, status_code: int,
                         cache_hit: bool = False, retry_count: int = 0,
                         bytes_sent: int = 0, bytes_received: int = 0,
                         error: Optional[str] = None) -> None:
        """Track the end of a request"""
        if not self._enabled or not request_id:
            return

        with self._lock:
            if request_id not in self._current_requests:
                return

            request = self._current_requests.pop(request_id)
            request.finish(status_code, error)
            request.cache_hit = cache_hit
            request.retry_count = retry_count
            request.bytes_sent = bytes_sent
            request.bytes_received = bytes_received

            self._completed_requests.append(request)

            # Update cache metrics
            if cache_hit:
                self.cache_metrics.update_hit(request.duration or 0)
            else:
                self.cache_metrics.update_miss(request.duration or 0)

            # Add to time series
            if request.duration:
                self._add_time_series_point(MetricType.REQUEST_LATENCY, request.duration, {
                    "endpoint": request.endpoint,
                    "method": request.method,
                    "status_code": str(request.status_code)
                })

            # Check alerts
            self._check_alerts()

    def track_cache_operation(self, hit: bool, access_time: float) -> None:
        """Track cache operations"""
        if not self._enabled:
            return

        if hit:
            self.cache_metrics.update_hit(access_time)
        else:
            self.cache_metrics.update_miss(access_time)

        # Add to time series
        self._add_time_series_point(
            MetricType.CACHE_HIT_RATE,
            self.cache_metrics.hit_rate
        )

    def update_memory_metrics(self) -> None:
        """Update memory usage metrics"""
        if not self._enabled:
            return

        try:
            process = psutil.Process()
            memory_info = process.memory_info()

            self.memory_metrics.rss_bytes = memory_info.rss
            self.memory_metrics.vms_bytes = memory_info.vms
            self.memory_metrics.thread_count = process.num_threads()

            # Get GC stats if available
            try:
                import gc
                gc_stats = gc.get_stats()
                if gc_stats:
                    self.memory_metrics.gc_count = sum(s.get("collections", 0) for s in gc_stats)
                    self.memory_metrics.gc_time = sum(s.get("collected", 0) for s in gc_stats)
            except ImportError:
                pass

            # Add to time series
            self._add_time_series_point(
                MetricType.MEMORY_USAGE,
                self.memory_metrics.rss_mb,
                {"type": "rss"}
            )

        except Exception as e:
            logger.warning("Failed to update memory metrics", error=str(e))

    def update_network_metrics(self, connection_count: int = 0,
                             connection_pool_size: int = 0,
                             bandwidth_bps: float = 0.0) -> None:
        """Update network performance metrics"""
        if not self._enabled:
            return

        self.network_metrics.connection_count = connection_count
        self.network_metrics.connection_pool_size = connection_pool_size
        self.network_metrics.bandwidth_bytes_per_sec = bandwidth_bps

        # Add to time series
        self._add_time_series_point(
            MetricType.CONNECTION_POOL_SIZE,
            connection_pool_size
        )

    def _add_time_series_point(self, metric_type: MetricType, value: float,
                               tags: Optional[Dict[str, str]] = None) -> None:
        """Add a point to time series data"""
        with self._lock:
            if metric_type not in self._time_series:
                self._time_series[metric_type] = TimeSeriesMetrics(
                    metric_type=metric_type,
                    max_points=self.config.time_series_max_points
                )

            self._time_series[metric_type].add_point(value, tags)

    def _monitor_loop(self) -> None:
        """Background monitoring loop"""
        while self._running:
            try:
                # Update system metrics
                self._update_system_metrics()

                # Update memory metrics
                self.update_memory_metrics()

                # Generate recommendations
                self._generate_recommendations()

                # Sleep for monitoring interval
                time.sleep(10)  # Monitor every 10 seconds

            except Exception as e:
                logger.error("Error in monitor loop", error=str(e))
                time.sleep(30)  # Longer sleep on error

    def _flush_loop(self) -> None:
        """Background flush loop for metrics"""
        while self._running:
            try:
                self._flush_metrics()
                time.sleep(60)  # Flush every minute
            except Exception as e:
                logger.error("Error in flush loop", error=str(e))
                time.sleep(120)

    def _update_system_metrics(self) -> None:
        """Update system-level metrics"""
        try:
            # CPU usage
            cpu_percent = psutil.cpu_percent(interval=1)
            self.system_metrics["cpu_percent"] = cpu_percent

            # Memory usage
            memory = psutil.virtual_memory()
            self.system_metrics["memory_percent"] = memory.percent

            # Disk usage
            disk = psutil.disk_usage('/')
            self.system_metrics["disk_percent"] = disk.percent

            # Network I/O
            net_io = psutil.net_io_counters()
            self.system_metrics["bytes_sent"] = net_io.bytes_sent
            self.system_metrics["bytes_recv"] = net_io.bytes_recv

        except Exception as e:
            logger.warning("Failed to update system metrics", error=str(e))

    def _check_alerts(self) -> None:
        """Check if any alerts should be triggered"""
        if not self.config.enable_alerting:
            return

        for alert in self._alerts:
            try:
                value = self._get_metric_value(alert.metric_type)
                if value is not None and alert.should_trigger(value):
                    alert.last_triggered = datetime.utcnow()
                    self._trigger_alert(alert)
            except Exception as e:
                logger.error("Error checking alert", alert_id=alert.id, error=str(e))

    def _get_metric_value(self, metric_type: MetricType) -> Optional[float]:
        """Get current value for a metric type"""
        try:
            if metric_type == MetricType.REQUEST_LATENCY:
                if self._completed_requests:
                    recent_requests = [r for r in self._completed_requests
                                     if (datetime.utcnow() - r.end_time or datetime.utcnow()).total_seconds() < 300]
                    if recent_requests:
                        return statistics.mean(r.duration or 0 for r in recent_requests)

            elif metric_type == MetricType.CACHE_HIT_RATE:
                return self.cache_metrics.hit_rate

            elif metric_type == MetricType.MEMORY_USAGE:
                return self.memory_metrics.rss_mb

            elif metric_type == MetricType.ERROR_RATE:
                recent_requests = [r for r in self._completed_requests
                                 if (datetime.utcnow() - (r.end_time or datetime.utcnow())).total_seconds() < 300]
                if recent_requests:
                    error_count = sum(1 for r in recent_requests if r.error or (r.status_code and r.status_code >= 400))
                    return error_count / len(recent_requests)

            elif metric_type == MetricType.CONNECTION_POOL_SIZE:
                return self.network_metrics.connection_pool_size

        except Exception as e:
            logger.error("Error getting metric value", metric_type=metric_type, error=str(e))

        return None

    def _trigger_alert(self, alert: PerformanceAlert) -> None:
        """Trigger an alert"""
        logger.warning("Performance alert triggered",
                      alert_id=alert.id,
                      severity=alert.severity.value,
                      message=alert.message)

        # Call alert callbacks
        for callback in self._alert_callbacks:
            try:
                callback(alert)
            except Exception as e:
                logger.error("Error in alert callback", error=str(e))

    def _generate_recommendations(self) -> None:
        """Generate optimization recommendations"""
        if not self.config.enable_optimization_recommendations:
            return

        recommendations = []

        # Check cache performance
        if self.cache_metrics.hit_rate < 0.5:
            recommendations.append(OptimizationRecommendation(
                strategy=OptimizationStrategy.SMART_CACHING,
                title="Improve cache hit rate",
                description=f"Current cache hit rate is {self.cache_metrics.hit_rate:.1%}. Consider increasing cache TTL or size.",
                impact="medium",
                effort="low",
                confidence=0.8,
                current_value=self.cache_metrics.hit_rate,
                target_value=0.8,
                estimated_improvement="40% reduction in API calls"
            ))

        # Check request latency
        recent_latencies = []
        for request in self._completed_requests:
            if (request.duration and
                (datetime.utcnow() - (request.end_time or datetime.utcnow())).total_seconds() < 300):
                recent_latencies.append(request.duration)

        if recent_latencies:
            avg_latency = statistics.mean(recent_latencies)
            if avg_latency > 2.0:
                recommendations.append(OptimizationRecommendation(
                    strategy=OptimizationStrategy.CONNECTION_POOLING,
                    title="Optimize connection pooling",
                    description=f"Average request latency is {avg_latency:.2f}s. Consider optimizing connection pool settings.",
                    impact="high",
                    effort="medium",
                    confidence=0.9,
                    current_value=avg_latency,
                    target_value=1.0,
                    estimated_improvement="50% reduction in latency"
                ))

        # Check retry patterns
        retry_requests = [r for r in self._completed_requests if r.retry_count > 0]
        if len(retry_requests) > len(self._completed_requests) * 0.1:  # More than 10% retry rate
            recommendations.append(OptimizationRecommendation(
                strategy=OptimizationStrategy.ADAPTIVE_RETRY,
                title="Implement adaptive retry strategy",
                description=f"High retry rate detected ({len(retry_requests)} requests). Consider implementing exponential backoff with jitter.",
                impact="medium",
                effort="medium",
                confidence=0.7,
                estimated_improvement="Better resilience and reduced load"
            ))

        # Update recommendations if changed
        if recommendations != self._recommendations:
            self._recommendations = recommendations
            for callback in self._recommendation_callbacks:
                try:
                    for rec in recommendations:
                        callback(rec)
                except Exception as e:
                    logger.error("Error in recommendation callback", error=str(e))

    def _flush_metrics(self) -> None:
        """Flush metrics to external systems"""
        if not self._metrics_buffer:
            return

        try:
            # Send to custom endpoint if configured
            if self.config.custom_metrics_endpoint:
                self._send_to_custom_endpoint()

            # Send to OpenTelemetry if enabled
            if self.config.opentelemetry_enabled:
                self._send_to_opentelemetry()

            # Clear buffer
            with self._lock:
                self._metrics_buffer.clear()

        except Exception as e:
            logger.error("Error flushing metrics", error=str(e))

    def _send_to_custom_endpoint(self) -> None:
        """Send metrics to custom endpoint"""
        # Implementation depends on specific endpoint requirements
        pass

    def _send_to_opentelemetry(self) -> None:
        """Send metrics to OpenTelemetry"""
        # Implementation depends on OpenTelemetry setup
        pass

    def get_performance_snapshot(self) -> PerformanceSnapshot:
        """Get current performance snapshot"""
        with self._lock:
            return PerformanceSnapshot(
                timestamp=datetime.utcnow(),
                request_metrics=dict(self._current_requests),
                cache_metrics=self.cache_metrics,
                memory_metrics=self.memory_metrics,
                network_metrics=self.network_metrics,
                system_metrics=self.system_metrics.copy(),
                alerts=self._alerts.copy(),
                recommendations=self._recommendations.copy()
            )

    def get_time_series_data(self, metric_type: MetricType,
                           window_hours: int = 1) -> List[Dict[str, Any]]:
        """Get time series data for a metric type"""
        with self._lock:
            if metric_type not in self._time_series:
                return []

            series = self._time_series[metric_type]
            cutoff_time = datetime.utcnow() - timedelta(hours=window_hours)

            data = []
            for point in series.data_points:
                if point.timestamp > cutoff_time:
                    data.append({
                        "timestamp": point.timestamp.isoformat(),
                        "value": point.value,
                        "tags": point.tags
                    })

            return data

    def get_statistics(self, metric_type: MetricType, window_minutes: int = 60) -> Dict[str, float]:
        """Get statistics for a metric type"""
        with self._lock:
            if metric_type not in self._time_series:
                return {}

            return self._time_series[metric_type].get_statistics(window_minutes)

    def add_alert_callback(self, callback: Callable[[PerformanceAlert], None]) -> None:
        """Add callback for alerts"""
        self._alert_callbacks.append(callback)

    def add_recommendation_callback(self, callback: Callable[[OptimizationRecommendation], None]) -> None:
        """Add callback for optimization recommendations"""
        self._recommendation_callbacks.append(callback)

    def add_custom_alert(self, alert: PerformanceAlert) -> None:
        """Add custom alert"""
        with self._lock:
            self._alerts.append(alert)

    def clear_recommendations(self) -> None:
        """Clear all recommendations"""
        with self._lock:
            self._recommendations.clear()

    def get_summary(self) -> Dict[str, Any]:
        """Get performance summary"""
        with self._lock:
            return {
                "enabled": self._enabled,
                "running": self._running,
                "timestamp": datetime.utcnow().isoformat(),
                "active_requests": len(self._current_requests),
                "completed_requests": len(self._completed_requests),
                "cache_hit_rate": self.cache_metrics.hit_rate,
                "memory_usage_mb": self.memory_metrics.rss_mb,
                "alert_count": len(self._alerts),
                "recommendation_count": len(self._recommendations),
                "metrics_buffer_size": len(self._metrics_buffer),
                "time_series_count": len(self._time_series)
            }