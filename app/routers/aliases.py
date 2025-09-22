from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import Dict, Any, List
from datetime import datetime
import uuid

from app.database import get_db
from app.models import Alias, Template, AuditLog
from app.schemas import AliasResponse, AliasUpdate, AliasesListResponse
from app.auth import get_current_user

router = APIRouter()

@router.get("", response_model=List[AliasResponse])
async def get_aliases(
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get all aliases"""
    aliases = db.query(Alias).order_by(Alias.alias).all()
    return aliases

@router.get("/{alias}", response_model=AliasResponse)
async def get_alias(
    alias: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get alias configuration"""
    alias_obj = db.query(Alias).filter(Alias.alias == alias).first()
    if not alias_obj:
        raise HTTPException(status_code=404, detail="Alias not found")
    
    return alias_obj

@router.patch("/{alias}/weights", response_model=AliasResponse)
async def update_alias_weights(
    alias: str,
    update: AliasUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update alias weights for canary/AB testing"""
    
    alias_obj = db.query(Alias).filter(Alias.alias == alias).first()
    if not alias_obj:
        raise HTTPException(status_code=404, detail="Alias not found")
    
    # Validate weights sum to 1
    total_weight = sum(update.weights.values())
    if abs(total_weight - 1.0) > 0.001:
        raise HTTPException(status_code=400, detail="Weights must sum to 1.0")
    
    # Log before state
    before_state = {
        "alias": alias,
        "weights": alias_obj.weights_json,
        "target_version": alias_obj.target_version
    }
    
    # Update alias
    alias_obj.weights_json = update.weights
    alias_obj.updated_by = current_user["user_id"]
    alias_obj.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(alias_obj)
    
    # Log the change
    audit_log = AuditLog(
        id=str(uuid.uuid4()),
        actor=current_user["user_id"],
        action="update_alias_weights",
        subject=alias,
        before_json=before_state,
        after_json={"weights": update.weights}
    )
    db.add(audit_log)
    db.commit()
    
    return alias_obj

@router.post("/{alias}/promote", response_model=AliasResponse)
async def promote_alias(
    alias: str,
    target_version: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Promote alias to target version (requires approval)"""
    
    # Check if template version exists
    template = db.query(Template).filter(
        Template.id == alias.split(":")[0],  # Extract template_id from alias
        Template.version == target_version
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Target template version not found")
    
    alias_obj = db.query(Alias).filter(Alias.alias == alias).first()
    if not alias_obj:
        raise HTTPException(status_code=404, detail="Alias not found")
    
    # Log before state
    before_state = {
        "alias": alias,
        "target_version": alias_obj.target_version,
        "weights": alias_obj.weights_json
    }
    
    # Update alias
    alias_obj.target_version = target_version
    alias_obj.weights_json = {target_version: 1.0}  # Full rollout
    alias_obj.updated_by = current_user["user_id"]
    alias_obj.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(alias_obj)
    
    # Log the promotion
    audit_log = AuditLog(
        id=str(uuid.uuid4()),
        actor=current_user["user_id"],
        action="promote_alias",
        subject=alias,
        before_json=before_state,
        after_json={"target_version": target_version, "weights": {target_version: 1.0}}
    )
    db.add(audit_log)
    db.commit()
    
    return alias_obj