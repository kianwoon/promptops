#!/usr/bin/env python3
"""Test script to verify AI Assistant provider functionality"""

import requests
import json
import time

def test_provider_functionality():
    """Test the AI Assistant provider functionality"""
    base_url = "http://localhost:8000"

    # Test data
    provider_data = {
        "provider_type": "openai",
        "name": "Test OpenAI Provider",
        "api_key": "sk-test-key",
        "model_name": "gpt-3.5-turbo"
    }

    headers = {
        "Authorization": "Bearer demo-token",
        "Content-Type": "application/json"
    }

    print("Testing AI Assistant provider functionality...")

    # Test 1: Get existing providers
    print("\n1. Getting existing providers...")
    try:
        response = requests.get(f"{base_url}/v1/ai-assistant/providers", headers=headers, timeout=5)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            providers = response.json()
            print(f"Existing providers: {len(providers)}")
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Request failed: {e}")

    # Test 2: Create new provider
    print("\n2. Creating new provider...")
    try:
        response = requests.post(f"{base_url}/v1/ai-assistant/providers",
                              headers=headers,
                              json=provider_data,
                              timeout=5)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            provider = response.json()
            print(f"Created provider: {provider.get('name', 'N/A')}")
            print(f"Provider ID: {provider.get('id', 'N/A')}")
            print(f"Provider type: {provider.get('provider_type', 'N/A')}")

            # Test 3: Verify provider was saved by getting providers again
            print("\n3. Verifying provider was saved...")
            response = requests.get(f"{base_url}/v1/ai-assistant/providers", headers=headers, timeout=5)
            if response.status_code == 200:
                providers = response.json()
                print(f"Total providers after creation: {len(providers)}")

                # Check if our test provider is in the list
                test_provider = None
                for p in providers:
                    if p.get('name') == 'Test OpenAI Provider':
                        test_provider = p
                        break

                if test_provider:
                    print("✅ Provider successfully saved to database!")
                    print(f"   ID: {test_provider.get('id')}")
                    print(f"   Name: {test_provider.get('name')}")
                    print(f"   Type: {test_provider.get('provider_type')}")
                    print(f"   Status: {test_provider.get('status')}")
                else:
                    print("❌ Provider not found in database")
            else:
                print(f"Failed to get providers: {response.text}")
        else:
            print(f"Error creating provider: {response.text}")
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    test_provider_functionality()