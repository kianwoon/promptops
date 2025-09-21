"""
Performance monitoring models and data structures for PromptOps client
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Union
import time
import threading
from collections import deque
import statistics


class MetricType(Enum):
    """Types of performance metrics"""
    REQUEST_LATENCY = "request_latency"
    MEMORY_USAGE = "memory_usage"
    CPU_USAGE = "cpu_usage"
    NETWORK_LATENCY = "network_latency"
    CACHE_HIT_RATE = "cache_hit_rate"
    ERROR_RATE = "error_rate"
    THROUGHPUT = "throughput"
    CONNECTION_POOL_SIZE = "connection_pool_size"
    RETRY_COUNT = "retry_count"
    BATCH_SIZE = "batch_size"
    COMPRESSION_RATIO = "compression_ratio"


class AlertSeverity(Enum):
    """Alert severity levels"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class OptimizationStrategy(Enum):
    """Performance optimization strategies"""
    ADAPTIVE_RETRY = "adaptive_retry"
    CONNECTION_POOLING = "connection_pooling"
    SMART_CACHING = "smart_caching"
    REQUEST_BATCHING = "request_batching"
    COMPRESSION = "compression"
    LOAD_BALANCING = "load_balancing"
    CIRCUIT_BREAKER = "circuit_breaker"


@dataclass
class PerformanceMetric:
    """Single performance metric data point"""
    metric_type: MetricType
    value: float
    timestamp: datetime
    tags: Dict[str, str] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RequestMetrics:
    """Metrics for individual requests"""
    request_id: str
    endpoint: str
    method: str
    start_time: datetime
    end_time: Optional[datetime] = None
    duration: Optional[float] = None
    status_code: Optional[int] = None
    error: Optional[str] = None
    cache_hit: bool = False
    retry_count: int = 0
    bytes_sent: int = 0
    bytes_received: int = 0
    compression_ratio: float = 1.0

    def finish(self, status_code: int, error: Optional[str] = None) -> None:
        """Mark request as completed"""
        self.end_time = datetime.utcnow()
        self.duration = (self.end_time - self.start_time).total_seconds()
        self.status_code = status_code
        self.error = error


@dataclass
class CacheMetrics:
    """Cache performance metrics"""
    hits: int = 0
    misses: int = 0
    evictions: int = 0
    size: int = 0
    max_size: int = 0
    hit_rate: float = 0.0
    avg_access_time: float = 0.0

    def update_hit(self, access_time: float) -> None:
        """Update cache hit metrics"""
        self.hits += 1
        self._update_hit_rate()
        self._update_avg_access_time(access_time)

    def update_miss(self, access_time: float) -> None:
        """Update cache miss metrics"""
        self.misses += 1
        self._update_hit_rate()
        self._update_avg_access_time(access_time)

    def update_eviction(self) -> None:
        """Update cache eviction metrics"""
        self.evictions += 1

    def _update_hit_rate(self) -> None:
        """Update cache hit rate"""
        total = self.hits + self.misses
        if total > 0:
            self.hit_rate = self.hits / total

    def _update_avg_access_time(self, access_time: float) -> None:
        """Update average access time using exponential moving average"""
        if self.avg_access_time == 0:
            self.avg_access_time = access_time
        else:
            # EMA with alpha = 0.1
            self.avg_access_time = 0.9 * self.avg_access_time + 0.1 * access_time


@dataclass
class MemoryMetrics:
    """Memory usage metrics"""
    rss_bytes: int = 0  # Resident Set Size
    vms_bytes: int = 0  # Virtual Memory Size
    heap_bytes: int = 0
    cache_bytes: int = 0
    thread_count: int = 0
    gc_count: int = 0
    gc_time: float = 0.0

    @property
    def rss_mb(self) -> float:
        """RSS in MB"""
        return self.rss_bytes / (1024 * 1024)

    @property
    def vms_mb(self) -> float:
        """VMS in MB"""
        return self.vms_bytes / (1024 * 1024)

    @property
    def heap_mb(self) -> float:
        """Heap size in MB"""
        return self.heap_bytes / (1024 * 1024)


@dataclass
class NetworkMetrics:
    """Network performance metrics"""
    connection_count: int = 0
    connection_pool_size: int = 0
    connection_wait_time: float = 0.0
    dns_lookup_time: float = 0.0
    tcp_connection_time: float = 0.0
    tls_handshake_time: float = 0.0
    bandwidth_bytes_per_sec: float = 0.0
    packet_loss_rate: float = 0.0
    latency_p50: float = 0.0
    latency_p95: float = 0.0
    latency_p99: float = 0.0


