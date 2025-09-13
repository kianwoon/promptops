from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from typing import List, Optional, Dict, Any
import uuid
import time
from datetime import datetime, timedelta

from app.database import get_db
from app.models import (
    ClientApiKey, ClientUsageLog, RateLimitRecord,
    ClientApiKeyStatus, Prompt, Module, Project
)
from app.schemas import (
    ClientApiKeyCreate, ClientApiKeyResponse, ClientApiKeyUpdate,
    ClientApiKeyCreateResponse, UsageLogCreate, UsageLogResponse,
    UsageStatsRequest, UsageStatsResponse, UsageLimitsResponse,
    APIKeyValidationRequest, APIKeyValidationResponse,
    BatchPromptRequest, BatchPromptResponse,
    PromptSearchRequest, PromptSearchResponse
)
from app.client_auth import (
    get_current_client_user, require_scope, require_project_access,
    optional_project_access, log_usage
)
from app.utils import (
    generate_api_key_pair, hash_api_key, hash_secret_key, extract_api_key_prefix,
    create_hmac_signature, format_timestamp, validate_prompt_id,
    validate_project_id, get_client_ip, encrypt_secret_key, decrypt_secret_key
)
from fastapi import Request
import structlog

logger = structlog.get_logger()
router = APIRouter()

# Unprotected routes for web UI (using user auth instead of API key auth)
@router.get("/web/auth/api-keys", response_model=List[ClientApiKeyResponse])
async def list_api_keys_web(
    request: Request,
    db: Session = Depends(get_db)
):
    """List all API keys for the current user (web UI version)"""

    user = request.state.current_user
    api_keys = db.query(ClientApiKey).filter(
        ClientApiKey.user_id == user["user_id"]
    ).order_by(ClientApiKey.created_at.desc()).all()

    # Decrypt keys for response
    for api_key in api_keys:
        # Decrypt secret key
        if api_key.secret_key_encrypted:
            try:
                api_key.secret_key = decrypt_secret_key(api_key.secret_key_encrypted)
            except Exception as e:
                print(f"Failed to decrypt secret key: {e}")
                api_key.secret_key = None

        # Decrypt API key
        if api_key.api_key_encrypted:
            try:
                api_key.api_key = decrypt_secret_key(api_key.api_key_encrypted)
                print(f"WEB DEBUG: Set {api_key.id} api_key to: {api_key.api_key}")
            except Exception as e:
                print(f"Failed to decrypt API key: {e}")
                api_key.api_key = None

    # Convert to dictionaries to ensure proper serialization
    result = []
    for api_key in api_keys:
        key_dict = {
            "id": api_key.id,
            "user_id": api_key.user_id,
            "tenant_id": api_key.tenant_id,
            "name": api_key.name,
            "description": api_key.description,
            "api_key_prefix": api_key.api_key_prefix,
            "api_key": api_key.api_key if hasattr(api_key, 'api_key') else None,
            "secret_key": api_key.secret_key,
            "rate_limit_per_minute": api_key.rate_limit_per_minute,
            "rate_limit_per_hour": api_key.rate_limit_per_hour,
            "rate_limit_per_day": api_key.rate_limit_per_day,
            "allowed_projects": api_key.allowed_projects,
            "allowed_scopes": api_key.allowed_scopes,
            "status": api_key.status,
            "last_used_at": api_key.last_used_at,
            "expires_at": api_key.expires_at,
            "created_at": api_key.created_at,
            "updated_at": api_key.updated_at,
        }
        result.append(key_dict)

    print(f"WEB DEBUG: Returning {len(result)} API keys")
    for key in result:
        print(f"WEB DEBUG: Key {key['name']} - api_key: {key['api_key']}")

    return result

@router.delete("/web/auth/api-keys/{api_key_id}")
async def delete_api_key_web(
    api_key_id: str,
    request: Request,
    db: Session = Depends(get_db)
):
    """Delete an API key (web UI version)"""

    user = request.state.current_user
    api_key = db.query(ClientApiKey).filter(
        ClientApiKey.id == api_key_id,
        ClientApiKey.user_id == user["user_id"]
    ).first()

    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")

    api_key.status = ClientApiKeyStatus.REVOKED
    db.commit()

    return {"message": "API key revoked successfully"}

