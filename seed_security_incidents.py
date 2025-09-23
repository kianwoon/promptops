#!/usr/bin/env python3
"""
Security Incidents Database Seeder Script

This script creates realistic security incidents in the database
for testing and demonstration purposes. All data is safe and uses example values.

Usage:
    python seed_security_incidents.py [--tenant-id TENANT_ID] [--user-id USER_ID]

Environment Variables:
    DATABASE_URL - PostgreSQL database connection string
"""

import os
import sys
import uuid
import logging
import random
import argparse
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Any
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.exc import SQLAlchemyError

# Add the app directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from app.models import (
    SecurityIncident, User,
    SecurityIncidentType, SecurityIncidentSeverity, SecurityIncidentStatus
)
from app.config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class SecurityIncidentSeeder:
    """Seeder class for security incidents data"""

    def __init__(self, tenant_id: str = "demo-tenant", user_id: str = "admin-user"):
        self.tenant_id = tenant_id
        self.user_id = user_id
        self.engine = create_engine(settings.database_url)
        self.SessionLocal = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=self.engine
        )

    def create_incidents_data(self) -> List[Dict[str, Any]]:
        """Create realistic security incidents data"""

        base_time = datetime.now(timezone.utc)

        incidents = [
            {
                "id": str(uuid.uuid4()),
                "incident_type": SecurityIncidentType.DATA_COMPROMISE,
                "severity": SecurityIncidentSeverity.CRITICAL,
                "status": SecurityIncidentStatus.INVESTIGATING,
                "title": "Customer Database Breach Detected",
                "description": "Unauthorized access detected in customer database containing PII. Security logs show unusual query patterns and large data exports.",
                "summary": "Critical data breach affecting customer PII data",
                "detection_method": "automated",
                "classification": "confirmed",
                "impact_score": "9.2",
                "affected_systems": [
                    {
                        "system_name": "customer-db-01",
                        "system_type": "database",
                        "ip_address": "192.168.1.100",
                        "role": "primary_customer_db"
                    },
                    {
                        "system_name": "api-gateway",
                        "system_type": "gateway",
                        "ip_address": "192.168.1.10",
                        "role": "api_entry_point"
                    }
                ],
                "data_affected": {
                    "records_count": 50000,
                    "data_types": ["PII", "financial_data", "contact_information"],
                    "sensitivity_level": "high",
                    "regulatory_impact": True
                },
                "business_impact": "High - regulatory reporting required, potential customer notification needed",
                "response_team": [
                    {"name": "John Smith", "role": "incident_commander", "contact": "john.smith@company.com"},
                    {"name": "Sarah Johnson", "role": "security_analyst", "contact": "sarah.j@company.com"},
                    {"name": "Mike Chen", "role": "legal_counsel", "contact": "mike.chen@company.com"}
                ],
                "containment_actions": [
                    {"action": "isolated_database_segment", "timestamp": (base_time - timedelta(hours=2)).isoformat(), "performed_by": "john.smith@company.com"},
                    {"action": "revoked_compromised_credentials", "timestamp": (base_time - timedelta(hours=1)).isoformat(), "performed_by": "sarah.j@company.com"}
                ],
                "compliance_impact": [
                    {"framework": "GDPR", "impact": "high", "reporting_required": True, "deadline": (base_time + timedelta(days=3)).isoformat()},
                    {"framework": "CCPA", "impact": "high", "reporting_required": True, "deadline": (base_time + timedelta(days=3)).isoformat()}
                ],
                "report_required": True,
                "report_filed": False,
                "detected_at": base_time - timedelta(hours=3),
                "created_at": base_time - timedelta(hours=3),
                "updated_at": base_time - timedelta(hours=1)
            },
            {
                "id": str(uuid.uuid4()),
                "incident_type": SecurityIncidentType.MALWARE_DETECTION,
                "severity": SecurityIncidentSeverity.HIGH,
                "status": SecurityIncidentStatus.CONTAINED,
                "title": "Ransomware Detection on File Server",
                "description": "Ransomware variant detected on internal file server. Encryption activity observed and stopped before significant data loss.",
                "summary": "Ransomware attack successfully contained",
                "detection_method": "automated",
                "classification": "confirmed",
                "impact_score": "7.8",
                "affected_systems": [
                    {
                        "system_name": "file-server-03",
                        "system_type": "file_server",
                        "ip_address": "192.168.1.150",
                        "role": "shared_file_storage"
                    },
                    {
                        "system_name": "backup-server",
                        "system_type": "backup_system",
                        "ip_address": "192.168.1.160",
                        "role": "backup_storage"
                    }
                ],
                "data_affected": {
                    "files_encrypted": 1250,
                    "file_types": ["documents", "spreadsheets", "presentations"],
                    "data_volume_gb": 15.5,
                    "critical_data": False
                },
                "business_impact": "Medium - temporary service disruption, no data loss due to backups",
                "response_team": [
                    {"name": "Emily Davis", "role": "incident_commander", "contact": "emily.davis@company.com"},
                    {"name": "Alex Rodriguez", "role": "malware_analyst", "contact": "alex.r@company.com"},
                    {"name": "Lisa Wang", "role": "system_admin", "contact": "lisa.wang@company.com"}
                ],
                "containment_actions": [
                    {"action": "isolated_network_segment", "timestamp": (base_time - timedelta(hours=8)).isoformat(), "performed_by": "lisa.wang@company.com"},
                    {"action": "disabled_shares", "timestamp": (base_time - timedelta(hours=7)).isoformat(), "performed_by": "lisa.wang@company.com"},
                    {"action": "blocked_malicious_ips", "timestamp": (base_time - timedelta(hours=7)).isoformat(), "performed_by": "alex.r@company.com"}
                ],
                "eradication_actions": [
                    {"action": "removed_malware", "timestamp": (base_time - timedelta(hours=6)).isoformat(), "performed_by": "alex.r@company.com"},
                    {"action": "patched_vulnerabilities", "timestamp": (base_time - timedelta(hours=5)).isoformat(), "performed_by": "lisa.wang@company.com"}
                ],
                "recovery_actions": [
                    {"action": "restored_from_backup", "timestamp": (base_time - timedelta(hours=4)).isoformat(), "performed_by": "lisa.wang@company.com"},
                    {"action": "verified_system_integrity", "timestamp": (base_time - timedelta(hours=3)).isoformat(), "performed_by": "alex.r@company.com"}
                ],
                "investigation_findings": [
                    {"finding": "entry_vector", "details": "phishing_email with malicious attachment", "confidence": "high"},
                    {"finding": "malware_variant", "details": "Ryuk ransomware variant", "confidence": "high"},
                    {"finding": "lateral_movement", "details": "limited to file server segment", "confidence": "medium"}
                ],
                "root_cause": "User opened malicious email attachment leading to ransomware execution",
                "lessons_learned": "Need enhanced email filtering and user security awareness training",
                "compliance_impact": [
                    {"framework": "ISO27001", "impact": "medium", "reporting_required": False}
                ],
                "report_required": False,
                "report_filed": False,
                "detected_at": base_time - timedelta(hours=10),
                "contained_at": base_time - timedelta(hours=7),
                "resolved_at": base_time - timedelta(hours=3),
                "created_at": base_time - timedelta(hours=10),
                "updated_at": base_time - timedelta(hours=3)
            },
            {
                "id": str(uuid.uuid4()),
                "incident_type": SecurityIncidentType.PHISHING_ATTEMPT,
                "severity": SecurityIncidentSeverity.MEDIUM,
                "status": SecurityIncidentStatus.RESOLVED,
                "title": "Spear Phishing Campaign Targeting Executives",
                "description": "Targeted phishing attack detected against senior leadership team. Sophisticated emails impersonating CEO requesting urgent wire transfers.",
                "summary": "Spear phishing campaign successfully blocked",
                "detection_method": "reported",
                "classification": "confirmed",
                "impact_score": "5.4",
                "affected_systems": [
                    {
                        "system_name": "email-system",
                        "system_type": "email_server",
                        "ip_address": "192.168.1.50",
                        "role": "corporate_email"
                    },
                    {
                        "system_name": "executive-workstations",
                        "system_type": "workstations",
                        "count": 15,
                        "role": "leadership_team"
                    }
                ],
                "data_affected": {
                    "users_targeted": 15,
                    "emails_delivered": 12,
                    "emails_opened": 3,
                    "clicks_on_links": 1,
                    "credentials_compromised": 0
                },
                "business_impact": "Low - prevented by security controls, user awareness training effective",
                "response_team": [
                    {"name": "David Kim", "role": "security_analyst", "contact": "david.kim@company.com"},
                    {"name": "Jennifer Brown", "role": "awareness_trainer", "contact": "jennifer.b@company.com"}
                ],
                "containment_actions": [
                    {"action": "blocked_sender_domains", "timestamp": (base_time - timedelta(days=2)).isoformat(), "performed_by": "david.kim@company.com"},
                    {"action": "quarantined_suspicious_emails", "timestamp": (base_time - timedelta(days=2)).isoformat(), "performed_by": "david.kim@company.com"}
                ],
                "eradication_actions": [
                    {"action": "reset_potentially_compromised_passwords", "timestamp": (base_time - timedelta(days=1)).isoformat(), "performed_by": "david.kim@company.com"}
                ],
                "investigation_findings": [
                    {"finding": "attack_method", "details": "CEO fraud/spear phishing", "confidence": "high"},
                    {"finding": "sender_spoofing", "details": "spoofed CEO email domain", "confidence": "high"},
                    {"finding": "target_selection", "details": "C-level executives and finance team", "confidence": "high"}
                ],
                "root_cause": "External threat actors attempting financial fraud through social engineering",
                "lessons_learned": "Enhanced email filtering rules working well, continue user awareness training",
                "compliance_impact": [
                    {"framework": "SOC2", "impact": "low", "reporting_required": False}
                ],
                "report_required": False,
                "report_filed": False,
                "detected_at": base_time - timedelta(days=2),
                "contained_at": base_time - timedelta(days=2),
                "resolved_at": base_time - timedelta(days=1),
                "created_at": base_time - timedelta(days=2),
                "updated_at": base_time - timedelta(days=1)
            }
        ]

        # Add tenant context to all incidents
        for incident in incidents:
            incident["tenant_id"] = self.tenant_id
            incident["reported_by"] = self.user_id

            # Set assigned_to for some incidents
            if incident["severity"] in [SecurityIncidentSeverity.CRITICAL, SecurityIncidentSeverity.HIGH]:
                incident["assigned_to"] = self.user_id

        return incidents

    def seed_database(self) -> bool:
        """Seed the database with security incidents"""
        session = self.SessionLocal()
        try:
            logger.info(f"Starting security incidents seeding for tenant: {self.tenant_id}")

            # Check if incidents already exist for this tenant
            existing_count = session.query(SecurityIncident).filter(
                SecurityIncident.tenant_id == self.tenant_id
            ).count()

            if existing_count > 0:
                logger.info(f"Found {existing_count} existing incidents for tenant {self.tenant_id}")
                logger.info("Skipping seed to avoid duplicates")
                return True

            # Create incidents
            incidents_data = self.create_incidents_data()
            created_incidents = []

            for incident_data in incidents_data:
                incident = SecurityIncident(**incident_data)
                session.add(incident)
                created_incidents.append(incident)

            # Commit all changes
            session.commit()

            logger.info(f"Successfully created {len(created_incidents)} security incidents:")
            for incident in created_incidents:
                logger.info(f"  - {incident.title} ({incident.severity.value} {incident.incident_type.value})")

            return True

        except SQLAlchemyError as e:
            session.rollback()
            logger.error(f"Database error during seeding: {str(e)}")
            return False
        except Exception as e:
            session.rollback()
            logger.error(f"Unexpected error during seeding: {str(e)}")
            return False
        finally:
            session.close()

def main():
    """Main entry point for the seeder script"""
    parser = argparse.ArgumentParser(description='Seed security incidents database')
    parser.add_argument('--tenant-id', default='demo-tenant', help='Tenant ID for seeding')
    parser.add_argument('--user-id', default='admin-user', help='User ID for reporting')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be created without creating')

    args = parser.parse_args()

    # Initialize seeder
    seeder = SecurityIncidentSeeder(tenant_id=args.tenant_id, user_id=args.user_id)

    if args.dry_run:
        logger.info("Dry run mode - showing what would be created:")
        incidents = seeder.create_incidents_data()
        for incident in incidents:
            logger.info(f"  - {incident['title']} ({incident['severity'].value} {incident['incident_type'].value})")
        return

    # Seed the database
    success = seeder.seed_database()

    if success:
        logger.info("Security incidents seeding completed successfully!")
        sys.exit(0)
    else:
        logger.error("Security incidents seeding failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()