from fastapi import HTTPException, status, Request, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
import hashlib
import hmac
import time
import json
from datetime import datetime, timedelta
import redis
import uuid
import structlog

from app.database import get_db
from app.models import ClientApiKey, RateLimitRecord, ClientApiKeyStatus
from app.schemas import APIKeyValidationResponse
from app.config import settings
from app.utilslib import (
    generate_api_key_pair, hash_api_key, hash_secret_key, extract_api_key_prefix,
    verify_hmac_signature, is_timestamp_valid, create_success_response,
    create_error_response, get_client_ip
)

logger = structlog.get_logger()
security = HTTPBearer()

# Initialize Redis connection
redis_client = redis.from_url(settings.redis_url)

# Removed duplicate functions - now using utils module

def get_rate_limit_window(window_type: str) -> datetime:
    """Get the start time for a rate limit window"""
    now = datetime.utcnow()
    if window_type == "minute":
        return now.replace(second=0, microsecond=0)
    elif window_type == "hour":
        return now.replace(minute=0, second=0, microsecond=0)
    elif window_type == "day":
        return now.replace(hour=0, minute=0, second=0, microsecond=0)
    else:
        raise ValueError(f"Invalid window type: {window_type}")

async def check_rate_limit(api_key_id: str, rate_limits: Dict[str, int], db: Session) -> bool:
    """Check if API key is within rate limits"""
    try:
        current_time = datetime.utcnow()

        for window_type, limit in rate_limits.items():
            window_start = get_rate_limit_window(window_type)

            # Try to get from Redis first
            redis_key = f"rate_limit:{api_key_id}:{window_type}:{window_start.isoformat()}"

            # Use Redis atomic increment
            current_count = redis_client.incr(redis_key)

            # Set expiration if this is the first request in the window
            if current_count == 1:
                if window_type == "minute":
                    redis_client.expire(redis_key, 60)
                elif window_type == "hour":
                    redis_client.expire(redis_key, 3600)
                elif window_type == "day":
                    redis_client.expire(redis_key, 86400)

            # Check if limit exceeded
            if current_count > limit:
                logger.warning(
                    "Rate limit exceeded",
                    api_key_id=api_key_id,
                    window_type=window_type,
                    current_count=current_count,
                    limit=limit
                )
                return False

        return True
    except Exception as e:
        logger.error(f"Rate limit check failed: {str(e)}")
        # Fail open - allow request but log error
        return True

