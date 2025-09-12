"""
Authentication router for Google OAuth and JWT management
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Dict, Any
import structlog

from app.database import get_db
from app.services.auth_service import AuthService

logger = structlog.get_logger()
router = APIRouter()
security = HTTPBearer()

# Pydantic models
class GoogleAuthRequest(BaseModel):
    code: str

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    user: Dict[str, Any]

class RefreshTokenResponse(BaseModel):
    access_token: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    organization: Optional[str]
    avatar: Optional[str]
    provider: Optional[str]
    provider_id: Optional[str]
    is_verified: bool
    created_at: str
    last_login: Optional[str]

# Dependencies
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> UserResponse:
    """Get current authenticated user"""
    try:
        auth_service = AuthService()
        user = await auth_service.get_current_user(credentials.credentials, db)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        return UserResponse(
            id=user.id,
            email=user.email,
            name=user.name,
            role=user.role.value,
            organization=user.organization,
            avatar=user.avatar,
            provider=user.provider.value if user.provider else None,
            provider_id=user.provider_id,
            is_verified=user.is_verified,
            created_at=user.created_at.isoformat(),
            last_login=user.last_login.isoformat() if user.last_login else None,
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error getting current user", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

# Endpoints
@router.get("/google/callback")
async def google_oauth_callback(
    code: str,
    state: str = None,
    db: Session = Depends(get_db)
):
    """Handle Google OAuth callback and redirect to frontend"""
    from fastapi.responses import RedirectResponse
    
    try:
        auth_service = AuthService()
        result = await auth_service.authenticate_with_google(code, db)
        
        logger.info("Google OAuth authentication successful", email=result["user"]["email"])
        
        # Redirect to frontend with tokens in URL parameters
        frontend_url = "http://localhost:3000/auth/success"
        redirect_params = f"?access_token={result['access_token']}&refresh_token={result['refresh_token']}"
        
        return RedirectResponse(url=f"{frontend_url}{redirect_params}")
        
    except Exception as e:
        logger.error("Google OAuth callback failed", error=str(e))
        # Redirect to frontend with error
        error_url = f"http://localhost:3000/auth/error?error={str(e)}"
        return RedirectResponse(url=error_url)

@router.post("/refresh", response_model=RefreshTokenResponse)
async def refresh_access_token(
    request: RefreshTokenRequest,
    db: Session = Depends(get_db)
):
    """Refresh access token"""
    try:
        auth_service = AuthService()
        access_token = await auth_service.refresh_access_token(request.refresh_token, db)
        
        return RefreshTokenResponse(access_token=access_token)
        
    except Exception as e:
        logger.error("Token refresh failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: UserResponse = Depends(get_current_user)):
    """Get current user information"""
    return current_user

@router.post("/logout")
async def logout():
    """Logout endpoint (client-side token clearing)"""
    return {"message": "Successfully logged out"}

@router.get("/health")
async def auth_health_check():
    """Health check for authentication service"""
    return {"status": "healthy", "service": "authentication"}