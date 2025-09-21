from fastapi import APIRouter, Depends, HTTPException, Body, Query, Path
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
import logging
from jose import jwt

from app.database import get_db
from app.auth.rbac import rbac_service, get_rbac_service, Permission, UserRole
from app.models import (
    WorkflowDefinition, WorkflowInstance, WorkflowStep, WorkflowTemplate,
    WorkflowStatus, WorkflowInstanceStatus, WorkflowStepType, WorkflowTemplateStatus,
    PermissionTemplate, RolePermission, User
)
from app.auth import get_current_user_or_demo as get_current_user
from app.services.auth_service import AuthService
from fastapi import Request, HTTPException, status

# Configure logging for authentication debugging
logger = logging.getLogger(__name__)

async def check_design_approval_flows_permission(
    current_user: dict = Depends(get_current_user)
):
    """Check if user has permission to design approval flows"""
    try:
        user_roles = current_user.get("roles", [])
        if not rbac_service.can_perform_action(
            user_roles=user_roles,
            action=Permission.DESIGN_APPROVAL_FLOWS.value,
            resource_type="workflow"
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin privileges required to design approval flows"
            )
        return current_user
    except Exception as e:
        logger.error(f"Permission check failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission check failed"
        )


router = APIRouter()


# Enum transformation utilities
def transform_frontend_step_type_to_backend(step_type: str) -> str:
    """Transform frontend step type to database enum format"""
    step_type_mapping = {
        'manual_approval': 'MANUAL_APPROVAL',
        'automated_approval': 'AUTOMATED_APPROVAL',
        'parallel_approval': 'PARALLEL_APPROVAL',
        'sequential_approval': 'SEQUENTIAL_APPROVAL',
        'conditional_approval': 'CONDITIONAL_APPROVAL',
        'notification': 'NOTIFICATION',
        'data_collection': 'DATA_COLLECTION',
        'external_system': 'EXTERNAL_SYSTEM',
        'timer': 'TIMER',
        'escalation': 'ESCALATION'
    }
    return step_type_mapping.get(step_type, step_type)

def transform_backend_step_type_to_frontend(step_type: str) -> str:
    """Transform database enum format to frontend step type"""
    step_type_mapping = {
        'MANUAL_APPROVAL': 'manual_approval',
        'AUTOMATED_APPROVAL': 'automated_approval',
        'PARALLEL_APPROVAL': 'parallel_approval',
        'SEQUENTIAL_APPROVAL': 'sequential_approval',
        'CONDITIONAL_APPROVAL': 'conditional_approval',
        'NOTIFICATION': 'notification',
        'DATA_COLLECTION': 'data_collection',
        'EXTERNAL_SYSTEM': 'external_system',
        'TIMER': 'timer',
        'ESCALATION': 'escalation'
    }
    return step_type_mapping.get(step_type, step_type)

