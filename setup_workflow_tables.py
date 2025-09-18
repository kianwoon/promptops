#!/usr/bin/env python3
"""
Setup script for initializing workflow-related database tables
"""

import asyncio
import logging
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.database import engine, get_db
from app.models import Base
import structlog

logger = structlog.get_logger(__name__)

class WorkflowSetup:
    """
    Setup and configuration for workflow system
    """

    def __init__(self):
        self.db = next(get_db())

    def setup_workflow_tables(self):
        """Create workflow tables if they don't exist"""
        try:
            logger.info("Setting up workflow database tables")

            # Import all workflow models to ensure they're registered with Base.metadata
            from app.models import (
                WorkflowDefinition, WorkflowInstance, WorkflowStep, WorkflowTemplate,
                WorkflowStepExecution, WorkflowEscalationRule, WorkflowNotification,
                WorkflowMetrics, WorkflowStatus, WorkflowInstanceStatus, WorkflowStepType,
                WorkflowTemplateStatus, WorkflowStepStatus, WorkflowEscalationType,
                WorkflowNotificationType, WorkflowConditionType
            )

            # Create workflow tables
            Base.metadata.create_all(bind=engine)

            logger.info("Workflow database tables created successfully")

        except Exception as e:
            logger.error("Failed to create workflow tables", error=str(e))
            raise

    def verify_workflow_tables(self):
        """Verify that workflow tables exist"""
        try:
            logger.info("Verifying workflow tables")

            required_tables = [
                'workflow_definitions',
                'workflow_instances',
                'workflow_steps',
                'workflow_templates',
                'workflow_step_executions',
                'workflow_escalation_rules',
                'workflow_notifications',
                'workflow_metrics'
            ]

            with engine.connect() as conn:
                result = conn.execute(text("""
                    SELECT table_name
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                """))
                existing_tables = {row[0] for row in result}

            missing_tables = set(required_tables) - existing_tables
            extra_tables = existing_tables - set(required_tables)

            if missing_tables:
                logger.error("Missing workflow tables", missing=list(missing_tables))
                return False

            logger.info("Workflow tables verification completed",
                       existing_tables=len(existing_tables & set(required_tables)),
                       missing_tables=len(missing_tables))
            return len(missing_tables) == 0

        except Exception as e:
            logger.error("Failed to verify workflow tables", error=str(e))
            return False

    def setup_default_workflow_templates(self):
        """Create default workflow templates"""
        try:
            logger.info("Setting up default workflow templates")

            # Import here to avoid circular imports
            from app.models import WorkflowTemplate, WorkflowTemplateStatus

            default_templates = [
                {
                    "id": "prompt-approval-template",
                    "name": "Prompt Approval Workflow",
                    "description": "Standard workflow for approving new prompts",
                    "category": "approval",
                    "use_case": "prompt_approval",
                    "template_config": {
                        "steps": [
                            {
                                "step_type": "manual_approval",
                                "name": "Manager Review",
                                "description": "Review prompt for compliance and quality",
                                "required_roles": ["admin", "manager"],
                                "timeout_minutes": 1440
                            },
                            {
                                "step_type": "notification",
                                "name": "Notify Creator",
                                "description": "Inform prompt creator of approval decision",
                                "recipient_type": "user",
                                "recipient_field": "created_by"
                            }
                        ],
                        "timeout_minutes": 2880,
                        "requires_evidence": False
                    },
                    "status": WorkflowTemplateStatus.ACTIVE,
                    "version": "1.0.0"
                },
                {
                    "id": "user-access-request-template",
                    "name": "User Access Request",
                    "description": "Workflow for approving new user access requests",
                    "category": "access_control",
                    "use_case": "user_access",
                    "template_config": {
                        "steps": [
                            {
                                "step_type": "manual_approval",
                                "name": "Security Review",
                                "description": "Review access request for security compliance",
                                "required_roles": ["security_admin"],
                                "timeout_minutes": 720
                            },
                            {
                                "step_type": "manual_approval",
                                "name": "Manager Approval",
                                "description": "Manager approval for access request",
                                "required_roles": ["manager"],
                                "timeout_minutes": 1440
                            }
                        ],
                        "timeout_minutes": 2160,
                        "requires_evidence": True
                    },
                    "status": WorkflowTemplateStatus.ACTIVE,
                    "version": "1.0.0"
                },
                {
                    "id": "api-key-request-template",
                    "name": "API Key Request",
                    "description": "Workflow for approving API key requests",
                    "category": "security",
                    "use_case": "api_key_request",
                    "template_config": {
                        "steps": [
                            {
                                "step_type": "manual_approval",
                                "name": "Technical Review",
                                "description": "Review technical requirements for API key",
                                "required_roles": ["technical_lead"],
                                "timeout_minutes": 720
                            },
                            {
                                "step_type": "manual_approval",
                                "name": "Security Approval",
                                "description": "Security review of API key request",
                                "required_roles": ["security_admin"],
                                "timeout_minutes": 1440
                            }
                        ],
                        "timeout_minutes": 2160,
                        "requires_evidence": True
                    },
                    "status": WorkflowTemplateStatus.ACTIVE,
                    "version": "1.0.0"
                }
            ]

            for template_config in default_templates:
                # Check if template already exists
                existing = self.db.query(WorkflowTemplate).filter(
                    WorkflowTemplate.id == template_config["id"]
                ).first()

                if not existing:
                    from app.models import WorkflowTemplate
                    template = WorkflowTemplate(**template_config)
                    self.db.add(template)
                    logger.info("Created workflow template", name=template_config["name"])

            self.db.commit()
            logger.info("Default workflow templates setup completed")

        except Exception as e:
            logger.error("Failed to setup default workflow templates", error=str(e))
            raise

    def run_setup(self, create_templates: bool = True):
        """Run complete workflow setup"""
        try:
            logger.info("Starting PromptOps workflow setup")

            # Step 1: Setup workflow tables
            self.setup_workflow_tables()

            # Step 2: Setup default templates (optional)
            if create_templates:
                self.setup_default_workflow_templates()

            # Step 3: Verify setup
            verification_passed = self.verify_workflow_tables()

            if not verification_passed:
                raise Exception("Workflow setup verification failed")

            logger.info("Workflow setup completed successfully")

            # Return setup summary
            return {
                "status": "completed",
                "tables_created": True,
                "templates_created": create_templates,
                "verification_passed": verification_passed,
                "timestamp": datetime.utcnow().isoformat()
            }

        except Exception as e:
            logger.error("Workflow setup failed", error=str(e))
            raise

def main():
    """Main setup function"""
    try:
        setup = WorkflowSetup()

        # Run complete setup
        result = setup.run_setup(create_templates=True)

        print("✅ PromptOps Workflow Setup Completed")
        print(f"Status: {result['status']}")
        print(f"Tables Created: {result['tables_created']}")
        print(f"Templates Created: {result['templates_created']}")
        print(f"Verification Passed: {result['verification_passed']}")

        return result

    except Exception as e:
        logger.error("Workflow setup failed", error=str(e))
        print(f"❌ Workflow setup failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()