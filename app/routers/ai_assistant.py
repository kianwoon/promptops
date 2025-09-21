from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import uuid
import structlog
from datetime import datetime

from app.database import get_db, Base
from app.models import (
    AIAssistantProvider, AIAssistantSystemPrompt, AIAssistantConversation,
    AIAssistantMessage, User, AIAssistantProviderStatus, AIAssistantSystemPromptType,
    UserRole, AuthProvider
)
from app.schemas import (
    AIAssistantProviderCreate, AIAssistantProviderUpdate, AIAssistantProviderResponse,
    AIAssistantSystemPromptCreate, AIAssistantSystemPromptUpdate, AIAssistantSystemPromptResponse,
    AIAssistantMessage as AIAssistantMessageSchema,
    AIAssistantConversationCreate, AIAssistantConversationResponse,
    AIAssistantChatRequest, AIAssistantChatResponse,
    AIAssistantPromptGenerationRequest, AIAssistantPromptGenerationResponse,
    AIAssistantProviderTestRequest, AIAssistantProviderTestResponse
)
from app.services.ai_assistant_service import ai_assistant_service, AIAssistantProviderType
from app.services.auth_service import AuthService

logger = structlog.get_logger()

router = APIRouter(prefix="/ai-assistant", tags=["ai-assistant"])

security = HTTPBearer()

# Provider Endpoints

