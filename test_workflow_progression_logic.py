#!/usr/bin/env python3
"""
Test script to verify workflow progression logic directly
"""

import asyncio
import json
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import WorkflowDefinition, WorkflowInstance, WorkflowInstanceStatus, ApprovalRequest, Prompt
from app.services.workflow_approval_service import WorkflowApprovalService
from app.auth.rbac import rbac_service, Permission
from datetime import datetime, timezone
import uuid
import structlog

# Configure logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

def test_workflow_progression_logic():
    """Test workflow progression logic directly"""

    # Get database session
    db = next(get_db())

    try:
        logger.info("🚀 Starting workflow progression logic test...")

        # Step 1: Check if workflow definition exists
        workflow_def = db.query(WorkflowDefinition).filter(
            WorkflowDefinition.category == "approval",
            WorkflowDefinition.status == "ACTIVE"
        ).first()

        if not workflow_def:
            logger.error("❌ No active approval workflow definition found")
            return False

        logger.info(f"✅ Found workflow definition: {workflow_def.name}")
        logger.info(f"   - Steps: {len(workflow_def.steps_json)}")
        for i, step in enumerate(workflow_def.steps_json):
            logger.info(f"   - Step {i}: {step['name']} ({step['step_type']})")

        # Step 2: Create a test approval request with workflow
        # Use an existing prompt ID from the database
        existing_prompt = db.query(Prompt).first()
        if not existing_prompt:
            logger.error("❌ No existing prompt found in database")
            return False

        test_prompt_id = existing_prompt.id
        test_user_id = "101750180500836803069"  # Using existing admin user

        # Create workflow instance
        workflow_instance = WorkflowInstance(
            id=str(uuid.uuid4()),
            workflow_definition_id=workflow_def.id,
            status=WorkflowInstanceStatus.PENDING,
            title=f"Test Approval: {test_prompt_id}",
            description=f"Test approval request for {test_prompt_id}",
            resource_type="prompt",
            resource_id=test_prompt_id,
            initiated_by=test_user_id,
            current_step=0,
            context_json={
                "prompt_id": test_prompt_id,
                "prompt_version": "1",
                "prompt_name": "Test Prompt",
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

        logger.info(f"✅ Created test approval request: {approval_request.id}")
        logger.info(f"   - Workflow instance: {workflow_instance.id}")
        logger.info(f"   - Current step: {approval_request.workflow_step}")

        # Step 3: Test workflow context calculation
        logger.info("🔍 Testing workflow context calculation...")

        # Calculate workflow context
        steps_json = workflow_def.steps_json
        total_steps = len(steps_json)
        current_step = approval_request.workflow_step or 0

        # Get current step configuration
        current_step_config = {}
        if current_step < total_steps:
            current_step_config = steps_json[current_step]

        # Get next step configuration
        next_step_config = {}
        if current_step + 1 < total_steps:
            next_step_config = steps_json[current_step + 1]

        # Calculate step progression information
        step_progression = {
            "is_first_step": current_step == 0,
            "is_last_step": current_step >= total_steps - 1,
            "has_next_step": current_step + 1 < total_steps,
            "has_previous_step": current_step > 0,
            "steps_completed": current_step,
            "steps_remaining": total_steps - current_step - 1,
            "progress_percentage": round(((current_step) / total_steps) * 100, 1) if total_steps > 0 else 0
        }

        logger.info("✅ Workflow context calculation:")
        logger.info(f"   - Current step display: {current_step + 1}/{total_steps}")
        logger.info(f"   - Progress percentage: {step_progression['progress_percentage']}%")
        logger.info(f"   - Steps completed: {step_progression['steps_completed']}")
        logger.info(f"   - Steps remaining: {step_progression['steps_remaining']}")
        logger.info(f"   - Is first step: {step_progression['is_first_step']}")
        logger.info(f"   - Is last step: {step_progression['is_last_step']}")
        logger.info(f"   - Has next step: {step_progression['has_next_step']}")

        # Step 4: Test approval action and step progression
        logger.info("🔄 Testing approval action and step progression...")

        # Create workflow approval service
        approval_service = WorkflowApprovalService(db)

        # Test permissions
        permission_result = approval_service.check_workflow_approval_permissions(
            approval_request_id=approval_request.id,
            user_id=test_user_id,
            user_roles=["admin"]  # Admin has all permissions
        )

        if not permission_result.get("has_permission", False):
            logger.error("❌ User lacks approval permissions")
            return False

        logger.info("✅ User has approval permissions")

        # Test approval action
        result = approval_service.process_approval_action(
            approval_request_id=approval_request.id,
            user_id=test_user_id,
            action="approve",
            comments="Test step progression approval",
            evidence={}
        )

        logger.info(f"✅ Approval action result: {result}")

        # Refresh data from database
        db.refresh(approval_request)
        db.refresh(workflow_instance)

        logger.info(f"📋 Post-approval state:")
        logger.info(f"   - Request status: {approval_request.status}")
        logger.info(f"   - Request workflow step: {approval_request.workflow_step}")
        logger.info(f"   - Workflow instance status: {workflow_instance.status}")
        logger.info(f"   - Workflow instance current step: {workflow_instance.current_step}")

        # Verify step progression
        if result.get("workflow_progressed"):
            if result.get("final_step"):
                logger.info("✅ Workflow completed successfully!")
            else:
                logger.info(f"✅ Workflow advanced to step {result.get('next_step')}: {result.get('next_step_name')}")

                # Test the new step's permissions
                new_permission_result = approval_service.check_workflow_approval_permissions(
                    approval_request_id=approval_request.id,
                    user_id=test_user_id,
                    user_roles=["admin"]
                )

                logger.info(f"   - New step permissions: {new_permission_result}")
                logger.info(f"   - Current step name: {new_permission_result.get('current_step_name')}")

                # Test second approval to complete workflow
                logger.info("🔄 Testing second approval to complete workflow...")
                result2 = approval_service.process_approval_action(
                    approval_request_id=approval_request.id,
                    user_id=test_user_id,
                    action="approve",
                    comments="Final approval step",
                    evidence={}
                )

                logger.info(f"✅ Final approval result: {result2}")

                # Refresh data
                db.refresh(approval_request)
                db.refresh(workflow_instance)

                logger.info(f"📋 Final state:")
                logger.info(f"   - Request status: {approval_request.status}")
                logger.info(f"   - Workflow instance status: {workflow_instance.status}")
                logger.info(f"   - Workflow instance current step: {workflow_instance.current_step}")
        else:
            logger.info("ℹ️ No workflow progression occurred")

        # Cleanup
        logger.info("🧹 Cleaning up test data...")
        db.delete(approval_request)
        db.delete(workflow_instance)
        db.commit()

        logger.info("🎉 Workflow progression logic test completed successfully!")
        return True

    except Exception as e:
        logger.error(f"❌ Error in workflow progression test: {str(e)}")
        db.rollback()
        return False

    finally:
        db.close()

if __name__ == "__main__":
    success = test_workflow_progression_logic()
    if success:
        print("🎉 All tests passed!")
    else:
        print("❌ Some tests failed!")