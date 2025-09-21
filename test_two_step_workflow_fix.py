#!/usr/bin/env python3
"""
Test script to verify the fix for 2-step approval workflow issue.
This test specifically addresses the bug where 2-step workflows
completed after only 1 approval instead of requiring 2 approvals.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.workflow_approval_service import WorkflowApprovalService
from app.models import WorkflowInstanceStatus, WorkflowDefinition, WorkflowInstance, ApprovalRequest, Prompt
from app.database import SessionLocal
from datetime import datetime, timezone
import uuid

def setup_test_data(db):
    """Setup test data for 2-step workflow test"""
    # Find existing 2-step workflow definition
    workflow_def = db.query(WorkflowDefinition).filter(
        WorkflowDefinition.category == "approval",
        WorkflowDefinition.status == "ACTIVE"
    ).first()

    if not workflow_def:
        raise Exception("No active approval workflow definition found")

    # Check if it has exactly 2 steps
    if len(workflow_def.steps_json) != 2:
        raise Exception(f"Expected 2-step workflow, found {len(workflow_def.steps_json)} steps")

    # Use an existing prompt
    existing_prompt = db.query(Prompt).first()
    if not existing_prompt:
        raise Exception("No existing prompt found in database")

    test_user_id = "101750180500836803069"  # Using existing admin user
    test_prompt_id = existing_prompt.id

    # Create workflow instance
    workflow_instance = WorkflowInstance(
        id=str(uuid.uuid4()),
        workflow_definition_id=workflow_def.id,
        status=WorkflowInstanceStatus.PENDING,
        title=f"Test 2-Step Approval: {test_prompt_id}",
        description=f"Test 2-step approval request for {test_prompt_id}",
        resource_type="prompt",
        resource_id=test_prompt_id,
        initiated_by=test_user_id,
        current_step=0,
        context_json={
            "prompt_id": test_prompt_id,
            "prompt_version": "1",
            "prompt_name": "Test 2-Step Prompt",
            "requested_by": test_user_id,
            "test_mode": True
        },
        steps_json=workflow_def.steps_json,
        tenant_id="demo-tenant"
    )

    db.add(workflow_instance)
    db.flush()

    # Create approval request
    approval_request = ApprovalRequest(
        id=str(uuid.uuid4()),
        prompt_id=test_prompt_id,
        requested_by=test_user_id,
        requested_at=datetime.now(timezone.utc),
        status="pending",
        workflow_instance_id=workflow_instance.id,
        workflow_step=0,
        evidence_required=False,
        auto_approve=False,
        escalation_level=0,
        tenant_id="demo-tenant"
    )

    db.add(approval_request)
    db.commit()
    db.refresh(approval_request)
    db.refresh(workflow_instance)

    return test_user_id, workflow_def, approval_request, workflow_instance

def test_two_step_workflow_fix():
    """Test that 2-step workflows require exactly 2 approvals"""
    print("🧪 Testing 2-step workflow fix...")

    db = SessionLocal()
    approval_service = WorkflowApprovalService(db)

    try:
        # Setup test data
        test_user_id, workflow_def, approval_request, workflow_instance = setup_test_data(db)

        print(f"📋 Initial state:")
        print(f"   - Workflow Definition ID: {workflow_def.id}")
        print(f"   - Workflow Definition Steps: {len(workflow_def.steps_json)}")
        print(f"   - Approval Request ID: {approval_request.id}")
        print(f"   - Workflow Instance ID: {workflow_instance.id}")
        print(f"   - Initial workflow step: {approval_request.workflow_step}")
        print(f"   - Initial workflow status: {workflow_instance.status}")

        # Verify it's a 2-step workflow
        assert len(workflow_def.steps_json) == 2, f"Expected 2 steps, got {len(workflow_def.steps_json)}"
        print("✅ Confirmed: This is a 2-step workflow")

        # First approval
        print("\n🔄 Step 1: Processing first approval...")
        result1 = approval_service.process_approval_action(
            approval_request_id=approval_request.id,
            user_id=test_user_id,
            action="approve",
            comments="First approval step",
            evidence={}
        )

        print(f"   - First approval result: {result1}")

        # Refresh data
        db.refresh(approval_request)
        db.refresh(workflow_instance)

        print(f"   - Request status after first approval: {approval_request.status}")
        print(f"   - Workflow instance status after first approval: {workflow_instance.status}")
        print(f"   - Workflow instance current step after first approval: {workflow_instance.current_step}")
        print(f"   - Approval request workflow step after first approval: {approval_request.workflow_step}")

        # CRITICAL CHECK: Workflow should NOT be completed after first approval
        assert workflow_instance.status != WorkflowInstanceStatus.COMPLETED, "❌ BUG: Workflow completed after first approval!"
        assert approval_request.status == "pending", "❌ BUG: Approval request should be pending for next step!"
        assert workflow_instance.current_step == 1, f"❌ BUG: Expected step 1, got {workflow_instance.current_step}"
        assert approval_request.workflow_step == 1, f"❌ BUG: Expected workflow step 1, got {approval_request.workflow_step}"

        print("✅ SUCCESS: Workflow correctly advanced to step 1 (second step)")

        # Second approval
        print("\n🔄 Step 2: Processing second approval...")
        result2 = approval_service.process_approval_action(
            approval_request_id=approval_request.id,
            user_id=test_user_id,
            action="approve",
            comments="Second approval step",
            evidence={}
        )

        print(f"   - Second approval result: {result2}")

        # Refresh data
        db.refresh(approval_request)
        db.refresh(workflow_instance)

        print(f"   - Request status after second approval: {approval_request.status}")
        print(f"   - Workflow instance status after second approval: {workflow_instance.status}")
        print(f"   - Workflow instance current step after second approval: {workflow_instance.current_step}")
        print(f"   - Workflow instance completed at: {workflow_instance.completed_at}")

        # CRITICAL CHECK: Workflow should NOW be completed after second approval
        assert workflow_instance.status == WorkflowInstanceStatus.COMPLETED, "❌ BUG: Workflow should be completed after second approval!"
        assert approval_request.status == "approved", "❌ BUG: Approval request should be approved!"
        assert workflow_instance.current_step == 1, f"❌ BUG: Final step should be 1, got {workflow_instance.current_step}"
        assert workflow_instance.completed_at is not None, "❌ BUG: Workflow should have completion timestamp!"

        print("✅ SUCCESS: Workflow correctly completed after second approval")
        print("\n🎉 FIX VERIFIED: 2-step workflow now requires exactly 2 approvals!")

        return True

    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

    finally:
        db.close()

if __name__ == "__main__":
    success = test_two_step_workflow_fix()
    if success:
        print("\n✅ All tests passed - the fix is working correctly!")
        sys.exit(0)
    else:
        print("\n❌ Tests failed - the fix needs more work!")
        sys.exit(1)