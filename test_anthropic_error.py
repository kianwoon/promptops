#!/usr/bin/env python3
"""
Test script to reproduce the Anthropic API error
"""

import requests
import json

# Test the provider endpoint
url = "http://localhost:8000/v1/ai-assistant/providers/e297567b-2c1c-45f9-aee6-4bc71d1d0da8/test"
headers = {"Content-Type": "application/json"}
data = {"test_message": "Hello, this is a test"}

try:
    response = requests.post(url, headers=headers, json=data)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")

    if response.status_code == 200:
        result = response.json()
        print("Success!")
        print(json.dumps(result, indent=2))
    else:
        print("Error occurred")

except Exception as e:
    print(f"Exception: {e}")