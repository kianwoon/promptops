from fastapi import APIRouter, Depends, HTTPException, Body, Request
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
from datetime import datetime
import logging
import jwt

from app.database import get_db
from app.models import Prompt, Module, AuditLog
from app.schemas import PromptCreate, PromptResponse, PromptUpdate
from app.auth import get_current_user
from app.services.auth_service import AuthService
from app.config import settings

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
        after_json={"name": prompt_data.name, "target_models": prompt_data.target_models, "mas_risk_level": prompt_data.mas_risk_level},
        result="success"
    )
    db.add(audit_log)
    db.commit()

    return prompt

@router.put("/{prompt_id}/{version}", response_model=PromptResponse)
async def update_prompt(
    request: Request,
    prompt_id: str,
    version: str,
    prompt_update: PromptUpdate = Body(...),
    db: Session = Depends(get_db)
):
    """Update a prompt version"""
    # Get current user using our helper function
    current_user = await get_current_user(request)

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
    request: Request,
    prompt_id: str,
    version: str,
    db: Session = Depends(get_db)
):
    """Delete a prompt version"""
    # Get current user using our helper function
    current_user = await get_current_user(request)

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