@router.post("/providers", response_model=AIAssistantProviderResponse)
async def create_provider(
    provider: AIAssistantProviderCreate,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """Create a new AI assistant provider"""
    try:
        # For development, use a mock user
        current_user = User(
            id="demo-user",
            email="demo@example.com",
            name="Demo User",
            role=UserRole.ADMIN,
            organization="Demo Org",
            provider=AuthProvider.LOCAL,
            provider_id="",
            is_verified=True,
            created_at=datetime.now()
        )

        # In production, uncomment the following:
        # auth_service = AuthService()
        # current_user = await auth_service.get_current_user(credentials.credentials, db)

        # Check if user already has a provider of this type
        try:
            existing_provider = db.query(AIAssistantProvider).filter(
                AIAssistantProvider.user_id == current_user.id,
                AIAssistantProvider.provider_type == provider.provider_type.value,
                AIAssistantProvider.status == AIAssistantProviderStatus.active.value
            ).first()
        except Exception as e:
            logger.error(f"Database error: {str(e)}")
            # If table doesn't exist, create it and proceed
            try:
                from app.database import engine
                Base.metadata.create_all(bind=engine)
                existing_provider = db.query(AIAssistantProvider).filter(
                    AIAssistantProvider.user_id == current_user.id,
                    AIAssistantProvider.provider_type == provider.provider_type.value,
                    AIAssistantProvider.status == AIAssistantProviderStatus.active.value
                ).first()
            except Exception:
                # If still fails, assume no existing provider
                existing_provider = None

        if existing_provider:
            raise HTTPException(
                status_code=400,
                detail="User already has an active provider of this type"
            )

        # Create provider record
        provider_id = str(uuid.uuid4())
        db_provider = AIAssistantProvider(
            id=provider_id,
            user_id=current_user.id,
            provider_type=provider.provider_type.value,
            name=provider.name,
            status=AIAssistantProviderStatus.active.value,
            api_key=provider.api_key or "",
            api_base_url=provider.api_base_url or "",
            model_name=provider.model_name or "",
            organization=provider.organization or "",
            project=provider.project or "",
            config_json=provider.config_json or {}
        )

        db.add(db_provider)
        try:
            db.commit()
            db.refresh(db_provider)
            logger.info("Provider successfully committed to database", provider_id=provider_id)
        except Exception as e:
            db.rollback()
            logger.error(f"Database commit failed: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

        # Skip service creation for now to isolate database issues
        # provider_config = {
        #     "provider_type": provider.provider_type,
        #     "api_key": provider.api_key,
        #     "api_base_url": provider.api_base_url,
        #     "model_name": provider.model_name
        # }
        # service_provider = ai_assistant_service.create_provider_from_config(provider_config)
        # ai_assistant_service.register_provider(provider_id, service_provider)

        logger.info("Provider created", provider_id=provider_id, user_id=current_user.id)

        try:
            # Handle enum conversions - database already has enum objects
            provider_type = db_provider.provider_type
            status = db_provider.status

            # If they're strings, convert to enums
            if isinstance(provider_type, str):
                provider_type = AIAssistantProviderType(provider_type)
            if isinstance(status, str):
                status = AIAssistantProviderStatus(status)

            return AIAssistantProviderResponse(
                id=provider_id,
                user_id=current_user.id,
                provider_type=provider_type,
                name=provider.name,
                status=status,
                api_key_prefix=provider.api_key[:4] + "..." if provider.api_key else None,
                api_base_url=provider.api_base_url,
                model_name=provider.model_name,
                organization=provider.organization,
                project=provider.project,
                config_json=provider.config_json,
                created_at=db_provider.created_at,
                updated_at=db_provider.updated_at,
                last_used_at=db_provider.last_used_at,
                is_default=getattr(db_provider, "is_default", False)
            )
        except Exception as e:
            logger.error(f"Error processing created provider {provider_id}: {e}")
            raise HTTPException(status_code=500, detail="Error processing provider data")

    except Exception as e:
        logger.error(f"Failed to create provider: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/providers", response_model=List[AIAssistantProviderResponse])
async def get_providers(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """Get all AI assistant providers for the current user"""
    # For development, use a mock user
    current_user = User(
        id="demo-user",
        email="demo@example.com",
        name="Demo User",
        role=UserRole.ADMIN,
        organization="Demo Org",
        provider=AuthProvider.LOCAL,
        provider_id="",
        is_verified=True,
        created_at=datetime.now()
    )

    # In production, uncomment the following:
    # auth_service = AuthService()
    # current_user = await auth_service.get_current_user(credentials.credentials, db)

    try:
        # Query providers for the current user
        providers = db.query(AIAssistantProvider).filter(
            AIAssistantProvider.user_id == current_user.id
        ).all()

        logger.info(f"Found {len(providers)} providers for user {current_user.id}")

        result = []
        for p in providers:
            try:
                # Handle enum conversions - database already has enum objects
                provider_type = p.provider_type
                status = p.status

                # If they're strings, convert to enums
                if isinstance(provider_type, str):
                    provider_type = AIAssistantProviderType(provider_type)
                if isinstance(status, str):
                    status = AIAssistantProviderStatus(status)

                result.append(AIAssistantProviderResponse(
                    id=p.id,
                    user_id=p.user_id,
                    provider_type=provider_type,
                    name=p.name,
                    status=status,
                    api_key_prefix=p.api_key[:4] + "..." if p.api_key else None,
                    api_base_url=p.api_base_url,
                    model_name=p.model_name,
                    organization=p.organization,
                    project=p.project,
                    config_json=p.config_json,
                    created_at=p.created_at,
                    updated_at=p.updated_at,
                    last_used_at=p.last_used_at,
                    is_default=getattr(p, "is_default", False)
                ))
            except Exception as e:
                logger.error(f"Error processing provider {p.id}: {e}")
                continue

        return result

    except Exception as e:
        logger.error(f"Database query error: {str(e)}")
        # If table doesn't exist, create it and return empty list
        try:
            from app.database import engine
            Base.metadata.create_all(bind=engine)
            return []
        except Exception as create_error:
            logger.error(f"Failed to create table: {str(create_error)}")
            return []

@router.get("/providers/{provider_id}", response_model=AIAssistantProviderResponse)
async def get_provider(
    provider_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """Get a specific AI assistant provider"""
    # For development, use a mock user
    current_user = User(
        id="demo-user",
        email="demo@example.com",
        name="Demo User",
        role=UserRole.ADMIN,
        organization="Demo Org",
        provider=AuthProvider.LOCAL,
        provider_id="",
        is_verified=True,
        created_at=datetime.now()
    )

    # In production, uncomment the following:
    # auth_service = AuthService()
    # current_user = await auth_service.get_current_user(credentials.credentials, db)

    provider = db.query(AIAssistantProvider).filter(
        AIAssistantProvider.id == provider_id,
        AIAssistantProvider.user_id == current_user.id
    ).first()

    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    try:
        # Handle enum conversions - database already has enum objects
        provider_type = provider.provider_type
        status = provider.status

        # If they're strings, convert to enums
        if isinstance(provider_type, str):
            provider_type = AIAssistantProviderType(provider_type)
        if isinstance(status, str):
            status = AIAssistantProviderStatus(status)

        return AIAssistantProviderResponse(
            id=provider.id,
            user_id=provider.user_id,
            provider_type=provider_type,
            name=provider.name,
            status=status,
            api_key_prefix=provider.api_key[:4] + "..." if provider.api_key else None,
            api_base_url=provider.api_base_url,
            model_name=provider.model_name,
            organization=provider.organization,
            project=provider.project,
            config_json=provider.config_json,
            created_at=provider.created_at,
            updated_at=provider.updated_at,
            last_used_at=provider.last_used_at,
            is_default=getattr(provider, "is_default", False)
        )
    except Exception as e:
        logger.error(f"Error processing provider {provider_id}: {e}")
        raise HTTPException(status_code=500, detail="Error processing provider data")

@router.put("/providers/{provider_id}", response_model=AIAssistantProviderResponse)
async def update_provider(
    provider_id: str,
    provider_update: AIAssistantProviderUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """Update an AI assistant provider"""
    auth_service = AuthService()
    # For development, use a mock user
    current_user = User(
        id="demo-user",
        email="demo@example.com",
        name="Demo User",
        role=UserRole.ADMIN,
        organization="Demo Org",
        provider=AuthProvider.LOCAL,
        provider_id="",
        is_verified=True,
        created_at=datetime.now()
    )

    # In production, uncomment the following:
    # auth_service = AuthService()
    # current_user = await auth_service.get_current_user(credentials.credentials, db)

    provider = db.query(AIAssistantProvider).filter(
        AIAssistantProvider.id == provider_id,
        AIAssistantProvider.user_id == current_user.id
    ).first()

    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    # Update provider fields
    update_data = provider_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(provider, field, value)

    provider.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(provider)

    # Update service provider if config changed
    if "api_key" in update_data or "api_base_url" in update_data or "model_name" in update_data:
        try:
            provider_config = {
                "provider_type": provider.provider_type,
                "api_key": provider.api_key,
                "api_base_url": provider.api_base_url,
                "model_name": provider.model_name
            }
            service_provider = ai_assistant_service.create_provider_from_config(provider_config)
            ai_assistant_service.register_provider(provider_id, service_provider)
        except Exception as e:
            logger.error(f"Failed to update service provider: {str(e)}")
            # Don't fail the request, just log the error

    logger.info("Provider updated", provider_id=provider_id, user_id=current_user.id)

    return AIAssistantProviderResponse(
        id=provider.id,
        user_id=provider.user_id,
        provider_type=getattr(AIAssistantProviderType, provider.provider_type),  # Get the attribute value from the class
        name=provider.name,
        status=AIAssistantProviderStatus(provider.status),  # Convert string back to enum
        api_key_prefix=provider.api_key[:4] + "..." if provider.api_key else None,
        api_base_url=provider.api_base_url,
        model_name=provider.model_name,
        organization=provider.organization,
        project=provider.project,
        config_json=provider.config_json,
        created_at=provider.created_at,
        updated_at=provider.updated_at,
        last_used_at=provider.last_used_at,
        is_default=getattr(provider, "is_default", False)
    )

@router.delete("/providers/{provider_id}")
async def delete_provider(
    provider_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """Delete an AI assistant provider"""
    auth_service = AuthService()
    # For development, use a mock user
    current_user = User(
        id="demo-user",
        email="demo@example.com",
        name="Demo User",
        role=UserRole.ADMIN,
        organization="Demo Org",
        provider=AuthProvider.LOCAL,
        provider_id="",
        is_verified=True,
        created_at=datetime.now()
    )

    # In production, uncomment the following:
    # auth_service = AuthService()
    # current_user = await auth_service.get_current_user(credentials.credentials, db)

    provider = db.query(AIAssistantProvider).filter(
        AIAssistantProvider.id == provider_id,
        AIAssistantProvider.user_id == current_user.id
    ).first()

    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    # Remove from service
    ai_assistant_service.providers.pop(provider_id, None)

    # Delete from database
    db.delete(provider)
    db.commit()

    logger.info("Provider deleted", provider_id=provider_id, user_id=current_user.id)

    return {"message": "Provider deleted successfully"}

@router.post("/providers/{provider_id}/test", response_model=AIAssistantProviderTestResponse)
async def test_provider(
    provider_id: str,
    test_request: AIAssistantProviderTestRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """Test an AI assistant provider connection"""
    auth_service = AuthService()
    # For development, use a mock user
    current_user = User(
        id="demo-user",
        email="demo@example.com",
        name="Demo User",
        role=UserRole.ADMIN,
        organization="Demo Org",
        provider=AuthProvider.LOCAL,
        provider_id="",
        is_verified=True,
        created_at=datetime.now()
    )

    # In production, uncomment the following:
    # auth_service = AuthService()
    # current_user = await auth_service.get_current_user(credentials.credentials, db)

    provider = db.query(AIAssistantProvider).filter(
        AIAssistantProvider.id == provider_id,
        AIAssistantProvider.user_id == current_user.id
    ).first()

    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    # Update last used time
    provider.last_used_at = datetime.utcnow()
    db.commit()

    # Test connection using service
    result = await ai_assistant_service.test_provider(provider_id)

    logger.info("Provider tested", provider_id=provider_id, success=result.get("success", False))

    return AIAssistantProviderTestResponse(
        success=result.get("success", False),
        response=result.get("message"),
        error_message=result.get("error"),
        response_time_ms=result.get("response_time_ms"),
        tokens_used=result.get("tokens_used"),
        model_used=result.get("model_used"),
        created_at=datetime.utcnow()
    )

# System Prompt Endpoints

@router.post("/system-prompts", response_model=AIAssistantSystemPromptResponse)
async def create_system_prompt(
    prompt: AIAssistantSystemPromptCreate,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """Create a new system prompt"""
    auth_service = AuthService()
    # For development, use a mock user
    current_user = User(
        id="demo-user",
        email="demo@example.com",
        name="Demo User",
        role=UserRole.ADMIN,
        organization="Demo Org",
        provider=AuthProvider.LOCAL,
        provider_id="",
        is_verified=True,
        created_at=datetime.now()
    )

    # In production, uncomment the following:
    # auth_service = AuthService()
    # current_user = await auth_service.get_current_user(credentials.credentials, db)

    # Verify provider exists and belongs to user
    provider = db.query(AIAssistantProvider).filter(
        AIAssistantProvider.id == prompt.provider_id,
        AIAssistantProvider.user_id == current_user.id
    ).first()

    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    # Check if active prompt already exists for this provider and type
    existing_prompt = db.query(AIAssistantSystemPrompt).filter(
        AIAssistantSystemPrompt.provider_id == prompt.provider_id,
        AIAssistantSystemPrompt.prompt_type == prompt.prompt_type,
        AIAssistantSystemPrompt.is_active == True
    ).first()

    if existing_prompt:
        # Deactivate existing prompt
        existing_prompt.is_active = False
        db.commit()

    # Create new prompt
    prompt_id = str(uuid.uuid4())
    db_prompt = AIAssistantSystemPrompt(
        id=prompt_id,
        provider_id=prompt.provider_id,
        prompt_type=prompt.prompt_type,
        name=prompt.name,
        content=prompt.content,
        description=prompt.description,
        is_mas_feat_compliant=prompt.is_mas_feat_compliant,
        is_active=prompt.is_active,
        created_by=current_user.id
    )

    db.add(db_prompt)
    db.commit()
    db.refresh(db_prompt)

    logger.info("System prompt created", prompt_id=prompt_id, user_id=current_user.id)

    return AIAssistantSystemPromptResponse(
        id=prompt_id,
        provider_id=prompt.provider_id,
        prompt_type=prompt.prompt_type,
        name=prompt.name,
        content=prompt.content,
        description=prompt.description,
        is_mas_feat_compliant=prompt.is_mas_feat_compliant,
        is_active=prompt.is_active,
        created_at=db_prompt.created_at,
        updated_at=db_prompt.updated_at,
        created_by=current_user.id
    )

@router.get("/system-prompts", response_model=List[AIAssistantSystemPromptResponse])
async def get_system_prompts(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """Get all system prompts for the current user"""
    auth_service = AuthService()
    # For development, use a mock user
    current_user = User(
        id="demo-user",
        email="demo@example.com",
        name="Demo User",
        role=UserRole.ADMIN,
        organization="Demo Org",
        provider=AuthProvider.LOCAL,
        provider_id="",
        is_verified=True,
        created_at=datetime.now()
    )

    # In production, uncomment the following:
    # auth_service = AuthService()
    # current_user = await auth_service.get_current_user(credentials.credentials, db)

    prompts = db.query(AIAssistantSystemPrompt).join(
        AIAssistantProvider
    ).filter(
        AIAssistantProvider.user_id == current_user.id
    ).all()

    return [
        AIAssistantSystemPromptResponse(
            id=p.id,
            provider_id=p.provider_id,
            prompt_type=p.prompt_type,
            name=p.name,
            content=p.content,
            description=p.description,
            is_mas_feat_compliant=p.is_mas_feat_compliant,
            is_active=p.is_active,
            created_at=p.created_at,
            updated_at=p.updated_at,
            created_by=p.created_by
        )
        for p in prompts
    ]

@router.get("/system-prompts/{prompt_id}", response_model=AIAssistantSystemPromptResponse)
async def get_system_prompt(
    prompt_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """Get a specific system prompt"""
    auth_service = AuthService()
    # For development, use a mock user
    current_user = User(
        id="demo-user",
        email="demo@example.com",
        name="Demo User",
        role=UserRole.ADMIN,
        organization="Demo Org",
        provider=AuthProvider.LOCAL,
        provider_id="",
        is_verified=True,
        created_at=datetime.now()
    )

    # In production, uncomment the following:
    # auth_service = AuthService()
    # current_user = await auth_service.get_current_user(credentials.credentials, db)

    prompt = db.query(AIAssistantSystemPrompt).join(
        AIAssistantProvider
    ).filter(
        AIAssistantSystemPrompt.id == prompt_id,
        AIAssistantProvider.user_id == current_user.id
    ).first()

    if not prompt:
        raise HTTPException(status_code=404, detail="System prompt not found")

    return AIAssistantSystemPromptResponse(
        id=prompt.id,
        provider_id=prompt.provider_id,
        prompt_type=prompt.prompt_type,
        name=prompt.name,
        content=prompt.content,
        description=prompt.description,
        is_mas_feat_compliant=prompt.is_mas_feat_compliant,
        is_active=prompt.is_active,
        created_at=prompt.created_at,
        updated_at=prompt.updated_at,
        created_by=prompt.created_by
    )

@router.put("/system-prompts/{prompt_id}", response_model=AIAssistantSystemPromptResponse)
async def update_system_prompt(
    prompt_id: str,
    prompt_update: AIAssistantSystemPromptUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """Update a system prompt"""
    auth_service = AuthService()
    # For development, use a mock user
    current_user = User(
        id="demo-user",
        email="demo@example.com",
        name="Demo User",
        role=UserRole.ADMIN,
        organization="Demo Org",
        provider=AuthProvider.LOCAL,
        provider_id="",
        is_verified=True,
        created_at=datetime.now()
    )

    # In production, uncomment the following:
    # auth_service = AuthService()
    # current_user = await auth_service.get_current_user(credentials.credentials, db)

    prompt = db.query(AIAssistantSystemPrompt).join(
        AIAssistantProvider
    ).filter(
        AIAssistantSystemPrompt.id == prompt_id,
        AIAssistantProvider.user_id == current_user.id
    ).first()

    if not prompt:
        raise HTTPException(status_code=404, detail="System prompt not found")

    # Update prompt fields
    update_data = prompt_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(prompt, field, value)

    prompt.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(prompt)

    logger.info("System prompt updated", prompt_id=prompt_id, user_id=current_user.id)

    return AIAssistantSystemPromptResponse(
        id=prompt.id,
        provider_id=prompt.provider_id,
        prompt_type=prompt.prompt_type,
        name=prompt.name,
        content=prompt.content,
        description=prompt.description,
        is_mas_feat_compliant=prompt.is_mas_feat_compliant,
        is_active=prompt.is_active,
        created_at=prompt.created_at,
        updated_at=prompt.updated_at,
        created_by=prompt.created_by
    )

@router.delete("/system-prompts/{prompt_id}")
async def delete_system_prompt(
    prompt_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """Delete a system prompt"""
    auth_service = AuthService()
    # For development, use a mock user
    current_user = User(
        id="demo-user",
        email="demo@example.com",
        name="Demo User",
        role=UserRole.ADMIN,
        organization="Demo Org",
        provider=AuthProvider.LOCAL,
        provider_id="",
        is_verified=True,
        created_at=datetime.now()
    )

    # In production, uncomment the following:
    # auth_service = AuthService()
    # current_user = await auth_service.get_current_user(credentials.credentials, db)

    prompt = db.query(AIAssistantSystemPrompt).join(
        AIAssistantProvider
    ).filter(
        AIAssistantSystemPrompt.id == prompt_id,
        AIAssistantProvider.user_id == current_user.id
    ).first()

    if not prompt:
        raise HTTPException(status_code=404, detail="System prompt not found")

    db.delete(prompt)
    db.commit()

    logger.info("System prompt deleted", prompt_id=prompt_id, user_id=current_user.id)

    return {"message": "System prompt deleted successfully"}

# Chat and Generation Endpoints

@router.post("/chat", response_model=AIAssistantChatResponse)
async def chat_with_ai(
    chat_request: AIAssistantChatRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """Chat with AI assistant"""
    auth_service = AuthService()
    # For development, use a mock user
    current_user = User(
        id="demo-user",
        email="demo@example.com",
        name="Demo User",
        role=UserRole.ADMIN,
        organization="Demo Org",
        provider=AuthProvider.LOCAL,
        provider_id="",
        is_verified=True,
        created_at=datetime.now()
    )

    # In production, uncomment the following:
    # auth_service = AuthService()
    # current_user = await auth_service.get_current_user(credentials.credentials, db)

    # Use default provider if none specified
    if not chat_request.provider_id:
        provider = db.query(AIAssistantProvider).filter(
            AIAssistantProvider.user_id == current_user.id,
            AIAssistantProvider.status == AIAssistantProviderStatus.ACTIVE
        ).first()

        if not provider:
            raise HTTPException(status_code=404, detail="No active AI provider found")

        chat_request.provider_id = provider.id

    # Verify provider exists and belongs to user
    provider = db.query(AIAssistantProvider).filter(
        AIAssistantProvider.id == chat_request.provider_id,
        AIAssistantProvider.user_id == current_user.id
    ).first()

    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    # Update last used time
    provider.last_used_at = datetime.utcnow()
    db.commit()

    # Get system prompt if specified
    system_prompt = None
    if chat_request.context_type in ["create_prompt", "edit_prompt"]:
        active_prompt = db.query(AIAssistantSystemPrompt).filter(
            AIAssistantSystemPrompt.provider_id == chat_request.provider_id,
            AIAssistantSystemPrompt.prompt_type == chat_request.context_type,
            AIAssistantSystemPrompt.is_active == True
        ).first()

        if active_prompt:
            system_prompt = active_prompt.content

    # Call AI service
    result = await ai_assistant_service.chat(
        chat_request.provider_id,
        [{"role": "user", "content": chat_request.message}],
        system_prompt
    )

    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "AI service error"))

    # Create or get conversation
    conversation_id = chat_request.conversation_id or str(uuid.uuid4())

    if not chat_request.conversation_id:
        # Create new conversation
        conversation = AIAssistantConversation(
            id=conversation_id,
            user_id=current_user.id,
            provider_id=chat_request.provider_id,
            context_type=chat_request.context_type or "general",
            context_id=chat_request.context_id,
            title=chat_request.message[:50] + "..." if len(chat_request.message) > 50 else chat_request.message,
            messages=[{"role": "user", "content": chat_request.message}],
            current_provider_id=chat_request.provider_id
        )
        db.add(conversation)
    else:
        # Update existing conversation
        conversation = db.query(AIAssistantConversation).filter(
            AIAssistantConversation.id == conversation_id,
            AIAssistantConversation.user_id == current_user.id
        ).first()

        if conversation:
            conversation.messages.append({"role": "user", "content": chat_request.message})
            conversation.current_provider_id = chat_request.provider_id

    # Add AI response to conversation
    ai_message = {
        "role": "assistant",
        "content": result.get("message", "")
    }
    if conversation:
        conversation.messages.append(ai_message)

    # Create message record
    message_id = str(uuid.uuid4())
    message = AIAssistantMessage(
        id=message_id,
        conversation_id=conversation_id,
        role="assistant",
        content=result.get("message", ""),
        metadata_json={
            "model_used": result.get("model_used"),
            "tokens_used": result.get("tokens_used"),
            "response_time_ms": result.get("response_time_ms")
        }
    )

    db.add(message)
    db.commit()

    logger.info("AI chat completed", conversation_id=conversation_id, user_id=current_user.id)

    return AIAssistantChatResponse(
        conversation_id=conversation_id,
        message_id=message_id,
        role="assistant",
        content=result.get("message", ""),
        metadata_json=result.get("raw_response", {}),
        created_at=datetime.utcnow()
    )

@router.post("/generate-prompt", response_model=AIAssistantPromptGenerationResponse)
async def generate_prompt(
    generation_request: AIAssistantPromptGenerationRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """Generate a prompt using AI assistant"""
    auth_service = AuthService()
    # For development, use a mock user
    current_user = User(
        id="demo-user",
        email="demo@example.com",
        name="Demo User",
        role=UserRole.ADMIN,
        organization="Demo Org",
        provider=AuthProvider.LOCAL,
        provider_id="",
        is_verified=True,
        created_at=datetime.now()
    )

    # In production, uncomment the following:
    # auth_service = AuthService()
    # current_user = await auth_service.get_current_user(credentials.credentials, db)

    # Verify provider exists and belongs to user
    provider = db.query(AIAssistantProvider).filter(
        AIAssistantProvider.id == generation_request.provider_id,
        AIAssistantProvider.user_id == current_user.id
    ).first()

    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    # Get system prompt
    system_prompt_type = "create_prompt" if generation_request.prompt_type == AIAssistantSystemPromptType.create_prompt else "edit_prompt"
    active_prompt = db.query(AIAssistantSystemPrompt).filter(
        AIAssistantSystemPrompt.provider_id == generation_request.provider_id,
        AIAssistantSystemPrompt.prompt_type == system_prompt_type,
        AIAssistantSystemPrompt.is_active == True
    ).first()

    if not active_prompt:
        raise HTTPException(status_code=404, detail="Active system prompt not found")

    # Update last used time
    provider.last_used_at = datetime.utcnow()
    db.commit()

    # Build context for prompt generation
    context = {
        "description": generation_request.context.get("description", ""),
        "target_models": generation_request.target_models or [],
        "module_info": generation_request.context.get("module_info", ""),
        "existing_prompt": generation_request.context.get("existing_prompt", ""),
        "requirements": generation_request.context.get("requirements", ""),
        "examples": generation_request.context.get("examples", "")
    }

    # Call AI service
    result = await ai_assistant_service.generate_prompt(
        generation_request.provider_id,
        context,
        active_prompt.content
    )

    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "AI service error"))

    # Create conversation
    conversation_id = str(uuid.uuid4())
    conversation = AIAssistantConversation(
        id=conversation_id,
        user_id=current_user.id,
        provider_id=generation_request.provider_id,
        context_type=generation_request.prompt_type,
        context_id=generation_request.context.get("prompt_id"),
        title=f"Generated {generation_request.prompt_type}",
        messages=[
            {"role": "user", "content": f"Generate a {generation_request.prompt_type} prompt"},
            {"role": "assistant", "content": result.get("generated_content", "")}
        ],
        current_provider_id=generation_request.provider_id
    )

    # Create message record
    message_id = str(uuid.uuid4())
    message = AIAssistantMessage(
        id=message_id,
        conversation_id=conversation_id,
        role="assistant",
        content=result.get("generated_content", ""),
        metadata_json={
            "model_used": result.get("model_used"),
            "tokens_used": result.get("tokens_used"),
            "response_time_ms": result.get("response_time_ms"),
            "generation_type": "prompt"
        }
    )

    db.add(conversation)
    db.add(message)
    db.commit()

    # Parse generated content into prompt structure
    try:
        # Try to parse as JSON first
        import json
        if result.get("generated_content", "").strip().startswith("{"):
            generated_prompt = json.loads(result.get("generated_content", ""))
        else:
            # Fallback to simple text structure
            generated_prompt = {
                "name": f"Generated {generation_request.prompt_type}",
                "description": generation_request.context.get("description", ""),
                "content": result.get("generated_content", ""),
                "target_models": generation_request.target_models or ["gpt-4", "claude-3-sonnet"],
                "mas_intent": "To generate a helpful and compliant AI prompt",
                "mas_fairness_notes": "Generated with AI assistant using MAS FEAT guidelines",
                "mas_risk_level": "Low",
                "mas_testing_notes": "AI generated prompt requiring review"
            }
    except:
        # Fallback structure
        generated_prompt = {
            "name": f"Generated {generation_request.prompt_type}",
            "description": generation_request.context.get("description", ""),
            "content": result.get("generated_content", ""),
            "target_models": generation_request.target_models or ["gpt-4", "claude-3-sonnet"],
            "mas_intent": "To generate a helpful and compliant AI prompt",
            "mas_fairness_notes": "Generated with AI assistant using MAS FEAT guidelines",
            "mas_risk_level": "Low",
            "mas_testing_notes": "AI generated prompt requiring review"
        }

    logger.info("Prompt generated", conversation_id=conversation_id, user_id=current_user.id)

    return AIAssistantPromptGenerationResponse(
        conversation_id=conversation_id,
        generated_prompt=generated_prompt,
        mas_feat_compliance={
            "is_compliant": active_prompt.is_mas_feat_compliant,
            "system_prompt_used": active_prompt.name,
            "notes": "Generated using MAS FEAT compliant system prompt" if active_prompt.is_mas_feat_compliant else "Custom system prompt used"
        },
        metadata_json=result.get("raw_response", {}),
        created_at=datetime.utcnow()
    )
