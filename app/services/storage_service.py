# Storage Service for Governance System
# Handles file storage and retrieval for exports and other governance operations

import os
import json
import logging
from typing import Dict, Any, Optional
from datetime import datetime
from app.config import settings

logger = logging.getLogger(__name__)

class StorageService:
    """Simple storage service for governance system files"""

    def __init__(self):
        self.storage_dir = getattr(settings, 'STORAGE_DIR', '/tmp/governance_storage')
        # Ensure storage directory exists
        os.makedirs(self.storage_dir, exist_ok=True)

    def upload_file(self, file_path: str, content: str, content_type: str, metadata: Dict[str, Any]) -> str:
        """Upload file to storage"""
        try:
            full_path = os.path.join(self.storage_dir, file_path)
            os.makedirs(os.path.dirname(full_path), exist_ok=True)

            # Save file content
            with open(full_path, 'w', encoding='utf-8') as f:
                f.write(content)

            # Save metadata
            metadata_path = full_path + '.metadata.json'
            with open(metadata_path, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, indent=2)

            logger.info(f"File uploaded successfully: {file_path}")
            return full_path

        except Exception as e:
            logger.error(f"Failed to upload file {file_path}: {str(e)}")
            raise

    def get_export_metadata(self, export_id: str, tenant_id: str) -> Optional[Dict[str, Any]]:
        """Get export metadata by ID and tenant"""
        try:
            # Search for metadata files
            for root, dirs, files in os.walk(self.storage_dir):
                for file in files:
                    if file.endswith('.metadata.json'):
                        metadata_path = os.path.join(root, file)
                        try:
                            with open(metadata_path, 'r', encoding='utf-8') as f:
                                metadata = json.load(f)

                            if (metadata.get('export_id') == export_id and
                                metadata.get('tenant_id') == tenant_id):
                                # Add file URL
                                file_path = metadata_path.replace('.metadata.json', '')
                                relative_path = os.path.relpath(file_path, self.storage_dir)
                                metadata['file_url'] = f"/api/v1/governance/storage/{relative_path}"
                                return metadata
                        except Exception as e:
                            logger.warning(f"Failed to read metadata {metadata_path}: {str(e)}")
                            continue

            return None

        except Exception as e:
            logger.error(f"Failed to get export metadata {export_id}: {str(e)}")
            return None

    def download_file(self, file_path: str) -> Optional[str]:
        """Download file content"""
        try:
            full_path = os.path.join(self.storage_dir, file_path)
            if os.path.exists(full_path):
                with open(full_path, 'r', encoding='utf-8') as f:
                    return f.read()
            return None
        except Exception as e:
            logger.error(f"Failed to download file {file_path}: {str(e)}")
            return None

# Global storage service instance
storage_service = StorageService()