@router.get("/web/usage/limits")
async def get_usage_limits_web(
    request: Request,
    db: Session = Depends(get_db)
):
    """Get usage limits for the current user (web UI version)"""

    user = request.state.current_user
    # Get user's API keys to determine their limits
    user_api_keys = db.query(ClientApiKey).filter(
        ClientApiKey.user_id == user["user_id"]
    ).all()

    if not user_api_keys:
        return {
            "minute": 100,
            "hour": 1000,
            "day": 10000
        }

    # Return the most permissive limits among user's API keys
    return {
        "minute": max(key.rate_limit_per_minute for key in user_api_keys),
        "hour": max(key.rate_limit_per_hour for key in user_api_keys),
        "day": max(key.rate_limit_per_day for key in user_api_keys)
    }

# Authentication Endpoints

@router.post("/auth/api-keys", response_model=ClientApiKeyCreateResponse)
async def create_api_key(
    api_key_data: ClientApiKeyCreate,
    request: Request,
    db: Session = Depends(get_db)
):
    """Create a new API key for the current user"""

    user = request.state.current_user
    # Generate API key and secret key
    api_key, secret_key = generate_api_key_pair()

    # Create API key record
    encrypted_secret = encrypt_secret_key(secret_key)
    encrypted_api_key = encrypt_secret_key(api_key)

    db_api_key = ClientApiKey(
        id=str(uuid.uuid4()),
        user_id=user["user_id"],
        tenant_id=user["tenant"],
        name=api_key_data.name,
        description=api_key_data.description,
        api_key_prefix=extract_api_key_prefix(api_key),
        api_key_hash=hash_api_key(api_key),
        api_key_encrypted=encrypted_api_key,
        secret_key_hash=hash_secret_key(secret_key),
        secret_key_encrypted=encrypted_secret,
        rate_limit_per_minute=api_key_data.rate_limit_per_minute,
        rate_limit_per_hour=api_key_data.rate_limit_per_hour,
        rate_limit_per_day=api_key_data.rate_limit_per_day,
        allowed_projects=api_key_data.allowed_projects,
        allowed_scopes=api_key_data.allowed_scopes,
        expires_at=api_key_data.expires_at,
        status=ClientApiKeyStatus.ACTIVE
    )

    db.add(db_api_key)
    db.commit()
    db.refresh(db_api_key)

    return ClientApiKeyCreateResponse(
        api_key=api_key,
        secret_key=secret_key,
        api_key_data=db_api_key
    )

@router.get("/auth/api-keys", response_model=List[ClientApiKeyResponse])
async def list_api_keys(
    request: Request,
    db: Session = Depends(get_db)
):
    """List all API keys for the current user"""

    user = request.state.current_user
    api_keys = db.query(ClientApiKey).filter(
        ClientApiKey.user_id == user["user_id"]
    ).all()

    # Decrypt keys for display
    for api_key in api_keys:
        # Decrypt secret key
        if api_key.secret_key_encrypted:
            api_key.secret_key = decrypt_secret_key(api_key.secret_key_encrypted)

        # Decrypt API key - simplified approach
        if api_key.api_key_encrypted:
            api_key.api_key = decrypt_secret_key(api_key.api_key_encrypted)
            print(f"IMMEDIATE DEBUG: Set {api_key.id} api_key to: {api_key.api_key}")

    # Convert to explicit dictionaries to avoid Pydantic filtering
    result = []
    for api_key in api_keys:
        key_dict = {
            "id": api_key.id,
            "user_id": api_key.user_id,
            "tenant_id": api_key.tenant_id,
            "name": api_key.name,
            "description": api_key.description,
            "api_key_prefix": api_key.api_key_prefix,
            "api_key": api_key.api_key if hasattr(api_key, 'api_key') else None,  # Check if field exists
            "secret_key": api_key.secret_key,  # This should be the decrypted value
            "rate_limit_per_minute": api_key.rate_limit_per_minute,
            "rate_limit_per_hour": api_key.rate_limit_per_hour,
            "rate_limit_per_day": api_key.rate_limit_per_day,
            "allowed_projects": api_key.allowed_projects,
            "allowed_scopes": api_key.allowed_scopes,
            "status": api_key.status,
            "last_used_at": api_key.last_used_at,
            "expires_at": api_key.expires_at,
            "created_at": api_key.created_at,
            "updated_at": api_key.updated_at,
        }
        result.append(key_dict)

    print(f"DEBUG: Returning {len(result)} API keys")
    for key in result:
        print(f"DEBUG: Key {key['name']} - api_key: {key['api_key']}")

    return result

