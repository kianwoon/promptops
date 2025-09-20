"""
Workflow-aware approval permission dependencies for role-based access control
"""

from fastapi import Depends, HTTPException, status
from typing import Dict, Any, List, Optional
from app.auth.rbac import rbac_service, Permission
from app.auth.authentication import get_current_user
from app.database import get_db
from sqlalchemy.orm import Session
from app.models import ApprovalRequest, WorkflowDefinition, WorkflowInstance
from app.services.workflow_approval_service import WorkflowApprovalService
import structlog

logger = structlog.get_logger()

async def check_workflow_approval_permission(
    request_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Check if current user has permission to approve/reject a specific approval request
    with workflow step context
    """
    user_roles = current_user.get("roles", [])
    user_id = current_user.get("user_id")

    if not user_roles:
        logger.warning("User has no roles", user_id=user_id)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User has no assigned roles"
        )

    # Get the approval request
    request = db.query(ApprovalRequest).filter(ApprovalRequest.id == request_id).first()
    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Approval request not found"
        )

    # Check if request is in a state that can be approved/rejected
    if request.status not in ["pending", "under_review"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot approve/reject request with status '{request.status}'. Request must be pending or under review."
        )

    # Use workflow approval service for detailed permission checking
    approval_service = WorkflowApprovalService(db)
    permission_result = approval_service.check_workflow_approval_permissions(
        approval_request_id=request_id,
        user_id=user_id,
        user_roles=user_roles
    )

    if not permission_result.get("has_permission", False):
        logger.warning(
            "User lacks workflow approval permissions",
            user_id=user_id,
            request_id=request_id,
            roles=user_roles,
            current_step=permission_result.get("current_step"),
            required_roles=permission_result.get("required_roles")
        )

        # Create helpful error message
        current_step = permission_result.get("current_step")
        if current_step is not None:
            step_name = permission_result.get("current_step_name", f"Step {current_step}")
            required_roles = permission_result.get("required_roles", [])
            error_msg = (
                f"You do not have permission to approve/reject at {step_name}. "
                f"Required roles: {', '.join(required_roles) if required_roles else 'specific approver assignment'}. "
                f"Your roles: {', '.join(user_roles)}."
            )
        else:
            error_msg = (
                f"You do not have permission to approve or reject requests. "
                f"Required roles: admin, approver. "
                f"Your roles: {', '.join(user_roles)}."
            )

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=error_msg
        )

    # Return enhanced user info with workflow context
    return {
        **current_user,
        "request_id": request_id,
        "has_approval_permissions": True,
        "can_approve": permission_result.get("can_approve", False),
        "can_reject": permission_result.get("can_reject", False),
        "current_step": permission_result.get("current_step"),
        "current_step_name": permission_result.get("current_step_name"),
        "required_roles": permission_result.get("required_roles", []),
        "workflow_instance_id": permission_result.get("workflow_instance_id"),
        "workflow_context": permission_result
    }

async def get_workflow_approval_context(
    request_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get detailed workflow context for an approval request
    Useful for UI to show current step information, required roles, etc.
    """
    try:
        # Get the approval request
        request = db.query(ApprovalRequest).filter(ApprovalRequest.id == request_id).first()
        if not request:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Approval request not found"
            )

        user_id = current_user.get("user_id")
        user_roles = current_user.get("roles", [])

        # Get workflow context
        workflow_context = {
            "has_workflow": request.workflow_instance_id is not None,
            "current_step": request.workflow_step,
            "workflow_instance_id": request.workflow_instance_id,
            "evidence_required": request.evidence_required,
            "current_evidence": request.evidence or {}
        }

        if request.workflow_instance_id:
            # Get detailed workflow information
            workflow_instance = db.query(WorkflowInstance).filter(
                WorkflowInstance.id == request.workflow_instance_id
            ).first()

            if workflow_instance:
                workflow_def = db.query(WorkflowDefinition).filter(
                    WorkflowDefinition.id == workflow_instance.workflow_definition_id
                ).first()

                if workflow_def:
                    current_step_config = {}
                    if request.workflow_step is not None and request.workflow_step < len(workflow_def.steps_json):
                        current_step_config = workflow_def.steps_json[request.workflow_step]

                    workflow_context.update({
                        "workflow_name": workflow_def.name,
                        "workflow_description": workflow_def.description,
                        "total_steps": len(workflow_def.steps_json),
                        "current_step_config": current_step_config,
                        "workflow_status": workflow_instance.status.value,
                        "initiated_by": workflow_instance.initiated_by,
                        "created_at": workflow_instance.created_at,
                        "due_date": workflow_instance.due_date,
                        "current_assignee": workflow_instance.current_assignee
                    })

        # Check permissions for context
        approval_service = WorkflowApprovalService(db)
        permission_result = approval_service.check_workflow_approval_permissions(
            approval_request_id=request_id,
            user_id=user_id,
            user_roles=user_roles
        )

        workflow_context.update({
            "user_can_approve": permission_result.get("can_approve", False),
            "user_can_reject": permission_result.get("can_reject", False),
            "user_has_permission": permission_result.get("has_permission", False),
            "permission_reason": permission_result.get("reason", "No specific reason"),
            "step_required_roles": permission_result.get("required_roles", []),
            "step_required_users": permission_result.get("required_users", [])
        })

        return workflow_context

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error getting workflow approval context", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving workflow context"
        )

async def check_workflow_initiation_permission(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Check if user has permission to initiate approval workflows
    """
    user_roles = current_user.get("roles", [])
    user_id = current_user.get("user_id")

    if not user_roles:
        logger.warning("User has no roles", user_id=user_id)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User has no assigned roles"
        )

    # Check if user can create approval requests
    can_create = rbac_service.can_perform_action(
        user_roles=user_roles,
        action=Permission.CREATE_PROJECT.value,  # Using create permission as proxy
        resource_type="approval_request"
    )

    if not can_create:
        logger.warning("User lacks workflow initiation permissions", user_id=user_id, roles=user_roles)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to create approval requests. Required roles: admin, editor, or user with create permissions."
        )

    return {
        **current_user,
        "can_initiate_workflows": True,
        "available_workflow_categories": ["approval"]  # Could be enhanced based on user permissions
    }