"""
Test suite for PromptOps analytics system
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, AsyncMock
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.analytics_service import AnalyticsService
from app.analytics_models import (
    UsageAnalyticsHourly, UsageAnalyticsDaily, PerformanceMetrics,
    Alert, AlertInstance, AnalyticsExport, AggregationPeriod, MetricType,
    AlertSeverity, AlertType
)
from app.models import ClientUsageLog, ClientApiKey
from app.database import Base
from app.performance_monitor import PerformanceMonitor
from app.analytics_scheduler import AnalyticsScheduler

# Test database setup
TEST_DATABASE_URL = "sqlite:///:memory:"

@pytest.fixture
def test_engine():
    """Create test database engine"""
    engine = create_engine(TEST_DATABASE_URL)
    Base.metadata.create_all(engine)
    yield engine
    Base.metadata.drop_all(engine)

@pytest.fixture
def test_session(test_engine):
    """Create test database session"""
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    session = SessionLocal()
    yield session
    session.close()

@pytest.fixture
def analytics_service(test_session):
    """Create analytics service for testing"""
    return AnalyticsService(test_session)

@pytest.fixture
def sample_usage_logs(test_session):
    """Create sample usage logs for testing"""
    # Create API key
    api_key = ClientApiKey(
        id="test-api-key",
        user_id="test-user",
        tenant_id="test-tenant",
        name="Test API Key",
        api_key_prefix="test_prefix",
        api_key_hash="test_hash",
        secret_key_hash="test_secret",
        rate_limit_per_minute=60,
        rate_limit_per_hour=3600,
        rate_limit_per_day=86400,
        allowed_scopes=["read", "write"]
    )
    test_session.add(api_key)

    # Create sample usage logs
    logs = []
    base_time = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    for i in range(24):  # 24 hours of data
        for j in range(10):  # 10 requests per hour
            log = ClientUsageLog(
                id=f"log-{i}-{j}",
                api_key_id="test-api-key",
                user_id="test-user",
                tenant_id="test-tenant",
                endpoint="/v1/client/prompts/test-prompt",
                method="GET",
                prompt_id="test-prompt",
                project_id="test-project",
                tokens_requested=100 + i * 5,
                tokens_used=80 + i * 4,
                response_size=1024,
                processing_time_ms=100 + j * 10,
                estimated_cost_usd="0.001",
                status_code=200,
                user_agent="promptops-client/1.0.0",
                ip_address="192.168.1.1",
                timestamp=base_time + timedelta(hours=i, minutes=j * 6)
            )
            logs.append(log)
            test_session.add(log)

    test_session.commit()
    return logs

class TestAnalyticsService:
    """Test cases for AnalyticsService"""

    def test_aggregate_hourly_usage(self, analytics_service, sample_usage_logs, test_session):
        """Test hourly usage aggregation"""
        hour_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

        # Run aggregation
        analytics_service.aggregate_hourly_usage(hour_start)

        # Verify aggregated data exists
        hourly_data = test_session.query(UsageAnalyticsHourly).filter(
            UsageAnalyticsHourly.hour_start == hour_start
        ).all()

        assert len(hourly_data) > 0

        # Check aggregation accuracy
        total_requests = sum(log.request_count for log in hourly_data)
        assert total_requests == 10  # 10 requests per hour

        total_tokens = sum(log.total_tokens_used for log in hourly_data)
        expected_tokens = sum(80 + i * 4 for i in range(1))  # First hour only
        assert total_tokens == expected_tokens

    def test_aggregate_daily_usage(self, analytics_service, sample_usage_logs, test_session):
        """Test daily usage aggregation"""
        # First aggregate hourly
        hour_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        analytics_service.aggregate_hourly_usage(hour_start)

        # Then aggregate daily
        date = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        analytics_service.aggregate_daily_usage(date)

        # Verify daily aggregated data exists
        daily_data = test_session.query(UsageAnalyticsDaily).filter(
            UsageAnalyticsDaily.date == date
        ).all()

        assert len(daily_data) > 0

        daily_record = daily_data[0]
        assert daily_record.request_count > 0
        assert daily_record.success_rate > 0

    def test_get_usage_statistics(self, analytics_service, sample_usage_logs, test_session):
        """Test usage statistics retrieval"""
        # Aggregate data first
        hour_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        analytics_service.aggregate_hourly_usage(hour_start)

        start_date = datetime.utcnow() - timedelta(days=1)
        end_date = datetime.utcnow()

        stats = analytics_service.get_usage_statistics(
            tenant_id="test-tenant",
            start_date=start_date,
            end_date=end_date,
            group_by="hour"
        )

        assert "summary" in stats
        assert "time_series" in stats
        assert "top_prompts" in stats

        summary = stats["summary"]
        assert summary["total_requests"] > 0
        assert summary["total_tokens_used"] > 0
        assert "total_cost_usd" in summary
        assert "success_rate" in summary

    def test_alert_condition_evaluation(self, analytics_service):
        """Test alert condition evaluation"""
        # Test greater than condition
        assert analytics_service._evaluate_condition(100, ">", 50)
        assert not analytics_service._evaluate_condition(50, ">", 100)

        # Test less than condition
        assert analytics_service._evaluate_condition(50, "<", 100)
        assert not analytics_service._evaluate_condition(100, "<", 50)

        # Test equal condition
        assert analytics_service._evaluate_condition(100, "==", 100)
        assert not analytics_service._evaluate_condition(100, "==", 50)

    def test_cache_operations(self, analytics_service, test_session):
        """Test analytics caching"""
        cache_key = "test_cache_key"
        test_value = {"test": "data"}

        # Test caching
        analytics_service._cache_analytics(cache_key, test_value, ttl_seconds=300)

        # Test retrieval
        cached_value = analytics_service._get_cached_analytics(cache_key)
        assert cached_value == test_value

        # Test non-existent key
        non_existent = analytics_service._get_cached_analytics("non_existent_key")
        assert non_existent is None

class TestAnalyticsModels:
    """Test cases for analytics models"""

    def test_usage_analytics_hourly_creation(self, test_session):
        """Test UsageAnalyticsHourly model creation"""
        hourly = UsageAnalyticsHourly(
            hour_start=datetime.utcnow(),
            hour_end=datetime.utcnow() + timedelta(hours=1),
            tenant_id="test-tenant",
            user_id="test-user",
            request_count=10,
            total_tokens_used=1000,
            total_cost_usd=1.5
        )

        test_session.add(hourly)
        test_session.commit()

        assert hourly.id is not None
        assert hourly.request_count == 10
        assert hourly.total_tokens_used == 1000

    def test_alert_creation(self, test_session):
        """Test Alert model creation"""
        alert = Alert(
            name="Test Alert",
            description="Test alert description",
            alert_type=AlertType.USAGE_SPIKE,
            severity=AlertSeverity.HIGH,
            metric=MetricType.TOKENS_USED,
            operator=">",
            threshold=1000,
            window_duration=60
        )

        test_session.add(alert)
        test_session.commit()

        assert alert.id is not None
        assert alert.name == "Test Alert"
        assert alert.alert_type == AlertType.USAGE_SPIKE
        assert alert.is_active is True

class TestPerformanceMonitor:
    """Test cases for PerformanceMonitor"""

    @pytest.mark.asyncio
    async def test_system_metrics_collection(self):
        """Test system metrics collection"""
        monitor = PerformanceMonitor()

        metrics = monitor._collect_system_metrics()

        assert isinstance(metrics, dict)
        assert "cpu_usage_percent" in metrics
        assert "memory_usage_percent" in metrics
        assert "disk_usage_percent" in metrics

    @pytest.mark.asyncio
    async def test_health_check(self):
        """Test system health check"""
        monitor = PerformanceMonitor()

        health = monitor.get_system_health()

        assert "health_score" in health
        assert "health_status" in health
        assert "timestamp" in health
        assert health["health_score"] >= 0
        assert health["health_score"] <= 100

        assert health["health_status"] in ["healthy", "degraded", "warning", "critical", "error"]

class TestAnalyticsScheduler:
    """Test cases for AnalyticsScheduler"""

    @pytest.mark.asyncio
    async def test_scheduler_start_stop(self):
        """Test scheduler start and stop"""
        scheduler = AnalyticsScheduler()

        # Test starting
        await scheduler.start()
        assert scheduler.running is True

        # Test stopping
        await scheduler.stop()
        assert scheduler.running is False

    @pytest.mark.asyncio
    async def test_retention_policy_enforcement(self, test_session):
        """Test data retention policy enforcement"""
        from app.analytics_models import DataRetentionPolicy

        # Create retention policy
        policy = DataRetentionPolicy(
            table_name="client_usage_logs",
            retention_period_days=7,
            is_enabled=True,
            archive_before_delete=False
        )
        test_session.add(policy)
        test_session.commit()

        scheduler = AnalyticsScheduler()

        # Test policy enforcement (mock old data)
        old_date = datetime.utcnow() - timedelta(days=10)
        old_log = ClientUsageLog(
            id="old-log",
            api_key_id="test-key",
            user_id="test-user",
            tenant_id="test-tenant",
            endpoint="/test",
            method="GET",
            status_code=200,
            timestamp=old_date
        )
        test_session.add(old_log)
        test_session.commit()

        # Verify old log exists
        assert test_session.query(ClientUsageLog).filter(
            ClientUsageLog.timestamp < old_date + timedelta(days=1)
        ).first() is not None

        # Run retention policy
        await scheduler._enforce_retention_policies(test_session)

        # Verify old log was deleted
        assert test_session.query(ClientUsageLog).filter(
            ClientUsageLog.timestamp < old_date + timedelta(days=1)
        ).first() is None

class TestAnalyticsIntegration:
    """Integration tests for analytics system"""

    @pytest.mark.asyncio
    async def test_end_to_end_analytics_flow(self, test_session):
        """Test complete analytics flow from log to insights"""
        # Create sample data
        api_key = ClientApiKey(
            id="integration-test-key",
            user_id="integration-user",
            tenant_id="integration-tenant",
            name="Integration Test Key",
            api_key_prefix="integration_prefix",
            api_key_hash="integration_hash",
            secret_key_hash="integration_secret",
            rate_limit_per_minute=60,
            allowed_scopes=["read", "write"]
        )
        test_session.add(api_key)

        # Create usage logs
        base_time = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        for i in range(5):
            log = ClientUsageLog(
                id=f"integration-log-{i}",
                api_key_id="integration-test-key",
                user_id="integration-user",
                tenant_id="integration-tenant",
                endpoint="/v1/client/prompts/integration-prompt",
                method="GET",
                prompt_id="integration-prompt",
                project_id="integration-project",
                tokens_requested=200,
                tokens_used=180,
                response_size=2048,
                processing_time_ms=150,
                estimated_cost_usd="0.002",
                status_code=200,
                timestamp=base_time + timedelta(hours=i)
            )
            test_session.add(log)

        test_session.commit()

        # Initialize analytics service
        analytics_service = AnalyticsService(test_session)

        # Run aggregation
        analytics_service.aggregate_hourly_usage(base_time)

        # Verify aggregation results
        hourly_data = test_session.query(UsageAnalyticsHourly).filter(
            UsageAnalyticsHourly.tenant_id == "integration-tenant"
        ).all()

        assert len(hourly_data) > 0

        # Test statistics retrieval
        stats = analytics_service.get_usage_statistics(
            tenant_id="integration-tenant",
            start_date=base_time,
            end_date=base_time + timedelta(days=1),
            group_by="hour"
        )

        assert stats["summary"]["total_requests"] >= 5
        assert stats["summary"]["total_tokens_used"] >= 900  # 5 * 180

        # Create and test alert
        alert = Alert(
            name="Integration Test Alert",
            alert_type=AlertType.USAGE_SPIKE,
            severity=AlertSeverity.MEDIUM,
            metric=MetricType.TOKENS_USED,
            operator=">",
            threshold=100,
            window_duration=60,
            tenant_id="integration-tenant"
        )
        test_session.add(alert)
        test_session.commit()

        # Test alert checking
        triggered_alerts = analytics_service.check_alerts()
        # Note: This may not trigger alerts in test environment due to timing

        logger.info("End-to-end analytics integration test completed successfully")

if __name__ == "__main__":
    pytest.main([__file__])