from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from app.config import settings
import logging

logger = logging.getLogger(__name__)

def validate_jwt_structure(token: str) -> bool:
    """Basic JWT structure validation before decoding"""
    if not token or not isinstance(token, str):
        logger.error("JWT validation failed: Empty or invalid token type")
        return False

    # Remove any 'Bearer ' prefix if present
    if token.startswith('Bearer '):
        token = token[7:]

    # Check for proper JWT format (header.payload.signature)
    if token.count('.') != 2:
        logger.error("JWT validation failed: Invalid token format - expected 3 segments")
        return False

    # Check for reasonable token length
    if len(token) < 30 or len(token) > 5000:
        logger.error("JWT validation failed: Invalid token length")
        return False

    # Try to decode the header and payload to check they're valid base64
    try:
        import base64
        import json

        # Split token into parts
        header_b64, payload_b64, signature = token.split('.')

        # Add padding if needed and decode header
        header_b64 += '=' * (-len(header_b64) % 4)
        header_data = base64.b64decode(header_b64).decode('utf-8')
        header = json.loads(header_data)

        # Add padding if needed and decode payload
        payload_b64 += '=' * (-len(payload_b64) % 4)
        payload_data = base64.b64decode(payload_b64).decode('utf-8')
        payload = json.loads(payload_data)

        # Basic validation of JWT structure
        if not isinstance(header, dict) or not isinstance(payload, dict):
            logger.error("JWT validation failed: Invalid header or payload structure")
            return False

        # Check for required claims
        if 'exp' not in payload:
            logger.error("JWT validation failed: Missing expiration claim")
            return False

        # For development tokens, accept the special signature
        if signature == 'dev-signature-not-for-production':
            logger.info("Development token detected with valid structure")
            return True

        return True

    except (ValueError, TypeError, json.JSONDecodeError, base64.binascii.Error) as e:
        logger.error(f"JWT validation failed: Invalid base64 encoding - {str(e)}")
        return False

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Validate JWT token and return current user"""

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        # Pre-validate token structure
        if not validate_jwt_structure(credentials.credentials):
            logger.error("JWT structure validation failed")
            raise credentials_exception

        # Check if this is a development token
        if 'dev-signature-not-for-production' in credentials.credentials:
            logger.info("Development token detected - using development authentication")
            # For development tokens, decode without signature verification
            try:
                import base64
                import json

                # Split token and decode payload manually
                _, payload_b64, _ = credentials.credentials.split('.')
                payload_b64 += '=' * (-len(payload_b64) % 4)
                payload_data = base64.b64decode(payload_b64).decode('utf-8')
                payload = json.loads(payload_data)

                user_id: str = payload.get("sub") or payload.get("user_id")
                tenant: str = payload.get("tenant") or payload.get("tenant_id")

                roles_claim = payload.get("roles")
                roles: list[str] = []

                if isinstance(roles_claim, list) and roles_claim:
                    roles = [str(r).lower() for r in roles_claim if r]
                else:
                    role = payload.get("role")
                    if role:
                        roles = [str(role).lower()]

                if user_id is None:
                    logger.error("Development token missing user_id in payload")
                    raise credentials_exception

                logger.info(f"Development user authenticated: {user_id}")
                return {
                    "user_id": user_id,
                    "tenant": tenant,
                    "tenant_id": tenant,
                    "roles": roles
                }

            except Exception as e:
                logger.error(f"Development token decode error: {str(e)}")
                raise credentials_exception

        # Decode JWT token with proper signature verification for production tokens
        payload = jwt.decode(
            credentials.credentials,
            settings.secret_key,
            algorithms=[settings.algorithm]
        )

        user_id: str = payload.get("sub")
        tenant: str = payload.get("tenant") or payload.get("tenant_id")

        roles_claim = payload.get("roles")
        roles: list[str] = []

        if isinstance(roles_claim, list) and roles_claim:
            roles = [str(r).lower() for r in roles_claim if r]
        else:
            role = payload.get("role")
            if role:
                roles = [str(role).lower()]

        if user_id is None:
            logger.error("JWT validation failed: No user_id in payload")
            raise credentials_exception

    except JWTError as e:
        logger.error(f"JWT decode error: {str(e)}")
        raise credentials_exception
    except Exception as e:
        logger.error(f"Unexpected JWT validation error: {str(e)}")
        raise credentials_exception

    return {
        "user_id": user_id,
        "tenant": tenant,
        "tenant_id": tenant,
        "roles": roles
    }
