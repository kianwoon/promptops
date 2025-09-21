import os
from typing import List, Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql://promptops:promptops@localhost:5432/promptops"
    
    # Redis
    redis_url: str = "redis://localhost:6379"
    
    # Security
    secret_key: str = "your-secret-key-change-in-production"
    algorithm: str = "HS256"
    # Uppercase versions for backward compatibility
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24 hours instead of 30 minutes
    
    # Google OAuth Configuration
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/v1/auth/google/callback"

    # GitHub OAuth Configuration
    github_client_id: str = ""
    github_client_secret: str = ""
    github_redirect_uri: str = "http://localhost:8000/api/v1/auth/github/callback"
    
    # OIDC Configuration (legacy)
    oidc_client_id: str = ""
    oidc_client_secret: str = ""
    oidc_discovery_url: str = ""
    
    # Policy Engine
    opa_url: str = "http://localhost:8181"
    
    # Application
    app_name: str = "PromptOps Registry"
    app_version: str = "0.1.0"
    debug: bool = False
    
    # CORS
    cors_origins: List[str] = ["http://localhost:3000", "http://localhost:8000"]
    
    # Cache settings
    cache_ttl: int = 3600  # 1 hour

    # API Key Encryption
    promptops_encryption_key: str = ""

    # Role Assignment Configuration
    # Default role for new users (admin, user, viewer)
    default_user_role: str = "user"

    # Admin role assignment - emails and domains that get admin role
    admin_emails: List[str] = []
    admin_domains: List[str] = []

    # User role assignment - emails and domains that get user role
    user_emails: List[str] = []
    user_domains: List[str] = []

    class Config:
        env_file = ".env"

settings = Settings()