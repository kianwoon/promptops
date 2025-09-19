import uuid
import hashlib
import hmac
import time
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
import structlog
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import os

from app.config import settings

logger = structlog.get_logger()

def generate_id() -> str:
    """Generate a unique ID"""
    return str(uuid.uuid4())

def generate_api_key_pair() -> tuple[str, str]:
    """Generate API key and secret key pair"""
    api_key = f"po_{uuid.uuid4().hex[:24]}"
    secret_key = uuid.uuid4().hex
    return api_key, secret_key

def hash_api_key(api_key: str) -> str:
    """Hash API key for storage"""
    return hashlib.sha256(api_key.encode()).hexdigest()

def hash_secret_key(secret_key: str) -> str:
    """Hash secret key for storage"""
    return hashlib.sha256(secret_key.encode()).hexdigest()

def extract_api_key_prefix(api_key: str) -> str:
    """Extract prefix from API key"""
    return api_key[:8]

def create_hmac_signature(
    api_key: str,
    secret_key: str,
    timestamp: str,
    method: str,
    endpoint: str
) -> str:
    """Create HMAC-SHA256 signature for API requests"""
    message = f"{api_key}:{timestamp}:{method}:{endpoint}"
    return hmac.new(
        secret_key.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()

def verify_hmac_signature(
    api_key: str,
    secret_key: str,
    timestamp: str,
    method: str,
    endpoint: str,
    signature: str
) -> bool:
    """Verify HMAC-SHA256 signature"""
    try:
        expected_signature = create_hmac_signature(
            api_key, secret_key, timestamp, method, endpoint
        )
        return hmac.compare_digest(expected_signature, signature)
    except Exception:
        return False

def is_timestamp_valid(timestamp_str: str, max_age_seconds: int = 300) -> bool:
    """Check if timestamp is recent and valid"""
    try:
        # Parse timestamp (accepts ISO format with or without Z)
        if timestamp_str.endswith('Z'):
            timestamp_str = timestamp_str[:-1] + '+00:00'

        timestamp = datetime.fromisoformat(timestamp_str)
        now = datetime.utcnow()

        # Check if timestamp is within allowed age
        age = abs((now - timestamp).total_seconds())
        return age <= max_age_seconds
    except (ValueError, TypeError):
        return False

def format_timestamp(dt: Optional[datetime] = None) -> str:
    """Format datetime as ISO string with Z suffix"""
    if dt is None:
        dt = datetime.utcnow()
    return dt.isoformat(timespec='seconds') + 'Z'

def parse_timestamp(timestamp_str: str) -> Optional[datetime]:
    """Parse ISO timestamp string"""
    try:
        if timestamp_str.endswith('Z'):
            timestamp_str = timestamp_str[:-1] + '+00:00'
        return datetime.fromisoformat(timestamp_str)
    except ValueError:
        return None

def sanitize_input(input_str: str, max_length: int = 1000) -> str:
    """Sanitize input string"""
    if not isinstance(input_str, str):
        return ""

    # Remove control characters
    sanitized = ''.join(char for char in input_str if ord(char) >= 32 or char in '\n\r\t')

    # Truncate to max length
    if len(sanitized) > max_length:
        sanitized = sanitized[:max_length]

    return sanitized.strip()

def validate_prompt_id(prompt_id: str) -> bool:
    """Validate prompt ID format"""
    if not isinstance(prompt_id, str):
        return False

    # Basic validation - should be alphanumeric with possible hyphens/underscores
    import re
    pattern = r'^[a-zA-Z0-9_-]+$'
    return bool(re.match(pattern, prompt_id))

def validate_project_id(project_id: str) -> bool:
    """Validate project ID format"""
    return validate_prompt_id(project_id)  # Same format as prompt ID

def calculate_cost_estimate(
    tokens_used: int,
    model_provider: str = "openai",
    model_name: str = "gpt-3.5-turbo"
) -> float:
    """Calculate estimated cost based on tokens and model"""
    # Simple cost estimation - in production, use actual pricing
    cost_per_1k_tokens = {
        "openai": {
            "gpt-3.5-turbo": 0.002,
            "gpt-4": 0.03,
            "gpt-4-turbo": 0.01
        },
        "anthropic": {
            "claude-2": 0.011,
            "claude-instant": 0.0011
        },
        "google": {
            "gemini-pro": 0.00025,
            "gemini-ultra": 0.002
        }
    }

    provider_costs = cost_per_1k_tokens.get(model_provider, {})
    cost_per_1k = provider_costs.get(model_name, 0.001)  # Default fallback

    return (tokens_used / 1000) * cost_per_1k

def format_cost(cost_usd: float) -> str:
    """Format cost as currency string"""
    return f"${cost_usd:.6f}"

def truncate_string(text: str, max_length: int = 100) -> str:
    """Truncate string with ellipsis"""
    if len(text) <= max_length:
        return text
    return text[:max_length - 3] + "..."

def safe_json_loads(json_str: str) -> Optional[Dict[str, Any]]:
    """Safely load JSON string"""
    try:
        return json.loads(json_str)
    except (json.JSONDecodeError, TypeError):
        return None

def safe_json_dumps(obj: Any) -> str:
    """Safely dump object to JSON string"""
    try:
        return json.dumps(obj, separators=(',', ':'))
    except (TypeError, ValueError):
        return "{}"

def get_rate_limit_reset_time(window_type: str) -> datetime:
    """Get reset time for rate limit window"""
    now = datetime.utcnow()

    if window_type == "minute":
        return (now + timedelta(minutes=1)).replace(second=0, microsecond=0)
    elif window_type == "hour":
        return (now + timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)
    elif window_type == "day":
        return (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    else:
        return now + timedelta(minutes=1)

def create_success_response(data: Any, message: str = "Success") -> Dict[str, Any]:
    """Create standardized success response"""
    return {
        "success": True,
        "message": message,
        "data": data,
        "timestamp": format_timestamp()
    }

def create_error_response(
    error: str,
    status_code: int = 400,
    details: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Create standardized error response"""
    response = {
        "success": False,
        "error": error,
        "status_code": status_code,
        "timestamp": format_timestamp()
    }

    if details:
        response["details"] = details

    return response

def validate_scopes(required_scopes: List[str], available_scopes: List[str]) -> bool:
    """Validate if required scopes are available"""
    required_set = set(required_scopes)
    available_set = set(available_scopes)
    return required_set.issubset(available_set)

def validate_project_access(
    project_id: str,
    allowed_projects: Optional[List[str]]
) -> bool:
    """Validate access to specific project"""
    if allowed_projects is None:
        return True  # No restriction
    return project_id in allowed_projects

def get_client_ip(request) -> str:
    """Get client IP address from request"""
    x_forwarded_for = request.headers.get("X-Forwarded-For")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()

    x_real_ip = request.headers.get("X-Real-IP")
    if x_real_ip:
        return x_real_ip

    return request.client.host if request.client else "unknown"

def _load_candidate_key(raw_key: str, source: str) -> Optional[bytes]:
    """Validate and normalize a potential encryption key from the given source."""
    if not raw_key:
        return None

    candidate = raw_key.strip()
    if not candidate:
        return None

    key_bytes = candidate.encode()

    try:
        Fernet(key_bytes)
        print(f"DEBUG: Using {source} key, length: {len(key_bytes)}")
        return key_bytes
    except Exception as e:
        print(f"Error using {source} key: {e}")
        if len(key_bytes) == 32:
            try:
                import base64
                encoded_key = base64.urlsafe_b64encode(key_bytes)
                Fernet(encoded_key)
                print(f"DEBUG: Converted raw 32-byte {source} key to Fernet format")
                return encoded_key
            except Exception as convert_error:
                print(f"Error converting raw {source} key: {convert_error}")

    return None


def get_encryption_key() -> bytes:
    """Get or create encryption key for secret keys"""
    # Try environment variable first (most reliable when exported)
    env_key = _load_candidate_key(os.getenv('PROMPTOPS_ENCRYPTION_KEY'), "environment variable")
    if env_key:
        return env_key

    # Fallback to settings-derived key (supports .env files loaded via pydantic settings)
    settings_key = _load_candidate_key(settings.promptops_encryption_key, "application settings")
    if settings_key:
        return settings_key

    # Fallback to file-based storage
    key_file = "/tmp/promptops_encryption_key"

    if os.path.exists(key_file):
        try:
            with open(key_file, 'rb') as f:
                key = f.read()
                print(f"DEBUG: Using file key, length: {len(key)}")
                return key
        except Exception as e:
            print(f"Error reading key file: {e}")

    # Generate new key as last resort
    try:
        key = Fernet.generate_key()
        with open(key_file, 'wb') as f:
            f.write(key)
        print(f"Generated new encryption key and saved to {key_file}")
        print(f"Set this key as environment variable for persistence: PROMPTOPS_ENCRYPTION_KEY={key.decode()}")
        return key
    except Exception as e:
        print(f"Error generating new key: {e}")
        # Last resort fallback key - generate proper Fernet key
        return Fernet.generate_key()

def encrypt_secret_key(secret_key: str) -> str:
    """Encrypt secret key for storage"""
    key = get_encryption_key()
    fernet = Fernet(key)
    encrypted = fernet.encrypt(secret_key.encode())
    return encrypted.decode()

def decrypt_secret_key(encrypted_key: str) -> str:
    """Decrypt secret key for display"""
    try:
        key = get_encryption_key()
        print(f"DEBUG: Using encryption key: {key[:20]}..." if len(key) > 20 else f"DEBUG: Using encryption key: {key}")
        fernet = Fernet(key)
        decrypted = fernet.decrypt(encrypted_key.encode())
        print(f"DEBUG: Successfully decrypted key")
        return decrypted.decode()
    except Exception as e:
        print(f"DEBUG: Decryption failed with error: {str(e)}")
        print(f"DEBUG: Encrypted key length: {len(encrypted_key)}")
        print(f"DEBUG: Encrypted key starts with: {encrypted_key[:50]}...")
        raise
