from fastapi import APIRouter, Depends, HTTPException, Body, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta, timezone
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

def increment_version(version: str) -> str:
    """Increment the patch version of a semantic version string"""
    try:
        parts = version.split('.')
        if len(parts) == 3:
            major = int(parts[0])
            minor = int(parts[1])
            patch = int(parts[2])
            return f"{major}.{minor}.{patch + 1}"
        return version
    except (ValueError, IndexError):
        # Return original version if invalid format
        return version

def get_latest_version_from_prompts(prompts: List[Any]) -> str:
    """Get the latest version from a list of prompt objects"""
    if not prompts:
        return "1.0.0"

    latest_version = "1.0.0"
    for prompt in prompts:
        try:
            parts = prompt.version.split('.')
            if len(parts) == 3:
                current = [int(parts[0]), int(parts[1]), int(parts[2])]
                latest_parts = latest_version.split('.')
                latest = [int(latest_parts[0]), int(latest_parts[1]), int(latest_parts[2])]

                # Compare versions
                for i in range(3):
                    if current[i] > latest[i]:
                        latest_version = prompt.version
                        break
                    elif current[i] < latest[i]:
                        break
        except (ValueError, IndexError):
            # Skip invalid version formats
            continue

    return latest_version

router = APIRouter()

@router.get("/modules/{module_id}/latest-version")
async def get_latest_module_version(
    module_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get the latest version number across all prompts in a module"""
    # Verify module exists
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    # Get all prompts in the module
    prompts = db.query(Prompt).filter(Prompt.module_id == module_id).all()
    latest_version = get_latest_version_from_prompts(prompts)

    return {"latest_version": latest_version}

@router.get("", response_model=List[PromptResponse])
async def list_prompts(
    module_id: Optional[str] = None,
    provider_id: Optional[str] = None,
    include_inactive: bool = Query(default=False, description="Include inactive prompts in results"),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List prompts, optionally filtered by module or provider. By default only returns active prompts."""
    query = db.query(Prompt)
    if module_id:
        query = query.filter(Prompt.module_id == module_id)
    if provider_id:
        query = query.filter(Prompt.provider_id == provider_id)
    if not include_inactive:
        query = query.filter(Prompt.is_active == True)

    prompts = query.offset(skip).limit(limit).all()
    return prompts

@router.get("/{prompt_id}", response_model=List[PromptResponse])
async def get_prompt_versions(
    prompt_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get all versions of a prompt"""
    # Find prompts that match the base prompt ID or the pattern with version suffix
    import re

    # Check if prompt_id already has a version suffix
    if re.match(r'^.+-v\d+\.\d+\.\d+$', prompt_id):
        # Extract the base prompt ID
        base_prompt_id = re.sub(r'-v\d+\.\d+\.\d+$', '', prompt_id)
        # Find all versions of this base prompt
        prompts = db.query(Prompt).filter(
            (Prompt.id == base_prompt_id) |
            (Prompt.id.like(f"{base_prompt_id}-v%"))
        ).all()
    else:
        # Find all versions of this prompt (original pattern and versioned pattern)
        prompts = db.query(Prompt).filter(
            (Prompt.id == prompt_id) |
            (Prompt.id.like(f"{prompt_id}-v%"))
        ).all()

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
    # Try the new versioned ID pattern first
    versioned_id = f"{prompt_id}-v{version}"
    prompt = db.query(Prompt).filter(
        Prompt.id == versioned_id,
        Prompt.version == version
    ).first()

    # If not found, try the original pattern (for backward compatibility)
    if not prompt:
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
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        target_models=prompt_data.target_models,
        model_specific_prompts=[prompt.model_dump() for prompt in prompt_data.model_specific_prompts],
        mas_intent=prompt_data.mas_intent,
        mas_fairness_notes=prompt_data.mas_fairness_notes,
        mas_testing_notes=prompt_data.mas_testing_notes,
        mas_risk_level=prompt_data.mas_risk_level,
        mas_approval_log=prompt_data.mas_approval_log,
        is_active=prompt_data.is_active,
        activation_reason=prompt_data.activation_reason
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
                requested_at=datetime.now(timezone.utc),
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
                    due_date=datetime.now(timezone.utc) + timedelta(minutes=workflow_def.timeout_minutes)
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
        "mas_intent": prompt.mas_intent,
        "is_active": prompt.is_active,
        "activation_reason": prompt.activation_reason
    }

    # Update fields
    update_data = prompt_update.model_dump(exclude_unset=True)

    # Check if this is a version update request
    if "version" in update_data:
        new_version = update_data["version"]

        # Check if prompt is under review (has pending approval)
        pending_approval = db.query(ApprovalRequest).filter(
            ApprovalRequest.prompt_id == prompt_id,
            ApprovalRequest.status == "pending"
        ).first()

        if not pending_approval:
            # Check if prompt is active
            if prompt.is_active:
                # For active prompts not under review, create a new prompt with unique ID
                # Check if new version already exists
                existing_version = db.query(Prompt).filter(
                    Prompt.id == prompt_id,
                    Prompt.version == new_version
                ).first()

                if existing_version:
                    raise HTTPException(
                        status_code=409,
                        detail=f"Prompt version {new_version} already exists"
                    )

                # Create new version with all the data from the old version
                # Remove version from update_data since we'll use it for the new prompt
                version_update_data = update_data.copy()
                version_update_data.pop("version")

                # Validate MAS risk level if provided
                if "mas_risk_level" in version_update_data and version_update_data["mas_risk_level"] not in ["low", "medium", "high"]:
                    raise HTTPException(status_code=400, detail="MAS risk level must be 'low', 'medium', or 'high'")

                # Store the old version for audit logging
                old_version = prompt.version

                # Generate a unique ID for the new version
                unique_prompt_id = f"{prompt_id}-v{new_version}"

                # Create a new prompt record for the new version
                new_prompt = Prompt(
                    id=unique_prompt_id,  # Unique ID for this version
                    version=new_version,  # New version number
                    module_id=prompt.module_id,
                    content=prompt.content,  # Copy content from old version
                    name=prompt.name,
                    description=prompt.description,
                    provider_id=prompt.provider_id,
                    created_by=current_user["user_id"] if current_user else "demo-user",
                    created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc),
                    target_models=prompt.target_models,
                    model_specific_prompts=prompt.model_specific_prompts,
                    mas_intent=prompt.mas_intent,
                    mas_fairness_notes=prompt.mas_fairness_notes,
                    mas_testing_notes=prompt.mas_testing_notes,
                    mas_risk_level=prompt.mas_risk_level,
                    mas_approval_log=prompt.mas_approval_log,
                    is_active=False,  # New versions start as inactive
                    activation_reason=None
                )

                # Apply any updates from the request to the new prompt
                for field, value in version_update_data.items():
                    setattr(new_prompt, field, value)

                db.add(new_prompt)
                db.commit()
                db.refresh(new_prompt)

                # Use the new prompt for the response
                prompt = new_prompt
            else:
                raise HTTPException(
                    status_code=400,
                    detail="Version updates are only allowed for prompts under review (pending approval) or active prompts."
                )
        else:
            # For prompts under review, UPDATE the existing prompt (keep same ID, just change version)
            # Check if new version already exists
            existing_version = db.query(Prompt).filter(
                Prompt.id == prompt_id,
                Prompt.version == new_version
            ).first()

            if existing_version:
                raise HTTPException(
                    status_code=409,
                    detail=f"Prompt version {new_version} already exists"
                )

            # Store the old version for audit logging
            old_version = prompt.version

            # Remove version from update_data since we'll handle it separately
            version_update_data = update_data.copy()
            version_update_data.pop("version")

            # Validate MAS risk level if provided
            if "mas_risk_level" in version_update_data and version_update_data["mas_risk_level"] not in ["low", "medium", "high"]:
                raise HTTPException(status_code=400, detail="MAS risk level must be 'low', 'medium', or 'high'")

            # Update the existing prompt's version and other fields
            prompt.version = new_version
            for field, value in version_update_data.items():
                setattr(prompt, field, value)

            prompt.updated_at = datetime.now(timezone.utc)
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

        # Log the version update
        if not pending_approval and prompt.is_active:
            # For new prompt creation
            audit_log = AuditLog(
                id=str(uuid.uuid4()),
                actor=current_user["user_id"] if current_user else "demo-user",
                action="version_update_prompt",
                subject=f"{prompt_id}@{old_version}->{new_version}",
                subject_type="prompt",
                subject_id=unique_prompt_id,  # Use the new prompt ID
                tenant_id=tenant_id,
                before_json=before_data,
                after_json={
                    "old_version": old_version,
                    "new_version": new_version,
                    "original_prompt_id": prompt_id,
                    "new_prompt_id": unique_prompt_id,
                    "content": prompt.content[:100] + "...",
                    "mas_risk_level": prompt.mas_risk_level,
                    "mas_intent": prompt.mas_intent
                },
                result="success"
            )
        else:
            # For existing prompt update
            audit_log = AuditLog(
                id=str(uuid.uuid4()),
                actor=current_user["user_id"] if current_user else "demo-user",
                action="version_update_prompt",
                subject=f"{prompt_id}@{old_version}->{new_version}",
                subject_type="prompt",
                subject_id=prompt_id,  # Use the original prompt ID
                tenant_id=tenant_id,
                before_json=before_data,
                after_json={
                    "old_version": old_version,
                    "new_version": new_version,
                    "updated_prompt_id": prompt_id,
                    "content": prompt.content[:100] + "...",
                    "mas_risk_level": prompt.mas_risk_level,
                    "mas_intent": prompt.mas_intent
                },
                result="success"
            )
        db.add(audit_log)
        db.commit()

        return prompt

    # Regular update (no version change)
    # Validate MAS risk level if provided
    if "mas_risk_level" in update_data and update_data["mas_risk_level"] not in ["low", "medium", "high"]:
        raise HTTPException(status_code=400, detail="MAS risk level must be 'low', 'medium', or 'high'")

    for field, value in update_data.items():
        setattr(prompt, field, value)

    prompt.updated_at = datetime.now(timezone.utc)

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

    # Try the new versioned ID pattern first
    versioned_id = f"{prompt_id}-v{version}"
    prompt = db.query(Prompt).filter(
        Prompt.id == versioned_id,
        Prompt.version == version
    ).first()

    # If not found, try the original pattern (for backward compatibility)
    if not prompt:
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
    # Check both the original prompt_id and the versioned_id for approval requests
    approval_requests = db.query(ApprovalRequest).filter(
        (ApprovalRequest.prompt_id == prompt_id) | (ApprovalRequest.prompt_id == versioned_id)
    ).all()
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

@router.post("/{prompt_id}/{version}/activate", response_model=PromptResponse)
async def activate_prompt(
    prompt_id: str,
    version: str,
    reason: Optional[str] = Body(default=None, description="Reason for activation"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Activate a prompt version"""
    # Try the new versioned ID pattern first
    versioned_id = f"{prompt_id}-v{version}"
    prompt = db.query(Prompt).filter(
        Prompt.id == versioned_id,
        Prompt.version == version
    ).first()

    # If not found, try the original pattern (for backward compatibility)
    if not prompt:
        prompt = db.query(Prompt).filter(
            Prompt.id == prompt_id,
            Prompt.version == version
        ).first()

    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt version not found")

    # Check if prompt is under review (pending approval)
    # Check both the original prompt_id and the versioned_id for approval requests
    pending_approval = db.query(ApprovalRequest).filter(
        (ApprovalRequest.prompt_id == prompt_id) | (ApprovalRequest.prompt_id == versioned_id),
        ApprovalRequest.status == "pending"
    ).first()

    if pending_approval:
        raise HTTPException(
            status_code=400,
            detail="Cannot activate prompt that is under review. Please wait for approval first."
        )

    # Store original values for audit log
    before_data = {
        "is_active": prompt.is_active,
        "activated_at": prompt.activated_at.isoformat() if prompt.activated_at else None,
        "activated_by": prompt.activated_by
    }

    # Update activation fields
    prompt.is_active = True
    prompt.activated_at = datetime.now(timezone.utc)
    prompt.activated_by = current_user["user_id"] if current_user else "demo-user"
    prompt.activation_reason = reason
    prompt.updated_at = datetime.now(timezone.utc)

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

    # Log the activation
    audit_log = AuditLog(
        id=str(uuid.uuid4()),
        actor=current_user["user_id"] if current_user else "demo-user",
        action="activate_prompt",
        subject=f"{prompt_id}@{version}",
        subject_type="prompt",
        subject_id=prompt_id,
        tenant_id=tenant_id,
        before_json=before_data,
        after_json={
            "is_active": True,
            "activated_at": prompt.activated_at.isoformat(),
            "activated_by": prompt.activated_by,
            "activation_reason": reason
        },
        result="success"
    )
    db.add(audit_log)
    db.commit()

    return prompt

@router.post("/{prompt_id}/{version}/deactivate", response_model=PromptResponse)
async def deactivate_prompt(
    prompt_id: str,
    version: str,
    reason: Optional[str] = Body(default=None, description="Reason for deactivation"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Deactivate a prompt version"""
    # Try the new versioned ID pattern first
    versioned_id = f"{prompt_id}-v{version}"
    prompt = db.query(Prompt).filter(
        Prompt.id == versioned_id,
        Prompt.version == version
    ).first()

    # If not found, try the original pattern (for backward compatibility)
    if not prompt:
        prompt = db.query(Prompt).filter(
            Prompt.id == prompt_id,
            Prompt.version == version
        ).first()

    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt version not found")

    # Store original values for audit log
    before_data = {
        "is_active": prompt.is_active,
        "activated_at": prompt.activated_at.isoformat() if prompt.activated_at else None,
        "activated_by": prompt.activated_by
    }

    # Update deactivation fields
    prompt.is_active = False
    prompt.activated_at = datetime.now(timezone.utc)
    prompt.activated_by = current_user["user_id"] if current_user else "demo-user"
    prompt.activation_reason = reason
    prompt.updated_at = datetime.now(timezone.utc)

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

    # Log the deactivation
    audit_log = AuditLog(
        id=str(uuid.uuid4()),
        actor=current_user["user_id"] if current_user else "demo-user",
        action="deactivate_prompt",
        subject=f"{prompt_id}@{version}",
        subject_type="prompt",
        subject_id=prompt_id,
        tenant_id=tenant_id,
        before_json=before_data,
        after_json={
            "is_active": False,
            "activated_at": prompt.activated_at.isoformat(),
            "activated_by": prompt.activated_by,
            "activation_reason": reason
        },
        result="success"
    )
    db.add(audit_log)
    db.commit()

    return prompt
