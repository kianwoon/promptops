"""
A/B Testing Framework API Router
"""

from fastapi import APIRouter, Depends, HTTPException, Body, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, select
from typing import List, Optional, Dict, Any
import uuid
import json
import hashlib
from datetime import datetime, timezone, timedelta
import logging

from app.database import get_db
from app.models import (
    Experiment, ExperimentAssignment, ExperimentEvent, ExperimentResult,
    FeatureFlag, UserSegment, Project, Prompt, User, ExperimentStatus,
    TrafficAllocationStrategy, EventType
)
from app.schemas import (
    ExperimentCreate, ExperimentUpdate, ExperimentResponse, ExperimentStats,
    ExperimentAssignmentCreate, ExperimentAssignmentResponse,
    ExperimentEventCreate, ExperimentEventResponse, ExperimentResultResponse,
    FeatureFlagCreate, FeatureFlagUpdate, FeatureFlagResponse,
    UserSegmentCreate, UserSegmentUpdate, UserSegmentResponse,
    VariantPerformance
)
from app.auth import get_current_user
from app.auth.rbac import rbac_service, Permission
from app.services.auth_service import AuthService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ab-testing", tags=["ab-testing"])

# Experiment Management Endpoints

@router.post("/experiments", response_model=ExperimentResponse, status_code=201)
async def create_experiment(
    experiment: ExperimentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new A/B testing experiment"""

    # Verify project exists and user has access
    project = db.query(Project).filter(Project.id == experiment.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Verify prompt exists
    prompt = db.query(Prompt).filter(Prompt.id == experiment.prompt_id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")

    # Calculate total weights for validation
    total_weight = experiment.control_variant.weight + sum(v.weight for v in experiment.treatment_variants)
    if total_weight == 0:
        raise HTTPException(status_code=400, detail="Total variant weights must be greater than 0")

    # Create experiment
    experiment_data = experiment.model_dump()
    experiment_data['created_by'] = current_user.id
    experiment_data['status'] = ExperimentStatus.DRAFT

    # Convert variants to JSON
    experiment_data['control_variant'] = experiment.control_variant.model_dump()
    experiment_data['treatment_variants'] = [v.model_dump() for v in experiment.treatment_variants]

    db_experiment = Experiment(**experiment_data)
    db.add(db_experiment)
    db.commit()
    db.refresh(db_experiment)

    logger.info(f"Created experiment {db_experiment.id} for project {project.id}")
    return db_experiment

@router.get("/experiments", response_model=List[ExperimentResponse])
async def list_experiments(
    project_id: Optional[str] = Query(None),
    prompt_id: Optional[str] = Query(None),
    status: Optional[ExperimentStatus] = Query(None),
    limit: int = Query(100, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List experiments with optional filters"""

    query = db.query(Experiment)

    # Apply filters
    if project_id:
        query = query.filter(Experiment.project_id == project_id)
    if prompt_id:
        query = query.filter(Experiment.prompt_id == prompt_id)
    if status:
        query = query.filter(Experiment.status == status)

    # Apply pagination
    experiments = query.order_by(Experiment.created_at.desc()).offset(offset).limit(limit).all()

    return experiments

@router.get("/experiments/{experiment_id}", response_model=ExperimentResponse)
async def get_experiment(
    experiment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get experiment details"""

    experiment = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")

    return experiment

@router.put("/experiments/{experiment_id}", response_model=ExperimentResponse)
async def update_experiment(
    experiment_id: str,
    experiment_update: ExperimentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update experiment"""

    experiment = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")

    # Validate status transitions
    if experiment_update.status:
        if experiment.status == ExperimentStatus.COMPLETED and experiment_update.status != ExperimentStatus.COMPLETED:
            raise HTTPException(status_code=400, detail="Cannot change status of completed experiment")

        if experiment.status == ExperimentStatus.RUNNING and experiment_update.status == ExperimentStatus.DRAFT:
            raise HTTPException(status_code=400, detail="Cannot move running experiment back to draft")

    # Update fields
    update_data = experiment_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(experiment, field, value)

    experiment.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(experiment)

    logger.info(f"Updated experiment {experiment_id}")
    return experiment

@router.delete("/experiments/{experiment_id}")
async def delete_experiment(
    experiment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete experiment"""

    experiment = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")

    if experiment.status == ExperimentStatus.RUNNING:
        raise HTTPException(status_code=400, detail="Cannot delete running experiment")

    db.delete(experiment)
    db.commit()

    logger.info(f"Deleted experiment {experiment_id}")
    return {"message": "Experiment deleted successfully"}

@router.post("/experiments/{experiment_id}/start")
async def start_experiment(
    experiment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Start an experiment"""

    experiment = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")

    if experiment.status != ExperimentStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Experiment must be in draft status to start")

    experiment.status = ExperimentStatus.RUNNING
    experiment.start_time = datetime.now(timezone.utc)
    experiment.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(experiment)

    logger.info(f"Started experiment {experiment_id}")
    return {"message": "Experiment started successfully"}

@router.post("/experiments/{experiment_id}/pause")
async def pause_experiment(
    experiment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Pause a running experiment"""

    experiment = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")

    if experiment.status != ExperimentStatus.RUNNING:
        raise HTTPException(status_code=400, detail="Experiment must be running to pause")

    experiment.status = ExperimentStatus.PAUSED
    experiment.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(experiment)

    logger.info(f"Paused experiment {experiment_id}")
    return {"message": "Experiment paused successfully"}

@router.post("/experiments/{experiment_id}/complete")
async def complete_experiment(
    experiment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Complete an experiment and calculate results"""

    experiment = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")

    if experiment.status not in [ExperimentStatus.RUNNING, ExperimentStatus.PAUSED]:
        raise HTTPException(status_code=400, detail="Experiment must be running or paused to complete")

    # Calculate final results
    results = await calculate_experiment_results(experiment_id, db)

    experiment.status = ExperimentStatus.COMPLETED
    experiment.end_time = datetime.now(timezone.utc)
    experiment.results = results
    experiment.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(experiment)

    logger.info(f"Completed experiment {experiment_id}")
    return {"message": "Experiment completed successfully", "results": results}

# Experiment Assignment Endpoints

@router.post("/assignments", response_model=ExperimentAssignmentResponse, status_code=201)
async def create_assignment(
    assignment: ExperimentAssignmentCreate,
    db: Session = Depends(get_db)
):
    """Create an experiment assignment for a user/session"""

    # Verify experiment exists and is running
    experiment = db.query(Experiment).filter(
        and_(
            Experiment.id == assignment.experiment_id,
            Experiment.status == ExperimentStatus.RUNNING
        )
    ).first()

    if not experiment:
        raise HTTPException(status_code=404, detail="Active experiment not found")

    # Check if assignment already exists for this session
    existing_assignment = db.query(ExperimentAssignment).filter(
        and_(
            ExperimentAssignment.experiment_id == assignment.experiment_id,
            ExperimentAssignment.session_id == assignment.session_id
        )
    ).first()

    if existing_assignment and existing_assignment.is_consistent:
        return existing_assignment

    # Create new assignment
    assignment_data = assignment.model_dump()
    db_assignment = ExperimentAssignment(**assignment_data)
    db.add(db_assignment)
    db.commit()
    db.refresh(db_assignment)

    return db_assignment

@router.get("/assignments/{session_id}", response_model=List[ExperimentAssignmentResponse])
async def get_session_assignments(
    session_id: str,
    experiment_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Get all assignments for a session"""

    query = db.query(ExperimentAssignment).filter(ExperimentAssignment.session_id == session_id)

    if experiment_id:
        query = query.filter(ExperimentAssignment.experiment_id == experiment_id)

    assignments = query.order_by(ExperimentAssignment.assigned_at.desc()).all()
    return assignments

# Event Tracking Endpoints

@router.post("/events", response_model=ExperimentEventResponse, status_code=201)
async def track_event(
    event: ExperimentEventCreate,
    db: Session = Depends(get_db)
):
    """Track an event for A/B testing analytics"""

    # Verify experiment exists
    experiment = db.query(Experiment).filter(Experiment.id == event.experiment_id).first()
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")

    # If assignment_id is provided, verify it exists
    if event.assignment_id:
        assignment = db.query(ExperimentAssignment).filter(
            ExperimentAssignment.id == event.assignment_id
        ).first()
        if not assignment:
            raise HTTPException(status_code=404, detail="Assignment not found")

    # Create event
    event_data = event.model_dump()
    if event_data.get('occurred_at') is None:
        event_data['occurred_at'] = datetime.now(timezone.utc)

    db_event = ExperimentEvent(**event_data)
    db.add(db_event)
    db.commit()
    db.refresh(db_event)

    return db_event

@router.get("/events", response_model=List[ExperimentEventResponse])
async def list_events(
    experiment_id: str,
    event_type: Optional[EventType] = Query(None),
    user_id: Optional[str] = Query(None),
    session_id: Optional[str] = Query(None),
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    limit: int = Query(1000, le=10000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List events for analytics"""

    query = db.query(ExperimentEvent).filter(ExperimentEvent.experiment_id == experiment_id)

    # Apply filters
    if event_type:
        query = query.filter(ExperimentEvent.event_type == event_type)
    if user_id:
        query = query.filter(ExperimentEvent.user_id == user_id)
    if session_id:
        query = query.filter(ExperimentEvent.session_id == session_id)
    if start_time:
        query = query.filter(ExperimentEvent.occurred_at >= start_time)
    if end_time:
        query = query.filter(ExperimentEvent.occurred_at <= end_time)

    # Apply pagination
    events = query.order_by(ExperimentEvent.occurred_at.desc()).offset(offset).limit(limit).all()

    return events

# Analytics and Results Endpoints

@router.get("/experiments/{experiment_id}/results", response_model=List[ExperimentResultResponse])
async def get_experiment_results(
    experiment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get calculated results for an experiment"""

    experiment = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")

    results = db.query(ExperimentResult).filter(ExperimentResult.experiment_id == experiment_id).all()
    return results

@router.get("/experiments/{experiment_id}/performance", response_model=List[VariantPerformance])
async def get_variant_performance(
    experiment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get performance metrics for each variant"""

    experiment = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")

    # Calculate performance metrics
    performance_metrics = await calculate_variant_performance(experiment_id, db)
    return performance_metrics

@router.get("/stats", response_model=ExperimentStats)
async def get_ab_testing_stats(
    project_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get A/B testing statistics"""

    # Base query
    experiment_query = db.query(Experiment)
    event_query = db.query(ExperimentEvent)
    assignment_query = db.query(ExperimentAssignment)

    if project_id:
        experiment_query = experiment_query.filter(Experiment.project_id == project_id)
        # Need to join with experiments for events and assignments
        event_query = event_query.join(Experiment, ExperimentEvent.experiment_id == Experiment.id)
        assignment_query = assignment_query.join(Experiment, ExperimentAssignment.experiment_id == Experiment.id)
        event_query = event_query.filter(Experiment.project_id == project_id)
        assignment_query = assignment_query.filter(Experiment.project_id == project_id)

    # Calculate statistics
    total_experiments = experiment_query.count()
    active_experiments = experiment_query.filter(Experiment.status == ExperimentStatus.RUNNING).count()
    completed_experiments = experiment_query.filter(Experiment.status == ExperimentStatus.COMPLETED).count()
    total_events = event_query.count()
    total_assignments = assignment_query.count()

    # Experiments by project
    if project_id:
        experiments_by_project = {project_id: total_experiments}
    else:
        experiments_by_project = {}
        project_counts = db.query(Experiment.project_id, func.count(Experiment.id)).group_by(Experiment.project_id).all()
        experiments_by_project = {pid: count for pid, count in project_counts}

    # Events by type
    events_by_type = {}
    type_counts = db.query(ExperimentEvent.event_type, func.count(ExperimentEvent.id)).group_by(ExperimentEvent.event_type).all()
    events_by_type = {str(et): count for et, count in type_counts}

    return ExperimentStats(
        total_experiments=total_experiments,
        active_experiments=active_experiments,
        completed_experiments=completed_experiments,
        total_events=total_events,
        total_assignments=total_assignments,
        experiments_by_project=experiments_by_project,
        events_by_type=events_by_type
    )

# Feature Flag Endpoints

@router.post("/feature-flags", response_model=FeatureFlagResponse, status_code=201)
async def create_feature_flag(
    feature_flag: FeatureFlagCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new feature flag"""

    # Verify project exists
    project = db.query(Project).filter(Project.id == feature_flag.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Check if feature flag name already exists
    existing = db.query(FeatureFlag).filter(FeatureFlag.name == feature_flag.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Feature flag with this name already exists")

    feature_flag_data = feature_flag.model_dump()
    feature_flag_data['created_by'] = current_user.id

    db_feature_flag = FeatureFlag(**feature_flag_data)
    db.add(db_feature_flag)
    db.commit()
    db.refresh(db_feature_flag)

    logger.info(f"Created feature flag {db_feature_flag.name} for project {project.id}")
    return db_feature_flag

@router.get("/feature-flags", response_model=List[FeatureFlagResponse])
async def list_feature_flags(
    project_id: Optional[str] = Query(None),
    enabled: Optional[bool] = Query(None),
    limit: int = Query(100, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List feature flags"""

    query = db.query(FeatureFlag)

    # Apply filters
    if project_id:
        query = query.filter(FeatureFlag.project_id == project_id)
    if enabled is not None:
        query = query.filter(FeatureFlag.enabled == enabled)

    # Apply pagination
    feature_flags = query.order_by(FeatureFlag.created_at.desc()).offset(offset).limit(limit).all()

    return feature_flags

@router.get("/feature-flags/{feature_flag_id}", response_model=FeatureFlagResponse)
async def get_feature_flag(
    feature_flag_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get feature flag details"""

    feature_flag = db.query(FeatureFlag).filter(FeatureFlag.id == feature_flag_id).first()
    if not feature_flag:
        raise HTTPException(status_code=404, detail="Feature flag not found")

    return feature_flag

@router.put("/feature-flags/{feature_flag_id}", response_model=FeatureFlagResponse)
async def update_feature_flag(
    feature_flag_id: str,
    feature_flag_update: FeatureFlagUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update feature flag"""

    feature_flag = db.query(FeatureFlag).filter(FeatureFlag.id == feature_flag_id).first()
    if not feature_flag:
        raise HTTPException(status_code=404, detail="Feature flag not found")

    # Update fields
    update_data = feature_flag_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(feature_flag, field, value)

    feature_flag.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(feature_flag)

    logger.info(f"Updated feature flag {feature_flag_id}")
    return feature_flag

# User Segment Endpoints

@router.post("/user-segments", response_model=UserSegmentResponse, status_code=201)
async def create_user_segment(
    segment: UserSegmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new user segment"""

    # Verify project exists
    project = db.query(Project).filter(Project.id == segment.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    segment_data = segment.model_dump()
    segment_data['created_by'] = current_user.id

    db_segment = UserSegment(**segment_data)
    db.add(db_segment)
    db.commit()
    db.refresh(db_segment)

    logger.info(f"Created user segment {db_segment.name} for project {project.id}")
    return db_segment

@router.get("/user-segments", response_model=List[UserSegmentResponse])
async def list_user_segments(
    project_id: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    limit: int = Query(100, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List user segments"""

    query = db.query(UserSegment)

    # Apply filters
    if project_id:
        query = query.filter(UserSegment.project_id == project_id)
    if is_active is not None:
        query = query.filter(UserSegment.is_active == is_active)

    # Apply pagination
    segments = query.order_by(UserSegment.created_at.desc()).offset(offset).limit(limit).all()

    return segments

# Helper functions

async def calculate_experiment_results(experiment_id: str, db: Session) -> Dict[str, Any]:
    """Calculate statistical results for an experiment"""

    # Get all events for this experiment
    events = db.query(ExperimentEvent).filter(ExperimentEvent.experiment_id == experiment_id).all()

    # Group events by variant
    variant_events = {}
    for event in events:
        # Find the assignment for this event
        if event.assignment_id:
            assignment = db.query(ExperimentAssignment).filter(
                ExperimentAssignment.id == event.assignment_id
            ).first()
            if assignment:
                variant_id = assignment.variant_id
                if variant_id not in variant_events:
                    variant_events[variant_id] = []
                variant_events[variant_id].append(event)

    # Calculate metrics for each variant
    results = {}
    for variant_id, variant_event_list in variant_events.items():
        conversion_events = [e for e in variant_event_list if e.event_type == EventType.CONVERSION]
        sample_size = len(variant_event_list)
        conversion_count = len(conversion_events)
        conversion_rate = conversion_count / sample_size if sample_size > 0 else 0

        results[variant_id] = {
            "sample_size": sample_size,
            "conversion_count": conversion_count,
            "conversion_rate": conversion_rate,
            "events": len(variant_event_list)
        }

    return results

async def calculate_variant_performance(experiment_id: str, db: Session) -> List[VariantPerformance]:
    """Calculate performance metrics for each variant"""

    # This is a simplified implementation
    # In production, you'd want to use proper statistical libraries

    experiment = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if not experiment:
        return []

    # Get all events and assignments
    events = db.query(ExperimentEvent).filter(ExperimentEvent.experiment_id == experiment_id).all()
    assignments = db.query(ExperimentAssignment).filter(ExperimentAssignment.experiment_id == experiment_id).all()

    # Group by variant
    variant_stats = {}
    for assignment in assignments:
        variant_id = assignment.variant_id
        if variant_id not in variant_stats:
            variant_stats[variant_id] = {
                "sample_size": 0,
                "conversions": 0,
                "variant_name": assignment.variant_name
            }
        variant_stats[variant_id]["sample_size"] += 1

    # Count conversions
    for event in events:
        if event.assignment_id and event.event_type == EventType.CONVERSION:
            assignment = db.query(ExperimentAssignment).filter(
                ExperimentAssignment.id == event.assignment_id
            ).first()
            if assignment:
                variant_id = assignment.variant_id
                if variant_id in variant_stats:
                    variant_stats[variant_id]["conversions"] += 1

    # Convert to VariantPerformance objects
    performance_list = []
    for variant_id, stats in variant_stats.items():
        conversion_rate = stats["conversions"] / stats["sample_size"] if stats["sample_size"] > 0 else 0

        performance = VariantPerformance(
            variant_id=variant_id,
            variant_name=stats["variant_name"],
            sample_size=stats["sample_size"],
            conversion_rate=conversion_rate,
            confidence_interval_lower=0,  # Placeholder
            confidence_interval_upper=0,  # Placeholder
            p_value=0.5,  # Placeholder
            is_winner=False,  # Placeholder
            improvement_over_control=0  # Placeholder
        )
        performance_list.append(performance)

    return performance_list