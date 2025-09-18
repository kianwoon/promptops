#!/usr/bin/env python3
"""
Direct SQL script to create workflow tables
This script creates the workflow tables using direct SQL statements
"""

import sys
import logging
from datetime import datetime
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

from app.database import engine
from app.config import settings
import structlog

logger = structlog.get_logger(__name__)

def create_workflow_tables_direct():
    """Create workflow tables using direct SQL statements"""
    try:
        logger.info("Creating workflow tables using direct SQL")

        with engine.connect() as conn:
            # Create workflow_definitions table
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS workflow_definitions (
                    id VARCHAR PRIMARY KEY,
                    name VARCHAR NOT NULL,
                    description VARCHAR,
                    version VARCHAR NOT NULL,
                    status VARCHAR NOT NULL DEFAULT 'draft',
                    category VARCHAR NOT NULL,
                    trigger_condition JSON NOT NULL,
                    steps_json JSON NOT NULL,
                    timeout_minutes INTEGER DEFAULT 1440,
                    requires_evidence BOOLEAN DEFAULT FALSE,
                    auto_approve_threshold INTEGER,
                    escalation_rules JSON,
                    notification_settings JSON,
                    created_by VARCHAR NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    is_template BOOLEAN DEFAULT FALSE
                );
            """))

            # Create workflow_instances table
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS workflow_instances (
                    id VARCHAR PRIMARY KEY,
                    workflow_definition_id VARCHAR NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
                    status VARCHAR NOT NULL DEFAULT 'pending',
                    title VARCHAR NOT NULL,
                    description VARCHAR,
                    resource_type VARCHAR NOT NULL,
                    resource_id VARCHAR NOT NULL,
                    initiated_by VARCHAR NOT NULL REFERENCES users(id) ON DELETE SET NULL,
                    current_step_number INTEGER DEFAULT 0,
                    context_data JSON,
                    evidence_data JSON,
                    started_at TIMESTAMP,
                    completed_at TIMESTAMP,
                    deadline TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    tenant_id VARCHAR
                );
            """))

            # Create workflow_steps table
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS workflow_steps (
                    id VARCHAR PRIMARY KEY,
                    workflow_definition_id VARCHAR NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
                    step_type VARCHAR NOT NULL,
                    step_number INTEGER NOT NULL,
                    name VARCHAR NOT NULL,
                    description VARCHAR,
                    config JSON NOT NULL,
                    required_roles JSON,
                    required_users JSON,
                    timeout_minutes INTEGER DEFAULT 1440,
                    is_conditional BOOLEAN DEFAULT FALSE,
                    condition_config JSON,
                    escalation_rules JSON,
                    notification_settings JSON,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """))

            # Create workflow_templates table
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS workflow_templates (
                    id VARCHAR PRIMARY KEY,
                    name VARCHAR NOT NULL,
                    description VARCHAR,
                    category VARCHAR NOT NULL,
                    use_case VARCHAR NOT NULL,
                    template_config JSON NOT NULL,
                    status VARCHAR NOT NULL DEFAULT 'draft',
                    version VARCHAR NOT NULL,
                    created_by VARCHAR NOT NULL REFERENCES users(id) ON DELETE SET NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    usage_count INTEGER DEFAULT 0
                );
            """))

            # Create workflow_step_executions table
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS workflow_step_executions (
                    id VARCHAR PRIMARY KEY,
                    workflow_instance_id VARCHAR NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
                    workflow_step_id VARCHAR REFERENCES workflow_steps(id) ON DELETE SET NULL,
                    step_number INTEGER NOT NULL,
                    step_type VARCHAR NOT NULL,
                    status VARCHAR NOT NULL DEFAULT 'pending',
                    assigned_to VARCHAR REFERENCES users(id) ON DELETE SET NULL,
                    assigned_role VARCHAR,
                    started_at TIMESTAMP,
                    completed_at TIMESTAMP,
                    execution_result JSON,
                    error_message VARCHAR,
                    evidence_data JSON,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    executed_by VARCHAR REFERENCES users(id) ON DELETE SET NULL
                );
            """))

            # Create workflow_escalation_rules table
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS workflow_escalation_rules (
                    id VARCHAR PRIMARY KEY,
                    workflow_definition_id VARCHAR NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
                    step_number INTEGER,
                    escalation_type VARCHAR NOT NULL,
                    trigger_condition JSON NOT NULL,
                    escalation_config JSON NOT NULL,
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """))

            # Create workflow_notifications table
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS workflow_notifications (
                    id VARCHAR PRIMARY KEY,
                    workflow_instance_id VARCHAR NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
                    step_execution_id VARCHAR REFERENCES workflow_step_executions(id) ON DELETE SET NULL,
                    notification_type VARCHAR NOT NULL,
                    recipient_type VARCHAR NOT NULL,
                    recipient_value VARCHAR NOT NULL,
                    subject VARCHAR,
                    message VARCHAR,
                    status VARCHAR NOT NULL DEFAULT 'pending',
                    sent_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """))

            # Create workflow_metrics table
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS workflow_metrics (
                    id VARCHAR PRIMARY KEY,
                    workflow_definition_id VARCHAR NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
                    workflow_instance_id VARCHAR REFERENCES workflow_instances(id) ON DELETE SET NULL,
                    tenant_id VARCHAR NOT NULL,
                    total_duration_minutes INTEGER,
                    step_count INTEGER,
                    approval_count INTEGER,
                    rejection_count INTEGER,
                    escalation_count INTEGER,
                    average_step_duration_minutes INTEGER,
                    success_rate FLOAT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    metric_date DATE NOT NULL
                );
            """))

            # Create indexes for better performance
            indexes = [
                "CREATE INDEX IF NOT EXISTS idx_workflow_definitions_status ON workflow_definitions(status);",
                "CREATE INDEX IF NOT EXISTS idx_workflow_definitions_category ON workflow_definitions(category);",
                "CREATE INDEX IF NOT EXISTS idx_workflow_instances_status ON workflow_instances(status);",
                "CREATE INDEX IF NOT EXISTS idx_workflow_instances_resource ON workflow_instances(resource_type, resource_id);",
                "CREATE INDEX IF NOT EXISTS idx_workflow_instances_initiated_by ON workflow_instances(initiated_by);",
                "CREATE INDEX IF NOT EXISTS idx_workflow_instances_tenant ON workflow_instances(tenant_id);",
                "CREATE INDEX IF NOT EXISTS idx_workflow_steps_definition ON workflow_steps(workflow_definition_id);",
                "CREATE INDEX IF NOT EXISTS idx_workflow_steps_type ON workflow_steps(step_type);",
                "CREATE INDEX IF NOT EXISTS idx_workflow_step_executions_instance ON workflow_step_executions(workflow_instance_id);",
                "CREATE INDEX IF NOT EXISTS idx_workflow_step_executions_status ON workflow_step_executions(status);",
                "CREATE INDEX IF NOT EXISTS idx_workflow_step_executions_assigned ON workflow_step_executions(assigned_to);",
                "CREATE INDEX IF NOT EXISTS idx_workflow_notifications_instance ON workflow_notifications(workflow_instance_id);",
                "CREATE INDEX IF NOT EXISTS idx_workflow_notifications_status ON workflow_notifications(status);",
                "CREATE INDEX IF NOT EXISTS idx_workflow_metrics_definition ON workflow_metrics(workflow_definition_id);",
                "CREATE INDEX IF NOT EXISTS idx_workflow_metrics_tenant ON workflow_metrics(tenant_id);",
                "CREATE INDEX IF NOT EXISTS idx_workflow_metrics_date ON workflow_metrics(metric_date);"
            ]

            for index_sql in indexes:
                try:
                    conn.execute(text(index_sql))
                except Exception as e:
                    logger.warning(f"Index creation failed (may already exist): {e}")

            conn.commit()
            logger.info("Workflow tables created successfully")

        return True

    except Exception as e:
        logger.error("Failed to create workflow tables", error=str(e))
        raise

