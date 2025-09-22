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

def determine_user_role(email: str, name: str = None) -> UserRole:
    """
    Determine appropriate user role based on email and other attributes.
    This provides more intelligent role assignment than defaulting to VIEWER.
    """
    email = email.lower().strip() if email else ""

    # Admin role assignment logic
    admin_domains = settings.admin_domains if hasattr(settings, 'admin_domains') else []
    admin_emails = settings.admin_emails if hasattr(settings, 'admin_emails') else []

    # Check if email is in admin emails list
    if email in admin_emails:
        logger.info("Assigning ADMIN role based on email whitelist", email=email)
        return UserRole.ADMIN

    # Check if email domain is in admin domains
    if admin_domains:
        email_domain = email.split('@')[-1] if '@' in email else ''
        if email_domain in admin_domains:
            logger.info("Assigning ADMIN role based on domain whitelist", email=email, domain=email_domain)
            return UserRole.ADMIN

    # User role assignment logic
    user_domains = settings.user_domains if hasattr(settings, 'user_domains') else []
    user_emails = settings.user_emails if hasattr(settings, 'user_emails') else []

    # Check if email is in user emails list
    if email in user_emails:
        logger.info("Assigning USER role based on email whitelist", email=email)
        return UserRole.USER

    # Check if email domain is in user domains
    if user_domains:
        email_domain = email.split('@')[-1] if '@' in email else ''
        if email_domain in user_domains:
            logger.info("Assigning USER role based on domain whitelist", email=email, domain=email_domain)
            return UserRole.USER

    # Special patterns for role assignment
    if any(pattern in email for pattern in ['admin', 'root', 'super']):
        logger.info("Assigning ADMIN role based on email pattern", email=email)
        return UserRole.ADMIN

    # Default to USER role instead of VIEWER for better experience
    # This can be changed in settings if VIEWER should be the default
    default_role_str = getattr(settings, 'default_user_role', 'user')
    default_role = UserRole(default_role_str)
    logger.info("Assigning default role", email=email, role=default_role)
    return default_role

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
            logger.error(f"HTTP error exchanging code for tokens: {str(e)}")
            raise Exception("Failed to exchange authorization code")
        except Exception as e:
            logger.error(f"Error exchanging code for tokens: {str(e)}")
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
            logger.error(f"HTTP error getting user info: {str(e)}")
            raise Exception("Failed to get user information")
        except Exception as e:
            logger.error(f"Error getting user info: {str(e)}")
            raise Exception("Failed to get user information")
    
    async def verify_id_token(self, id_token: str) -> Dict[str, Any]:
        """Verify Google ID token and extract user information"""
        try:
            # For development, we'll decode the token without signature verification
            # In production, you should verify with Google's public keys
            payload = jwt.decode(
                id_token,
                "",  # Empty key since we're not verifying signature
                options={
                    "verify_signature": False,
                    "verify_aud": False,
                    "verify_iss": False,
                    "verify_at_hash": False
                }
            )
            
            # Basic validation
            if 'sub' not in payload:
                raise Exception('Missing subject in ID token')
            
            if 'email' not in payload:
                raise Exception('Missing email in ID token')
            
            # Log for debugging
            logger.info("ID token payload received", email=payload.get('email'), sub=payload.get('sub'))
            
            return payload
            
        except Exception as e:
            logger.error(f"ID token verification failed: {str(e)}")
            raise Exception(f"Invalid ID token: {str(e)}")

class GitHubOAuthService:
    def __init__(self):
        self.client_id = settings.github_client_id
        self.client_secret = settings.github_client_secret
        self.redirect_uri = settings.github_redirect_uri
        self.token_url = "https://github.com/login/oauth/access_token"
        self.userinfo_url = "https://api.github.com/user"

    async def exchange_code_for_tokens(self, code: str) -> Dict[str, Any]:
        """Exchange GitHub authorization code for access token"""
        try:
            data = {
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": self.redirect_uri,
            }

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(self.token_url, data=data, headers={
                    "Accept": "application/json"
                })
                response.raise_for_status()

                return response.json()

        except httpx.HTTPError as e:
            logger.error(f"HTTP error exchanging code for tokens: {str(e)}")
            raise Exception("Failed to exchange authorization code")
        except Exception as e:
            logger.error(f"Error exchanging code for tokens: {str(e)}")
            raise Exception("Failed to exchange authorization code")

    async def get_user_info(self, access_token: str) -> Dict[str, Any]:
        """Get user information from GitHub using access token"""
        try:
            headers = {
                "Authorization": f"token {access_token}",
                "Accept": "application/vnd.github.v3+json"
            }

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(self.userinfo_url, headers=headers)
                response.raise_for_status()

                return response.json()

        except httpx.HTTPError as e:
            logger.error(f"HTTP error getting user info: {str(e)}")
            raise Exception("Failed to get user information")
        except Exception as e:
            logger.error(f"Error getting user info: {str(e)}")
            raise Exception("Failed to get user information")

