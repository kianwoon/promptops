#!/usr/bin/env python3
"""
Script to fix user roles in the database.
This script applies the new intelligent role assignment logic to existing users.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.services.user_manager import UserManager
from app.models import UserRole
import structlog

# Configure logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

def fix_user_roles():
    """Fix user roles for all existing users."""
    db = SessionLocal()
    try:
        user_manager = UserManager(db)

        # Get current stats
        logger.info("Getting current user statistics...")
        stats_before = user_manager.get_user_stats()
        logger.info("User statistics before fixes", **stats_before)

        # Fix user roles
        logger.info("Starting user role fixes...")
        result = user_manager.fix_user_roles()

        # Get updated stats
        logger.info("Getting updated user statistics...")
        stats_after = user_manager.get_user_stats()
        logger.info("User statistics after fixes", **stats_after)

        # Print summary
        print("\n" + "="*50)
        print("USER ROLE FIX SUMMARY")
        print("="*50)
        print(f"Total users processed: {result['total_users']}")
        print(f"Users updated: {result['updated_count']}")
        print(f"\nRole distribution after fixes:")
        print(f"  Admin: {stats_after['admin_count']}")
        print(f"  User: {stats_after['user_count']}")
        print(f"  Viewer: {stats_after['viewer_count']}")

        if result['updated_count'] > 0:
            print(f"\nUpdated users:")
            for update in result['updates']:
                print(f"  {update['email']}: {update['old_role']} -> {update['new_role']}")

        print("="*50)

        # Check if wiserly@gmail.com was fixed
        wiserly_user = db.query(User).filter(User.email == "wiserly@gmail.com").first()
        if wiserly_user:
            print(f"\nwiserly@gmail.com role: {wiserly_user.role.value}")
        else:
            print("\nwiserly@gmail.com not found in database")

    except Exception as e:
        logger.error("Failed to fix user roles", error=str(e))
        print(f"Error: {e}")
        sys.exit(1)
    finally:
        db.close()

def update_specific_user(email: str, role: str):
    """Update a specific user's role."""
    db = SessionLocal()
    try:
        user_manager = UserManager(db)

        # Convert role string to enum
        try:
            role_enum = UserRole(role.lower())
        except ValueError:
            print(f"Invalid role: {role}. Valid roles: admin, user, viewer")
            sys.exit(1)

        # Update user
        user = user_manager.update_user_role_by_email(email, role_enum)
        if user:
            print(f"Updated {email} role to: {role}")
        else:
            print(f"User not found: {email}")

    except Exception as e:
        logger.error("Failed to update user role", email=email, error=str(e))
        print(f"Error: {e}")
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[1] == "--user":
        # Update specific user
        if len(sys.argv) != 4:
            print("Usage: python fix_user_roles.py --user <email> <role>")
            print("Example: python fix_user_roles.py --user wiserly@gmail.com admin")
            sys.exit(1)
        email = sys.argv[2]
        role = sys.argv[3]
        update_specific_user(email, role)
    else:
        # Fix all users
        fix_user_roles()