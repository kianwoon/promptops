# Auth module initialization

from app.auth.rbac import rbac_service
from app.auth.authentication import get_current_user
from fastapi import Request
import logging
from app.database import get_db
from app.services.auth_service import AuthService

logger = logging.getLogger(__name__)

async def get_current_user_or_demo(request: Request = None):
    """
    Get current user from JWT token or fall back to demo user for development.
    This provides a smooth transition between development and production authentication.
    """
    try:
        # Try to get the real user from JWT authentication first
        if request:
            from fastapi.security import HTTPAuthorizationCredentials

            # Try to extract Authorization header manually
            auth_header = request.headers.get("Authorization")
            if auth_header and auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]

                logger.info(f"🔐 JWT token validation attempt for request to {request.url.path}")

                # Use AuthService to properly validate the token
                db = next(get_db())
                try:
                    auth_service = AuthService()
                    user = await auth_service.get_current_user(token, db)

                    if user:
                        logger.info(f"🔐 Successfully authenticated user: {user.email}")
                        # Return user object with tenant_id (using organization as tenant_id)
                        return {
                            "user_id": user.id,
                            "tenant": user.organization or "default-tenant",
                            "tenant_id": user.organization or "default-tenant",
                            "email": user.email,
                            "name": user.name,
                            "roles": [user.role.value] if user.role else ["user"]
                        }
                    else:
                        logger.warning("🔐 User not found in database for valid token")

                except Exception as e:
                    logger.error(f"🔐 AuthService authentication failed: {e}")
                finally:
                    db.close()
    except Exception as e:
        logger.error(f"🔐 Authentication system error: {e}")

    # If JWT authentication fails, check for demo user in request state (development mode)
    if request and hasattr(request.state, 'current_user') and request.state.current_user:
        logger.info("🔐 Using request state demo user")
        return request.state.current_user

    # Ultimate fallback for development
    logger.warning("🔐 Using ultimate fallback demo user - authentication failed completely")
    return {
        "user_id": "demo-user",
        "tenant": "demo-tenant",
        "tenant_id": "demo-tenant",
        "roles": ["admin"]
    }

__all__ = ['rbac_service', 'get_current_user', 'get_current_user_or_demo']