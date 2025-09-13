from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import List
import hashlib
import yaml
import json
import uuid
from datetime import datetime

from app.database import get_db
from app.models import Template, AuditLog
from app.schemas import TemplateCreate, TemplateResponse
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

@router.get("/", response_model=List[TemplateResponse])
async def list_all_templates(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_mock_user)  # Using mock user for development
):
    """List all templates"""
    templates = db.query(Template).all()
    return templates

@router.get("/{template_id}", response_model=List[TemplateResponse])
async def list_template_versions(
    template_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_mock_user)  # Using mock user for development
):
    """List all versions of a template"""
    templates = db.query(Template).filter(Template.id == template_id).all()
    return templates

@router.get("/{template_id}/{version}", response_model=TemplateResponse)
async def get_template_version(
    template_id: str,
    version: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_mock_user)  # Using mock user for development
):
    """Get specific version of a template"""
    template = db.query(Template).filter(
        Template.id == template_id,
        Template.version == version
    ).first()

    if not template:
        raise HTTPException(status_code=404, detail="Template version not found")

    return template

@router.post("/", response_model=TemplateResponse)
async def create_template(
    template_data: TemplateCreate = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_mock_user)  # Using mock user for development
):
    """Create a new template version"""
    # Parse YAML and validate
    try:
        template_content = yaml.safe_load(template_data.template_yaml)
    except yaml.YAMLError as e:
        raise HTTPException(status_code=400, detail=f"Invalid YAML: {str(e)}")
    
    # Compute content hash
    content_bytes = template_data.template_yaml.encode('utf-8')
    template_hash = hashlib.sha256(content_bytes).hexdigest()
    
    # Check if this exact version already exists
    existing = db.query(Template).filter(
        Template.id == template_data.id,
        Template.version == template_data.version
    ).first()
    
    if existing:
        raise HTTPException(status_code=409, detail="Template version already exists")
    
    # Create template
    template = Template(
        id=template_data.id,
        version=template_data.version,
        owner=template_data.owner,
        hash=template_hash,
        metadata_json=template_data.metadata,
        created_by=current_user["user_id"],
        created_at=datetime.utcnow()
    )
    
    db.add(template)
    db.commit()
    db.refresh(template)
    
    # Log the creation
    audit_log = AuditLog(
        id=str(uuid.uuid4()),
        actor=current_user["user_id"],
        action="create_template",
        subject=f"{template_data.id}@{template_data.version}",
        before_json=None,
        after_json={"id": template_data.id, "version": template_data.version}
    )
    db.add(audit_log)
    db.commit()
    
    return template