@router.delete("/auth/api-keys/{api_key_id}")
async def revoke_api_key(
    api_key_id: str,
    request: Request,
    db: Session = Depends(get_db)
):
    """Revoke an API key"""

    user = request.state.current_user
    api_key = db.query(ClientApiKey).filter(
        and_(
            ClientApiKey.id == api_key_id,
            ClientApiKey.user_id == user["user_id"]
        )
    ).first()

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found"
        )

    api_key.status = ClientApiKeyStatus.REVOKED
    api_key.updated_at = datetime.utcnow()
    db.commit()

    return {"message": "API key revoked successfully"}

@router.post("/auth/validate", response_model=APIKeyValidationResponse)
async def validate_api_key_endpoint(
    validation_data: APIKeyValidationRequest,
    db: Session = Depends(get_db)
):
    """Validate an API key (for testing purposes)"""
    from app.client_auth import verify_hmac_signature, hash_api_key
    from app.models import ClientApiKey, ClientApiKeyStatus

    # Get API key from database
    api_key_hash = hash_api_key(validation_data.api_key)
    api_key_record = db.query(ClientApiKey).filter(
        ClientApiKey.api_key_hash == api_key_hash
    ).first()

    if not api_key_record:
        return APIKeyValidationResponse(
            valid=False,
            error="Invalid API key"
        )

    # Check status
    if api_key_record.status != ClientApiKeyStatus.ACTIVE:
        return APIKeyValidationResponse(
            valid=False,
            error=f"API key is {api_key_record.status.value}"
        )

    # Verify signature
    is_valid = verify_hmac_signature(
        validation_data.api_key,
        api_key_record.secret_key_hash,
        validation_data.timestamp,
        validation_data.method,
        validation_data.endpoint,
        validation_data.signature
    )

    if not is_valid:
        return APIKeyValidationResponse(
            valid=False,
            error="Invalid signature"
        )

    return APIKeyValidationResponse(
        valid=True,
        api_key_id=api_key_record.id,
        user_id=api_key_record.user_id,
        tenant_id=api_key_record.tenant_id,
        scopes=api_key_record.allowed_scopes,
        allowed_projects=api_key_record.allowed_projects,
        rate_limits={
            "minute": api_key_record.rate_limit_per_minute,
            "hour": api_key_record.rate_limit_per_hour,
            "day": api_key_record.rate_limit_per_day
        }
    )

# Prompt Retrieval Endpoints

@router.get("/prompts/{prompt_id}")
async def get_prompt(
    prompt_id: str,
    project_id: Optional[str] = None,
    db: Session = Depends(get_db),
    user: dict = Depends(require_scope("read")),
    project_user: dict = Depends(optional_project_access)
):
    """Get the latest version of a prompt"""

    # Validate prompt ID format
    if not validate_prompt_id(prompt_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid prompt ID format"
        )

    # Validate project ID if provided
    if project_id and not validate_project_id(project_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid project ID format"
        )

    if project_id:
        user = await require_project_access(project_id)(user)

    # Get latest version of the prompt
    prompt = db.query(Prompt).filter(
        Prompt.id == prompt_id
    ).order_by(Prompt.version.desc()).first()

    if not prompt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prompt not found"
        )

    # Check project access if specified
    if project_id:
        module = db.query(Module).filter(Module.id == prompt.module_id).first()
        if not module or module.project_id != project_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No access to this prompt"
            )

    return {
        "id": prompt.id,
        "version": prompt.version,
        "name": prompt.name,
        "description": prompt.description,
        "content": prompt.content,
        "target_models": prompt.target_models,
        "model_specific_prompts": prompt.model_specific_prompts,
        "module_id": prompt.module_id,
        "created_by": prompt.created_by,
        "created_at": prompt.created_at,
        "updated_at": prompt.updated_at,
        "mas_intent": prompt.mas_intent,
        "mas_fairness_notes": prompt.mas_fairness_notes,
        "mas_testing_notes": prompt.mas_testing_notes,
        "mas_risk_level": prompt.mas_risk_level
    }

@router.get("/prompts/{prompt_id}/versions")
async def get_prompt_versions(
    prompt_id: str,
    project_id: Optional[str] = None,
    db: Session = Depends(get_db),
    user: dict = Depends(require_scope("read")),
    project_user: dict = Depends(optional_project_access)
):
    """List all versions of a prompt"""

    prompts = db.query(Prompt).filter(Prompt.id == prompt_id).all()

    if not prompts:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prompt not found"
        )

    # Check project access if specified
    if project_id:
        for prompt in prompts:
            module = db.query(Module).filter(Module.id == prompt.module_id).first()
            if not module or module.project_id != project_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="No access to this prompt"
                )

    return [
        {
            "id": prompt.id,
            "version": prompt.version,
            "name": prompt.name,
            "description": prompt.description,
            "content": prompt.content,
            "target_models": prompt.target_models,
            "model_specific_prompts": prompt.model_specific_prompts,
            "module_id": prompt.module_id,
            "created_by": prompt.created_by,
            "created_at": prompt.created_at,
            "updated_at": prompt.updated_at
        }
        for prompt in prompts
    ]

