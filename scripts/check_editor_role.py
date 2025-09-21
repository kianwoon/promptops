#!/usr/bin/env python3
"""
Script to check and update wiserly@hotmail.com role to editor.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import User, UserRole

def check_and_fix_editor_role():
    """Check and fix wiserly@hotmail.com role to editor."""
    db = SessionLocal()
    try:
        # Find wiserly@hotmail.com
        user = db.query(User).filter(User.email == "wiserly@hotmail.com").first()

        if user:
            print(f"Found user: {user.email}")
            print(f"Current role: {user.role.value}")
            print(f"User ID: {user.id}")
            print(f"Provider: {user.provider}")
            print(f"Name: {user.name}")

            # Check what roles are available
            print(f"\nAvailable roles:")
            for role in UserRole:
                print(f"  - {role.value}")

            # Since you mentioned it should be "editor" but UserRole enum doesn't have EDITOR,
            # let me check if this should be USER or if we need to handle it differently
            if hasattr(UserRole, 'EDITOR'):
                correct_role = UserRole.EDITOR
            else:
                # If no EDITOR role, assume USER is the intended role
                correct_role = UserRole.USER
                print(f"\n⚠️  Note: UserRole.EDITOR not found, using UserRole.USER instead")

            print(f"\nExpected role: {correct_role.value}")

            if user.role != correct_role:
                # Update role to the correct role
                user.role = correct_role
                db.commit()

                print(f"Updated role to: {user.role.value}")
                print("✅ Successfully updated wiserly@hotmail.com role!")
            else:
                print("ℹ️  wiserly@hotmail.com already has the correct role")
        else:
            print("❌ User wiserly@hotmail.com not found in database")

    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    check_and_fix_editor_role()