#!/usr/bin/env python3
"""
Test script to verify the roles endpoint with proper authentication
"""
import requests
import json
import jwt
import datetime
import sys

def create_test_token():
    """Create a test JWT token for an admin user"""

    # Use the same secret key as the app
    secret_key = "your-secret-key-change-in-production"
    algorithm = "HS256"

    # Create token payload for an admin user
    payload = {
        "sub": "test-user-id",
        "email": "wiserly@gmail.com",  # The email mentioned in the issue
        "role": "ADMIN",  # The role mentioned in the issue
        "tenant_id": "default-tenant",
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=1),
        "type": "access"
    }

    # Encode the token
    token = jwt.encode(payload, secret_key, algorithm=algorithm)
    return token

def test_roles_endpoint():
    """Test the roles endpoint with a valid JWT token"""

    base_url = "http://localhost:8000"

    # Create a test token
    token = create_test_token()
    print(f"🔐 Created test token for user: wiserly@gmail.com with role: ADMIN")

    # Set up the authorization header
    headers = {
        "Authorization": f"Bearer {token}"
    }

    # Test the roles endpoint
    try:
        response = requests.get(f"{base_url}/v1/roles/", headers=headers)
        print(f"Roles endpoint response: {response.status_code}")

        if response.status_code == 200:
            print("✅ SUCCESS! Roles endpoint is working with proper authentication")
            try:
                roles_data = response.json()
                print(f"📋 Returned {len(roles_data)} roles")
                print(f"🔧 First role: {json.dumps(roles_data[0] if roles_data else 'No roles', indent=2)}")
            except Exception as e:
                print(f"⚠️  Could not parse response: {e}")
            return True

        elif response.status_code == 403:
            print("❌ Still getting 403 Forbidden - RBAC issue may persist")
            try:
                print(f"Response body: {response.text}")
            except:
                pass
            return False

        elif response.status_code == 401:
            print("❌ Authentication failed - token issue")
            try:
                print(f"Response body: {response.text}")
            except:
                pass
            return False

        else:
            print(f"⚠️  Unexpected status code: {response.status_code}")
            try:
                print(f"Response body: {response.text}")
            except:
                pass
            return False

    except Exception as e:
        print(f"❌ Error testing roles endpoint: {e}")
        return False

if __name__ == "__main__":
    print("🧪 Testing roles endpoint with proper authentication...")
    success = test_roles_endpoint()
    sys.exit(0 if success else 1)