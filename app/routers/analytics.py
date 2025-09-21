"""
Analytics API endpoints for PromptOps
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import csv
import io
import json
import uuid

from app.database import get_db
from app.analytics_service import AnalyticsService
from app import analytics_models
from app.analytics_models import (
    AggregationPeriod, Alert, AlertInstance, AlertSeverity, AlertType,
    AnalyticsExport, MetricType
)
from app.schemas import UsageStatsRequest, UsageStatsResponse
from app.auth import get_current_user
import structlog

logger = structlog.get_logger(__name__)
router = APIRouter()

@router.get("/usage/overview")
async def get_usage_overview(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    group_by: str = Query("day", regex="^(hour|day|week|month)$"),
    project_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get comprehensive usage overview with flexible time ranges and grouping"""

    # Set default date range (last 30 days)
    if not end_date:
        end_date = datetime.utcnow()
    if not start_date:
        start_date = end_date - timedelta(days=30)

    analytics_service = AnalyticsService(db)

    # Build filters
    filters = {}
    if project_id:
        filters['project_id'] = project_id

    try:
        usage_stats = analytics_service.get_usage_statistics(
            tenant_id=current_user["tenant"],
            start_date=start_date,
            end_date=end_date,
            group_by=group_by,
            filters=filters
        )
        return usage_stats
    except Exception as e:
        logger.error(f"Failed to get usage overview: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve usage statistics"
        )

