#!/usr/bin/env python3
"""
Check if there are any users in the database
"""
import sys
import os

# Add the project root to Python path
sys.path.insert(0, '/Users/kianwoonwong/Downloads/promptops')

from sqlalchemy import create_engine, text
from app.config import settings

def check_users():
    """Check users in the database"""
    try:
        # Connect to the database
        engine = create_engine(settings.database_url)

        with engine.connect() as conn:
            # Check if users table exists and get count
            result = conn.execute(text("SELECT COUNT(*) FROM users"))
            count = result.scalar()
            print(f"📊 Total users in database: {count}")

            if count > 0:
                # Get user details
                result = conn.execute(text("SELECT id, email, name, role FROM users LIMIT 10"))
                users = result.fetchall()
                print("👥 Users:")
                for user in users:
                    print(f"   ID: {user[0]}, Email: {user[1]}, Name: {user[2]}, Role: {user[3]}")

                # Look for the specific user mentioned in the issue
                result = conn.execute(text("SELECT * FROM users WHERE email = :email"), {"email": "wiserly@gmail.com"})
                wiserly_user = result.fetchone()
                if wiserly_user:
                    print(f"✅ Found user wiserly@gmail.com: {dict(wiserly_user)}")
                else:
                    print("❌ User wiserly@gmail.com not found in database")
            else:
                print("❌ No users found in database")

    except Exception as e:
        print(f"❌ Error checking database: {e}")
        return False

    return True

if __name__ == "__main__":
    print("🔍 Checking database users...")
    check_users()