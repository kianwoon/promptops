"""
Performance dashboard and analytics components for real-time monitoring
"""

import asyncio
import json
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Callable, Union
from dataclasses import asdict
from enum import Enum
import logging
import statistics
from pathlib import Path
import threading
from concurrent.futures import ThreadPoolExecutor

import structlog

from .models import (
    MetricType,
    PerformanceSnapshot,
    PerformanceAlert,
    OptimizationRecommendation,
    AlertSeverity,
    OptimizationStrategy
)
from .monitor import PerformanceMonitor
from .adaptive_retry import AdaptiveRetryManager
from .connection_pool import ConnectionPool
from .smart_cache import SmartCacheManager

logger = structlog.get_logger(__name__)


class DashboardType(Enum):
    """Types of dashboards"""
    OVERVIEW = "overview"
    REQUESTS = "requests"
    CACHE = "cache"
    NETWORK = "network"
    MEMORY = "memory"
    ALERTS = "alerts"
    OPTIMIZATIONS = "optimizations"


class ChartType(Enum):
    """Types of charts"""
    LINE = "line"
    BAR = "bar"
    PIE = "pie"
    GAUGE = "gauge"
    HEATMAP = "heatmap"
    SCATTER = "scatter"
    AREA = "area"


@dataclass
class DashboardWidget:
    """Dashboard widget configuration"""
    id: str
    title: str
    type: ChartType
    metric_type: MetricType
    width: int = 6  # Bootstrap grid width (1-12)
    height: int = 300
    refresh_interval: int = 30  # seconds
    options: Dict[str, Any] = None

    def __post_init__(self):
        if self.options is None:
            self.options = {}


@dataclass
class DashboardConfig:
    """Dashboard configuration"""
    title: str
    description: str
    type: DashboardType
    widgets: List[DashboardWidget]
    refresh_interval: int = 30
    max_data_points: int = 100
    enable_export: bool = True
    enable_real_time: bool = True


