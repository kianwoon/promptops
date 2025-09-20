from fastapi import APIRouter, Depends, HTTPException, Body, Request
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
from datetime import datetime, timezone

from app.database import get_db
from app.models import ApprovalRequest, Prompt, AuditLog
from app.schemas import ApprovalRequestCreate, ApprovalRequestResponse, ApprovalRequestUpdate
from app.auth import get_current_user

router = APIRouter()

@router.get("/", response_model=List[ApprovalRequestResponse])
async def list_approval_requests(
    prompt_id: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(ApprovalRequest)
    if prompt_id:
        query = query.filter(ApprovalRequest.prompt_id == prompt_id)
    if status:
        query = query.filter(ApprovalRequest.status == status)

    requests = query.offset(skip).limit(limit).all()
    return requests

@router.get("/{request_id}", response_model=ApprovalRequestResponse)
async def get_approval_request(
    request_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific approval request"""
    request = db.query(ApprovalRequest).filter(ApprovalRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Approval request not found")
    return request

@router.post("/", response_model=ApprovalRequestResponse)
async def create_approval_request(
    request_data: ApprovalRequestCreate = Body(...),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new approval request"""
    # Verify prompt exists
    prompt = db.query(Prompt).filter(Prompt.id == request_data.prompt_id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")

    # Validate status
    valid_statuses = ["pending", "approved", "rejected"]
    if request_data.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Status must be one of {valid_statuses}")

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
        comments=request_data.comments
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

    return approval_request

@router.put("/{request_id}", response_model=ApprovalRequestResponse)
async def update_approval_request(
    request_id: str,
    request_update: ApprovalRequestUpdate = Body(...),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update an approval request"""
    request = db.query(ApprovalRequest).filter(ApprovalRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Approval request not found")

    # Store original values for audit log
    before_data = {
        "status": request.status,
        "approver": request.approver,
        "prompt_id": request.prompt_id
    }

    # Update fields
    update_data = request_update.model_dump(exclude_unset=True)

    # Validate status if provided
    if "status" in update_data:
        valid_statuses = ["pending", "approved", "rejected"]
        if update_data["status"] not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Status must be one of {valid_statuses}")

        # Update approved_at timestamp when status changes to approved
        if update_data["status"] == "approved" and request.status != "approved":
            update_data["approved_at"] = datetime.now(timezone.utc)

    for field, value in update_data.items():
        setattr(request, field, value)

    # Auto-activate prompt when approval is granted
    if update_data.get("status") == "approved" and request.status != "approved":
        prompt = db.query(Prompt).filter(Prompt.id == request.prompt_id).first()
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
            prompt.activated_by = request.approver or current_user["user_id"]
            prompt.activation_reason = "Auto-activated upon approval"
            prompt.updated_at = datetime.now(timezone.utc)

            # Log the auto-activation
            activation_audit_log = AuditLog(
                id=str(uuid.uuid4()),
                actor=request.approver or current_user["user_id"],
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
    db.refresh(request)

    # Log the update
    audit_log = AuditLog(
        id=str(uuid.uuid4()),
        actor=current_user["user_id"],
        action="update_approval_request",
        subject=request_id,
        before_json=before_data,
        after_json={"status": request.status, "approver": request.approver, "prompt_id": request.prompt_id}
    )
    db.add(audit_log)
    db.commit()

    return request

@router.delete("/{request_id}")
async def delete_approval_request(
    request_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete an approval request"""
    request = db.query(ApprovalRequest).filter(ApprovalRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Approval request not found")

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