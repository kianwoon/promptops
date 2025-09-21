from typing import List, Dict, Any, Set, Optional, Tuple, Union
from enum import Enum
import structlog
import json
from datetime import datetime, timedelta
import uuid
from dataclasses import dataclass
from collections import defaultdict

logger = structlog.get_logger()

class UserRole(Enum):
    ADMIN = "admin"
    EDITOR = "editor"
    APPROVER = "approver"
    VIEWER = "viewer"
    USER = "user"

class ResourceType(Enum):
    PROJECT = "project"
    MODULE = "module"
    PROMPT = "prompt"
    TEMPLATE = "template"
    POLICY = "policy"
    SYSTEM = "system"
    USER = "user"
    ROLE = "role"
    PERMISSION_TEMPLATE = "permission_template"
    WORKFLOW = "workflow"
    COMPLIANCE_REPORT = "compliance_report"
    AUDIT_LOG = "audit_log"
    API_KEY = "api_key"
    TENANT = "tenant"

class PermissionType(Enum):
    SYSTEM = "system"
    CUSTOM = "custom"
    TEMPLATE = "template"

class InheritanceType(Enum):
    NONE = "none"
    PARENT = "parent"
    CHILDREN = "children"
    BOTH = "both"

class AccessReviewStatus(Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    EXPIRED = "expired"
    CANCELLED = "cancelled"

class AccessReviewType(Enum):
    PERIODIC = "periodic"
    EVENT_BASED = "event_based"
    USER_DRIVEN = "user_driven"

class Permission(Enum):
    # Project permissions
    CREATE_PROJECT = "create_project"
    READ_PROJECT = "read_project"
    UPDATE_PROJECT = "update_project"
    DELETE_PROJECT = "delete_project"
    MANAGE_PROJECT_MEMBERS = "manage_project_members"
    MANAGE_PROJECT_SETTINGS = "manage_project_settings"

    # Module permissions
    CREATE_MODULE = "create_module"
    READ_MODULE = "read_module"
    UPDATE_MODULE = "update_module"
    DELETE_MODULE = "delete_module"
    MANAGE_MODULE_SETTINGS = "manage_module_settings"

    # Prompt permissions
    CREATE_PROMPT = "create_prompt"
    READ_PROMPT = "read_prompt"
    UPDATE_PROMPT = "update_prompt"
    DELETE_PROMPT = "delete_prompt"
    SUBMIT_PROMPT_FOR_APPROVAL = "submit_prompt_for_approval"
    APPROVE_PROMPT = "approve_prompt"
    REJECT_PROMPT = "reject_prompt"
    PUBLISH_PROMPT = "publish_prompt"
    MANAGE_PROMPT_VERSIONS = "manage_prompt_versions"

    # Template permissions
    CREATE_TEMPLATE = "create_template"
    READ_TEMPLATE = "read_template"
    UPDATE_TEMPLATE = "update_template"
    DELETE_TEMPLATE = "delete_template"
    MANAGE_TEMPLATE_VERSIONS = "manage_template_versions"
    PUBLISH_TEMPLATE = "publish_template"

    # Policy permissions
    CREATE_POLICY = "create_policy"
    READ_POLICY = "read_policy"
    UPDATE_POLICY = "update_policy"
    DELETE_POLICY = "delete_policy"
    EVALUATE_POLICY = "evaluate_policy"
    MANAGE_POLICY_RULES = "manage_policy_rules"

    # System permissions
    MANAGE_USERS = "manage_users"
    MANAGE_ROLES = "manage_roles"
    MANAGE_PERMISSIONS = "manage_permissions"
    VIEW_AUDIT_LOGS = "view_audit_logs"
    SYSTEM_CONFIG = "system_config"
    MANAGE_TENANTS = "manage_tenants"
    MANAGE_API_KEYS = "manage_api_keys"
    VIEW_ANALYTICS = "view_analytics"
    MANAGE_WORKFLOWS = "manage_workflows"
    MANAGE_COMPLIANCE = "manage_compliance"
    SECURITY_ADMIN = "security_admin"
    GOVERNANCE_ADMIN = "governance_admin"

    # Access review permissions
    INITIATE_ACCESS_REVIEW = "initiate_access_review"
    PERFORM_ACCESS_REVIEW = "perform_access_review"
    APPROVE_ACCESS_CHANGES = "approve_access_changes"
    VIEW_ACCESS_REPORTS = "view_access_reports"

    # Template management
    CREATE_PERMISSION_TEMPLATE = "create_permission_template"
    READ_PERMISSION_TEMPLATE = "read_permission_template"
    UPDATE_PERMISSION_TEMPLATE = "update_permission_template"
    DELETE_PERMISSION_TEMPLATE = "delete_permission_template"
    APPLY_PERMISSION_TEMPLATE = "apply_permission_template"

    # Bulk operations
    BULK_ASSIGN_ROLES = "bulk_assign_roles"
    BULK_UPDATE_PERMISSIONS = "bulk_update_permissions"
    BULK_REMOVE_ROLES = "bulk_remove_roles"

    # Role inheritance
    MANAGE_ROLE_INHERITANCE = "manage_role_inheritance"
    VIEW_ROLE_HIERARCHY = "view_role_hierarchy"
    CREATE_INHERITED_ROLE = "create_inherited_role"

    # Resource-specific permissions
    OWN_RESOURCE = "own_resource"
    TENANT_RESOURCE = "tenant_resource"
    SHARED_RESOURCE = "shared_resource"
    PUBLIC_RESOURCE = "public_resource"

    # Conditional permissions
    TIME_BASED_ACCESS = "time_based_access"
    LOCATION_BASED_ACCESS = "location_based_access"
    DEVICE_BASED_ACCESS = "device_based_access"
    APPROVAL_BASED_ACCESS = "approval_based_access"

@dataclass
class CustomRole:
    """Custom role definition"""
    name: str
    description: Optional[str] = None
    permissions: Set[str] = None
    permission_templates: List[str] = None
    inherited_roles: List[str] = None
    inheritance_type: InheritanceType = InheritanceType.NONE
    conditions: Dict[str, Any] = None
    is_active: bool = True
    created_at: datetime = None
    created_by: str = None
    updated_at: datetime = None
    updated_by: str = None
    tenant_id: str = None

    def __post_init__(self):
        if self.permissions is None:
            self.permissions = set()
        if self.permission_templates is None:
            self.permission_templates = []
        if self.inherited_roles is None:
            self.inherited_roles = []
        if self.conditions is None:
            self.conditions = {}
        if self.created_at is None:
            self.created_at = datetime.utcnow()
        if self.updated_at is None:
            self.updated_at = datetime.utcnow()

@dataclass
class PermissionTemplate:
    """Permission template definition"""
    id: str
    name: str
    description: Optional[str] = None
    permissions: List[Dict[str, Any]] = None
    category: str = "custom"
    is_system: bool = False
    is_active: bool = True
    created_at: datetime = None
    created_by: str = None
    updated_at: datetime = None
    updated_by: str = None
    tenant_id: str = None

    def __post_init__(self):
        if self.permissions is None:
            self.permissions = []
        if self.created_at is None:
            self.created_at = datetime.utcnow()
        if self.updated_at is None:
            self.updated_at = datetime.utcnow()

@dataclass
class RoleInheritance:
    """Role inheritance relationship"""
    parent_role: str
    child_role: str
    inheritance_type: InheritanceType
    conditions: Dict[str, Any] = None
    is_active: bool = True
    created_at: datetime = None
    created_by: str = None
    tenant_id: str = None

    def __post_init__(self):
        if self.conditions is None:
            self.conditions = {}
        if self.created_at is None:
            self.created_at = datetime.utcnow()

@dataclass
class ResourceSpecificPermission:
    """Resource-specific permission with conditions"""
    role_name: str
    resource_type: str
    resource_id: str
    action: str
    conditions: Dict[str, Any] = None
    expires_at: Optional[datetime] = None
    is_active: bool = True
    created_at: datetime = None
    created_by: str = None
    tenant_id: str = None

    def __post_init__(self):
        if self.conditions is None:
            self.conditions = {}
        if self.created_at is None:
            self.created_at = datetime.utcnow()

@dataclass
class AccessReview:
    """Access review workflow"""
    id: str
    title: str
    review_type: str  # "periodic", "event_based", "user_driven"
    description: Optional[str] = None
    scope: Dict[str, Any] = None  # Resources and users to review
    reviewers: List[str] = None  # User IDs of reviewers
    status: str = "pending"  # "pending", "in_progress", "completed", "expired"
    due_date: Optional[datetime] = None
    findings: List[Dict[str, Any]] = None
    recommendations: List[Dict[str, Any]] = None
    created_at: Optional[datetime] = None
    created_by: Optional[str] = None
    completed_at: Optional[datetime] = None
    tenant_id: Optional[str] = None

    def __post_init__(self):
        if self.findings is None:
            self.findings = []
        if self.recommendations is None:
            self.recommendations = []
        if self.created_at is None:
            self.created_at = datetime.utcnow()

class RBACService:
    """Role-Based Access Control service for PromptOps"""

    def __init__(self):
        # Define role-permission mappings
        self.role_permissions = {
            UserRole.ADMIN: {
                # Admin has all permissions
                permission.value for permission in Permission
            },
            UserRole.EDITOR: {
                # Project permissions
                Permission.CREATE_PROJECT.value,
                Permission.READ_PROJECT.value,
                Permission.UPDATE_PROJECT.value,
                Permission.MANAGE_PROJECT_MEMBERS.value,

                # Module permissions
                Permission.CREATE_MODULE.value,
                Permission.READ_MODULE.value,
                Permission.UPDATE_MODULE.value,

                # Prompt permissions
                Permission.CREATE_PROMPT.value,
                Permission.READ_PROMPT.value,
                Permission.UPDATE_PROMPT.value,
                Permission.SUBMIT_PROMPT_FOR_APPROVAL.value,

                # Template permissions
                Permission.CREATE_TEMPLATE.value,
                Permission.READ_TEMPLATE.value,
                Permission.UPDATE_TEMPLATE.value,

                # Policy permissions (read-only)
                Permission.READ_POLICY.value,
                Permission.EVALUATE_POLICY.value,

                # Role visibility
                Permission.VIEW_ROLE_HIERARCHY.value,
            },
            UserRole.APPROVER: {
                # Read permissions for all resources
                Permission.READ_PROJECT.value,
                Permission.READ_MODULE.value,
                Permission.READ_PROMPT.value,
                Permission.READ_TEMPLATE.value,
                Permission.READ_POLICY.value,

                # Approval-specific permissions
                Permission.APPROVE_PROMPT.value,
                Permission.REJECT_PROMPT.value,
                Permission.VIEW_AUDIT_LOGS.value,

                # Policy permissions
                Permission.EVALUATE_POLICY.value,

                # Role visibility
                Permission.VIEW_ROLE_HIERARCHY.value,
            },
            UserRole.VIEWER: {
                # Read-only permissions
                Permission.READ_PROJECT.value,
                Permission.READ_MODULE.value,
                Permission.READ_PROMPT.value,
                Permission.READ_TEMPLATE.value,
                Permission.READ_POLICY.value,

                # Role visibility
                Permission.VIEW_ROLE_HIERARCHY.value,
            },
            UserRole.USER: {
                # Basic user permissions (same as viewer for now)
                Permission.READ_PROJECT.value,
                Permission.READ_MODULE.value,
                Permission.READ_PROMPT.value,
                Permission.READ_TEMPLATE.value,
                Permission.READ_POLICY.value,

                # Role visibility
                Permission.VIEW_ROLE_HIERARCHY.value,
            },
        }

        # Define resource hierarchy
        self.resource_hierarchy = {
            ResourceType.PROJECT: [ResourceType.MODULE],
            ResourceType.MODULE: [ResourceType.PROMPT],
            ResourceType.PROMPT: [],
            ResourceType.TEMPLATE: [],
            ResourceType.POLICY: [],
            ResourceType.SYSTEM: [ResourceType.PROJECT, ResourceType.MODULE, ResourceType.PROMPT, ResourceType.TEMPLATE, ResourceType.POLICY]
        }

        # Custom roles storage (in-memory for now, would be database in production)
        self.custom_roles: Dict[str, CustomRole] = {}

        # Permission templates storage
        self.permission_templates: Dict[str, PermissionTemplate] = {}

        # Role inheritance relationships
        self.role_inheritance: List[RoleInheritance] = []

        # Resource-specific permissions
        self.resource_specific_permissions: List[ResourceSpecificPermission] = []

        # Access reviews
        self.access_reviews: Dict[str, AccessReview] = {}

        # Permission conditions registry
        self.permission_conditions = {
            "time_based": self._check_time_based_condition,
            "location_based": self._check_location_based_condition,
            "device_based": self._check_device_based_condition,
            "approval_based": self._check_approval_based_condition,
            "owner_only": self._check_owner_condition,
            "tenant_only": self._check_tenant_condition,
        }

        # Initialize system permission templates
        self._initialize_system_templates()

    def can_perform_action(
        self,
        user_roles: List[str],
        action: str,
        resource_type: str,
        resource_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Check if user can perform action on resource
        """
        try:
            # Convert role strings to enums with case-insensitive matching
            user_role_enums = []
            for role in user_roles:
                try:
                    # Try direct conversion first
                    user_role_enums.append(UserRole(role))
                except ValueError:
                    # Try case-insensitive matching
                    try:
                        normalized_role = role.lower() if role else role
                        user_role_enums.append(UserRole(normalized_role))
                    except ValueError:
                        logger.warning("Invalid user role", role=role)
                        continue

            if not user_role_enums:
                return False

            # Check if any role has the required permission
            for role in user_role_enums:
                if self._role_has_permission(role, action):
                    # Check resource-specific permissions
                    if resource_id:
                        return self._check_resource_permission(
                            role, action, resource_type, resource_id, context
                        )
                    return True

            return False

        except Exception as e:
            logger.error(f"RBAC check failed: {str(e)}", action=action, resource_type=resource_type)
            return False

    def _role_has_permission(self, role: UserRole, action: str) -> bool:
        """Check if role has the specified permission"""
        role_permissions = self.role_permissions.get(role, set())
        return action in role_permissions

    def _check_resource_permission(
        self,
        role: UserRole,
        action: str,
        resource_type: str,
        resource_id: str,
        context: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Check resource-specific permissions
        This would typically involve checking database for resource ownership
        """
        # For now, we'll implement basic checks
        # In a real implementation, this would query the database

        # Admin can do anything
        if role == UserRole.ADMIN:
            return True

        # For editors, check if they own the resource or are project members
        if role in [UserRole.EDITOR, UserRole.APPROVER]:
            # This would normally check ownership in database
            # For now, we'll allow access
            return True

        # Viewers can only read
        if role == UserRole.EDITOR and action.startswith("read_"):
            return True

        return False

    def get_user_permissions(self, user_roles: List[str]) -> Set[str]:
        """Get all permissions for a user based on their roles"""
        permissions = set()

        for role_str in user_roles:
            try:
                # Try direct conversion first
                role = UserRole(role_str)
                role_permissions = self.role_permissions.get(role, set())
                permissions.update(role_permissions)
            except ValueError:
                # Try case-insensitive matching
                try:
                    normalized_role = role_str.lower() if role_str else role_str
                    role = UserRole(normalized_role)
                    role_permissions = self.role_permissions.get(role, set())
                    permissions.update(role_permissions)
                except ValueError:
                    continue

        return permissions

    def get_accessible_resources(
        self,
        user_roles: List[str],
        resource_type: ResourceType,
        action: str
    ) -> List[str]:
        """
        Get list of resource IDs that user can access with given action
        """
        # This would typically query the database based on user roles and permissions
        # For now, return empty list
        return []

    def check_project_membership(
        self,
        user_id: str,
        project_id: str,
        required_role: Optional[UserRole] = None
    ) -> bool:
        """
        Check if user is a member of a project with optional role requirement
        """
        # This would query project_members table
        # For now, return True for demonstration
        return True

    def is_resource_owner(self, user_id: str, resource_type: str, resource_id: str) -> bool:
        """
        Check if user owns a specific resource
        """
        # This would query the respective table
        # For now, return False
        return False

    def get_effective_permissions(
        self,
        user_id: str,
        resource_type: str,
        resource_id: str
    ) -> Dict[str, bool]:
        """
        Get all effective permissions for a user on a specific resource
        """
        # This would check user roles, project membership, and resource ownership
        # For now, return empty dict
        return {}

    def create_role(
        self,
        role_name: str,
        permissions: List[str],
        description: Optional[str] = None
    ) -> bool:
        """
        Create a custom role (admin only)
        """
        # This would add to roles and role_permissions tables
        # For now, return False
        return False

    def assign_role_to_user(
        self,
        user_id: str,
        role: UserRole,
        resource_id: Optional[str] = None,
        resource_type: Optional[ResourceType] = None
    ) -> bool:
        """
        Assign role to user, optionally scoped to a resource
        """
        # This would add to user_roles table
        # For now, return True
        return True

    def remove_role_from_user(
        self,
        user_id: str,
        role: UserRole,
        resource_id: Optional[str] = None
    ) -> bool:
        """
        Remove role from user
        """
        # This would remove from user_roles table
        # For now, return True
        return True

    def get_user_roles_for_resource(
        self,
        user_id: str,
        resource_type: str,
        resource_id: str
    ) -> List[UserRole]:
        """
        Get all roles a user has for a specific resource
        """
        # This would query user_roles table
        # For now, return empty list
        return []

    def check_permission_hierarchy(
        self,
        user_roles: List[str],
        action: str,
        resource_type: ResourceType,
        resource_id: str
    ) -> bool:
        """
        Check permissions considering resource hierarchy
        """
        # Check direct permission first
        if self.can_perform_action(user_roles, action, resource_type.value, resource_id):
            return True

        # Check parent resource permissions
        parent_types = self._get_parent_resource_types(resource_type)
        for parent_type in parent_types:
            # This would need to get parent resource IDs from database
            # For now, skip hierarchical checks
            pass

        return False

    def _get_parent_resource_types(self, resource_type: ResourceType) -> List[ResourceType]:
        """Get parent resource types for hierarchy checks"""
        parents = []
        for parent, children in self.resource_hierarchy.items():
            if resource_type in children:
                parents.append(parent)
        return parents

    def validate_permission_combination(
        self,
        permissions: List[str]
    ) -> Tuple[bool, List[str]]:
        """
        Validate if a combination of permissions is valid
        Returns (is_valid, list_of_issues)
        """
        issues = []

        # Check for conflicting permissions
        if Permission.APPROVE_PROMPT.value in permissions and Permission.CREATE_PROMPT.value in permissions:
            # This is actually valid in some cases
            pass

        # Check for dependent permissions
        if Permission.UPDATE_PROJECT.value in permissions and Permission.READ_PROJECT.value not in permissions:
            issues.append("UPDATE_PROJECT requires READ_PROJECT permission")

        if Permission.UPDATE_MODULE.value in permissions and Permission.READ_MODULE.value not in permissions:
            issues.append("UPDATE_MODULE requires READ_MODULE permission")

        if Permission.UPDATE_PROMPT.value in permissions and Permission.READ_PROMPT.value not in permissions:
            issues.append("UPDATE_PROMPT requires READ_PROMPT permission")

        return len(issues) == 0, issues

    def get_role_description(self, role: UserRole) -> str:
        """Get description of what a role can do"""
        descriptions = {
            UserRole.ADMIN: "Full system access with all permissions",
            UserRole.EDITOR: "Can create and manage projects, modules, and prompts",
            UserRole.APPROVER: "Can review and approve prompts, view audit logs",
            UserRole.VIEWER: "Read-only access to all resources",
            UserRole.USER: "Basic user with read-only access to resources"
        }
        return descriptions.get(role, "Unknown role")

    def get_permission_description(self, permission: Permission) -> str:
        """Get description of what a permission allows"""
        descriptions = {
            Permission.CREATE_PROJECT: "Create new projects",
            Permission.READ_PROJECT: "View project details and contents",
            Permission.UPDATE_PROJECT: "Modify project settings and configuration",
            Permission.DELETE_PROJECT: "Remove projects and all associated data",
            Permission.CREATE_PROMPT: "Create new prompts within modules",
            Permission.READ_PROMPT: "View prompt content and metadata",
            Permission.UPDATE_PROMPT: "Edit prompt content and settings",
            Permission.SUBMIT_PROMPT_FOR_APPROVAL: "Submit prompts for approval workflow",
            Permission.APPROVE_PROMPT: "Approve prompts for publication",
            Permission.REJECT_PROMPT: "Reject prompts with feedback",
            Permission.VIEW_AUDIT_LOGS: "Access system audit logs and activity history",
        }
        return descriptions.get(permission, "Unknown permission")

    # ========== CUSTOM ROLE MANAGEMENT ==========

    def create_custom_role(
        self,
        role_name: str,
        permissions: List[str],
        description: Optional[str] = None,
        permission_templates: Optional[List[str]] = None,
        inherited_roles: Optional[List[str]] = None,
        inheritance_type: InheritanceType = InheritanceType.NONE,
        conditions: Optional[Dict[str, Any]] = None,
        created_by: str = None,
        tenant_id: str = None
    ) -> Tuple[bool, Union[CustomRole, str]]:
        """Create a custom role with enhanced permissions"""
        try:
            # Validate role name
            if not role_name or len(role_name.strip()) == 0:
                return False, "Role name cannot be empty"

            # Check if role already exists
            if role_name in self.custom_roles:
                return False, f"Role '{role_name}' already exists"

            # Only prevent creating custom roles for the admin system role
            if role_name.upper() == UserRole.ADMIN.value:
                return False, f"Cannot create custom role for admin system role"

            # Validate permissions
            valid_permissions = {p.value for p in Permission}
            invalid_permissions = set(permissions) - valid_permissions
            if invalid_permissions:
                return False, f"Invalid permissions: {', '.join(invalid_permissions)}"

            # Validate permission templates
            if permission_templates:
                invalid_templates = set(permission_templates) - set(self.permission_templates.keys())
                if invalid_templates:
                    return False, f"Invalid permission templates: {', '.join(invalid_templates)}"

            # Create custom role
            custom_role = CustomRole(
                name=role_name,
                description=description,
                permissions=set(permissions),
                permission_templates=permission_templates or [],
                inherited_roles=inherited_roles or [],
                inheritance_type=inheritance_type,
                conditions=conditions or {},
                created_by=created_by,
                tenant_id=tenant_id
            )

            # Apply permission templates
            for template_id in custom_role.permission_templates:
                template = self.permission_templates.get(template_id)
                if template:
                    for perm_config in template.permissions:
                        if perm_config.get("action"):
                            custom_role.permissions.add(perm_config["action"])

            # Apply inherited roles
            for inherited_role in custom_role.inherited_roles:
                inherited_permissions = self._get_inherited_permissions(inherited_role)
                custom_role.permissions.update(inherited_permissions)

            # Store the role
            self.custom_roles[role_name] = custom_role
            logger.info("Created custom role", role=role_name, permissions_count=len(custom_role.permissions))

            return True, custom_role

        except Exception as e:
            logger.error(f"Failed to create custom role: {str(e)}", role=role_name)
            return False, f"Failed to create custom role: {str(e)}"

    def update_custom_role(
        self,
        role_name: str,
        permissions: Optional[List[str]] = None,
        description: Optional[str] = None,
        permission_templates: Optional[List[str]] = None,
        inherited_roles: Optional[List[str]] = None,
        inheritance_type: Optional[InheritanceType] = None,
        conditions: Optional[Dict[str, Any]] = None,
        updated_by: str = None
    ) -> Tuple[bool, Union[CustomRole, str]]:
        """Update an existing custom role"""
        try:
            if role_name not in self.custom_roles:
                return False, f"Role '{role_name}' not found"

            role = self.custom_roles[role_name]

            # Update permissions if provided
            if permissions is not None:
                valid_permissions = {p.value for p in Permission}
                invalid_permissions = set(permissions) - valid_permissions
                if invalid_permissions:
                    return False, f"Invalid permissions: {', '.join(invalid_permissions)}"
                role.permissions = set(permissions)

            # Update other fields
            if description is not None:
                role.description = description
            if permission_templates is not None:
                role.permission_templates = permission_templates
            if inherited_roles is not None:
                role.inherited_roles = inherited_roles
            if inheritance_type is not None:
                role.inheritance_type = inheritance_type
            if conditions is not None:
                role.conditions = conditions
            if updated_by:
                role.updated_by = updated_by
                role.updated_at = datetime.utcnow()

            # Re-apply templates and inheritance
            role.permissions = set(permissions or [])
            for template_id in role.permission_templates:
                template = self.permission_templates.get(template_id)
                if template:
                    for perm_config in template.permissions:
                        if perm_config.get("action"):
                            role.permissions.add(perm_config["action"])

            for inherited_role in role.inherited_roles:
                inherited_permissions = self._get_inherited_permissions(inherited_role)
                role.permissions.update(inherited_permissions)

            logger.info("Updated custom role", role=role_name)
            return True, role

        except Exception as e:
            logger.error(f"Failed to update custom role: {str(e)}", role=role_name)
            return False, f"Failed to update custom role: {str(e)}"

    def delete_custom_role(self, role_name: str, deleted_by: str = None) -> Tuple[bool, str]:
        """Delete a custom role"""
        try:
            if role_name not in self.custom_roles:
                return False, f"Role '{role_name}' not found"

            # Check if role is being used in inheritance
            for inheritance in self.role_inheritance:
                if inheritance.parent_role == role_name or inheritance.child_role == role_name:
                    return False, f"Cannot delete role '{role_name}' as it is used in role inheritance"

            # Check if role is assigned to any resource-specific permissions
            for perm in self.resource_specific_permissions:
                if perm.role_name == role_name:
                    return False, f"Cannot delete role '{role_name}' as it is assigned to specific resources"

            del self.custom_roles[role_name]
            logger.info("Deleted custom role", role=role_name, deleted_by=deleted_by)
            return True, f"Role '{role_name}' deleted successfully"

        except Exception as e:
            logger.error(f"Failed to delete custom role: {str(e)}", role=role_name)
            return False, f"Failed to delete custom role: {str(e)}"

    def get_custom_role(self, role_name: str) -> Optional[CustomRole]:
        """Get a custom role by name"""
        return self.custom_roles.get(role_name)

    def list_custom_roles(self, tenant_id: Optional[str] = None) -> List[CustomRole]:
        """List all custom roles, optionally filtered by tenant"""
        roles = list(self.custom_roles.values())
        if tenant_id:
            roles = [role for role in roles if role.tenant_id == tenant_id]
        return roles

    # ========== PERMISSION TEMPLATE MANAGEMENT ==========

    def _initialize_system_templates(self):
        """Initialize system permission templates"""
        system_templates = [
            PermissionTemplate(
                id="template_admin_full",
                name="Administrator Full Access",
                description="Full administrative access to all system resources",
                permissions=[
                    {"resource_type": "*", "action": "*", "conditions": {}}
                ],
                category="admin",
                is_system=True
            ),
            PermissionTemplate(
                id="template_project_manager",
                name="Project Manager",
                description="Full access to project management",
                permissions=[
                    {"resource_type": "project", "action": "create"},
                    {"resource_type": "project", "action": "read"},
                    {"resource_type": "project", "action": "update"},
                    {"resource_type": "project", "action": "delete"},
                    {"resource_type": "module", "action": "create"},
                    {"resource_type": "module", "action": "read"},
                    {"resource_type": "module", "action": "update"},
                    {"resource_type": "prompt", "action": "create"},
                    {"resource_type": "prompt", "action": "read"},
                    {"resource_type": "prompt", "action": "update"},
                ],
                category="user",
                is_system=True
            ),
            PermissionTemplate(
                id="template_content_viewer",
                name="Content Viewer",
                description="Read-only access to all content",
                permissions=[
                    {"resource_type": "project", "action": "read"},
                    {"resource_type": "module", "action": "read"},
                    {"resource_type": "prompt", "action": "read"},
                    {"resource_type": "template", "action": "read"},
                ],
                category="viewer",
                is_system=True
            ),
        ]

        for template in system_templates:
            self.permission_templates[template.id] = template

    def create_permission_template(
        self,
        name: str,
        permissions: List[Dict[str, Any]],
        description: Optional[str] = None,
        category: str = "custom",
        created_by: str = None,
        tenant_id: str = None
    ) -> Tuple[bool, Union[PermissionTemplate, str]]:
        """Create a permission template"""
        try:
            template_id = f"template_{uuid.uuid4().hex}"
            template = PermissionTemplate(
                id=template_id,
                name=name,
                description=description,
                permissions=permissions,
                category=category,
                created_by=created_by,
                tenant_id=tenant_id
            )

            self.permission_templates[template_id] = template
            logger.info("Created permission template", template_id=template_id, name=name)
            return True, template

        except Exception as e:
            logger.error(f"Failed to create permission template: {str(e)}", name=name)
            return False, f"Failed to create permission template: {str(e)}"

    def get_permission_template(self, template_id: str) -> Optional[PermissionTemplate]:
        """Get a permission template by ID"""
        return self.permission_templates.get(template_id)

    def list_permission_templates(self, category: Optional[str] = None, tenant_id: Optional[str] = None, is_active: Optional[bool] = None, is_system: Optional[bool] = None, search: Optional[str] = None, skip: int = 0, limit: int = 100) -> List[PermissionTemplate]:
        """List permission templates with optional filtering"""
        templates = list(self.permission_templates.values())

        if category:
            templates = [t for t in templates if t.category == category]
        if tenant_id:
            templates = [t for t in templates if t.tenant_id == tenant_id or t.is_system]
        if is_active is not None:
            templates = [t for t in templates if getattr(t, 'is_active', True) == is_active]
        if is_system is not None:
            templates = [t for t in templates if getattr(t, 'is_system', False) == is_system]
        if search:
            search_lower = search.lower()
            templates = [t for t in templates if search_lower in t.name.lower() or search_lower in t.description.lower()]

        # Apply pagination
        if skip > 0:
            templates = templates[skip:]
        if limit > 0 and len(templates) > limit:
            templates = templates[:limit]

        return templates

    def apply_permission_template(self, role_name: str, template_id: str) -> Tuple[bool, str]:
        """Apply a permission template to a role"""
        try:
            template = self.permission_templates.get(template_id)
            if not template:
                return False, f"Template '{template_id}' not found"

            if role_name in self.custom_roles:
                role = self.custom_roles[role_name]
                role.permission_templates.append(template_id)

                # Add template permissions to role
                for perm_config in template.permissions:
                    if perm_config.get("action"):
                        action = perm_config["action"]
                        try:
                            Permission(action)  # Validate permission
                            role.permissions.add(action)
                        except ValueError:
                            continue

                role.updated_at = datetime.utcnow()
                logger.info("Applied permission template to role", role=role_name, template=template_id)
                return True, f"Template '{template.name}' applied to role '{role_name}'"
            else:
                return False, f"Role '{role_name}' not found"

        except Exception as e:
            logger.error(f"Failed to apply permission template: {str(e)}", role=role_name, template=template_id)
            return False, f"Failed to apply permission template: {str(e)}"

    # ========== ROLE INHERITANCE MANAGEMENT ==========

    def add_role_inheritance(
        self,
        parent_role: str,
        child_role: str,
        inheritance_type: InheritanceType = InheritanceType.CHILDREN,
        conditions: Optional[Dict[str, Any]] = None,
        created_by: str = None,
        tenant_id: str = None
    ) -> Tuple[bool, Union[RoleInheritance, str]]:
        """Add role inheritance relationship"""
        try:
            # Check for circular inheritance
            if self._would_create_circular_inheritance(parent_role, child_role):
                return False, "Circular inheritance detected"

            inheritance = RoleInheritance(
                parent_role=parent_role,
                child_role=child_role,
                inheritance_type=inheritance_type,
                conditions=conditions or {},
                created_by=created_by,
                tenant_id=tenant_id
            )

            self.role_inheritance.append(inheritance)
            logger.info("Added role inheritance", parent=parent_role, child=child_role, type=inheritance_type.value)
            return True, inheritance

        except Exception as e:
            logger.error(f"Failed to add role inheritance: {str(e)}", parent=parent_role, child=child_role)
            return False, f"Failed to add role inheritance: {str(e)}"

    def remove_role_inheritance(self, parent_role: str, child_role: str) -> Tuple[bool, str]:
        """Remove role inheritance relationship"""
        try:
            for i, inheritance in enumerate(self.role_inheritance):
                if inheritance.parent_role == parent_role and inheritance.child_role == child_role:
                    del self.role_inheritance[i]
                    logger.info("Removed role inheritance", parent=parent_role, child=child_role)
                    return True, f"Inheritance between '{parent_role}' and '{child_role}' removed"

            return False, f"Inheritance between '{parent_role}' and '{child_role}' not found"

        except Exception as e:
            logger.error(f"Failed to remove role inheritance: {str(e)}", parent=parent_role, child=child_role)
            return False, f"Failed to remove role inheritance: {str(e)}"

    def get_role_hierarchy(self, role_name: str) -> Dict[str, List[str]]:
        """Get complete role hierarchy for a role"""
        hierarchy = {"parents": [], "children": []}

        for inheritance in self.role_inheritance:
            if inheritance.parent_role == role_name:
                hierarchy["children"].append(inheritance.child_role)
            if inheritance.child_role == role_name:
                hierarchy["parents"].append(inheritance.parent_role)

        return hierarchy

    def _would_create_circular_inheritance(self, parent_role: str, child_role: str, visited: Optional[Set[str]] = None) -> bool:
        """Check if adding inheritance would create circular dependency"""
        if visited is None:
            visited = set()

        if child_role in visited:
            return True

        visited.add(child_role)

        # Check all children of the potential child
        for inheritance in self.role_inheritance:
            if inheritance.parent_role == child_role:
                if self._would_create_circular_inheritance(parent_role, inheritance.child_role, visited.copy()):
                    return True

        return False

    def _get_inherited_permissions(self, role_name: str, visited: Optional[Set[str]] = None) -> Set[str]:
        """Get all permissions inherited by a role"""
        if visited is None:
            visited = set()

        if role_name in visited:
            return set()

        visited.add(role_name)
        permissions = set()

        # Get direct role permissions
        if role_name in self.custom_roles:
            permissions.update(self.custom_roles[role_name].permissions)

        # Get inherited permissions
        for inheritance in self.role_inheritance:
            if inheritance.child_role == role_name:
                parent_permissions = self._get_inherited_permissions(inheritance.parent_role, visited.copy())
                permissions.update(parent_permissions)

        return permissions

    # ========== RESOURCE-SPECIFIC PERMISSIONS ==========

    def grant_resource_permission(
        self,
        role_name: str,
        resource_type: str,
        resource_id: str,
        action: str,
        conditions: Optional[Dict[str, Any]] = None,
        expires_at: Optional[datetime] = None,
        granted_by: str = None,
        tenant_id: str = None
    ) -> Tuple[bool, Union[ResourceSpecificPermission, str]]:
        """Grant resource-specific permission to a role"""
        try:
            # Validate the permission exists
            try:
                Permission(action)
            except ValueError:
                return False, f"Invalid permission: {action}"

            permission = ResourceSpecificPermission(
                role_name=role_name,
                resource_type=resource_type,
                resource_id=resource_id,
                action=action,
                conditions=conditions or {},
                expires_at=expires_at,
                created_by=granted_by,
                tenant_id=tenant_id
            )

            self.resource_specific_permissions.append(permission)
            logger.info("Granted resource permission", role=role_name, resource=resource_id, action=action)
            return True, permission

        except Exception as e:
            logger.error(f"Failed to grant resource permission: {str(e)}", role=role_name, resource=resource_id)
            return False, f"Failed to grant resource permission: {str(e)}"

    def revoke_resource_permission(
        self,
        role_name: str,
        resource_type: str,
        resource_id: str,
        action: Optional[str] = None
    ) -> Tuple[bool, str]:
        """Revoke resource-specific permission(s)"""
        try:
            removed_count = 0
            remaining_permissions = []

            for perm in self.resource_specific_permissions:
                if (perm.role_name == role_name and
                    perm.resource_type == resource_type and
                    perm.resource_id == resource_id):

                    if action is None or perm.action == action:
                        removed_count += 1
                        continue

                remaining_permissions.append(perm)

            self.resource_specific_permissions = remaining_permissions

            if removed_count > 0:
                logger.info("Revoked resource permissions", role=role_name, resource=resource_id, count=removed_count)
                return True, f"Revoked {removed_count} permission(s) for role '{role_name}' on resource '{resource_id}'"
            else:
                return False, f"No permissions found for role '{role_name}' on resource '{resource_id}'"

        except Exception as e:
            logger.error(f"Failed to revoke resource permission: {str(e)}", role=role_name, resource=resource_id)
            return False, f"Failed to revoke resource permission: {str(e)}"

    def get_resource_permissions(self, resource_type: str, resource_id: str) -> List[ResourceSpecificPermission]:
        """Get all permissions for a specific resource"""
        return [
            perm for perm in self.resource_specific_permissions
            if perm.resource_type == resource_type and perm.resource_id == resource_id and perm.is_active
        ]

    # ========== BULK OPERATIONS ==========

    def bulk_assign_roles(
        self,
        user_ids: List[str],
        role_names: List[str],
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        conditions: Optional[Dict[str, Any]] = None,
        assigned_by: str = None
    ) -> Dict[str, Any]:
        """Bulk assign roles to multiple users"""
        results = {
            "success_count": 0,
            "failure_count": 0,
            "errors": [],
            "details": []
        }

        for user_id in user_ids:
            for role_name in role_names:
                try:
                    # This would typically integrate with a user service
                    # For now, we'll simulate the assignment
                    success = self.assign_role_to_user(
                        user_id=user_id,
                        role_name=role_name,
                        resource_id=resource_id,
                        resource_type=ResourceType(resource_type) if resource_type else None
                    )

                    if success:
                        results["success_count"] += 1
                        results["details"].append({"user_id": user_id, "role": role_name, "status": "success"})
                    else:
                        results["failure_count"] += 1
                        results["errors"].append(f"Failed to assign role '{role_name}' to user '{user_id}'")
                        results["details"].append({"user_id": user_id, "role": role_name, "status": "failed"})

                except Exception as e:
                    results["failure_count"] += 1
                    results["errors"].append(f"Error assigning role '{role_name}' to user '{user_id}': {str(e)}")
                    results["details"].append({"user_id": user_id, "role": role_name, "status": "error", "error": str(e)})

        logger.info("Bulk role assignment completed",
                   success_count=results["success_count"],
                   failure_count=results["failure_count"])
        return results

    def bulk_update_permissions(
        self,
        role_name: str,
        permission_updates: List[Dict[str, Any]],
        updated_by: str = None
    ) -> Dict[str, Any]:
        """Bulk update permissions for a role"""
        results = {
            "success_count": 0,
            "failure_count": 0,
            "errors": []
        }

        if role_name not in self.custom_roles:
            results["failure_count"] = len(permission_updates)
            results["errors"].append(f"Role '{role_name}' not found")
            return results

        role = self.custom_roles[role_name]

        for update in permission_updates:
            try:
                action = update.get("action")
                operation = update.get("operation")  # "add" or "remove"

                if not action or not operation:
                    results["failure_count"] += 1
                    results["errors"].append(f"Invalid permission update: missing action or operation")
                    continue

                try:
                    Permission(action)  # Validate permission
                except ValueError:
                    results["failure_count"] += 1
                    results["errors"].append(f"Invalid permission: {action}")
                    continue

                if operation == "add":
                    role.permissions.add(action)
                    results["success_count"] += 1
                elif operation == "remove":
                    role.permissions.discard(action)
                    results["success_count"] += 1
                else:
                    results["failure_count"] += 1
                    results["errors"].append(f"Invalid operation: {operation}")

            except Exception as e:
                results["failure_count"] += 1
                results["errors"].append(f"Error updating permission '{action}': {str(e)}")

        if results["success_count"] > 0:
            role.updated_by = updated_by
            role.updated_at = datetime.utcnow()

        logger.info("Bulk permission update completed",
                   role=role_name,
                   success_count=results["success_count"],
                   failure_count=results["failure_count"])
        return results

    # ========== ACCESS REVIEW MANAGEMENT ==========

    def create_access_review(
        self,
        title: str,
        review_type: str,
        scope: Dict[str, Any],
        reviewers: List[str],
        description: Optional[str] = None,
        due_date: Optional[datetime] = None,
        created_by: str = None,
        tenant_id: str = None
    ) -> Tuple[bool, Union[AccessReview, str]]:
        """Create an access review"""
        try:
            review_id = f"review_{uuid.uuid4().hex}"
            review = AccessReview(
                id=review_id,
                title=title,
                description=description,
                review_type=review_type,
                scope=scope,
                reviewers=reviewers,
                status=AccessReviewStatus.PENDING.value,
                due_date=due_date,
                created_by=created_by,
                tenant_id=tenant_id
            )

            self.access_reviews[review_id] = review
            logger.info("Created access review", review_id=review_id, title=title)
            return True, review

        except Exception as e:
            logger.error(f"Failed to create access review: {str(e)}", title=title)
            return False, f"Failed to create access review: {str(e)}"

    def get_access_review(self, review_id: str) -> Optional[AccessReview]:
        """Get an access review by ID"""
        return self.access_reviews.get(review_id)

    def list_access_reviews(
        self,
        status: Optional[str] = None,
        review_type: Optional[str] = None,
        tenant_id: Optional[str] = None
    ) -> List[AccessReview]:
        """List access reviews with optional filtering"""
        reviews = list(self.access_reviews.values())

        if status:
            reviews = [r for r in reviews if r.status == status]
        if review_type:
            reviews = [r for r in reviews if r.review_type == review_type]
        if tenant_id:
            reviews = [r for r in reviews if r.tenant_id == tenant_id]

        return sorted(reviews, key=lambda x: x.created_at, reverse=True)

    def perform_access_review(
        self,
        review_id: str,
        reviewer_id: str,
        findings: List[Dict[str, Any]],
        recommendations: List[Dict[str, Any]],
        completed: bool = True
    ) -> Tuple[bool, Union[AccessReview, str]]:
        """Perform an access review"""
        try:
            review = self.access_reviews.get(review_id)
            if not review:
                return False, f"Review '{review_id}' not found"

            if reviewer_id not in review.reviewers:
                return False, f"User '{reviewer_id}' is not authorized to review this access review"

            if review.status == AccessReviewStatus.COMPLETED.value:
                return False, f"Review '{review_id}' is already completed"

            review.findings.extend(findings)
            review.recommendations.extend(recommendations)

            if completed:
                review.status = AccessReviewStatus.COMPLETED.value
                review.completed_at = datetime.utcnow()
                logger.info("Completed access review", review_id=review_id, reviewer=reviewer_id)

            return True, review

        except Exception as e:
            logger.error(f"Failed to perform access review: {str(e)}", review_id=review_id)
            return False, f"Failed to perform access review: {str(e)}"

    # ========== ENHANCED PERMISSION CHECKING ==========

    def can_perform_action_enhanced(
        self,
        user_roles: List[str],
        action: str,
        resource_type: str,
        resource_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Enhanced permission checking with conditions and inheritance"""
        result = {
            "allowed": False,
            "reason": "",
            "conditions_met": {},
            "effective_permissions": set(),
            "inheritance_chain": []
        }

        try:
            # Get all effective permissions including inheritance
            effective_permissions = set()
            inheritance_chain = []

            for role_name in user_roles:
                # Check system roles
                try:
                    # Try direct conversion first
                    role_enum = UserRole(role_name)
                    role_permissions = self.role_permissions.get(role_enum, set())
                    effective_permissions.update(role_permissions)
                    inheritance_chain.append(f"system:{role_name}")
                except ValueError:
                    # Try case-insensitive matching
                    try:
                        normalized_role = role_name.lower() if role_name else role_name
                        role_enum = UserRole(normalized_role)
                        role_permissions = self.role_permissions.get(role_enum, set())
                        effective_permissions.update(role_permissions)
                        inheritance_chain.append(f"system:{normalized_role}")
                    except ValueError:
                        pass

                # Check custom roles
                if role_name in self.custom_roles:
                    custom_role = self.custom_roles[role_name]
                    effective_permissions.update(custom_role.permissions)
                    inheritance_chain.append(f"custom:{role_name}")

                    # Add inherited permissions
                    inherited_perms = self._get_inherited_permissions(role_name)
                    effective_permissions.update(inherited_perms)

            result["effective_permissions"] = effective_permissions
            result["inheritance_chain"] = inheritance_chain

            # Check if permission exists
            if action not in effective_permissions:
                result["reason"] = f"Permission '{action}' not granted to any of the user's roles"
                return result

            # Check resource-specific permissions if resource_id provided
            if resource_id:
                resource_allowed = False
                for role_name in user_roles:
                    resource_perms = [
                        perm for perm in self.resource_specific_permissions
                        if (perm.role_name == role_name and
                            perm.resource_type == resource_type and
                            perm.resource_id == resource_id and
                            perm.is_active)
                    ]

                    for perm in resource_perms:
                        if perm.action == action:
                            # Check conditions
                            conditions_met = self._check_permission_conditions(perm.conditions, context)
                            result["conditions_met"].update(conditions_met)

                            if all(conditions_met.values()) and (perm.expires_at is None or perm.expires_at > datetime.utcnow()):
                                resource_allowed = True
                                break

                    if resource_allowed:
                        break

                if not resource_allowed:
                    result["reason"] = f"No resource-specific permission for '{action}' on resource '{resource_id}'"
                    return result

            # Check permission conditions
            conditions_met = self._check_permission_conditions({}, context)
            result["conditions_met"].update(conditions_met)

            if not all(conditions_met.values()):
                result["reason"] = "Permission conditions not met"
                return result

            result["allowed"] = True
            result["reason"] = "Permission granted"

            return result

        except Exception as e:
            logger.error(f"Enhanced permission check failed: {str(e)}", action=action, resource_type=resource_type)
            result["reason"] = f"Permission check failed: {str(e)}"
            return result

    # ========== CONDITION CHECKING HELPERS ==========

    def _check_permission_conditions(self, conditions: Dict[str, Any], context: Optional[Dict[str, Any]]) -> Dict[str, bool]:
        """Check permission conditions"""
        results = {}

        for condition_type, condition_value in conditions.items():
            checker = self.permission_conditions.get(condition_type)
            if checker:
                results[condition_type] = checker(condition_value, context or {})
            else:
                results[condition_type] = False

        return results

    def _check_time_based_condition(self, condition: Dict[str, Any], context: Dict[str, Any]) -> bool:
        """Check time-based access conditions"""
        try:
            now = datetime.utcnow()

            if "allowed_hours" in condition:
                allowed_hours = condition["allowed_hours"]  # e.g., [9, 17] for 9 AM to 5 PM
                current_hour = now.hour
                if not (allowed_hours[0] <= current_hour <= allowed_hours[1]):
                    return False

            if "allowed_days" in condition:
                allowed_days = condition["allowed_days"]  # e.g., [0, 1, 2, 3, 4] for Monday to Friday
                current_day = now.weekday()
                if current_day not in allowed_days:
                    return False

            if "start_date" in condition:
                start_date = datetime.fromisoformat(condition["start_date"])
                if now < start_date:
                    return False

            if "end_date" in condition:
                end_date = datetime.fromisoformat(condition["end_date"])
                if now > end_date:
                    return False

            return True

        except Exception:
            return False

    def _check_location_based_condition(self, condition: Dict[str, Any], context: Dict[str, Any]) -> bool:
        """Check location-based access conditions"""
        try:
            if "allowed_locations" in condition:
                user_location = context.get("location", {}).get("country")
                if user_location and user_location not in condition["allowed_locations"]:
                    return False

            if "blocked_locations" in condition:
                user_location = context.get("location", {}).get("country")
                if user_location and user_location in condition["blocked_locations"]:
                    return False

            return True

        except Exception:
            return False

    def _check_device_based_condition(self, condition: Dict[str, Any], context: Dict[str, Any]) -> bool:
        """Check device-based access conditions"""
        try:
            if "allowed_devices" in condition:
                device_info = context.get("device", {})
                device_type = device_info.get("type")
                if device_type and device_type not in condition["allowed_devices"]:
                    return False

            if "require_mfa" in condition and condition["require_mfa"]:
                if not context.get("auth", {}).get("mfa_completed", False):
                    return False

            return True

        except Exception:
            return False

    def _check_approval_based_condition(self, condition: Dict[str, Any], context: Dict[str, Any]) -> bool:
        """Check approval-based access conditions"""
        try:
            if "requires_approval" in condition and condition["requires_approval"]:
                approval_status = context.get("approval", {}).get("status")
                return approval_status == "approved"

            return True

        except Exception:
            return False

    def _check_owner_condition(self, condition: Dict[str, Any], context: Dict[str, Any]) -> bool:
        """Check owner-only condition"""
        try:
            user_id = context.get("user_id")
            resource_owner = context.get("resource_owner")
            return user_id and resource_owner and user_id == resource_owner

        except Exception:
            return False

    def _check_tenant_condition(self, condition: Dict[str, Any], context: Dict[str, Any]) -> bool:
        """Check tenant-only condition"""
        try:
            user_tenant = context.get("tenant_id")
            resource_tenant = context.get("resource_tenant")
            return user_tenant and resource_tenant and user_tenant == resource_tenant

        except Exception:
            return False

# Global RBAC service instance
rbac_service = RBACService()

# Dependency for FastAPI
def get_rbac_service():
    """Dependency to get RBAC service instance"""
    return rbac_service
