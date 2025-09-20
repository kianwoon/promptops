from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
from datetime import datetime
import logging
import jwt

from app.database import get_db
from app.models import Prompt, Module, AuditLog, ApprovalRequest, WorkflowInstance, WorkflowDefinition, WorkflowInstanceStatus, WorkflowStatus
from app.schemas import PromptCreate, PromptResponse, PromptUpdate
from app.auth import get_current_user
from app.services.auth_service import AuthService
from app.config import settings
from app.auth.rbac import rbac_service, Permission

# Configure logging for authentication debugging
logger = logging.getLogger(__name__)



router = APIRouter()

@router.get("", response_model=List[PromptResponse])
async def list_prompts(
    module_id: Optional[str] = None,
    provider_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List all prompts, optionally filtered by module or provider"""
    query = db.query(Prompt)
    if module_id:
        query = query.filter(Prompt.module_id == module_id)
    if provider_id:
        query = query.filter(Prompt.provider_id == provider_id)

    prompts = query.offset(skip).limit(limit).all()
    return prompts

@router.get("/{prompt_id}", response_model=List[PromptResponse])
async def get_prompt_versions(
    prompt_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get all versions of a prompt"""
    prompts = db.query(Prompt).filter(Prompt.id == prompt_id).all()
    if not prompts:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return prompts

@router.get("/{prompt_id}/{version}", response_model=PromptResponse)
async def get_prompt_version(
    prompt_id: str,
    version: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get specific version of a prompt"""
    prompt = db.query(Prompt).filter(
        Prompt.id == prompt_id,
        Prompt.version == version
    ).first()

    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt version not found")

    return prompt

@router.post("", response_model=PromptResponse)
async def create_prompt(
    prompt_data: PromptCreate = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a new prompt version"""

    # Verify module exists
    module = db.query(Module).filter(Module.id == prompt_data.module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    # Validate MAS risk level
    if prompt_data.mas_risk_level not in ["low", "medium", "high"]:
        raise HTTPException(status_code=400, detail="MAS risk level must be 'low', 'medium', or 'high'")

    # Check if this version already exists
    existing = db.query(Prompt).filter(
        Prompt.id == prompt_data.id,
        Prompt.version == prompt_data.version
    ).first()

    if existing:
        raise HTTPException(status_code=409, detail="Prompt version already exists")

    # Determine tenant_id with multiple fallbacks
    tenant_id = "demo-tenant"  # Ultimate fallback
    if current_user:
        if isinstance(current_user, dict):
            tenant_id = current_user.get("tenant", current_user.get("tenant_id", "demo-tenant"))
        else:
            # Handle case where current_user might not be a dict
            tenant_id = getattr(current_user, "tenant", getattr(current_user, "tenant_id", "demo-tenant"))

    # Get user roles to determine if approval workflow is needed
    user_roles = current_user.get("roles", [])
    if isinstance(user_roles, str):
        user_roles = [user_roles]  # Convert to list if it's a string

    # Check if user has editor role and requires approval
    requires_approval = False
    if "editor" in [role.lower() for role in user_roles]:
        # Check if user has submit_prompt_for_approval permission
        can_submit = rbac_service.can_perform_action(
            user_roles=user_roles,
            action=Permission.SUBMIT_PROMPT_FOR_APPROVAL.value,
            resource_type="prompt"
        )
        if can_submit:
            requires_approval = True

    # Create the prompt with model-specific variations
    prompt = Prompt(
        id=prompt_data.id,
        version=prompt_data.version,
        module_id=prompt_data.module_id,
        content=prompt_data.content,  # Use the content field from the request
        name=prompt_data.name,
        description=prompt_data.description,
        provider_id=prompt_data.provider_id,
        created_by=current_user["user_id"] if current_user else "demo-user",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        target_models=prompt_data.target_models,
        model_specific_prompts=[prompt.dict() for prompt in prompt_data.model_specific_prompts],
        mas_intent=prompt_data.mas_intent,
        mas_fairness_notes=prompt_data.mas_fairness_notes,
        mas_testing_notes=prompt_data.mas_testing_notes,
        mas_risk_level=prompt_data.mas_risk_level,
        mas_approval_log=prompt_data.mas_approval_log
    )

    db.add(prompt)
    db.commit()
    db.refresh(prompt)

    # Log the creation
    audit_log = AuditLog(
        id=str(uuid.uuid4()),
        actor=current_user["user_id"] if current_user else "demo-user",
        action="create_prompt",
        subject=f"{prompt_data.id}@{prompt_data.version}",
        subject_type="prompt",
        subject_id=prompt_data.id,
        tenant_id=tenant_id,
        before_json=None,
        after_json={"name": prompt_data.name, "target_models": prompt_data.target_models, "mas_risk_level": prompt_data.mas_risk_level, "requires_approval": requires_approval},
        result="success"
    )
    db.add(audit_log)

    # If approval is required, create approval request and workflow instance
    if requires_approval:
        try:
            # Create approval request
            approval_request = ApprovalRequest(
                id=str(uuid.uuid4()),
                prompt_id=prompt.id,
                requested_by=current_user["user_id"],
                requested_at=datetime.utcnow(),
                status="pending",
                tenant_id=tenant_id,
                evidence_required=False,
                auto_approve=False
            )
            db.add(approval_request)
            db.flush()  # Get the ID without committing

            # Try to find an active prompt approval workflow
            workflow_def = db.query(WorkflowDefinition).filter(
                WorkflowDefinition.category == "approval",
                WorkflowDefinition.status == WorkflowStatus.ACTIVE,
                WorkflowDefinition.tenant_id == tenant_id
            ).first()

            # If workflow exists, create workflow instance
            if workflow_def:
                workflow_instance = WorkflowInstance(
                    id=str(uuid.uuid4()),
                    workflow_definition_id=workflow_def.id,
                    status=WorkflowInstanceStatus.PENDING,
                    title=f"Prompt Approval: {prompt.name}",
                    description=f"Approval request for prompt '{prompt.name}' version {prompt.version}",
                    resource_type="prompt",
                    resource_id=prompt.id,
                    initiated_by=current_user["user_id"],
                    current_step=0,
                    context_json={
                        "prompt_id": prompt.id,
                        "prompt_version": prompt.version,
                        "prompt_name": prompt.name,
                        "mas_risk_level": prompt.mas_risk_level,
                        "requested_by": current_user["user_id"],
                        "requested_by_name": current_user.get("name", "Unknown User")
                    },
                    steps_json=[],
                    tenant_id=tenant_id,
                    due_date=datetime.utcnow() + timedelta(minutes=workflow_def.timeout_minutes)
                )
                db.add(workflow_instance)
                db.flush()

                # Link approval request to workflow instance
                approval_request.workflow_instance_id = workflow_instance.id
                approval_request.workflow_step = 0

            db.commit()

            # Log the approval request creation
            approval_audit_log = AuditLog(
                id=str(uuid.uuid4()),
                actor=current_user["user_id"],
                action="create_approval_request",
                subject=approval_request.id,
                subject_type="approval_request",
                subject_id=approval_request.id,
                tenant_id=tenant_id,
                before_json=None,
                after_json={
                    "prompt_id": prompt.id,
                    "status": "pending",
                    "workflow_instance_id": approval_request.workflow_instance_id
                },
                result="success"
            )
            db.add(approval_audit_log)

        except Exception as e:
            # Log error but don't fail the prompt creation
            error_audit_log = AuditLog(
                id=str(uuid.uuid4()),
                actor=current_user["user_id"],
                action="approval_workflow_error",
                subject=f"{prompt_data.id}@{prompt_data.version}",
                subject_type="prompt",
                subject_id=prompt_data.id,
                tenant_id=tenant_id,
                before_json=None,
                after_json={"error": str(e), "requires_approval": requires_approval},
                result="error"
            )
            db.add(error_audit_log)
            db.commit()

    return prompt

@router.put("/{prompt_id}/{version}", response_model=PromptResponse)
async def update_prompt(
    prompt_id: str,
    version: str,
    prompt_update: PromptUpdate = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update a prompt version"""

    prompt = db.query(Prompt).filter(
        Prompt.id == prompt_id,
        Prompt.version == version
    ).first()

    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt version not found")

    # Store original values for audit log
    before_data = {
        "content": prompt.content[:100] + "...",
        "mas_risk_level": prompt.mas_risk_level,
        "mas_intent": prompt.mas_intent
    }

    # Update fields
    update_data = prompt_update.dict(exclude_unset=True)

    # Validate MAS risk level if provided
    if "mas_risk_level" in update_data and update_data["mas_risk_level"] not in ["low", "medium", "high"]:
        raise HTTPException(status_code=400, detail="MAS risk level must be 'low', 'medium', or 'high'")

    for field, value in update_data.items():
        setattr(prompt, field, value)

    prompt.updated_at = datetime.utcnow()
    prompt.updated_by = current_user["user_id"] if current_user else "demo-user"

    db.commit()
    db.refresh(prompt)

    # Determine tenant_id with multiple fallbacks
    tenant_id = "demo-tenant"  # Ultimate fallback
    if current_user:
        if isinstance(current_user, dict):
            tenant_id = current_user.get("tenant", current_user.get("tenant_id", "demo-tenant"))
        else:
            # Handle case where current_user might not be a dict
            tenant_id = getattr(current_user, "tenant", getattr(current_user, "tenant_id", "demo-tenant"))

    # Log the update
    audit_log = AuditLog(
        id=str(uuid.uuid4()),
        actor=current_user["user_id"] if current_user else "demo-user",
        action="update_prompt",
        subject=f"{prompt_id}@{version}",
        subject_type="prompt",
        subject_id=prompt_id,
        tenant_id=tenant_id,
        before_json=before_data,
        after_json={"content": prompt.content[:100] + "...", "mas_risk_level": prompt.mas_risk_level, "mas_intent": prompt.mas_intent},
        result="success"
    )
    db.add(audit_log)
    db.commit()

    return prompt

@router.delete("/{prompt_id}/{version}")
async def delete_prompt(
    prompt_id: str,
    version: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Delete a prompt version"""

    prompt = db.query(Prompt).filter(
        Prompt.id == prompt_id,
        Prompt.version == version
    ).first()

    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt version not found")

    # Store prompt data for audit log
    prompt_data = {
        "content": prompt.content[:100] + "...",
        "mas_risk_level": prompt.mas_risk_level,
        "module_id": prompt.module_id
    }

    # Determine tenant_id with multiple fallbacks
    tenant_id = "demo-tenant"  # Ultimate fallback
    if current_user:
        if isinstance(current_user, dict):
            tenant_id = current_user.get("tenant", current_user.get("tenant_id", "demo-tenant"))
        else:
            # Handle case where current_user might not be a dict
            tenant_id = getattr(current_user, "tenant", getattr(current_user, "tenant_id", "demo-tenant"))

    # Delete related approval requests first to avoid foreign key constraint violations
    approval_requests = db.query(ApprovalRequest).filter(ApprovalRequest.prompt_id == prompt_id).all()
    for approval_request in approval_requests:
        db.delete(approval_request)

    db.delete(prompt)
    db.commit()

    # Log the deletion
    audit_log = AuditLog(
        id=str(uuid.uuid4()),
        actor=current_user["user_id"] if current_user else "demo-user",
        action="delete_prompt",
        subject=f"{prompt_id}@{version}",
        subject_type="prompt",
        subject_id=prompt_id,
        tenant_id=tenant_id,
        before_json=prompt_data,
        after_json=None,
        result="success"
    )
    db.add(audit_log)
    db.commit()

    return {"message": "Prompt version deleted successfully"}
