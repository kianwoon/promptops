from fastapi import APIRouter, Depends, HTTPException, Body, Request
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

from app.database import get_db
from app.models import ApprovalRequest, Prompt, AuditLog
from app.schemas import ApprovalRequestCreate, ApprovalRequestResponse, ApprovalRequestUpdate
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
        logger.error("Error checking approval permissions", error=str(e))
        return {
            "has_approval_permissions": False,
            "can_approve": False,
            "can_reject": False,
            "message": f"Error checking permissions: {str(e)}",
            "user_roles": current_user.get("roles", []),
            "required_roles": ["admin", "approver"]
        }

@router.get("/", response_model=List[ApprovalRequestResponse])
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

    # Convert result to match the response schema
    result = []
    for request in requests:
        approval_request = request[0]
        prompt_version = request[1]
        prompt_name = request[2]
        prompt_description = request[3]
        prompt_is_active = request[4]
        prompt_created_by = request[5]
        prompt_created_at = request[6]

        result.append(ApprovalRequestResponse(
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
    """Get permissions for a specific approval request"""
    try:
        from app.auth.rbac import rbac_service, Permission
        from app.auth.approval_permissions import get_approval_permission_error_message

        user_roles = current_user.get("roles", [])
        user_id = current_user.get("user_id", current_user.get("sub", ""))

        # Get the approval request to check if user is involved
        approval_request = db.query(ApprovalRequest).filter(ApprovalRequest.id == request_id).first()
        if not approval_request:
            raise HTTPException(status_code=404, detail="Approval request not found")

        # Check if user is the requester (can always view their own requests)
        is_requester = approval_request.requested_by == user_id

        # Check general approval permissions
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

        # Additional permissions based on request status and user involvement
        can_view_details = is_requester or can_approve or can_reject
        can_edit = is_requester and approval_request.status == "pending"
        can_delete = is_requester or "admin" in user_roles

        has_approval_permissions = can_approve or can_reject

        return {
            "can_approve": can_approve,
            "can_reject": can_reject,
            "can_view_details": can_view_details,
            "can_edit": can_edit,
            "can_delete": can_delete,
            "can_escalate": "admin" in user_roles,
            "is_requester": is_requester,
            "has_approval_permissions": has_approval_permissions,
            "required_roles": ["admin", "approver"],
            "user_roles": user_roles,
            "user_id": user_id,
            "request_status": approval_request.status,
            "message": get_approval_permission_error_message(user_roles) if not has_approval_permissions else "User has approval permissions"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error checking approval request permissions", error=str(e))
        return {
            "can_approve": False,
            "can_reject": False,
            "can_view_details": False,
            "can_edit": False,
            "can_delete": False,
            "can_escalate": False,
            "is_requester": False,
            "has_approval_permissions": False,
            "required_roles": ["admin", "approver"],
            "user_roles": current_user.get("roles", []),
            "user_id": current_user.get("user_id", current_user.get("sub", "")),
            "request_status": "unknown",
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
        logger.error("Workflow creation failed, falling back to simple creation", error=str(e))
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

            logger.info("Workflow approval action processed", result=workflow_result)

        except Exception as e:
            logger.error("Workflow approval processing failed", error=str(e))
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
        logger.error("Workflow approval failed", error=str(e))
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
        logger.error("Workflow rejection failed", error=str(e))
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
        logger.error("Error checking delete permissions", error=str(e))
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