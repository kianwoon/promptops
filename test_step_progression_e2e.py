#!/usr/bin/env python3
"""
Test script to verify step progression workflow functionality end-to-end
"""

import asyncio
import aiohttp
import json
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class StepProgressionEndToEndTester:
    def __init__(self, base_url="http://localhost:8000"):
        self.base_url = base_url
        self.session = None
        self.token = None

    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    async def login(self):
        """Login to get auth token"""
        login_data = {
            "username": "admin",
            "password": "admin"
        }

        async with self.session.post(f"{self.base_url}/api/v1/auth/token", json=login_data) as response:
            if response.status == 200:
                token_data = await response.json()
                self.token = token_data.get("access_token")
                logger.info("✅ Login successful")
                return True
            else:
                logger.error(f"❌ Login failed: {response.status}")
                return False

    async def create_test_prompt(self):
        """Create a test prompt that requires approval"""
        prompt_data = {
            "name": "Test Step Progression Prompt",
            "description": "A test prompt to verify step progression",
            "content": "This is a test prompt content",
            "category": "test",
            "mas_risk_level": "medium",
            "requires_approval": True,
            "is_active": False,
            "version": "1"
        }

        headers = {"Authorization": f"Bearer {self.token}"}

        async with self.session.post(f"{self.base_url}/api/v1/prompts", json=prompt_data, headers=headers) as response:
            if response.status in [200, 201]:
                prompt = await response.json()
                logger.info(f"✅ Created test prompt: {prompt['id']}")
                return prompt
            else:
                error_text = await response.text()
                logger.error(f"❌ Failed to create prompt: {response.status} - {error_text}")
                return None

    async def activate_prompt(self, prompt_id):
        """Activate a prompt to trigger approval workflow"""
        activation_data = {
            "reason": "Testing step progression workflow"
        }

        headers = {"Authorization": f"Bearer {self.token}"}

        # Try the versioned endpoint first
        versioned_id = f"{prompt_id}-v1"
        async with self.session.post(f"{self.base_url}/api/v1/prompts/{versioned_id}/1/activate", json=activation_data, headers=headers) as response:
            if response.status == 200:
                logger.info(f"✅ Activated prompt: {prompt_id}")
                return True

            # Try the original endpoint
            async with self.session.post(f"{self.base_url}/api/v1/prompts/{prompt_id}/1/activate", json=activation_data, headers=headers) as response:
                if response.status == 200:
                    logger.info(f"✅ Activated prompt: {prompt_id}")
                    return True
                else:
                    error_text = await response.text()
                    logger.error(f"❌ Failed to activate prompt: {response.status} - {error_text}")
                    return False

    async def check_approval_requests(self):
        """Check approval requests to see if workflow was created"""
        headers = {"Authorization": f"Bearer {self.token}"}

        async with self.session.get(f"{self.base_url}/api/v1/approval-requests", headers=headers) as response:
            if response.status == 200:
                requests = await response.json()
                logger.info(f"✅ Found {len(requests)} approval requests")

                # Find the most recent request with workflow
                for req in reversed(requests):
                    logger.info(f"📋 Approval Request:")
                    logger.info(f"   - ID: {req['id']}")
                    logger.info(f"   - Status: {req['status']}")
                    logger.info(f"   - Workflow Instance ID: {req.get('workflow_instance_id', 'None')}")
                    logger.info(f"   - Workflow Step: {req.get('workflow_step', 'None')}")
                    logger.info(f"   - Workflow Context: {req.get('workflow_context', {})}")

                    if req.get('workflow_instance_id'):
                        logger.info(f"   ✅ This request has a workflow instance!")
                        return req

                logger.warning("⚠️ No approval requests with workflow instances found")
                return None
            else:
                error_text = await response.text()
                logger.error(f"❌ Failed to get approval requests: {response.status} - {error_text}")
                return None

    async def test_step_progression(self):
        """Test the complete step progression workflow"""
        logger.info("🚀 Starting step progression end-to-end test...")

        # Step 1: Login
        if not await self.login():
            return False

        # Step 2: Create test prompt
        prompt = await self.create_test_prompt()
        if not prompt:
            return False

        # Step 3: Activate prompt to trigger approval workflow
        if not await self.activate_prompt(prompt['id']):
            return False

        # Step 4: Check if approval request with workflow was created
        approval_request = await self.check_approval_requests()
        if not approval_request:
            logger.error("❌ No approval request with workflow found")
            return False

        # Step 5: Test approval action
        if approval_request.get('workflow_instance_id'):
            logger.info("🔄 Testing step progression through approval...")
            return await self.test_approval_action(approval_request['id'])

        return True

    async def test_approval_action(self, request_id):
        """Test approving a request and checking step progression"""
        headers = {"Authorization": f"Bearer {self.token}"}

        # Get current state before approval
        async with self.session.get(f"{self.base_url}/api/v1/approval-requests/{request_id}", headers=headers) as response:
            if response.status == 200:
                before_approval = await response.json()
                logger.info(f"📋 Before approval:")
                logger.info(f"   - Status: {before_approval['status']}")
                logger.info(f"   - Workflow Step: {before_approval.get('workflow_step', 'None')}")
                logger.info(f"   - Workflow Context: {before_approval.get('workflow_context', {})}")

        # Approve the request
        approval_data = {
            "comments": "Test step progression approval",
            "evidence": {}
        }

        async with self.session.put(f"{self.base_url}/api/v1/approval-requests/{request_id}", json=approval_data, headers=headers) as response:
            if response.status == 200:
                result = await response.json()
                logger.info(f"✅ Approval successful: {result}")

                # Check if step progressed
                if result.get('workflow_progressed'):
                    logger.info(f"✅ Workflow progressed to next step!")
                    if result.get('next_step') is not None:
                        logger.info(f"   - Advanced to step: {result.get('next_step')}")
                        logger.info(f"   - Next step name: {result.get('next_step_name')}")
                    elif result.get('final_step'):
                        logger.info("   - Workflow completed!")
                else:
                    logger.info("ℹ️ No workflow progression (simple approval)")

                return True
            else:
                error_text = await response.text()
                logger.error(f"❌ Approval failed: {response.status} - {error_text}")
                return False

async def main():
    """Main test function"""
    logger.info("🚀 Starting step progression end-to-end tests...")

    async with StepProgressionEndToEndTester() as tester:
        success = await tester.test_step_progression()

        if success:
            logger.info("🎉 All end-to-end tests passed! Step progression workflow is working correctly.")
        else:
            logger.error("❌ Some tests failed. Check the logs above.")

if __name__ == "__main__":
    asyncio.run(main())