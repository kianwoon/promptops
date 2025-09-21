#!/usr/bin/env python3
"""
Simple test script to verify environment detection functionality
"""

import sys
import os
sys.path.insert(0, '/Users/kianwoonwong/Downloads/promptops/promptops-client')

from promptops.environment import EnvironmentManager, create_environment_config
import asyncio

async def test_environment_detection():
    """Test environment detection functionality"""
    print("Testing environment detection...")

    # Test auto-detection
    env_config = create_environment_config()
    print(f"Auto-detected environment: {env_config.environment}")
    print(f"Auto-detected base URL: {env_config.base_url}")

    # Test localhost detection
    try:
        localhost_accessible = await EnvironmentManager.test_connection("http://localhost:8000", timeout=2.0)
        print(f"Localhost (8000) accessible: {localhost_accessible}")
    except Exception as e:
        print(f"Localhost connection test failed: {e}")

    # Test recommendations
    recommendations = env_config.get_recommendations()
    print(f"Recommendations: {recommendations}")

if __name__ == "__main__":
    asyncio.run(test_environment_detection())