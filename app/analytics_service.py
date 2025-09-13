"""
Analytics service for PromptOps with optimized performance and aggregation
"""

import json
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, desc, asc, text
from sqlalchemy.sql import expression
import structlog

from app.analytics_models import (
    UsageAnalyticsHourly, UsageAnalyticsDaily, PerformanceMetrics,
    Alert, AlertInstance, AnalyticsExport, AnalyticsCache,
    AggregationPeriod, MetricType, AlertSeverity, AlertType
)
from app.models import ClientUsageLog, ClientApiKey
from app.database import get_db

logger = structlog.get_logger(__name__)

class AnalyticsService:
    """
    High-performance analytics service with data aggregation and caching
    """

    def __init__(self, db: Session):
        self.db = db

    def aggregate_hourly_usage(self, hour_start: datetime) -> None:
        """
        Aggregate raw usage logs into hourly analytics
        """
        hour_end = hour_start + timedelta(hours=1)

        # Get all usage logs for the hour
        logs = self.db.query(ClientUsageLog).filter(
            and_(
                ClientUsageLog.timestamp >= hour_start,
                ClientUsageLog.timestamp < hour_end
            )
        ).all()

        if not logs:
            return

        # Group by dimensions
        groups = {}
        for log in logs:
            key = (
                log.tenant_id,
                log.user_id,
                log.api_key_id,
                log.project_id,
                log.prompt_id,
                self._extract_model_provider(log.endpoint),
                self._extract_model_name(log.endpoint),
                log.endpoint,
                log.method
            )

            if key not in groups:
                groups[key] = {
                    'request_count': 0,
                    'total_tokens_requested': 0,
                    'total_tokens_used': 0,
                    'total_cost_usd': 0.0,
                    'total_response_time_ms': 0,
                    'successful_requests': 0,
                    'error_requests': 0,
                    'cache_hits': 0,
                    'cache_misses': 0,
                    'status_code_ranges': {}
                }

            group = groups[key]
            group['request_count'] += 1

            # Aggregate metrics
            if log.tokens_requested:
                group['total_tokens_requested'] += log.tokens_requested
            if log.tokens_used:
                group['total_tokens_used'] += log.tokens_used
            if log.estimated_cost_usd:
                try:
                    group['total_cost_usd'] += float(log.estimated_cost_usd)
                except (ValueError, TypeError):
                    pass
            if log.processing_time_ms:
                group['total_response_time_ms'] += log.processing_time_ms

            # Success/error tracking
            if log.status_code < 400:
                group['successful_requests'] += 1
            else:
                group['error_requests'] += 1

            # Status code ranges
            status_range = f"{log.status_code // 100}xx"
            group['status_code_ranges'][status_range] = group['status_code_ranges'].get(status_range, 0) + 1

            # Cache metrics (if available in user_agent or other fields)
            if log.user_agent and 'cache' in log.user_agent.lower():
                # This is a simplified example - in reality, cache metrics would come from specific fields
                pass

        # Insert aggregated data
        for key, metrics in groups.items():
            (tenant_id, user_id, api_key_id, project_id, prompt_id,
             model_provider, model_name, endpoint, method) = key

            hourly_analytics = UsageAnalyticsHourly(
                hour_start=hour_start,
                hour_end=hour_end,
                tenant_id=tenant_id,
                user_id=user_id,
                api_key_id=api_key_id,
                project_id=project_id,
                prompt_id=prompt_id,
                model_provider=model_provider,
                model_name=model_name,
                endpoint=endpoint,
                http_method=method,
                status_code_ranges=metrics['status_code_ranges'],
                **metrics
            )

            # Check if record already exists and update or insert
            existing = self.db.query(UsageAnalyticsHourly).filter(
                and_(
                    UsageAnalyticsHourly.hour_start == hour_start,
                    UsageAnalyticsHourly.tenant_id == tenant_id,
                    UsageAnalyticsHourly.user_id == user_id,
                    UsageAnalyticsHourly.project_id == project_id
                )
            ).first()

            if existing:
                # Update existing record
                for field in metrics:
                    if hasattr(existing, field):
                        setattr(existing, field, metrics[field])
            else:
                self.db.add(hourly_analytics)

        self.db.commit()
        logger.info("Hourly aggregation completed", hour=hour_start, records_processed=len(logs))

    def aggregate_daily_usage(self, date: datetime) -> None:
        """
        Aggregate hourly data into daily analytics for trend analysis
        """
        day_start = date.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)

        # Get hourly data for the day
        hourly_data = self.db.query(UsageAnalyticsHourly).filter(
            and_(
                UsageAnalyticsHourly.hour_start >= day_start,
                UsageAnalyticsHourly.hour_start < day_end
            )
        ).all()

        if not hourly_data:
            return

        # Group by dimensions
        groups = {}
        for hourly in hourly_data:
            key = (
                hourly.tenant_id,
                hourly.user_id,
                hourly.api_key_id,
                hourly.project_id,
                hourly.prompt_id,
                hourly.model_provider,
                hourly.model_name
            )

            if key not in groups:
                groups[key] = {
                    'request_count': 0,
                    'total_tokens_requested': 0,
                    'total_tokens_used': 0,
                    'total_cost_usd': 0.0,
                    'total_response_time_ms': 0,
                    'successful_requests': 0,
                    'error_requests': 0,
                    'cache_hits': 0,
                    'cache_misses': 0,
                    'hourly_counts': []  # For peak hour analysis
                }

            group = groups[key]
            group['request_count'] += hourly.request_count
            group['total_tokens_requested'] += hourly.total_tokens_requested
            group['total_tokens_used'] += hourly.total_tokens_used
            group['total_cost_usd'] += hourly.total_cost_usd
            group['total_response_time_ms'] += hourly.total_response_time_ms
            group['successful_requests'] += hourly.successful_requests
            group['error_requests'] += hourly.error_requests
            group['cache_hits'] += hourly.cache_hits
            group['cache_misses'] += hourly.cache_misses
            group['hourly_counts'].append((hourly.hour_start.hour, hourly.request_count))

        # Calculate derived metrics and insert
        for key, metrics in groups.items():
            (tenant_id, user_id, api_key_id, project_id, prompt_id,
             model_provider, model_name) = key

            # Calculate rates
            total_requests = metrics['request_count']
            success_rate = metrics['successful_requests'] / total_requests if total_requests > 0 else 1.0
            error_rate = metrics['error_requests'] / total_requests if total_requests > 0 else 0.0

            total_cache_requests = metrics['cache_hits'] + metrics['cache_misses']
            cache_hit_rate = metrics['cache_hits'] / total_cache_requests if total_cache_requests > 0 else 0.0

            # Calculate average response time
            avg_response_time = (metrics['total_response_time_ms'] / total_requests) if total_requests > 0 else 0.0

            # Find peak hour
            peak_hour, peak_count = max(metrics['hourly_counts'], key=lambda x: x[1], default=(None, 0))

            # Calculate growth rate vs previous day
            previous_day = day_start - timedelta(days=1)
            previous_data = self.db.query(UsageAnalyticsDaily).filter(
                and_(
                    UsageAnalyticsDaily.date == previous_day,
                    UsageAnalyticsDaily.tenant_id == tenant_id,
                    UsageAnalyticsDaily.user_id == user_id,
                    UsageAnalyticsDaily.project_id == project_id
                )
            ).first()

            growth_rate = None
            if previous_data and previous_data.request_count > 0:
                growth_rate = ((total_requests - previous_data.request_count) / previous_data.request_count) * 100

            daily_analytics = UsageAnalyticsDaily(
                date=day_start,
                tenant_id=tenant_id,
                user_id=user_id,
                api_key_id=api_key_id,
                project_id=project_id,
                prompt_id=prompt_id,
                model_provider=model_provider,
                model_name=model_name,
                request_count=total_requests,
                total_tokens_requested=metrics['total_tokens_requested'],
                total_tokens_used=metrics['total_tokens_used'],
                total_cost_usd=metrics['total_cost_usd'],
                avg_response_time_ms=avg_response_time,
                success_rate=success_rate,
                error_rate=error_rate,
                cache_hit_rate=cache_hit_rate,
                peak_hour=peak_hour,
                peak_request_count=peak_count,
                growth_rate_vs_previous=growth_rate
            )

            # Check if record already exists and update or insert
            existing = self.db.query(UsageAnalyticsDaily).filter(
                and_(
                    UsageAnalyticsDaily.date == day_start,
                    UsageAnalyticsDaily.tenant_id == tenant_id,
                    UsageAnalyticsDaily.user_id == user_id,
                    UsageAnalyticsDaily.project_id == project_id
                )
            ).first()

            if existing:
                # Update existing record
                for field in ['request_count', 'total_tokens_requested', 'total_tokens_used',
                            'total_cost_usd', 'avg_response_time_ms', 'success_rate',
                            'error_rate', 'cache_hit_rate', 'peak_hour', 'peak_request_count',
                            'growth_rate_vs_previous']:
                    if hasattr(daily_analytics, field):
                        setattr(existing, field, getattr(daily_analytics, field))
            else:
                self.db.add(daily_analytics)

        self.db.commit()
        logger.info("Daily aggregation completed", date=day_start, records_processed=len(hourly_data))

    def get_usage_statistics(
        self,
        tenant_id: str,
        start_date: datetime,
        end_date: datetime,
        group_by: str = "hour",  # "hour", "day", "week", "month"
        filters: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Get usage statistics with flexible grouping and filtering
        """
        cache_key = f"usage_stats:{tenant_id}:{start_date.isoformat()}:{end_date.isoformat()}:{group_by}:{json.dumps(filters or {})}"

        # Check cache first
        cached_result = self._get_cached_analytics(cache_key)
        if cached_result:
            return cached_result

        # Build query based on grouping
        if group_by == "hour":
            query = self.db.query(UsageAnalyticsHourly).filter(
                and_(
                    UsageAnalyticsHourly.tenant_id == tenant_id,
                    UsageAnalyticsHourly.hour_start >= start_date,
                    UsageAnalyticsHourly.hour_start < end_date
                )
            )
            time_field = UsageAnalyticsHourly.hour_start
        else:
            query = self.db.query(UsageAnalyticsDaily).filter(
                and_(
                    UsageAnalyticsDaily.tenant_id == tenant_id,
                    UsageAnalyticsDaily.date >= start_date,
                    UsageAnalyticsDaily.date < end_date
                )
            )
            time_field = UsageAnalyticsDaily.date

        # Apply filters
        if filters:
            if 'user_id' in filters:
                query = query.filter(UsageAnalyticsHourly.user_id == filters['user_id'] if group_by == "hour" else UsageAnalyticsDaily.user_id == filters['user_id'])
            if 'project_id' in filters:
                query = query.filter(UsageAnalyticsHourly.project_id == filters['project_id'] if group_by == "hour" else UsageAnalyticsDaily.project_id == filters['project_id'])
            if 'prompt_id' in filters:
                query = query.filter(UsageAnalyticsHourly.prompt_id == filters['prompt_id'] if group_by == "hour" else UsageAnalyticsDaily.prompt_id == filters['prompt_id'])
            if 'model_provider' in filters:
                query = query.filter(UsageAnalyticsHourly.model_provider == filters['model_provider'] if group_by == "hour" else UsageAnalyticsDaily.model_provider == filters['model_provider'])

        results = query.order_by(time_field).all()

        # Aggregate results
        total_requests = sum(r.request_count for r in results)
        total_tokens_requested = sum(r.total_tokens_requested for r in results)
        total_tokens_used = sum(r.total_tokens_used for r in results)
        total_cost = sum(r.total_cost_usd for r in results)

        # Calculate average response time
        total_response_time = sum(r.total_response_time_ms for r in results)
        avg_response_time = (total_response_time / total_requests) if total_requests > 0 else 0

        # Success rate
        successful_requests = sum(r.successful_requests for r in results)
        success_rate = (successful_requests / total_requests) if total_requests > 0 else 1.0

        # Time series data for charts
        time_series = []
        for result in results:
            time_point = result.hour_start if group_by == "hour" else result.date
            time_series.append({
                'timestamp': time_point.isoformat(),
                'request_count': result.request_count,
                'tokens_used': result.total_tokens_used,
                'cost_usd': result.total_cost_usd,
                'success_rate': (result.successful_requests / result.request_count) if result.request_count > 0 else 1.0
            })

        # Top prompts by usage
        if group_by == "hour":
            top_prompts = self.db.query(
                UsageAnalyticsHourly.prompt_id,
                func.sum(UsageAnalyticsHourly.request_count).label('total_usage')
            ).filter(
                and_(
                    UsageAnalyticsHourly.tenant_id == tenant_id,
                    UsageAnalyticsHourly.hour_start >= start_date,
                    UsageAnalyticsHourly.hour_start < end_date
                )
            ).group_by(UsageAnalyticsHourly.prompt_id).order_by(desc('total_usage')).limit(10).all()
        else:
            top_prompts = self.db.query(
                UsageAnalyticsDaily.prompt_id,
                func.sum(UsageAnalyticsDaily.request_count).label('total_usage')
            ).filter(
                and_(
                    UsageAnalyticsDaily.tenant_id == tenant_id,
                    UsageAnalyticsDaily.date >= start_date,
                    UsageAnalyticsDaily.date < end_date
                )
            ).group_by(UsageAnalyticsDaily.prompt_id).order_by(desc('total_usage')).limit(10).all()

        response = {
            'summary': {
                'total_requests': total_requests,
                'total_tokens_requested': total_tokens_requested,
                'total_tokens_used': total_tokens_used,
                'total_cost_usd': round(total_cost, 6),
                'average_response_time_ms': round(avg_response_time, 2),
                'success_rate': round(success_rate, 4),
                'period': {
                    'start': start_date.isoformat(),
                    'end': end_date.isoformat(),
                    'group_by': group_by
                }
            },
            'time_series': time_series,
            'top_prompts': [{'prompt_id': p.prompt_id, 'usage_count': p.total_usage} for p in top_prompts if p.prompt_id]
        }

        # Cache the result
        self._cache_analytics(cache_key, response, ttl_seconds=300)  # 5 minutes cache

        return response

    def get_performance_metrics(
        self,
        start_date: datetime,
        end_date: datetime,
        period: AggregationPeriod = AggregationPeriod.HOURLY
    ) -> List[Dict[str, Any]]:
        """
        Get system performance metrics
        """
        metrics = self.db.query(PerformanceMetrics).filter(
            and_(
                PerformanceMetrics.timestamp >= start_date,
                PerformanceMetrics.timestamp < end_date,
                PerformanceMetrics.period == period
            )
        ).order_by(PerformanceMetrics.timestamp).all()

        return [{
            'timestamp': m.timestamp.isoformat(),
            'period': m.period.value,
            'cpu_usage_percent': m.cpu_usage_percent,
            'memory_usage_percent': m.memory_usage_percent,
            'disk_usage_percent': m.disk_usage_percent,
            'database_connections': m.database_connections,
            'average_response_time': m.average_response_time,
            'active_requests': m.active_requests,
            'error_rate': m.error_rate
        } for m in metrics]

    def check_alerts(self) -> List[AlertInstance]:
        """
        Check all active alerts and trigger if conditions are met
        """
        triggered_alerts = []

        # Get all active alerts
        active_alerts = self.db.query(Alert).filter(
            and_(
                Alert.is_active == True,
                Alert.is_enabled == True
            )
        ).all()

        current_time = datetime.utcnow()

        for alert in active_alerts:
            # Calculate window start time
            window_start = current_time - timedelta(minutes=alert.window_duration)

            # Get metric value for the window
            metric_value = self._get_metric_value(
                alert.metric,
                window_start,
                current_time,
                alert.tenant_id,
                alert.user_id,
                alert.project_id
            )

            if metric_value is None:
                continue

            # Check if alert condition is met
            if self._evaluate_condition(metric_value, alert.operator, alert.threshold):
                # Check if alert was already triggered recently (to prevent spam)
                recent_trigger = self.db.query(AlertInstance).filter(
                    and_(
                        AlertInstance.alert_id == alert.id,
                        AlertInstance.triggered_at > window_start,
                        AlertInstance.status == "active"
                    )
                ).first()

                if not recent_trigger:
                    # Create alert instance
                    alert_instance = AlertInstance(
                        alert_id=alert.id,
                        triggered_at=current_time,
                        triggered_value=metric_value,
                        threshold=alert.threshold,
                        tenant_id=alert.tenant_id or "system",
                        user_id=alert.user_id,
                        project_id=alert.project_id,
                        status="active"
                    )

                    self.db.add(alert_instance)
                    triggered_alerts.append(alert_instance)

                    logger.warning(
                        "Alert triggered",
                        alert_name=alert.name,
                        alert_type=alert.alert_type.value,
                        triggered_value=metric_value,
                        threshold=alert.threshold,
                        tenant_id=alert.tenant_id
                    )

        if triggered_alerts:
            self.db.commit()

        return triggered_alerts

    def create_analytics_export(
        self,
        export_type: str,
        format: str,
        start_date: datetime,
        end_date: datetime,
        tenant_id: str,
        created_by: str,
        filters: Optional[Dict[str, Any]] = None
    ) -> AnalyticsExport:
        """
        Create an analytics export job
        """
        export = AnalyticsExport(
            export_type=export_type,
            format=format,
            start_date=start_date,
            end_date=end_date,
            tenant_id=tenant_id,
            created_by=created_by,
            expires_at=datetime.utcnow() + timedelta(days=7),  # 7 days retention
            **{f"{k}_ids": v for k, v in (filters or {}).items() if k in ['user', 'project', 'prompt']}
        )

        self.db.add(export)
        self.db.commit()
        self.db.refresh(export)

        logger.info(
            "Analytics export created",
            export_id=export.id,
            export_type=export_type,
            tenant_id=tenant_id,
            created_by=created_by
        )

        return export

    def _extract_model_provider(self, endpoint: str) -> Optional[str]:
        """Extract model provider from endpoint"""
        if '/openai/' in endpoint:
            return 'openai'
        elif '/anthropic/' in endpoint:
            return 'anthropic'
        elif '/google/' in endpoint:
            return 'google'
        elif '/cohere/' in endpoint:
            return 'cohere'
        return None

    def _extract_model_name(self, endpoint: str) -> Optional[str]:
        """Extract model name from endpoint"""
        parts = endpoint.split('/')
        if len(parts) >= 3:
            return parts[-1]
        return None

    def _get_metric_value(
        self,
        metric: MetricType,
        start_time: datetime,
        end_time: datetime,
        tenant_id: Optional[str] = None,
        user_id: Optional[str] = None,
        project_id: Optional[str] = None
    ) -> Optional[float]:
        """Get aggregated metric value for alert evaluation"""

        query = self.db.query(UsageAnalyticsHourly).filter(
            and_(
                UsageAnalyticsHourly.hour_start >= start_time,
                UsageAnalyticsHourly.hour_start < end_time
            )
        )

        if tenant_id:
            query = query.filter(UsageAnalyticsHourly.tenant_id == tenant_id)
        if user_id:
            query = query.filter(UsageAnalyticsHourly.user_id == user_id)
        if project_id:
            query = query.filter(UsageAnalyticsHourly.project_id == project_id)

        results = query.all()

        if not results:
            return None

        total_requests = sum(r.request_count for r in results)

        if metric == MetricType.TOKENS_REQUESTED:
            return sum(r.total_tokens_requested for r in results)
        elif metric == MetricType.TOKENS_USED:
            return sum(r.total_tokens_used for r in results)
        elif metric == MetricType.COST_USD:
            return sum(r.total_cost_usd for r in results)
        elif metric == MetricType.RESPONSE_TIME:
            total_response_time = sum(r.total_response_time_ms for r in results)
            return (total_response_time / total_requests) if total_requests > 0 else 0
        elif metric == MetricType.SUCCESS_RATE:
            successful_requests = sum(r.successful_requests for r in results)
            return (successful_requests / total_requests) if total_requests > 0 else 1.0
        elif metric == MetricType.ERROR_RATE:
            error_requests = sum(r.error_requests for r in results)
            return (error_requests / total_requests) if total_requests > 0 else 0

        return None

    def _evaluate_condition(self, value: float, operator: str, threshold: float) -> bool:
        """Evaluate alert condition"""
        if operator == ">":
            return value > threshold
        elif operator == "<":
            return value < threshold
        elif operator == ">=":
            return value >= threshold
        elif operator == "<=":
            return value <= threshold
        elif operator == "==":
            return value == threshold
        elif operator == "!=":
            return value != threshold
        return False

    def _get_cached_analytics(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """Get cached analytics result"""
        cached = self.db.query(AnalyticsCache).filter(
            and_(
                AnalyticsCache.cache_key == cache_key,
                AnalyticsCache.expires_at > datetime.utcnow()
            )
        ).first()

        if cached:
            # Update last accessed time
            cached.last_accessed = datetime.utcnow()
            cached.access_count += 1
            self.db.commit()
            return cached.cache_value

        return None

    def _cache_analytics(self, cache_key: str, value: Dict[str, Any], ttl_seconds: int) -> None:
        """Cache analytics result"""
        expires_at = datetime.utcnow() + timedelta(seconds=ttl_seconds)

        cached = AnalyticsCache(
            cache_key=cache_key,
            cache_value=value,
            cache_type="query",
            ttl_seconds=ttl_seconds,
            expires_at=expires_at
        )

        # Check if already exists and update, or insert new
        existing = self.db.query(AnalyticsCache).filter(AnalyticsCache.cache_key == cache_key).first()
        if existing:
            existing.cache_value = value
            existing.expires_at = expires_at
            existing.updated_at = datetime.utcnow()
        else:
            self.db.add(cached)

        self.db.commit()