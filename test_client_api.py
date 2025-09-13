#!/usr/bin/env python3
"""
Test script for the PromptOps Client API implementation.
This script validates the basic functionality of the client API endpoints.
"""

import asyncio
import httpx
import json
import hashlib
import hmac
import time
from datetime import datetime, timedelta
from typing import Dict, Any

# Test configuration
BASE_URL = "http://localhost:8000"
API_BASE_URL = f"{BASE_URL}/v1/client"

# Test credentials (these would normally come from environment variables)
TEST_API_KEY = "po_test1234567890123456789012"
TEST_SECRET_KEY = "testsecret1234567890123456789012"

def create_hmac_signature(api_key: str, secret_key: str, method: str, endpoint: str) -> tuple[str, str]:
    """Create HMAC-SHA256 signature for API requests"""
    timestamp = datetime.utcnow().isoformat() + 'Z'
    message = f"{api_key}:{timestamp}:{method}:{endpoint}"
    signature = hmac.new(
        secret_key.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()
    return timestamp, signature

def create_auth_headers(method: str, endpoint: str) -> Dict[str, str]:
    """Create authentication headers for API requests"""
    timestamp, signature = create_hmac_signature(TEST_API_KEY, TEST_SECRET_KEY, method, endpoint)
    return {
        "Authorization": f"Bearer {TEST_API_KEY}",
        "X-PromptOps-Signature": signature,
        "X-PromptOps-Timestamp": timestamp,
        "Content-Type": "application/json"
    }

async def test_health_check():
    """Test the health check endpoint"""
    print("Testing health check...")
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        response = await client.get("/health")
        print(f"Health check status: {response.status_code}")
        print(f"Response: {response.json()}")
        print()

async def test_create_api_key():
    """Test creating an API key"""
    print("Testing API key creation...")

    # First, we need to authenticate with the web interface to get a JWT token
    # For now, we'll skip this test as it requires web authentication
    print("Skipping API key creation test (requires web authentication)")
    print()

async def test_validate_api_key():
    """Test API key validation"""
    print("Testing API key validation...")

    endpoint = "/v1/client/auth/validate"
    method = "POST"

    timestamp, signature = create_hmac_signature(TEST_API_KEY, TEST_SECRET_KEY, method, endpoint)

    payload = {
        "api_key": TEST_API_KEY,
        "signature": signature,
        "timestamp": timestamp,
        "method": method,
        "endpoint": endpoint
    }

    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        response = await client.post(endpoint, json=payload)
        print(f"Validation status: {response.status_code}")
        print(f"Response: {response.json()}")
        print()

async def test_get_prompts():
    """Test getting prompts"""
    print("Testing prompt retrieval...")

    endpoint = "/v1/client/prompts"
    method = "GET"

    headers = create_auth_headers(method, endpoint)

    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        response = await client.get(endpoint, headers=headers)
        print(f"Get prompts status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Found {data.get('total', 0)} prompts")
        else:
            print(f"Error: {response.json()}")
        print()

async def test_get_specific_prompt():
    """Test getting a specific prompt"""
    print("Testing specific prompt retrieval...")

    prompt_id = "test-prompt"
    endpoint = f"/v1/client/prompts/{prompt_id}"
    method = "GET"

    headers = create_auth_headers(method, endpoint)

    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        response = await client.get(endpoint, headers=headers)
        print(f"Get prompt status: {response.status_code}")
        if response.status_code == 200:
            print(f"Prompt data: {response.json()}")
        else:
            print(f"Error: {response.json()}")
        print()

async def test_search_prompts():
    """Test searching prompts"""
    print("Testing prompt search...")

    endpoint = "/v1/client/prompts"
    method = "GET"

    headers = create_auth_headers(method, endpoint)
    params = {"query": "test", "limit": 10}

    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        response = await client.get(endpoint, headers=headers, params=params)
        print(f"Search prompts status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Search results: {data.get('total', 0)} prompts found")
        else:
            print(f"Error: {response.json()}")
        print()

async def test_batch_get_prompts():
    """Test batch getting prompts"""
    print("Testing batch prompt retrieval...")

    endpoint = "/v1/client/prompts/batch"
    method = "POST"

    headers = create_auth_headers(method, endpoint)
    payload = {
        "prompt_ids": ["test-prompt-1", "test-prompt-2"],
        "include_metadata": True
    }

    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        response = await client.post(endpoint, headers=headers, json=payload)
        print(f"Batch get prompts status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Batch results: {data.get('total_found', 0)} out of {data.get('total_requested', 0)} found")
        else:
            print(f"Error: {response.json()}")
        print()

async def test_usage_limits():
    """Test getting usage limits"""
    print("Testing usage limits...")

    endpoint = "/v1/client/usage/limits"
    method = "GET"

    headers = create_auth_headers(method, endpoint)

    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        response = await client.get(endpoint, headers=headers)
        print(f"Usage limits status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Rate limits: {data}")
        else:
            print(f"Error: {response.json()}")
        print()

async def test_invalid_signature():
    """Test with invalid signature"""
    print("Testing invalid signature...")

    endpoint = "/v1/client/prompts"
    method = "GET"

    # Create headers with invalid signature
    headers = {
        "Authorization": f"Bearer {TEST_API_KEY}",
        "X-PromptOps-Signature": "invalid_signature",
        "X-PromptOps-Timestamp": datetime.utcnow().isoformat() + 'Z',
        "Content-Type": "application/json"
    }

    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        response = await client.get(endpoint, headers=headers)
        print(f"Invalid signature status: {response.status_code}")
        print(f"Response: {response.json()}")
        print()

async def test_expired_timestamp():
    """Test with expired timestamp"""
    print("Testing expired timestamp...")

    endpoint = "/v1/client/prompts"
    method = "GET"

    # Create headers with expired timestamp
    expired_timestamp = (datetime.utcnow() - timedelta(minutes=10)).isoformat() + 'Z'
    timestamp, signature = create_hmac_signature(TEST_API_KEY, TEST_SECRET_KEY, method, endpoint)

    headers = {
        "Authorization": f"Bearer {TEST_API_KEY}",
        "X-PromptOps-Signature": signature,
        "X-PromptOps-Timestamp": expired_timestamp,
        "Content-Type": "application/json"
    }

    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        response = await client.get(endpoint, headers=headers)
        print(f"Expired timestamp status: {response.status_code}")
        print(f"Response: {response.json()}")
        print()

async def run_all_tests():
    """Run all test cases"""
    print("=" * 60)
    print("PromptOps Client API Test Suite")
    print("=" * 60)
    print()

    # Run tests
    await test_health_check()
    await test_validate_api_key()
    await test_get_prompts()
    await test_get_specific_prompt()
    await test_search_prompts()
    await test_batch_get_prompts()
    await test_usage_limits()
    await test_invalid_signature()
    await test_expired_timestamp()

    print("=" * 60)
    print("Test suite completed!")
    print("=" * 60)

if __name__ == "__main__":
    # Run the test suite
    asyncio.run(run_all_tests())