@router.get("/prompts/{prompt_id}/versions/{version}")
async def get_prompt_version(
    prompt_id: str,
    version: str,
    project_id: Optional[str] = None,
    db: Session = Depends(get_db),
    user: dict = Depends(require_scope("read")),
    project_user: dict = Depends(optional_project_access)
):
    """Get a specific version of a prompt"""

    prompt = db.query(Prompt).filter(
        and_(
            Prompt.id == prompt_id,
            Prompt.version == version
        )
    ).first()

    if not prompt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prompt version not found"
        )

    # Check project access if specified
    if project_id:
        module = db.query(Module).filter(Module.id == prompt.module_id).first()
        if not module or module.project_id != project_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No access to this prompt"
            )

    return {
        "id": prompt.id,
        "version": prompt.version,
        "name": prompt.name,
        "description": prompt.description,
        "content": prompt.content,
        "target_models": prompt.target_models,
        "model_specific_prompts": prompt.model_specific_prompts,
        "module_id": prompt.module_id,
        "created_by": prompt.created_by,
        "created_at": prompt.created_at,
        "updated_at": prompt.updated_at
    }

@router.get("/prompts", response_model=PromptSearchResponse)
async def search_prompts(
    query: Optional[str] = None,
    project_id: Optional[str] = None,
    module_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    db: Session = Depends(get_db),
    user: dict = Depends(require_scope("read")),
    project_user: dict = Depends(optional_project_access)
):
    """Search and list prompts"""

    # Build query
    db_query = db.query(Prompt)

    # Apply filters
    if project_id:
        db_query = db_query.join(Module).filter(Module.project_id == project_id)

    if module_id:
        db_query = db_query.filter(Prompt.module_id == module_id)

    if query:
        db_query = db_query.filter(
            or_(
                Prompt.name.ilike(f"%{query}%"),
                Prompt.description.ilike(f"%{query}%"),
                Prompt.content.ilike(f"%{query}%")
            )
        )

    # Get total count
    total = db_query.count()

    # Apply sorting
    if sort_by == "created_at":
        db_query = db_query.order_by(
            Prompt.created_at.desc() if sort_order == "desc" else Prompt.created_at.asc()
        )
    elif sort_by == "updated_at":
        db_query = db_query.order_by(
            Prompt.updated_at.desc() if sort_order == "desc" else Prompt.updated_at.asc()
        )
    elif sort_by == "name":
        db_query = db_query.order_by(
            Prompt.name.desc() if sort_order == "desc" else Prompt.name.asc()
        )

    # Apply pagination
    prompts = db_query.offset(offset).limit(limit).all()

    return PromptSearchResponse(
        prompts=[
            {
                "id": prompt.id,
                "version": prompt.version,
                "name": prompt.name,
                "description": prompt.description,
                "module_id": prompt.module_id,
                "created_by": prompt.created_by,
                "created_at": prompt.created_at,
                "updated_at": prompt.updated_at
            }
            for prompt in prompts
        ],
        total=total,
        limit=limit,
        offset=offset,
        has_more=offset + limit < total
    )

@router.get("/prompts/{prompt_id}/model/{provider}/{name}")
async def get_model_specific_prompt(
    prompt_id: str,
    provider: str,
    name: str,
    project_id: Optional[str] = None,
    db: Session = Depends(get_db),
    user: dict = Depends(require_scope("read")),
    project_user: dict = Depends(optional_project_access)
):
    """Get model-specific version of a prompt"""

    # Get latest version of the prompt
    prompt = db.query(Prompt).filter(
        Prompt.id == prompt_id
    ).order_by(Prompt.version.desc()).first()

    if not prompt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prompt not found"
        )

    # Check project access if specified
    if project_id:
        module = db.query(Module).filter(Module.id == prompt.module_id).first()
        if not module or module.project_id != project_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No access to this prompt"
            )

    # Find model-specific prompt
    model_prompt = None
    for mp in prompt.model_specific_prompts:
        if mp.get("model_provider") == provider and mp.get("model_name") == name:
            model_prompt = mp
            break

    if not model_prompt:
        # Return generic prompt content if no model-specific version
        return {
            "id": prompt.id,
            "version": prompt.version,
            "name": prompt.name,
            "description": prompt.description,
            "content": prompt.content,
            "is_model_specific": False,
            "provider": provider,
            "model": name
        }

    return {
        "id": prompt.id,
        "version": prompt.version,
        "name": prompt.name,
        "description": model_prompt.get("instructions", prompt.description),
        "content": model_prompt["content"],
        "is_model_specific": True,
        "provider": provider,
        "model": name,
        "expected_output_format": model_prompt.get("expected_output_format"),
        "instructions": model_prompt.get("instructions")
    }

