"""
Approval permission dependencies for role-based access control
"""

from fastapi import Depends, HTTPException, status
from typing import Dict, Any, List
from app.auth.rbac import rbac_service, Permission
from app.auth.authentication import get_current_user
from app.database import get_db
from sqlalchemy.orm import Session
from app.models import ApprovalRequest
import structlog

logger = structlog.get_logger()

async def check_approval_permission(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Check if current user has permission to approve/reject requests
    Returns user info with permission details
    """
    user_roles = current_user.get("roles", [])
    user_id = current_user.get("user_id")

    if not user_roles:
        logger.warning("User has no roles", user_id=user_id)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User has no assigned roles"
        )

    # Check if user has approval permissions using RBAC service
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

    if not can_approve and not can_reject:
        logger.warning("User lacks approval permissions", user_id=user_id, roles=user_roles)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions. You need 'approver' or 'admin' role to approve or reject requests."
        )

    return {
        **current_user,
        "can_approve": can_approve,
        "can_reject": can_reject,
        "has_approval_permissions": can_approve or can_reject
    }

async def check_specific_approval_access(
    request_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Check if user can approve/reject a specific approval request
    This is called within the update endpoint to provide context-specific permission checking
    """
    # First get basic approval permissions
    approval_user = await check_approval_permission(current_user, db)

    # Additional checks can be added here for specific request context
    # For example: checking if user is assigned to this specific approval,
    # if the request is in the correct state, etc.

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

    return {
        **approval_user,
        "request_id": request_id,
        "request_status": request.status,
        "can_modify_this_request": True
    }

def get_approval_permission_error_message(user_roles: List[str]) -> str:
    """
    Generate a helpful error message for users without approval permissions
    """
    role_names = ", ".join(user_roles)
    return (
        f"Your current role(s) ({role_names}) do not have permission to approve or reject requests. "
        f"Required roles: admin, approver. "
        f"Please contact your system administrator to request appropriate permissions."
    )