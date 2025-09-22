#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User

def check_user_avatars():
    """Check what avatar URLs are stored in the database"""
    db = next(get_db())

    try:
        users = db.query(User).all()
        print(f"Found {len(users)} users in database:")

        for user in users:
            print(f"\nUser: {user.name} ({user.email})")
            print(f"  ID: {user.id}")
            print(f"  Provider: {user.provider}")
            print(f"  Avatar URL: {user.avatar}")
            print(f"  Avatar is truthy: {bool(user.avatar)}")
            if user.avatar:
                print(f"  Avatar length: {len(user.avatar)}")
                print(f"  Avatar domain: {user.avatar.split('/')[2] if '//' in user.avatar else 'N/A'}")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    check_user_avatars()