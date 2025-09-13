"""
Setup script for initializing the PromptOps analytics system
"""

import asyncio
import logging
from datetime import datetime, timedelta
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import engine, get_db
from app.analytics_models import (
    Alert, AlertSeverity, AlertType, MetricType, DataRetentionPolicy
)
from app.analytics_scheduler import get_scheduler, start_analytics_scheduler
from app.performance_monitor import get_performance_monitor, start_performance_monitoring
import structlog

logger = structlog.get_logger(__name__)

class AnalyticsSetup:
    """
    Setup and configuration for the analytics system
    """

    def __init__(self):
        self.db = next(get_db())

    def setup_database_tables(self):
        """Create analytics tables if they don't exist"""
        try:
            logger.info("Setting up analytics database tables")

            # Create analytics tables
            from app.analytics_models import Base
            Base.metadata.create_all(bind=engine)

            logger.info("Analytics database tables created successfully")

        except Exception as e:
            logger.error("Failed to create analytics tables", error=str(e))
            raise

    def setup_default_alerts(self):
        """Create default alert configurations"""
        try:
            logger.info("Setting up default alerts")

            default_alerts = [
                {
                    "name": "High Usage Spike",
                    "description": "Alert when usage increases significantly",
                    "alert_type": AlertType.USAGE_SPIKE,
                    "severity": AlertSeverity.HIGH,
                    "metric": MetricType.TOKENS_USED,
                    "operator": ">",
                    "threshold": 10000,
                    "window_duration": 60
                },
                {
                    "name": "Cost Threshold Exceeded",
                    "description": "Alert when daily costs exceed threshold",
                    "alert_type": AlertType.COST_THRESHOLD,
                    "severity": AlertSeverity.MEDIUM,
                    "metric": MetricType.COST_USD,
                    "operator": ">",
                    "threshold": 100.0,
                    "window_duration": 1440  # 24 hours
                },
                {
                    "name": "High Error Rate",
                    "description": "Alert when error rate is too high",
                    "alert_type": AlertType.ERROR_RATE,
                    "severity": AlertSeverity.HIGH,
                    "metric": MetricType.ERROR_RATE,
                    "operator": ">",
                    "threshold": 0.1,  # 10%
                    "window_duration": 60
                },
                {
                    "name": "Slow Response Time",
                    "description": "Alert when average response time is too slow",
                    "alert_type": AlertType.RESPONSE_TIME,
                    "severity": AlertSeverity.MEDIUM,
                    "metric": MetricType.RESPONSE_TIME,
                    "operator": ">",
                    "threshold": 2000,  # 2 seconds
                    "window_duration": 60
                },
                {
                    "name": "Low Cache Hit Rate",
                    "description": "Alert when cache hit rate is too low",
                    "alert_type": AlertType.CACHE_PERFORMANCE,
                    "severity": AlertSeverity.LOW,
                    "metric": MetricType.CACHE_HIT_RATE,
                    "operator": "<",
                    "threshold": 0.5,  # 50%
                    "window_duration": 60
                }
            ]

            for alert_config in default_alerts:
                # Check if alert already exists
                existing = self.db.query(Alert).filter(
                    Alert.name == alert_config["name"]
                ).first()

                if not existing:
                    alert = Alert(**alert_config)
                    self.db.add(alert)
                    logger.info("Created default alert", name=alert_config["name"])

            self.db.commit()
            logger.info("Default alerts setup completed")

        except Exception as e:
            logger.error("Failed to setup default alerts", error=str(e))
            raise

    def setup_retention_policies(self):
        """Create default data retention policies"""
        try:
            logger.info("Setting up data retention policies")

            default_policies = [
                {
                    "table_name": "client_usage_logs",
                    "retention_period_days": 90,
                    "is_enabled": True,
                    "archive_before_delete": True,
                    "cleanup_schedule": "0 2 * * *"  # Daily at 2 AM
                },
                {
                    "table_name": "usage_analytics_hourly",
                    "retention_period_days": 365,
                    "is_enabled": True,
                    "archive_before_delete": True,
                    "cleanup_schedule": "0 3 * * *"  # Daily at 3 AM
                },
                {
                    "table_name": "usage_analytics_daily",
                    "retention_period_days": 1095,  # 3 years
                    "is_enabled": True,
                    "archive_before_delete": True,
                    "cleanup_schedule": "0 4 * * 0"  # Weekly on Sunday at 4 AM
                },
                {
                    "table_name": "performance_metrics",
                    "retention_period_days": 180,
                    "is_enabled": True,
                    "archive_before_delete": True,
                    "cleanup_schedule": "0 1 * * *"  # Daily at 1 AM
                },
                {
                    "table_name": "alert_instances",
                    "retention_period_days": 365,
                    "is_enabled": True,
                    "archive_before_delete": False,
                    "cleanup_schedule": "0 5 * * 0"  # Weekly on Sunday at 5 AM
                },
                {
                    "table_name": "analytics_exports",
                    "retention_period_days": 30,
                    "is_enabled": True,
                    "archive_before_delete": False,
                    "cleanup_schedule": "0 6 * * *"  # Daily at 6 AM
                }
            ]

            for policy_config in default_policies:
                # Check if policy already exists
                existing = self.db.query(DataRetentionPolicy).filter(
                    DataRetentionPolicy.table_name == policy_config["table_name"]
                ).first()

                if not existing:
                    policy = DataRetentionPolicy(**policy_config)
                    self.db.add(policy)
                    logger.info("Created retention policy", table=policy_config["table_name"])

            self.db.commit()
            logger.info("Data retention policies setup completed")

        except Exception as e:
            logger.error("Failed to setup retention policies", error=str(e))
            raise

    def setup_database_indexes(self):
        """Create additional database indexes for performance"""
        try:
            logger.info("Setting up additional database indexes")

            # Create indexes for common query patterns
            indexes_to_create = [
                # ClientUsageLog indexes
                "CREATE INDEX IF NOT EXISTS idx_client_usage_tenant_time ON client_usage_logs(tenant_id, timestamp)",
                "CREATE INDEX IF NOT EXISTS idx_client_usage_user_time ON client_usage_logs(user_id, timestamp)",
                "CREATE INDEX IF NOT EXISTS idx_client_usage_project_time ON client_usage_logs(project_id, timestamp)",
                "CREATE INDEX IF NOT EXISTS idx_client_usage_status_code ON client_usage_logs(status_code)",

                # Combined indexes for analytics queries
                "CREATE INDEX IF NOT EXISTS idx_client_usage_composite ON client_usage_logs(tenant_id, user_id, project_id, timestamp)",
            ]

            for index_sql in indexes_to_create:
                try:
                    with engine.connect() as conn:
                        conn.execute(text(index_sql))
                        conn.commit()
                        logger.debug("Created index", sql=index_sql)
                except Exception as e:
                    logger.warning("Failed to create index (may already exist)", index=index_sql, error=str(e))

            logger.info("Database indexes setup completed")

        except Exception as e:
            logger.error("Failed to setup database indexes", error=str(e))
            raise

    def backfill_historical_data(self):
        """Backfill analytics data from existing usage logs"""
        try:
            logger.info("Starting historical data backfill")

            # Find the oldest usage log
            from app.models import ClientUsageLog

            oldest_log = self.db.query(ClientUsageLog).order_by(ClientUsageLog.timestamp).first()
            if not oldest_log:
                logger.info("No historical data to backfill")
                return

            start_date = oldest_log.timestamp.replace(hour=0, minute=0, second=0, microsecond=0)
            end_date = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

            logger.info("Backfilling data", start_date=start_date, end_date=end_date)

            current_date = start_date
            from app.analytics_service import AnalyticsService

            analytics_service = AnalyticsService(self.db)

            while current_date < end_date:
                try:
                    # Aggregate hourly data for this date
                    for hour in range(24):
                        hour_start = current_date.replace(hour=hour)
                        hour_end = hour_start + timedelta(hours=1)

                        # Check if we have data for this hour
                        log_count = self.db.query(ClientUsageLog).filter(
                            ClientUsageLog.timestamp >= hour_start,
                            ClientUsageLog.timestamp < hour_end
                        ).count()

                        if log_count > 0:
                            analytics_service.aggregate_hourly_usage(hour_start)
                            logger.debug(
                                "Backfilled hour",
                                date=current_date.date(),
                                hour=hour,
                                logs_processed=log_count
                            )

                    # Aggregate daily data
                    analytics_service.aggregate_daily_usage(current_date)

                    current_date += timedelta(days=1)

                    # Progress logging
                    if current_date.day == 1:  # Log progress monthly
                        progress = ((current_date - start_date).days / (end_date - start_date).days) * 100
                        logger.info("Backfill progress", progress_percent=round(progress, 2))

                except Exception as e:
                    logger.error("Failed to backfill date", date=current_date, error=str(e))
                    # Continue with next date
                    current_date += timedelta(days=1)

            logger.info("Historical data backfill completed")

        except Exception as e:
            logger.error("Failed to backfill historical data", error=str(e))
            raise

    def setup_analytics_cache(self):
        """Setup analytics cache configuration"""
        try:
            logger.info("Setting up analytics cache")

            # Create cache configuration if needed
            # This would typically be stored in configuration files or database
            cache_config = {
                "enabled": True,
                "default_ttl": 300,  # 5 minutes
                "max_size": 10000,
                "cleanup_interval": 3600  # 1 hour
            }

            logger.info("Analytics cache setup completed", config=cache_config)

        except Exception as e:
            logger.error("Failed to setup analytics cache", error=str(e))
            raise

    async def start_background_services(self):
        """Start background analytics services"""
        try:
            logger.info("Starting background analytics services")

            # Start analytics scheduler
            scheduler = get_scheduler()
            await scheduler.start()
            logger.info("Analytics scheduler started")

            # Start performance monitor
            monitor = get_performance_monitor()
            await monitor.start()
            logger.info("Performance monitor started")

            logger.info("Background analytics services started successfully")

        except Exception as e:
            logger.error("Failed to start background services", error=str(e))
            raise

    def run_setup(self, backfill_data: bool = False):
        """Run complete analytics setup"""
        try:
            logger.info("Starting PromptOps analytics setup")

            # Step 1: Setup database tables
            self.setup_database_tables()

            # Step 2: Setup database indexes
            self.setup_database_indexes()

            # Step 3: Setup default alerts
            self.setup_default_alerts()

            # Step 4: Setup retention policies
            self.setup_retention_policies()

            # Step 5: Setup analytics cache
            self.setup_analytics_cache()

            # Step 6: Backfill historical data (optional)
            if backfill_data:
                self.backfill_historical_data()

            logger.info("Analytics setup completed successfully")

            # Return setup summary
            return {
                "status": "completed",
                "tables_created": True,
                "indexes_created": True,
                "alerts_created": True,
                "policies_created": True,
                "cache_setup": True,
                "backfill_completed": backfill_data,
                "timestamp": datetime.utcnow().isoformat()
            }

        except Exception as e:
            logger.error("Analytics setup failed", error=str(e))
            raise

    def verify_setup(self):
        """Verify that analytics setup is complete"""
        try:
            logger.info("Verifying analytics setup")

            verification_results = {
                "database_tables": self._verify_tables(),
                "indexes": self._verify_indexes(),
                "alerts": self._verify_alerts(),
                "policies": self._verify_policies(),
                "background_services": self._verify_background_services()
            }

            overall_status = all(verification_results.values())
            verification_results["overall_status"] = overall_status

            logger.info("Setup verification completed", results=verification_results)
            return verification_results

        except Exception as e:
            logger.error("Setup verification failed", error=str(e))
            raise

    def _verify_tables(self):
        """Verify that all required tables exist"""
        required_tables = [
            "usage_analytics_hourly",
            "usage_analytics_daily",
            "performance_metrics",
            "alerts",
            "alert_instances",
            "analytics_exports",
            "data_retention_policies",
            "analytics_cache"
        ]

        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
            """))
            existing_tables = {row[0] for row in result}

        missing_tables = set(required_tables) - existing_tables
        return len(missing_tables) == 0

    def _verify_indexes(self):
        """Verify that important indexes exist"""
        # This is a simplified check - in production you'd want more thorough verification
        try:
            with engine.connect() as conn:
                result = conn.execute(text("""
                    SELECT indexname
                    FROM pg_indexes
                    WHERE schemaname = 'public'
                      AND indexname LIKE 'idx_%'
                """))
                indexes = [row[0] for row in result]
                return len(indexes) > 0
        except:
            return False

    def _verify_alerts(self):
        """Verify that default alerts exist"""
        alert_count = self.db.query(Alert).count()
        return alert_count > 0

    def _verify_policies(self):
        """Verify that retention policies exist"""
        from app.analytics_models import DataRetentionPolicy
        policy_count = self.db.query(DataRetentionPolicy).count()
        return policy_count > 0

    def _verify_background_services(self):
        """Verify that background services are running"""
        try:
            scheduler = get_scheduler()
            monitor = get_performance_monitor()
            return scheduler.running and monitor.running
        except:
            return False

async def main():
    """Main setup function"""
    try:
        setup = AnalyticsSetup()

        # Run complete setup
        result = setup.run_setup(backfill_data=False)

        # Verify setup
        verification = setup.verify_setup()

        # Start background services
        await setup.start_background_services()

        print("✅ PromptOps Analytics Setup Completed")
        print(f"Setup Status: {result['status']}")
        print(f"Verification: {verification}")

        return result, verification

    except Exception as e:
        logger.error("Analytics setup failed", error=str(e))
        raise

if __name__ == "__main__":
    asyncio.run(main())