@router.post("/prompts/batch", response_model=BatchPromptResponse)
async def batch_get_prompts(
    batch_request: BatchPromptRequest,
    db: Session = Depends(get_db),
    user: dict = Depends(require_scope("read"))
):
    """Get multiple prompts in a single request"""

    if batch_request.project_id:
        user = await require_project_access(batch_request.project_id)(user)

    prompts = {}
    errors = []

    for prompt_id in batch_request.prompt_ids:
        try:
            # Get latest version of the prompt
            prompt = db.query(Prompt).filter(
                Prompt.id == prompt_id
            ).order_by(Prompt.version.desc()).first()

            if not prompt:
                errors.append({"prompt_id": prompt_id, "error": "Prompt not found"})
                continue

            # Check project access if specified
            if batch_request.project_id:
                module = db.query(Module).filter(Module.id == prompt.module_id).first()
                if not module or module.project_id != batch_request.project_id:
                    errors.append({"prompt_id": prompt_id, "error": "No access to this prompt"})
                    continue

            # Build response based on requested includes
            prompt_data = {
                "id": prompt.id,
                "version": prompt.version,
                "name": prompt.name,
                "content": prompt.content
            }

            if batch_request.include_versions:
                all_versions = db.query(Prompt).filter(Prompt.id == prompt_id).all()
                prompt_data["versions"] = [
                    {"version": p.version, "created_at": p.created_at}
                    for p in all_versions
                ]

            if batch_request.include_metadata:
                prompt_data.update({
                    "description": prompt.description,
                    "module_id": prompt.module_id,
                    "created_by": prompt.created_by,
                    "created_at": prompt.created_at,
                    "updated_at": prompt.updated_at,
                    "target_models": prompt.target_models,
                    "mas_intent": prompt.mas_intent,
                    "mas_risk_level": prompt.mas_risk_level
                })

            prompts[prompt_id] = prompt_data

        except Exception as e:
            errors.append({"prompt_id": prompt_id, "error": str(e)})

    return BatchPromptResponse(
        prompts=prompts,
        errors=errors,
        total_requested=len(batch_request.prompt_ids),
        total_found=len(prompts)
    )

# Usage Analytics Endpoints

@router.post("/usage/log")
async def log_usage_endpoint(
    usage_data: UsageLogCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(require_scope("write"))
):
    """Log usage data"""

    usage_log = ClientUsageLog(
        id=str(uuid.uuid4()),
        api_key_id=user["api_key_id"],
        user_id=user["user_id"],
        tenant_id=user["tenant_id"],
        endpoint=usage_data.endpoint,
        method=usage_data.method,
        prompt_id=usage_data.prompt_id,
        project_id=usage_data.project_id,
        tokens_requested=usage_data.tokens_requested,
        tokens_used=usage_data.tokens_used,
        response_size=usage_data.response_size,
        processing_time_ms=usage_data.processing_time_ms,
        estimated_cost_usd=usage_data.estimated_cost_usd,
        status_code=usage_data.status_code,
        error_message=usage_data.error_message,
        user_agent=usage_data.user_agent,
        ip_address=usage_data.ip_address,
        request_id=usage_data.request_id
    )

    db.add(usage_log)
    db.commit()

    return {"message": "Usage logged successfully"}

