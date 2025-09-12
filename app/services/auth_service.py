"""
Google OAuth authentication service
"""

import httpx
import json
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import structlog
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import settings
from app.models import User, AuthProvider, UserRole

logger = structlog.get_logger()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class GoogleOAuthService:
    def __init__(self):
        self.client_id = settings.google_client_id
        self.client_secret = settings.google_client_secret
        self.redirect_uri = settings.google_redirect_uri
        self.token_url = "https://oauth2.googleapis.com/token"
        self.userinfo_url = "https://www.googleapis.com/oauth2/v2/userinfo"
        
    async def exchange_code_for_tokens(self, code: str) -> Dict[str, Any]:
        """Exchange Google authorization code for access and ID tokens"""
        try:
            data = {
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": self.redirect_uri,
            }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(self.token_url, data=data)
                response.raise_for_status()
                
                return response.json()
                
        except httpx.HTTPError as e:
            logger.error("HTTP error exchanging code for tokens", error=str(e))
            raise Exception("Failed to exchange authorization code")
        except Exception as e:
            logger.error("Error exchanging code for tokens", error=str(e))
            raise Exception("Failed to exchange authorization code")
    
    async def get_user_info(self, access_token: str) -> Dict[str, Any]:
        """Get user information from Google using access token"""
        try:
            headers = {"Authorization": f"Bearer {access_token}"}
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(self.userinfo_url, headers=headers)
                response.raise_for_status()
                
                return response.json()
                
        except httpx.HTTPError as e:
            logger.error("HTTP error getting user info", error=str(e))
            raise Exception("Failed to get user information")
        except Exception as e:
            logger.error("Error getting user info", error=str(e))
            raise Exception("Failed to get user information")
    
    async def verify_id_token(self, id_token: str) -> Dict[str, Any]:
        """Verify Google ID token and extract user information"""
        try:
            # For production, you should verify the token with Google's public keys
            # For now, we'll decode and validate the basic structure
            payload = jwt.decode(
                id_token,
                options={"verify_signature": False}  # TODO: Add proper verification
            )
            
            # Validate required fields
            required_fields = ["sub", "email", "name"]
            for field in required_fields:
                if field not in payload:
                    raise Exception(f"Missing required field in ID token: {field}")
            
            return payload
            
        except JWTError as e:
            logger.error("JWT verification error", error=str(e))
            raise Exception("Invalid ID token")
        except Exception as e:
            logger.error("Error verifying ID token", error=str(e))
            raise Exception("Invalid ID token")

class AuthService:
    def __init__(self):
        self.google_oauth = GoogleOAuthService()
        self.secret_key = settings.secret_key
        self.algorithm = settings.algorithm
        self.access_token_expire_minutes = settings.access_token_expire_minutes
        
    def create_access_token(self, data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
        """Create JWT access token"""
        to_encode = data.copy()
        
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=self.access_token_expire_minutes)
            
        to_encode.update({"exp": expire, "type": "access"})
        encoded_jwt = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
        
        return encoded_jwt
    
    def create_refresh_token(self, data: Dict[str, Any]) -> str:
        """Create JWT refresh token"""
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(days=7)  # 7 days
        to_encode.update({"exp": expire, "type": "refresh"})
        encoded_jwt = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
        
        return encoded_jwt
    
    def verify_token(self, token: str, token_type: str = "access") -> Dict[str, Any]:
        """Verify JWT token and return payload"""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            
            if payload.get("type") != token_type:
                raise Exception(f"Invalid token type. Expected: {token_type}")
                
            return payload
            
        except JWTError as e:
            logger.error("JWT verification error", error=str(e))
            raise Exception("Invalid token")
    
    async def authenticate_with_google(self, code: str, db: Session) -> Dict[str, Any]:
        """Authenticate user with Google OAuth"""
        try:
            # Exchange code for tokens
            tokens = await self.google_oauth.exchange_code_for_tokens(code)
            
            # Get user info
            user_info = await self.google_oauth.get_user_info(tokens["access_token"])
            
            # Verify ID token
            id_token_payload = await self.google_oauth.verify_id_token(tokens["id_token"])
            
            # Create or update user
            user = await self.get_or_create_google_user(user_info, id_token_payload, db)
            
            # Update last login
            user.last_login = datetime.utcnow()
            db.commit()
            
            # Create JWT tokens
            access_token = self.create_access_token(
                data={"sub": user.id, "email": user.email, "role": user.role.value}
            )
            refresh_token = self.create_refresh_token(
                data={"sub": user.id, "email": user.email}
            )
            
            return {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "name": user.name,
                    "role": user.role.value,
                    "organization": user.organization or "",
                    "avatar": user.avatar,
                    "provider_id": user.provider_id,
                    "created_at": user.created_at.isoformat(),
                }
            }
            
        except Exception as e:
            logger.error("Google authentication failed", error=str(e))
            raise Exception(f"Google authentication failed: {str(e)}")
    
    async def get_or_create_google_user(self, user_info: Dict[str, Any], id_token_payload: Dict[str, Any], db: Session) -> User:
        """Get existing user or create new one from Google OAuth data"""
        try:
            # Check if user exists by Google provider ID
            user = db.query(User).filter(User.provider_id == id_token_payload["sub"]).first()
            
            if user:
                # Update user info if needed
                if user.name != user_info["name"] or user.email != user_info["email"]:
                    user.name = user_info["name"]
                    user.email = user_info["email"]
                    user.updated_at = datetime.utcnow()
                return user
            
            # Check if user exists by email
            user = db.query(User).filter(User.email == user_info["email"]).first()
            
            if user:
                # Link Google account to existing user
                user.provider = AuthProvider.GOOGLE
                user.provider_id = id_token_payload["sub"]
                user.is_verified = True
                user.updated_at = datetime.utcnow()
                return user
            
            # Create new user
            user = User(
                id=id_token_payload["sub"],
                email=user_info["email"],
                name=user_info["name"],
                provider=AuthProvider.GOOGLE,
                provider_id=id_token_payload["sub"],
                is_verified=True,
                avatar=user_info.get("picture"),
                role=UserRole.USER,  # Default role for new users
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            
            db.add(user)
            db.commit()
            db.refresh(user)
            
            logger.info("Created new Google OAuth user", user_id=user.id, email=user.email)
            return user
            
        except Exception as e:
            logger.error("Error creating/updating Google user", error=str(e))
            db.rollback()
            raise Exception("Failed to create or update user")
    
    async def refresh_access_token(self, refresh_token: str, db: Session) -> str:
        """Refresh access token using refresh token"""
        try:
            payload = self.verify_token(refresh_token, "refresh")
            user_id = payload.get("sub")
            
            if not user_id:
                raise Exception("Invalid refresh token")
            
            # Check if user exists
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                raise Exception("User not found")
            
            # Create new access token
            access_token = self.create_access_token(
                data={"sub": user.id, "email": user.email, "role": user.role.value}
            )
            
            return access_token
            
        except Exception as e:
            logger.error("Token refresh failed", error=str(e))
            raise Exception("Failed to refresh token")
    
    async def get_current_user(self, token: str, db: Session) -> Optional[User]:
        """Get current user from JWT token"""
        try:
            payload = self.verify_token(token, "access")
            user_id = payload.get("sub")
            
            if not user_id:
                return None
            
            user = db.query(User).filter(User.id == user_id).first()
            return user
            
        except Exception as e:
            logger.error("Error getting current user", error=str(e))
            return None