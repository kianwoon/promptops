#!/usr/bin/env python3
"""
Test script to verify the authentication endpoint works
"""
import requests
import json
import sys

def test_auth_endpoint():
    """Test the standard authentication endpoint with a demo token"""

    base_url = "http://localhost:8000"

    # Test the auth/me endpoint first
    try:
        # Try without authentication first
        response = requests.get(f"{base_url}/api/v1/auth/me")
        print(f"Auth endpoint (no auth) response: {response.status_code}")
        if response.status_code == 200:
            print("✅ Auth endpoint works without auth (demo mode)")
            print(f"Response: {response.text}")
        else:
            print(f"⚠️  Auth endpoint response: {response.text}")
    except Exception as e:
        print(f"❌ Error testing auth endpoint: {e}")

    # Test the working approval flows endpoint for comparison
    try:
        response = requests.get(f"{base_url}/v1/approval-flows/flows")
        print(f"Approval flows endpoint response: {response.status_code}")
        if response.status_code == 200:
            print("✅ Approval flows endpoint works")
        else:
            print(f"⚠️  Approval flows response: {response.text}")
    except Exception as e:
        print(f"❌ Error testing approval flows endpoint: {e}")

if __name__ == "__main__":
    print("🧪 Testing authentication endpoints...")
    test_auth_endpoint()