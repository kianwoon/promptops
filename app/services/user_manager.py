"""
User management service for updating user roles and managing user data.
"""

import structlog
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime

from app.models import User, UserRole
from app.services.auth_service import determine_user_role

logger = structlog.get_logger()

class UserManager:
    """Service for managing user accounts and roles."""

    def __init__(self, db: Session):
        self.db = db

    def update_user_role(self, user_id: str, new_role: UserRole) -> Optional[User]:
        """Update a user's role."""
        try:
            user = self.db.query(User).filter(User.id == user_id).first()
            if not user:
                logger.warning("User not found for role update", user_id=user_id)
                return None

            old_role = user.role
            user.role = new_role
            user.updated_at = datetime.utcnow()

            self.db.commit()
            self.db.refresh(user)

            logger.info("User role updated",
                       user_id=user_id,
                       email=user.email,
                       old_role=old_role.value,
                       new_role=new_role.value)

            return user

        except Exception as e:
            logger.error(f"Failed to update user role: {str(e)}", user_id=user_id)
            self.db.rollback()
            return None

    def update_user_role_by_email(self, email: str, new_role: UserRole) -> Optional[User]:
        """Update a user's role by email address."""
        try:
            user = self.db.query(User).filter(User.email == email).first()
            if not user:
                logger.warning("User not found for role update by email", email=email)
                return None

            old_role = user.role
            user.role = new_role
            user.updated_at = datetime.utcnow()

            self.db.commit()
            self.db.refresh(user)

            logger.info("User role updated by email",
                       email=email,
                       user_id=user.id,
                       old_role=old_role.value,
                       new_role=new_role.value)

            return user

        except Exception as e:
            logger.error(f"Failed to update user role by email: {str(e)}", email=email)
            self.db.rollback()
            return None

    def fix_user_roles(self) -> dict:
        """
        Fix user roles by applying intelligent role assignment logic.
        This updates existing users who may have incorrect roles.
        """
        try:
            users = self.db.query(User).all()
            updated_count = 0
            results = []

            for user in users:
                # Determine what the role should be based on current logic
                expected_role = determine_user_role(user.email, user.name)

                if user.role != expected_role:
                    old_role = user.role
                    user.role = expected_role
                    user.updated_at = datetime.utcnow()

                    results.append({
                        'user_id': user.id,
                        'email': user.email,
                        'old_role': old_role.value,
                        'new_role': expected_role.value
                    })

                    updated_count += 1
                    logger.info("Fixed user role",
                               user_id=user.id,
                               email=user.email,
                               old_role=old_role.value,
                               new_role=expected_role.value)

            if updated_count > 0:
                self.db.commit()
                logger.info("Completed user role fixes", updated_count=updated_count)
            else:
                logger.info("No user role fixes needed")

            return {
                'total_users': len(users),
                'updated_count': updated_count,
                'updates': results
            }

        except Exception as e:
            logger.error(f"Failed to fix user roles: {str(e)}")
            self.db.rollback()
            return {
                'total_users': 0,
                'updated_count': 0,
                'updates': [],
                'error': str(e)
            }

    def get_users_by_role(self, role: UserRole) -> List[User]:
        """Get all users with a specific role."""
        return self.db.query(User).filter(User.role == role).all()

    def get_user_stats(self) -> dict:
        """Get user statistics."""
        try:
            total_users = self.db.query(User).count()
            admin_count = self.db.query(User).filter(User.role == UserRole.ADMIN).count()
            user_count = self.db.query(User).filter(User.role == UserRole.USER).count()
            viewer_count = self.db.query(User).filter(User.role == UserRole.VIEWER).count()

            return {
                'total_users': total_users,
                'admin_count': admin_count,
                'user_count': user_count,
                'viewer_count': viewer_count,
                'role_distribution': {
                    'admin': admin_count,
                    'user': user_count,
                    'viewer': viewer_count
                }
            }
        except Exception as e:
            logger.error(f"Failed to get user stats: {str(e)}")
            return {
                'total_users': 0,
                'admin_count': 0,
                'user_count': 0,
                'viewer_count': 0,
                'error': str(e)
            }