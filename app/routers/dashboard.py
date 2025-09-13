from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
import structlog

from app.database import get_db
from app.models import Project, Module, Prompt, Template, ModelCompatibility, ApprovalRequest, AuditLog
from app.auth import get_current_user

# Temporary: Create a mock user dependency for development
async def get_mock_user():
    """Mock user for development purposes"""
    return {
        "user_id": "demo-user",
        "email": "demo@example.com",
        "roles": ["admin"],
        "tenant": "demo-tenant"
    }

logger = structlog.get_logger()
router = APIRouter()

@router.get("/dashboard/usage")
async def get_dashboard_usage(
    time_range: str = Query("7d", description="Time range: 7d, 30d, 90d"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_mock_user)  # Using mock user for development
):
    """Get usage statistics for dashboard"""
    try:
        # Parse time range
        if time_range == "7d":
            start_date = datetime.utcnow() - timedelta(days=7)
        elif time_range == "30d":
            start_date = datetime.utcnow() - timedelta(days=30)
        elif time_range == "90d":
            start_date = datetime.utcnow() - timedelta(days=90)
        else:
            start_date = datetime.utcnow() - timedelta(days=7)

        # Get counts for different entities
        project_count = db.query(Project).filter(Project.created_at >= start_date).count()
        module_count = db.query(Module).filter(Module.created_at >= start_date).count()
        prompt_count = db.query(Prompt).filter(Prompt.created_at >= start_date).count()
        template_count = db.query(Template).filter(Template.created_at >= start_date).count()

        # Get approval statistics
        approvals_total = db.query(ApprovalRequest).filter(ApprovalRequest.requested_at >= start_date).count()
        approvals_approved = db.query(ApprovalRequest).filter(
            ApprovalRequest.requested_at >= start_date,
            ApprovalRequest.status == "approved"
        ).count()
        approvals_pending = db.query(ApprovalRequest).filter(
            ApprovalRequest.requested_at >= start_date,
            ApprovalRequest.status == "pending"
        ).count()

        # Get compatibility test results
        compatibility_tests = db.query(ModelCompatibility).filter(ModelCompatibility.created_at >= start_date).count()
        compatible_prompts = db.query(ModelCompatibility).filter(
            ModelCompatibility.created_at >= start_date,
            ModelCompatibility.is_compatible == True
        ).count()

        # Get daily activity for charts
        daily_activity = []
        range_days = int(time_range.replace("d", ""))
        for i in range(range_days):
            day_start = start_date + timedelta(days=i)
            day_end = day_start + timedelta(days=1)

            day_projects = db.query(Project).filter(
                Project.created_at >= day_start,
                Project.created_at < day_end
            ).count()

            day_prompts = db.query(Prompt).filter(
                Prompt.created_at >= day_start,
                Prompt.created_at < day_end
            ).count()

            daily_activity.append({
                "date": day_start.strftime("%Y-%m-%d"),
                "projects": day_projects,
                "prompts": day_prompts
            })

        return {
            "summary": {
                "projects_created": project_count,
                "modules_created": module_count,
                "prompts_created": prompt_count,
                "templates_created": template_count,
                "approvals_total": approvals_total,
                "approvals_approved": approvals_approved,
                "approvals_pending": approvals_pending,
                "compatibility_tests": compatibility_tests,
                "compatible_prompts": compatible_prompts,
                "approval_rate": (approvals_approved / approvals_total * 100) if approvals_total > 0 else 0,
                "compatibility_rate": (compatible_prompts / compatibility_tests * 100) if compatibility_tests > 0 else 0
            },
            "daily_activity": daily_activity,
            "range": time_range,
            "generated_at": datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error("Failed to get dashboard usage", error=str(e))
        return {
            "error": str(e),
            "summary": {
                "projects_created": 0,
                "modules_created": 0,
                "prompts_created": 0,
                "templates_created": 0,
                "approvals_total": 0,
                "approvals_approved": 0,
                "approvals_pending": 0,
                "compatibility_tests": 0,
                "compatible_prompts": 0,
                "approval_rate": 0,
                "compatibility_rate": 0
            },
            "daily_activity": [],
            "range": time_range,
            "generated_at": datetime.utcnow().isoformat()
        }

@router.get("/dashboard/recent-activity")
async def get_recent_activity(
    limit: int = Query(10, description="Number of recent activities to return"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_mock_user)  # Using mock user for development
):
    """Get recent system activity"""
    try:
        # Get recent audit logs
        recent_logs = db.query(AuditLog).order_by(AuditLog.ts.desc()).limit(limit).all()

        activities = []
        for log in recent_logs:
            activities.append({
                "timestamp": log.ts.isoformat(),
                "user": log.actor,
                "action": log.action,
                "subject": log.subject,
                "details": {
                    "before": log.before_json,
                    "after": log.after_json
                }
            })

        return {
            "activities": activities,
            "total": len(activities)
        }

    except Exception as e:
        logger.error("Failed to get recent activity", error=str(e))
        return {
            "activities": [],
            "total": 0,
            "error": str(e)
        }

@router.get("/dashboard/stats")
async def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_mock_user)  # Using mock user for development
):
    """Get overall dashboard statistics"""
    try:
        # Get total counts
        total_projects = db.query(Project).count()
        total_modules = db.query(Module).count()
        total_prompts = db.query(Prompt).count()
        total_templates = db.query(Template).count()

        # Get pending approvals
        pending_approvals = db.query(ApprovalRequest).filter(
            ApprovalRequest.status == "pending"
        ).count()

        # Get recent compatibility tests
        recent_tests = db.query(ModelCompatibility).filter(
            ModelCompatibility.created_at >= datetime.utcnow() - timedelta(days=7)
        ).count()

        # Get system health
        system_health = {
            "database": "healthy",
            "redis": "healthy",  # This would be checked with actual Redis ping
            "backend": "healthy"
        }

        return {
            "overview": {
                "total_projects": total_projects,
                "total_modules": total_modules,
                "total_prompts": total_prompts,
                "total_templates": total_templates,
                "pending_approvals": pending_approvals,
                "recent_tests": recent_tests
            },
            "system_health": system_health,
            "generated_at": datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error("Failed to get dashboard stats", error=str(e))
        return {
            "overview": {
                "total_projects": 0,
                "total_modules": 0,
                "total_prompts": 0,
                "total_templates": 0,
                "pending_approvals": 0,
                "recent_tests": 0
            },
            "system_health": {
                "database": "error",
                "redis": "error",
                "backend": "error"
            },
            "error": str(e),
            "generated_at": datetime.utcnow().isoformat()
        }