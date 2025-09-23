#!/usr/bin/env python3
"""
Threat Intelligence Database Seeder Script

This script creates realistic threat intelligence feeds and indicators in the database
for testing and demonstration purposes. All data is safe and uses example values.

Usage:
    python seed_threat_intelligence.py [--tenant-id TENANT_ID] [--user-id USER_ID]

Environment Variables:
    DATABASE_URL - PostgreSQL database connection string
"""

import os
import sys
import uuid
import logging
import random
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.exc import SQLAlchemyError

# Add the app directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from app.models import (
    ThreatIntelligenceFeed, ThreatIndicator, User, SecuritySeverity, UserRole
)
from app.config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class ThreatIntelligenceSeeder:
    """Seeder class for threat intelligence data"""

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

    def create_threat_intelligence_feeds(self, db: Session) -> List[ThreatIntelligenceFeed]:
        """Create 3 realistic threat intelligence feeds with different configurations"""

        feeds = [
            {
                "name": "PhishTank Community Feed",
                "description": "Community-driven phishing URL database with verified phishing sites",
                "feed_type": "phishing",
                "source_url": "https://phishtank.org/",
                "api_endpoint": "https://data.phishtank.com/data/online-valid.json",
                "is_active": True,
                "update_frequency_minutes": 60,
                "auth_config": {"format": "json"},
                "status": "active",
                "total_indicators": 0,
                "new_indicators_last_update": 0
            },
            {
                "name": "AlienVault OTX Reputation Feed",
                "description": "Open Threat Exchange IP reputation data from community contributors",
                "feed_type": "ioc",
                "source_url": "https://otx.alienvault.com/",
                "api_endpoint": "https://otx.alienvault.com/api/v1/indicators",
                "is_active": True,
                "update_frequency_minutes": 30,
                "auth_config": {"format": "stix", "api_key_required": True},
                "status": "active",
                "total_indicators": 0,
                "new_indicators_last_update": 0
            },
            {
                "name": "Malware Bazaar CSV Feed",
                "description": "Malware sample hashes and associated metadata from research community",
                "feed_type": "malware",
                "source_url": "https://bazaar.abuse.ch/",
                "api_endpoint": "https://bazaar.abuse.ch/export/csv/recent/",
                "is_active": True,
                "update_frequency_minutes": 120,
                "auth_config": {"format": "csv", "delimiter": ","},
                "status": "active",
                "total_indicators": 0,
                "new_indicators_last_update": 0
            }
        ]

        created_feeds = []

        for feed_data in feeds:
            # Check if feed already exists
            existing_feed = db.query(ThreatIntelligenceFeed).filter(
                ThreatIntelligenceFeed.name == feed_data["name"],
                ThreatIntelligenceFeed.tenant_id == self.tenant_id
            ).first()

            if existing_feed:
                logger.info(f"Feed '{feed_data['name']}' already exists, skipping...")
                created_feeds.append(existing_feed)
                continue

            # Create new feed
            feed = ThreatIntelligenceFeed(
                id=str(uuid.uuid4()),
                tenant_id=self.tenant_id,
                created_by=self.user_id,
                **feed_data
            )

            db.add(feed)
            created_feeds.append(feed)
            logger.info(f"Created feed: {feed_data['name']}")

        db.commit()
        return created_feeds

    def create_threat_indicators(self, db: Session, feeds: List[ThreatIntelligenceFeed]) -> List[ThreatIndicator]:
        """Create 15 threat indicators (5 per feed) with realistic but safe data"""

        indicators_data = [
            # PhishTank Feed Indicators (URLs)
            {
                "feed_index": 0,
                "indicators": [
                    {
                        "type": "url",
                        "value": "http://example-phishing-site.com/login/bankofamerica",
                        "threat_type": "phishing",
                        "threat_actor": "Unknown Phishing Group",
                        "confidence_score": "85",
                        "severity": SecuritySeverity.HIGH,
                        "description": "Bank of America phishing site targeting online banking credentials",
                        "tags": ["phishing", "financial", "credential-theft", "banking"],
                        "context_data": {"target_brand": "Bank of America", "page_type": "login"}
                    },
                    {
                        "type": "url",
                        "value": "https://secure-paypal-update.org/account/verify",
                        "threat_type": "phishing",
                        "threat_actor": "Unknown Phishing Group",
                        "confidence_score": "92",
                        "severity": SecuritySeverity.HIGH,
                        "description": "PayPal phishing site attempting to harvest account credentials",
                        "tags": ["phishing", "financial", "credential-theft", "payment"],
                        "context_data": {"target_brand": "PayPal", "page_type": "verification"}
                    },
                    {
                        "type": "url",
                        "value": "http://microsoft-security-alert.com/office365/update",
                        "threat_type": "phishing",
                        "threat_actor": "Unknown Phishing Group",
                        "confidence_score": "78",
                        "severity": SecuritySeverity.MEDIUM,
                        "description": "Microsoft Office 365 phishing campaign targeting corporate credentials",
                        "tags": ["phishing", "corporate", "credential-theft", "office365"],
                        "context_data": {"target_brand": "Microsoft", "page_type": "software-update"}
                    },
                    {
                        "type": "url",
                        "value": "https://amazon-verification-center.com/account/security",
                        "threat_type": "phishing",
                        "threat_actor": "Unknown Phishing Group",
                        "confidence_score": "88",
                        "severity": SecuritySeverity.HIGH,
                        "description": "Amazon account verification phishing site",
                        "tags": ["phishing", "ecommerce", "credential-theft", "amazon"],
                        "context_data": {"target_brand": "Amazon", "page_type": "security"}
                    },
                    {
                        "type": "url",
                        "value": "http://google-docs-shared.drive.google.com.security-update.com",
                        "threat_type": "phishing",
                        "threat_actor": "Unknown Phishing Group",
                        "confidence_score": "95",
                        "severity": SecuritySeverity.HIGH,
                        "description": "Google Docs phishing site with lookalike domain",
                        "tags": ["phishing", "google", "credential-theft", "drive"],
                        "context_data": {"target_brand": "Google", "page_type": "document-sharing"}
                    }
                ]
            },
            # AlienVault OTX Feed Indicators (IPs)
            {
                "feed_index": 1,
                "indicators": [
                    {
                        "type": "ip",
                        "value": "192.168.100.1",
                        "threat_type": "botnet",
                        "threat_actor": "Emotet Botnet",
                        "confidence_score": "75",
                        "severity": SecuritySeverity.MEDIUM,
                        "description": "Known Emotet command and control server",
                        "tags": ["botnet", "c2", "emotet", "malware"],
                        "context_data": {"botnet_family": "Emotet", "last_activity": "2024-01-15"}
                    },
                    {
                        "type": "ip",
                        "value": "10.0.0.100",
                        "threat_type": "scanner",
                        "threat_actor": "Unknown Scanning Group",
                        "confidence_score": "65",
                        "severity": SecuritySeverity.LOW,
                        "description": "IP address observed conducting port scanning activities",
                        "tags": ["scanner", "reconnaissance", "network-scan"],
                        "context_data": {"scanned_ports": [22, 80, 443, 3389], "scan_type": "vertical"}
                    },
                    {
                        "type": "ip",
                        "value": "172.16.50.25",
                        "threat_type": "apt",
                        "threat_actor": "APT28",
                        "confidence_score": "82",
                        "severity": SecuritySeverity.HIGH,
                        "description": "IP associated with APT28 spear phishing campaigns",
                        "tags": ["apt", "state-sponsored", "spear-phishing", "fancy-bear"],
                        "context_data": {"campaign": "Operation Diplomatic Storm", "target_sector": "government"}
                    },
                    {
                        "type": "ip",
                        "value": "203.0.113.10",
                        "threat_type": "malware",
                        "threat_actor": "TrickBot Gang",
                        "confidence_score": "90",
                        "severity": SecuritySeverity.HIGH,
                        "description": "TrickBot distribution server hosting malware payloads",
                        "tags": ["malware", "trickbot", "banking-trojan", "distribution"],
                        "context_data": {"malware_family": "TrickBot", "payload_types": ["exe", "dll"]}
                    },
                    {
                        "type": "ip",
                        "value": "198.51.100.75",
                        "threat_type": "brute-force",
                        "threat_actor": "Unknown Brute Force Group",
                        "confidence_score": "70",
                        "severity": SecuritySeverity.MEDIUM,
                        "description": "SSH brute force attacks targeting cloud infrastructure",
                        "tags": ["brute-force", "ssh", "cloud", "credential-attack"],
                        "context_data": {"target_services": ["ssh"], "attack_pattern": "dictionary-attack"}
                    }
                ]
            },
            # Malware Bazaar Feed Indicators (Hashes)
            {
                "feed_index": 2,
                "indicators": [
                    {
                        "type": "hash",
                        "value": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                        "threat_type": "ransomware",
                        "threat_actor": "LockBit Ransomware Group",
                        "confidence_score": "95",
                        "severity": SecuritySeverity.CRITICAL,
                        "description": "LockBit ransomware encryptor variant",
                        "tags": ["ransomware", "lockbit", "encryptor", "critical"],
                        "context_data": {"malware_family": "LockBit", "file_type": "exe", "compile_time": "2024-01-10T15:30:00Z"}
                    },
                    {
                        "type": "hash",
                        "value": "d41d8cd98f00b204e9800998ecf8427e",
                        "threat_type": "trojan",
                        "threat_actor": "QakBot Gang",
                        "confidence_score": "88",
                        "severity": SecuritySeverity.HIGH,
                        "description": "QakBot banking trojan with information stealing capabilities",
                        "tags": ["trojan", "banking", "infostealer", "qakbot"],
                        "context_data": {"malware_family": "QakBot", "capabilities": ["keylogging", "credential-theft"]}
                    },
                    {
                        "type": "hash",
                        "value": "acbd18db4cc2f85cedef654fccc4a4d8",
                        "threat_type": "loader",
                        "threat_actor": "BazarLoader Group",
                        "confidence_score": "85",
                        "severity": SecuritySeverity.HIGH,
                        "description": "BazarLoader used for initial access and ransomware delivery",
                        "tags": ["loader", "bazar", "initial-access", "delivery"],
                        "context_data": {"malware_family": "BazarLoader", "delivery_method": "email"}
                    },
                    {
                        "type": "hash",
                        "value": "37f51cfb3f5b7d1d5c4f8e4b3c6a2e1d",
                        "threat_type": "spyware",
                        "threat_actor": "Agent Tesla",
                        "confidence_score": "92",
                        "severity": SecuritySeverity.HIGH,
                        "description": "Agent Tesla remote access trojan with keylogging functionality",
                        "tags": ["spyware", "rat", "keylogger", "agent-tesla"],
                        "context_data": {"malware_family": "Agent Tesla", "exfiltration_methods": ["ftp", "smtp", "http"]}
                    },
                    {
                        "type": "hash",
                        "value": "1a79a4d60de6718e8e5b326e338ae533",
                        "threat_type": "wiper",
                        "threat_actor": "Unknown Wiper Group",
                        "confidence_score": "78",
                        "severity": SecuritySeverity.CRITICAL,
                        "description": "Data wiper malware targeting industrial control systems",
                        "tags": ["wiper", "ics", "destructive", "industrial"],
                        "context_data": {"target_sector": "industrial", "destruction_method": "overwriting"}
                    }
                ]
            }
        ]

        created_indicators = []
        now = datetime.utcnow()

        for feed_group in indicators_data:
            feed = feeds[feed_group["feed_index"]]

            for indicator_data in feed_group["indicators"]:
                # Check if indicator already exists
                existing_indicator = db.query(ThreatIndicator).filter(
                    ThreatIndicator.indicator_value == indicator_data["value"],
                    ThreatIndicator.tenant_id == self.tenant_id
                ).first()

                if existing_indicator:
                    logger.info(f"Indicator '{indicator_data['value']}' already exists, skipping...")
                    created_indicators.append(existing_indicator)
                    continue

                # Create new indicator
                first_seen = now - timedelta(days=random.randint(1, 30))
                last_seen = now - timedelta(days=random.randint(0, 7))
                expires_at = now + timedelta(days=random.randint(30, 365))

                indicator = ThreatIndicator(
                    id=str(uuid.uuid4()),
                    indicator_type=indicator_data["type"],
                    indicator_value=indicator_data["value"],
                    threat_type=indicator_data["threat_type"],
                    threat_actor=indicator_data["threat_actor"],
                    confidence_score=indicator_data["confidence_score"],
                    severity=indicator_data["severity"],
                    first_seen=first_seen,
                    last_seen=last_seen,
                    expires_at=expires_at,
                    source_feed_id=feed.id,
                    source_confidence=indicator_data["confidence_score"],
                    source_description=f"From {feed.name}",
                    description=indicator_data["description"],
                    tags=indicator_data["tags"],
                    context_data=indicator_data["context_data"],
                    is_active=True,
                    is_false_positive=False,
                    times_detected=random.randint(1, 100),
                    last_detected_at=last_seen,
                    tenant_id=self.tenant_id
                )

                db.add(indicator)
                created_indicators.append(indicator)
                logger.info(f"Created indicator: {indicator_data['value']} ({indicator_data['type']})")

        db.commit()
        return created_indicators

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
        """Main method to seed the database with threat intelligence data"""
        try:
            db = self.get_db_session()

            logger.info(f"Starting threat intelligence seeding for tenant: {self.tenant_id}")
            logger.info(f"Using user: {self.user_id}")

            # Verify user exists
            self.verify_user_exists(db)

            # Create threat intelligence feeds
            logger.info("Creating threat intelligence feeds...")
            feeds = self.create_threat_intelligence_feeds(db)

            # Create threat indicators
            logger.info("Creating threat indicators...")
            indicators = self.create_threat_indicators(db, feeds)

            # Update feed statistics
            for feed in feeds:
                feed.total_indicators = db.query(ThreatIndicator).filter(
                    ThreatIndicator.source_feed_id == feed.id
                ).count()
                logger.info(f"Feed '{feed.name}' now has {feed.total_indicators} indicators")

            db.commit()

            logger.info(f"✅ Successfully seeded database:")
            logger.info(f"   - Created {len(feeds)} threat intelligence feeds")
            logger.info(f"   - Created {len(indicators)} threat indicators")
            logger.info(f"   - Tenant: {self.tenant_id}")

            return True

        except SQLAlchemyError as e:
            logger.error(f"Database error occurred: {e}")
            db.rollback()
            return False
        except Exception as e:
            logger.error(f"Unexpected error occurred: {e}")
            return False
        finally:
            db.close()

def main():
    """Main function to run the seeder"""
    import argparse

    parser = argparse.ArgumentParser(description='Seed threat intelligence data')
    parser.add_argument('--tenant-id', default='demo-tenant', help='Tenant ID for data isolation')
    parser.add_argument('--user-id', default='admin-user', help='User ID to attribute creation to')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be created without actually creating')

    args = parser.parse_args()

    # Set random seed for reproducible results
    random.seed(42)

    if args.dry_run:
        logger.info("DRY RUN MODE - No data will be created")
        return

    # Create seeder instance
    seeder = ThreatIntelligenceSeeder(
        tenant_id=args.tenant_id,
        user_id=args.user_id
    )

    # Seed the database
    success = seeder.seed_database()

    if success:
        logger.info("🎉 Threat intelligence seeding completed successfully!")
        sys.exit(0)
    else:
        logger.error("❌ Threat intelligence seeding failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()