async def validate_api_key(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> APIKeyValidationResponse:
    """Validate API key and check rate limits"""

    # Extract headers for signature verification
    api_key = credentials.credentials
    signature = request.headers.get("X-PromptOps-Signature")
    timestamp = request.headers.get("X-PromptOps-Timestamp")

    if not signature or not timestamp:
        return APIKeyValidationResponse(
            valid=False,
            error="Missing signature or timestamp headers"
        )

    # Verify timestamp is recent (prevent replay attacks)
    if not is_timestamp_valid(timestamp):
        return APIKeyValidationResponse(
            valid=False,
            error="Invalid or expired timestamp"
        )

    # Get API key from database
    api_key_hash = hash_api_key(api_key)
    api_key_record = db.query(ClientApiKey).filter(
        ClientApiKey.api_key_hash == api_key_hash
    ).first()

    if not api_key_record:
        return APIKeyValidationResponse(
            valid=False,
            error="Invalid API key"
        )

    # Check API key status
    if api_key_record.status != ClientApiKeyStatus.ACTIVE:
        return APIKeyValidationResponse(
            valid=False,
            error=f"API key is {api_key_record.status.value}"
        )

    # Check expiration
    if api_key_record.expires_at and api_key_record.expires_at < datetime.utcnow():
        api_key_record.status = ClientApiKeyStatus.EXPIRED
        db.commit()
        return APIKeyValidationResponse(
            valid=False,
            error="API key has expired"
        )

    # Verify HMAC signature
    if not verify_hmac_signature(
        api_key,
        api_key_record.secret_key_hash,  # In production, store and retrieve the actual secret key
        timestamp,
        request.method,
        request.url.path,
        signature
    ):
        logger.warning("Invalid signature", api_key_prefix=api_key_record.api_key_prefix)
        return APIKeyValidationResponse(
            valid=False,
            error="Invalid signature"
        )

    # Check rate limits
    rate_limits = {
        "minute": api_key_record.rate_limit_per_minute,
        "hour": api_key_record.rate_limit_per_hour,
        "day": api_key_record.rate_limit_per_day
    }

    if not await check_rate_limit(api_key_record.id, rate_limits, db):
        return APIKeyValidationResponse(
            valid=False,
            error="Rate limit exceeded"
        )

    # Update last used timestamp
    api_key_record.last_used_at = datetime.utcnow()
    db.commit()

    return APIKeyValidationResponse(
        valid=True,
        api_key_id=api_key_record.id,
        user_id=api_key_record.user_id,
        tenant_id=api_key_record.tenant_id,
        scopes=api_key_record.allowed_scopes,
        allowed_projects=api_key_record.allowed_projects,
        rate_limits=rate_limits
    )

async def get_current_client_user(
    request: Request,
    validation: APIKeyValidationResponse = Depends(validate_api_key),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Get current user from validated API key"""

    if not validation.valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=validation.error,
            headers={"WWW-Authenticate": "Bearer"}
        )

    return {
        "user_id": validation.user_id,
        "tenant_id": validation.tenant_id,
        "api_key_id": validation.api_key_id,
        "scopes": validation.scopes,
        "allowed_projects": validation.allowed_projects,
        "rate_limits": validation.rate_limits
    }

def require_scope(required_scope: str):
    """Dependency to check if API key has required scope"""
    async def scope_checker(
        user: Dict[str, Any] = Depends(get_current_client_user)
    ):
        if required_scope not in user["scopes"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient scope. Required: {required_scope}"
            )
        return user
    return scope_checker

def require_project_access(project_id: str):
    """Dependency to check if API key has access to specific project"""
    async def project_access_checker(
        user: Dict[str, Any] = Depends(get_current_client_user)
    ):
        allowed_projects = user["allowed_projects"]
        if allowed_projects is not None and project_id not in allowed_projects:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"No access to project: {project_id}"
            )
        return user
    return project_access_checker

def optional_project_access(project_id: Optional[str] = None):
    """Optional project access dependency - only checks if project_id is provided"""
    if project_id is None:
        return None

    async def optional_checker(
        user: Dict[str, Any] = Depends(get_current_client_user)
    ):
        allowed_projects = user["allowed_projects"]
        if allowed_projects is not None and project_id not in allowed_projects:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"No access to project: {project_id}"
            )
        return user

    return optional_checker

async def log_usage(
    request: Request,
    response,
    user: Dict[str, Any],
    processing_time_ms: int,
    tokens_requested: Optional[int] = None,
    tokens_used: Optional[int] = None,
    estimated_cost_usd: Optional[str] = None
):
    """Log API usage asynchronously"""
    try:
        from app.models import ClientUsageLog
        import uuid

        # Extract prompt_id and project_id from request if available
        prompt_id = request.path_params.get("prompt_id")
        project_id = request.query_params.get("project_id")

        usage_log = ClientUsageLog(
            id=str(uuid.uuid4()),
            api_key_id=user["api_key_id"],
            user_id=user["user_id"],
            tenant_id=user["tenant_id"],
            endpoint=request.url.path,
            method=request.method,
            prompt_id=prompt_id,
            project_id=project_id,
            tokens_requested=tokens_requested,
            tokens_used=tokens_used,
            response_size=len(response.body) if hasattr(response, 'body') else 0,
            processing_time_ms=processing_time_ms,
            estimated_cost_usd=estimated_cost_usd,
            status_code=response.status_code,
            error_message=None if response.status_code < 400 else str(response.body),
            user_agent=request.headers.get("user-agent"),
            ip_address=request.client.host if request.client else None,
            request_id=request.headers.get("X-Request-ID")
        )

        # Add to database (in production, this should be done asynchronously)
        db_session = next(get_db())
        db_session.add(usage_log)
        db_session.commit()
        db_session.close()

    except Exception as e:
        logger.error(f"Failed to log usage: {str(e)}")