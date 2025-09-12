#!/usr/bin/env python3

"""
API Test Script for PromptOps Registry
Tests basic functionality to ensure the platform is working correctly.
"""

import requests
import json
import time
import subprocess
import signal
import os
import sys
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.append(str(Path(__file__).parent.parent))

def start_server():
    """Start the server in background"""
    print("🚀 Starting PromptOps server...")
    
    # Start server process
    process = subprocess.Popen([
        'python', '-m', 'uvicorn', 
        'app.main:app', 
        '--host', '0.0.0.0', 
        '--port', '8001',
        '--reload'
    ], cwd=Path(__file__).parent)
    
    # Wait for server to start
    time.sleep(3)
    
    return process

def test_health_endpoint():
    """Test the health check endpoint"""
    print("🔍 Testing health endpoint...")
    
    try:
        response = requests.get('http://localhost:8001/health', timeout=5)
        if response.status_code == 200:
            print("✅ Health endpoint working!")
            print(f"   Response: {response.json()}")
            return True
        else:
            print(f"❌ Health endpoint returned status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health endpoint test failed: {e}")
        return False

def test_root_endpoint():
    """Test the root endpoint"""
    print("🔍 Testing root endpoint...")
    
    try:
        response = requests.get('http://localhost:8001/', timeout=5)
        if response.status_code == 200:
            print("✅ Root endpoint working!")
            print(f"   Response: {response.json()}")
            return True
        else:
            print(f"❌ Root endpoint returned status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Root endpoint test failed: {e}")
        return False

def test_template_creation():
    """Test template creation endpoint"""
    print("🔍 Testing template creation...")
    
    template_data = {
        "id": "test/template",
        "version": "1.0.0",
        "owner": "test-user",
        "template_yaml": """
system: You are a helpful assistant for {{company}}.
user: {{user_input}}

slots:
  company: default_company

inputs_schema:
  type: object
  required: [user_input]
  properties:
    user_input:
      type: string
    company:
      type: string
      default: "Test Company"
""",
        "metadata": {
            "description": "Test template for API validation",
            "author": "test-user"
        }
    }
    
    try:
        response = requests.post(
            'http://localhost:8001/v1/templates/',
            json=template_data,
            timeout=10
        )
        
        if response.status_code in [200, 201]:
            print("✅ Template creation working!")
            template = response.json()
            print(f"   Created template: {template['id']}@{template['version']}")
            return True
        else:
            print(f"❌ Template creation returned status {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Template creation test failed: {e}")
        return False

def test_render_endpoint():
    """Test the render endpoint"""
    print("🔍 Testing render endpoint...")
    
    render_data = {
        "id": "test/template",
        "alias": "test",
        "inputs": {
            "user_input": "Hello, how are you?",
            "company": "Test Corp"
        },
        "tenant": "test-tenant"
    }
    
    try:
        response = requests.post(
            'http://localhost:8001/v1/render',
            json=render_data,
            timeout=10
        )
        
        if response.status_code == 200:
            print("✅ Render endpoint working!")
            result = response.json()
            print(f"   Rendered {len(result['messages'])} messages")
            print(f"   Hash: {result['hash']}")
            return True
        else:
            print(f"❌ Render endpoint returned status {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Render endpoint test failed: {e}")
        return False

def run_all_tests():
    """Run all API tests"""
    print("🧪 Starting PromptOps API Tests...")
    print("=" * 50)
    
    server_process = None
    results = []
    
    try:
        # Start server
        server_process = start_server()
        
        # Run tests
        tests = [
            ("Health Check", test_health_endpoint),
            ("Root Endpoint", test_root_endpoint),
            ("Template Creation", test_template_creation),
            ("Render Endpoint", test_render_endpoint)
        ]
        
        for test_name, test_func in tests:
            print(f"\n--- {test_name} ---")
            try:
                result = test_func()
                results.append((test_name, result))
            except Exception as e:
                print(f"❌ {test_name} failed with exception: {e}")
                results.append((test_name, False))
        
        # Print summary
        print("\n" + "=" * 50)
        print("📊 Test Results Summary:")
        print("=" * 50)
        
        passed = 0
        for test_name, result in results:
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{status} {test_name}")
            if result:
                passed += 1
        
        print(f"\nTotal: {passed}/{len(results)} tests passed")
        
        if passed == len(results):
            print("🎉 All tests passed! PromptOps platform is ready!")
        else:
            print("⚠️  Some tests failed. Please check the configuration.")
            
    finally:
        # Clean up server process
        if server_process:
            print("\n🛑 Stopping server...")
            server_process.terminate()
            try:
                server_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                server_process.kill()

if __name__ == "__main__":
    run_all_tests()