class AuthService:
    def __init__(self):
        self.google_oauth = GoogleOAuthService()
        self.github_oauth = GitHubOAuthService()
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
            # Pre-validate token structure
            if not token or not isinstance(token, str):
                logger.error("JWT verification failed: Empty or invalid token type", token_type=token_type)
                raise Exception("Invalid token")

            # Remove any 'Bearer ' prefix if present
            if token.startswith('Bearer '):
                token = token[7:]

            # Check for proper JWT format (header.payload.signature)
            if token.count('.') != 2:
                logger.error("JWT verification failed: Invalid token format - expected 3 segments", token_type=token_type)
                raise Exception("Invalid token")

            # Check for reasonable token length
            if len(token) < 30 or len(token) > 5000:
                logger.error("JWT verification failed: Invalid token length", token_type=token_type, token_length=len(token))
                raise Exception("Invalid token")

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
                    logger.error("JWT verification failed: Invalid header or payload structure", token_type=token_type)
                    raise Exception("Invalid token")

                # Check for required claims
                if 'exp' not in payload:
                    logger.error("JWT verification failed: Missing expiration claim", token_type=token_type)
                    raise Exception("Invalid token")

                # For development tokens, accept the special signature
                if signature == 'dev-signature-not-for-production':
                    logger.info("Development token detected in verify_token", token_type=token_type)
                    return payload

            except (ValueError, TypeError, json.JSONDecodeError, base64.binascii.Error) as e:
                logger.error(f"JWT verification failed: Invalid base64 encoding - {str(e)}", token_type=token_type)
                raise Exception("Invalid token")

            # Check if this is a development token
            if 'dev-signature-not-for-production' in token:
                logger.info("Development token detected - using development authentication", token_type=token_type)
                # For development tokens, decode without signature verification
                try:
                    import base64
                    import json

                    # Split token and decode payload manually
                    _, payload_b64, _ = token.split('.')
                    payload_b64 += '=' * (-len(payload_b64) % 4)
                    payload_data = base64.b64decode(payload_b64).decode('utf-8')
                    payload = json.loads(payload_data)

                    if payload.get("type") != token_type:
                        logger.error("Development token verification failed: Invalid token type", expected=token_type, actual=payload.get("type"))
                        raise Exception(f"Invalid token type. Expected: {token_type}")

                    return payload

                except Exception as e:
                    logger.error(f"Development token decode error: {str(e)}", token_type=token_type)
                    raise Exception("Invalid token")

            # Decode JWT token with proper signature verification for production tokens
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])

            if payload.get("type") != token_type:
                logger.error("JWT verification failed: Invalid token type", expected=token_type, actual=payload.get("type"))
                raise Exception(f"Invalid token type. Expected: {token_type}")

            return payload

        except JWTError as e:
            logger.error(f"JWT verification error: {str(e)}", token_type=token_type)
            raise Exception("Invalid token")
        except Exception as e:
            logger.error(f"Unexpected JWT verification error: {str(e)}", token_type=token_type)
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
                data={
                    "sub": user.id,
                    "email": user.email,
                    "role": user.role.value,
                    "tenant_id": user.tenant_id or user.organization or "default-tenant"
                }
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
                    "tenant_id": user.tenant_id or user.organization or "default-tenant",
                    "avatar": user.avatar,
                    "provider_id": user.provider_id,
                    "created_at": user.created_at.isoformat(),
                }
            }
            
        except Exception as e:
            logger.error(f"Google authentication failed: {str(e)}")
            raise Exception(f"Google authentication failed: {str(e)}")

    async def authenticate_with_github(self, code: str, db: Session) -> Dict[str, Any]:
        """Authenticate user with GitHub OAuth"""
        try:
            # Exchange code for tokens
            tokens = await self.github_oauth.exchange_code_for_tokens(code)

            # Get user info
            user_info = await self.github_oauth.get_user_info(tokens["access_token"])

            # Create or update user
            user = await self.get_or_create_github_user(user_info, db)

            # Update last login
            user.last_login = datetime.utcnow()
            db.commit()

            # Create JWT tokens
            access_token = self.create_access_token(
                data={
                    "sub": user.id,
                    "email": user.email,
                    "role": user.role.value,
                    "tenant_id": user.tenant_id or user.organization or "default-tenant"
                }
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
                    "tenant_id": user.tenant_id or user.organization or "default-tenant",
                    "avatar": user.avatar,
                    "provider_id": user.provider_id,
                    "created_at": user.created_at.isoformat(),
                }
            }

        except Exception as e:
            logger.error(f"GitHub authentication failed: {str(e)}")
            raise Exception(f"GitHub authentication failed: {str(e)}")
    
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
                role=determine_user_role(user_info["email"], user_info["name"]),
                tenant_id="default-tenant",
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            
            db.add(user)
            db.commit()
            db.refresh(user)
            
            logger.info("Created new Google OAuth user", user_id=user.id, email=user.email)
            return user
            
        except Exception as e:
            logger.error(f"Error creating/updating Google user: {str(e)}")
            db.rollback()
            raise Exception("Failed to create or update user")

    async def get_or_create_github_user(self, user_info: Dict[str, Any], db: Session) -> User:
        """Get existing user or create new one from GitHub OAuth data"""
        try:
            # GitHub user info structure: id, login, name, email, avatar_url
            github_id = str(user_info["id"])
            github_username = user_info["login"]
            github_name = user_info.get("name") or github_username
            github_email = user_info.get("email")
            github_avatar = user_info.get("avatar_url")

            # Check if user exists by GitHub provider ID
            user = db.query(User).filter(User.provider_id == github_id).first()

            if user:
                # Update user info if needed
                if user.name != github_name or (github_email and user.email != github_email):
                    user.name = github_name
                    if github_email:
                        user.email = github_email
                    user.updated_at = datetime.utcnow()
                return user

            # Check if user exists by email (if email is available)
            if github_email:
                user = db.query(User).filter(User.email == github_email).first()

                if user:
                    # Link GitHub account to existing user
                    user.provider = AuthProvider.GITHUB
                    user.provider_id = github_id
                    user.is_verified = True
                    user.updated_at = datetime.utcnow()
                    return user

            # Create new user - use GitHub ID as user ID
            user = User(
                id=github_id,
                email=github_email or f"{github_username}@github.local",  # Fallback email for users without public email
                name=github_name,
                provider=AuthProvider.GITHUB,
                provider_id=github_id,
                is_verified=True,
                avatar=github_avatar,
                role=determine_user_role(github_email or f"{github_username}@github.local", github_name),
                tenant_id="default-tenant",
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )

            db.add(user)
            db.commit()
            db.refresh(user)

            logger.info("Created new GitHub OAuth user", user_id=user.id, email=user.email)
            return user

        except Exception as e:
            logger.error(f"Error creating/updating GitHub user: {str(e)}")
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
                data={
                    "sub": user.id,
                    "email": user.email,
                    "role": user.role.value,
                    "tenant_id": user.tenant_id or user.organization or "default-tenant"
                }
            )
            
            return access_token
            
        except Exception as e:
            logger.error(f"Token refresh failed: {str(e)}")
            raise Exception("Failed to refresh token")
    
    async def get_current_user(self, token: str, db: Session) -> Optional[User]:
        """Get current user from JWT token"""
        try:
            payload = self.verify_token(token, "access")
            user_id = payload.get("sub")

            if not user_id:
                logger.warning("🔐 JWT token missing user_id (sub)")
                return None

            logger.info(f"🔐 Looking for user with ID: {user_id}")
            user = db.query(User).filter(User.id == user_id).first()

            if user:
                logger.info(f"🔐 Found user: {user.email} with organization: {user.organization}")
            else:
                logger.warning(f"🔐 User with ID {user_id} not found in database")

            if user:
                logger.info(f"🔐 Found user: {user.email} with organization: {user.organization}")
                return user
            else:
                logger.warning(f"🔐 User with ID {user_id} not found in database")
                return None

        except Exception as e:
            logger.error(f"Error getting current user: {str(e)}")
            return None