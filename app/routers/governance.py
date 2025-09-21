from fastapi import APIRouter, Depends, HTTPException, Body, Request, BackgroundTasks, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta, timezone
import logging

from app.database import get_db
from app.auth import get_current_user
from app.config import settings
from app.models import (
    SecurityEvent, WorkflowDefinition, WorkflowInstance, ComplianceReport,
    PermissionTemplate, RolePermission, User, AuditLog, ApprovalRequest,
    SecurityEventType, SecuritySeverity, WorkflowStatus, WorkflowInstanceStatus,
    ComplianceReportStatus, UserRole, WorkflowStep, WorkflowStepExecution,
    WorkflowEscalationRule, WorkflowTemplate, WorkflowNotification, WorkflowMetrics,
    WorkflowStepType, WorkflowConditionType, WorkflowEscalationType, WorkflowNotificationType,
    WorkflowStepStatus, WorkflowTemplateStatus, SecurityAlert, SecurityIncident, SecurityMetrics,
    SecurityAlertType, SecurityAlertStatus, SecurityIncidentType, SecurityIncidentStatus,
    SecurityIncidentSeverity, ThreatIntelligenceFeed, ThreatIndicator, AnomalyDetectionRule,
    AnomalyDetectionResult
)
from app.auth.rbac import rbac_service
from app.schemas import (
    SecurityEventCreate, SecurityEventUpdate, SecurityEventResponse,
    WorkflowDefinitionCreate, WorkflowDefinitionUpdate, WorkflowDefinitionResponse,
    WorkflowInstanceCreate, WorkflowInstanceUpdate, WorkflowInstanceResponse,
    ComplianceReportCreate, ComplianceReportUpdate, ComplianceReportResponse,
    PermissionTemplateCreate, PermissionTemplateUpdate, PermissionTemplateResponse,
    RolePermissionCreate, RolePermissionUpdate, RolePermissionResponse,
    WorkflowStepAction, BulkRolePermissionCreate, BulkRolePermissionResponse,
    PermissionCheckRequest, PermissionCheckResponse,
    CustomRoleCreate, CustomRoleUpdate, CustomRoleResponse,
    PermissionTemplatePermission, RoleInheritanceCreate, RoleInheritanceUpdate, RoleInheritanceResponse,
    ResourceSpecificPermissionCreate, ResourceSpecificPermissionUpdate, ResourceSpecificPermissionResponse,
    AccessReviewCreate, AccessReviewUpdate, AccessReviewResponse, AccessReviewScope,
    BulkRoleAssignmentRequest, BulkRoleAssignmentResponse,
    BulkPermissionUpdateRequest, BulkPermissionUpdateResponse,
    EnhancedPermissionCheckRequest, EnhancedPermissionCheckResponse,
    AuditLogResponse, AuditLogFilter, AuditLogExportRequest, AuditLogExportResponse, AuditLogStats,
    WorkflowStepCreate, WorkflowStepResponse, WorkflowStepUpdate,
    WorkflowStepExecutionCreate, WorkflowStepExecutionResponse, WorkflowStepExecutionUpdate,
    WorkflowEscalationRuleCreate, WorkflowEscalationRuleResponse, WorkflowEscalationRuleUpdate,
    WorkflowTemplateCreate, WorkflowTemplateResponse, WorkflowTemplateUpdate,
    WorkflowNotificationCreate, WorkflowNotificationResponse, WorkflowNotificationUpdate,
    WorkflowMetricsCreate, WorkflowMetricsResponse, WorkflowMetricsUpdate,
    WorkflowEngineRequest, WorkflowEngineResponse,
    WorkflowApprovalAction, WorkflowApprovalResponse,
    SecurityAlertCreate, SecurityAlertUpdate, SecurityAlertResponse,
    SecurityIncidentCreate, SecurityIncidentUpdate, SecurityIncidentResponse,
    SecurityMetricsCreate, SecurityMetricsResponse, SecurityDashboardMetrics,
    ThreatIntelligenceFeedCreate, ThreatIntelligenceFeedUpdate, ThreatIntelligenceFeedResponse,
    AnomalyDetectionRuleCreate, AnomalyDetectionRuleUpdate, AnomalyDetectionRuleResponse,
    SecurityEventFilter, SecurityAlertFilter, SecurityIncidentFilter,
    AnomalyDetectionRequest, AnomalyDetectionResponse,
    SecurityThreatIntelligenceRequest, SecurityThreatIntelligenceResponse, ThreatIndicatorResponse
)

router = APIRouter()
logger = logging.getLogger(__name__)

# ============ ROLE MANAGEMENT ENDPOINTS ============

