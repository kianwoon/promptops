from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import List
import hashlib
import yaml
import json
import uuid
import time
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
    return [
        TemplateResponse(
            id=template.id,
            version=template.version,
            owner=template.owner,
            hash=template.hash,
            metadata=template.metadata_json,
            created_by=template.created_by,
            created_at=template.created_at
        )
        for template in templates
    ]

@router.get("/{template_id}", response_model=List[TemplateResponse])
async def list_template_versions(
    template_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_mock_user)  # Using mock user for development
):
    """List all versions of a template"""
    templates = db.query(Template).filter(Template.id == template_id).all()
    return [
        TemplateResponse(
            id=template.id,
            version=template.version,
            owner=template.owner,
            hash=template.hash,
            metadata=template.metadata_json,
            created_by=template.created_by,
            created_at=template.created_at
        )
        for template in templates
    ]

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

    return TemplateResponse(
        id=template.id,
        version=template.version,
        owner=template.owner,
        hash=template.hash,
        metadata=template.metadata_json,
        created_by=template.created_by,
        created_at=template.created_at
    )

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

    # Generate unique ID if this is a new template (not from existing template)
    template_id = template_data.id
    if not template_id or template_id == 'untitled':
        # Generate a unique ID based on the template name from YAML
        template_name = template_content.get('name', 'untitled')
        # Generate a unique ID using name + timestamp + uuid
        timestamp = int(time.time())
        unique_id = f"{template_name}-{timestamp}-{str(uuid.uuid4())[:8]}"
        template_id = unique_id

    # Check if this exact version already exists for this template
    existing = db.query(Template).filter(
        Template.id == template_id,
        Template.version == template_data.version
    ).first()

    if existing:
        raise HTTPException(status_code=409, detail="Template version already exists")

    # Create template
    template = Template(
        id=template_id,
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
        subject=f"{template_id}@{template_data.version}",
        subject_type="template",
        subject_id=template_id,
        tenant_id=current_user.get("tenant", "default"),
        before_json=None,
        after_json={"id": template_id, "version": template_data.version}
    )
    db.add(audit_log)
    db.commit()

    # Return properly formatted response
    return TemplateResponse(
        id=template.id,
        version=template.version,
        owner=template.owner,
        hash=template.hash,
        metadata=template.metadata_json,
        created_by=template.created_by,
        created_at=template.created_at
    )

@router.delete("/{template_id}/{version}")
async def delete_template(
    template_id: str,
    version: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_mock_user)  # Using mock user for development
):
    """Delete a template version"""
    template = db.query(Template).filter(
        Template.id == template_id,
        Template.version == version
    ).first()

    if not template:
        raise HTTPException(status_code=404, detail="Template version not found")

    # Store template data for audit log
    template_data = {
        "id": template.id,
        "version": template.version,
        "owner": template.owner,
        "metadata": template.metadata_json
    }

    db.delete(template)
    db.commit()

    # Log the deletion
    audit_log = AuditLog(
        id=str(uuid.uuid4()),
        actor=current_user["user_id"],
        action="delete_template",
        subject=f"{template_id}@{version}",
        subject_type="template",
        subject_id=template_id,
        tenant_id=current_user.get("tenant", "default"),
        before_json=template_data,
        after_json=None,
        result="success"
    )
    db.add(audit_log)
    db.commit()

    return {"message": "Template version deleted successfully"}

@router.delete("/{template_id}")
async def delete_template_all_versions(
    template_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_mock_user)  # Using mock user for development
):
    """Delete all versions of a template and its aliases"""
    # Find all template versions
    templates = db.query(Template).filter(Template.id == template_id).all()

    if not templates:
        raise HTTPException(status_code=404, detail="Template not found")

    # Store template data for audit log
    deleted_templates = []
    for template in templates:
        deleted_templates.append({
            "id": template.id,
            "version": template.version,
            "owner": template.owner,
            "metadata": template.metadata_json
        })

    # Delete all aliases associated with this template
    from app.models import Alias
    aliases_deleted = db.query(Alias).filter(Alias.template_id == template_id).delete()

    # Delete all template versions
    templates_deleted = db.query(Template).filter(Template.id == template_id).delete()

    db.commit()

    # Log the deletion
    audit_log = AuditLog(
        id=str(uuid.uuid4()),
        actor=current_user["user_id"],
        action="delete_template_all_versions",
        subject=template_id,
        subject_type="template",
        subject_id=template_id,
        tenant_id=current_user.get("tenant", "default"),
        before_json={"templates": deleted_templates, "aliases_count": aliases_deleted},
        after_json=None,
        result="success"
    )
    db.add(audit_log)
    db.commit()

    return {
        "message": f"Template and all versions deleted successfully",
        "details": {
            "template_id": template_id,
            "versions_deleted": templates_deleted,
            "aliases_deleted": aliases_deleted
        }
    }