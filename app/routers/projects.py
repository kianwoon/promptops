from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
from datetime import datetime

from app.database import get_db
from app.models import Project, AuditLog
from app.schemas import ProjectCreate, ProjectResponse, ProjectUpdate
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

@router.get("/", response_model=List[ProjectResponse])
async def list_projects(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_mock_user)  # Using mock user for development
):
    """List all projects"""
    projects = db.query(Project).offset(skip).limit(limit).all()
    return projects

@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_mock_user)  # Using mock user for development
):
    """Get a specific project"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.post("/", response_model=ProjectResponse)
async def create_project(
    project_data: ProjectCreate = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_mock_user)  # Using mock user for development
):
    """Create a new project"""
    project_id = str(uuid.uuid4())

    # Check if project name already exists
    existing = db.query(Project).filter(Project.name == project_data.name).first()
    if existing:
        raise HTTPException(status_code=409, detail="Project with this name already exists")

    project = Project(
        id=project_id,
        name=project_data.name,
        description=project_data.description,
        owner=project_data.owner,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )

    db.add(project)
    db.commit()
    db.refresh(project)

    # Log the creation
    audit_log = AuditLog(
        id=str(uuid.uuid4()),
        actor=current_user["user_id"],
        action="create_project",
        subject=project_id,
        before_json=None,
        after_json={"name": project_data.name, "description": project_data.description}
    )
    db.add(audit_log)
    db.commit()

    return project

@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    project_update: ProjectUpdate = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_mock_user)  # Using mock user for development
):
    """Update a project"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Store original values for audit log
    before_data = {"name": project.name, "description": project.description}

    # Update fields
    update_data = project_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)

    project.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(project)

    # Log the update
    audit_log = AuditLog(
        id=str(uuid.uuid4()),
        actor=current_user["user_id"],
        action="update_project",
        subject=project_id,
        before_json=before_data,
        after_json={"name": project.name, "description": project.description}
    )
    db.add(audit_log)
    db.commit()

    return project

@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_mock_user)  # Using mock user for development
):
    """Delete a project"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Store project data for audit log
    project_data = {"name": project.name, "description": project.description}

    db.delete(project)
    db.commit()

    # Log the deletion
    audit_log = AuditLog(
        id=str(uuid.uuid4()),
        actor=current_user["user_id"],
        action="delete_project",
        subject=project_id,
        before_json=project_data,
        after_json=None
    )
    db.add(audit_log)
    db.commit()

    return {"message": "Project deleted successfully"}