from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from datetime import datetime
import uuid

from app.database import get_db
from app.models import EvaluationRun, Template, AuditLog
from app.schemas import EvaluationRunCreate, EvaluationRunResponse, EvaluationsListResponse
from app.auth import get_current_user

router = APIRouter()

@router.get("", response_model=EvaluationsListResponse)
async def get_evaluations(
    request: Request,
    template_id: Optional[str] = Query(None, description="Filter by template ID"),
    limit: int = Query(50, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get evaluation runs with optional template filtering and pagination"""

    # Build query
    query = db.query(EvaluationRun)

    # Apply template filter if provided
    if template_id:
        query = query.filter(EvaluationRun.template_id == template_id)

    # Get total count for pagination
    total = query.count()

    # Apply pagination
    evaluations = query.order_by(EvaluationRun.created_at.desc()).offset(offset).limit(limit).all()

    return {
        "evaluations": evaluations,
        "total": total,
        "limit": limit,
        "offset": offset,
        "has_more": offset + limit < total
    }

@router.post("/run", response_model=EvaluationRunResponse)
async def run_evaluation(
    eval_data: EvaluationRunCreate,
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Run evaluation suite against template version"""
    
    # Check if template version exists
    template = db.query(Template).filter(
        Template.id == eval_data.template_id,
        Template.version == eval_data.version
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template version not found")
    
    # TODO: Implement actual evaluation logic
    # For now, simulate evaluation results
    eval_id = str(uuid.uuid4())
    metrics = {
        "accuracy": 0.85,
        "latency_ms": 150,
        "cost_usd": 0.0023,
        "pass_rate": 0.92
    }
    
    # Simple pass/fail logic based on thresholds
    passed = (
        metrics["accuracy"] >= 0.8 and
        metrics["latency_ms"] <= 200 and
        metrics["cost_usd"] <= 0.005
    )
    
    # Create evaluation run record
    eval_run = EvaluationRun(
        id=eval_id,
        template_id=eval_data.template_id,
        version=eval_data.version,
        suite_id=eval_data.suite_id,
        metrics_json=metrics,
        passed=passed,
        created_at=datetime.utcnow()
    )
    
    db.add(eval_run)
    db.commit()
    db.refresh(eval_run)
    
    # Log the evaluation
    audit_log = AuditLog(
        id=str(uuid.uuid4()),
        actor=current_user["user_id"],
        action="run_evaluation",
        subject=f"{eval_data.template_id}@{eval_data.version}",
        before_json=None,
        after_json={"eval_id": eval_id, "passed": passed}
    )
    db.add(audit_log)
    db.commit()
    
    return eval_run

@router.get("/{eval_id}", response_model=EvaluationRunResponse)
async def get_evaluation(
    eval_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get evaluation run status and metrics"""
    
    eval_run = db.query(EvaluationRun).filter(EvaluationRun.id == eval_id).first()
    if not eval_run:
        raise HTTPException(status_code=404, detail="Evaluation run not found")
    
    return eval_run