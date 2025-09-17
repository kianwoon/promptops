from fastapi import APIRouter, Depends, HTTPException, Body, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime

from app.database import get_db
from app.auth.rbac import rbac_service, get_rbac_service, Permission, UserRole
from app.schemas import UserResponse
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

@router.get("/", response_model=List[Dict[str, Any]])
async def list_roles(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    include_system: bool = Query(True),
    tenant_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_mock_user),
    rbac: get_rbac_service = Depends()
):
    """List all roles (system and custom)"""
    try:
        # Get system roles (only admin should be system)
        system_roles = []
        if include_system:
            system_roles = [
                {
                    "name": role.value,
                    "description": rbac_service.get_role_description(role),
                    "permissions": list(rbac_service.role_permissions.get(role, set())),
                    "is_system": True,
                    "is_active": True,
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
                for role in UserRole if role == UserRole.ADMIN
            ]

        # Get custom roles including default roles (editor, approver, viewer)
        custom_roles = []

        # Add default non-system roles as custom roles if they don't exist
        default_non_system_roles = [UserRole.EDITOR, UserRole.APPROVER, UserRole.VIEWER]
        existing_custom_role_names = {role.name for role in rbac_service.list_custom_roles(tenant_id)}

        for role in default_non_system_roles:
            if role.value not in existing_custom_role_names:
                custom_roles.append({
                    "name": role.value,
                    "description": rbac_service.get_role_description(role),
                    "permissions": list(rbac_service.role_permissions.get(role, set())),
                    "permission_templates": [],
                    "inherited_roles": [],
                    "inheritance_type": "none",
                    "conditions": {},
                    "is_system": False,
                    "is_active": True,
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow(),
                    "created_by": "system",
                    "tenant_id": tenant_id
                })

        # Add existing custom roles
        custom_roles.extend([
            {
                "name": role.name,
                "description": role.description,
                "permissions": list(role.permissions),
                "permission_templates": role.permission_templates,
                "inherited_roles": role.inherited_roles,
                "inheritance_type": getattr(role.inheritance_type, 'value', 'none'),
                "conditions": role.conditions,
                "is_system": False,
                "is_active": role.is_active,
                "created_at": role.created_at,
                "updated_at": role.updated_at,
                "created_by": role.created_by,
                "tenant_id": role.tenant_id
            }
            for role in rbac_service.list_custom_roles(tenant_id)
        ])

        all_roles = system_roles + custom_roles

        # Apply pagination
        if skip > 0:
            all_roles = all_roles[skip:]
        if limit > 0 and len(all_roles) > limit:
            all_roles = all_roles[:limit]

        return all_roles

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list roles: {str(e)}")

@router.post("/", response_model=Dict[str, Any])
async def create_role(
    role_data: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_mock_user),
    rbac: get_rbac_service = Depends()
):
    """Create a new custom role"""
    try:
        # Validate required fields
        if "name" not in role_data:
            raise HTTPException(status_code=400, detail="Role name is required")

        if "permissions" not in role_data:
            raise HTTPException(status_code=400, detail="Permissions are required")

        success, result = rbac_service.create_custom_role(
            role_name=role_data["name"],
            permissions=role_data["permissions"],
            description=role_data.get("description"),
            permission_templates=role_data.get("permission_templates"),
            inherited_roles=role_data.get("inherited_roles"),
            inheritance_type=role_data.get("inheritance_type"),
            conditions=role_data.get("conditions"),
            created_by=current_user["user_id"],
            tenant_id=current_user.get("tenant")
        )

        if not success:
            raise HTTPException(status_code=400, detail=str(result))

        return {
            "name": result.name,
            "description": result.description,
            "permissions": list(result.permissions),
            "permission_templates": result.permission_templates,
            "inherited_roles": result.inherited_roles,
            "inheritance_type": getattr(result.inheritance_type, 'value', 'none'),
            "conditions": result.conditions,
            "is_system": False,
            "is_active": result.is_active,
            "created_at": result.created_at,
            "updated_at": result.updated_at,
            "created_by": result.created_by,
            "tenant_id": result.tenant_id
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create role: {str(e)}")

@router.get("/{role_name}", response_model=Dict[str, Any])
async def get_role(
    role_name: str,
    current_user: dict = Depends(get_mock_user),
    rbac: get_rbac_service = Depends()
):
    """Get a specific role by name"""
    try:
        # Check if it's the admin system role
        try:
            system_role = UserRole(role_name)
            if system_role == UserRole.ADMIN:
                return {
                    "name": system_role.value,
                    "description": rbac_service.get_role_description(system_role),
                    "permissions": list(rbac_service.role_permissions.get(system_role, set())),
                    "is_system": True,
                    "is_active": True,
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
            else:
                # Other UserRole enum values are treated as custom roles
                pass
        except ValueError:
            pass

        # Check custom roles
        custom_role = rbac_service.get_custom_role(role_name)
        if custom_role:
            return {
                "name": custom_role.name,
                "description": custom_role.description,
                "permissions": list(custom_role.permissions),
                "permission_templates": custom_role.permission_templates,
                "inherited_roles": custom_role.inherited_roles,
                "inheritance_type": getattr(custom_role.inheritance_type, 'value', 'none'),
                "conditions": custom_role.conditions,
                "is_system": False,
                "is_active": custom_role.is_active,
                "created_at": custom_role.created_at,
                "updated_at": custom_role.updated_at,
                "created_by": custom_role.created_by,
                "tenant_id": custom_role.tenant_id
            }

        # Check if it's a default non-system role (editor, approver, viewer)
        try:
            default_role = UserRole(role_name)
            if default_role in [UserRole.EDITOR, UserRole.APPROVER, UserRole.VIEWER]:
                return {
                    "name": default_role.value,
                    "description": rbac_service.get_role_description(default_role),
                    "permissions": list(rbac_service.role_permissions.get(default_role, set())),
                    "permission_templates": [],
                    "inherited_roles": [],
                    "inheritance_type": "none",
                    "conditions": {},
                    "is_system": False,
                    "is_active": True,
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow(),
                    "created_by": "system",
                    "tenant_id": None
                }
        except ValueError:
            pass

        raise HTTPException(status_code=404, detail="Role not found")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get role: {str(e)}")

@router.put("/{role_name}", response_model=Dict[str, Any])
async def update_role(
    role_name: str,
    role_data: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_mock_user),
    rbac: get_rbac_service = Depends()
):
    """Update an existing custom role"""
    try:
        # Check if it's the admin system role (which cannot be modified)
        try:
            system_role = UserRole(role_name)
            if system_role == UserRole.ADMIN:
                raise HTTPException(status_code=400, detail="Cannot modify admin system role")
        except ValueError:
            pass

        # Check if it's a default role that needs to be created as custom first
        try:
            default_role = UserRole(role_name)
            if default_role in [UserRole.EDITOR, UserRole.APPROVER, UserRole.VIEWER]:
                # Create the default role as a custom role if it doesn't exist
                if role_name not in rbac_service.custom_roles:
                    success, result = rbac_service.create_custom_role(
                        role_name=role_name,
                        permissions=role_data.get("permissions", list(rbac_service.role_permissions.get(default_role, set()))),
                        description=role_data.get("description", rbac_service.get_role_description(default_role)),
                        permission_templates=role_data.get("permission_templates"),
                        inherited_roles=role_data.get("inherited_roles"),
                        inheritance_type=role_data.get("inheritance_type"),
                        conditions=role_data.get("conditions"),
                        created_by=current_user["user_id"],
                        tenant_id=current_user.get("tenant")
                    )

                    if not success:
                        raise HTTPException(status_code=400, detail=str(result))

                    return {
                        "name": result.name,
                        "description": result.description,
                        "permissions": list(result.permissions),
                        "permission_templates": result.permission_templates,
                        "inherited_roles": result.inherited_roles,
                        "inheritance_type": getattr(result.inheritance_type, 'value', 'none'),
                        "conditions": result.conditions,
                        "is_system": False,
                        "is_active": result.is_active,
                        "created_at": result.created_at,
                        "updated_at": result.updated_at,
                        "created_by": result.created_by,
                        "tenant_id": result.tenant_id
                    }
        except ValueError:
            pass

        # For existing custom roles, update the role
        success, result = rbac_service.update_custom_role(
            role_name=role_name,
            permissions=role_data.get("permissions"),
            description=role_data.get("description"),
            permission_templates=role_data.get("permission_templates"),
            inherited_roles=role_data.get("inherited_roles"),
            inheritance_type=role_data.get("inheritance_type"),
            conditions=role_data.get("conditions"),
            updated_by=current_user["user_id"]
        )

        if not success:
            raise HTTPException(status_code=400, detail=str(result))

        return {
            "name": result.name,
            "description": result.description,
            "permissions": list(result.permissions),
            "permission_templates": result.permission_templates,
            "inherited_roles": result.inherited_roles,
            "inheritance_type": getattr(result.inheritance_type, 'value', 'none'),
            "conditions": result.conditions,
            "is_system": False,
            "is_active": result.is_active,
            "created_at": result.created_at,
            "updated_at": result.updated_at,
            "created_by": result.created_by,
            "tenant_id": result.tenant_id
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update role: {str(e)}")

@router.delete("/{role_name}")
async def delete_role(
    role_name: str,
    current_user: dict = Depends(get_mock_user),
    rbac: get_rbac_service = Depends()
):
    """Delete a custom role"""
    try:
        # Check if it's the admin system role (which cannot be deleted)
        try:
            system_role = UserRole(role_name)
            if system_role == UserRole.ADMIN:
                raise HTTPException(status_code=400, detail="Cannot delete admin system role")
        except ValueError:
            pass

        # Check if it's a default role that exists as a custom role
        try:
            default_role = UserRole(role_name)
            if default_role in [UserRole.EDITOR, UserRole.APPROVER, UserRole.VIEWER]:
                # Only allow deletion if it exists as a custom role
                if role_name in rbac_service.custom_roles:
                    success, message = rbac_service.delete_custom_role(
                        role_name=role_name,
                        deleted_by=current_user["user_id"]
                    )

                    if not success:
                        raise HTTPException(status_code=400, detail=message)

                    return {"message": message}
                else:
                    raise HTTPException(status_code=404, detail=f"Role '{role_name}' not found or is a default role")
        except ValueError:
            pass

        # For regular custom roles
        success, message = rbac_service.delete_custom_role(
            role_name=role_name,
            deleted_by=current_user["user_id"]
        )

        if not success:
            raise HTTPException(status_code=400, detail=message)

        return {"message": message}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete role: {str(e)}")

@router.get("/{role_name}/permissions", response_model=List[str])
async def get_role_permissions(
    role_name: str,
    current_user: dict = Depends(get_mock_user),
    rbac: get_rbac_service = Depends()
):
    """Get all permissions for a specific role"""
    try:
        # Check system roles (only admin)
        try:
            system_role = UserRole(role_name)
            if system_role == UserRole.ADMIN:
                permissions = list(rbac_service.role_permissions.get(system_role, set()))
                return permissions
            else:
                # Other UserRole enum values are treated as custom roles
                pass
        except ValueError:
            pass

        # Check custom roles
        custom_role = rbac_service.get_custom_role(role_name)
        if custom_role:
            return list(custom_role.permissions)

        # Check if it's a default non-system role (editor, approver, viewer)
        try:
            default_role = UserRole(role_name)
            if default_role in [UserRole.EDITOR, UserRole.APPROVER, UserRole.VIEWER]:
                permissions = list(rbac_service.role_permissions.get(default_role, set()))
                return permissions
        except ValueError:
            pass

        raise HTTPException(status_code=404, detail="Role not found")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get role permissions: {str(e)}")

@router.post("/{role_name}/permissions")
async def assign_permissions_to_role(
    role_name: str,
    permissions_data: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_mock_user),
    rbac: get_rbac_service = Depends()
):
    """Assign permissions to a role"""
    try:
        if "permissions" not in permissions_data:
            raise HTTPException(status_code=400, detail="Permissions are required")

        # Check if it's the admin system role (which cannot be modified)
        try:
            system_role = UserRole(role_name)
            if system_role == UserRole.ADMIN:
                raise HTTPException(status_code=400, detail="Cannot modify permissions for admin system role")
        except ValueError:
            pass

        # Check if it's a default role that needs to be created as custom first
        try:
            default_role = UserRole(role_name)
            if default_role in [UserRole.EDITOR, UserRole.APPROVER, UserRole.VIEWER]:
                # Create the default role as a custom role if it doesn't exist
                if role_name not in rbac_service.custom_roles:
                    success, result = rbac_service.create_custom_role(
                        role_name=role_name,
                        permissions=permissions_data["permissions"],
                        description=rbac_service.get_role_description(default_role),
                        created_by=current_user["user_id"],
                        tenant_id=current_user.get("tenant")
                    )

                    if not success:
                        raise HTTPException(status_code=400, detail=str(result))

                    return {"message": f"Role '{role_name}' created and permissions updated"}
        except ValueError:
            pass

        # For existing custom roles, update the role
        if role_name in rbac_service.custom_roles:
            success, result = rbac_service.update_custom_role(
                role_name=role_name,
                permissions=permissions_data["permissions"],
                updated_by=current_user["user_id"]
            )

            if not success:
                raise HTTPException(status_code=400, detail=str(result))

            return {"message": f"Permissions updated for role '{role_name}'"}
        else:
            raise HTTPException(status_code=400, detail="Role not found")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to assign permissions: {str(e)}")

@router.get("/templates/", response_model=List[Dict[str, Any]])
async def list_permission_templates(
    category: Optional[str] = Query(None),
    tenant_id: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    is_system: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: dict = Depends(get_mock_user),
    rbac: get_rbac_service = Depends()
):
    """List permission templates"""
    try:
        templates = rbac_service.list_permission_templates(
            category=category,
            tenant_id=tenant_id,
            is_active=is_active,
            is_system=is_system,
            search=search,
            skip=skip,
            limit=limit
        )

        return [
            {
                "id": template.id,
                "name": template.name,
                "description": template.description,
                "permissions": template.permissions,
                "category": template.category,
                "is_system": template.is_system,
                "is_active": template.is_active,
                "created_at": template.created_at,
                "updated_at": template.updated_at,
                "created_by": template.created_by,
                "tenant_id": template.tenant_id
            }
            for template in templates
        ]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list permission templates: {str(e)}")

@router.post("/templates/", response_model=Dict[str, Any])
async def create_permission_template(
    template_data: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_mock_user),
    rbac: get_rbac_service = Depends()
):
    """Create a permission template"""
    try:
        if "name" not in template_data:
            raise HTTPException(status_code=400, detail="Template name is required")

        if "permissions" not in template_data:
            raise HTTPException(status_code=400, detail="Permissions are required")

        success, result = rbac_service.create_permission_template(
            name=template_data["name"],
            permissions=template_data["permissions"],
            description=template_data.get("description"),
            category=template_data.get("category", "custom"),
            created_by=current_user["user_id"],
            tenant_id=current_user.get("tenant")
        )

        if not success:
            raise HTTPException(status_code=400, detail=str(result))

        return {
            "id": result.id,
            "name": result.name,
            "description": result.description,
            "permissions": result.permissions,
            "category": result.category,
            "is_system": result.is_system,
            "is_active": result.is_active,
            "created_at": result.created_at,
            "updated_at": result.updated_at,
            "created_by": result.created_by,
            "tenant_id": result.tenant_id
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create permission template: {str(e)}")

@router.post("/{role_name}/templates/{template_id}")
async def apply_permission_template_to_role(
    role_name: str,
    template_id: str,
    current_user: dict = Depends(get_mock_user),
    rbac: get_rbac_service = Depends()
):
    """Apply a permission template to a role"""
    try:
        success, message = rbac_service.apply_permission_template(
            role_name=role_name,
            template_id=template_id
        )

        if not success:
            raise HTTPException(status_code=400, detail=message)

        return {"message": message}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to apply permission template: {str(e)}")

@router.get("/available-permissions/", response_model=List[Dict[str, str]])
async def get_available_permissions(
    current_user: dict = Depends(get_mock_user),
    rbac: get_rbac_service = Depends()
):
    """Get all available permissions with descriptions"""
    try:
        return [
            {
                "name": permission.value,
                "description": rbac_service.get_permission_description(permission)
            }
            for permission in Permission
        ]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get available permissions: {str(e)}")