def verify_tables():
    """Verify that all workflow tables exist"""
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

        if missing_tables:
            logger.error("Missing workflow tables", missing=list(missing_tables))
            return False

        logger.info(f"All {len(required_tables)} workflow tables exist")
        return True

    except Exception as e:
        logger.error("Failed to verify tables", error=str(e))
        return False

def main():
    """Main function"""
    try:
        print("🚀 Creating workflow tables...")

        # Create workflow tables
        success = create_workflow_tables_direct()

        if success:
            # Verify tables were created
            verified = verify_tables()

            if verified:
                print("✅ Workflow tables created successfully!")
                print("✅ All tables verified!")

                print("\n📋 Created tables:")
                print("  • workflow_definitions")
                print("  • workflow_instances")
                print("  • workflow_steps")
                print("  • workflow_templates")
                print("  • workflow_step_executions")
                print("  • workflow_escalation_rules")
                print("  • workflow_notifications")
                print("  • workflow_metrics")

                print("\n🎯 Your application should now work without the 500 Internal Server Error!")
                return True
            else:
                print("❌ Table verification failed")
                return False
        else:
            print("❌ Failed to create workflow tables")
            return False

    except Exception as e:
        logger.error("Script execution failed", error=str(e))
        print(f"❌ Script failed: {e}")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)