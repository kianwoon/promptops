from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
from datetime import datetime

from app.database import get_db
from app.models import Prompt, Module, AuditLog
from app.schemas import PromptCreate, PromptResponse, PromptUpdate
from app.auth import get_current_user

# Temporary: Create a mock user dependency for development
async def get_mock_user():
    """Mock user for development purposes"""
    return {
        "user_id": "demo-user",
        "email": "demo@example.com",
        "roles": ["admin"],
        "tenant": "demo-tenant"
    }

router = APIRouter()

@router.get("/", response_model=List[PromptResponse])
async def list_prompts(
    module_id: Optional[str] = None,
    provider_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_mock_user)  # Using mock user for development
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
    current_user: dict = Depends(get_mock_user)  # Using mock user for development
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
    current_user: dict = Depends(get_mock_user)  # Using mock user for development
):
    """Get specific version of a prompt"""
    prompt = db.query(Prompt).filter(
        Prompt.id == prompt_id,
        Prompt.version == version
    ).first()

    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt version not found")

    return prompt

@router.post("/", response_model=PromptResponse)
async def create_prompt(
    prompt_data: PromptCreate = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_mock_user)  # Using mock user for development
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

    # Create the prompt with model-specific variations
    prompt = Prompt(
        id=prompt_data.id,
        version=prompt_data.version,
        module_id=prompt_data.module_id,
        content=prompt_data.model_specific_prompts[0].content if prompt_data.model_specific_prompts else "",  # Use first model's content as main content
        name=prompt_data.name,
        description=prompt_data.description,
        provider_id=prompt_data.provider_id,
        created_by=current_user["user_id"],
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
        actor=current_user["user_id"],
        action="create_prompt",
        subject=f"{prompt_data.id}@{prompt_data.version}",
        subject_type="prompt",
        subject_id=prompt_data.id,
        tenant_id=current_user.get("tenant", "default"),
        before_json=None,
        after_json={"name": prompt_data.name, "target_models": prompt_data.target_models, "mas_risk_level": prompt_data.mas_risk_level},
        result="success"
    )
    db.add(audit_log)
    db.commit()

    return prompt

@router.put("/{prompt_id}/{version}", response_model=PromptResponse)
async def update_prompt(
    prompt_id: str,
    version: str,
    prompt_update: PromptUpdate = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_mock_user)  # Using mock user for development
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

    db.commit()
    db.refresh(prompt)

    # Log the update
    audit_log = AuditLog(
        id=str(uuid.uuid4()),
        actor=current_user["user_id"],
        action="update_prompt",
        subject=f"{prompt_id}@{version}",
        subject_type="prompt",
        subject_id=prompt_id,
        tenant_id=current_user.get("tenant", "default"),
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
    current_user: dict = Depends(get_mock_user)  # Using mock user for development
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

    db.delete(prompt)
    db.commit()

    # Log the deletion
    audit_log = AuditLog(
        id=str(uuid.uuid4()),
        actor=current_user["user_id"],
        action="delete_prompt",
        subject=f"{prompt_id}@{version}",
        subject_type="prompt",
        subject_id=prompt_id,
        tenant_id=current_user.get("tenant", "default"),
        before_json=prompt_data,
        after_json=None,
        result="success"
    )
    db.add(audit_log)
    db.commit()

    return {"message": "Prompt version deleted successfully"}