@dataclass
class PerformanceAlert:
    """Performance alert configuration"""
    id: str
    metric_type: MetricType
    condition: str  # e.g., "value > 100", "value < 0.8"
    threshold: float
    severity: AlertSeverity
    message: str
    enabled: bool = True
    cooldown_period: int = 300  # seconds
    last_triggered: Optional[datetime] = None

    def should_trigger(self, value: float) -> bool:
        """Check if alert should trigger"""
        if not self.enabled:
            return False

        # Check cooldown period
        if (self.last_triggered and
            (datetime.utcnow() - self.last_triggered).total_seconds() < self.cooldown_period):
            return False

        # Evaluate condition
        try:
            # Simple condition evaluation (for production, use a proper expression evaluator)
            if ">" in self.condition:
                threshold = float(self.condition.split(">")[1].strip())
                return value > threshold
            elif "<" in self.condition:
                threshold = float(self.condition.split("<")[1].strip())
                return value < threshold
            elif ">=" in self.condition:
                threshold = float(self.condition.split(">=")[1].strip())
                return value >= threshold
            elif "<=" in self.condition:
                threshold = float(self.condition.split("<=")[1].strip())
                return value <= threshold
        except (ValueError, IndexError):
            pass

        return False


@dataclass
class OptimizationRecommendation:
    """Performance optimization recommendation"""
    strategy: OptimizationStrategy
    title: str
    description: str
    impact: str  # "low", "medium", "high"
    effort: str  # "low", "medium", "high"
    confidence: float  # 0.0 to 1.0
    current_value: Optional[float] = None
    target_value: Optional[float] = None
    estimated_improvement: Optional[str] = None
    implementation_hint: Optional[str] = None


@dataclass
class PerformanceSnapshot:
    """Snapshot of current performance metrics"""
    timestamp: datetime
    request_metrics: Dict[str, RequestMetrics]
    cache_metrics: CacheMetrics
    memory_metrics: MemoryMetrics
    network_metrics: NetworkMetrics
    system_metrics: Dict[str, float]
    alerts: List[PerformanceAlert]
    recommendations: List[OptimizationRecommendation]


@dataclass
class TimeSeriesDataPoint:
    """Single data point in time series"""
    timestamp: datetime
    value: float
    tags: Dict[str, str] = field(default_factory=dict)


@dataclass
class TimeSeriesMetrics:
    """Time series metrics for trending analysis"""
    metric_type: MetricType
    data_points: List[TimeSeriesDataPoint] = field(default_factory=list)
    max_points: int = 1000  # Maximum points to retain

    def add_point(self, value: float, tags: Optional[Dict[str, str]] = None) -> None:
        """Add a new data point"""
        point = TimeSeriesDataPoint(
            timestamp=datetime.utcnow(),
            value=value,
            tags=tags or {}
        )
        self.data_points.append(point)

        # Maintain max_points limit
        if len(self.data_points) > self.max_points:
            self.data_points = self.data_points[-self.max_points:]

    def get_statistics(self, window_minutes: int = 60) -> Dict[str, float]:
        """Get statistics for recent data points"""
        cutoff_time = datetime.utcnow() - timedelta(minutes=window_minutes)
        recent_points = [p for p in self.data_points if p.timestamp > cutoff_time]

        if not recent_points:
            return {}

        values = [p.value for p in recent_points]
        return {
            "count": len(values),
            "min": min(values),
            "max": max(values),
            "mean": statistics.mean(values),
            "median": statistics.median(values),
            "p95": statistics.quantiles(values, n=20)[18] if len(values) >= 20 else max(values),
            "p99": statistics.quantiles(values, n=100)[98] if len(values) >= 100 else max(values),
            "std_dev": statistics.stdev(values) if len(values) > 1 else 0.0
        }


@dataclass
class PerformanceConfig:
    """Configuration for performance monitoring"""
    enabled: bool = True
    sample_rate: float = 1.0
    max_metrics_retention_hours: int = 24
    alert_cooldown_seconds: int = 300
    metrics_buffer_size: int = 10000
    time_series_max_points: int = 1000
    enable_real_time_monitoring: bool = True
    enable_historical_analysis: bool = True
    enable_alerting: bool = True
    enable_optimization_recommendations: bool = True
    opentelemetry_enabled: bool = False
    opentelemetry_endpoint: Optional[str] = None
    custom_metrics_endpoint: Optional[str] = None
    dashboard_refresh_interval: int = 30  # seconds
    optimization_auto_apply: bool = False  # Auto-apply optimizations