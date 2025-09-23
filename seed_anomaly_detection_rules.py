#!/usr/bin/env python3
"""
Anomaly Detection Rules Database Seeder Script

This script creates realistic anomaly detection rules in the database
for testing and demonstration purposes. All configurations use realistic
parameters for production-like monitoring scenarios.

Usage:
    python seed_anomaly_detection_rules.py [--tenant-id TENANT_ID] [--user-id USER_ID]

Environment Variables:
    DATABASE_URL - PostgreSQL database connection string
"""

import os
import sys
import uuid
import logging
import argparse
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.exc import SQLAlchemyError

# Add the app directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from app.models import (
    AnomalyDetectionRule, User, SecuritySeverity, UserRole
)
from app.config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class AnomalyDetectionRuleSeeder:
    """Seeder class for anomaly detection rules"""

    def __init__(self, tenant_id: str = "demo-tenant", user_id: str = "admin-user"):
        self.tenant_id = tenant_id
        self.user_id = user_id
        self.engine = create_engine(settings.database_url)
        self.SessionLocal = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=self.engine
        )

    def get_db_session(self) -> Session:
        """Get database session"""
        return self.SessionLocal()

    def create_anomaly_detection_rules(self, db: Session) -> List[AnomalyDetectionRule]:
        """Create 3 realistic anomaly detection rules with different types and configurations"""

        rules = [
            {
                "name": "API Response Time Anomaly Detection",
                "description": "Statistical analysis of API response times to detect performance anomalies using Z-score and moving averages",
                "rule_type": "statistical",
                "target_metric": "api_response_time_ms",
                "detection_config": {
                    "statistical_method": "z_score",
                    "window_size_minutes": 30,
                    "min_data_points": 10,
                    "confidence_interval": 0.95,
                    "moving_average_window": 5,
                    "baseline_period_hours": 24,
                    "seasonality_detection": True,
                    "outlier_detection_method": "modified_z_score"
                },
                "threshold_config": {
                    "z_score_threshold": 3.0,
                    "percentage deviation_threshold": 50.0,
                    "absolute_threshold_ms": 5000,
                    "consecutive_violations": 3,
                    "recovery_threshold_ms": 1000,
                    "grace_period_minutes": 5
                },
                "sensitivity": "medium",
                "alert_on_detection": True,
                "alert_severity": SecuritySeverity.MEDIUM,
                "alert_message_template": "API response time anomaly detected: {metric} is {value}ms (baseline: {baseline}ms, deviation: {deviation}%)",
                "is_active": True,
                "evaluation_frequency_minutes": 5,
                "scope_config": {
                    "endpoint_patterns": ["/api/v1/*", "/api/v2/*"],
                    "http_methods": ["GET", "POST", "PUT", "DELETE"],
                    "excluded_endpoints": ["/api/v1/health", "/api/v1/metrics"],
                    "min_requests_per_minute": 10
                }
            },
            {
                "name": "Authentication Failure Pattern Detection",
                "description": "Pattern-based detection of suspicious authentication activities including brute force attacks and credential stuffing",
                "rule_type": "pattern",
                "target_metric": "authentication_failures",
                "detection_config": {
                    "pattern_type": "failure_sequence",
                    "time_window_minutes": 15,
                    "max_failures_per_window": 5,
                    "ip_based_tracking": True,
                    "user_based_tracking": True,
                    "geolocation_analysis": True,
                    "device_fingerprinting": True,
                    "behavioral_analysis": True,
                    "failure_types": ["invalid_credentials", "account_locked", "suspicious_activity"]
                },
                "threshold_config": {
                    "max_failures_per_ip": 10,
                    "max_failures_per_user": 3,
                    "max_failures_per_geolocation": 15,
                    "time_between_failures_seconds": 30,
                    "unique_ips_threshold": 5,
                    "unique_users_threshold": 3,
                    "geolocation_radius_km": 100,
                    "device_change_threshold": 2
                },
                "sensitivity": "high",
                "alert_on_detection": True,
                "alert_severity": SecuritySeverity.HIGH,
                "alert_message_template": "Suspicious authentication pattern detected: {failure_count} failures from {unique_ips} unique IPs in {time_window} minutes",
                "is_active": True,
                "evaluation_frequency_minutes": 2,
                "scope_config": {
                    "auth_methods": ["password", "oauth", "saml"],
                    "included_endpoints": ["/api/v1/auth/login", "/api/v1/auth/token"],
                    "excluded_ips": ["192.168.1.0/24", "10.0.0.0/8"],
                    "monitor_admin_accounts": True,
                    "monitor_service_accounts": True
                }
            },
            {
                "name": "Error Rate Spike Detection",
                "description": "Threshold-based monitoring of application error rates to detect sudden spikes indicating system issues or attacks",
                "rule_type": "threshold",
                "target_metric": "error_rate_percentage",
                "detection_config": {
                    "error_types": ["5xx", "4xx", "timeout", "connection_error"],
                    "calculation_method": "percentage",
                    "baseline_period_minutes": 60,
                    "smoothing_factor": 0.3,
                    "trend_analysis": True,
                    "volume_weighting": True,
                    "critical_path_monitoring": True,
                    "error_categorization": True
                },
                "threshold_config": {
                    "warning_threshold": 5.0,
                    "critical_threshold": 10.0,
                    "absolute_error_count_threshold": 50,
                    "spike_detection_multiplier": 3.0,
                    "baseline_deviation_threshold": 200.0,
                    "recovery_threshold_percentage": 2.0,
                    "minimum_request_volume": 100
                },
                "sensitivity": "medium",
                "alert_on_detection": True,
                "alert_severity": SecuritySeverity.HIGH,
                "alert_message_template": "Error rate spike detected: {error_rate}% error rate ({error_count} errors out of {total_requests} requests)",
                "is_active": True,
                "evaluation_frequency_minutes": 3,
                "scope_config": {
                    "service_names": ["api-gateway", "auth-service", "data-service"],
                    "error_codes": ["500", "502", "503", "504", "429", "401", "403"],
                    "excluded_user_agents": ["health-check", "monitoring-bot"],
                    "include_internal_services": False,
                    "min_requests_per_evaluation": 50
                }
            }
        ]

        created_rules = []

        for rule_data in rules:
            # Check if rule already exists
            existing_rule = db.query(AnomalyDetectionRule).filter(
                AnomalyDetectionRule.name == rule_data["name"],
                AnomalyDetectionRule.tenant_id == self.tenant_id
            ).first()

            if existing_rule:
                logger.info(f"Rule '{rule_data['name']}' already exists, skipping...")
                created_rules.append(existing_rule)
                continue

            # Create new rule
            rule = AnomalyDetectionRule(
                id=str(uuid.uuid4()),
                tenant_id=self.tenant_id,
                created_by=self.user_id,
                total_detections=0,
                true_positives=0,
                false_positives=0,
                **rule_data
            )

            db.add(rule)
            created_rules.append(rule)
            logger.info(f"Created rule: {rule_data['name']}")

        db.commit()
        return created_rules

    def verify_user_exists(self, db: Session) -> bool:
        """Verify that the specified user exists"""
        user = db.query(User).filter(User.id == self.user_id).first()
        if not user:
            logger.warning(f"User {self.user_id} not found. Creating a default user...")

            # Create a default user
            user = User(
                id=self.user_id,
                email=f"admin@{self.tenant_id}.com",
                name="Admin User",
                role=UserRole.ADMIN,
                tenant_id=self.tenant_id,
                is_active=True,
                hashed_password="dummy_hash_for_seeding"
            )
            db.add(user)
            db.commit()
            logger.info(f"Created default user: {self.user_id}")

        return True

    def seed_database(self) -> bool:
        """Main method to seed the database with anomaly detection rules"""
        try:
            db = self.get_db_session()

            logger.info(f"Starting anomaly detection rules seeding for tenant: {self.tenant_id}")
            logger.info(f"Using user: {self.user_id}")

            # Verify user exists
            self.verify_user_exists(db)

            # Create anomaly detection rules
            logger.info("Creating anomaly detection rules...")
            rules = self.create_anomaly_detection_rules(db)

            logger.info(f"✅ Successfully seeded database:")
            logger.info(f"   - Created {len(rules)} anomaly detection rules")
            logger.info(f"   - Tenant: {self.tenant_id}")

            # Log rule summary
            for rule in rules:
                logger.info(f"   - Rule: {rule.name} ({rule.rule_type}) - {rule.sensitivity} sensitivity")

            return True

        except SQLAlchemyError as e:
            logger.error(f"Database error occurred: {e}")
            if 'db' in locals():
                db.rollback()
            return False
        except Exception as e:
            logger.error(f"Unexpected error occurred: {e}")
            return False
        finally:
            if 'db' in locals():
                db.close()

def main():
    """Main function to run the seeder"""
    parser = argparse.ArgumentParser(description='Seed anomaly detection rules')
    parser.add_argument('--tenant-id', default='demo-tenant', help='Tenant ID for data isolation')
    parser.add_argument('--user-id', default='admin-user', help='User ID to attribute creation to')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be created without actually creating')

    args = parser.parse_args()

    if args.dry_run:
        logger.info("DRY RUN MODE - No data will be created")
        logger.info("Would create 3 anomaly detection rules:")
        logger.info("1. API Response Time Anomaly Detection (statistical)")
        logger.info("2. Authentication Failure Pattern Detection (pattern)")
        logger.info("3. Error Rate Spike Detection (threshold)")
        return

    # Create seeder instance
    seeder = AnomalyDetectionRuleSeeder(
        tenant_id=args.tenant_id,
        user_id=args.user_id
    )

    # Seed the database
    success = seeder.seed_database()

    if success:
        logger.info("🎉 Anomaly detection rules seeding completed successfully!")
        sys.exit(0)
    else:
        logger.error("❌ Anomaly detection rules seeding failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()