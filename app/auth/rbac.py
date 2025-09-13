from typing import List, Dict, Any, Set, Optional
from enum import Enum
import structlog

logger = structlog.get_logger()

class UserRole(Enum):
    ADMIN = "admin"
    EDITOR = "editor"
    APPROVER = "approver"
    VIEWER = "viewer"

class ResourceType(Enum):
    PROJECT = "project"
    MODULE = "module"
    PROMPT = "prompt"
    TEMPLATE = "template"
    POLICY = "policy"
    SYSTEM = "system"

class Permission(Enum):
    # Project permissions
    CREATE_PROJECT = "create_project"
    READ_PROJECT = "read_project"
    UPDATE_PROJECT = "update_project"
    DELETE_PROJECT = "delete_project"
    MANAGE_PROJECT_MEMBERS = "manage_project_members"

    # Module permissions
    CREATE_MODULE = "create_module"
    READ_MODULE = "read_module"
    UPDATE_MODULE = "update_module"
    DELETE_MODULE = "delete_module"

    # Prompt permissions
    CREATE_PROMPT = "create_prompt"
    READ_PROMPT = "read_prompt"
    UPDATE_PROMPT = "update_prompt"
    DELETE_PROMPT = "delete_prompt"
    SUBMIT_PROMPT_FOR_APPROVAL = "submit_prompt_for_approval"
    APPROVE_PROMPT = "approve_prompt"
    REJECT_PROMPT = "reject_prompt"
    PUBLISH_PROMPT = "publish_prompt"

    # Template permissions
    CREATE_TEMPLATE = "create_template"
    READ_TEMPLATE = "read_template"
    UPDATE_TEMPLATE = "update_template"
    DELETE_TEMPLATE = "delete_template"

    # Policy permissions
    CREATE_POLICY = "create_policy"
    READ_POLICY = "read_policy"
    UPDATE_POLICY = "update_policy"
    DELETE_POLICY = "delete_policy"
    EVALUATE_POLICY = "evaluate_policy"

    # System permissions
    MANAGE_USERS = "manage_users"
    MANAGE_ROLES = "manage_roles"
    VIEW_AUDIT_LOGS = "view_audit_logs"
    SYSTEM_CONFIG = "system_config"

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
            },
            UserRole.VIEWER: {
                # Read-only permissions
                Permission.READ_PROJECT.value,
                Permission.READ_MODULE.value,
                Permission.READ_PROMPT.value,
                Permission.READ_TEMPLATE.value,
                Permission.READ_POLICY.value,
            }
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
            # Convert role strings to enums
            user_role_enums = []
            for role in user_roles:
                try:
                    user_role_enums.append(UserRole(role))
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
            logger.error("RBAC check failed", error=str(e), action=action, resource_type=resource_type)
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
                role = UserRole(role_str)
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
            UserRole.VIEWER: "Read-only access to all resources"
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

# Global RBAC service instance
rbac_service = RBACService()

# Dependency for FastAPI
def get_rbac_service():
    """Dependency to get RBAC service instance"""
    return rbac_service