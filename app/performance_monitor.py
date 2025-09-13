"""
Performance monitoring and metrics collection for PromptOps
"""

import asyncio
import psutil
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from sqlalchemy.orm import Session
from sqlalchemy import text, func
from sqlalchemy.pool import QueuePool
import structlog

from app.database import engine
from app.analytics_models import PerformanceMetrics, AggregationPeriod

logger = structlog.get_logger(__name__)

class PerformanceMonitor:
    """
    Performance monitoring service for collecting system and application metrics
    """

    def __init__(self):
        self.running = False
        self.collection_interval = 60  # seconds
        self.tasks = {}

    async def start(self):
        """Start performance monitoring"""
        if self.running:
            logger.warning("Performance monitor already running")
            return

        self.running = True
        logger.info("Starting performance monitor")

        # Start monitoring tasks
        self.tasks["system_metrics"] = asyncio.create_task(
            self._collect_system_metrics_loop()
        )
        self.tasks["database_metrics"] = asyncio.create_task(
            self._collect_database_metrics_loop()
        )
        self.tasks["application_metrics"] = asyncio.create_task(
            self._collect_application_metrics_loop()
        )

    async def stop(self):
        """Stop performance monitoring"""
        if not self.running:
            return

        logger.info("Stopping performance monitor")
        self.running = False

        # Cancel all tasks
        for task_name, task in self.tasks.items():
            if not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    logger.info(f"Performance monitoring task {task_name} cancelled")

        self.tasks.clear()

    async def _collect_system_metrics_loop(self):
        """Collect system metrics periodically"""
        while self.running:
            try:
                await asyncio.sleep(self.collection_interval)

                if not self.running:
                    break

                # Collect system metrics
                metrics = self._collect_system_metrics()

                # Store metrics in database
                await self._store_metrics(metrics, AggregationPeriod.HOURLY)

            except Exception as e:
                logger.error("System metrics collection failed", error=str(e))
                # Continue running even if one collection fails

    async def _collect_database_metrics_loop(self):
        """Collect database metrics periodically"""
        while self.running:
            try:
                await asyncio.sleep(self.collection_interval * 2)  # Collect less frequently

                if not self.running:
                    break

                # Collect database metrics
                metrics = self._collect_database_metrics()

                # Store metrics in database
                await self._store_metrics(metrics, AggregationPeriod.HOURLY)

            except Exception as e:
                logger.error("Database metrics collection failed", error=str(e))
                # Continue running even if one collection fails

    async def _collect_application_metrics_loop(self):
        """Collect application metrics periodically"""
        while self.running:
            try:
                await asyncio.sleep(self.collection_interval)

                if not self.running:
                    break

                # Collect application metrics
                metrics = self._collect_application_metrics()

                # Store metrics in database
                await self._store_metrics(metrics, AggregationPeriod.HOURLY)

            except Exception as e:
                logger.error("Application metrics collection failed", error=str(e))
                # Continue running even if one collection fails

    def _collect_system_metrics(self) -> Dict[str, Any]:
        """Collect system-level metrics"""
        try:
            # CPU metrics
            cpu_percent = psutil.cpu_percent(interval=1)
            cpu_count = psutil.cpu_count()
            load_avg = psutil.getloadavg()

            # Memory metrics
            memory = psutil.virtual_memory()
            memory_percent = memory.percent
            memory_used = memory.used
            memory_total = memory.total

            # Disk metrics
            disk = psutil.disk_usage('/')
            disk_percent = disk.percent
            disk_used = disk.used
            disk_total = disk.total

            # Network metrics
            network = psutil.net_io_counters()
            bandwidth_in = network.bytes_recv
            bandwidth_out = network.bytes_sent

            return {
                'cpu_usage_percent': cpu_percent,
                'cpu_count': cpu_count,
                'load_avg_1min': load_avg[0],
                'load_avg_5min': load_avg[1],
                'load_avg_15min': load_avg[2],
                'memory_usage_percent': memory_percent,
                'memory_used_bytes': memory_used,
                'memory_total_bytes': memory_total,
                'disk_usage_percent': disk_percent,
                'disk_used_bytes': disk_used,
                'disk_total_bytes': disk_total,
                'bandwidth_in_bytes': bandwidth_in,
                'bandwidth_out_bytes': bandwidth_out
            }

        except Exception as e:
            logger.error("Failed to collect system metrics", error=str(e))
            return {}

    def _collect_database_metrics(self) -> Dict[str, Any]:
        """Collect database metrics"""
        try:
            metrics = {}

            # Get connection pool info
            if isinstance(engine.pool, QueuePool):
                pool = engine.pool
                metrics['database_connections'] = pool.checkedout()
                metrics['database_pool_size'] = pool.size()
                metrics['database_pool_overflow'] = pool.overflow()
                metrics['database_pool_checked_in'] = pool.checkedin()
            else:
                metrics['database_connections'] = 0

            # Collect database-specific metrics
            with engine.connect() as conn:
                # Get database size (PostgreSQL specific)
                try:
                    result = conn.execute(text("""
                        SELECT pg_database_size(current_database()) as size
                    """))
                    db_size = result.fetchone()
                    if db_size:
                        metrics['database_size_bytes'] = db_size[0]
                except:
                    pass

                # Get table sizes
                try:
                    result = conn.execute(text("""
                        SELECT
                            schemaname,
                            tablename,
                            pg_total_relation_size(schemaname||'.'||tablename) as size
                        FROM pg_tables
                        WHERE schemaname = 'public'
                        ORDER BY size DESC
                        LIMIT 10
                    """))
                    table_sizes = {}
                    for row in result:
                        table_sizes[f"{row[0]}.{row[1]}"] = row[2]
                    metrics['table_sizes'] = table_sizes
                except:
                    pass

                # Get query performance metrics
                try:
                    result = conn.execute(text("""
                        SELECT COUNT(*) as slow_queries
                        FROM pg_stat_statements
                        WHERE mean_exec_time > 1000  -- queries slower than 1 second
                    """))
                    slow_queries = result.fetchone()
                    if slow_queries:
                        metrics['slow_query_count'] = slow_queries[0]
                except:
                    pass

                # Get average query time
                try:
                    result = conn.execute(text("""
                        SELECT AVG(mean_exec_time) as avg_query_time
                        FROM pg_stat_statements
                        WHERE calls > 0
                    """))
                    avg_time = result.fetchone()
                    if avg_time and avg_time[0]:
                        metrics['average_query_time_ms'] = avg_time[0]
                except:
                    pass

            return metrics

        except Exception as e:
            logger.error("Failed to collect database metrics", error=str(e))
            return {}

    def _collect_application_metrics(self) -> Dict[str, Any]:
        """Collect application-level metrics"""
        try:
            metrics = {}

            # This would be populated by actual application metrics
            # For now, we'll collect some basic metrics

            # Process information
            process = psutil.Process()
            metrics['process_cpu_percent'] = process.cpu_percent()
            metrics['process_memory_percent'] = process.memory_percent()
            metrics['process_memory_used'] = process.memory_info().rss

            # Thread count
            metrics['thread_count'] = process.num_threads()

            # File descriptors
            try:
                metrics['file_descriptors'] = process.num_fds()
            except:
                metrics['file_descriptors'] = 0

            # Open files
            try:
                metrics['open_files'] = len(process.open_files())
            except:
                metrics['open_files'] = 0

            # Network connections
            try:
                metrics['network_connections'] = len(process.connections())
            except:
                metrics['network_connections'] = 0

            # Uptime
            metrics['process_uptime_seconds'] = time.time() - process.create_time()

            return metrics

        except Exception as e:
            logger.error("Failed to collect application metrics", error=str(e))
            return {}

    async def _store_metrics(self, metrics: Dict[str, Any], period: AggregationPeriod):
        """Store collected metrics in database"""
        if not metrics:
            return

        try:
            from app.database import get_db

            with next(get_db()) as db:
                performance_metric = PerformanceMetrics(
                    timestamp=datetime.utcnow(),
                    period=period,
                    cpu_usage_percent=metrics.get('cpu_usage_percent'),
                    memory_usage_percent=metrics.get('memory_usage_percent'),
                    disk_usage_percent=metrics.get('disk_usage_percent'),
                    database_connections=metrics.get('database_connections'),
                    redis_memory_usage=metrics.get('redis_memory_usage'),
                    redis_key_count=metrics.get('redis_key_count'),
                    table_sizes=metrics.get('table_sizes'),
                    slow_query_count=metrics.get('slow_query_count'),
                    average_query_time=metrics.get('average_query_time_ms'),
                    active_requests=metrics.get('active_requests'),
                    queue_size=metrics.get('queue_size'),
                    average_response_time=metrics.get('average_response_time'),
                    error_rate=metrics.get('error_rate'),
                    request_rate_per_second=metrics.get('request_rate_per_second'),
                    bandwidth_in_bytes=metrics.get('bandwidth_in_bytes'),
                    bandwidth_out_bytes=metrics.get('bandwidth_out_bytes')
                )

                db.add(performance_metric)
                db.commit()

                logger.debug("Performance metrics stored", metrics_count=len(metrics))

        except Exception as e:
            logger.error("Failed to store performance metrics", error=str(e))

    def get_system_health(self) -> Dict[str, Any]:
        """Get current system health status"""
        try:
            system_metrics = self._collect_system_metrics()
            db_metrics = self._collect_database_metrics()
            app_metrics = self._collect_application_metrics()

            # Calculate health score (0-100)
            health_score = 100

            # CPU health (penalize if > 80%)
            cpu_usage = system_metrics.get('cpu_usage_percent', 0)
            if cpu_usage > 90:
                health_score -= 30
            elif cpu_usage > 80:
                health_score -= 15
            elif cpu_usage > 70:
                health_score -= 5

            # Memory health (penalize if > 85%)
            memory_usage = system_metrics.get('memory_usage_percent', 0)
            if memory_usage > 95:
                health_score -= 30
            elif memory_usage > 85:
                health_score -= 15
            elif memory_usage > 75:
                health_score -= 5

            # Disk health (penalize if > 90%)
            disk_usage = system_metrics.get('disk_usage_percent', 0)
            if disk_usage > 95:
                health_score -= 20
            elif disk_usage > 90:
                health_score -= 10

            # Database health (penalize if many slow queries)
            slow_queries = db_metrics.get('slow_query_count', 0)
            if slow_queries > 10:
                health_score -= 15
            elif slow_queries > 5:
                health_score -= 5

            health_score = max(0, health_score)

            # Determine health status
            if health_score >= 90:
                health_status = "healthy"
            elif health_score >= 70:
                health_status = "degraded"
            elif health_score >= 50:
                health_status = "warning"
            else:
                health_status = "critical"

            return {
                'health_score': health_score,
                'health_status': health_status,
                'timestamp': datetime.utcnow().isoformat(),
                'system_metrics': system_metrics,
                'database_metrics': db_metrics,
                'application_metrics': app_metrics,
                'recommendations': self._generate_health_recommendations(
                    system_metrics, db_metrics, app_metrics
                )
            }

        except Exception as e:
            logger.error("Failed to get system health", error=str(e))
            return {
                'health_score': 0,
                'health_status': 'error',
                'timestamp': datetime.utcnow().isoformat(),
                'error': str(e)
            }

    def _generate_health_recommendations(
        self,
        system_metrics: Dict[str, Any],
        db_metrics: Dict[str, Any],
        app_metrics: Dict[str, Any]
    ) -> List[str]:
        """Generate health recommendations based on metrics"""
        recommendations = []

        # CPU recommendations
        cpu_usage = system_metrics.get('cpu_usage_percent', 0)
        if cpu_usage > 90:
            recommendations.append("Critical: CPU usage is extremely high (>90%). Consider scaling up or optimizing workloads.")
        elif cpu_usage > 80:
            recommendations.append("Warning: CPU usage is high (>80%). Monitor closely and consider optimization.")

        # Memory recommendations
        memory_usage = system_metrics.get('memory_usage_percent', 0)
        if memory_usage > 95:
            recommendations.append("Critical: Memory usage is extremely high (>95%). Add more memory or reduce memory usage.")
        elif memory_usage > 85:
            recommendations.append("Warning: Memory usage is high (>85%). Monitor memory usage closely.")

        # Disk recommendations
        disk_usage = system_metrics.get('disk_usage_percent', 0)
        if disk_usage > 95:
            recommendations.append("Critical: Disk space is almost full (>95%). Clean up disk space immediately.")
        elif disk_usage > 90:
            recommendations.append("Warning: Disk space is getting low (>90%). Plan for disk cleanup or expansion.")

        # Database recommendations
        slow_queries = db_metrics.get('slow_query_count', 0)
        if slow_queries > 10:
            recommendations.append("Warning: Many slow queries detected. Consider optimizing database queries or adding indexes.")
        elif slow_queries > 5:
            recommendations.append("Info: Some slow queries detected. Review query performance.")

        # Database connection recommendations
        db_connections = db_metrics.get('database_connections', 0)
        if db_connections > 80:
            recommendations.append("Warning: High database connection count. Consider connection pooling optimization.")

        return recommendations

# Global monitor instance
_monitor: Optional[PerformanceMonitor] = None

def get_performance_monitor() -> PerformanceMonitor:
    """Get the global performance monitor instance"""
    global _monitor
    if _monitor is None:
        _monitor = PerformanceMonitor()
    return _monitor

async def start_performance_monitoring():
    """Start performance monitoring"""
    monitor = get_performance_monitor()
    await monitor.start()

async def stop_performance_monitoring():
    """Stop performance monitoring"""
    global _monitor
    if _monitor:
        await _monitor.stop()
        _monitor = None