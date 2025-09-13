"""
Background task scheduler for analytics aggregation and maintenance
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.database import get_db, engine
from app.analytics_service import AnalyticsService
from app import analytics_models
import structlog

logger = structlog.get_logger(__name__)

class AnalyticsScheduler:
    """
    Background task scheduler for analytics operations
    """

    def __init__(self):
        self.running = False
        self.tasks = {}

    async def start(self):
        """Start the analytics scheduler"""
        if self.running:
            logger.warning("Analytics scheduler already running")
            return

        self.running = True
        logger.info("Starting analytics scheduler")

        # Start background tasks
        self.tasks["hourly_aggregation"] = asyncio.create_task(
            self._hourly_aggregation_loop()
        )
        self.tasks["daily_aggregation"] = asyncio.create_task(
            self._daily_aggregation_loop()
        )
        self.tasks["alert_monitoring"] = asyncio.create_task(
            self._alert_monitoring_loop()
        )
        self.tasks["cache_cleanup"] = asyncio.create_task(
            self._cache_cleanup_loop()
        )
        self.tasks["data_retention"] = asyncio.create_task(
            self._data_retention_loop()
        )

    async def stop(self):
        """Stop the analytics scheduler"""
        if not self.running:
            return

        logger.info("Stopping analytics scheduler")
        self.running = False

        # Cancel all tasks
        for task_name, task in self.tasks.items():
            if not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    logger.info(f"Task {task_name} cancelled")

        self.tasks.clear()

    async def _hourly_aggregation_loop(self):
        """Hourly aggregation task"""
        while self.running:
            try:
                # Run at the beginning of each hour
                now = datetime.utcnow()
                next_hour = now.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
                wait_time = (next_hour - now).total_seconds()

                if wait_time > 0:
                    await asyncio.sleep(wait_time)

                if not self.running:
                    break

                # Get the hour to process (previous hour)
                process_hour = datetime.utcnow().replace(minute=0, second=0, microsecond=0) - timedelta(hours=1)

                logger.info("Starting hourly aggregation", hour=process_hour)

                # Run aggregation in a separate DB session
                with next(get_db()) as db:
                    analytics_service = AnalyticsService(db)
                    analytics_service.aggregate_hourly_usage(process_hour)

                logger.info("Hourly aggregation completed", hour=process_hour)

            except Exception as e:
                logger.error("Hourly aggregation failed", error=str(e))
                # Continue running even if one aggregation fails

            # Wait before next attempt
            await asyncio.sleep(300)  # 5 minutes

    async def _daily_aggregation_loop(self):
        """Daily aggregation task"""
        while self.running:
            try:
                # Run at 1 AM UTC daily
                now = datetime.utcnow()
                next_run = now.replace(hour=1, minute=0, second=0, microsecond=0)
                if next_run <= now:
                    next_run += timedelta(days=1)

                wait_time = (next_run - now).total_seconds()

                if wait_time > 0:
                    await asyncio.sleep(wait_time)

                if not self.running:
                    break

                # Get the day to process (previous day)
                process_date = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=1)

                logger.info("Starting daily aggregation", date=process_date)

                # Run aggregation in a separate DB session
                with next(get_db()) as db:
                    analytics_service = AnalyticsService(db)
                    analytics_service.aggregate_daily_usage(process_date)

                logger.info("Daily aggregation completed", date=process_date)

            except Exception as e:
                logger.error("Daily aggregation failed", error=str(e))
                # Continue running even if one aggregation fails

            # Wait before next attempt
            await asyncio.sleep(3600)  # 1 hour

    async def _alert_monitoring_loop(self):
        """Alert monitoring task"""
        while self.running:
            try:
                # Check alerts every 5 minutes
                await asyncio.sleep(300)

                if not self.running:
                    break

                logger.debug("Checking alerts")

                # Run alert checking in a separate DB session
                with next(get_db()) as db:
                    analytics_service = AnalyticsService(db)
                    triggered_alerts = analytics_service.check_alerts()

                    if triggered_alerts:
                        logger.info(
                            "Alerts triggered",
                            count=len(triggered_alerts),
                            alert_ids=[alert.id for alert in triggered_alerts]
                        )

                        # Here you would implement notification sending
                        # For now, just log the alerts
                        await self._send_alert_notifications(triggered_alerts)

            except Exception as e:
                logger.error("Alert monitoring failed", error=str(e))
                # Continue running even if one check fails

    async def _cache_cleanup_loop(self):
        """Cache cleanup task"""
        while self.running:
            try:
                # Clean cache every hour
                await asyncio.sleep(3600)

                if not self.running:
                    break

                logger.debug("Cleaning analytics cache")

                # Run cache cleanup in a separate DB session
                with next(get_db()) as db:
                    # Delete expired cache entries
                    expired_entries = db.query(analytics_models.AnalyticsCache).filter(
                        analytics_models.AnalyticsCache.expires_at < datetime.utcnow()
                    ).delete()

                    if expired_entries > 0:
                        db.commit()
                        logger.info("Cache cleanup completed", entries_deleted=expired_entries)

            except Exception as e:
                logger.error("Cache cleanup failed", error=str(e))
                # Continue running even if one cleanup fails

    async def _data_retention_loop(self):
        """Data retention policy enforcement"""
        while self.running:
            try:
                # Run retention policy daily at 2 AM UTC
                now = datetime.utcnow()
                next_run = now.replace(hour=2, minute=0, second=0, microsecond=0)
                if next_run <= now:
                    next_run += timedelta(days=1)

                wait_time = (next_run - now).total_seconds()

                if wait_time > 0:
                    await asyncio.sleep(wait_time)

                if not self.running:
                    break

                logger.info("Starting data retention cleanup")

                # Run retention in a separate DB session
                with next(get_db()) as db:
                    await self._enforce_retention_policies(db)

                logger.info("Data retention cleanup completed")

            except Exception as e:
                logger.error("Data retention cleanup failed", error=str(e))
                # Continue running even if one cleanup fails

    async def _enforce_retention_policies(self, db: Session):
        """Enforce data retention policies"""
        policies = db.query(analytics_models.DataRetentionPolicy).filter(
            analytics_models.DataRetentionPolicy.is_enabled == True
        ).all()

        cutoff_date = datetime.utcnow()

        for policy in policies:
            try:
                policy_cutoff = cutoff_date - timedelta(days=policy.retention_period_days)

                if policy.table_name == "client_usage_logs":
                    # Archive and delete old usage logs
                    if policy.archive_before_delete:
                        await self._archive_data(db, "client_usage_logs", policy_cutoff)

                    from app.models import ClientUsageLog
                    deleted = db.query(ClientUsageLog).filter(
                        ClientUsageLog.timestamp < policy_cutoff
                    ).delete()
                    logger.info(
                        "Applied retention policy for client_usage_logs",
                        policy_id=policy.id,
                        days=policy.retention_period_days,
                        records_deleted=deleted
                    )

                elif policy.table_name == "usage_analytics_hourly":
                    if policy.archive_before_delete:
                        await self._archive_data(db, "usage_analytics_hourly", policy_cutoff)

                    deleted = db.query(analytics_models.UsageAnalyticsHourly).filter(
                        analytics_models.UsageAnalyticsHourly.hour_start < policy_cutoff
                    ).delete()
                    logger.info(
                        "Applied retention policy for usage_analytics_hourly",
                        policy_id=policy.id,
                        days=policy.retention_period_days,
                        records_deleted=deleted
                    )

                elif policy.table_name == "usage_analytics_daily":
                    if policy.archive_before_delete:
                        await self._archive_data(db, "usage_analytics_daily", policy_cutoff)

                    deleted = db.query(analytics_models.UsageAnalyticsDaily).filter(
                        analytics_models.UsageAnalyticsDaily.date < policy_cutoff
                    ).delete()
                    logger.info(
                        "Applied retention policy for usage_analytics_daily",
                        policy_id=policy.id,
                        days=policy.retention_period_days,
                        records_deleted=deleted
                    )

                elif policy.table_name == "performance_metrics":
                    if policy.archive_before_delete:
                        await self._archive_data(db, "performance_metrics", policy_cutoff)

                    deleted = db.query(analytics_models.PerformanceMetrics).filter(
                        analytics_models.PerformanceMetrics.timestamp < policy_cutoff
                    ).delete()
                    logger.info(
                        "Applied retention policy for performance_metrics",
                        policy_id=policy.id,
                        days=policy.retention_period_days,
                        records_deleted=deleted
                    )

                # Update last cleanup time
                policy.last_cleanup_at = datetime.utcnow()

            except Exception as e:
                logger.error(
                    "Failed to apply retention policy",
                    policy_id=policy.id,
                    error=str(e)
                )

        db.commit()

    async def _archive_data(self, db: Session, table_name: str, cutoff_date: datetime):
        """
        Archive data before deletion (placeholder implementation)
        In a real implementation, this would export data to S3, cold storage, etc.
        """
        logger.info(
            "Archiving data",
            table=table_name,
            cutoff_date=cutoff_date.isoformat()
        )

        # This is a placeholder - in reality, you would:
        # 1. Query data to be archived
        # 2. Export to archive storage (S3, etc.)
        # 3. Verify archive integrity
        # 4. Record archive metadata

    async def _send_alert_notifications(self, alerts):
        """Send notifications for triggered alerts"""
        # This is a placeholder implementation
        # In a real system, you would integrate with email, Slack, webhooks, etc.

        for alert in alerts:
            logger.warning(
                "Alert notification would be sent",
                alert_id=alert.id,
                alert_name=alert.alert.name if alert.alert else "Unknown",
                tenant_id=alert.tenant_id,
                triggered_value=alert.triggered_value,
                threshold=alert.threshold
            )

        # Example integrations you could implement:
        # - Email notifications
        # - Slack webhooks
        # - PagerDuty integration
        # - Custom webhooks
        # - SMS notifications
        # - Push notifications

# Global scheduler instance
_scheduler: Optional[AnalyticsScheduler] = None

def get_scheduler() -> AnalyticsScheduler:
    """Get the global analytics scheduler instance"""
    global _scheduler
    if _scheduler is None:
        _scheduler = AnalyticsScheduler()
    return _scheduler

async def start_analytics_scheduler():
    """Start the analytics scheduler"""
    scheduler = get_scheduler()
    await scheduler.start()

async def stop_analytics_scheduler():
    """Stop the analytics scheduler"""
    global _scheduler
    if _scheduler:
        await _scheduler.stop()
        _scheduler = None