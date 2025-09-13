from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
from datetime import datetime

from app.database import get_db
from app.models import ModelCompatibility, Prompt, AuditLog
from app.schemas import ModelCompatibilityCreate, ModelCompatibilityResponse, ModelCompatibilityUpdate
from app.auth import get_current_user
from app.services.compatibility_service import compatibility_service

router = APIRouter()

@router.get("/", response_model=List[ModelCompatibilityResponse])
async def list_model_compatibilities(
    prompt_id: Optional[str] = None,
    provider_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List all model compatibilities, optionally filtered by prompt or provider"""
    query = db.query(ModelCompatibility)
    if prompt_id:
        query = query.filter(ModelCompatibility.prompt_id == prompt_id)
    if provider_type:
        query = query.filter(ModelCompatibility.provider_type == provider_type)

    compatibilities = query.offset(skip).limit(limit).all()
    return compatibilities

@router.get("/{compatibility_id}", response_model=ModelCompatibilityResponse)
async def get_model_compatibility(
    compatibility_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get a specific model compatibility"""
    compatibility = db.query(ModelCompatibility).filter(ModelCompatibility.id == compatibility_id).first()
    if not compatibility:
        raise HTTPException(status_code=404, detail="Model compatibility not found")
    return compatibility

@router.post("/", response_model=ModelCompatibilityResponse)
async def create_model_compatibility(
    compatibility_data: ModelCompatibilityCreate = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a new model compatibility"""
    # Verify prompt exists
    prompt = db.query(Prompt).filter(Prompt.id == compatibility_data.prompt_id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")

    compatibility_id = str(uuid.uuid4())

    compatibility = ModelCompatibility(
        id=compatibility_id,
        prompt_id=compatibility_data.prompt_id,
        model_name=compatibility_data.model_name,
        model_provider=compatibility_data.model_provider,
        is_compatible=compatibility_data.is_compatible,
        compatibility_notes=compatibility_data.compatibility_notes,
        created_at=datetime.utcnow()
    )

    db.add(compatibility)
    db.commit()
    db.refresh(compatibility)

    # Log the creation
    audit_log = AuditLog(
        id=str(uuid.uuid4()),
        actor=current_user["user_id"],
        action="create_model_compatibility",
        subject=compatibility_id,
        before_json=None,
        after_json={
            "model_name": compatibility_data.model_name,
            "model_provider": compatibility_data.model_provider,
            "is_compatible": compatibility_data.is_compatible
        }
    )
    db.add(audit_log)
    db.commit()

    return compatibility

@router.put("/{compatibility_id}", response_model=ModelCompatibilityResponse)
async def update_model_compatibility(
    compatibility_id: str,
    compatibility_update: ModelCompatibilityUpdate = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update a model compatibility"""
    compatibility = db.query(ModelCompatibility).filter(ModelCompatibility.id == compatibility_id).first()
    if not compatibility:
        raise HTTPException(status_code=404, detail="Model compatibility not found")

    # Store original values for audit log
    before_data = {
        "is_compatible": compatibility.is_compatible,
        "model_name": compatibility.model_name,
        "model_provider": compatibility.model_provider
    }

    # Update fields
    update_data = compatibility_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(compatibility, field, value)

    db.commit()
    db.refresh(compatibility)

    # Log the update
    audit_log = AuditLog(
        id=str(uuid.uuid4()),
        actor=current_user["user_id"],
        action="update_model_compatibility",
        subject=compatibility_id,
        before_json=before_data,
        after_json={
            "is_compatible": compatibility.is_compatible,
            "model_name": compatibility.model_name,
            "model_provider": compatibility.model_provider
        }
    )
    db.add(audit_log)
    db.commit()

    return compatibility

@router.delete("/{compatibility_id}")
async def delete_model_compatibility(
    compatibility_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Delete a model compatibility"""
    compatibility = db.query(ModelCompatibility).filter(ModelCompatibility.id == compatibility_id).first()
    if not compatibility:
        raise HTTPException(status_code=404, detail="Model compatibility not found")

    # Store compatibility data for audit log
    compatibility_data = {
        "provider_name": compatibility.provider_name,
        "provider_type": compatibility.provider_type,
        "is_compatible": compatibility.is_compatible,
        "prompt_id": compatibility.prompt_id
    }

    db.delete(compatibility)
    db.commit()

    # Log the deletion
    audit_log = AuditLog(
        id=str(uuid.uuid4()),
        actor=current_user["user_id"],
        action="delete_model_compatibility",
        subject=compatibility_id,
        before_json=compatibility_data,
        after_json=None
    )
    db.add(audit_log)
    db.commit()

    return {"message": "Model compatibility deleted successfully"}

# Compatibility Testing Endpoints
@router.post("/test/{prompt_id}/{version}")
async def test_prompt_compatibility(
    prompt_id: str,
    version: str,
    providers: Optional[List[str]] = None,
    force_refresh: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """Test prompt compatibility across model providers"""
    try:
        result = await compatibility_service.test_prompt_compatibility(
            prompt_id, version, providers, force_refresh
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Compatibility test failed: {str(e)}")

@router.get("/matrix/{prompt_id}")
async def get_compatibility_matrix(
    prompt_id: str,
    version: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get compatibility matrix for a specific prompt"""
    try:
        result = await compatibility_service.get_prompt_compatibility_matrix(prompt_id, version)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get compatibility matrix: {str(e)}")

@router.post("/test/batch")
async def run_batch_compatibility_tests(
    prompt_ids: List[str],
    versions: Optional[List[str]] = None,
    providers: Optional[List[str]] = None,
    current_user: dict = Depends(get_current_user)
):
    """Run compatibility tests for multiple prompts"""
    try:
        result = await compatibility_service.run_batch_compatibility_tests(
            prompt_ids, versions, providers
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch compatibility test failed: {str(e)}")

@router.get("/trends/{prompt_id}")
async def get_compatibility_trends(
    prompt_id: str,
    days: int = 30,
    current_user: dict = Depends(get_current_user)
):
    """Get compatibility trends over time for a prompt"""
    try:
        result = await compatibility_service.get_compatibility_trends(prompt_id, days)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get compatibility trends: {str(e)}")