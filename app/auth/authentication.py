from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from app.config import settings

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Validate JWT token and return current user"""
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
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
            raise credentials_exception

    except JWTError:
        raise credentials_exception

    return {
        "user_id": user_id,
        "tenant": tenant,
        "tenant_id": tenant,
        "roles": roles
    }
