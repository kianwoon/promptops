from fastapi import APIRouter, Depends, HTTPException, Body, Request
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

from app.database import get_db
from app.models import ApprovalRequest, Prompt, AuditLog, WorkflowDefinition, WorkflowInstance, WorkflowInstanceStatus
from app.schemas import (
    ApprovalRequestCreate, ApprovalRequestResponse, ApprovalRequestResponseEnhanced,
    ApprovalRequestUpdate, PromptComparisonResponse, PromptResponse,
    WorkflowContext, WorkflowStepInfo
)
from app.auth import get_current_user
from app.auth.approval_permissions import check_specific_approval_access
from app.auth.workflow_approval_permissions import (
    check_workflow_approval_permission,
    get_workflow_approval_context,
    check_workflow_initiation_permission
)
from app.services.workflow_approval_service import WorkflowApprovalService

router = APIRouter()

@router.get("/permissions/check")
async def check_approval_permissions(
    current_user: dict = Depends(get_current_user)
):
    """
    Check if current user has permissions to approve/reject requests
    Returns permission details for UI feedback
    """
    try:
        from app.auth.rbac import rbac_service, Permission
        from app.auth.approval_permissions import get_approval_permission_error_message

        user_roles = current_user.get("roles", [])
        user_id = current_user.get("user_id")

        if not user_roles:
            return {
                "has_approval_permissions": False,
                "can_approve": False,
                "can_reject": False,
                "message": "No roles assigned to user",
                "user_roles": [],
                "required_roles": ["admin", "approver"]
            }

        # Check specific permissions
        can_approve = rbac_service.can_perform_action(
            user_roles=user_roles,
            action=Permission.APPROVE_PROMPT.value,
            resource_type="approval_request"
        )

        can_reject = rbac_service.can_perform_action(
            user_roles=user_roles,
            action=Permission.REJECT_PROMPT.value,
            resource_type="approval_request"
        )

        has_permissions = can_approve or can_reject

        return {
            "has_approval_permissions": has_permissions,
            "can_approve": can_approve,
            "can_reject": can_reject,
            "message": get_approval_permission_error_message(user_roles) if not has_permissions else "User has approval permissions",
            "user_roles": user_roles,
            "required_roles": ["admin", "approver"],
            "user_id": user_id
        }

    except Exception as e:
        logger.error(f"Error checking approval permissions: {str(e)}")
        return {
            "has_approval_permissions": False,
            "can_approve": False,
            "can_reject": False,
            "message": f"Error checking permissions: {str(e)}",
            "user_roles": current_user.get("roles", []),
            "required_roles": ["admin", "approver"]
        }

