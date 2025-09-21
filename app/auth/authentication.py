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

    # Check for proper JWT format (header.payload.signature)
    if token.count('.') != 2:
        logger.error("JWT validation failed: Invalid token format - expected 3 segments")
        return False

    # Check for reasonable token length
    if len(token) < 30 or len(token) > 5000:
        logger.error("JWT validation failed: Invalid token length")
        return False

    return True

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

        # Decode JWT token
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
        logger.error("JWT decode error", error=str(e))
        raise credentials_exception
    except Exception as e:
        logger.error("Unexpected JWT validation error", error=str(e))
        raise credentials_exception

    return {
        "user_id": user_id,
        "tenant": tenant,
        "tenant_id": tenant,
        "roles": roles
    }
