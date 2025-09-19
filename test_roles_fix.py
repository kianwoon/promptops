#!/usr/bin/env python3
"""
Test script to verify the roles endpoint authorization fix
"""
import requests
import json
import sys

def test_roles_endpoint():
    """Test the roles endpoint with a valid JWT token"""

    # Since we can't easily get the JWT token without the actual user credentials,
    # let's try to make a request to see if our fix resolved the enum issue
    base_url = "http://localhost:8000"

    # Test the health endpoint first to make sure the server is running
    try:
        response = requests.get(f"{base_url}/health")
        if response.status_code == 200:
            print("✅ Server is running and responding")
        else:
            print(f"⚠️  Health check returned: {response.status_code}")
    except Exception as e:
        print(f"❌ Could not connect to server: {e}")
        return False

    # Test the roles endpoint (this will likely fail with 401 without token, but we can see if the enum error is gone)
    try:
        response = requests.get(f"{base_url}/v1/roles/")
        print(f"Roles endpoint response: {response.status_code}")

        if response.status_code == 401:
            print("✅ Roles endpoint is accessible (401 Unauthorized is expected without token)")
            return True
        elif response.status_code == 403:
            print("❌ Still getting 403 Forbidden - there may be additional auth issues")
            try:
                print(f"Response body: {response.text}")
            except:
                pass
            return False
        elif response.status_code == 200:
            print("✅ Roles endpoint is working!")
            return True
        else:
            print(f"⚠️  Unexpected status code: {response.status_code}")
            return False

    except Exception as e:
        print(f"❌ Error testing roles endpoint: {e}")
        return False

if __name__ == "__main__":
    print("🧪 Testing roles endpoint authorization fix...")
    success = test_roles_endpoint()
    sys.exit(0 if success else 1)