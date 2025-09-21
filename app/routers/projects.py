from fastapi import APIRouter, Depends, HTTPException, Body, Request
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
import uuid
from datetime import datetime
from sqlalchemy import select, func
from sqlalchemy.orm import aliased

from app.database import get_db
from app.models import Project, AuditLog, Module, Prompt, User # Import Module and Prompt
from app.schemas import ProjectCreate, ProjectResponse, ProjectUpdate
from app.auth import get_current_user
from app.config import settings


router = APIRouter()

@router.get("", response_model=List[ProjectResponse])
async def list_projects(
    skip: int = 0,
    limit: int = 100,
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List all projects"""
    # Use the hybrid properties in the query
    projects_query = select(
        Project,
        Project.modules_count,
        Project.prompts_count
    ).options(joinedload(Project.owner_user)).offset(skip).limit(limit)

    # Execute the query and fetch results
    # The result will be a list of tuples, where each tuple contains (Project_object, modules_count, prompts_count)
    # We need to map this back to ProjectResponse schema
    results = db.execute(projects_query).all()

    # Manually construct ProjectResponse objects
    # This is necessary because ProjectResponse expects modules_count and prompts_count as direct attributes
    # and the query returns them as separate columns in a tuple.
    # Alternatively, we could use a custom serializer or a different approach if ProjectResponse
    # was designed to handle joinedload or subqueryload.
    # However, given the current setup, this is the most straightforward way.
    projects_with_counts = []
    for project_obj, modules_count, prompts_count in results:
        project_response = ProjectResponse.from_orm(project_obj)
        project_response.modules_count = modules_count
        project_response.prompts_count = prompts_count
        projects_with_counts.append(project_response)

    return projects_with_counts

@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get a specific project"""
    project = db.query(Project).options(joinedload(Project.owner_user)).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.post("", response_model=ProjectResponse)
async def create_project(
    project_data: ProjectCreate = Body(...),
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
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
        subject_type="project",
        subject_id=project_id,
        tenant_id=current_user["tenant"],
        before_json=None,
        after_json={"name": project_data.name, "description": project_data.description},
        result="success"
    )
    db.add(audit_log)
    db.commit()

    return project

@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    project_update: ProjectUpdate = Body(...),
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
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
        subject_type="project",
        subject_id=project_id,
        tenant_id=current_user["tenant"],
        before_json=before_data,
        after_json={"name": project.name, "description": project.description},
        result="success"
    )
    db.add(audit_log)
    db.commit()

    return project

@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
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
        subject_type="project",
        subject_id=project_id,
        tenant_id=current_user["tenant"],
        before_json=project_data,
        after_json=None,
        result="success"
    )
    db.add(audit_log)
    db.commit()

    return {"message": "Project deleted successfully"}