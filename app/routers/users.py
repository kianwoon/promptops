from fastapi import APIRouter, Depends, HTTPException, Body, Request
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
from datetime import datetime

from app.database import get_db
from app.models import User, UserRole, AuthProvider
from app.auth import get_current_user
from app.schemas import UserResponse, UserCreate, UserUpdate

router = APIRouter()

@router.get("", response_model=List[UserResponse])
async def list_users(
    request: Request,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List all users"""
    users = db.query(User.id, User.email, User.name, User.role, User.organization, User.phone, User.company_size, User.avatar, User.provider, User.provider_id, User.is_verified, User.is_active, User.default_ai_provider_id, User.created_at, User.updated_at, User.last_login).offset(skip).limit(limit).all()
    return users

@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    request: Request,
    user_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get a specific user"""
    user = db.query(User.id, User.email, User.name, User.role, User.organization, User.phone, User.company_size, User.avatar, User.provider, User.provider_id, User.is_verified, User.is_active, User.default_ai_provider_id, User.created_at, User.updated_at, User.last_login).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.post("", response_model=UserResponse)
async def create_user(
    request: Request,
    user_data: UserCreate = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a new user"""
    # Check if user with email already exists
    existing_user = db.query(User.id, User.email, User.name, User.role, User.organization, User.phone, User.company_size, User.avatar, User.provider, User.provider_id, User.is_verified, User.is_active, User.default_ai_provider_id, User.created_at, User.updated_at, User.last_login).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="User with this email already exists")

    # Create new user
    new_user = User(
        id=str(uuid.uuid4()),
        email=user_data.email,
        name=user_data.name,
        role=UserRole(user_data.role),
        organization=user_data.organization,
        phone=user_data.phone,
        company_size=user_data.company_size,
        provider=AuthProvider.LOCAL if user_data.hashed_password else AuthProvider.GOOGLE,
        is_verified=False
    )

    if user_data.hashed_password:
        new_user.hashed_password = user_data.hashed_password

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user

@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    request: Request,
    user_id: str,
    user_data: UserUpdate = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update a user"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Update fields if provided
    if user_data.name is not None:
        user.name = user_data.name
    if user_data.organization is not None:
        user.organization = user_data.organization
    if user_data.phone is not None:
        user.phone = user_data.phone
    if user_data.company_size is not None:
        user.company_size = user_data.company_size
    if user_data.avatar is not None:
        user.avatar = user_data.avatar
    if user_data.role is not None:
        user.role = UserRole(user_data.role)
    if user_data.is_verified is not None:
        user.is_verified = user_data.is_verified
    if user_data.is_active is not None:
        user.is_active = user_data.is_active

    user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user)

    return user

@router.delete("/{user_id}")
async def delete_user(
    request: Request,
    user_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Delete a user"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db.delete(user)
    db.commit()

    return {"message": "User deleted successfully"}

@router.get("/email/{email}", response_model=UserResponse)
async def get_user_by_email(
    request: Request,
    email: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get a user by email"""
    user = db.query(User.id, User.email, User.name, User.role, User.organization, User.phone, User.company_size, User.avatar, User.provider, User.provider_id, User.is_verified, User.is_active, User.default_ai_provider_id, User.created_at, User.updated_at, User.last_login).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user