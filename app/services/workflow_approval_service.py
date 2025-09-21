"""
Workflow-aware approval service that integrates approval requests with workflow steps
"""

import logging
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import uuid

from app.models import (
    ApprovalRequest, WorkflowDefinition, WorkflowInstance,
    WorkflowInstanceStatus, WorkflowStep, WorkflowStepStatus,
    User, AuditLog
)
from app.auth.rbac import rbac_service, Permission

logger = logging.getLogger(__name__)

class WorkflowApprovalService:
    """
    Service that handles approval requests within the context of workflow steps
    """

    def __init__(self, db: Session):
        self.db = db

    def create_approval_request_with_workflow(
        self,
        prompt_id: str,
        requested_by: str,
        workflow_definition_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> ApprovalRequest:
        """
        Create an approval request that's integrated with a workflow

        Args:
            prompt_id: The prompt being approved
            requested_by: User ID of the requester
            workflow_definition_id: Optional specific workflow to use
            context: Additional context for the workflow

        Returns:
            Created ApprovalRequest with workflow integration
        """
        try:
            # Find appropriate workflow definition
            workflow_def = self._find_workflow_definition(prompt_id, workflow_definition_id)

            if workflow_def:
                # Create workflow instance
                workflow_instance = self._create_workflow_instance(
                    workflow_def,
                    prompt_id,
                    requested_by,
                    context
                )

                # Get first step requirements
                first_step = self._get_workflow_step(workflow_def, 0)

                # Create approval request with workflow context
                approval_request = ApprovalRequest(
                    id=str(uuid.uuid4()),
                    prompt_id=prompt_id,
                    requested_by=requested_by,
                    requested_at=datetime.now(timezone.utc),
                    status="pending",
                    workflow_instance_id=workflow_instance.id,
                    workflow_step=0,  # First step
                    evidence_required=workflow_def.requires_evidence,
                    tenant_id=workflow_def.tenant_id
                )

                self.db.add(approval_request)
                self.db.commit()
                self.db.refresh(approval_request)

                logger.info(
                    "Created workflow-integrated approval request",
                    request_id=approval_request.id,
                    workflow_instance_id=workflow_instance.id,
                    current_step=0
                )

                return approval_request
            else:
                # Fallback to simple approval request without workflow
                approval_request = ApprovalRequest(
                    id=str(uuid.uuid4()),
                    prompt_id=prompt_id,
                    requested_by=requested_by,
                    requested_at=datetime.now(timezone.utc),
                    status="pending",
                    workflow_instance_id=None,
                    workflow_step=None,
                    evidence_required=False,
                    tenant_id="default"  # Should be from user context
                )

                self.db.add(approval_request)
                self.db.commit()
                self.db.refresh(approval_request)

                logger.info("Created simple approval request (no workflow)")
                return approval_request

        except Exception as e:
            self.db.rollback()
            logger.error(f"Error creating workflow approval request: {str(e)}")
            raise

    def check_workflow_approval_permissions(
        self,
        approval_request_id: str,
        user_id: str,
        user_roles: List[str]
    ) -> Dict[str, Any]:
        """
        Check if user has permission to approve/reject at the current workflow step

        Args:
            approval_request_id: ID of the approval request
            user_id: User ID of the approver
            user_roles: List of user roles

        Returns:
            Dictionary with permission details
        """
        try:
            # Get the approval request
            request = self.db.query(ApprovalRequest).filter(
                ApprovalRequest.id == approval_request_id
            ).first()

            if not request:
                raise ValueError("Approval request not found")

            # Check basic approval permissions first
            can_approve = rbac_service.can_perform_action(
                user_roles=user_roles,
                action=Permission.APPROVE_PROMPT.value,
                resource_type="approval_request"
            )

            can_reject = rbac_service.can_perform_action(
                user_roles=user_roles,
                action=Permission.REJECT_PROMPT.value,
                resource_type="approval_request"
            )

            # If no workflow integration, use basic permissions
            if not request.workflow_instance_id:
                return {
                    "has_permission": can_approve or can_reject,
                    "can_approve": can_approve,
                    "can_reject": can_reject,
                    "reason": "Basic approval permissions",
                    "current_step": None,
                    "required_roles": ["admin", "approver"]
                }

            # Get workflow instance and current step
            workflow_instance = self.db.query(WorkflowInstance).filter(
                WorkflowInstance.id == request.workflow_instance_id
            ).first()

            if not workflow_instance:
                raise ValueError("Workflow instance not found")

            workflow_def = self.db.query(WorkflowDefinition).filter(
                WorkflowDefinition.id == workflow_instance.workflow_definition_id
            ).first()

            if not workflow_def:
                raise ValueError("Workflow definition not found")

            # Get current step configuration
            current_step_config = self._get_workflow_step(workflow_def, request.workflow_step)

            # Check if user is assigned to this step
            step_required_roles = current_step_config.get("approval_roles", [])
            step_required_users = current_step_config.get("approval_users", [])

            user_has_step_access = (
                user_id in step_required_users or
                any(role in step_required_roles for role in user_roles)
            )

            # Combine basic and step-specific permissions
            final_can_approve = can_approve and user_has_step_access
            final_can_reject = can_reject and user_has_step_access

            return {
                "has_permission": final_can_approve or final_can_reject,
                "can_approve": final_can_approve,
                "can_reject": final_can_reject,
                "reason": f"Step {request.workflow_step} workflow permissions",
                "current_step": request.workflow_step,
                "current_step_name": current_step_config.get("name", f"Step {request.workflow_step}"),
                "required_roles": step_required_roles,
                "required_users": step_required_users,
                "workflow_instance_id": request.workflow_instance_id
            }

        except Exception as e:
            logger.error(f"Error checking workflow approval permissions: {str(e)}")
            raise

    def process_approval_action(
        self,
        approval_request_id: str,
        user_id: str,
        action: str,  # "approve" or "reject"
        comments: Optional[str] = None,
        evidence: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Process an approval action with workflow progression

        Args:
            approval_request_id: ID of the approval request
            user_id: User ID of the approver
            action: "approve" or "reject"
            comments: Optional comments
            evidence: Optional evidence for approval

        Returns:
            Result of the approval action
        """
        try:
            # Get the approval request
            request = self.db.query(ApprovalRequest).filter(
                ApprovalRequest.id == approval_request_id
            ).first()

            if not request:
                raise ValueError("Approval request not found")

            # Check if request is in approvable state
            if request.status not in ["pending", "under_review"]:
                raise ValueError(f"Cannot {action} request with status '{request.status}'")

            # Process approval
            if action == "approve":
                return self._process_approval(request, user_id, comments, evidence)
            elif action == "reject":
                return self._process_rejection(request, user_id, comments, evidence)
            else:
                raise ValueError(f"Invalid action: {action}")

        except Exception as e:
            self.db.rollback()
            logger.error(f"Error processing approval action: {str(e)}")
            raise

    def _find_workflow_definition(
        self,
        prompt_id: str,
        workflow_definition_id: Optional[str] = None
    ) -> Optional[WorkflowDefinition]:
        """Find the appropriate workflow definition for a prompt"""
        if workflow_definition_id:
            return self.db.query(WorkflowDefinition).filter(
                WorkflowDefinition.id == workflow_definition_id,
                WorkflowDefinition.status == "ACTIVE"
            ).first()

        # Find by trigger condition (could be enhanced based on prompt type, category, etc.)
        # For now, look for active approval workflows
        return self.db.query(WorkflowDefinition).filter(
            WorkflowDefinition.category == "approval",
            WorkflowDefinition.status == "ACTIVE"
        ).first()

    def _create_workflow_instance(
        self,
        workflow_def: WorkflowDefinition,
        prompt_id: str,
        requested_by: str,
        context: Optional[Dict[str, Any]] = None
    ) -> WorkflowInstance:
        """Create a new workflow instance"""
        workflow_instance = WorkflowInstance(
            id=str(uuid.uuid4()),
            workflow_definition_id=workflow_def.id,
            status=WorkflowInstanceStatus.PENDING,
            title=f"Approval for prompt {prompt_id}",
            description=f"Workflow approval for prompt {prompt_id}",
            resource_type="prompt",
            resource_id=prompt_id,
            initiated_by=requested_by,
            current_step=0,
            context_json=context or {},
            steps_json=workflow_def.steps_json,
            tenant_id=workflow_def.tenant_id
        )

        self.db.add(workflow_instance)
        self.db.flush()  # Get the ID without committing

        return workflow_instance

    def _get_workflow_step(self, workflow_def: WorkflowDefinition, step_index: int) -> Dict[str, Any]:
        """Get the configuration for a specific workflow step"""
        if step_index >= len(workflow_def.steps_json):
            raise ValueError(f"Step {step_index} does not exist in workflow")

        return workflow_def.steps_json[step_index]

    def _process_approval(
        self,
        request: ApprovalRequest,
        user_id: str,
        comments: Optional[str],
        evidence: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Process an approval action"""
        request.status = "approved"
        request.approver = user_id
        request.approved_at = datetime.now(timezone.utc)
        request.comments = comments

        if evidence:
            if request.evidence:
                request.evidence.update(evidence)
            else:
                request.evidence = evidence

        # Handle workflow progression
        if request.workflow_instance_id:
            result = self._advance_workflow(request, user_id)
        else:
            result = {
                "status": "approved",
                "message": "Request approved successfully",
                "workflow_progressed": False
            }

        self.db.commit()

        # Log the approval
        self._log_approval_action(request, user_id, "approve", comments)

        return result

    def _process_rejection(
        self,
        request: ApprovalRequest,
        user_id: str,
        comments: Optional[str],
        evidence: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Process a rejection action"""
        request.status = "rejected"
        request.approver = user_id
        request.approved_at = datetime.now(timezone.utc)
        request.comments = comments

        if evidence:
            if request.evidence:
                request.evidence.update(evidence)
            else:
                request.evidence = evidence

        # Handle workflow rejection
        if request.workflow_instance_id:
            result = self._reject_workflow(request, user_id)
        else:
            result = {
                "status": "rejected",
                "message": "Request rejected successfully",
                "workflow_progressed": False
            }

        self.db.commit()

        # Log the rejection
        self._log_approval_action(request, user_id, "reject", comments)

        return result

    def _advance_workflow(self, request: ApprovalRequest, user_id: str) -> Dict[str, Any]:
        """Advance the workflow to the next step"""
        import logging
        logger = logging.getLogger(__name__)

        logger.info(f"🔄 [WORKFLOW_ADVANCEMENT] Starting step advancement for request {request.id}")
        logger.info(f"🔄 [WORKFLOW_ADVANCEMENT] Current workflow_step: {request.workflow_step}")

        workflow_instance = self.db.query(WorkflowInstance).filter(
            WorkflowInstance.id == request.workflow_instance_id
        ).first()

        if not workflow_instance:
            logger.error(f"❌ [WORKFLOW_ADVANCEMENT] Workflow instance not found for request {request.id}")
            raise ValueError("Workflow instance not found")

        workflow_def = self.db.query(WorkflowDefinition).filter(
            WorkflowDefinition.id == workflow_instance.workflow_definition_id
        ).first()

        if not workflow_def:
            logger.error(f"❌ [WORKFLOW_ADVANCEMENT] Workflow definition not found for instance {workflow_instance.id}")
            raise ValueError("Workflow definition not found")

        current_step = request.workflow_step
        next_step = current_step + 1

        logger.info(f"🔄 [WORKFLOW_ADVANCEMENT] Step advancement details:")
        logger.info(f"  - Request ID: {request.id}")
        logger.info(f"  - Workflow Instance ID: {workflow_instance.id}")
        logger.info(f"  - Workflow Definition ID: {workflow_def.id}")
        logger.info(f"  - Current Step: {current_step}")
        logger.info(f"  - Next Step: {next_step}")
        logger.info(f"  - Total Steps in Definition: {len(workflow_def.steps_json) if workflow_def.steps_json else 0}")
        logger.info(f"  - Workflow Instance Current Step: {workflow_instance.current_step}")

        if workflow_def.steps_json:
            logger.info(f"  - Steps JSON: {workflow_def.steps_json}")
        else:
            logger.warning(f"  - ⚠️  Steps JSON is empty or None!")

        # Check if this is the last step
        logger.info(f"🔍 [STEP_DECISION] Checking if next_step ({next_step}) is beyond final step")
        logger.info(f"  - Total steps: {len(workflow_def.steps_json)}")
        logger.info(f"  - Final step index: {len(workflow_def.steps_json) - 1}")
        logger.info(f"  - Is beyond final step: {next_step >= len(workflow_def.steps_json)}")

        if next_step >= len(workflow_def.steps_json):
            # Complete the workflow
            logger.info(f"🎯 [WORKFLOW_COMPLETION] Completing workflow for request {request.id}")
            logger.info(f"  - Next step ({next_step}) >= total steps - 1 ({len(workflow_def.steps_json) - 1})")
            logger.info(f"  - Setting workflow instance status to COMPLETED")
            logger.info(f"  - This was the final step in the workflow")

            workflow_instance.status = WorkflowInstanceStatus.COMPLETED
            workflow_instance.current_step = len(workflow_def.steps_json) - 1
            workflow_instance.completed_at = datetime.now(timezone.utc)

            logger.info(f"✅ [WORKFLOW_COMPLETION] Workflow completed successfully")
            logger.info(f"  - Final step: {workflow_instance.current_step}")
            logger.info(f"  - Completed at: {workflow_instance.completed_at}")

            return {
                "status": "completed",
                "message": "Request approved and workflow completed",
                "workflow_progressed": True,
                "final_step": True
            }
        else:
            # Move to next step
            logger.info(f"➡️ [WORKFLOW_ADVANCEMENT] Advancing to next step for request {request.id}")
            logger.info(f"  - Current step: {current_step} → Next step: {next_step}")
            logger.info(f"  - Setting workflow_instance.current_step to {next_step}")

            workflow_instance.current_step = next_step
            workflow_instance.updated_at = datetime.now(timezone.utc)

            # Update approval request for next step
            logger.info(f"  - Updating approval request workflow_step to {next_step}")
            logger.info(f"  - Resetting approval request status to 'pending'")

            request.workflow_step = next_step
            request.status = "pending"  # Reset for next step approval

            # Get next step configuration
            next_step_config = self._get_workflow_step(workflow_def, next_step)
            next_step_name = next_step_config.get('name', f'Step {next_step}')

            logger.info(f"✅ [WORKFLOW_ADVANCEMENT] Successfully advanced to next step")
            logger.info(f"  - Next step name: {next_step_name}")
            logger.info(f"  - Next step order: {next_step_config.get('order', 'N/A')}")
            logger.info(f"  - Next step type: {next_step_config.get('step_type', 'N/A')}")

            return {
                "status": "advanced",
                "message": f"Request approved, advanced to step {next_step}: {next_step_name}",
                "workflow_progressed": True,
                "next_step": next_step,
                "next_step_name": next_step_name
            }

    def _reject_workflow(self, request: ApprovalRequest, user_id: str) -> Dict[str, Any]:
        """Handle workflow rejection"""
        workflow_instance = self.db.query(WorkflowInstance).filter(
            WorkflowInstance.id == request.workflow_instance_id
        ).first()

        if workflow_instance:
            workflow_instance.status = WorkflowInstanceStatus.REJECTED
            workflow_instance.updated_at = datetime.now(timezone.utc)

        return {
            "status": "rejected",
            "message": "Request rejected and workflow terminated",
            "workflow_progressed": True
        }

    def _log_approval_action(self, request: ApprovalRequest, user_id: str, action: str, comments: Optional[str]):
        """Log approval actions for audit trail"""
        audit_log = AuditLog(
            id=str(uuid.uuid4()),
            actor=user_id,
            action=f"approval_{action}",
            subject=request.id,
            subject_type="approval_request",
            subject_id=request.id,
            tenant_id=request.tenant_id,
            before_json={"status": "pending"},
            after_json={
                "status": request.status,
                "approver": request.approver,
                "workflow_step": request.workflow_step,
                "comments": comments
            },
            result="success"
        )

        self.db.add(audit_log)