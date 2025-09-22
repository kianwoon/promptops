#!/usr/bin/env python3
"""
Check existing users in the database
"""
import asyncio
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.config import settings
from app.models import User, UserRole
from app.database import Base

async def check_users():
    """Check existing users in the database"""
    try:
        # Create database connection
        engine = create_engine(settings.database_url)
        
        # Check if users table exists and get user count
        with engine.connect() as conn:
            # Get user count
            result = conn.execute(text("SELECT COUNT(*) FROM users"))
            user_count = result.scalar()
            print(f"📊 Total users in database: {user_count}")
            
            if user_count > 0:
                # Get all users
                result = conn.execute(text("""
                    SELECT id, email, name, role, is_active, created_at 
                    FROM users 
                    ORDER BY created_at DESC 
                    LIMIT 10
                """))
                
                print("\n👥 Recent users:")
                for row in result:
                    print(f"   ID: {row.id}")
                    print(f"   Email: {row.email}")
                    print(f"   Name: {row.name}")
                    print(f"   Role: {row.role}")
                    print(f"   Active: {row.is_active}")
                    print(f"   Created: {row.created_at}")
                    print("   " + "-" * 40)
                
                # Check for admin users specifically
                result = conn.execute(text("""
                    SELECT COUNT(*) FROM users WHERE role = 'admin'
                """))
                admin_count = result.scalar()
                print(f"🔐 Admin users: {admin_count}")
                
                if admin_count > 0:
                    result = conn.execute(text("""
                        SELECT id, email, name FROM users WHERE role = 'admin' LIMIT 5
                    """))
                    print("\n👑 Admin users:")
                    for row in result:
                        print(f"   {row.email} ({row.name}) - ID: {row.id}")
            else:
                print("❌ No users found in database")
                
        return True
        
    except Exception as e:
        print(f"❌ Error checking database: {e}")
        return False

if __name__ == "__main__":
    print("🔍 Checking database users...")
    success = asyncio.run(check_users())
    sys.exit(0 if success else 1)