class PerformanceDashboard:
    """Performance dashboard for real-time monitoring and analytics"""

    def __init__(self,
                 performance_monitor: PerformanceMonitor,
                 retry_manager: Optional[AdaptiveRetryManager] = None,
                 connection_pool: Optional[ConnectionPool] = None,
                 cache_manager: Optional[SmartCacheManager] = None):
        self.performance_monitor = performance_monitor
        self.retry_manager = retry_manager
        self.connection_pool = connection_pool
        self.cache_manager = cache_manager

        # Dashboard configurations
        self.dashboards: Dict[DashboardType, DashboardConfig] = {}
        self._setup_default_dashboards()

        # Real-time updates
        self._subscribers: List[Callable[[Dict[str, Any]], None]] = []
        self._update_task: Optional[asyncio.Task] = None
        self._running = False

        # Data storage
        self.historical_data: Dict[MetricType, List[Dict[str, Any]]] = {}
        self.alert_history: List[Dict[str, Any]] = []
        self.recommendation_history: List[Dict[str, Any]] = []

        # Web server (optional, for HTTP dashboard)
        self.web_server: Optional[Any] = None

    def _setup_default_dashboards(self) -> None:
        """Setup default dashboard configurations"""

        # Overview dashboard
        self.dashboards[DashboardType.OVERVIEW] = DashboardConfig(
            title="Performance Overview",
            description="High-level performance metrics and system health",
            type=DashboardType.OVERVIEW,
            widgets=[
                DashboardWidget(
                    id="requests_per_minute",
                    title="Requests per Minute",
                    type=ChartType.LINE,
                    metric_type=MetricType.THROUGHPUT,
                    width=6,
                    options={"yAxis": {"title": "Requests/Min"}}
                ),
                DashboardWidget(
                    id="avg_response_time",
                    title="Average Response Time",
                    type=ChartType.LINE,
                    metric_type=MetricType.REQUEST_LATENCY,
                    width=6,
                    options={"yAxis": {"title": "Seconds"}}
                ),
                DashboardWidget(
                    id="cache_hit_rate",
                    title="Cache Hit Rate",
                    type=ChartType.GAUGE,
                    metric_type=MetricType.CACHE_HIT_RATE,
                    width=4,
                    options={"min": 0, "max": 1, "threshold": 0.8}
                ),
                DashboardWidget(
                    id="error_rate",
                    title="Error Rate",
                    type=ChartType.GAUGE,
                    metric_type=MetricType.ERROR_RATE,
                    width=4,
                    options={"min": 0, "max": 0.2, "threshold": 0.05}
                ),
                DashboardWidget(
                    id="memory_usage",
                    title="Memory Usage",
                    type=ChartType.LINE,
                    metric_type=MetricType.MEMORY_USAGE,
                    width=4,
                    options={"yAxis": {"title": "MB"}}
                )
            ]
        )

        # Requests dashboard
        self.dashboards[DashboardType.REQUESTS] = DashboardConfig(
            title="Request Analytics",
            description="Detailed request performance metrics",
            type=DashboardType.REQUESTS,
            widgets=[
                DashboardWidget(
                    id="request_latency_distribution",
                    title="Request Latency Distribution",
                    type=ChartType.BAR,
                    metric_type=MetricType.REQUEST_LATENCY,
                    width=12,
                    options={"bins": 20}
                ),
                DashboardWidget(
                    id="endpoint_performance",
                    title="Endpoint Performance",
                    type=ChartType.BAR,
                    metric_type=MetricType.REQUEST_LATENCY,
                    width=12,
                    options={"groupBy": "endpoint"}
                ),
                DashboardWidget(
                    id="retry_patterns",
                    title="Retry Patterns",
                    type=ChartType.LINE,
                    metric_type=MetricType.RETRY_COUNT,
                    width=6,
                    options={"yAxis": {"title": "Retry Count"}}
                ),
                DashboardWidget(
                    id="status_codes",
                    title="HTTP Status Codes",
                    type=ChartType.PIE,
                    metric_type=MetricType.THROUGHPUT,
                    width=6
                )
            ]
        )

        # Cache dashboard
        self.dashboards[DashboardType.CACHE] = DashboardConfig(
            title="Cache Analytics",
            description="Cache performance and hit/miss analysis",
            type=DashboardType.CACHE,
            widgets=[
                DashboardWidget(
                    id="cache_hit_rate_trend",
                    title="Cache Hit Rate Trend",
                    type=ChartType.LINE,
                    metric_type=MetricType.CACHE_HIT_RATE,
                    width=8,
                    options={"yAxis": {"title": "Hit Rate", "min": 0, "max": 1}}
                ),
                DashboardWidget(
                    id="cache_size",
                    title="Cache Size",
                    type=ChartType.LINE,
                    metric_type=MetricType.MEMORY_USAGE,
                    width=4,
                    options={"yAxis": {"title": "Items"}}
                ),
                DashboardWidget(
                    id="cache_access_patterns",
                    title="Cache Access Patterns",
                    type=ChartType.HEATMAP,
                    metric_type=MetricType.THROUGHPUT,
                    width=12
                )
            ]
        )

        # Alerts dashboard
        self.dashboards[DashboardType.ALERTS] = DashboardConfig(
            title="Alerts & Notifications",
            description="Performance alerts and system notifications",
            type=DashboardType.ALERTS,
            widgets=[
                DashboardWidget(
                    id="active_alerts",
                    title="Active Alerts",
                    type=ChartType.BAR,
                    metric_type=MetricType.ERROR_RATE,
                    width=12,
                    options={"groupBy": "severity"}
                ),
                DashboardWidget(
                    id="alert_history",
                    title="Alert History",
                    type=ChartType.LINE,
                    metric_type=MetricType.ERROR_RATE,
                    width=12,
                    options={"yAxis": {"title": "Alert Count"}}
                )
            ]
        )

    async def start(self) -> None:
        """Start the dashboard system"""
        if self._running:
            return

        self._running = True
        logger.info("Starting performance dashboard")

        # Start real-time updates
        self._update_task = asyncio.create_task(self._update_loop())

        # Setup alert callbacks
        self.performance_monitor.add_alert_callback(self._handle_alert)
        self.performance_monitor.add_recommendation_callback(self._handle_recommendation)

    async def stop(self) -> None:
        """Stop the dashboard system"""
        if not self._running:
            return

        self._running = False
        logger.info("Stopping performance dashboard")

        if self._update_task:
            self._update_task.cancel()

        # Stop web server if running
        if self.web_server:
            await self._stop_web_server()

    async def _update_loop(self) -> None:
        """Background update loop for real-time data"""
        while self._running:
            try:
                await self._update_dashboards()
                await asyncio.sleep(30)  # Update every 30 seconds
            except Exception as e:
                logger.error("Error in dashboard update loop", error=str(e))
                await asyncio.sleep(60)

    async def _update_dashboards(self) -> None:
        """Update all dashboards with current data"""
        # Get current performance snapshot
        snapshot = self.performance_monitor.get_performance_snapshot()

        # Update historical data
        await self._update_historical_data(snapshot)

        # Notify subscribers
        update_data = {
            "timestamp": snapshot.timestamp.isoformat(),
            "snapshot": asdict(snapshot),
            "dashboards": self._get_dashboard_data()
        }

        for subscriber in self._subscribers:
            try:
                subscriber(update_data)
            except Exception as e:
                logger.error("Error notifying dashboard subscriber", error=str(e))

    async def _update_historical_data(self, snapshot: PerformanceSnapshot) -> None:
        """Update historical data storage"""
        timestamp = snapshot.timestamp

        # Store request metrics
        if snapshot.request_metrics:
            total_requests = len(snapshot.request_metrics)
            if total_requests > 0:
                self._add_historical_point(
                    MetricType.THROUGHPUT,
                    timestamp,
                    total_requests,
                    {"type": "total_requests"}
                )

        # Store cache metrics
        self._add_historical_point(
            MetricType.CACHE_HIT_RATE,
            timestamp,
            snapshot.cache_metrics.hit_rate
        )

        # Store memory metrics
        self._add_historical_point(
            MetricType.MEMORY_USAGE,
            timestamp,
            snapshot.memory_metrics.rss_bytes / (1024 * 1024),  # MB
            {"type": "rss"}
        )

        # Calculate and store error rate
        if snapshot.request_metrics:
            error_count = sum(1 for req in snapshot.request_metrics.values()
                           if req.error or (req.statusCode and req.statusCode >= 400))
            error_rate = error_count / len(snapshot.request_metrics) if snapshot.request_metrics else 0
            self._add_historical_point(
                MetricType.ERROR_RATE,
                timestamp,
                error_rate
            )

    def _add_historical_point(self, metric_type: MetricType, timestamp: datetime,
                             value: float, tags: Optional[Dict[str, str]] = None) -> None:
        """Add a point to historical data"""
        if metric_type not in self.historical_data:
            self.historical_data[metric_type] = []

        point = {
            "timestamp": timestamp.isoformat(),
            "value": value,
            "tags": tags or {}
        }

        self.historical_data[metric_type].append(point)

        # Limit data points
        max_points = 1000
        if len(self.historical_data[metric_type]) > max_points:
            self.historical_data[metric_type] = self.historical_data[metric_type][-max_points:]

    def _get_dashboard_data(self) -> Dict[str, Any]:
        """Get current dashboard data for all dashboards"""
        dashboard_data = {}

        for dashboard_type, config in self.dashboards.items():
            widgets_data = {}

            for widget in config.widgets:
                widgets_data[widget.id] = self._get_widget_data(widget)

            dashboard_data[dashboard_type.value] = {
                "title": config.title,
                "description": config.description,
                "widgets": widgets_data
            }

        return dashboard_data

    def _get_widget_data(self, widget: DashboardWidget) -> Dict[str, Any]:
        """Get data for a specific widget"""
        # Get time series data for the widget's metric type
        time_series_data = self.performance_monitor.get_time_series_data(
            widget.metric_type,
            window_hours=1
        )

        # Convert to chart data format
        chart_data = {
            "labels": [point.timestamp for point in time_series_data],
            "data": [point.value for point in time_series_data]
        }

        # Add additional widget-specific data
        if widget.type == ChartType.GAUGE:
            current_value = chart_data["data"][-1] if chart_data["data"] else 0
            chart_data["current"] = current_value
            chart_data["target"] = widget.options.get("threshold", 0.8)

        return {
            "type": widget.type.value,
            "data": chart_data,
            "options": widget.options
        }

    def _handle_alert(self, alert: PerformanceAlert) -> None:
        """Handle performance alerts"""
        alert_data = {
            "id": alert.id,
            "metric_type": alert.metric_type.value,
            "severity": alert.severity.value,
            "message": alert.message,
            "timestamp": datetime.utcnow().isoformat(),
            "condition": alert.condition,
            "threshold": alert.threshold
        }

        self.alert_history.append(alert_data)

        # Keep only recent alerts
        if len(self.alert_history) > 1000:
            self.alert_history = self.alert_history[-1000:]

        # Notify subscribers
        update_data = {
            "type": "alert",
            "data": alert_data
        }

        for subscriber in self._subscribers:
            try:
                subscriber(update_data)
            except Exception as e:
                logger.error("Error notifying subscriber of alert", error=str(e))

    def _handle_recommendation(self, recommendation: OptimizationRecommendation) -> None:
        """Handle optimization recommendations"""
        rec_data = {
            "strategy": recommendation.strategy.value,
            "title": recommendation.title,
            "description": recommendation.description,
            "impact": recommendation.impact,
            "effort": recommendation.effort,
            "confidence": recommendation.confidence,
            "timestamp": datetime.utcnow().isoformat()
        }

        self.recommendation_history.append(rec_data)

        # Keep only recent recommendations
        if len(self.recommendation_history) > 500:
            self.recommendation_history = self.recommendation_history[-500:]

        # Notify subscribers
        update_data = {
            "type": "recommendation",
            "data": rec_data
        }

        for subscriber in self._subscribers:
            try:
                subscriber(update_data)
            except Exception as e:
                logger.error("Error notifying subscriber of recommendation", error=str(e))

    def subscribe(self, callback: Callable[[Dict[str, Any]], None]) -> None:
        """Subscribe to real-time dashboard updates"""
        self._subscribers.append(callback)

    def unsubscribe(self, callback: Callable[[Dict[str, Any]], None]) -> None:
        """Unsubscribe from dashboard updates"""
        if callback in self._subscribers:
            self._subscribers.remove(callback)

    def get_dashboard_config(self, dashboard_type: DashboardType) -> Optional[DashboardConfig]:
        """Get configuration for a specific dashboard"""
        return self.dashboards.get(dashboard_type)

    def get_all_dashboard_configs(self) -> Dict[str, DashboardConfig]:
        """Get all dashboard configurations"""
        return {dtype.value: config for dtype, config in self.dashboards.items()}

    def get_historical_data(self, metric_type: MetricType,
                          start_time: Optional[datetime] = None,
                          end_time: Optional[datetime] = None) -> List[Dict[str, Any]]:
        """Get historical data for a metric type"""
        if metric_type not in self.historical_data:
            return []

        data = self.historical_data[metric_type]

        # Filter by time range
        if start_time or end_time:
            filtered_data = []
            for point in data:
                point_time = datetime.fromisoformat(point["timestamp"])
                if start_time and point_time < start_time:
                    continue
                if end_time and point_time > end_time:
                    continue
                filtered_data.append(point)
            return filtered_data

        return data

    def get_summary_statistics(self, window_hours: int = 1) -> Dict[str, Any]:
        """Get summary statistics for all metrics"""
        stats = {}

        for metric_type in MetricType:
            time_series_data = self.performance_monitor.get_time_series_data(
                metric_type,
                window_hours=window_hours
            )

            if time_series_data:
                values = [point.value for point in time_series_data]
                stats[metric_type.value] = {
                    "min": min(values),
                    "max": max(values),
                    "mean": statistics.mean(values),
                    "median": statistics.median(values),
                    "count": len(values)
                }

        return stats

    def export_dashboard_data(self, format: str = "json",
                             dashboard_type: Optional[DashboardType] = None) -> str:
        """Export dashboard data in specified format"""
        data = {
            "timestamp": datetime.utcnow().isoformat(),
            "dashboards": self._get_dashboard_data(),
            "summary": self.get_summary_statistics(),
            "alerts": self.alert_history[-100:],  # Last 100 alerts
            "recommendations": self.recommendation_history[-50]  # Last 50 recommendations
        }

        if dashboard_type:
            config = self.dashboards.get(dashboard_type)
            if config:
                data["dashboards"] = {
                    dashboard_type.value: {
                        "title": config.title,
                        "description": config.description,
                        "widgets": self._get_dashboard_data()[dashboard_type.value]["widgets"]
                    }
                }

        if format.lower() == "json":
            return json.dumps(data, indent=2)
        elif format.lower() == "csv":
            return self._export_to_csv(data)
        else:
            raise ValueError(f"Unsupported export format: {format}")

    def _export_to_csv(self, data: Dict[str, Any]) -> str:
        """Export data to CSV format"""
        # This is a simplified CSV export
        # In a real implementation, you'd want more sophisticated CSV generation
        lines = ["timestamp,metric_type,value"]

        for metric_type, points in self.historical_data.items():
            for point in points:
                lines.append(f"{point['timestamp']},{metric_type.value},{point['value']}")

        return "\n".join(lines)

    def generate_report(self, report_type: str = "summary") -> Dict[str, Any]:
        """Generate performance report"""
        snapshot = self.performance_monitor.get_performance_snapshot()
        summary_stats = self.get_summary_statistics()

        report = {
            "generated_at": datetime.utcnow().isoformat(),
            "report_type": report_type,
            "summary": {
                "total_requests": len(snapshot.request_metrics),
                "cache_hit_rate": snapshot.cache_metrics.hit_rate,
                "memory_usage_mb": snapshot.memory_metrics.rss_bytes / (1024 * 1024),
                "active_alerts": len([a for a in snapshot.alerts if a.enabled]),
                "recommendations": len(snapshot.recommendations)
            },
            "statistics": summary_stats,
            "alerts": [{"id": a.id, "severity": a.severity.value, "message": a.message}
                      for a in snapshot.alerts if a.enabled],
            "recommendations": [{"title": r.title, "impact": r.impact, "confidence": r.confidence}
                               for r in snapshot.recommendations]
        }

        if report_type == "detailed":
            report["dashboard_data"] = self._get_dashboard_data()
            report["historical_data"] = {
                metric_type.value: points[-100:]  # Last 100 points
                for metric_type, points in self.historical_data.items()
            }

        return report

    async def start_web_server(self, host: str = "localhost", port: int = 8080) -> None:
        """Start web server for dashboard access"""
        try:
            # Import web framework (you can replace with your preferred framework)
            from fastapi import FastAPI, WebSocket
            from fastapi.responses import HTMLResponse, JSONResponse
            import uvicorn

            app = FastAPI(title="PromptOps Performance Dashboard")

            @app.get("/")
            async def get_dashboard():
                """Main dashboard page"""
                html_content = self._generate_dashboard_html()
                return HTMLResponse(content=html_content)

            @app.get("/api/dashboard/{dashboard_type}")
            async def get_dashboard_data(dashboard_type: str):
                """Get dashboard data via API"""
                try:
                    dtype = DashboardType(dashboard_type)
                    config = self.get_dashboard_config(dtype)
                    if not config:
                        return JSONResponse({"error": "Dashboard not found"}, status_code=404)

                    return JSONResponse({
                        "config": {
                            "title": config.title,
                            "description": config.description,
                            "widgets": [
                                {
                                    "id": w.id,
                                    "title": w.title,
                                    "type": w.type.value,
                                    "width": w.width,
                                    "height": w.height
                                }
                                for w in config.widgets
                            ]
                        },
                        "data": self._get_dashboard_data().get(dashboard_type, {})
                    })
                except ValueError:
                    return JSONResponse({"error": "Invalid dashboard type"}, status_code=400)

            @app.get("/api/metrics/{metric_type}")
            async def get_metrics_data(metric_type: str, hours: int = 1):
                """Get metrics data via API"""
                try:
                    mtype = MetricType(metric_type)
                    data = self.get_historical_data(mtype)
                    return JSONResponse({"data": data})
                except ValueError:
                    return JSONResponse({"error": "Invalid metric type"}, status_code=400)

            @app.get("/api/summary")
            async def get_summary():
                """Get performance summary"""
                summary = self.get_summary_statistics()
                return JSONResponse({"summary": summary})

            @app.websocket("/ws")
            async def websocket_endpoint(websocket: WebSocket):
                """WebSocket for real-time updates"""
                await websocket.accept()

                # Subscribe to updates
                def subscriber(data):
                    asyncio.create_task(websocket.send_json(data))

                self.subscribe(subscriber)

                try:
                    while True:
                        # Keep connection alive
                        await asyncio.sleep(30)
                        await websocket.send_json({"type": "ping"})
                except Exception as e:
                    logger.error("WebSocket error", error=str(e))
                finally:
                    self.unsubscribe(subscriber)

            self.web_server = app
            config = uvicorn.Config(app, host=host, port=port)
            server = uvicorn.Server(config)

            logger.info(f"Starting web server on {host}:{port}")
            await server.serve()

        except ImportError:
            logger.error("FastAPI not available. Install with: pip install fastapi uvicorn")
        except Exception as e:
            logger.error("Failed to start web server", error=str(e))

    async def _stop_web_server(self) -> None:
        """Stop the web server"""
        # Implementation depends on the web server being used
        pass

    def _generate_dashboard_html(self) -> str:
        """Generate HTML for the dashboard"""
        # This is a basic HTML template
        # In a real implementation, you'd want a more sophisticated template system
        return """
        <!DOCTYPE html>
        <html>
        <head>
            <title>PromptOps Performance Dashboard</title>
            <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .dashboard { display: grid; grid-template-columns: repeat(12, 1fr); gap: 20px; }
                .widget { background: #f5f5f5; padding: 20px; border-radius: 8px; }
                .widget-6 { grid-column: span 6; }
                .widget-4 { grid-column: span 4; }
                .widget-12 { grid-column: span 12; }
                h1 { color: #333; margin-bottom: 30px; }
                h2 { color: #666; margin-bottom: 15px; }
                .chart-container { position: relative; height: 300px; }
            </style>
        </head>
        <body>
            <h1>PromptOps Performance Dashboard</h1>
            <div id="dashboard" class="dashboard">
                <!-- Widgets will be dynamically added here -->
            </div>
            <script>
                // Connect to WebSocket for real-time updates
                const ws = new WebSocket('ws://localhost:8080/ws');

                ws.onmessage = function(event) {
                    const data = JSON.parse(event.data);
                    if (data.type === 'dashboard_update') {
                        updateDashboard(data);
                    }
                };

                function updateDashboard(data) {
                    // Update dashboard with new data
                    console.log('Dashboard updated:', data);
                }

                // Load initial dashboard data
                fetch('/api/dashboard/overview')
                    .then(response => response.json())
                    .then(data => {
                        console.log('Dashboard data:', data);
                        // Render dashboard widgets
                    });
            </script>
        </body>
        </html>
        """