@router.get("/usage/stats", response_model=UsageStatsResponse)
async def get_usage_stats(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    prompt_id: Optional[str] = None,
    project_id: Optional[str] = None,
    db: Session = Depends(get_db),
    user: dict = Depends(require_scope("read"))
):
    """Get usage statistics"""

    if project_id:
        user = await require_project_access(project_id)(user)

    # Set default date range (last 30 days)
    if not end_date:
        end_date = datetime.utcnow()
    if not start_date:
        start_date = end_date - timedelta(days=30)

    # Build query
    query = db.query(ClientUsageLog).filter(
        and_(
            ClientUsageLog.user_id == user["user_id"],
            ClientUsageLog.timestamp >= start_date,
            ClientUsageLog.timestamp <= end_date
        )
    )

    if prompt_id:
        query = query.filter(ClientUsageLog.prompt_id == prompt_id)

    if project_id:
        query = query.filter(ClientUsageLog.project_id == project_id)

    usage_logs = query.all()

    # Calculate statistics
    total_requests = len(usage_logs)
    total_tokens_requested = sum(log.tokens_requested or 0 for log in usage_logs)
    total_tokens_used = sum(log.tokens_used or 0 for log in usage_logs)

    # Calculate total cost (assuming estimated_cost_usd is stored as string)
    total_cost = sum(float(log.estimated_cost_usd or 0) for log in usage_logs)

    # Calculate average response time
    total_processing_time = sum(log.processing_time_ms or 0 for log in usage_logs)
    avg_response_time = total_processing_time / total_requests if total_requests > 0 else 0

    # Calculate success rate
    successful_requests = sum(1 for log in usage_logs if log.status_code < 400)
    success_rate = successful_requests / total_requests if total_requests > 0 else 0

    # Group by endpoint
    endpoint_counts = {}
    for log in usage_logs:
        endpoint = log.endpoint
        endpoint_counts[endpoint] = endpoint_counts.get(endpoint, 0) + 1

    # Group by hour (for charts)
    hourly_counts = {}
    for log in usage_logs:
        hour = log.timestamp.strftime("%Y-%m-%d %H:00")
        hourly_counts[hour] = hourly_counts.get(hour, 0) + 1

    hourly_data = [
        {"hour": hour, "count": count}
        for hour, count in sorted(hourly_counts.items())
    ]

    # Top prompts
    prompt_counts = {}
    for log in usage_logs:
        if log.prompt_id:
            prompt_counts[log.prompt_id] = prompt_counts.get(log.prompt_id, 0) + 1

    top_prompts = [
        {"prompt_id": pid, "count": count}
        for pid, count in sorted(prompt_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    ]

    return UsageStatsResponse(
        total_requests=total_requests,
        total_tokens_requested=total_tokens_requested,
        total_tokens_used=total_tokens_used,
        total_cost_usd=f"{total_cost:.6f}",
        average_response_time_ms=avg_response_time,
        success_rate=success_rate,
        requests_by_endpoint=endpoint_counts,
        requests_by_hour=hourly_data,
        top_prompts=top_prompts,
        period_start=start_date,
        period_end=end_date
    )

@router.get("/usage/limits", response_model=UsageLimitsResponse)
async def get_usage_limits(
    db: Session = Depends(get_db),
    user: dict = Depends(require_scope("read"))
):
    """Get current usage and rate limits"""

    # Get API key details
    api_key = db.query(ClientApiKey).filter(
        ClientApiKey.id == user["api_key_id"]
    ).first()

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found"
        )

    # Get current usage from Redis
    from app.client_auth import get_rate_limit_window
    import redis
    from app.config import settings

    redis_client = redis.from_url(settings.redis_url)

    current_time = datetime.utcnow()

    usage_data = {}
    for window_type in ["minute", "hour", "day"]:
        window_start = get_rate_limit_window(window_type)
        redis_key = f"rate_limit:{user['api_key_id']}:{window_type}:{window_start.isoformat()}"
        current_count = int(redis_client.get(redis_key) or 0)
        usage_data[window_type] = current_count

    # Calculate reset times
    now = datetime.utcnow()
    minute_reset = (now + timedelta(minutes=1)).replace(second=0, microsecond=0)
    hour_reset = (now + timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)
    day_reset = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)

    return UsageLimitsResponse(
        current_usage_minute=usage_data["minute"],
        current_usage_hour=usage_data["hour"],
        current_usage_day=usage_data["day"],
        limits_minute=api_key.rate_limit_per_minute,
        limits_hour=api_key.rate_limit_per_hour,
        limits_day=api_key.rate_limit_per_day,
        remaining_minute=max(0, api_key.rate_limit_per_minute - usage_data["minute"]),
        remaining_hour=max(0, api_key.rate_limit_per_hour - usage_data["hour"]),
        remaining_day=max(0, api_key.rate_limit_per_day - usage_data["day"]),
        reset_time_minute=minute_reset,
        reset_time_hour=hour_reset,
        reset_time_day=day_reset
    )