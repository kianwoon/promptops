"""
OpenTelemetry integration for PromptOps performance monitoring
"""

import time
from datetime import datetime
from typing import Any, Dict, Optional, ContextManager
from contextlib import contextmanager
import logging

import structlog

from .models import MetricType, PerformanceMetric

logger = structlog.get_logger(__name__)

# Try to import OpenTelemetry components
try:
    from opentelemetry import metrics, trace
    from opentelemetry.sdk.metrics import MeterProvider
    from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader, ConsoleMetricExporter
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter
    from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
    from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
    from opentelemetry.metrics import Counter, Histogram, UpDownCounter
    from opentelemetry.trace import Span, Tracer
    OPENTELEMETRY_AVAILABLE = True
except ImportError:
    OPENTELEMETRY_AVAILABLE = False
    logger.warning("OpenTelemetry not available. Install with: pip install opentelemetry-api opentelemetry-sdk")


class OpenTelemetryIntegration:
    """OpenTelemetry integration for performance metrics"""

    def __init__(self, service_name: str = "promptops-client",
                 endpoint: Optional[str] = None,
                 enable_metrics: bool = True,
                 enable_traces: bool = True):
        """
        Initialize OpenTelemetry integration

        Args:
            service_name: Name of the service
            endpoint: OTLP endpoint for exporting telemetry
            enable_metrics: Whether to enable metrics collection
            enable_traces: Whether to enable tracing
        """
        self.service_name = service_name
        self.endpoint = endpoint
        self.enable_metrics = enable_metrics
        self.enable_traces = enable_traces
        self.initialized = False

        if not OPENTELEMETRY_AVAILABLE:
            logger.warning("OpenTelemetry not available, integration disabled")
            return

        self._setup_providers()
        self._setup_metrics()
        self._setup_traces()

    def _setup_providers(self) -> None:
        """Setup OpenTelemetry providers"""
        try:
            # Setup metrics provider
            if self.enable_metrics:
                if self.endpoint:
                    metric_exporter = OTLPMetricExporter(endpoint=self.endpoint)
                else:
                    metric_exporter = ConsoleMetricExporter()

                metric_reader = PeriodicExportingMetricReader(metric_exporter)
                self.meter_provider = MeterProvider(metric_readers=[metric_reader])
                metrics.set_meter_provider(self.meter_provider)

            # Setup trace provider
            if self.enable_traces:
                if self.endpoint:
                    trace_exporter = OTLPSpanExporter(endpoint=self.endpoint)
                else:
                    trace_exporter = ConsoleSpanExporter()

                span_processor = BatchSpanProcessor(trace_exporter)
                self.tracer_provider = TracerProvider()
                self.tracer_provider.add_span_processor(span_processor)
                trace.set_tracer_provider(self.tracer_provider)

            self.initialized = True
            logger.info("OpenTelemetry providers initialized", endpoint=self.endpoint)

        except Exception as e:
            logger.error("Failed to setup OpenTelemetry providers", error=str(e))
            self.initialized = False

    def _setup_metrics(self) -> None:
        """Setup metrics instruments"""
        if not self.enable_metrics or not self.initialized:
            return

        try:
            self.meter = metrics.get_meter(self.service_name)

            # Create metrics for different performance aspects
            self.request_counter = self.meter.create_counter(
                "promptops_requests_total",
                description="Total number of requests"
            )

            self.request_duration = self.meter.create_histogram(
                "promptops_request_duration_seconds",
                description="Request duration in seconds",
                unit="s"
            )

            self.cache_hits = self.meter.create_counter(
                "promptops_cache_hits_total",
                description="Total cache hits"
            )

            self.cache_misses = self.meter.create_counter(
                "promptops_cache_misses_total",
                description="Total cache misses"
            )

            self.error_counter = self.meter.create_counter(
                "promptops_errors_total",
                description="Total number of errors"
            )

            self.retry_counter = self.meter.create_counter(
                "promptops_retries_total",
                description="Total number of retries"
            )

            self.active_requests = self.meter.create_up_down_counter(
                "promptops_active_requests",
                description="Number of active requests"
            )

            self.memory_usage = self.meter.create_histogram(
                "promptops_memory_usage_bytes",
                description="Memory usage in bytes",
                unit="By"
            )

            self.network_latency = self.meter.create_histogram(
                "promptops_network_latency_seconds",
                description="Network latency in seconds",
                unit="s"
            )

            logger.info("OpenTelemetry metrics initialized")

        except Exception as e:
            logger.error("Failed to setup OpenTelemetry metrics", error=str(e))

    def _setup_traces(self) -> None:
        """Setup tracing"""
        if not self.enable_traces or not self.initialized:
            return

        try:
            self.tracer = trace.get_tracer(self.service_name)
            logger.info("OpenTelemetry tracing initialized")

        except Exception as e:
            logger.error("Failed to setup OpenTelemetry tracing", error=str(e))

    def record_request(self, endpoint: str, method: str, duration: float,
                      status_code: int, error: Optional[str] = None,
                      cache_hit: bool = False, retry_count: int = 0) -> None:
        """Record request metrics"""
        if not self.initialized or not self.enable_metrics:
            return

        try:
            attributes = {
                "endpoint": endpoint,
                "method": method,
                "status_code": str(status_code),
                "cache_hit": str(cache_hit).lower(),
                "retry_count": str(retry_count)
            }

            self.request_counter.add(1, attributes=attributes)
            self.request_duration.record(duration, attributes=attributes)

            if error:
                self.error_counter.add(1, attributes=attributes)

            if retry_count > 0:
                self.retry_counter.add(retry_count, attributes=attributes)

        except Exception as e:
            logger.error("Failed to record request metrics", error=str(e))

    def record_cache_operation(self, hit: bool, access_time: float) -> None:
        """Record cache operation metrics"""
        if not self.initialized or not self.enable_metrics:
            return

        try:
            attributes = {"operation": "hit" if hit else "miss"}

            if hit:
                self.cache_hits.add(1, attributes=attributes)
            else:
                self.cache_misses.add(1, attributes=attributes)

        except Exception as e:
            logger.error("Failed to record cache metrics", error=str(e))

    def record_memory_usage(self, usage_bytes: int) -> None:
        """Record memory usage metrics"""
        if not self.initialized or not self.enable_metrics:
            return

        try:
            self.memory_usage.record(usage_bytes)

        except Exception as e:
            logger.error("Failed to record memory metrics", error=str(e))

    def record_network_latency(self, latency_seconds: float) -> None:
        """Record network latency metrics"""
        if not self.initialized or not self.enable_metrics:
            return

        try:
            self.network_latency.record(latency_seconds)

        except Exception as e:
            logger.error("Failed to record network metrics", error=str(e))

    def increment_active_requests(self) -> None:
        """Increment active requests counter"""
        if not self.initialized or not self.enable_metrics:
            return

        try:
            self.active_requests.add(1)

        except Exception as e:
            logger.error("Failed to increment active requests", error=str(e))

    def decrement_active_requests(self) -> None:
        """Decrement active requests counter"""
        if not self.initialized or not self.enable_metrics:
            return

        try:
            self.active_requests.add(-1)

        except Exception as e:
            logger.error("Failed to decrement active requests", error=str(e))

    @contextmanager
    def start_span(self, name: str, attributes: Optional[Dict[str, Any]] = None) -> ContextManager[Span]:
        """Start a new span for tracing"""
        if not self.initialized or not self.enable_traces:
            yield None
            return

        try:
            span = self.tracer.start_span(name)
            if attributes:
                span.set_attributes(attributes)

            yield span

        except Exception as e:
            logger.error("Failed to start span", name=name, error=str(e))
            yield None

    def record_metric(self, metric_type: MetricType, value: float,
                     attributes: Optional[Dict[str, Any]] = None) -> None:
        """Record a custom metric"""
        if not self.initialized or not self.enable_metrics:
            return

        try:
            attr_dict = attributes or {}
            attr_dict["metric_type"] = metric_type.value

            # Map metric types to appropriate instruments
            if metric_type in [MetricType.REQUEST_LATENCY, MetricType.NETWORK_LATENCY, MetricType.MEMORY_USAGE]:
                self.request_duration.record(value, attributes=attr_dict)
            elif metric_type in [MetricType.ERROR_RATE, MetricType.CACHE_HIT_RATE]:
                self.request_counter.add(value, attributes=attr_dict)
            else:
                # Use histogram for most numeric metrics
                self.request_duration.record(value, attributes=attr_dict)

        except Exception as e:
            logger.error("Failed to record metric", metric_type=metric_type, error=str(e))

    def shutdown(self) -> None:
        """Shutdown OpenTelemetry integration"""
        if not self.initialized:
            return

        try:
            if hasattr(self, 'meter_provider'):
                self.meter_provider.shutdown()

            if hasattr(self, 'tracer_provider'):
                self.tracer_provider.shutdown()

            logger.info("OpenTelemetry integration shutdown")

        except Exception as e:
            logger.error("Failed to shutdown OpenTelemetry integration", error=str(e))

    def is_available(self) -> bool:
        """Check if OpenTelemetry is available"""
        return OPENTELEMETRY_AVAILABLE and self.initialized

    def get_status(self) -> Dict[str, Any]:
        """Get OpenTelemetry integration status"""
        return {
            "available": OPENTELEMETRY_AVAILABLE,
            "initialized": self.initialized,
            "service_name": self.service_name,
            "endpoint": self.endpoint,
            "metrics_enabled": self.enable_metrics,
            "traces_enabled": self.enable_traces
        }