def transform_steps_for_database(steps: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Transform steps for database storage with proper enum values"""
    import logging
    logger = logging.getLogger(__name__)

    logger.info(f"🔍 [DEBUG] transform_steps_for_database input: {steps}")

    transformed_steps = []
    for step in steps:
        transformed_step = step.copy()
        if 'step_type' in transformed_step:
            transformed_step['step_type'] = transform_frontend_step_type_to_backend(transformed_step['step_type'])

        # Ensure approval_roles is preserved
        if 'approval_roles' in transformed_step:
            logger.info(f"🔍 [DEBUG] Preserving approval_roles for step {transformed_step.get('name', 'unknown')}: {transformed_step['approval_roles']}")
        elif 'assigned_roles' in transformed_step:
            # Map assigned_roles to approval_roles for database
            transformed_step['approval_roles'] = transformed_step['assigned_roles']
            logger.info(f"🔍 [DEBUG] Mapped assigned_roles to approval_roles: {transformed_step['approval_roles']}")

        transformed_steps.append(transformed_step)

    logger.info(f"🔍 [DEBUG] transform_steps_for_database output: {transformed_steps}")
    return transformed_steps

def transform_steps_for_frontend(steps: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Transform steps for frontend response with proper enum values"""
    import logging
    logger = logging.getLogger(__name__)

    logger.info(f"🔍 [DEBUG] transform_steps_for_frontend input: {steps}")

    transformed_steps = []
    for step in steps:
        transformed_step = step.copy()
        if 'step_type' in transformed_step:
            transformed_step['step_type'] = transform_backend_step_type_to_frontend(transformed_step['step_type'])

        # Ensure approval_roles is preserved for frontend
        if 'approval_roles' in transformed_step:
            logger.info(f"🔍 [DEBUG] Preserving approval_roles for frontend step {transformed_step.get('name', 'unknown')}: {transformed_step['approval_roles']}")
        else:
            logger.warning(f"🔍 [DEBUG] Missing approval_roles in step {transformed_step.get('name', 'unknown')}: {transformed_step}")

        transformed_steps.append(transformed_step)

    logger.info(f"🔍 [DEBUG] transform_steps_for_frontend output: {transformed_steps}")
    return transformed_steps

# Schema definitions for approval flows
class ApprovalFlowCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category: str = "approval"
    trigger_condition: Dict[str, Any]
    steps: List[Dict[str, Any]]
    timeout_minutes: int = 1440
    requires_evidence: bool = False
    auto_approve_threshold: Optional[int] = None
    escalation_rules: Optional[List[Dict[str, Any]]] = None
    notification_settings: Optional[Dict[str, Any]] = None

class ApprovalFlowUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    trigger_condition: Optional[Dict[str, Any]] = None
    steps: Optional[List[Dict[str, Any]]] = None
    timeout_minutes: Optional[int] = None
    requires_evidence: Optional[bool] = None
    auto_approve_threshold: Optional[int] = None
    escalation_rules: Optional[List[Dict[str, Any]]] = None
    notification_settings: Optional[Dict[str, Any]] = None
    status: Optional[str] = None

class ApprovalFlowResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    version: str
    status: str
    category: str
    trigger_condition: Dict[str, Any]
    steps: List[Dict[str, Any]]
    timeout_minutes: int
    requires_evidence: bool
    auto_approve_threshold: Optional[int]
    escalation_rules: Optional[List[Dict[str, Any]]]
    notification_settings: Optional[Dict[str, Any]]
    created_by: str
    created_at: datetime
    updated_at: datetime
    tenant_id: str

class ApprovalFlowStats(BaseModel):
    total_flows: int
    active_flows: int
    draft_flows: int
    archived_flows: int
    total_instances: int
    active_instances: int
    completed_instances: int
    avg_completion_time_minutes: Optional[float]
    approval_rate: float

class StepTemplateResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    step_type: str
    category: str
    config: Dict[str, Any]
    is_system: bool
    usage_count: int

class ValidationResponse(BaseModel):
    is_valid: bool
    errors: List[str]
    warnings: List[str]
    suggestions: List[str]

@router.get("/flows", response_model=List[ApprovalFlowResponse])
async def list_approval_flows(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    tenant_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all approval flows with pagination and filtering"""
    try:
        query = db.query(WorkflowDefinition).filter(
            WorkflowDefinition.category == "approval"
        )

        # Apply filters
        if status:
            query = query.filter(WorkflowDefinition.status == status)
        if category:
            query = query.filter(WorkflowDefinition.category == category)
        if tenant_id:
            query = query.filter(WorkflowDefinition.tenant_id == tenant_id)
        elif "admin" in current_user.get("roles", []):
            # Admin users can see all flows across all tenants
            pass  # No tenant filtering for admin users
        else:
            query = query.filter(WorkflowDefinition.tenant_id == current_user.get("tenant", "demo-tenant"))

        if search:
            query = query.filter(
                WorkflowDefinition.name.ilike(f"%{search}%") |
                WorkflowDefinition.description.ilike(f"%{search}%")
            )

        # Apply pagination
        flows = query.order_by(WorkflowDefinition.created_at.desc()).offset(skip).limit(limit).all()

        return [
            ApprovalFlowResponse(
                id=flow.id,
                name=flow.name,
                description=flow.description,
                version=flow.version,
                status=flow.status.value,
                category=flow.category,
                trigger_condition=flow.trigger_condition,
                steps=transform_steps_for_frontend(flow.steps_json),
                timeout_minutes=flow.timeout_minutes,
                requires_evidence=flow.requires_evidence,
                auto_approve_threshold=flow.auto_approve_threshold,
                escalation_rules=flow.escalation_rules,
                notification_settings=flow.notification_settings,
                created_by=flow.created_by,
                created_at=flow.created_at,
                updated_at=flow.updated_at,
                tenant_id=flow.tenant_id
            )
            for flow in flows
        ]

    except Exception as e:
        error_msg = str(e)
        logger.error(f"ERROR listing approval flows: {error_msg}")
        raise HTTPException(status_code=500, detail=f"Failed to list approval flows: {error_msg}")

@router.post("/flows", response_model=ApprovalFlowResponse)
async def create_approval_flow(
    flow_data: ApprovalFlowCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(check_design_approval_flows_permission)
):
    """Create a new approval flow"""
    try:
        # Generate unique ID and version
        flow_id = str(uuid.uuid4())
        version = "1.0"

        # Transform steps for database storage with proper enum values
        transformed_steps = transform_steps_for_database(flow_data.steps)

        # Use fixed user values for now
        user_id = "3683610"
        tenant_id = "default-tenant"

        # Create workflow definition
        workflow_def = WorkflowDefinition(
            id=flow_id,
            name=flow_data.name,
            description=flow_data.description,
            version=version,
            status=WorkflowStatus.DRAFT,
            category=flow_data.category,
            trigger_condition=flow_data.trigger_condition,
            steps_json=transformed_steps,
            timeout_minutes=flow_data.timeout_minutes,
            requires_evidence=flow_data.requires_evidence,
            auto_approve_threshold=flow_data.auto_approve_threshold,
            escalation_rules=flow_data.escalation_rules,
            notification_settings=flow_data.notification_settings,
            created_by=user_id,
            updated_by=user_id,
            tenant_id=tenant_id
        )

        db.add(workflow_def)
        db.commit()
        db.refresh(workflow_def)

        # Transform steps back to frontend format for response
        frontend_steps = transform_steps_for_frontend(workflow_def.steps_json)

        return ApprovalFlowResponse(
            id=workflow_def.id,
            name=workflow_def.name,
            description=workflow_def.description,
            version=workflow_def.version,
            status=workflow_def.status.value,
            category=workflow_def.category,
            trigger_condition=workflow_def.trigger_condition,
            steps=frontend_steps,
            timeout_minutes=workflow_def.timeout_minutes,
            requires_evidence=workflow_def.requires_evidence,
            auto_approve_threshold=workflow_def.auto_approve_threshold,
            escalation_rules=workflow_def.escalation_rules,
            notification_settings=workflow_def.notification_settings,
            created_by=workflow_def.created_by,
            created_at=workflow_def.created_at,
            updated_at=workflow_def.updated_at,
            tenant_id=workflow_def.tenant_id
        )

    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Validation error: {str(e)}")
    except Exception as e:
        db.rollback()
        error_msg = str(e)
        # Log the full error for debugging
        logger.error(f"ERROR creating approval flow: {error_msg}")
        # Provide more specific error messages for common issues
        if "duplicate key value violates unique constraint" in error_msg:
            if "uq_workflow_name_version_tenant" in error_msg:
                raise HTTPException(status_code=409, detail="An approval flow with this name already exists. Please use a different name.")
            else:
                raise HTTPException(status_code=409, detail="A duplicate entry was found. Please check your data and try again.")
        elif "foreign key constraint" in error_msg:
            raise HTTPException(status_code=400, detail="Invalid reference data. Please check that all referenced items exist.")
        elif "check constraint" in error_msg:
            raise HTTPException(status_code=400, detail="Invalid data format. Please check your input values.")
        else:
            raise HTTPException(status_code=500, detail=f"Failed to create approval flow: {error_msg}")

@router.put("/flows/{flow_id}", response_model=ApprovalFlowResponse)
async def update_approval_flow(
    flow_id: str,
    flow_data: ApprovalFlowUpdate,
    current_user: dict = Depends(check_design_approval_flows_permission),
    db: Session = Depends(get_db)
):
    """Update an existing approval flow"""
    try:
        # Get the workflow definition
        workflow_def = db.query(WorkflowDefinition).filter(
            WorkflowDefinition.id == flow_id,
            WorkflowDefinition.tenant_id == current_user.get("tenant")
        ).first()

        if not workflow_def:
            raise HTTPException(status_code=404, detail="Approval flow not found")

        # Update fields
        if flow_data.name is not None:
            workflow_def.name = flow_data.name
        if flow_data.description is not None:
            workflow_def.description = flow_data.description
        if flow_data.trigger_condition is not None:
            workflow_def.trigger_condition = flow_data.trigger_condition
        if flow_data.steps is not None:
            # Transform steps for database storage with proper enum values
            workflow_def.steps_json = transform_steps_for_database(flow_data.steps)
        if flow_data.timeout_minutes is not None:
            workflow_def.timeout_minutes = flow_data.timeout_minutes
        if flow_data.requires_evidence is not None:
            workflow_def.requires_evidence = flow_data.requires_evidence
        if flow_data.auto_approve_threshold is not None:
            workflow_def.auto_approve_threshold = flow_data.auto_approve_threshold
        if flow_data.escalation_rules is not None:
            workflow_def.escalation_rules = flow_data.escalation_rules
        if flow_data.notification_settings is not None:
            workflow_def.notification_settings = flow_data.notification_settings
        if flow_data.status is not None:
            try:
                workflow_def.status = WorkflowStatus(flow_data.status)
            except ValueError as e:
                raise HTTPException(
                    status_code=422,
                    detail=f"Invalid status '{flow_data.status}'. Valid statuses are: {[s.value for s in WorkflowStatus]}"
                )

        workflow_def.updated_by = current_user["user_id"]

        db.commit()
        db.refresh(workflow_def)

        # Transform steps back to frontend format for response
        frontend_steps = transform_steps_for_frontend(workflow_def.steps_json)

        return ApprovalFlowResponse(
            id=workflow_def.id,
            name=workflow_def.name,
            description=workflow_def.description,
            version=workflow_def.version,
            status=workflow_def.status.value,
            category=workflow_def.category,
            trigger_condition=workflow_def.trigger_condition,
            steps=frontend_steps,
            timeout_minutes=workflow_def.timeout_minutes,
            requires_evidence=workflow_def.requires_evidence,
            auto_approve_threshold=workflow_def.auto_approve_threshold,
            escalation_rules=workflow_def.escalation_rules,
            notification_settings=workflow_def.notification_settings,
            created_by=workflow_def.created_by,
            created_at=workflow_def.created_at,
            updated_at=workflow_def.updated_at,
            tenant_id=workflow_def.tenant_id
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        error_msg = str(e)
        # Log the full error for debugging
        logger.error(f"ERROR updating approval flow: {error_msg}")
        # Provide more specific error messages for common issues
        if "duplicate key value violates unique constraint" in error_msg:
            if "uq_workflow_name_version_tenant" in error_msg:
                raise HTTPException(status_code=409, detail="An approval flow with this name already exists. Please use a different name.")
            else:
                raise HTTPException(status_code=409, detail="A duplicate entry was found. Please check your data and try again.")
        elif "foreign key constraint" in error_msg:
            raise HTTPException(status_code=400, detail="Invalid reference data. Please check that all referenced items exist.")
        elif "check constraint" in error_msg:
            raise HTTPException(status_code=400, detail="Invalid data format. Please check your input values.")
        else:
            raise HTTPException(status_code=500, detail=f"Failed to update approval flow: {error_msg}")

@router.get("/flows/{flow_id}", response_model=ApprovalFlowResponse)
async def get_approval_flow(
    flow_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific approval flow by ID"""
    try:
        workflow_def = db.query(WorkflowDefinition).filter(
            WorkflowDefinition.id == flow_id,
            WorkflowDefinition.tenant_id == current_user.get("tenant")
        ).first()

        if not workflow_def:
            raise HTTPException(status_code=404, detail="Approval flow not found")

        # Transform steps back to frontend format for response
        frontend_steps = transform_steps_for_frontend(workflow_def.steps_json)

        return ApprovalFlowResponse(
            id=workflow_def.id,
            name=workflow_def.name,
            description=workflow_def.description,
            version=workflow_def.version,
            status=workflow_def.status.value,
            category=workflow_def.category,
            trigger_condition=workflow_def.trigger_condition,
            steps=frontend_steps,
            timeout_minutes=workflow_def.timeout_minutes,
            requires_evidence=workflow_def.requires_evidence,
            auto_approve_threshold=workflow_def.auto_approve_threshold,
            escalation_rules=workflow_def.escalation_rules,
            notification_settings=workflow_def.notification_settings,
            created_by=workflow_def.created_by,
            created_at=workflow_def.created_at,
            updated_at=workflow_def.updated_at,
            tenant_id=workflow_def.tenant_id
        )

    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        logger.error(f"ERROR getting approval flow: {error_msg}")
        raise HTTPException(status_code=500, detail=f"Failed to get approval flow: {error_msg}")

@router.delete("/flows/{flow_id}")
async def delete_approval_flow(
    flow_id: str,
    current_user: dict = Depends(check_design_approval_flows_permission),
    db: Session = Depends(get_db)
):
    """Delete an approval flow"""
    try:
        workflow_def = db.query(WorkflowDefinition).filter(
            WorkflowDefinition.id == flow_id,
            WorkflowDefinition.tenant_id == current_user.get("tenant")
        ).first()

        if not workflow_def:
            raise HTTPException(status_code=404, detail="Approval flow not found")

        # Check if there are active instances
        active_instances = db.query(WorkflowInstance).filter(
            WorkflowInstance.workflow_definition_id == flow_id,
            WorkflowInstance.status.in_([WorkflowInstanceStatus.PENDING, WorkflowInstanceStatus.IN_PROGRESS])
        ).count()

        if active_instances > 0:
            raise HTTPException(status_code=400, detail="Cannot delete flow with active instances")

        db.delete(workflow_def)
        db.commit()

        return {"message": "Approval flow deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        error_msg = str(e)
        logger.error(f"ERROR deleting approval flow: {error_msg}")
        raise HTTPException(status_code=500, detail=f"Failed to delete approval flow: {error_msg}")

@router.get("/stats", response_model=ApprovalFlowStats)
async def get_approval_flow_stats(
    tenant_id: Optional[str] = Query(None),
    days: int = Query(30, ge=1, le=365),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get approval flow statistics"""
    try:
        target_tenant = tenant_id or current_user.get("tenant")

        # Count flows by status
        total_flows = db.query(WorkflowDefinition).filter(
            WorkflowDefinition.category == "approval",
            WorkflowDefinition.tenant_id == target_tenant
        ).count()

        active_flows = db.query(WorkflowDefinition).filter(
            WorkflowDefinition.category == "approval",
            WorkflowDefinition.tenant_id == target_tenant,
            WorkflowDefinition.status == WorkflowStatus.ACTIVE
        ).count()

        draft_flows = db.query(WorkflowDefinition).filter(
            WorkflowDefinition.category == "approval",
            WorkflowDefinition.tenant_id == target_tenant,
            WorkflowDefinition.status == WorkflowStatus.DRAFT
        ).count()

        archived_flows = db.query(WorkflowDefinition).filter(
            WorkflowDefinition.category == "approval",
            WorkflowDefinition.tenant_id == target_tenant,
            WorkflowDefinition.status == WorkflowStatus.ARCHIVED
        ).count()

        # Count instances by status
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        total_instances = db.query(WorkflowInstance).filter(
            WorkflowInstance.tenant_id == target_tenant,
            WorkflowInstance.created_at >= cutoff_date
        ).count()

        active_instances = db.query(WorkflowInstance).filter(
            WorkflowInstance.tenant_id == target_tenant,
            WorkflowInstance.status.in_([WorkflowInstanceStatus.PENDING, WorkflowInstanceStatus.IN_PROGRESS]),
            WorkflowInstance.created_at >= cutoff_date
        ).count()

        completed_instances = db.query(WorkflowInstance).filter(
            WorkflowInstance.tenant_id == target_tenant,
            WorkflowInstance.status == WorkflowInstanceStatus.COMPLETED,
            WorkflowInstance.created_at >= cutoff_date
        ).count()

        # Calculate average completion time
        completed_with_time = db.query(WorkflowInstance).filter(
            WorkflowInstance.tenant_id == target_tenant,
            WorkflowInstance.status == WorkflowInstanceStatus.COMPLETED,
            WorkflowInstance.completed_at.isnot(None),
            WorkflowInstance.created_at >= cutoff_date
        ).all()

        avg_completion_time = None
        if completed_with_time:
            total_time = sum(
                (instance.completed_at - instance.created_at).total_seconds() / 60
                for instance in completed_with_time
            )
            avg_completion_time = total_time / len(completed_with_time)

        # Calculate approval rate
        total_decisions = db.query(WorkflowInstance).filter(
            WorkflowInstance.tenant_id == target_tenant,
            WorkflowInstance.status.in_([WorkflowInstanceStatus.COMPLETED, WorkflowInstanceStatus.REJECTED]),
            WorkflowInstance.created_at >= cutoff_date
        ).count()

        approval_rate = 0.0
        if total_decisions > 0:
            approvals = db.query(WorkflowInstance).filter(
                WorkflowInstance.tenant_id == target_tenant,
                WorkflowInstance.status == WorkflowInstanceStatus.COMPLETED,
                WorkflowInstance.created_at >= cutoff_date
            ).count()
            approval_rate = (approvals / total_decisions) * 100

        return ApprovalFlowStats(
            total_flows=total_flows,
            active_flows=active_flows,
            draft_flows=draft_flows,
            archived_flows=archived_flows,
            total_instances=total_instances,
            active_instances=active_instances,
            completed_instances=completed_instances,
            avg_completion_time_minutes=avg_completion_time,
            approval_rate=approval_rate
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get approval flow stats: {str(e)}")

@router.post("/flows/validate", response_model=ValidationResponse)
async def validate_approval_flow(
    flow_data: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Validate an approval flow configuration"""
    try:
        errors = []
        warnings = []
        suggestions = []

        # Validate required fields
        if "name" not in flow_data:
            errors.append("Flow name is required")

        if "trigger_condition" not in flow_data:
            errors.append("Trigger condition is required")

        if "steps" not in flow_data or not flow_data["steps"]:
            errors.append("At least one step is required")

        # Validate steps
        if "steps" in flow_data:
            for i, step in enumerate(flow_data["steps"]):
                if "name" not in step:
                    errors.append(f"Step {i+1} is missing a name")

                if "step_type" not in step:
                    errors.append(f"Step {i+1} is missing a step type")

                # Check for approval steps
                if step.get("step_type") == "manual_approval":
                    if not step.get("approval_roles") and not step.get("approval_users"):
                        warnings.append(f"Step {i+1} (approval) has no approvers defined")

        # Validate timeout settings
        if "timeout_minutes" in flow_data:
            if flow_data["timeout_minutes"] <= 0:
                errors.append("Timeout must be greater than 0 minutes")
            elif flow_data["timeout_minutes"] > 10080:  # 7 days
                warnings.append("Timeout is very long (over 7 days)")

        # Check for circular dependencies in steps
        if "steps" in flow_data and len(flow_data["steps"]) > 1:
            # This is a simplified check - in production you'd want more sophisticated validation
            has_parallel_steps = any(step.get("step_type") == "parallel_approval" for step in flow_data["steps"])
            if has_parallel_steps:
                suggestions.append("Consider adding timeout settings for parallel approval steps")

        # Validate escalation rules
        if "escalation_rules" in flow_data:
            for rule in flow_data["escalation_rules"]:
                if "escalation_type" not in rule:
                    errors.append("Escalation rule is missing escalation type")

                if not rule.get("target_roles") and not rule.get("target_users"):
                    warnings.append("Escalation rule has no targets defined")

        is_valid = len(errors) == 0

        return ValidationResponse(
            is_valid=is_valid,
            errors=errors,
            warnings=warnings,
            suggestions=suggestions
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to validate approval flow: {str(e)}")

@router.get("/step-templates", response_model=List[StepTemplateResponse])
async def get_step_templates(
    category: Optional[str] = Query(None),
    is_system: Optional[bool] = Query(None),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get available step templates for creating approval flows"""
    try:
        # For now, return predefined system templates
        # In a real implementation, these would be stored in the database

        templates = [
            {
                "id": "manual_approval",
                "name": "Manual Approval",
                "description": "Requires manual approval from specified users or roles",
                "step_type": "manual_approval",
                "category": "approval",
                "config": {
                    "approval_roles": [],
                    "approval_users": [],
                    "min_approvals": 1,
                    "timeout_minutes": 1440
                },
                "is_system": True,
                "usage_count": 0
            },
            {
                "id": "parallel_approval",
                "name": "Parallel Approval",
                "description": "Requires approval from multiple approvers in parallel",
                "step_type": "parallel_approval",
                "category": "approval",
                "config": {
                    "approval_roles": [],
                    "approval_users": [],
                    "min_approvals": 1,
                    "timeout_minutes": 1440
                },
                "is_system": True,
                "usage_count": 0
            },
            {
                "id": "sequential_approval",
                "name": "Sequential Approval",
                "description": "Requires approval in sequence from multiple approvers",
                "step_type": "sequential_approval",
                "category": "approval",
                "config": {
                    "approval_roles": [],
                    "approval_users": [],
                    "timeout_minutes": 1440
                },
                "is_system": True,
                "usage_count": 0
            },
            {
                "id": "conditional_approval",
                "name": "Conditional Approval",
                "description": "Approval based on specific conditions",
                "step_type": "conditional_approval",
                "category": "approval",
                "config": {
                    "conditions": [],
                    "approval_roles": [],
                    "approval_users": [],
                    "timeout_minutes": 1440
                },
                "is_system": True,
                "usage_count": 0
            },
            {
                "id": "notification",
                "name": "Notification",
                "description": "Send notifications to users or roles",
                "step_type": "notification",
                "category": "notification",
                "config": {
                    "notification_type": "email",
                    "recipients": [],
                    "message_template": ""
                },
                "is_system": True,
                "usage_count": 0
            },
            {
                "id": "escalation",
                "name": "Escalation",
                "description": "Escalate to higher authorities",
                "step_type": "escalation",
                "category": "escalation",
                "config": {
                    "escalation_type": "timeout",
                    "target_roles": [],
                    "target_users": [],
                    "escalation_delay_minutes": 60
                },
                "is_system": True,
                "usage_count": 0
            }
        ]

        # Apply filters
        if category:
            templates = [t for t in templates if t["category"] == category]

        if is_system is not None:
            templates = [t for t in templates if t["is_system"] == is_system]

        return [StepTemplateResponse(**template) for template in templates]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get step templates: {str(e)}")

@router.post("/flows/{flow_id}/activate")
async def activate_approval_flow(
    flow_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Activate an approval flow"""
    try:
        workflow_def = db.query(WorkflowDefinition).filter(
            WorkflowDefinition.id == flow_id,
            WorkflowDefinition.tenant_id == current_user.get("tenant")
        ).first()

        if not workflow_def:
            raise HTTPException(status_code=404, detail="Approval flow not found")

        workflow_def.status = WorkflowStatus.ACTIVE
        workflow_def.updated_by = current_user["user_id"]

        db.commit()

        return {"message": "Approval flow activated successfully"}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to activate approval flow: {str(e)}")

@router.post("/flows/{flow_id}/deactivate")
async def deactivate_approval_flow(
    flow_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Deactivate an approval flow"""
    try:
        workflow_def = db.query(WorkflowDefinition).filter(
            WorkflowDefinition.id == flow_id,
            WorkflowDefinition.tenant_id == current_user.get("tenant")
        ).first()

        if not workflow_def:
            raise HTTPException(status_code=404, detail="Approval flow not found")

        workflow_def.status = WorkflowStatus.INACTIVE
        workflow_def.updated_by = current_user["user_id"]

        db.commit()

        return {"message": "Approval flow deactivated successfully"}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to deactivate approval flow: {str(e)}")

@router.get("/flows/{flow_id}/instances", response_model=List[Dict[str, Any]])
async def get_flow_instances(
    flow_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get instances of a specific approval flow"""
    try:
        # Verify flow exists and belongs to tenant
        workflow_def = db.query(WorkflowDefinition).filter(
            WorkflowDefinition.id == flow_id,
            WorkflowDefinition.tenant_id == current_user.get("tenant")
        ).first()

        if not workflow_def:
            raise HTTPException(status_code=404, detail="Approval flow not found")

        query = db.query(WorkflowInstance).filter(
            WorkflowInstance.workflow_definition_id == flow_id
        )

        if status:
            query = query.filter(WorkflowInstance.status == WorkflowInstanceStatus(status))

        instances = query.order_by(WorkflowInstance.created_at.desc()).offset(skip).limit(limit).all()

        return [
            {
                "id": instance.id,
                "workflow_definition_id": instance.workflow_definition_id,
                "status": instance.status.value,
                "title": instance.title,
                "description": instance.description,
                "resource_type": instance.resource_type,
                "resource_id": instance.resource_id,
                "initiated_by": instance.initiated_by,
                "current_step": instance.current_step,
                "current_assignee": instance.current_assignee,
                "due_date": instance.due_date,
                "created_at": instance.created_at,
                "updated_at": instance.updated_at,
                "completed_at": instance.completed_at
            }
            for instance in instances
        ]

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get flow instances: {str(e)}")