@router.get("/roles", response_model=List[str])
async def list_roles(
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List all available roles in the system"""
    # Get unique role names from RolePermission table
    roles = db.query(RolePermission.role_name).distinct().all()
    return [role.role_name for role in roles]

# ============ CUSTOM ROLE MANAGEMENT ENDPOINTS ============

@router.post("/custom-roles", response_model=CustomRoleResponse)
async def create_custom_role(
    request: Request,
    role_data: CustomRoleCreate = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a new custom role"""
    # Use RBAC service to create custom role
    try:
        role = rbac_service.create_custom_role(
            name=role_data.name,
            description=role_data.description,
            permissions=role_data.permissions,
            permission_templates=role_data.permission_templates,
            inherited_roles=role_data.inherited_roles,
            inheritance_type=role_data.inheritance_type,
            conditions=role_data.conditions,
            tenant_id=current_user["tenant"],
            created_by=current_user["user_id"]
        )

        # Log the action
        audit_log = AuditLog(
            actor=current_user["user_id"],
            action="create_custom_role",
            subject=f"custom_role:{role.name}",
            subject_type="custom_role",
            subject_id=role.name,
            tenant_id=current_user["tenant"],
            before_json={},
            after_json=role_data.dict(),
            result="success"
        )
        db.add(audit_log)
        db.commit()

        return role

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/custom-roles", response_model=List[CustomRoleResponse])
async def list_custom_roles(
    request: Request,
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List all custom roles with filtering"""
    roles = rbac_service.list_custom_roles(
        tenant_id=current_user["tenant"],
        search=search,
        is_active=is_active,
        skip=skip,
        limit=limit
    )
    return roles

@router.get("/custom-roles/{role_name}", response_model=CustomRoleResponse)
async def get_custom_role(
    role_name: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get a specific custom role"""
    role = rbac_service.get_custom_role(role_name, current_user["tenant"])
    if not role:
        raise HTTPException(status_code=404, detail="Custom role not found")
    return role

@router.put("/custom-roles/{role_name}", response_model=CustomRoleResponse)
async def update_custom_role(
    role_name: str,
    request: Request,
    role_data: CustomRoleUpdate = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update a custom role"""
    # Get current role for audit
    current_role = rbac_service.get_custom_role(role_name, current_user["tenant"])
    if not current_role:
        raise HTTPException(status_code=404, detail="Custom role not found")

    try:
        updated_role = rbac_service.update_custom_role(
            role_name=role_name,
            tenant_id=current_user["tenant"],
            description=role_data.description,
            permissions=role_data.permissions,
            permission_templates=role_data.permission_templates,
            inherited_roles=role_data.inherited_roles,
            inheritance_type=role_data.inheritance_type,
            conditions=role_data.conditions,
            is_active=role_data.is_active,
            updated_by=current_user["user_id"]
        )

        # Log the action
        audit_log = AuditLog(
            actor=current_user["user_id"],
            action="update_custom_role",
            subject=f"custom_role:{role_name}",
            subject_type="custom_role",
            subject_id=role_name,
            tenant_id=current_user["tenant"],
            before_json=current_role.__dict__,
            after_json=role_data.dict(exclude_unset=True),
            result="success"
        )
        db.add(audit_log)
        db.commit()

        return updated_role

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/custom-roles/{role_name}")
async def delete_custom_role(
    role_name: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Delete a custom role"""
    # Get current role for audit
    current_role = rbac_service.get_custom_role(role_name, current_user["tenant"])
    if not current_role:
        raise HTTPException(status_code=404, detail="Custom role not found")

    try:
        rbac_service.delete_custom_role(role_name, current_user["tenant"])

        # Log the action
        audit_log = AuditLog(
            actor=current_user["user_id"],
            action="delete_custom_role",
            subject=f"custom_role:{role_name}",
            subject_type="custom_role",
            subject_id=role_name,
            tenant_id=current_user["tenant"],
            before_json=current_role.__dict__,
            after_json={},
            result="success"
        )
        db.add(audit_log)
        db.commit()

        return {"message": "Custom role deleted successfully"}

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/custom-roles/{role_name}/effective-permissions")
async def get_role_effective_permissions(
    role_name: str,
    request: Request,
    resource_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get effective permissions for a role including inherited permissions"""
    role = rbac_service.get_custom_role(role_name, current_user["tenant"])
    if not role:
        raise HTTPException(status_code=404, detail="Custom role not found")

    effective_permissions = rbac_service.get_role_effective_permissions(
        role_name, current_user["tenant"], resource_type
    )

    return {
        "role_name": role_name,
        "resource_type": resource_type,
        "effective_permissions": effective_permissions,
        "inheritance_chain": rbac_service.get_role_inheritance_chain(role_name, current_user["tenant"])
    }

@router.get("/roles/{role_name}/permissions", response_model=List[RolePermissionResponse])
async def get_role_permissions(
    role_name: str,
    request: Request,
    resource_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get permissions for a specific role"""
    query = db.query(RolePermission).filter(RolePermission.role_name == role_name)
    if resource_type:
        query = query.filter(RolePermission.resource_type == resource_type)

    permissions = query.all()
    return permissions

@router.post("/roles/{role_name}/permissions", response_model=RolePermissionResponse)
async def create_role_permission(
    role_name: str,
    request: Request,
    permission_data: RolePermissionCreate = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a new permission for a role"""
    # Override role_name from URL
    permission_data.role_name = role_name
    permission_data.created_by = current_user["user_id"]
    permission_data.updated_by = current_user["user_id"]
    permission_data.tenant_id = current_user["tenant"]

    # Check if permission already exists
    existing = db.query(RolePermission).filter(
        and_(
            RolePermission.role_name == role_name,
            RolePermission.resource_type == permission_data.resource_type,
            RolePermission.action == permission_data.action,
            RolePermission.tenant_id == current_user["tenant"]
        )
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Permission already exists for this role")

    permission = RolePermission(**permission_data.dict())
    db.add(permission)
    db.commit()
    db.refresh(permission)

    # Log the action
    audit_log = AuditLog(
        actor=current_user["user_id"],
        action="create_role_permission",
        subject=f"role_permission:{permission.id}",
        subject_type="role_permission",
        subject_id=permission.id,
        tenant_id=current_user["tenant"],
        before_json={},
        after_json=permission_data.dict(),
        result="success"
    )
    db.add(audit_log)
    db.commit()

    return permission

@router.put("/roles/{role_name}/permissions/{permission_id}", response_model=RolePermissionResponse)
async def update_role_permission(
    role_name: str,
    permission_id: str,
    request: Request,
    permission_data: RolePermissionUpdate = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update a role permission"""
    permission = db.query(RolePermission).filter(
        RolePermission.id == permission_id,
        RolePermission.tenant_id == current_user["tenant"]
    ).first()

    if not permission:
        raise HTTPException(status_code=404, detail="Permission not found")

    if permission.role_name != role_name:
        raise HTTPException(status_code=400, detail="Permission does not belong to specified role")

    # Store old values for audit
    old_values = permission.__dict__.copy()

    # Update fields
    for field, value in permission_data.dict(exclude_unset=True).items():
        setattr(permission, field, value)

    permission.updated_by = current_user["user_id"]
    permission.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(permission)

    # Log the action
    audit_log = AuditLog(
        actor=current_user["user_id"],
        action="update_role_permission",
        subject=f"role_permission:{permission.id}",
        subject_type="role_permission",
        subject_id=permission.id,
        tenant_id=current_user["tenant"],
        before_json=old_values,
        after_json=permission.__dict__,
        result="success"
    )
    db.add(audit_log)
    db.commit()

    return permission

@router.delete("/roles/{role_name}/permissions/{permission_id}")
async def delete_role_permission(
    role_name: str,
    permission_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Delete a role permission"""
    permission = db.query(RolePermission).filter(
        RolePermission.id == permission_id,
        RolePermission.tenant_id == current_user["tenant"]
    ).first()

    if not permission:
        raise HTTPException(status_code=404, detail="Permission not found")

    if permission.role_name != role_name:
        raise HTTPException(status_code=400, detail="Permission does not belong to specified role")

    # Store old values for audit
    old_values = permission.__dict__.copy()

    db.delete(permission)
    db.commit()

    # Log the action
    audit_log = AuditLog(
        actor=current_user["user_id"],
        action="delete_role_permission",
        subject=f"role_permission:{permission_id}",
        subject_type="role_permission",
        subject_id=permission_id,
        tenant_id=current_user["tenant"],
        before_json=old_values,
        after_json={},
        result="success"
    )
    db.add(audit_log)
    db.commit()

    return {"message": "Permission deleted successfully"}

@router.post("/roles/{role_name}/permissions/bulk", response_model=BulkRolePermissionResponse)
async def bulk_create_role_permissions(
    role_name: str,
    request: Request,
    bulk_data: BulkRolePermissionCreate = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create multiple permissions for a role"""
    created_count = 0
    failed_count = 0
    errors = []

    for permission_data in bulk_data.permissions:
        try:
            permission_data.role_name = role_name
            permission_data.created_by = current_user["user_id"]
            permission_data.updated_by = current_user["user_id"]
            permission_data.tenant_id = current_user["tenant"]

            # Check if permission already exists
            existing = db.query(RolePermission).filter(
                and_(
                    RolePermission.role_name == role_name,
                    RolePermission.resource_type == permission_data.resource_type,
                    RolePermission.action == permission_data.action,
                    RolePermission.tenant_id == current_user["tenant"]
                )
            ).first()

            if not existing:
                permission = RolePermission(**permission_data.dict())
                db.add(permission)
                created_count += 1
            else:
                failed_count += 1
                errors.append(f"Permission already exists: {permission_data.resource_type}:{permission_data.action}")

        except Exception as e:
            failed_count += 1
            errors.append(f"Error creating permission: {str(e)}")

    db.commit()

    return BulkRolePermissionResponse(
        created_count=created_count,
        failed_count=failed_count,
        errors=errors
    )

# ============ PERMISSION CHECKING ENDPOINTS ============

@router.post("/permissions/check", response_model=PermissionCheckResponse)
async def check_permission(
    request: Request,
    check_data: PermissionCheckRequest = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Check if a role has a specific permission"""
    permission = db.query(RolePermission).filter(
        and_(
            RolePermission.role_name == check_data.role_name,
            RolePermission.resource_type == check_data.resource_type,
            RolePermission.action == check_data.action,
            RolePermission.tenant_id == current_user["tenant"],
            RolePermission.is_active == True
        )
    ).first()

    if not permission:
        return PermissionCheckResponse(
            has_permission=False,
            reason="Permission not found"
        )

    # Check conditions if any
    conditions_met = {}
    if permission.conditions:
        for condition, expected in permission.conditions.items():
            if check_data.context and condition in check_data.context:
                actual = check_data.context[condition]
                conditions_met[condition] = actual == expected
            else:
                conditions_met[condition] = False

        # All conditions must be met
        if not all(conditions_met.values()):
            return PermissionCheckResponse(
                has_permission=False,
                reason="Conditions not met",
                conditions_met=conditions_met
            )

    return PermissionCheckResponse(
        has_permission=True,
        conditions_met=conditions_met
    )

# ============ SECURITY EVENT ENDPOINTS ============

@router.post("/security-events", response_model=SecurityEventResponse)
async def create_security_event(
    request: Request,
    event_data: SecurityEventCreate = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a new security event"""
    event = SecurityEvent(**event_data.dict())
    db.add(event)
    db.commit()
    db.refresh(event)

    return event

@router.get("/security-events", response_model=List[SecurityEventResponse])
async def list_security_events(
    request: Request,
    event_type: Optional[str] = None,
    severity: Optional[str] = None,
    user_id: Optional[str] = None,
    resource_type: Optional[str] = None,
    is_resolved: Optional[bool] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List security events with filtering"""
    query = db.query(SecurityEvent).filter(SecurityEvent.tenant_id == current_user["tenant"])

    if event_type:
        query = query.filter(SecurityEvent.event_type == event_type)
    if severity:
        query = query.filter(SecurityEvent.severity == severity)
    if user_id:
        query = query.filter(SecurityEvent.user_id == user_id)
    if resource_type:
        query = query.filter(SecurityEvent.resource_type == resource_type)
    if is_resolved is not None:
        query = query.filter(SecurityEvent.is_resolved == is_resolved)
    if start_date:
        query = query.filter(SecurityEvent.created_at >= start_date)
    if end_date:
        query = query.filter(SecurityEvent.created_at <= end_date)

    events = query.order_by(SecurityEvent.created_at.desc()).offset(skip).limit(limit).all()
    return events

@router.get("/security-events/{event_id}", response_model=SecurityEventResponse)
async def get_security_event(
    event_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get a specific security event"""
    event = db.query(SecurityEvent).filter(
        SecurityEvent.id == event_id,
        SecurityEvent.tenant_id == current_user["tenant"]
    ).first()

    if not event:
        raise HTTPException(status_code=404, detail="Security event not found")

    return event

@router.put("/security-events/{event_id}", response_model=SecurityEventResponse)
async def update_security_event(
    event_id: str,
    request: Request,
    event_data: SecurityEventUpdate = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update a security event (typically for resolution)"""
    event = db.query(SecurityEvent).filter(
        SecurityEvent.id == event_id,
        SecurityEvent.tenant_id == current_user["tenant"]
    ).first()

    if not event:
        raise HTTPException(status_code=404, detail="Security event not found")

    # Store old values for audit
    old_values = event.__dict__.copy()

    # Update fields
    for field, value in event_data.dict(exclude_unset=True).items():
        if field == "is_resolved" and value == True:
            event.resolved_by = current_user["user_id"]
            event.resolved_at = datetime.utcnow()
        setattr(event, field, value)

    event.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(event)

    # Log the action
    audit_log = AuditLog(
        actor=current_user["user_id"],
        action="update_security_event",
        subject=f"security_event:{event.id}",
        subject_type="security_event",
        subject_id=event.id,
        tenant_id=current_user["tenant"],
        before_json=old_values,
        after_json=event.__dict__,
        result="success"
    )
    db.add(audit_log)
    db.commit()

    return event

# ============ WORKFLOW MANAGEMENT ENDPOINTS ============

@router.post("/workflows", response_model=WorkflowDefinitionResponse)
async def create_workflow_definition(
    request: Request,
    workflow_data: WorkflowDefinitionCreate = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a new workflow definition"""
    workflow_data.created_by = current_user["user_id"]
    workflow_data.updated_by = current_user["user_id"]

    workflow = WorkflowDefinition(**workflow_data.dict())
    db.add(workflow)
    db.commit()
    db.refresh(workflow)

    # Log the action
    audit_log = AuditLog(
        actor=current_user["user_id"],
        action="create_workflow_definition",
        subject=f"workflow_definition:{workflow.id}",
        subject_type="workflow_definition",
        subject_id=workflow.id,
        tenant_id=current_user["tenant"],
        before_json={},
        after_json=workflow_data.dict(),
        result="success"
    )
    db.add(audit_log)
    db.commit()

    return workflow

@router.get("/workflows", response_model=List[WorkflowDefinitionResponse])
async def list_workflow_definitions(
    request: Request,
    category: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List workflow definitions"""
    query = db.query(WorkflowDefinition).filter(WorkflowDefinition.tenant_id == current_user["tenant"])

    if category:
        query = query.filter(WorkflowDefinition.category == category)
    if status:
        query = query.filter(WorkflowDefinition.status == status)

    workflows = query.order_by(WorkflowDefinition.created_at.desc()).offset(skip).limit(limit).all()
    return workflows

@router.get("/workflows/{workflow_id}", response_model=WorkflowDefinitionResponse)
async def get_workflow_definition(
    workflow_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get a specific workflow definition"""
    workflow = db.query(WorkflowDefinition).filter(
        WorkflowDefinition.id == workflow_id,
        WorkflowDefinition.tenant_id == current_user["tenant"]
    ).first()

    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow definition not found")

    return workflow

@router.put("/workflows/{workflow_id}", response_model=WorkflowDefinitionResponse)
async def update_workflow_definition(
    workflow_id: str,
    request: Request,
    workflow_data: WorkflowDefinitionUpdate = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update a workflow definition"""
    workflow = db.query(WorkflowDefinition).filter(
        WorkflowDefinition.id == workflow_id,
        WorkflowDefinition.tenant_id == current_user["tenant"]
    ).first()

    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow definition not found")

    # Store old values for audit
    old_values = workflow.__dict__.copy()

    # Update fields
    for field, value in workflow_data.dict(exclude_unset=True).items():
        setattr(workflow, field, value)

    workflow.updated_by = current_user["user_id"]
    workflow.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(workflow)

    # Log the action
    audit_log = AuditLog(
        actor=current_user["user_id"],
        action="update_workflow_definition",
        subject=f"workflow_definition:{workflow.id}",
        subject_type="workflow_definition",
        subject_id=workflow.id,
        tenant_id=current_user["tenant"],
        before_json=old_values,
        after_json=workflow.__dict__,
        result="success"
    )
    db.add(audit_log)
    db.commit()

    return workflow

@router.post("/workflows/{workflow_id}/instances", response_model=WorkflowInstanceResponse)
async def create_workflow_instance(
    workflow_id: str,
    request: Request,
    instance_data: WorkflowInstanceCreate = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a new workflow instance"""
    # Verify workflow exists
    workflow = db.query(WorkflowDefinition).filter(
        WorkflowDefinition.id == workflow_id,
        WorkflowDefinition.tenant_id == current_user["tenant"]
    ).first()

    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow definition not found")

    instance_data.workflow_definition_id = workflow_id
    instance = WorkflowInstance(**instance_data.dict())
    db.add(instance)
    db.commit()
    db.refresh(instance)

    # Log the action
    audit_log = AuditLog(
        actor=current_user["user_id"],
        action="create_workflow_instance",
        subject=f"workflow_instance:{instance.id}",
        subject_type="workflow_instance",
        subject_id=instance.id,
        tenant_id=current_user["tenant"],
        before_json={},
        after_json=instance_data.dict(),
        result="success"
    )
    db.add(audit_log)
    db.commit()

    return instance

@router.get("/workflows/{workflow_id}/instances", response_model=List[WorkflowInstanceResponse])
async def list_workflow_instances(
    workflow_id: str,
    request: Request,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List workflow instances for a workflow definition"""
    query = db.query(WorkflowInstance).filter(
        WorkflowInstance.workflow_definition_id == workflow_id,
        WorkflowInstance.tenant_id == current_user["tenant"]
    )

    if status:
        query = query.filter(WorkflowInstance.status == status)

    instances = query.order_by(WorkflowInstance.created_at.desc()).offset(skip).limit(limit).all()
    return instances

@router.get("/instances", response_model=List[WorkflowInstanceResponse])
async def list_all_workflow_instances(
    request: Request,
    status: Optional[str] = None,
    resource_type: Optional[str] = None,
    assignee: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List all workflow instances"""
    query = db.query(WorkflowInstance).filter(WorkflowInstance.tenant_id == current_user["tenant"])

    if status:
        query = query.filter(WorkflowInstance.status == status)
    if resource_type:
        query = query.filter(WorkflowInstance.resource_type == resource_type)
    if assignee:
        query = query.filter(WorkflowInstance.current_assignee == assignee)

    instances = query.order_by(WorkflowInstance.created_at.desc()).offset(skip).limit(limit).all()
    return instances

@router.put("/instances/{instance_id}", response_model=WorkflowInstanceResponse)
async def update_workflow_instance(
    instance_id: str,
    request: Request,
    instance_data: WorkflowInstanceUpdate = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update a workflow instance"""
    instance = db.query(WorkflowInstance).filter(
        WorkflowInstance.id == instance_id,
        WorkflowInstance.tenant_id == current_user["tenant"]
    ).first()

    if not instance:
        raise HTTPException(status_code=404, detail="Workflow instance not found")

    # Store old values for audit
    old_values = instance.__dict__.copy()

    # Update fields
    for field, value in instance_data.dict(exclude_unset=True).items():
        if field == "status" and value in ["completed", "rejected", "cancelled"]:
            instance.completed_at = datetime.utcnow()
        setattr(instance, field, value)

    instance.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(instance)

    # Log the action
    audit_log = AuditLog(
        actor=current_user["user_id"],
        action="update_workflow_instance",
        subject=f"workflow_instance:{instance.id}",
        subject_type="workflow_instance",
        subject_id=instance.id,
        tenant_id=current_user["tenant"],
        before_json=old_values,
        after_json=instance.__dict__,
        result="success"
    )
    db.add(audit_log)
    db.commit()

    return instance

@router.post("/instances/{instance_id}/actions")
async def execute_workflow_step_action(
    instance_id: str,
    request: Request,
    action_data: WorkflowStepAction = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Execute an action on a workflow step"""
    instance = db.query(WorkflowInstance).filter(
        WorkflowInstance.id == instance_id,
        WorkflowInstance.tenant_id == current_user["tenant"]
    ).first()

    if not instance:
        raise HTTPException(status_code=404, detail="Workflow instance not found")

    # Log the action
    audit_log = AuditLog(
        actor=current_user["user_id"],
        action=f"workflow_step_{action_data.action}",
        subject=f"workflow_instance:{instance.id}",
        subject_type="workflow_instance",
        subject_id=instance.id,
        tenant_id=current_user["tenant"],
        before_json={},
        after_json=action_data.dict(),
        result="success"
    )
    db.add(audit_log)
    db.commit()

    return {"message": f"Step action '{action_data.action}' executed successfully"}

# ============ COMPLIANCE REPORT ENDPOINTS ============

@router.post("/compliance-reports", response_model=ComplianceReportResponse)
async def create_compliance_report(
    request: Request,
    report_data: ComplianceReportCreate = Body(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a new compliance report"""
    report_data.generated_by = current_user["user_id"]

    report = ComplianceReport(**report_data.dict())
    db.add(report)
    db.commit()
    db.refresh(report)

    # Start background report generation
    background_tasks.add_task(generate_compliance_report_background, report.id, db)

    # Log the action
    audit_log = AuditLog(
        actor=current_user["user_id"],
        action="create_compliance_report",
        subject=f"compliance_report:{report.id}",
        subject_type="compliance_report",
        subject_id=report.id,
        tenant_id=current_user["tenant"],
        before_json={},
        after_json=report_data.dict(),
        result="success"
    )
    db.add(audit_log)
    db.commit()

    return report

@router.get("/compliance-reports", response_model=List[ComplianceReportResponse])
async def list_compliance_reports(
    request: Request,
    report_type: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List compliance reports"""
    query = db.query(ComplianceReport).filter(ComplianceReport.tenant_id == current_user["tenant"])

    if report_type:
        query = query.filter(ComplianceReport.report_type == report_type)
    if status:
        query = query.filter(ComplianceReport.status == status)

    reports = query.order_by(ComplianceReport.created_at.desc()).offset(skip).limit(limit).all()
    return reports

@router.get("/compliance-reports/{report_id}", response_model=ComplianceReportResponse)
async def get_compliance_report(
    report_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get a specific compliance report"""
    report = db.query(ComplianceReport).filter(
        ComplianceReport.id == report_id,
        ComplianceReport.tenant_id == current_user["tenant"]
    ).first()

    if not report:
        raise HTTPException(status_code=404, detail="Compliance report not found")

    return report

@router.put("/compliance-reports/{report_id}", response_model=ComplianceReportResponse)
async def update_compliance_report(
    report_id: str,
    request: Request,
    report_data: ComplianceReportUpdate = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update a compliance report"""
    report = db.query(ComplianceReport).filter(
        ComplianceReport.id == report_id,
        ComplianceReport.tenant_id == current_user["tenant"]
    ).first()

    if not report:
        raise HTTPException(status_code=404, detail="Compliance report not found")

    # Store old values for audit
    old_values = report.__dict__.copy()

    # Update fields
    for field, value in report_data.dict(exclude_unset=True).items():
        if field == "status" and value == "completed":
            report.completed_at = datetime.utcnow()
        setattr(report, field, value)

    report.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(report)

    # Log the action
    audit_log = AuditLog(
        actor=current_user["user_id"],
        action="update_compliance_report",
        subject=f"compliance_report:{report.id}",
        subject_type="compliance_report",
        subject_id=report.id,
        tenant_id=current_user["tenant"],
        before_json=old_values,
        after_json=report.__dict__,
        result="success"
    )
    db.add(audit_log)
    db.commit()

    return report

# ============ PERMISSION TEMPLATE ENDPOINTS ============

@router.post("/permission-templates", response_model=PermissionTemplateResponse)
async def create_permission_template(
    request: Request,
    template_data: PermissionTemplateCreate = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a new permission template"""
    try:
        template = rbac_service.create_permission_template(
            name=template_data.name,
            description=template_data.description,
            permissions=template_data.permissions,
            category=template_data.category,
            tenant_id=current_user["tenant"],
            created_by=current_user["user_id"]
        )

        # Log the action
        audit_log = AuditLog(
            actor=current_user["user_id"],
            action="create_permission_template",
            subject=f"permission_template:{template.id}",
            subject_type="permission_template",
            subject_id=template.id,
            tenant_id=current_user["tenant"],
            before_json={},
            after_json=template_data.dict(),
            result="success"
        )
        db.add(audit_log)
        db.commit()

        return template

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/permission-templates", response_model=List[PermissionTemplateResponse])
async def list_permission_templates(
    request: Request,
    category: Optional[str] = None,
    is_active: Optional[bool] = None,
    is_system: Optional[bool] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List permission templates with enhanced filtering"""
    templates = rbac_service.list_permission_templates(
        tenant_id=current_user["tenant"],
        category=category,
        is_active=is_active,
        is_system=is_system,
        search=search,
        skip=skip,
        limit=limit
    )
    return templates

@router.get("/permission-templates/{template_id}", response_model=PermissionTemplateResponse)
async def get_permission_template(
    template_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get a specific permission template"""
    template = rbac_service.get_permission_template(template_id, current_user["tenant"])
    if not template:
        raise HTTPException(status_code=404, detail="Permission template not found")
    return template

@router.put("/permission-templates/{template_id}", response_model=PermissionTemplateResponse)
async def update_permission_template(
    template_id: str,
    request: Request,
    template_data: PermissionTemplateUpdate = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update a permission template"""
    # Get current template for audit
    current_template = rbac_service.get_permission_template(template_id, current_user["tenant"])
    if not current_template:
        raise HTTPException(status_code=404, detail="Permission template not found")

    try:
        updated_template = rbac_service.update_permission_template(
            template_id=template_id,
            tenant_id=current_user["tenant"],
            name=template_data.name,
            description=template_data.description,
            permissions=template_data.permissions,
            category=template_data.category,
            is_active=template_data.is_active,
            updated_by=current_user["user_id"]
        )

        # Log the action
        audit_log = AuditLog(
            actor=current_user["user_id"],
            action="update_permission_template",
            subject=f"permission_template:{template_id}",
            subject_type="permission_template",
            subject_id=template_id,
            tenant_id=current_user["tenant"],
            before_json=current_template.__dict__,
            after_json=template_data.dict(exclude_unset=True),
            result="success"
        )
        db.add(audit_log)
        db.commit()

        return updated_template

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/permission-templates/{template_id}")
async def delete_permission_template(
    template_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Delete a permission template"""
    # Get current template for audit
    current_template = rbac_service.get_permission_template(template_id, current_user["tenant"])
    if not current_template:
        raise HTTPException(status_code=404, detail="Permission template not found")

    try:
        rbac_service.delete_permission_template(template_id, current_user["tenant"])

        # Log the action
        audit_log = AuditLog(
            actor=current_user["user_id"],
            action="delete_permission_template",
            subject=f"permission_template:{template_id}",
            subject_type="permission_template",
            subject_id=template_id,
            tenant_id=current_user["tenant"],
            before_json=current_template.__dict__,
            after_json={},
            result="success"
        )
        db.add(audit_log)
        db.commit()

        return {"message": "Permission template deleted successfully"}

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/permission-templates/{template_id}/apply-to-role/{role_name}")
async def apply_template_to_role(
    template_id: str,
    role_name: str,
    request: Request,
    conditions: Optional[Dict[str, Any]] = Body(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Apply a permission template to a role"""
    template = rbac_service.get_permission_template(template_id, current_user["tenant"])
    if not template:
        raise HTTPException(status_code=404, detail="Permission template not found")

    try:
        applied_permissions = rbac_service.apply_template_to_role(
            template_id=template_id,
            role_name=role_name,
            tenant_id=current_user["tenant"],
            conditions=conditions
        )

        # Log the action
        audit_log = AuditLog(
            actor=current_user["user_id"],
            action="apply_template_to_role",
            subject=f"permission_template:{template_id}",
            subject_type="permission_template",
            subject_id=template_id,
            tenant_id=current_user["tenant"],
            before_json={},
            after_json={"template_id": template_id, "role_name": role_name, "conditions": conditions},
            result="success"
        )
        db.add(audit_log)
        db.commit()

        return {
            "message": f"Template applied to role '{role_name}' successfully",
            "applied_permissions": len(applied_permissions),
            "permissions": applied_permissions
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# ============ ROLE INHERITANCE ENDPOINTS ============

@router.post("/role-inheritance", response_model=RoleInheritanceResponse)
async def create_role_inheritance(
    request: Request,
    inheritance_data: RoleInheritanceCreate = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a role inheritance relationship"""
    try:
        inheritance = rbac_service.create_role_inheritance(
            parent_role=inheritance_data.parent_role,
            child_role=inheritance_data.child_role,
            inheritance_type=inheritance_data.inheritance_type,
            conditions=inheritance_data.conditions,
            tenant_id=current_user["tenant"],
            created_by=current_user["user_id"]
        )

        # Log the action
        audit_log = AuditLog(
            actor=current_user["user_id"],
            action="create_role_inheritance",
            subject=f"role_inheritance:{inheritance_data.parent_role}:{inheritance_data.child_role}",
            subject_type="role_inheritance",
            subject_id=f"{inheritance_data.parent_role}:{inheritance_data.child_role}",
            tenant_id=current_user["tenant"],
            before_json={},
            after_json=inheritance_data.dict(),
            result="success"
        )
        db.add(audit_log)
        db.commit()

        return inheritance

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/role-inheritance", response_model=List[RoleInheritanceResponse])
async def list_role_inheritance(
    request: Request,
    parent_role: Optional[str] = None,
    child_role: Optional[str] = None,
    inheritance_type: Optional[str] = None,
    is_active: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List role inheritance relationships"""
    inheritances = rbac_service.list_role_inheritance(
        tenant_id=current_user["tenant"],
        parent_role=parent_role,
        child_role=child_role,
        inheritance_type=inheritance_type,
        is_active=is_active,
        skip=skip,
        limit=limit
    )
    return inheritances

@router.get("/role-inheritance/{parent_role}/{child_role}", response_model=RoleInheritanceResponse)
async def get_role_inheritance(
    parent_role: str,
    child_role: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get a specific role inheritance relationship"""
    inheritance = rbac_service.get_role_inheritance(parent_role, child_role, current_user["tenant"])
    if not inheritance:
        raise HTTPException(status_code=404, detail="Role inheritance not found")
    return inheritance

@router.put("/role-inheritance/{parent_role}/{child_role}", response_model=RoleInheritanceResponse)
async def update_role_inheritance(
    parent_role: str,
    child_role: str,
    request: Request,
    inheritance_data: RoleInheritanceUpdate = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update a role inheritance relationship"""
    # Get current inheritance for audit
    current_inheritance = rbac_service.get_role_inheritance(parent_role, child_role, current_user["tenant"])
    if not current_inheritance:
        raise HTTPException(status_code=404, detail="Role inheritance not found")

    try:
        updated_inheritance = rbac_service.update_role_inheritance(
            parent_role=parent_role,
            child_role=child_role,
            tenant_id=current_user["tenant"],
            inheritance_type=inheritance_data.inheritance_type,
            conditions=inheritance_data.conditions,
            is_active=inheritance_data.is_active
        )

        # Log the action
        audit_log = AuditLog(
            actor=current_user["user_id"],
            action="update_role_inheritance",
            subject=f"role_inheritance:{parent_role}:{child_role}",
            subject_type="role_inheritance",
            subject_id=f"{parent_role}:{child_role}",
            tenant_id=current_user["tenant"],
            before_json=current_inheritance.__dict__,
            after_json=inheritance_data.dict(exclude_unset=True),
            result="success"
        )
        db.add(audit_log)
        db.commit()

        return updated_inheritance

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/role-inheritance/{parent_role}/{child_role}")
async def delete_role_inheritance(
    parent_role: str,
    child_role: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Delete a role inheritance relationship"""
    # Get current inheritance for audit
    current_inheritance = rbac_service.get_role_inheritance(parent_role, child_role, current_user["tenant"])
    if not current_inheritance:
        raise HTTPException(status_code=404, detail="Role inheritance not found")

    try:
        rbac_service.delete_role_inheritance(parent_role, child_role, current_user["tenant"])

        # Log the action
        audit_log = AuditLog(
            actor=current_user["user_id"],
            action="delete_role_inheritance",
            subject=f"role_inheritance:{parent_role}:{child_role}",
            subject_type="role_inheritance",
            subject_id=f"{parent_role}:{child_role}",
            tenant_id=current_user["tenant"],
            before_json=current_inheritance.__dict__,
            after_json={},
            result="success"
        )
        db.add(audit_log)
        db.commit()

        return {"message": "Role inheritance deleted successfully"}

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/roles/{role_name}/inheritance-chain")
async def get_role_inheritance_chain(
    role_name: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get the inheritance chain for a role"""
    inheritance_chain = rbac_service.get_role_inheritance_chain(role_name, current_user["tenant"])
    return {
        "role_name": role_name,
        "inheritance_chain": inheritance_chain,
        "depth": len(inheritance_chain)
    }

@router.get("/roles/{role_name}/child-roles")
async def get_child_roles(
    role_name: str,
    request: Request,
    direct_only: bool = False,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get child roles for a role"""
    child_roles = rbac_service.get_child_roles(role_name, current_user["tenant"], direct_only)
    return {
        "role_name": role_name,
        "child_roles": child_roles,
        "direct_only": direct_only
    }

# ============ BULK PERMISSION OPERATIONS ENDPOINTS ============

@router.post("/bulk/role-assignments", response_model=BulkRoleAssignmentResponse)
async def bulk_assign_roles(
    request: Request,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    bulk_data: BulkRoleAssignmentRequest = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Bulk assign roles to users"""
    try:
        result = rbac_service.bulk_assign_roles(
            user_ids=bulk_data.user_ids,
            role_names=bulk_data.role_names,
            resource_type=bulk_data.resource_type,
            resource_id=bulk_data.resource_id,
            conditions=bulk_data.conditions,
            tenant_id=current_user["tenant"],
            created_by=current_user["user_id"]
        )

        # Log the action
        audit_log = AuditLog(
            actor=current_user["user_id"],
            action="bulk_role_assignment",
            subject="bulk_role_assignment",
            subject_type="bulk_operation",
            subject_id=f"bulk_{uuid.uuid4()}",
            tenant_id=current_user["tenant"],
            before_json={},
            after_json=bulk_data.dict(),
            result="success"
        )
        db.add(audit_log)
        db.commit()

        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/bulk/permission-updates", response_model=BulkPermissionUpdateResponse)
async def bulk_update_permissions(
    request: Request,
    bulk_data: BulkPermissionUpdateRequest = Body(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Bulk update permissions for a role"""
    try:
        result = rbac_service.bulk_update_permissions(
            role_name=bulk_data.role_name,
            updates=bulk_data.updates,
            tenant_id=current_user["tenant"],
            updated_by=current_user["user_id"]
        )

        # Log the action
        audit_log = AuditLog(
            actor=current_user["user_id"],
            action="bulk_permission_update",
            subject="bulk_permission_update",
            subject_type="bulk_operation",
            subject_id=f"bulk_{uuid.uuid4()}",
            tenant_id=current_user["tenant"],
            before_json={},
            after_json=bulk_data.dict(),
            result="success"
        )
        db.add(audit_log)
        db.commit()

        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/bulk/permissions/copy")
async def bulk_copy_permissions(
    request: Request,
    source_role: str = Body(..., embed=True),
    target_roles: List[str] = Body(..., embed=True),
    conditions: Optional[Dict[str, Any]] = Body(None, embed=True),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Copy permissions from source role to multiple target roles"""
    try:
        result = rbac_service.bulk_copy_permissions(
            source_role=source_role,
            target_roles=target_roles,
            conditions=conditions,
            tenant_id=current_user["tenant"],
            created_by=current_user["user_id"]
        )

        # Log the action
        audit_log = AuditLog(
            actor=current_user["user_id"],
            action="bulk_copy_permissions",
            subject="bulk_copy_permissions",
            subject_type="bulk_operation",
            subject_id=f"bulk_{uuid.uuid4()}",
            tenant_id=current_user["tenant"],
            before_json={},
            after_json={"source_role": source_role, "target_roles": target_roles, "conditions": conditions},
            result="success"
        )
        db.add(audit_log)
        db.commit()

        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/bulk/resource-permissions")
async def bulk_create_resource_permissions(
    request: Request,
    resource_type: str = Body(..., embed=True),
    resource_ids: List[str] = Body(..., embed=True),
    role_permissions: Dict[str, List[str]] = Body(..., embed=True),
    conditions: Optional[Dict[str, Any]] = Body(None, embed=True),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Bulk create resource-specific permissions"""
    try:
        result = rbac_service.bulk_create_resource_permissions(
            resource_type=resource_type,
            resource_ids=resource_ids,
            role_permissions=role_permissions,
            conditions=conditions,
            tenant_id=current_user["tenant"],
            created_by=current_user["user_id"]
        )

        # Log the action
        audit_log = AuditLog(
            actor=current_user["user_id"],
            action="bulk_create_resource_permissions",
            subject="bulk_create_resource_permissions",
            subject_type="bulk_operation",
            subject_id=f"bulk_{uuid.uuid4()}",
            tenant_id=current_user["tenant"],
            before_json={},
            after_json={"resource_type": resource_type, "resource_ids": resource_ids, "role_permissions": role_permissions},
            result="success"
        )
        db.add(audit_log)
        db.commit()

        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# ============ ACCESS REVIEW WORKFLOW ENDPOINTS ============

@router.post("/access-reviews", response_model=AccessReviewResponse)
async def create_access_review(
    request: Request,
    review_data: AccessReviewCreate = Body(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a new access review"""
    try:
        review = rbac_service.create_access_review(
            title=review_data.title,
            description=review_data.description,
            review_type=review_data.review_type,
            scope=review_data.scope,
            reviewers=review_data.reviewers,
            due_date=review_data.due_date,
            tenant_id=current_user["tenant"],
            created_by=current_user["user_id"]
        )

        # Log the action
        audit_log = AuditLog(
            actor=current_user["user_id"],
            action="create_access_review",
            subject=f"access_review:{review.id}",
            subject_type="access_review",
            subject_id=review.id,
            tenant_id=current_user["tenant"],
            before_json={},
            after_json=review_data.dict(),
            result="success"
        )
        db.add(audit_log)
        db.commit()

        return review

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/access-reviews", response_model=List[AccessReviewResponse])
async def list_access_reviews(
    request: Request,
    status: Optional[str] = None,
    review_type: Optional[str] = None,
    reviewer: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List access reviews"""
    reviews = rbac_service.list_access_reviews(
        tenant_id=current_user["tenant"],
        status=status,
        review_type=review_type,
        reviewer=reviewer,
        skip=skip,
        limit=limit
    )
    return reviews

@router.get("/access-reviews/{review_id}", response_model=AccessReviewResponse)
async def get_access_review(
    review_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get a specific access review"""
    review = rbac_service.get_access_review(review_id, current_user["tenant"])
    if not review:
        raise HTTPException(status_code=404, detail="Access review not found")
    return review

@router.put("/access-reviews/{review_id}", response_model=AccessReviewResponse)
async def update_access_review(
    review_id: str,
    request: Request,
    review_data: AccessReviewUpdate = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update an access review"""
    # Get current review for audit
    current_review = rbac_service.get_access_review(review_id, current_user["tenant"])
    if not current_review:
        raise HTTPException(status_code=404, detail="Access review not found")

    try:
        updated_review = rbac_service.update_access_review(
            review_id=review_id,
            tenant_id=current_user["tenant"],
            title=review_data.title,
            description=review_data.description,
            reviewers=review_data.reviewers,
            due_date=review_data.due_date,
            status=review_data.status,
            updated_by=current_user["user_id"]
        )

        # Log the action
        audit_log = AuditLog(
            actor=current_user["user_id"],
            action="update_access_review",
            subject=f"access_review:{review_id}",
            subject_type="access_review",
            subject_id=review_id,
            tenant_id=current_user["tenant"],
            before_json=current_review.__dict__,
            after_json=review_data.dict(exclude_unset=True),
            result="success"
        )
        db.add(audit_log)
        db.commit()

        return updated_review

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/access-reviews/{review_id}")
async def delete_access_review(
    review_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Delete an access review"""
    # Get current review for audit
    current_review = rbac_service.get_access_review(review_id, current_user["tenant"])
    if not current_review:
        raise HTTPException(status_code=404, detail="Access review not found")

    try:
        rbac_service.delete_access_review(review_id, current_user["tenant"])

        # Log the action
        audit_log = AuditLog(
            actor=current_user["user_id"],
            action="delete_access_review",
            subject=f"access_review:{review_id}",
            subject_type="access_review",
            subject_id=review_id,
            tenant_id=current_user["tenant"],
            before_json=current_review.__dict__,
            after_json={},
            result="success"
        )
        db.add(audit_log)
        db.commit()

        return {"message": "Access review deleted successfully"}

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/access-reviews/{review_id}/execute")
async def execute_access_review(
    review_id: str,
    request: Request,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Execute an access review (run the review process)"""
    review = rbac_service.get_access_review(review_id, current_user["tenant"])
    if not review:
        raise HTTPException(status_code=404, detail="Access review not found")

    try:
        # Start background review execution
        background_tasks.add_task(execute_access_review_background, review_id, current_user["tenant"], db)

        # Log the action
        audit_log = AuditLog(
            actor=current_user["user_id"],
            action="execute_access_review",
            subject=f"access_review:{review_id}",
            subject_type="access_review",
            subject_id=review_id,
            tenant_id=current_user["tenant"],
            before_json={},
            after_json={"review_id": review_id},
            result="success"
        )
        db.add(audit_log)
        db.commit()

        return {"message": "Access review execution started", "review_id": review_id}

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/access-reviews/{review_id}/findings")
async def get_access_review_findings(
    review_id: str,
    request: Request,
    severity: Optional[str] = None,
    finding_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get findings for a specific access review"""
    review = rbac_service.get_access_review(review_id, current_user["tenant"])
    if not review:
        raise HTTPException(status_code=404, detail="Access review not found")

    findings = rbac_service.get_access_review_findings(
        review_id=review_id,
        tenant_id=current_user["tenant"],
        severity=severity,
        finding_type=finding_type
    )

    return {
        "review_id": review_id,
        "findings": findings,
        "filters": {"severity": severity, "finding_type": finding_type}
    }

@router.get("/access-reviews/{review_id}/recommendations")
async def get_access_review_recommendations(
    review_id: str,
    request: Request,
    priority: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get recommendations for a specific access review"""
    review = rbac_service.get_access_review(review_id, current_user["tenant"])
    if not review:
        raise HTTPException(status_code=404, detail="Access review not found")

    recommendations = rbac_service.get_access_review_recommendations(
        review_id=review_id,
        tenant_id=current_user["tenant"],
        priority=priority
    )

    return {
        "review_id": review_id,
        "recommendations": recommendations,
        "filters": {"priority": priority}
    }

@router.post("/access-reviews/{review_id}/approve-recommendations")
async def approve_access_review_recommendations(
    review_id: str,
    request: Request,
    approved_recommendations: List[str] = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Approve and implement access review recommendations"""
    review = rbac_service.get_access_review(review_id, current_user["tenant"])
    if not review:
        raise HTTPException(status_code=404, detail="Access review not found")

    try:
        results = rbac_service.approve_access_review_recommendations(
            review_id=review_id,
            tenant_id=current_user["tenant"],
            approved_recommendations=approved_recommendations,
            approved_by=current_user["user_id"]
        )

        # Log the action
        audit_log = AuditLog(
            actor=current_user["user_id"],
            action="approve_access_review_recommendations",
            subject=f"access_review:{review_id}",
            subject_type="access_review",
            subject_id=review_id,
            tenant_id=current_user["tenant"],
            before_json={},
            after_json={"approved_recommendations": approved_recommendations},
            result="success"
        )
        db.add(audit_log)
        db.commit()

        return results

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# ============ BACKGROUND TASKS ============

async def generate_compliance_report_background(report_id: str, db: Session):
    """Background task to generate compliance report"""
    try:
        report = db.query(ComplianceReport).filter(ComplianceReport.id == report_id).first()
        if not report:
            return

        # Execute actual compliance report generation
        # Query security events and compliance violations for the report period
        report_start = report.created_at
        report_end = datetime.utcnow()

        # Get actual security events
        security_events = db.query(SecurityEvent).filter(
            SecurityEvent.tenant_id == report.tenant_id,
            SecurityEvent.created_at >= report_start,
            SecurityEvent.created_at <= report_end
        ).count()

        # Get compliance violations (failed security events)
        compliance_violations = db.query(SecurityEvent).filter(
            SecurityEvent.tenant_id == report.tenant_id,
            SecurityEvent.created_at >= report_start,
            SecurityEvent.created_at <= report_end,
            SecurityEvent.severity.in_([SecuritySeverity.HIGH, SecuritySeverity.CRITICAL])
        ).count()

        # Calculate actual metrics based on security events
        total_possible_events = max(security_events + compliance_violations, 1)
        security_score = max(0, 100 - (compliance_violations * 10))
        compliance_score = max(0, 100 - (compliance_violations * 15))
        overall_score = (security_score + compliance_score) / 2

        # Generate recommendations based on actual findings
        recommendations = []
        if compliance_violations > 0:
            recommendations.append("Review and address high-severity security events")
        if security_events > 10:
            recommendations.append("Implement additional security monitoring")
        if compliance_score < 80:
            recommendations.append("Update security policies and procedures")

        findings = {
            "security_events": security_events,
            "compliance_violations": compliance_violations,
            "recommendations": recommendations
        }

        metrics = {
            "overall_score": round(overall_score, 2),
            "security_score": round(security_score, 2),
            "compliance_score": round(compliance_score, 2)
        }

        # Update report
        report.findings = findings
        report.metrics = metrics
        report.status = ComplianceReportStatus.COMPLETED
        report.completed_at = datetime.utcnow()

        db.commit()

    except Exception as e:
        # Mark report as failed
        report = db.query(ComplianceReport).filter(ComplianceReport.id == report_id).first()
        if report:
            report.status = ComplianceReportStatus.FAILED
            report.error_message = str(e)
            db.commit()

async def execute_access_review_background(review_id: str, tenant_id: str, db: Session):
    """Background task to execute access review"""
    try:
        # Execute the review using RBAC service
        findings = rbac_service.execute_access_review(review_id, tenant_id)

        # Update review status to completed
        review = rbac_service.get_access_review(review_id, tenant_id)
        if review:
            review.status = "completed"
            review.completed_at = datetime.utcnow()

            # Generate recommendations based on findings
            recommendations = rbac_service.generate_access_review_recommendations(review_id, tenant_id)
            review.recommendations = recommendations

            db.commit()

    except Exception as e:
        # Mark review as failed
        review = rbac_service.get_access_review(review_id, tenant_id)
        if review:
            review.status = "expired"
            review.completed_at = datetime.utcnow()
            db.commit()

# ============ AUDIT TRAIL ENDPOINTS ============

@router.get("/audit-logs", response_model=List[AuditLogResponse])
async def list_audit_logs(
    request: Request,
    actor: Optional[str] = None,
    action: Optional[str] = None,
    subject_type: Optional[str] = None,
    subject_id: Optional[str] = None,
    result: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    ip_address: Optional[str] = None,
    session_id: Optional[str] = None,
    request_id: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List audit logs with comprehensive filtering"""
    # Admin users can see all audit logs, others are restricted to their tenant
    if current_user.get("role") == "ADMIN":
        query = db.query(AuditLog)
    else:
        query = db.query(AuditLog).filter(AuditLog.tenant_id == current_user["tenant"])

    if actor:
        query = query.filter(AuditLog.actor == actor)
    if action:
        query = query.filter(AuditLog.action.like(f"%{action}%"))
    if subject_type:
        query = query.filter(AuditLog.subject_type == subject_type)
    if subject_id:
        query = query.filter(AuditLog.subject_id == subject_id)
    if result:
        query = query.filter(AuditLog.result == result)
    if start_date:
        query = query.filter(AuditLog.ts >= start_date)
    if end_date:
        query = query.filter(AuditLog.ts <= end_date)
    if ip_address:
        query = query.filter(AuditLog.ip_address == ip_address)
    if session_id:
        query = query.filter(AuditLog.session_id == session_id)
    if request_id:
        query = query.filter(AuditLog.request_id == request_id)
    if search:
        query = query.filter(
            or_(
                AuditLog.action.like(f"%{search}%"),
                AuditLog.subject.like(f"%{search}%"),
                AuditLog.subject_type.like(f"%{search}%"),
                AuditLog.subject_id.like(f"%{search}%"),
                AuditLog.error_message.like(f"%{search}%")
            )
        )

    logs = query.order_by(AuditLog.ts.desc()).offset(skip).limit(limit).all()
    return logs

@router.get("/audit-logs/stats", response_model=AuditLogStats)
async def get_audit_log_stats(
    request: Request,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get audit log statistics and analytics"""
    # Admin users can see all audit logs, others are restricted to their tenant
    if current_user.get("role") == "ADMIN":
        query = db.query(AuditLog)
    else:
        query = db.query(AuditLog).filter(AuditLog.tenant_id == current_user["tenant"])

    if start_date:
        query = query.filter(AuditLog.ts >= start_date)
    if end_date:
        query = query.filter(AuditLog.ts <= end_date)

    logs = query.all()

    # Basic statistics
    total_events = len(logs)

    # Group by action
    events_by_action = {}
    for log in logs:
        events_by_action[log.action] = events_by_action.get(log.action, 0) + 1

    # Group by subject type
    events_by_subject_type = {}
    for log in logs:
        events_by_subject_type[log.subject_type] = events_by_subject_type.get(log.subject_type, 0) + 1

    # Group by actor
    events_by_actor = {}
    for log in logs:
        events_by_actor[log.actor] = events_by_actor.get(log.actor, 0) + 1

    # Group by result
    events_by_result = {}
    for log in logs:
        result = log.result or "unknown"
        events_by_result[result] = events_by_result.get(result, 0) + 1

    # Group by date (last 30 days)
    events_by_date = {}
    for log in logs:
        date_key = log.ts.strftime("%Y-%m-%d")
        events_by_date[date_key] = events_by_date.get(date_key, 0) + 1

    # Top actors (by event count)
    top_actors = sorted(
        [{"actor": actor, "count": count} for actor, count in events_by_actor.items()],
        key=lambda x: x["count"],
        reverse=True
    )[:10]

    # Top resources (by event count)
    resource_counts = {}
    for log in logs:
        key = f"{log.subject_type}:{log.subject_id}"
        resource_counts[key] = resource_counts.get(key, 0) + 1

    top_resources = sorted(
        [{"resource": resource, "count": count} for resource, count in resource_counts.items()],
        key=lambda x: x["count"],
        reverse=True
    )[:10]

    # Recent errors
    recent_errors = [
        {
            "id": log.id,
            "action": log.action,
            "subject": log.subject,
            "error_message": log.error_message,
            "timestamp": log.ts,
            "actor": log.actor
        }
        for log in logs
        if log.result == "failure" and log.error_message
    ][:10]

    return AuditLogStats(
        total_events=total_events,
        events_by_action=events_by_action,
        events_by_subject_type=events_by_subject_type,
        events_by_actor=events_by_actor,
        events_by_result=events_by_result,
        events_by_date=events_by_date,
        top_actors=top_actors,
        top_resources=top_resources,
        recent_errors=recent_errors,
        effective_permissions=[],  # Placeholder for audit log stats
        inheritance_chain=[]  # Placeholder for audit log stats
    )

@router.get("/audit-logs/{log_id}", response_model=AuditLogResponse)
async def get_audit_log(
    log_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get a specific audit log entry"""
    # Admin users can see all audit logs, others are restricted to their tenant
    if current_user.get("role") == "ADMIN":
        log = db.query(AuditLog).filter(AuditLog.id == log_id).first()
    else:
        log = db.query(AuditLog).filter(
            AuditLog.id == log_id,
            AuditLog.tenant_id == current_user["tenant"]
        ).first()

    if not log:
        raise HTTPException(status_code=404, detail="Audit log not found")

    return log

@router.post("/audit-logs/export", response_model=AuditLogExportResponse)
async def export_audit_logs(
    request: Request,
    export_request: AuditLogExportRequest,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Export audit logs with filtering"""
    export_id = str(uuid.uuid4())

    # Start background export task
    # For admin users, pass empty tenant_id to export all logs
    tenant_id_for_export = None if current_user.get("role") == "ADMIN" else current_user["tenant"]
    background_tasks.add_task(
        export_audit_logs_background,
        export_id,
        export_request,
        tenant_id_for_export,
        db
    )

    # Get total record count
    # Admin users can see all audit logs, others are restricted to their tenant
    if current_user.get("role") == "ADMIN":
        query = db.query(AuditLog)
    else:
        query = db.query(AuditLog).filter(AuditLog.tenant_id == current_user["tenant"])

    # Apply filters
    filters = export_request.filters
    if filters.actor:
        query = query.filter(AuditLog.actor == filters.actor)
    if filters.action:
        query = query.filter(AuditLog.action.like(f"%{filters.action}%"))
    if filters.subject_type:
        query = query.filter(AuditLog.subject_type == filters.subject_type)
    if filters.subject_id:
        query = query.filter(AuditLog.subject_id == filters.subject_id)
    if filters.result:
        query = query.filter(AuditLog.result == filters.result)
    if filters.start_date:
        query = query.filter(AuditLog.ts >= filters.start_date)
    if filters.end_date:
        query = query.filter(AuditLog.ts <= filters.end_date)
    if filters.ip_address:
        query = query.filter(AuditLog.ip_address == filters.ip_address)
    if filters.session_id:
        query = query.filter(AuditLog.session_id == filters.session_id)
    if filters.request_id:
        query = query.filter(AuditLog.request_id == filters.request_id)
    if filters.search:
        query = query.filter(
            or_(
                AuditLog.action.like(f"%{filters.search}%"),
                AuditLog.subject.like(f"%{filters.search}%"),
                AuditLog.subject_type.like(f"%{filters.search}%"),
                AuditLog.subject_id.like(f"%{filters.search}%"),
                AuditLog.error_message.like(f"%{filters.search}%")
            )
        )

    total_records = query.count()

    return AuditLogExportResponse(
        export_id=export_id,
        status="processing",
        total_records=total_records,
        created_at=datetime.now(timezone.utc)
    )

@router.get("/audit-logs/export/{export_id}", response_model=AuditLogExportResponse)
async def get_export_status(
    export_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get export status and download URL"""
    # Query the actual export job status from database
    # Note: This would require an ExportJob model to be implemented
    # For now, check if export file exists in storage
    from app.services.storage_service import storage_service

    try:
        # Try to get export metadata
        export_info = storage_service.get_export_metadata(export_id, current_user["tenant"])
        if export_info:
            return AuditLogExportResponse(
                export_id=export_id,
                file_url=export_info.get("file_url", f"/api/governance/audit-logs/export/{export_id}/download"),
                status=export_info.get("status", "completed"),
                total_records=export_info.get("total_records", 0),
                estimated_size=export_info.get("estimated_size", 0),
                created_at=export_info.get("created_at", datetime.now(timezone.utc))
            )
        else:
            raise HTTPException(status_code=404, detail="Export job not found")
    except Exception as e:
        # Fallback to in-progress status if service unavailable
        return AuditLogExportResponse(
            export_id=export_id,
            file_url="",
            status="processing",
            total_records=0,
            estimated_size=0,
            created_at=datetime.now(timezone.utc)
        )

# ============ ENHANCED WORKFLOW ENDPOINTS ============

@router.post("/workflows/{workflow_id}/steps", response_model=WorkflowStepResponse)
async def create_workflow_step(
    workflow_id: str,
    request: Request,
    step_data: WorkflowStepCreate = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a new workflow step"""
    # Verify workflow exists
    workflow = db.query(WorkflowDefinition).filter(
        WorkflowDefinition.id == workflow_id,
        WorkflowDefinition.tenant_id == current_user["tenant"]
    ).first()

    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow definition not found")

    step_data.workflow_definition_id = workflow_id
    step = WorkflowStep(**step_data.dict())
    db.add(step)
    db.commit()
    db.refresh(step)

    # Log the action
    audit_log = AuditLog(
        actor=current_user["user_id"],
        action="create_workflow_step",
        subject=f"workflow_step:{step.id}",
        subject_type="workflow_step",
        subject_id=step.id,
        tenant_id=current_user["tenant"],
        before_json={},
        after_json=step_data.dict(),
        result="success"
    )
    db.add(audit_log)
    db.commit()

    return step

@router.get("/workflows/{workflow_id}/steps", response_model=List[WorkflowStepResponse])
async def list_workflow_steps(
    workflow_id: str,
    request: Request,
    step_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List workflow steps for a workflow definition"""
    query = db.query(WorkflowStep).filter(
        WorkflowStep.workflow_definition_id == workflow_id
    )

    if step_type:
        query = query.filter(WorkflowStep.step_type == step_type)

    steps = query.order_by(WorkflowStep.step_number).offset(skip).limit(limit).all()
    return steps

@router.post("/workflow-instances/{instance_id}/execute", response_model=WorkflowEngineResponse)
async def execute_workflow_instance(
    instance_id: str,
    request: Request,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Execute a workflow instance using the enhanced workflow engine"""
    instance = db.query(WorkflowInstance).filter(
        WorkflowInstance.id == instance_id,
        WorkflowInstance.tenant_id == current_user["tenant"]
    ).first()

    if not instance:
        raise HTTPException(status_code=404, detail="Workflow instance not found")

    try:
        # Start workflow execution in background
        background_tasks.add_task(execute_workflow_engine, instance_id, current_user["tenant"], db)

        return WorkflowEngineResponse(
            workflow_instance_id=instance_id,
            status="in_progress",
            message="Workflow execution started",
            current_step=instance.current_step,
            next_steps=[],
            assignees=[],
            notifications_sent=[]
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to execute workflow: {str(e)}")

@router.post("/workflow-steps/{step_execution_id}/approve", response_model=WorkflowApprovalResponse)
async def approve_workflow_step(
    step_execution_id: str,
    request: Request,
    approval_data: WorkflowApprovalAction = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Approve, reject, or take action on a workflow step"""
    step_execution = db.query(WorkflowStepExecution).filter(
        WorkflowStepExecution.id == step_execution_id
    ).first()

    if not step_execution:
        raise HTTPException(status_code=404, detail="Workflow step execution not found")

    # Verify user has permission to approve
    if not step_execution.approvers or current_user["user_id"] not in step_execution.approvers:
        raise HTTPException(status_code=403, detail="User is not an authorized approver for this step")

    try:
        # Process the approval action
        result = process_workflow_approval(step_execution_id, approval_data, current_user["user_id"], db)

        # Log the action
        audit_log = AuditLog(
            actor=current_user["user_id"],
            action=f"workflow_step_{approval_data.action}",
            subject=f"workflow_step_execution:{step_execution_id}",
            subject_type="workflow_step_execution",
            subject_id=step_execution_id,
            tenant_id=current_user["tenant"],
            before_json={},
            after_json=approval_data.dict(),
            result="success"
        )
        db.add(audit_log)
        db.commit()

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process approval: {str(e)}")

@router.get("/workflow-templates", response_model=List[WorkflowTemplateResponse])
async def list_workflow_templates(
    request: Request,
    category: Optional[str] = None,
    use_case: Optional[str] = None,
    is_public: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List workflow templates with filtering"""
    query = db.query(WorkflowTemplate)

    if category:
        query = query.filter(WorkflowTemplate.category == category)
    if use_case:
        query = query.filter(WorkflowTemplate.use_case == use_case)
    if is_public is not None:
        query = query.filter(WorkflowTemplate.is_public == is_public)
    else:
        # Show public templates and tenant-specific templates
        query = query.filter(
            or_(
                WorkflowTemplate.is_public == True,
                WorkflowTemplate.tenant_id == current_user["tenant"]
            )
        )

    templates = query.order_by(WorkflowTemplate.created_at.desc()).offset(skip).limit(limit).all()
    return templates

@router.post("/workflow-templates", response_model=WorkflowTemplateResponse)
async def create_workflow_template(
    request: Request,
    template_data: WorkflowTemplateCreate = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a new workflow template"""
    template_data.created_by = current_user["user_id"]
    template_data.tenant_id = current_user["tenant"]

    template = WorkflowTemplate(**template_data.dict())
    db.add(template)
    db.commit()
    db.refresh(template)

    # Log the action
    audit_log = AuditLog(
        actor=current_user["user_id"],
        action="create_workflow_template",
        subject=f"workflow_template:{template.id}",
        subject_type="workflow_template",
        subject_id=template.id,
        tenant_id=current_user["tenant"],
        before_json={},
        after_json=template_data.dict(),
        result="success"
    )
    db.add(audit_log)
    db.commit()

    return template

@router.post("/workflows/{workflow_id}/escalation-rules", response_model=WorkflowEscalationRuleResponse)
async def create_workflow_escalation_rule(
    workflow_id: str,
    request: Request,
    rule_data: WorkflowEscalationRuleCreate = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a new workflow escalation rule"""
    # Verify workflow exists
    workflow = db.query(WorkflowDefinition).filter(
        WorkflowDefinition.id == workflow_id,
        WorkflowDefinition.tenant_id == current_user["tenant"]
    ).first()

    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow definition not found")

    rule_data.workflow_definition_id = workflow_id
    rule = WorkflowEscalationRule(**rule_data.dict())
    db.add(rule)
    db.commit()
    db.refresh(rule)

    # Log the action
    audit_log = AuditLog(
        actor=current_user["user_id"],
        action="create_workflow_escalation_rule",
        subject=f"workflow_escalation_rule:{rule.id}",
        subject_type="workflow_escalation_rule",
        subject_id=rule.id,
        tenant_id=current_user["tenant"],
        before_json={},
        after_json=rule_data.dict(),
        result="success"
    )
    db.add(audit_log)
    db.commit()

    return rule

@router.get("/workflows/{workflow_id}/escalation-rules", response_model=List[WorkflowEscalationRuleResponse])
async def list_workflow_escalation_rules(
    workflow_id: str,
    request: Request,
    step_number: Optional[int] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List escalation rules for a workflow"""
    query = db.query(WorkflowEscalationRule).filter(
        WorkflowEscalationRule.workflow_definition_id == workflow_id
    )

    if step_number is not None:
        query = query.filter(WorkflowEscalationRule.step_number == step_number)
    if is_active is not None:
        query = query.filter(WorkflowEscalationRule.is_active == is_active)

    rules = query.order_by(WorkflowEscalationRule.created_at.desc()).all()
    return rules

@router.get("/workflow-metrics", response_model=List[WorkflowMetricsResponse])
async def get_workflow_metrics(
    request: Request,
    workflow_definition_id: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    is_aggregated: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get workflow performance metrics"""
    query = db.query(WorkflowMetrics).filter(
        WorkflowMetrics.tenant_id == current_user["tenant"]
    )

    if workflow_definition_id:
        query = query.filter(WorkflowMetrics.workflow_definition_id == workflow_definition_id)
    if start_date:
        query = query.filter(WorkflowMetrics.metric_date >= start_date)
    if end_date:
        query = query.filter(WorkflowMetrics.metric_date <= end_date)
    if is_aggregated is not None:
        query = query.filter(WorkflowMetrics.is_aggregated == is_aggregated)

    metrics = query.order_by(WorkflowMetrics.metric_date.desc()).offset(skip).limit(limit).all()
    return metrics

@router.get("/workflow-instances/{instance_id}/notifications", response_model=List[WorkflowNotificationResponse])
async def get_workflow_notifications(
    instance_id: str,
    request: Request,
    status: Optional[str] = None,
    notification_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get notifications for a workflow instance"""
    query = db.query(WorkflowNotification).filter(
        WorkflowNotification.workflow_instance_id == instance_id
    )

    if status:
        query = query.filter(WorkflowNotification.status == status)
    if notification_type:
        query = query.filter(WorkflowNotification.notification_type == notification_type)

    notifications = query.order_by(WorkflowNotification.created_at.desc()).all()
    return notifications

@router.post("/workflow-instances/{instance_id}/notifications", response_model=WorkflowNotificationResponse)
async def send_workflow_notification(
    instance_id: str,
    request: Request,
    notification_data: WorkflowNotificationCreate = Body(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Send a notification for a workflow instance"""
    # Verify instance exists
    instance = db.query(WorkflowInstance).filter(
        WorkflowInstance.id == instance_id,
        WorkflowInstance.tenant_id == current_user["tenant"]
    ).first()

    if not instance:
        raise HTTPException(status_code=404, detail="Workflow instance not found")

    notification_data.workflow_instance_id = instance_id
    notification = WorkflowNotification(**notification_data.dict())
    db.add(notification)
    db.commit()
    db.refresh(notification)

    # Send notification in background
    background_tasks.add_task(send_workflow_notification_background, notification.id, db)

    return notification

# ============ BACKGROUND TASKS ============

async def execute_workflow_engine(instance_id: str, tenant_id: str, db: Session):
    """Enhanced workflow engine execution"""
    try:
        instance = db.query(WorkflowInstance).filter(
            WorkflowInstance.id == instance_id
        ).first()

        if not instance:
            return

        # Execute workflow steps
        # This is a simplified version - in production you'd implement the full workflow engine
        instance.status = WorkflowInstanceStatus.IN_PROGRESS
        db.commit()

        # Process each step
        workflow_definition = db.query(WorkflowDefinition).filter(
            WorkflowDefinition.id == instance.workflow_definition_id
        ).first()

        if workflow_definition:
            steps = db.query(WorkflowStep).filter(
                WorkflowStep.workflow_definition_id == workflow_definition.id
            ).order_by(WorkflowStep.step_number).all()

            for step in steps:
                step_execution = WorkflowStepExecution(
                    workflow_instance_id=instance_id,
                    workflow_step_id=step.id,
                    step_number=step.step_number,
                    step_type=step.step_type,
                    status=WorkflowStepStatus.IN_PROGRESS,
                    config_json=step.config_json,
                    started_at=datetime.utcnow()
                )
                db.add(step_execution)
                db.commit()

                # Process step based on type
                if step.step_type == WorkflowStepType.MANUAL_APPROVAL:
                    # Assign to approvers
                    step_execution.approvers = step.approval_users or []
                    step_execution.due_date = datetime.utcnow() + timedelta(minutes=step.timeout_minutes or 1440)
                    db.commit()
                elif step.step_type == WorkflowStepType.AUTOMATED_APPROVAL:
                    # Auto-approve if conditions are met
                    step_execution.status = WorkflowStepStatus.COMPLETED
                    step_execution.completed_at = datetime.utcnow()
                    step_execution.output_data = {"auto_approved": True}
                    db.commit()

                # Check if workflow is complete
                if step.step_number == len(steps):
                    instance.status = WorkflowInstanceStatus.COMPLETED
                    instance.completed_at = datetime.utcnow()
                    db.commit()

        db.commit()

    except Exception as e:
        # Mark instance as failed
        instance = db.query(WorkflowInstance).filter(WorkflowInstance.id == instance_id).first()
        if instance:
            instance.status = WorkflowInstanceStatus.ERROR
            instance.error_message = str(e)
            db.commit()

async def process_workflow_approval(step_execution_id: str, approval_data: WorkflowApprovalAction, user_id: str, db: Session):
    """Process workflow step approval actions"""
    step_execution = db.query(WorkflowStepExecution).filter(
        WorkflowStepExecution.id == step_execution_id
    ).first()

    if not step_execution:
        raise HTTPException(status_code=404, detail="Workflow step execution not found")

    # Initialize approval tracking if needed
    if step_execution.approvals_received is None:
        step_execution.approvals_received = []
    if step_execution.rejections_received is None:
        step_execution.rejections_received = []

    approval_record = {
        "user_id": user_id,
        "action": approval_data.action,
        "comments": approval_data.comments,
        "timestamp": datetime.utcnow().isoformat(),
        "evidence": approval_data.evidence
    }

    if approval_data.action == "approve":
        step_execution.approvals_received.append(approval_record)

        # Check if we have enough approvals
        workflow_step = db.query(WorkflowStep).filter(
            WorkflowStep.id == step_execution.workflow_step_id
        ).first()

        if workflow_step and len(step_execution.approvals_received) >= workflow_step.min_approvals:
            step_execution.status = WorkflowStepStatus.COMPLETED
            step_execution.completed_at = datetime.utcnow()

    elif approval_data.action == "reject":
        step_execution.rejections_received.append(approval_record)
        step_execution.status = WorkflowStepStatus.FAILED
        step_execution.completed_at = datetime.utcnow()

    elif approval_data.action == "delegate":
        step_execution.approvers = [approval_data.delegate_to] if approval_data.delegate_to else []

    elif approval_data.action == "escalate":
        # Handle escalation logic
        pass

    db.commit()

    # Update workflow instance status if needed
    instance = db.query(WorkflowInstance).filter(
        WorkflowInstance.id == step_execution.workflow_instance_id
    ).first()

    if instance:
        # Check if all steps are complete
        all_steps = db.query(WorkflowStepExecution).filter(
            WorkflowStepExecution.workflow_instance_id == instance.id
        ).all()

        if all(step.status in [WorkflowStepStatus.COMPLETED, WorkflowStepStatus.SKIPPED] for step in all_steps):
            instance.status = WorkflowInstanceStatus.COMPLETED
            instance.completed_at = datetime.utcnow()
        elif any(step.status == WorkflowStepStatus.FAILED for step in all_steps):
            instance.status = WorkflowInstanceStatus.REJECTED

        db.commit()

    return WorkflowApprovalResponse(
        success=True,
        message=f"Workflow step {approval_data.action} processed successfully",
        workflow_instance_id=step_execution.workflow_instance_id,
        current_status=step_execution.status.value,
        approvals_received=len(step_execution.approvals_received or []),
        approvals_needed=1  # Would get this from workflow step config
    )

async def send_workflow_notification_background(notification_id: str, db: Session):
    """Background task to send workflow notifications"""
    try:
        notification = db.query(WorkflowNotification).filter(
            WorkflowNotification.id == notification_id
        ).first()

        if not notification:
            return

        # Update status
        notification.status = "sent"
        notification.sent_at = datetime.utcnow()
        db.commit()

        # In a real implementation, you would:
        # 1. Send email/in-app notification/Slack message
        # 2. Update delivery status
        # 3. Handle retries for failed deliveries

    except Exception as e:
        # Mark as failed
        notification = db.query(WorkflowNotification).filter(
            WorkflowNotification.id == notification_id
        ).first()
        if notification:
            notification.status = "failed"
            notification.error_message = str(e)
            db.commit()

async def export_audit_logs_background(
    export_id: str,
    export_request: AuditLogExportRequest,
    tenant_id: str,
    db: Session
):
    """Background task to export audit logs"""
    try:
        from app.services.storage_service import storage_service
        import json
        import csv
        import io

        # Query actual audit logs with filters
        # For admin users (empty tenant_id), no tenant filter is applied
        if tenant_id:
            query = db.query(AuditLog).filter(AuditLog.tenant_id == tenant_id)
        else:
            query = db.query(AuditLog)

        # Apply filters if they exist
        filters = export_request.filters
        if filters:
            if filters.start_date:
                query = query.filter(AuditLog.ts >= filters.start_date)
            if filters.end_date:
                query = query.filter(AuditLog.ts <= filters.end_date)
            if filters.user_id:
                query = query.filter(AuditLog.actor == filters.user_id)
            if filters.action:
                query = query.filter(AuditLog.action == filters.action)
            if filters.subject_type:
                query = query.filter(AuditLog.subject_type == filters.subject_type)

        # Get all matching audit logs
        audit_logs = query.all()

        # Format data according to requested format
        if filters.format == "json":
            # Convert to JSON
            export_data = []
            for log in audit_logs:
                export_data.append({
                    "timestamp": log.ts.isoformat(),
                    "user_id": log.actor,
                    "action": log.action,
                    "subject": log.subject,
                    "subject_type": log.subject_type,
                    "subject_id": log.subject_id,
                    "result": log.result,
                    "ip_address": log.ip_address,
                    "error_message": log.error_message
                })

            # Save to storage
            file_content = json.dumps(export_data, indent=2)
            content_type = "application/json"
            file_extension = "json"

        elif filters.format == "csv":
            # Convert to CSV
            output = io.StringIO()
            fieldnames = ["timestamp", "user_id", "action", "subject", "subject_type", "subject_id", "result", "ip_address", "error_message"]
            writer = csv.DictWriter(output, fieldnames=fieldnames)
            writer.writeheader()

            for log in audit_logs:
                writer.writerow({
                    "timestamp": log.ts.isoformat(),
                    "user_id": log.actor,
                    "action": log.action,
                    "subject": log.subject,
                    "subject_type": log.subject_type,
                    "subject_id": log.subject_id,
                    "result": log.result,
                    "ip_address": log.ip_address,
                    "error_message": log.error_message
                })

            file_content = output.getvalue()
            content_type = "text/csv"
            file_extension = "csv"
        else:
            raise ValueError(f"Unsupported export format: {filters.format}")

        # Save to cloud storage
        file_path = f"audit-logs/{tenant_id}/{export_id}.{file_extension}"
        storage_service.upload_file(
            file_path=file_path,
            content=file_content,
            content_type=content_type,
            metadata={
                "export_id": export_id,
                "tenant_id": tenant_id,
                "total_records": len(audit_logs),
                "format": filters.format,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        )

        # Update export job status (would require ExportJob model)
        # For now, the status will be checked via storage service

    except Exception as e:
        # Log error and handle failure
        logger.error(f"Export failed for {export_id}: {str(e)}")
        # Update export job status to failed (would require ExportJob model)
        raise

# =====================
# SECURITY MONITORING ENDPOINTS
# =====================

@router.get("/security/dashboard/metrics", response_model=SecurityDashboardMetrics)
async def get_security_dashboard_metrics(
    tenant_id: str,
    time_range: Optional[str] = Query(None, description="Time range: 1h, 24h, 7d, 30d"),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get security dashboard metrics and key indicators"""
    try:
        # Calculate date range
        if not end_date:
            end_date = datetime.now(timezone.utc)

        # Handle time_range parameter
        if time_range and not start_date:
            if time_range == "1h":
                start_date = end_date - timedelta(hours=1)
            elif time_range == "24h":
                start_date = end_date - timedelta(hours=24)
            elif time_range == "7d":
                start_date = end_date - timedelta(days=7)
            elif time_range == "30d":
                start_date = end_date - timedelta(days=30)

        # Default to 24 hours if no time_range or start_date specified
        if not start_date:
            start_date = end_date - timedelta(days=1)

        # Admin users can see all security data, others are restricted to their tenant
        if current_user.get("role") == "ADMIN":
            event_filter = True
            alert_filter = True
            incident_filter = True
            threat_filter = True
            user_filter = True
            metrics_filter = True
        else:
            event_filter = SecurityEvent.tenant_id == current_user["tenant"]
            alert_filter = SecurityAlert.tenant_id == current_user["tenant"]
            incident_filter = SecurityIncident.tenant_id == current_user["tenant"]
            threat_filter = ThreatIndicator.tenant_id == current_user["tenant"]
            user_filter = User.organization == current_user["tenant"]
            metrics_filter = SecurityMetrics.tenant_id == current_user["tenant"]

        # Get security events counts
        total_events = db.query(SecurityEvent).filter(
            event_filter,
            SecurityEvent.created_at >= start_date,
            SecurityEvent.created_at <= end_date
        ).count()

        critical_events = db.query(SecurityEvent).filter(
            event_filter,
            SecurityEvent.created_at >= start_date,
            SecurityEvent.created_at <= end_date,
            SecurityEvent.severity == SecuritySeverity.CRITICAL
        ).count()

        high_severity_events = db.query(SecurityEvent).filter(
            event_filter,
            SecurityEvent.created_at >= start_date,
            SecurityEvent.created_at <= end_date,
            SecurityEvent.severity == SecuritySeverity.HIGH
        ).count()

        # Get security alerts counts
        active_alerts = db.query(SecurityAlert).filter(
            alert_filter,
            SecurityAlert.status.in_([SecurityAlertStatus.OPEN, SecurityAlertStatus.INVESTIGATING])
        ).count()

        critical_alerts = db.query(SecurityAlert).filter(
            alert_filter,
            SecurityAlert.status.in_([SecurityAlertStatus.OPEN, SecurityAlertStatus.INVESTIGATING]),
            SecurityAlert.severity == SecuritySeverity.CRITICAL
        ).count()

        # Get security incidents counts
        active_incidents = db.query(SecurityIncident).filter(
            incident_filter,
            SecurityIncident.status.in_([SecurityIncidentStatus.DETECTED, SecurityIncidentStatus.INVESTIGATING])
        ).count()

        critical_incidents = db.query(SecurityIncident).filter(
            incident_filter,
            SecurityIncident.status.in_([SecurityIncidentStatus.DETECTED, SecurityIncidentStatus.INVESTIGATING]),
            SecurityIncident.severity == SecurityIncidentSeverity.CRITICAL
        ).count()

        # Get threat intelligence metrics
        threat_indicators = db.query(ThreatIndicator).filter(
            threat_filter,
            ThreatIndicator.is_active == True
        ).count()

        blocked_threats = db.query(ThreatIndicator).filter(
            threat_filter,
            ThreatIndicator.auto_blocked == True
        ).count()

        # Get user activity metrics
        unique_active_users = db.query(User.id).filter(
            user_filter
        ).count()

        # Get anomaly score (latest)
        latest_metrics = db.query(SecurityMetrics).filter(
            metrics_filter
        ).order_by(SecurityMetrics.metric_date.desc()).first()

        # Calculate mean time to resolve
        resolved_incidents = db.query(SecurityIncident).filter(
            incident_filter,
            SecurityIncident.status == SecurityIncidentStatus.RESOLVED,
            SecurityIncident.resolved_at.isnot(None)
        ).all()

        mean_time_to_resolve = None
        if resolved_incidents:
            total_minutes = sum(
                (incident.resolved_at - incident.detected_at).total_seconds() / 60
                for incident in resolved_incidents
            )
            mean_time_to_resolve = int(total_minutes / len(resolved_incidents))

        return SecurityDashboardMetrics(
            total_events=total_events,
            critical_events=critical_events,
            high_severity_events=high_severity_events,
            active_alerts=active_alerts,
            critical_alerts=critical_alerts,
            active_incidents=active_incidents,
            critical_incidents=critical_incidents,
            compliance_score=latest_metrics.compliance_score if latest_metrics else None,
            threat_indicators=threat_indicators,
            blocked_threats=blocked_threats,
            anomaly_score=latest_metrics.anomaly_score if latest_metrics else None,
            mean_time_to_resolve_minutes=mean_time_to_resolve,
            unique_active_users=unique_active_users,
            suspicious_activities=latest_metrics.suspicious_user_activities if latest_metrics else 0
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get security dashboard metrics: {str(e)}")

@router.get("/security/events", response_model=List[SecurityEventResponse])
async def get_security_events(
    tenant_id: str,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    event_types: Optional[List[str]] = None,
    severities: Optional[List[str]] = None,
    user_id: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    ip_address: Optional[str] = None,
    is_resolved: Optional[bool] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get security events with filtering"""
    try:
        # Admin users can see all security events, others are restricted to their tenant
        if current_user.get("role") == "ADMIN":
            query = db.query(SecurityEvent)
        else:
            query = db.query(SecurityEvent).filter(SecurityEvent.tenant_id == current_user["tenant"])

        # Apply filters
        if start_date:
            query = query.filter(SecurityEvent.created_at >= start_date)
        if end_date:
            query = query.filter(SecurityEvent.created_at <= end_date)
        if event_types:
            query = query.filter(SecurityEvent.event_type.in_(event_types))
        if severities:
            query = query.filter(SecurityEvent.severity.in_(severities))
        if user_id:
            query = query.filter(SecurityEvent.user_id == user_id)
        if resource_type:
            query = query.filter(SecurityEvent.resource_type == resource_type)
        if resource_id:
            query = query.filter(SecurityEvent.resource_id == resource_id)
        if ip_address:
            query = query.filter(SecurityEvent.ip_address == ip_address)
        if is_resolved is not None:
            query = query.filter(SecurityEvent.is_resolved == is_resolved)

        # Apply pagination
        events = query.order_by(SecurityEvent.created_at.desc()).offset(offset).limit(limit).all()

        return [SecurityEventResponse.model_validate(event) for event in events]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get security events: {str(e)}")

@router.post("/security/alerts", response_model=SecurityAlertResponse)
async def create_security_alert(
    alert: SecurityAlertCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a new security alert"""
    try:
        # Validate tenant access
        if alert.tenant_id != current_user["tenant_id"]:
            raise HTTPException(status_code=403, detail="Access denied")

        db_alert = SecurityAlert(
            id=str(uuid.uuid4()),
            alert_type=alert.alert_type,
            severity=alert.severity,
            title=alert.title,
            description=alert.description,
            source=alert.source,
            source_id=alert.source_id,
            detection_details=alert.detection_details,
            affected_resources=alert.affected_resources,
            risk_score=alert.risk_score,
            confidence_score=alert.confidence_score,
            tenant_id=alert.tenant_id,
            user_id=alert.user_id,
            session_id=alert.session_id,
            ip_address=alert.ip_address,
            user_agent=alert.user_agent
        )

        db.add(db_alert)
        db.commit()
        db.refresh(db_alert)

        return SecurityAlertResponse.model_validate(db_alert)

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create security alert: {str(e)}")

@router.get("/security/alerts", response_model=List[SecurityAlertResponse])
async def get_security_alerts(
    tenant_id: str,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    alert_types: Optional[List[str]] = None,
    severities: Optional[List[str]] = None,
    statuses: Optional[List[str]] = None,
    assigned_to: Optional[str] = None,
    user_id: Optional[str] = None,
    source: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get security alerts with filtering"""
    try:
        # Admin users can see all security alerts, others are restricted to their tenant
        if current_user.get("role") == "ADMIN":
            query = db.query(SecurityAlert)
        else:
            query = db.query(SecurityAlert).filter(SecurityAlert.tenant_id == current_user["tenant"])

        # Apply filters
        if start_date:
            query = query.filter(SecurityAlert.detected_at >= start_date)
        if end_date:
            query = query.filter(SecurityAlert.detected_at <= end_date)
        if alert_types:
            query = query.filter(SecurityAlert.alert_type.in_(alert_types))
        if severities:
            query = query.filter(SecurityAlert.severity.in_(severities))
        if statuses:
            query = query.filter(SecurityAlert.status.in_(statuses))
        if assigned_to:
            query = query.filter(SecurityAlert.assigned_to == assigned_to)
        if user_id:
            query = query.filter(SecurityAlert.user_id == user_id)
        if source:
            query = query.filter(SecurityAlert.source == source)

        # Apply pagination
        alerts = query.order_by(SecurityAlert.detected_at.desc()).offset(offset).limit(limit).all()

        return [SecurityAlertResponse.model_validate(alert) for alert in alerts]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get security alerts: {str(e)}")

@router.put("/security/alerts/{alert_id}", response_model=SecurityAlertResponse)
async def update_security_alert(
    alert_id: str,
    alert_update: SecurityAlertUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update a security alert"""
    try:
        alert = db.query(SecurityAlert).filter(SecurityAlert.id == alert_id).first()
        if not alert:
            raise HTTPException(status_code=404, detail="Security alert not found")

        # Validate tenant access
        if alert.tenant_id != current_user["tenant_id"]:
            raise HTTPException(status_code=403, detail="Access denied")

        # Update fields
        for field, value in alert_update.dict(exclude_unset=True).items():
            setattr(alert, field, value)

        # Set resolved timestamp if status is being set to resolved
        if alert_update.status == "resolved":
            alert.resolved_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(alert)

        return SecurityAlertResponse.model_validate(alert)

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update security alert: {str(e)}")

@router.post("/security/incidents", response_model=SecurityIncidentResponse)
async def create_security_incident(
    incident: SecurityIncidentCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a new security incident"""
    try:
        # Validate tenant access
        if incident.tenant_id != current_user["tenant_id"]:
            raise HTTPException(status_code=403, detail="Access denied")

        db_incident = SecurityIncident(
            id=str(uuid.uuid4()),
            incident_type=incident.incident_type,
            severity=incident.severity,
            title=incident.title,
            description=incident.description,
            summary=incident.summary,
            detection_method=incident.detection_method,
            classification=incident.classification,
            impact_score=incident.impact_score,
            affected_systems=incident.affected_systems,
            data_affected=incident.data_affected,
            business_impact=incident.business_impact,
            tenant_id=incident.tenant_id,
            reported_by=incident.reported_by,
            assigned_to=incident.assigned_to,
            related_alerts=incident.related_alerts,
            related_events=incident.related_events
        )

        db.add(db_incident)
        db.commit()
        db.refresh(db_incident)

        return SecurityIncidentResponse.model_validate(db_incident)

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create security incident: {str(e)}")

@router.get("/security/incidents", response_model=List[SecurityIncidentResponse])
async def get_security_incidents(
    tenant_id: str,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    incident_types: Optional[List[str]] = None,
    severities: Optional[List[str]] = None,
    statuses: Optional[List[str]] = None,
    assigned_to: Optional[str] = None,
    reported_by: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get security incidents with filtering"""
    try:
        # Admin users can see all security incidents, others are restricted to their tenant
        if current_user.get("role") == "ADMIN":
            query = db.query(SecurityIncident)
        else:
            query = db.query(SecurityIncident).filter(SecurityIncident.tenant_id == current_user["tenant"])

        # Apply filters
        if start_date:
            query = query.filter(SecurityIncident.detected_at >= start_date)
        if end_date:
            query = query.filter(SecurityIncident.detected_at <= end_date)
        if incident_types:
            query = query.filter(SecurityIncident.incident_type.in_(incident_types))
        if severities:
            query = query.filter(SecurityIncident.severity.in_(severities))
        if statuses:
            query = query.filter(SecurityIncident.status.in_(statuses))
        if assigned_to:
            query = query.filter(SecurityIncident.assigned_to == assigned_to)
        if reported_by:
            query = query.filter(SecurityIncident.reported_by == reported_by)

        # Apply pagination
        incidents = query.order_by(SecurityIncident.detected_at.desc()).offset(offset).limit(limit).all()

        return [SecurityIncidentResponse.model_validate(incident) for incident in incidents]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get security incidents: {str(e)}")

@router.post("/security/anomaly-detect", response_model=AnomalyDetectionResponse)
async def detect_anomaly(
    request: AnomalyDetectionRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Detect anomalies using configured rules"""
    try:
        # Get the anomaly detection rule
        rule = db.query(AnomalyDetectionRule).filter(
            AnomalyDetectionRule.id == request.rule_id,
            AnomalyDetectionRule.is_active == True
        ).first()

        if not rule:
            raise HTTPException(status_code=404, detail="Anomaly detection rule not found")

        # Simple anomaly detection logic (in production, this would be more sophisticated)
        threshold_config = rule.threshold_config
        detection_config = rule.detection_config

        # Calculate baseline (for demo, use a simple moving average)
        baseline_value = detection_config.get("baseline", 50.0)
        threshold_percent = threshold_config.get("threshold_percent", 20.0)

        # Calculate deviation
        if baseline_value > 0:
            deviation_percent = abs((request.metric_value - baseline_value) / baseline_value) * 100
        else:
            deviation_percent = 0

        # Determine if it's an anomaly
        is_anomaly = deviation_percent > threshold_percent

        # Calculate anomaly score (simplified)
        anomaly_score = min(deviation_percent / threshold_percent, 10.0)

        # Determine severity
        severity = None
        if is_anomaly:
            if anomaly_score > 8.0:
                severity = "critical"
            elif anomaly_score > 6.0:
                severity = "high"
            elif anomaly_score > 4.0:
                severity = "medium"
            else:
                severity = "low"

        # Create detection result
        detection_result = AnomalyDetectionResult(
            id=str(uuid.uuid4()),
            rule_id=rule.id,
            anomaly_score=str(anomaly_score),
            baseline_value=str(baseline_value),
            actual_value=str(request.metric_value),
            deviation_percentage=str(deviation_percent),
            is_anomaly=is_anomaly,
            severity=severity,
            confidence_level="medium",
            entity_type=request.entity_type,
            entity_id=request.entity_id,
            metric_name=rule.target_metric,
            time_window_start=request.timestamp,
            time_window_end=request.timestamp,
            detection_details={
                "threshold_percent": threshold_percent,
                "deviation_percent": deviation_percent,
                "baseline_value": baseline_value,
                "actual_value": request.metric_value,
                "context_data": request.context_data
            },
            tenant_id=current_user["tenant_id"]
        )

        db.add(detection_result)

        # Generate alert if needed
        alert_generated = False
        alert_id = None

        if is_anomaly and rule.alert_on_detection:
            alert = SecurityAlert(
                id=str(uuid.uuid4()),
                alert_type=SecurityAlertType.ANOMALY_DETECTED,
                severity=getattr(SecuritySeverity, severity.upper()) if severity else SecuritySeverity.MEDIUM,
                title=f"Anomaly Detected: {rule.name}",
                description=f"Anomaly detected in {rule.target_metric}: {request.metric_value} (baseline: {baseline_value})",
                source="anomaly_detection",
                source_id=rule.id,
                detection_details=detection_result.detection_details,
                risk_score=str(anomaly_score),
                confidence_score="medium",
                tenant_id=current_user["tenant_id"],
                user_id=current_user["user_id"] if request.entity_type == "user" else None,
                session_id=request.context_data.get("session_id") if request.context_data else None,
                ip_address=request.context_data.get("ip_address") if request.context_data else None,
                user_agent=request.context_data.get("user_agent") if request.context_data else None
            )

            db.add(alert)
            alert_generated = True
            alert_id = alert.id

        # Update rule statistics
        rule.total_detections += 1
        if is_anomaly:
            rule.true_positives += 1
        else:
            rule.false_positives += 1
        rule.last_detection_at = datetime.now(timezone.utc)

        db.commit()

        return AnomalyDetectionResponse(
            is_anomaly=is_anomaly,
            anomaly_score=anomaly_score,
            baseline_value=baseline_value,
            confidence_level="medium",
            severity=severity,
            contributing_factors=["deviation_from_baseline"],
            alert_generated=alert_generated,
            alert_id=alert_id
        )

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to detect anomaly: {str(e)}")

@router.get("/security/anomaly-rules", response_model=List[AnomalyDetectionRuleResponse])
async def get_anomaly_detection_rules(
    tenant_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get anomaly detection rules for tenant"""
    try:
        # Admin users can see all anomaly detection rules, others are restricted to their tenant
        if current_user.get("role") == "ADMIN":
            rules = db.query(AnomalyDetectionRule).all()
        else:
            rules = db.query(AnomalyDetectionRule).filter(
                AnomalyDetectionRule.tenant_id == current_user["tenant"]
            ).all()

        return [AnomalyDetectionRuleResponse.model_validate(rule) for rule in rules]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get anomaly detection rules: {str(e)}")

@router.get("/security/anomaly-results", response_model=List[AnomalyDetectionResponse])
async def get_anomaly_detection_results(
    tenant_id: str,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get recent anomaly detection results for tenant"""
    try:
        # Admin users can see all anomaly detection results, others are restricted to their tenant
        if current_user.get("role") == "ADMIN":
            results = db.query(AnomalyDetectionResult).order_by(
                AnomalyDetectionResult.created_at.desc()
            ).limit(limit).all()
        else:
            results = db.query(AnomalyDetectionResult).filter(
                AnomalyDetectionResult.tenant_id == current_user["tenant"]
            ).order_by(AnomalyDetectionResult.created_at.desc()).limit(limit).all()

        return [AnomalyDetectionResponse.model_validate(result) for result in results]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get anomaly detection results: {str(e)}")

@router.post("/security/threat-intelligence/check", response_model=SecurityThreatIntelligenceResponse)
async def check_threat_intelligence(
    request: SecurityThreatIntelligenceRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Check if an indicator is a known threat"""
    try:
        # Query threat indicators
        query = db.query(ThreatIndicator).filter(
            ThreatIndicator.tenant_id == current_user["tenant_id"],
            ThreatIndicator.indicator_type == request.indicator_type,
            ThreatIndicator.indicator_value == request.indicator_value
        )

        if request.check_active_only:
            query = query.filter(ThreatIndicator.is_active == True)

        # Check expiration
        now = datetime.now(timezone.utc)
        query = query.filter(
            or_(
                ThreatIndicator.expires_at.is_(None),
                ThreatIndicator.expires_at > now
            )
        )

        indicator = query.first()

        if not indicator:
            return SecurityThreatIntelligenceResponse(
                is_threat=False,
                is_blocked=False
            )

        return SecurityThreatIntelligenceResponse(
            is_threat=True,
            threat_type=indicator.threat_type,
            threat_actor=indicator.threat_actor,
            confidence_score=indicator.confidence_score,
            severity=indicator.severity.value if indicator.severity else None,
            description=indicator.description,
            tags=indicator.tags,
            is_blocked=indicator.auto_blocked,
            block_reason=indicator.block_reason,
            first_seen=indicator.first_seen,
            last_seen=indicator.last_seen,
            expires_at=indicator.expires_at
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to check threat intelligence: {str(e)}")

@router.post("/security/threat-intelligence/feeds", response_model=ThreatIntelligenceFeedResponse)
async def create_threat_intelligence_feed(
    feed: ThreatIntelligenceFeedCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a threat intelligence feed"""
    try:
        # Validate tenant access
        if feed.tenant_id != current_user["tenant_id"]:
            raise HTTPException(status_code=403, detail="Access denied")

        db_feed = ThreatIntelligenceFeed(
            id=str(uuid.uuid4()),
            name=feed.name,
            description=feed.description,
            feed_type=feed.feed_type,
            source_url=feed.source_url,
            api_endpoint=feed.api_endpoint,
            is_active=feed.is_active,
            update_frequency_minutes=feed.update_frequency_minutes,
            api_key=feed.api_key,
            auth_config=feed.auth_config,
            tenant_id=feed.tenant_id,
            created_by=current_user["user_id"]
        )

        db.add(db_feed)
        db.commit()
        db.refresh(db_feed)

        return ThreatIntelligenceFeedResponse.model_validate(db_feed)

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create threat intelligence feed: {str(e)}")

@router.get("/security/threat-intelligence/feeds", response_model=List[ThreatIntelligenceFeedResponse])
async def get_threat_intelligence_feeds(
    tenant_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get threat intelligence feeds for tenant"""
    try:
        # Admin users can see all threat intelligence feeds, others are restricted to their tenant
        if current_user.get("role") == "ADMIN":
            feeds = db.query(ThreatIntelligenceFeed).all()
        else:
            feeds = db.query(ThreatIntelligenceFeed).filter(
                ThreatIntelligenceFeed.tenant_id == current_user["tenant"]
            ).all()

        return [ThreatIntelligenceFeedResponse.model_validate(feed) for feed in feeds]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get threat intelligence feeds: {str(e)}")

@router.get("/security/threat-intelligence/indicators", response_model=List[ThreatIndicatorResponse])
async def get_threat_intelligence_indicators(
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get threat intelligence indicators"""
    try:
        indicators = db.query(ThreatIndicator).limit(limit).all()

        return [ThreatIndicatorResponse(
            id=indicator.id,
            indicator_type=indicator.indicator_type,
            value=indicator.indicator_value,
            description=indicator.description,
            threat_types=[indicator.threat_type] if indicator.threat_type else [],
            confidence_level=indicator.confidence_score,
            source=indicator.source_description,
            is_active=indicator.is_active,
            created_at=indicator.first_seen,
            updated_at=indicator.last_seen,
            expires_at=indicator.expires_at,
            tags=indicator.tags or [],
            metadata=indicator.context_data or {}
        ) for indicator in indicators]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get threat intelligence indicators: {str(e)}")

@router.post("/security/metrics", response_model=SecurityMetricsResponse)
async def create_security_metrics(
    metrics: SecurityMetricsCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create security metrics record"""
    try:
        # Validate tenant access
        if metrics.tenant_id != current_user["tenant_id"]:
            raise HTTPException(status_code=403, detail="Access denied")

        db_metrics = SecurityMetrics(
            id=str(uuid.uuid4()),
            tenant_id=metrics.tenant_id,
            metric_date=metrics.metric_date,
            total_security_events=metrics.total_security_events,
            critical_events=metrics.critical_events,
            high_severity_events=metrics.high_severity_events,
            medium_severity_events=metrics.medium_severity_events,
            low_severity_events=metrics.low_severity_events,
            total_alerts=metrics.total_alerts,
            open_alerts=metrics.open_alerts,
            resolved_alerts=metrics.resolved_alerts,
            false_positive_alerts=metrics.false_positive_alerts,
            total_incidents=metrics.total_incidents,
            active_incidents=metrics.active_incidents,
            resolved_incidents=metrics.resolved_incidents,
            mean_time_to_resolve_minutes=metrics.mean_time_to_resolve_minutes,
            anomaly_score=metrics.anomaly_score,
            baseline_anomaly_score=metrics.baseline_anomaly_score,
            anomaly_detection_count=metrics.anomaly_detection_count,
            compliance_score=metrics.compliance_score,
            policy_violations=metrics.policy_violations,
            compliance_checks_passed=metrics.compliance_checks_passed,
            compliance_checks_failed=metrics.compliance_checks_failed,
            threat_indicators_detected=metrics.threat_indicators_detected,
            known_threats_blocked=metrics.known_threats_blocked,
            suspicious_ips_blocked=metrics.suspicious_ips_blocked,
            avg_response_time_ms=metrics.avg_response_time_ms,
            system_load_score=metrics.system_load_score,
            unique_active_users=metrics.unique_active_users,
            suspicious_user_activities=metrics.suspicious_user_activities,
            metrics_json=metrics.metrics_json
        )

        db.add(db_metrics)
        db.commit()
        db.refresh(db_metrics)

        return SecurityMetricsResponse.model_validate(db_metrics)

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create security metrics: {str(e)}")