# Global instance
_global_otel_integration: Optional[OpenTelemetryIntegration] = None


def get_opentelemetry_integration() -> Optional[OpenTelemetryIntegration]:
    """Get the global OpenTelemetry integration instance"""
    return _global_otel_integration


def initialize_opentelemetry(service_name: str = "promptops-client",
                          endpoint: Optional[str] = None,
                          enable_metrics: bool = True,
                          enable_traces: bool = True) -> Optional[OpenTelemetryIntegration]:
    """
    Initialize global OpenTelemetry integration

    Args:
        service_name: Name of the service
        endpoint: OTLP endpoint for exporting telemetry
        enable_metrics: Whether to enable metrics collection
        enable_traces: Whether to enable tracing

    Returns:
        OpenTelemetryIntegration instance or None if unavailable
    """
    global _global_otel_integration

    if not OPENTELEMETRY_AVAILABLE:
        logger.warning("OpenTelemetry not available, cannot initialize")
        return None

    _global_otel_integration = OpenTelemetryIntegration(
        service_name=service_name,
        endpoint=endpoint,
        enable_metrics=enable_metrics,
        enable_traces=enable_traces
    )

    return _global_otel_integration


def record_performance_metric(metric_type: MetricType, value: float,
                            attributes: Optional[Dict[str, Any]] = None) -> None:
    """Record a performance metric using the global OpenTelemetry integration"""
    integration = get_opentelemetry_integration()
    if integration:
        integration.record_metric(metric_type, value, attributes)


def shutdown_opentelemetry() -> None:
    """Shutdown global OpenTelemetry integration"""
    global _global_otel_integration
    if _global_otel_integration:
        _global_otel_integration.shutdown()
        _global_otel_integration = None