@router.get("/", response_model=List[ApprovalRequestResponseEnhanced])
async def list_approval_requests(
    prompt_id: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Join with Prompt table to get version information
    query = db.query(
        ApprovalRequest,
        Prompt.version.label('prompt_version'),
        Prompt.name.label('prompt_name'),
        Prompt.description.label('prompt_description'),
        Prompt.is_active.label('prompt_is_active'),
        Prompt.created_by.label('prompt_created_by'),
        Prompt.created_at.label('prompt_created_at')
    ).join(Prompt, ApprovalRequest.prompt_id == Prompt.id)

    if prompt_id:
        query = query.filter(ApprovalRequest.prompt_id == prompt_id)
    if status:
        query = query.filter(ApprovalRequest.status == status)

    requests = query.offset(skip).limit(limit).all()

    # Convert result to match the enhanced response schema
    result = []
    for request in requests:
        approval_request = request[0]
        prompt_version = request[1]
        prompt_name = request[2]
        prompt_description = request[3]
        prompt_is_active = request[4]
        prompt_created_by = request[5]
        prompt_created_at = request[6]

        # Build workflow context - always create one for consistency
        workflow_context = WorkflowContext(
            has_workflow=False,
            workflow_instance_id=None,
            workflow_name=None,
            workflow_description=None,
            current_step=None,
            total_steps=None,
            workflow_status=None,
            current_step_info=None,
            evidence_required=approval_request.evidence_required or False,
            current_evidence=approval_request.evidence or {},
            initiated_by=None,
            created_at=None,
            due_date=None
        )
        if approval_request.workflow_instance_id:
            try:
                workflow_instance = db.query(WorkflowInstance).filter(
                    WorkflowInstance.id == approval_request.workflow_instance_id
                ).first()

                if workflow_instance:
                    workflow_def = db.query(WorkflowDefinition).filter(
                        WorkflowDefinition.id == workflow_instance.workflow_definition_id
                    ).first()

                    if workflow_def and workflow_def.steps_json:
                        current_step_info = None
                        if approval_request.workflow_step is not None and approval_request.workflow_step < len(workflow_def.steps_json):
                            step_config = workflow_def.steps_json[approval_request.workflow_step]
                            current_step_info = WorkflowStepInfo(
                                step_number=approval_request.workflow_step + 1,
                                name=step_config.get("name", f"Step {approval_request.workflow_step + 1}"),
                                description=step_config.get("description", ""),
                                step_type=step_config.get("step_type", "manual_approval"),
                                required_roles=step_config.get("approval_roles", []),
                                required_users=step_config.get("approval_users", []),
                                is_current_step=True,
                                is_completed=workflow_instance.status == WorkflowInstanceStatus.COMPLETED,
                                status=workflow_instance.status.value
                            )

                        # Update workflow_context with workflow details
                        workflow_context.has_workflow = True
                        workflow_context.workflow_instance_id = workflow_instance.id
                        workflow_context.workflow_name = workflow_def.name
                        workflow_context.workflow_description = workflow_def.description
                        workflow_context.current_step = approval_request.workflow_step
                        workflow_context.total_steps = len(workflow_def.steps_json) if workflow_def.steps_json else 1
                        workflow_context.workflow_status = workflow_instance.status.value
                        workflow_context.current_step_info = current_step_info
                        workflow_context.evidence_required = approval_request.evidence_required or False
                        workflow_context.current_evidence = approval_request.evidence or {}
                        workflow_context.initiated_by = workflow_instance.initiated_by
                        workflow_context.created_at = workflow_instance.created_at
                        workflow_context.due_date = workflow_instance.due_date
            except Exception as e:
                logger.warning(f"Error building workflow context for request {approval_request.id}: {e}")
                # Keep the default workflow_context (has_workflow=False)

        result.append(ApprovalRequestResponseEnhanced(
            id=approval_request.id,
            prompt_id=approval_request.prompt_id,
            requested_by=approval_request.requested_by,
            requested_at=approval_request.requested_at,
            status=approval_request.status,
            approver=approval_request.approver,
            approved_at=approval_request.approved_at,
            rejection_reason=approval_request.rejection_reason,
            comments=approval_request.comments,
            prompt_version=prompt_version,
            prompt_name=prompt_name,
            prompt_description=prompt_description,
            prompt_is_active=prompt_is_active,
            prompt_created_by=prompt_created_by,
            prompt_created_at=prompt_created_at,
            workflow_instance_id=approval_request.workflow_instance_id,
            workflow_step=approval_request.workflow_step,
            evidence_required=approval_request.evidence_required or False,
            evidence=approval_request.evidence,
            workflow_context=workflow_context,
            user_can_approve=False,  # Will be computed by frontend
            user_can_reject=False,   # Will be computed by frontend
            user_has_permission=False  # Will be computed by frontend
        ))

    return result

@router.get("/{request_id}/workflow-context")
async def get_approval_request_workflow_context(
    request_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get detailed workflow context for an approval request"""
    return await get_workflow_approval_context(request_id, current_user, db)

@router.get("/{request_id}", response_model=ApprovalRequestResponse)
async def get_approval_request(
    request_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific approval request"""
    # Join with Prompt table to get version information
    query = db.query(
        ApprovalRequest,
        Prompt.version.label('prompt_version'),
        Prompt.name.label('prompt_name'),
        Prompt.description.label('prompt_description'),
        Prompt.is_active.label('prompt_is_active'),
        Prompt.created_by.label('prompt_created_by'),
        Prompt.created_at.label('prompt_created_at')
    ).join(Prompt, ApprovalRequest.prompt_id == Prompt.id).filter(ApprovalRequest.id == request_id)

    request = query.first()
    if not request:
        raise HTTPException(status_code=404, detail="Approval request not found")

    # Extract data from query result
    approval_request = request[0]
    prompt_version = request[1]
    prompt_name = request[2]
    prompt_description = request[3]
    prompt_is_active = request[4]
    prompt_created_by = request[5]
    prompt_created_at = request[6]

    return ApprovalRequestResponse(
        id=approval_request.id,
        prompt_id=approval_request.prompt_id,
        requested_by=approval_request.requested_by,
        requested_at=approval_request.requested_at,
        status=approval_request.status,
        approver=approval_request.approver,
        approved_at=approval_request.approved_at,
        rejection_reason=approval_request.rejection_reason,
        comments=approval_request.comments,
        prompt_version=prompt_version,
        prompt_name=prompt_name,
        prompt_description=prompt_description,
        prompt_is_active=prompt_is_active,
        prompt_created_by=prompt_created_by,
        prompt_created_at=prompt_created_at
    )

@router.get("/{request_id}/permissions")
async def get_approval_request_permissions(
    request_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get permissions for a specific approval request with workflow step context"""
    try:
        from app.auth.rbac import rbac_service, Permission
        from app.auth.approval_permissions import get_approval_permission_error_message

        user_roles = current_user.get("roles", [])
        user_id = current_user.get("user_id", current_user.get("sub", ""))

        # Get the approval request
        approval_request = db.query(ApprovalRequest).filter(ApprovalRequest.id == request_id).first()
        if not approval_request:
            raise HTTPException(status_code=404, detail="Approval request not found")

        # Check if user is the requester
        is_requester = approval_request.requested_by == user_id

        # Use WorkflowApprovalService for step-specific permissions
        workflow_service = WorkflowApprovalService(db)

        # Check workflow-specific permissions
        workflow_permissions = workflow_service.check_workflow_approval_permissions(
            approval_request_id=request_id,
            user_id=user_id,
            user_roles=user_roles
        )

        # Check general approval permissions as fallback
        can_approve = rbac_service.can_perform_action(
            user_roles=user_roles,
            action=Permission.APPROVE_PROMPT.value,
            resource_type="approval_request"
        )

        can_reject = rbac_service.can_perform_action(
            user_roles=user_roles,
            action=Permission.REJECT_PROMPT.value,
            resource_type="approval_request"
        )

        # Combine general and workflow-specific permissions
        final_can_approve = workflow_permissions.get("can_approve", can_approve)
        final_can_reject = workflow_permissions.get("can_reject", can_reject)

        # Additional permissions based on request status and user involvement
        can_view_details = is_requester or final_can_approve or final_can_reject
        can_edit = is_requester and approval_request.status == "pending"
        can_delete = is_requester or "admin" in user_roles

        has_approval_permissions = final_can_approve or final_can_reject

        # Get step-specific roles from workflow permissions
        step_required_roles = workflow_permissions.get("required_roles", ["admin"])
        current_step = workflow_permissions.get("current_step", 0) or 0
        current_step_name = workflow_permissions.get("current_step_name", f"Step {current_step + 1}")

        # Get workflow context for enhanced UI display
        workflow_context = {}
        if approval_request.workflow_instance_id:
            workflow_instance = db.query(WorkflowInstance).filter(
                WorkflowInstance.id == approval_request.workflow_instance_id
            ).first()

            if workflow_instance:
                workflow_def = db.query(WorkflowDefinition).filter(
                    WorkflowDefinition.id == workflow_instance.workflow_definition_id
                ).first()

                if workflow_def:
                    workflow_context = {
                        "workflow_name": workflow_def.name,
                        "workflow_description": workflow_def.description,
                        "total_steps": len(workflow_def.steps_json) if workflow_def.steps_json else 1,
                        "workflow_status": workflow_instance.status.value,
                        "current_step": current_step,
                        "current_step_name": current_step_name,
                        "workflow_instance_id": approval_request.workflow_instance_id
                    }

        # Check if user is a step approver
        user_has_step_access = any(role in step_required_roles for role in user_roles)

        return {
            "can_approve": final_can_approve,
            "can_reject": final_can_reject,
            "can_escalate": "admin" in user_roles,
            "can_view_details": can_view_details,
            "can_edit": can_edit,
            "can_delete": can_delete,
            "is_requester": is_requester,
            "has_approval_permissions": has_approval_permissions,
            "required_roles": step_required_roles,
            "user_roles": user_roles,
            "user_id": user_id,
            "request_status": approval_request.status,
            # Enhanced workflow-specific fields for frontend
            "current_step_roles": step_required_roles,
            "is_step_approver": user_has_step_access,
            "is_system_admin": "admin" in user_roles,
            "current_step": current_step,
            "current_step_name": current_step_name,
            "workflow_context": workflow_context,
            "permission_details": {
                "role_based_access": True,
                "step_specific_access": len(step_required_roles) > 0,
                "flow_admin_access": "admin" in user_roles,
                "workflow_enabled": approval_request.workflow_instance_id is not None
            },
            "message": get_approval_permission_error_message(user_roles) if not has_approval_permissions else "User has approval permissions"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking approval request permissions: {str(e)}")
        return {
            "can_approve": False,
            "can_reject": False,
            "can_view_details": False,
            "can_edit": False,
            "can_delete": False,
            "can_escalate": False,
            "is_requester": False,
            "has_approval_permissions": False,
            "required_roles": ["admin"],  # Default to admin only in error case
            "user_roles": current_user.get("roles", []),
            "user_id": current_user.get("user_id", current_user.get("sub", "")),
            "request_status": "unknown",
            # Enhanced fields for consistency
            "current_step_roles": ["admin"],
            "is_step_approver": False,
            "is_system_admin": False,
            "current_step": 0,
            "current_step_name": "Step 1",
            "workflow_context": {},
            "permission_details": {
                "role_based_access": False,
                "step_specific_access": False,
                "flow_admin_access": False,
                "workflow_enabled": False
            },
            "message": f"Error checking permissions: {str(e)}"
        }

@router.post("/", response_model=ApprovalRequestResponse)
async def create_approval_request(
    request: Request,
    request_data: ApprovalRequestCreate = Body(...),
    db: Session = Depends(get_db)
):
    """Create a new approval request with optional workflow integration"""
    # Get current user
    current_user = await get_current_user(request)

    # Check if user has permission to initiate workflows
    try:
        await check_workflow_initiation_permission(current_user, db)
    except HTTPException:
        # Fallback to basic permission check for backward compatibility
        from app.auth.rbac import rbac_service, Permission
        user_roles = current_user.get("roles", [])
        can_create = rbac_service.can_perform_action(
            user_roles=user_roles,
            action=Permission.CREATE_PROJECT.value,
            resource_type="approval_request"
        )
        if not can_create:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to create approval requests"
            )

    # Verify prompt exists
    prompt = db.query(Prompt).filter(Prompt.id == request_data.prompt_id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")

    # Validate status
    valid_statuses = ["pending", "approved", "rejected"]
    if request_data.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Status must be one of {valid_statuses}")

    # Use workflow approval service for integrated creation
    approval_service = WorkflowApprovalService(db)

    try:
        approval_request = approval_service.create_approval_request_with_workflow(
            prompt_id=request_data.prompt_id,
            requested_by=request_data.requested_by,
            workflow_definition_id=getattr(request_data, 'workflow_definition_id', None),
            context=getattr(request_data, 'context', None)
        )

        # Update basic fields that might be provided
        if hasattr(request_data, 'approver') and request_data.approver:
            approval_request.approver = request_data.approver
        if hasattr(request_data, 'rejection_reason') and request_data.rejection_reason:
            approval_request.rejection_reason = request_data.rejection_reason
        if hasattr(request_data, 'comments') and request_data.comments:
            approval_request.comments = request_data.comments
        if hasattr(request_data, 'evidence') and request_data.evidence:
            approval_request.evidence = request_data.evidence

        db.commit()
        db.refresh(approval_request)

    except Exception as e:
        # Fallback to simple creation if workflow service fails
        logger.error(f"Workflow creation failed, falling back to simple creation: {str(e)}")
        request_id = str(uuid.uuid4())

        approval_request = ApprovalRequest(
            id=request_id,
            prompt_id=request_data.prompt_id,
            requested_by=request_data.requested_by,
            requested_at=datetime.now(timezone.utc),
            status=request_data.status,
            approver=request_data.approver,
            approved_at=datetime.now(timezone.utc) if request_data.status == "approved" else None,
            rejection_reason=request_data.rejection_reason,
            comments=request_data.comments,
            workflow_instance_id=None,
            workflow_step=None,
            evidence_required=False,
            evidence=getattr(request_data, 'evidence', None)
        )

        db.add(approval_request)
        db.commit()
        db.refresh(approval_request)

    # Log the creation
    audit_log = AuditLog(
        id=str(uuid.uuid4()),
        actor=current_user["user_id"],
        action="create_approval_request",
        subject=request_id,
        before_json=None,
        after_json={"prompt_id": request_data.prompt_id, "status": request_data.status}
    )
    db.add(audit_log)
    db.commit()

    # Return response with prompt version information
    return ApprovalRequestResponse(
        id=approval_request.id,
        prompt_id=approval_request.prompt_id,
        requested_by=approval_request.requested_by,
        requested_at=approval_request.requested_at,
        status=approval_request.status,
        approver=approval_request.approver,
        approved_at=approval_request.approved_at,
        rejection_reason=approval_request.rejection_reason,
        comments=approval_request.comments,
        prompt_version=prompt.version,
        prompt_name=prompt.name,
        prompt_description=prompt.description,
        prompt_is_active=prompt.is_active,
        prompt_created_by=prompt.created_by,
        prompt_created_at=prompt.created_at
    )

@router.put("/{request_id}", response_model=ApprovalRequestResponse)
async def update_approval_request(
    request_id: str,
    request: Request,
    request_update: ApprovalRequestUpdate = Body(...),
    db: Session = Depends(get_db)
):
    """Update an approval request with workflow-aware role-based access control"""
    # Get current user
    current_user = await get_current_user(request)

    # Use workflow-aware permission checking
    try:
        approval_user = await check_workflow_approval_permission(request_id, current_user, db)
    except Exception as e:
        # Fallback to basic permission checking
        approval_user = await check_specific_approval_access(request_id, current_user, db)

    request_obj = db.query(ApprovalRequest).filter(ApprovalRequest.id == request_id).first()
    if not request_obj:
        raise HTTPException(status_code=404, detail="Approval request not found")

    # Check if user has permission for the specific action they're trying to perform
    new_status = request_update.status if hasattr(request_update, 'status') and request_update.status else None

    if new_status in ["approved", "rejected"]:
        if not approval_user.get("has_approval_permissions", False):
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to approve or reject requests"
            )

        if new_status == "approved" and not approval_user.get("can_approve", False):
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to approve requests"
            )

        if new_status == "rejected" and not approval_user.get("can_reject", False):
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to reject requests"
            )

    # Use workflow service for approval/rejection actions if workflow is present
    approval_service = WorkflowApprovalService(db)
    workflow_result = None

    if request_obj.workflow_instance_id and new_status in ["approved", "rejected"]:
        try:
            action = "approve" if new_status == "approved" else "reject"
            workflow_result = approval_service.process_approval_action(
                approval_request_id=request_id,
                user_id=approval_user["user_id"],
                action=action,
                comments=request_update.comments,
                evidence=getattr(request_update, 'evidence', None)
            )

            logger.info(f"Workflow approval action processed: {workflow_result}")

        except Exception as e:
            logger.error(f"Workflow approval processing failed: {str(e)}")
            # Continue with basic update if workflow processing fails

    # Store original values for audit log
    before_data = {
        "status": request_obj.status,
        "approver": request_obj.approver,
        "prompt_id": request_obj.prompt_id
    }

    # Update fields
    update_data = request_update.model_dump(exclude_unset=True)

    # Validate status if provided
    if "status" in update_data:
        valid_statuses = ["pending", "approved", "rejected"]
        if update_data["status"] not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Status must be one of {valid_statuses}")

        # Update approved_at timestamp when status changes to approved
        if update_data["status"] == "approved" and request_obj.status != "approved":
            update_data["approved_at"] = datetime.now(timezone.utc)

    for field, value in update_data.items():
        setattr(request_obj, field, value)

    # Auto-activate prompt when approval is granted
    if update_data.get("status") == "approved" and request_obj.status != "approved":
        prompt = db.query(Prompt).filter(Prompt.id == request_obj.prompt_id).first()
        if prompt:
            # Store original values for audit log
            before_activation = {
                "is_active": prompt.is_active,
                "activated_at": prompt.activated_at.isoformat() if prompt.activated_at else None,
                "activated_by": prompt.activated_by
            }

            # Activate the prompt
            prompt.is_active = True
            prompt.activated_at = datetime.now(timezone.utc)
            prompt.activated_by = request_obj.approver or approval_user["user_id"]
            prompt.activation_reason = "Auto-activated upon approval"
            prompt.updated_at = datetime.now(timezone.utc)

            # Log the auto-activation
            activation_audit_log = AuditLog(
                id=str(uuid.uuid4()),
                actor=request.approver or approval_user["user_id"],
                action="auto_activate_prompt",
                subject=f"{prompt.id}@{prompt.version}",
                subject_type="prompt",
                subject_id=prompt.id,
                before_json=before_activation,
                after_json={
                    "is_active": True,
                    "activated_at": prompt.activated_at.isoformat(),
                    "activated_by": prompt.activated_by,
                    "activation_reason": "Auto-activated upon approval"
                },
                result="success"
            )
            db.add(activation_audit_log)

    db.commit()
    db.refresh(request_obj)

    # Log the update
    audit_log = AuditLog(
        id=str(uuid.uuid4()),
        actor=approval_user["user_id"],
        action="update_approval_request",
        subject=request_id,
        before_json=before_data,
        after_json={"status": request_obj.status, "approver": request_obj.approver, "prompt_id": request_obj.prompt_id}
    )
    db.add(audit_log)
    db.commit()

    # Get prompt information for the response
    prompt = db.query(Prompt).filter(Prompt.id == request_obj.prompt_id).first()

    # Return response with prompt version information
    return ApprovalRequestResponse(
        id=request_obj.id,
        prompt_id=request_obj.prompt_id,
        requested_by=request_obj.requested_by,
        requested_at=request_obj.requested_at,
        status=request_obj.status,
        approver=request_obj.approver,
        approved_at=request_obj.approved_at,
        rejection_reason=request_obj.rejection_reason,
        comments=request_obj.comments,
        prompt_version=prompt.version if prompt else "",
        prompt_name=prompt.name if prompt else "",
        prompt_description=prompt.description if prompt else None,
        prompt_is_active=prompt.is_active if prompt else False,
        prompt_created_by=prompt.created_by if prompt else "",
        prompt_created_at=prompt.created_at if prompt else datetime.now(timezone.utc)
    )

@router.post("/{request_id}/approve")
async def approve_request_with_workflow(
    request_id: str,
    request: Request,
    approval_data: dict = Body(...),
    db: Session = Depends(get_db)
):
    """Approve an approval request with workflow progression"""
    current_user = await get_current_user(request)

    # Use workflow-aware permission checking
    approval_user = await check_workflow_approval_permission(request_id, current_user, db)

    if not approval_user.get("can_approve", False):
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to approve requests"
        )

    # Use workflow service for approval
    approval_service = WorkflowApprovalService(db)

    try:
        result = approval_service.process_approval_action(
            approval_request_id=request_id,
            user_id=approval_user["user_id"],
            action="approve",
            comments=approval_data.get("comments"),
            evidence=approval_data.get("evidence")
        )

        return {
            "message": "Request approved successfully",
            "result": result,
            "request_id": request_id
        }

    except Exception as e:
        logger.error(f"Workflow approval failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Approval failed: {str(e)}"
        )

@router.post("/{request_id}/reject")
async def reject_request_with_workflow(
    request_id: str,
    request: Request,
    rejection_data: dict = Body(...),
    db: Session = Depends(get_db)
):
    """Reject an approval request with workflow progression"""
    current_user = await get_current_user(request)

    # Use workflow-aware permission checking
    approval_user = await check_workflow_approval_permission(request_id, current_user, db)

    if not approval_user.get("can_reject", False):
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to reject requests"
        )

    # Use workflow service for rejection
    approval_service = WorkflowApprovalService(db)

    try:
        result = approval_service.process_approval_action(
            approval_request_id=request_id,
            user_id=approval_user["user_id"],
            action="reject",
            comments=rejection_data.get("comments"),
            evidence=rejection_data.get("evidence")
        )

        return {
            "message": "Request rejected successfully",
            "result": result,
            "request_id": request_id
        }

    except Exception as e:
        logger.error(f"Workflow rejection failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Rejection failed: {str(e)}"
        )

@router.delete("/{request_id}")
async def delete_approval_request(
    request_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete an approval request"""
    # For delete operations, we'll check if user has admin permissions
    try:
        from app.auth.rbac import rbac_service, Permission

        user_roles = current_user.get("roles", [])

        # Check if user has admin permissions or can delete their own requests
        has_admin_permission = rbac_service.can_perform_action(
            user_roles=user_roles,
            action=Permission.DELETE_PROJECT.value,  # Using a high-level permission
            resource_type="approval_request"
        )

        request = db.query(ApprovalRequest).filter(ApprovalRequest.id == request_id).first()
        if not request:
            raise HTTPException(status_code=404, detail="Approval request not found")

        # Check if user is the requester or has admin permissions
        is_owner = request.requested_by == current_user["user_id"]

        if not has_admin_permission and not is_owner:
            raise HTTPException(
                status_code=403,
                detail="You can only delete your own approval requests or need admin permissions"
            )

    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        logger.error(f"Error checking delete permissions: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Error checking permissions for deletion"
        )

    # Store request data for audit log
    request_data = {
        "prompt_id": request.prompt_id,
        "status": request.status,
        "requested_by": request.requested_by
    }

    db.delete(request)
    db.commit()

    # Log the deletion
    audit_log = AuditLog(
        id=str(uuid.uuid4()),
        actor=current_user["user_id"],
        action="delete_approval_request",
        subject=request_id,
        before_json=request_data,
        after_json=None
    )
    db.add(audit_log)
    db.commit()

    return {"message": "Approval request deleted successfully"}

@router.get("/{request_id}/comparison", response_model=PromptComparisonResponse)
async def get_approval_request_comparison(
    request_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get comparison between current active prompt and new prompt version for approval request"""
    try:
        # Get the approval request with prompt information
        query = db.query(
            ApprovalRequest,
            Prompt.version.label('prompt_version'),
            Prompt.name.label('prompt_name'),
            Prompt.description.label('prompt_description'),
            Prompt.is_active.label('prompt_is_active'),
            Prompt.created_by.label('prompt_created_by'),
            Prompt.created_at.label('prompt_created_at'),
            Prompt.module_id.label('prompt_module_id'),
            Prompt.content.label('prompt_content'),
            Prompt.mas_intent.label('prompt_mas_intent'),
            Prompt.mas_fairness_notes.label('prompt_mas_fairness_notes'),
            Prompt.mas_testing_notes.label('prompt_mas_testing_notes'),
            Prompt.mas_risk_level.label('prompt_mas_risk_level'),
            Prompt.target_models.label('prompt_target_models'),
            Prompt.model_specific_prompts.label('prompt_model_specific_prompts')
        ).join(Prompt, ApprovalRequest.prompt_id == Prompt.id).filter(ApprovalRequest.id == request_id)

        request_data = query.first()
        if not request_data:
            raise HTTPException(status_code=404, detail="Approval request not found")

        # Extract approval request data
        approval_request_obj = request_data[0]

        # Create approval request response
        approval_request_response = ApprovalRequestResponse(
            id=approval_request_obj.id,
            prompt_id=approval_request_obj.prompt_id,
            requested_by=approval_request_obj.requested_by,
            requested_at=approval_request_obj.requested_at,
            status=approval_request_obj.status,
            approver=approval_request_obj.approver,
            approved_at=approval_request_obj.approved_at,
            rejection_reason=approval_request_obj.rejection_reason,
            comments=approval_request_obj.comments,
            prompt_version=request_data[1],
            prompt_name=request_data[2],
            prompt_description=request_data[3],
            prompt_is_active=request_data[4],
            prompt_created_by=request_data[5],
            prompt_created_at=request_data[6]
        )

        # Create new prompt version response (the one being requested for approval)
        new_prompt_response = PromptResponse(
            id=approval_request_obj.prompt_id,
            version=request_data[1],
            module_id=request_data[7],
            content=request_data[8],
            name=request_data[2],
            description=request_data[3],
            provider_id=None,  # We don't have this in the join
            provider_name=None,
            created_by=request_data[5],
            created_at=request_data[6],
            updated_at=request_data[6],  # Using created_at as fallback
            mas_intent=request_data[9],
            mas_fairness_notes=request_data[10],
            mas_testing_notes=request_data[11],
            mas_risk_level=request_data[12],
            mas_approval_log=None,
            target_models=request_data[13] or [],
            model_specific_prompts=request_data[14] or [],
            is_active=request_data[4],
            activated_at=None,
            activated_by=None,
            activation_reason=None
        )

        # Find current active prompt for the same module_id
        current_active_prompt = None
        module_id = request_data[7]

        if module_id:
            # Query for the active prompt with the highest version for this module
            active_prompt_query = db.query(Prompt).filter(
                Prompt.module_id == module_id,
                Prompt.is_active == True
            ).order_by(Prompt.created_at.desc()).first()

            if active_prompt_query and active_prompt_query.id != approval_request_obj.prompt_id:
                current_active_prompt = PromptResponse(
                    id=active_prompt_query.id,
                    version=active_prompt_query.version,
                    module_id=active_prompt_query.module_id,
                    content=active_prompt_query.content,
                    name=active_prompt_query.name,
                    description=active_prompt_query.description,
                    provider_id=active_prompt_query.provider_id,
                    provider_name=None,  # Would need join with providers table
                    created_by=active_prompt_query.created_by,
                    created_at=active_prompt_query.created_at,
                    updated_at=active_prompt_query.updated_at,
                    mas_intent=active_prompt_query.mas_intent,
                    mas_fairness_notes=active_prompt_query.mas_fairness_notes,
                    mas_testing_notes=active_prompt_query.mas_testing_notes,
                    mas_risk_level=active_prompt_query.mas_risk_level,
                    mas_approval_log=active_prompt_query.mas_approval_log,
                    target_models=active_prompt_query.target_models or [],
                    model_specific_prompts=active_prompt_query.model_specific_prompts or [],
                    is_active=active_prompt_query.is_active,
                    activated_at=active_prompt_query.activated_at,
                    activated_by=active_prompt_query.activated_by,
                    activation_reason=active_prompt_query.activation_reason
                )

        # Generate comparison summary
        comparison_summary = {}
        if current_active_prompt:
            comparison_summary = {
                "has_current_active": True,
                "version_comparison": {
                    "current_version": current_active_prompt.version,
                    "new_version": new_prompt_response.version,
                    "is_version_upgrade": _is_version_upgrade(current_active_prompt.version, new_prompt_response.version)
                },
                "content_changes": {
                    "content_length_diff": len(new_prompt_response.content) - len(current_active_prompt.content),
                    "has_content_changes": current_active_prompt.content != new_prompt_response.content
                },
                "mas_compliance": {
                    "risk_level_change": current_active_prompt.mas_risk_level != new_prompt_response.mas_risk_level,
                    "current_risk_level": current_active_prompt.mas_risk_level,
                    "new_risk_level": new_prompt_response.mas_risk_level
                }
            }
        else:
            comparison_summary = {
                "has_current_active": False,
                "message": "This is the first prompt version for this module"
            }

        return PromptComparisonResponse(
            approval_request=approval_request_response,
            current_active_prompt=current_active_prompt,
            new_prompt_version=new_prompt_response,
            comparison_summary=comparison_summary
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting approval request comparison: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error getting comparison: {str(e)}"
        )

def _is_version_upgrade(current_version: str, new_version: str) -> bool:
    """Helper function to check if new version is an upgrade from current version"""
    try:
        # Simple version comparison - split by dots and compare numerically
        current_parts = [int(x) for x in current_version.split('.')]
        new_parts = [int(x) for x in new_version.split('.')]

        # Compare each part
        for i in range(max(len(current_parts), len(new_parts))):
            current_val = current_parts[i] if i < len(current_parts) else 0
            new_val = new_parts[i] if i < len(new_parts) else 0
            if new_val > current_val:
                return True
            elif new_val < current_val:
                return False
        return False  # Versions are equal
    except (ValueError, AttributeError):
        # If version parsing fails, assume it's not an upgrade
        return False