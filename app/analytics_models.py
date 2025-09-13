"""
Analytics-optimized database models and utilities for PromptOps
"""

import json
import uuid
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, List, Optional, Union, Any
from sqlalchemy import (
    Column, String, Integer, BigInteger, Float, Boolean, JSON, ForeignKey,
    Enum as SQLEnum, DateTime, func, and_, or_, Index, text, CheckConstraint,
    UniqueConstraint, ForeignKeyConstraint
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, Session
from sqlalchemy.sql import expression

Base = declarative_base()

# Analytics-specific enums
class AggregationPeriod(str, SQLEnum):
    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    YEARLY = "yearly"

class MetricType(str, SQLEnum):
    TOKENS_REQUESTED = "tokens_requested"
    TOKENS_USED = "tokens_used"
    RESPONSE_TIME = "response_time"
    COST_USD = "cost_usd"
    SUCCESS_RATE = "success_rate"
    CACHE_HIT_RATE = "cache_hit_rate"
    ERROR_RATE = "error_rate"

class AlertSeverity(str, SQLEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class AlertType(str, SQLEnum):
    USAGE_SPIKE = "usage_spike"
    COST_THRESHOLD = "cost_threshold"
    ERROR_RATE = "error_rate"
    RESPONSE_TIME = "response_time"
    CACHE_PERFORMANCE = "cache_performance"

# Enhanced analytics tables with optimized indexes

class UsageAnalyticsHourly(Base):
    """
    Hourly aggregated usage analytics for efficient querying
    Optimized for time-series analytics and reporting
    """
    __tablename__ = "usage_analytics_hourly"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    # Time partitioning key
    hour_start = Column(DateTime(timezone=True), nullable=False, index=True)
    hour_end = Column(DateTime(timezone=True), nullable=False)

    # Dimensions for grouping and filtering
    tenant_id = Column(String, nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)
    api_key_id = Column(String, nullable=True, index=True)
    project_id = Column(String, nullable=True, index=True)
    prompt_id = Column(String, nullable=True, index=True)
    model_provider = Column(String, nullable=True, index=True)
    model_name = Column(String, nullable=True, index=True)

    # Aggregated metrics
    request_count = Column(Integer, nullable=False, default=0)
    total_tokens_requested = Column(BigInteger, nullable=False, default=0)
    total_tokens_used = Column(BigInteger, nullable=False, default=0)
    total_cost_usd = Column(Float, nullable=False, default=0.0)
    total_response_time_ms = Column(BigInteger, nullable=False, default=0)

    # Success/error metrics
    successful_requests = Column(Integer, nullable=False, default=0)
    error_requests = Column(Integer, nullable=False, default=0)

    # Cache metrics
    cache_hits = Column(Integer, nullable=False, default=0)
    cache_misses = Column(Integer, nullable=False, default=0)

    # Additional dimensions for advanced analytics
    endpoint = Column(String, nullable=True, index=True)
    http_method = Column(String, nullable=True)
    status_code_ranges = Column(JSON, nullable=True)  # e.g., {"2xx": 100, "4xx": 5, "5xx": 2}

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Check constraints for data integrity
    __table_args__ = (
        CheckConstraint("request_count >= 0", name="ck_hourly_request_count"),
        CheckConstraint("total_tokens_requested >= 0", name="ck_hourly_tokens_requested"),
        CheckConstraint("total_tokens_used >= 0", name="ck_hourly_tokens_used"),
        CheckConstraint("total_cost_usd >= 0", name="ck_hourly_cost_usd"),
        CheckConstraint("total_response_time_ms >= 0", name="ck_hourly_response_time"),
        CheckConstraint("successful_requests >= 0", name="ck_hourly_successful"),
        CheckConstraint("error_requests >= 0", name="ck_hourly_errors"),
        CheckConstraint("cache_hits >= 0", name="ck_hourly_cache_hits"),
        CheckConstraint("cache_misses >= 0", name="ck_hourly_cache_misses"),

        # Composite indexes for common query patterns
        Index("idx_hourly_tenant_hour", "tenant_id", "hour_start"),
        Index("idx_hourly_user_hour", "user_id", "hour_start"),
        Index("idx_hourly_project_hour", "project_id", "hour_start"),
        Index("idx_hourly_prompt_hour", "prompt_id", "hour_start"),
        Index("idx_hourly_model_hour", "model_provider", "model_name", "hour_start"),
        Index("idx_hourly_endpoint_hour", "endpoint", "hour_start"),

        # Time-based partitioning index
        Index("idx_hourly_time_partition", "hour_start", "tenant_id"),
    )

class UsageAnalyticsDaily(Base):
    """
    Daily aggregated usage analytics for longer-term trends
    """
    __tablename__ = "usage_analytics_daily"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    # Time partitioning key
    date = Column(DateTime(timezone=True), nullable=False, index=True)

    # Dimensions
    tenant_id = Column(String, nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)
    api_key_id = Column(String, nullable=True, index=True)
    project_id = Column(String, nullable=True, index=True)
    prompt_id = Column(String, nullable=True, index=True)
    model_provider = Column(String, nullable=True, index=True)
    model_name = Column(String, nullable=True, index=True)

    # Aggregated metrics
    request_count = Column(Integer, nullable=False, default=0)
    total_tokens_requested = Column(BigInteger, nullable=False, default=0)
    total_tokens_used = Column(BigInteger, nullable=False, default=0)
    total_cost_usd = Column(Float, nullable=False, default=0.0)
    avg_response_time_ms = Column(Float, nullable=False, default=0.0)

    # Success/error metrics
    success_rate = Column(Float, nullable=False, default=1.0)
    error_rate = Column(Float, nullable=False, default=0.0)

    # Cache metrics
    cache_hit_rate = Column(Float, nullable=False, default=0.0)

    # Peak hour analysis
    peak_hour = Column(Integer, nullable=True)  # Hour of day (0-23)
    peak_request_count = Column(Integer, nullable=True)

    # Trend analysis
    growth_rate_vs_previous = Column(Float, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("request_count >= 0", name="ck_daily_request_count"),
        CheckConstraint("success_rate >= 0 AND success_rate <= 1", name="ck_daily_success_rate"),
        CheckConstraint("error_rate >= 0 AND error_rate <= 1", name="ck_daily_error_rate"),
        CheckConstraint("cache_hit_rate >= 0 AND cache_hit_rate <= 1", name="ck_daily_cache_hit_rate"),
        CheckConstraint("peak_hour >= 0 AND peak_hour <= 23", name="ck_daily_peak_hour"),

        Index("idx_daily_tenant_date", "tenant_id", "date"),
        Index("idx_daily_user_date", "user_id", "date"),
        Index("idx_daily_project_date", "project_id", "date"),
        Index("idx_daily_model_date", "model_provider", "model_name", "date"),
    )

class PerformanceMetrics(Base):
    """
    Detailed performance metrics for system monitoring
    """
    __tablename__ = "performance_metrics"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    # Time and grouping
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    period = Column(String, nullable=False, index=True)

    # System metrics
    cpu_usage_percent = Column(Float, nullable=True)
    memory_usage_percent = Column(Float, nullable=True)
    disk_usage_percent = Column(Float, nullable=True)
    database_connections = Column(Integer, nullable=True)
    redis_memory_usage = Column(BigInteger, nullable=True)
    redis_key_count = Column(BigInteger, nullable=True)

    # Application metrics
    active_requests = Column(Integer, nullable=True)
    queue_size = Column(Integer, nullable=True)
    average_response_time = Column(Float, nullable=True)
    error_rate = Column(Float, nullable=True)

    # Database metrics
    slow_query_count = Column(Integer, nullable=True)
    average_query_time = Column(Float, nullable=True)
    table_sizes = Column(JSON, nullable=True)

    # Network metrics
    request_rate_per_second = Column(Float, nullable=True)
    bandwidth_in_bytes = Column(BigInteger, nullable=True)
    bandwidth_out_bytes = Column(BigInteger, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("idx_performance_time_period", "timestamp", "period"),
        Index("idx_performance_cpu", "cpu_usage_percent"),
        Index("idx_performance_memory", "memory_usage_percent"),
    )

class Alert(Base):
    """
    Alert definitions and tracking for monitoring
    """
    __tablename__ = "alerts"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    # Alert configuration
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    alert_type = Column(String, nullable=False, index=True)
    severity = Column(String, nullable=False, index=True)

    # Alert conditions
    metric = Column(String, nullable=False)
    operator = Column(String, nullable=False)  # ">", "<", ">=", "<=", "==", "!="
    threshold = Column(Float, nullable=False)
    window_duration = Column(Integer, nullable=False)  # Duration in minutes

    # Alert scope
    tenant_id = Column(String, nullable=True, index=True)
    user_id = Column(String, nullable=True, index=True)
    project_id = Column(String, nullable=True, index=True)

    # Alert state
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    is_enabled = Column(Boolean, nullable=False, default=True)

    # Notification settings
    notification_channels = Column(JSON, nullable=True)  # ["email", "slack", "webhook"]
    notification_settings = Column(JSON, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_triggered = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("idx_alert_type_severity", "alert_type", "severity"),
        Index("idx_alert_tenant_active", "tenant_id", "is_active"),
    )

class AlertInstance(Base):
    """
    Individual alert instances when conditions are met
    """
    __tablename__ = "alert_instances"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    alert_id = Column(String, nullable=False, index=True)

    # Trigger information
    triggered_at = Column(DateTime(timezone=True), nullable=False, index=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    # Triggered value and threshold
    triggered_value = Column(Float, nullable=False)
    threshold = Column(Float, nullable=False)

    # Context
    tenant_id = Column(String, nullable=False, index=True)
    user_id = Column(String, nullable=True, index=True)
    project_id = Column(String, nullable=True, index=True)
    additional_context = Column(JSON, nullable=True)

    # Status
    status = Column(String, nullable=False, default="active")  # "active", "resolved", "acknowledged"
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    acknowledged_by = Column(String, nullable=True)

    # Notifications
    notifications_sent = Column(Boolean, nullable=False, default=False)
    notification_log = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Foreign key
    __table_args__ = (
        ForeignKeyConstraint(['alert_id'], ['alerts.id']),
        Index("idx_alert_instance_triggered", "triggered_at", "status"),
        Index("idx_alert_instance_tenant", "tenant_id", "triggered_at"),
    )

class AnalyticsExport(Base):
    """
    Analytics export jobs and data
    """
    __tablename__ = "analytics_exports"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    # Export configuration
    export_type = Column(String, nullable=False, index=True)  # "csv", "json", "parquet"
    format = Column(String, nullable=False)  # "full", "summary", "custom"

    # Data range
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=False)

    # Filters
    tenant_id = Column(String, nullable=False, index=True)
    user_ids = Column(JSON, nullable=True)  # List of user IDs
    project_ids = Column(JSON, nullable=True)  # List of project IDs
    prompt_ids = Column(JSON, nullable=True)  # List of prompt IDs
    metrics = Column(JSON, nullable=True)  # List of metrics to include

    # Export status
    status = Column(String, nullable=False, default="pending")  # "pending", "processing", "completed", "failed"
    progress_percentage = Column(Integer, nullable=True, default=0)
    file_size_bytes = Column(BigInteger, nullable=True)
    record_count = Column(BigInteger, nullable=True)

    # File information
    file_path = Column(String, nullable=True)
    download_url = Column(String, nullable=True)
    checksum = Column(String, nullable=True)  # MD5 checksum for file integrity

    # Job information
    created_by = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(String, nullable=True)

    # Expiration
    expires_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("idx_export_tenant_date", "tenant_id", "start_date", "end_date"),
        Index("idx_export_status", "status", "created_at"),
    )

class DataRetentionPolicy(Base):
    """
    Data retention policies for analytics data
    """
    __tablename__ = "data_retention_policies"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    # Policy configuration
    table_name = Column(String, nullable=False, unique=True)
    retention_period_days = Column(Integer, nullable=False)
    is_enabled = Column(Boolean, nullable=False, default=True)

    # Archive settings
    archive_before_delete = Column(Boolean, nullable=False, default=True)
    archive_destination = Column(String, nullable=True)  # S3, local filesystem, etc.

    # Schedule settings
    cleanup_schedule = Column(String, nullable=True)  # Cron expression
    last_cleanup_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class AnalyticsCache(Base):
    """
    Cache for frequently accessed analytics data
    """
    __tablename__ = "analytics_cache"

    cache_key = Column(String, primary_key=True)
    cache_value = Column(JSON, nullable=False)
    cache_type = Column(String, nullable=False, index=True)  # "dashboard", "report", "query"

    # Time-to-live
    ttl_seconds = Column(Integer, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)

    # Metadata
    query_params = Column(JSON, nullable=True)
    last_accessed = Column(DateTime(timezone=True), server_default=func.now())
    access_count = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_cache_expires", "expires_at"),
        Index("idx_cache_type_access", "cache_type", "last_accessed"),
    )