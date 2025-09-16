from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
from datetime import datetime

from app.database import get_db
from app.models import Module, Project, AuditLog, Prompt
from app.schemas import ModuleCreate, ModuleResponse, ModuleUpdate
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


@router.get("/", response_model=List[ModuleResponse])
async def list_modules(
    project_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_mock_user)  # Using mock user for development
):
    """List all modules, optionally filtered by project"""
    try:
        query = db.query(Module)
        if project_id:
            query = query.filter(Module.project_id == project_id)

        modules = query.offset(skip).limit(limit).all()
        return modules
    except Exception as e:
        print(f"Error in list_modules: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{module_id}", response_model=List[ModuleResponse])
async def get_module_versions(
    module_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_mock_user)  # Using mock user for development
):
    """Get all versions of a module"""
    modules = db.query(Module).filter(Module.id == module_id).all()
    if not modules:
        raise HTTPException(status_code=404, detail="Module not found")
    return modules

@router.get("/{module_id}/{version}", response_model=ModuleResponse)
async def get_module_version(
    module_id: str,
    version: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_mock_user)  # Using mock user for development
):
    """Get specific version of a module"""
    module = db.query(Module).filter(
        Module.id == module_id,
        Module.version == version
    ).first()

    if not module:
        raise HTTPException(status_code=404, detail="Module version not found")

    return module

@router.post("/", response_model=ModuleResponse)
async def create_module(
    module_data: ModuleCreate = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_mock_user)  # Using mock user for development
):
    """Create a new module version"""
    try:
        # Verify project exists
        project = db.query(Project).filter(Project.id == module_data.project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # Check if module ID already exists and auto-generate a unique one if needed
        existing_module = db.query(Module).filter(Module.id == module_data.id).first()
        if existing_module:
            # Append timestamp to create unique ID
            final_id = f"{module_data.id}-{datetime.utcnow().strftime('%H%M%S')}"
        else:
            final_id = module_data.id

        final_version = module_data.version

        module = Module(
            id=final_id,
            version=final_version,
            project_id=module_data.project_id,
            slot=module_data.slot,
            render_body=module_data.render_body,
            metadata_json=module_data.metadata,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        db.add(module)
        db.commit()
        db.refresh(module)

        # TODO: Fix audit log - skipping for now
        # audit_log = AuditLog(
        #     id=str(uuid.uuid4()),
        #     actor=current_user["user_id"],
        #     action="create_module",
        #     subject=f"{final_id}@{final_version}",
        #     before_json=None,
        #     after_json={"slot": module_data.slot, "project_id": module_data.project_id}
        # )
        # db.add(audit_log)
        # db.commit()

        return module
    except Exception as e:
        print(f"Error in create_module: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{module_id}/{version}", response_model=ModuleResponse)
async def update_module(
    module_id: str,
    version: str,
    module_update: ModuleUpdate = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_mock_user)  # Using mock user for development
):
    """Update a module version"""
    module = db.query(Module).filter(
        Module.id == module_id,
        Module.version == version
    ).first()

    if not module:
        raise HTTPException(status_code=404, detail="Module version not found")

    # Store original values for audit log
    before_data = {"slot": module.slot, "render_body": module.render_body}

    # Update fields
    update_data = module_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(module, field, value)

    module.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(module)

    # Log the update
    audit_log = AuditLog(
        id=str(uuid.uuid4()),
        actor=current_user["user_id"],
        action="update_module",
        subject=f"{module_id}@{version}",
        subject_type="module",
        subject_id=module_id,
        tenant_id=current_user.get("tenant", "default"),
        before_json=before_data,
        after_json={"slot": module.slot, "render_body": module.render_body},
        result="success"
    )
    db.add(audit_log)
    db.commit()

    return module

@router.delete("/{module_id}/{version}")
async def delete_module(
    module_id: str,
    version: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_mock_user)  # Using mock user for development
):
    """Delete a module version - only allowed if module has no prompts"""
    module = db.query(Module).filter(
        Module.id == module_id,
        Module.version == version
    ).first()

    if not module:
        raise HTTPException(status_code=404, detail="Module version not found")

    # Check if this module has any prompts
    prompt_count = db.query(Prompt).filter(Prompt.module_id == module_id).count()

    if prompt_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete module '{module.slot}' - it has {prompt_count} prompt(s). Remove all prompts first."
        )

    # Store module data for audit log
    module_data = {"slot": module.slot, "project_id": module.project_id}

    db.delete(module)
    db.commit()

    # Log the deletion
    audit_log = AuditLog(
        id=str(uuid.uuid4()),
        actor=current_user["user_id"],
        action="delete_module",
        subject=f"{module_id}@{version}",
        subject_type="module",
        subject_id=module_id,
        tenant_id=current_user.get("tenant", "default"),
        before_json=module_data,
        after_json=None,
        result="success"
    )
    db.add(audit_log)
    db.commit()

    return {"message": "Module version deleted successfully"}