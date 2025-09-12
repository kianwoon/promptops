from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any
import json
import hashlib
from datetime import datetime

from app.database import get_db
from app.models import Template, Alias, Module, Variant, TenantOverlay, Policy
from app.schemas import RenderRequest, RenderResponse, Message
from app.auth import get_current_user
from app.composition import TemplateComposer

router = APIRouter()

@router.post("/render")
async def render_template(
    request: RenderRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Render a template with given inputs"""
    
    # Resolve alias to actual template version
    alias = db.query(Alias).filter(Alias.alias == request.alias).first()
    if not alias:
        raise HTTPException(status_code=404, detail="Alias not found")
    
    # For weighted canary/AB testing, select version based on weights
    if alias.weights_json and len(alias.weights_json) > 1:
        import random
        version = random.choices(
            list(alias.weights_json.keys()),
            weights=list(alias.weights_json.values())
        )[0]
    else:
        version = alias.target_version
    
    # Get template
    template = db.query(Template).filter(
        Template.id == request.id,
        Template.version == version
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template version not found")
    
    # Get tenant overlay if applicable
    tenant_overlay = None
    if request.tenant:
        tenant_overlay = db.query(TenantOverlay).filter(
            TenantOverlay.tenant_id == request.tenant,
            TenantOverlay.template_id == request.id,
            TenantOverlay.version == version
        ).first()
    
    # Compose template
    composer = TemplateComposer(db)
    try:
        rendered_content = await composer.compose(
            template_id=request.id,
            version=version,
            inputs=request.inputs,
            overrides=request.overrides,
            tenant_overlay=tenant_overlay.overrides_json if tenant_overlay else None
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Template composition failed: {str(e)}")
    
    # Apply policies (simplified for now)
    applied_policies = []
    
    # Compute final hash
    content_str = json.dumps(rendered_content, sort_keys=True)
    final_hash = hashlib.sha256(content_str.encode('utf-8')).hexdigest()
    
    return RenderResponse(
        messages=rendered_content["messages"],
        hash=final_hash,
        template_id=request.id,
        version=version,
        inputs_used=request.inputs,
        applied_policies=applied_policies
    )

@router.post("/compose")
async def compose_template(
    template_id: str,
    version: str,
    inputs: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Resolve imports/slots and return materialized template"""
    
    template = db.query(Template).filter(
        Template.id == template_id,
        Template.version == version
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template version not found")
    
    composer = TemplateComposer(db)
    try:
        composed = await composer.compose(
            template_id=template_id,
            version=version,
            inputs=inputs
        )
        return composed
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Template composition failed: {str(e)}")

@router.post("/validate")
async def validate_inputs(
    template_id: str,
    version: str,
    inputs: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Validate inputs against template schema"""
    # TODO: Implement JSON Schema validation
    return {"valid": True, "errors": []}