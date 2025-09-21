#!/usr/bin/env python3
"""
Simple script to fix wiserly@gmail.com role directly.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import User, UserRole

def fix_wiserly_role():
    """Fix wiserly@gmail.com role to USER."""
    db = SessionLocal()
    try:
        # Find wiserly@gmail.com
        user = db.query(User).filter(User.email == "wiserly@gmail.com").first()

        if user:
            print(f"Found user: {user.email}")
            print(f"Current role: {user.role.value}")
            print(f"User ID: {user.id}")
            print(f"Provider: {user.provider}")

            # Update role to USER
            user.role = UserRole.USER
            db.commit()

            print(f"Updated role to: {user.role.value}")
            print("✅ Successfully fixed wiserly@gmail.com role!")
        else:
            print("❌ User wiserly@gmail.com not found in database")

    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_wiserly_role()