#!/usr/bin/env python3
"""
Script to check and update wiserly@gmail.com role to admin.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import User, UserRole

def check_and_fix_admin_role():
    """Check and fix wiserly@gmail.com role to admin."""
    db = SessionLocal()
    try:
        # Find wiserly@gmail.com
        user = db.query(User).filter(User.email == "wiserly@gmail.com").first()

        if user:
            print(f"Found user: {user.email}")
            print(f"Current role: {user.role.value}")
            print(f"User ID: {user.id}")
            print(f"Provider: {user.provider}")

            if user.role != UserRole.ADMIN:
                # Update role to ADMIN
                user.role = UserRole.ADMIN
                db.commit()

                print(f"Updated role to: {user.role.value}")
                print("✅ Successfully updated wiserly@gmail.com to admin role!")
            else:
                print("ℹ️  wiserly@gmail.com already has admin role")
        else:
            print("❌ User wiserly@gmail.com not found in database")

    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    check_and_fix_admin_role()