@router.get("/usage/detailed")
async def get_detailed_usage(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    project_id: Optional[str] = Query(None),
    prompt_id: Optional[str] = Query(None),
    model_provider: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get detailed usage data with pagination and filtering"""

    if not end_date:
        end_date = datetime.utcnow()
    if not start_date:
        start_date = end_date - timedelta(days=7)

    offset = (page - 1) * page_size

    # Query hourly analytics for detailed data
    query = db.query(
        analytics_models.UsageAnalyticsHourly
    ).filter(
        analytics_models.UsageAnalyticsHourly.tenant_id == current_user["tenant"],
        analytics_models.UsageAnalyticsHourly.hour_start >= start_date,
        analytics_models.UsageAnalyticsHourly.hour_start < end_date
    )

    # Apply filters
    if project_id:
        query = query.filter(analytics_models.UsageAnalyticsHourly.project_id == project_id)
    if prompt_id:
        query = query.filter(analytics_models.UsageAnalyticsHourly.prompt_id == prompt_id)
    if model_provider:
        query = query.filter(analytics_models.UsageAnalyticsHourly.model_provider == model_provider)

    # Get total count
    total_count = query.count()

    # Get paginated results
    results = query.order_by(
        analytics_models.UsageAnalyticsHourly.hour_start.desc()
    ).offset(offset).limit(page_size).all()

    return {
        "data": [
            {
                "hour_start": result.hour_start.isoformat(),
                "project_id": result.project_id,
                "prompt_id": result.prompt_id,
                "model_provider": result.model_provider,
                "model_name": result.model_name,
                "request_count": result.request_count,
                "tokens_used": result.total_tokens_used,
                "cost_usd": result.total_cost_usd,
                "average_response_time_ms": result.total_response_time_ms / result.request_count if result.request_count > 0 else 0,
                "success_rate": result.successful_requests / result.request_count if result.request_count > 0 else 1.0
            }
            for result in results
        ],
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total_count": total_count,
            "total_pages": (total_count + page_size - 1) // page_size
        },
        "filters": {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "project_id": project_id,
            "prompt_id": prompt_id,
            "model_provider": model_provider
        }
    }

@router.get("/usage/top-prompts")
async def get_top_prompts(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    limit: int = Query(10, ge=1, le=100),
    metric: str = Query("usage", regex="^(usage|cost|tokens)$"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get top prompts by usage, cost, or token consumption"""

    if not end_date:
        end_date = datetime.utcnow()
    if not start_date:
        start_date = end_date - timedelta(days=30)

    analytics_service = AnalyticsService(db)

    if metric == "cost":
        # Query by total cost
        results = db.query(
            analytics_models.UsageAnalyticsHourly.prompt_id,
            analytics_models.UsageAnalyticsHourly.model_provider,
            analytics_models.UsageAnalyticsHourly.model_name,
            db.func.sum(analytics_models.UsageAnalyticsHourly.total_cost_usd).label('metric_value'),
            db.func.sum(analytics_models.UsageAnalyticsHourly.request_count).label('request_count')
        ).filter(
            analytics_models.UsageAnalyticsHourly.tenant_id == current_user["tenant"],
            analytics_models.UsageAnalyticsHourly.hour_start >= start_date,
            analytics_models.UsageAnalyticsHourly.hour_start < end_date
        ).group_by(
            analytics_models.UsageAnalyticsHourly.prompt_id,
            analytics_models.UsageAnalyticsHourly.model_provider,
            analytics_models.UsageAnalyticsHourly.model_name
        ).order_by(db.func.sum(analytics_models.UsageAnalyticsHourly.total_cost_usd).desc()).limit(limit).all()

    elif metric == "tokens":
        # Query by token usage
        results = db.query(
            analytics_models.UsageAnalyticsHourly.prompt_id,
            analytics_models.UsageAnalyticsHourly.model_provider,
            analytics_models.UsageAnalyticsHourly.model_name,
            db.func.sum(analytics_models.UsageAnalyticsHourly.total_tokens_used).label('metric_value'),
            db.func.sum(analytics_models.UsageAnalyticsHourly.request_count).label('request_count')
        ).filter(
            analytics_models.UsageAnalyticsHourly.tenant_id == current_user["tenant"],
            analytics_models.UsageAnalyticsHourly.hour_start >= start_date,
            analytics_models.UsageAnalyticsHourly.hour_start < end_date
        ).group_by(
            analytics_models.UsageAnalyticsHourly.prompt_id,
            analytics_models.UsageAnalyticsHourly.model_provider,
            analytics_models.UsageAnalyticsHourly.model_name
        ).order_by(db.func.sum(analytics_models.UsageAnalyticsHourly.total_tokens_used).desc()).limit(limit).all()

    else:  # usage
        # Query by request count
        results = db.query(
            analytics_models.UsageAnalyticsHourly.prompt_id,
            analytics_models.UsageAnalyticsHourly.model_provider,
            analytics_models.UsageAnalyticsHourly.model_name,
            db.func.sum(analytics_models.UsageAnalyticsHourly.request_count).label('metric_value'),
            db.func.sum(analytics_models.UsageAnalyticsHourly.request_count).label('request_count')
        ).filter(
            analytics_models.UsageAnalyticsHourly.tenant_id == current_user["tenant"],
            analytics_models.UsageAnalyticsHourly.hour_start >= start_date,
            analytics_models.UsageAnalyticsHourly.hour_start < end_date
        ).group_by(
            analytics_models.UsageAnalyticsHourly.prompt_id,
            analytics_models.UsageAnalyticsHourly.model_provider,
            analytics_models.UsageAnalyticsHourly.model_name
        ).order_by(db.func.sum(analytics_models.UsageAnalyticsHourly.request_count).desc()).limit(limit).all()

    return {
        "top_prompts": [
            {
                "prompt_id": result.prompt_id,
                "model_provider": result.model_provider,
                "model_name": result.model_name,
                f"{metric}_value": float(result.metric_value),
                "request_count": result.request_count,
                "rank": i + 1
            }
            for i, result in enumerate(results) if result.prompt_id
        ],
        "metric": metric,
        "period": {
            "start": start_date.isoformat(),
            "end": end_date.isoformat()
        }
    }

@router.get("/performance/metrics")
async def get_performance_metrics(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    period: str = Query("hourly", regex="^(hourly|daily)$"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get system performance metrics"""

    if not end_date:
        end_date = datetime.utcnow()
    if not start_date:
        start_date = end_date - timedelta(days=7)

    analytics_service = AnalyticsService(db)
    period_enum = AggregationPeriod.HOURLY if period == "hourly" else AggregationPeriod.DAILY

    try:
        metrics = analytics_service.get_performance_metrics(start_date, end_date, period_enum)
        return {"metrics": metrics}
    except Exception as e:
        logger.error(f"Failed to get performance metrics: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve performance metrics"
        )

@router.get("/alerts")
async def get_alerts(
    severity: Optional[str] = Query(None, regex="^(low|medium|high|critical)$"),
    status: Optional[str] = Query(None, regex="^(active|resolved|acknowledged)$"),
    limit: int = Query(50, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get alerts for the tenant"""

    query = db.query(AlertInstance).filter(
        AlertInstance.tenant_id == current_user["tenant"]
    )

    if severity:
        # Need to join with Alert table to filter by severity
        query = query.join(Alert).filter(Alert.severity == AlertSeverity(severity.upper()))

    if status:
        query = query.filter(AlertInstance.status == status)

    total_count = query.count()
    alerts = query.order_by(AlertInstance.triggered_at.desc()).offset(offset).limit(limit).all()

    return {
        "alerts": [
            {
                "id": alert.id,
                "alert_name": alert.alert.name if alert.alert else "Unknown",
                "alert_type": alert.alert.alert_type.value if alert.alert else "unknown",
                "severity": alert.alert.severity.value if alert.alert else "unknown",
                "triggered_at": alert.triggered_at.isoformat(),
                "resolved_at": alert.resolved_at.isoformat() if alert.resolved_at else None,
                "triggered_value": alert.triggered_value,
                "threshold": alert.threshold,
                "status": alert.status,
                "additional_context": alert.additional_context
            }
            for alert in alerts
        ],
        "pagination": {
            "limit": limit,
            "offset": offset,
            "total_count": total_count
        }
    }

@router.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Acknowledge an alert"""

    alert_instance = db.query(AlertInstance).filter(
        AlertInstance.id == alert_id,
        AlertInstance.tenant_id == current_user["tenant"],
        AlertInstance.status == "active"
    ).first()

    if not alert_instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found or already resolved"
        )

    alert_instance.status = "acknowledged"
    alert_instance.acknowledged_at = datetime.utcnow()
    alert_instance.acknowledged_by = current_user["user_id"]

    db.commit()

    logger.info(
        "Alert acknowledged",
        alert_id=alert_id,
        acknowledged_by=current_user["user_id"]
    )

    return {"message": "Alert acknowledged successfully"}

@router.get("/exports")
async def get_analytics_exports(
    limit: int = Query(50, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    status: Optional[str] = Query(None, regex="^(pending|processing|completed|failed)$"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get analytics exports for the tenant"""

    query = db.query(AnalyticsExport).filter(
        AnalyticsExport.tenant_id == current_user["tenant"]
    )

    if status:
        query = query.filter(AnalyticsExport.status == status)

    total_count = query.count()
    exports = query.order_by(AnalyticsExport.created_at.desc()).offset(offset).limit(limit).all()

    return {
        "exports": [
            {
                "id": export.id,
                "export_type": export.export_type,
                "format": export.format,
                "start_date": export.start_date.isoformat(),
                "end_date": export.end_date.isoformat(),
                "status": export.status,
                "progress_percentage": export.progress_percentage,
                "file_size_bytes": export.file_size_bytes,
                "record_count": export.record_count,
                "download_url": export.download_url,
                "created_by": export.created_by,
                "created_at": export.created_at.isoformat(),
                "completed_at": export.completed_at.isoformat() if export.completed_at else None,
                "expires_at": export.expires_at.isoformat() if export.expires_at else None
            }
            for export in exports
        ],
        "pagination": {
            "limit": limit,
            "offset": offset,
            "total_count": total_count
        }
    }

@router.post("/exports")
async def create_analytics_export(
    export_type: str = Query(..., regex="^(csv|json|parquet)$"),
    format: str = Query(..., regex="^(full|summary|custom)$"),
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
    project_ids: Optional[List[str]] = Query(None),
    prompt_ids: Optional[List[str]] = Query(None),
    user_ids: Optional[List[str]] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a new analytics export job"""

    # Validate date range
    if end_date <= start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End date must be after start date"
        )

    # Limit date range to prevent excessive exports
    if (end_date - start_date).days > 365:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Date range cannot exceed 365 days"
        )

    analytics_service = AnalyticsService(db)

    try:
        filters = {}
        if project_ids:
            filters['project'] = project_ids
        if prompt_ids:
            filters['prompt'] = prompt_ids
        if user_ids:
            filters['user'] = user_ids

        export = analytics_service.create_analytics_export(
            export_type=export_type,
            format=format,
            start_date=start_date,
            end_date=end_date,
            tenant_id=current_user["tenant"],
            created_by=current_user["user_id"],
            filters=filters
        )

        return {
            "export_id": export.id,
            "status": export.status,
            "message": "Analytics export job created successfully"
        }
    except Exception as e:
        logger.error(f"Failed to create analytics export: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create analytics export"
        )

@router.get("/exports/{export_id}/download")
async def download_analytics_export(
    export_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Download analytics export file"""

    export = db.query(AnalyticsExport).filter(
        AnalyticsExport.id == export_id,
        AnalyticsExport.tenant_id == current_user["tenant"],
        AnalyticsExport.status == "completed"
    ).first()

    if not export:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Export not found or not completed"
        )

    if export.expires_at and export.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Export has expired"
        )

    # In a real implementation, this would stream the file from storage
    # For now, we'll return the download URL
    return {
        "download_url": export.download_url,
        "file_name": f"analytics_export_{export.id}.{export.export_type}",
        "file_size_bytes": export.file_size_bytes,
        "checksum": export.checksum,
        "expires_at": export.expires_at.isoformat() if export.expires_at else None
    }

@router.get("/dashboard/summary")
async def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get dashboard summary with key metrics for the current tenant"""

    # Get current time and common date ranges
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_start = today_start - timedelta(days=1)
    week_start = today_start - timedelta(days=7)
    month_start = today_start.replace(day=1)

    analytics_service = AnalyticsService(db)

    try:
        # Get metrics for different time periods
        today_stats = analytics_service.get_usage_statistics(
            tenant_id=current_user["tenant"],
            start_date=today_start,
            end_date=now,
            group_by="hour"
        )

        yesterday_stats = analytics_service.get_usage_statistics(
            tenant_id=current_user["tenant"],
            start_date=yesterday_start,
            end_date=today_start,
            group_by="hour"
        )

        week_stats = analytics_service.get_usage_statistics(
            tenant_id=current_user["tenant"],
            start_date=week_start,
            end_date=now,
            group_by="day"
        )

        month_stats = analytics_service.get_usage_statistics(
            tenant_id=current_user["tenant"],
            start_date=month_start,
            end_date=now,
            group_by="day"
        )

        # Get active alerts
        active_alerts = db.query(AlertInstance).filter(
            AlertInstance.tenant_id == current_user["tenant"],
            AlertInstance.status.in_(["active", "acknowledged"])
        ).count()

        # Calculate growth rates
        today_requests = today_stats["summary"]["total_requests"]
        yesterday_requests = yesterday_stats["summary"]["total_requests"]
        growth_rate_today = ((today_requests - yesterday_requests) / yesterday_requests * 100) if yesterday_requests > 0 else 0

        week_requests = week_stats["summary"]["total_requests"]
        month_requests = month_stats["summary"]["total_requests"]
        growth_rate_week = ((week_requests - month_requests) / month_requests * 100) if month_requests > 0 else 0

        return {
            "summary": {
                "today": {
                    "requests": today_requests,
                    "tokens_used": today_stats["summary"]["total_tokens_used"],
                    "cost_usd": today_stats["summary"]["total_cost_usd"],
                    "success_rate": today_stats["summary"]["success_rate"],
                    "average_response_time_ms": today_stats["summary"]["average_response_time_ms"]
                },
                "this_week": {
                    "requests": week_requests,
                    "tokens_used": week_stats["summary"]["total_tokens_used"],
                    "cost_usd": week_stats["summary"]["total_cost_usd"],
                    "success_rate": week_stats["summary"]["success_rate"]
                },
                "this_month": {
                    "requests": month_requests,
                    "tokens_used": month_stats["summary"]["total_tokens_used"],
                    "cost_usd": month_stats["summary"]["total_cost_usd"],
                    "success_rate": month_stats["summary"]["success_rate"]
                }
            },
            "growth_rates": {
                "daily_growth_percent": round(growth_rate_today, 2),
                "weekly_growth_percent": round(growth_rate_week, 2)
            },
            "active_alerts": active_alerts,
            "top_prompts_today": today_stats["top_prompts"][:5],
            "last_updated": now.isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to get dashboard summary: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve dashboard summary"
        )