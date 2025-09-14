"""
Proper AI Assistant Router with Real Database Operations and Authentication
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import structlog

from app.database import get_db
from app.services.ai_assistant_service_proper import AIAssistantService
from app.services.auth_service import AuthService
from app.schemas import (
    AIAssistantProviderCreate, AIAssistantProviderUpdate, AIAssistantProviderResponse,
    AIAssistantSystemPromptCreate, AIAssistantSystemPromptUpdate, AIAssistantSystemPromptResponse,
    AIAssistantMessage as AIAssistantMessageSchema,
    AIAssistantConversationCreate, AIAssistantConversationResponse,
    AIAssistantChatRequest, AIAssistantChatResponse,
    AIAssistantPromptGenerationRequest, AIAssistantPromptGenerationResponse,
    AIAssistantProviderTestRequest, AIAssistantProviderTestResponse
)

logger = structlog.get_logger()

router = APIRouter(prefix="/ai-assistant", tags=["ai-assistant"])
security = HTTPBearer()

# Dependency to get current user
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """Get current authenticated user"""
    try:
        auth_service = AuthService()
        user = await auth_service.get_current_user(credentials.credentials, db)
        return user
    except Exception as e:
        logger.error("Authentication failed", error=str(e))
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

# Provider Endpoints

@router.get("/providers", response_model=List[AIAssistantProviderResponse])
async def get_providers(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all AI assistant providers for the current user"""
    try:
        service = AIAssistantService(db)
        providers = service.get_providers(current_user["id"])
        return providers
    except Exception as e:
        logger.error("Error getting providers", user_id=current_user.get("id"), error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve providers")

@router.get("/providers/{provider_id}", response_model=AIAssistantProviderResponse)
async def get_provider(
    provider_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific AI assistant provider"""
    try:
        service = AIAssistantService(db)
        provider = service.get_provider(provider_id, current_user["id"])

        if not provider:
            raise HTTPException(status_code=404, detail="Provider not found")

        return provider
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error getting provider", provider_id=provider_id, user_id=current_user.get("id"), error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve provider")

@router.post("/providers", response_model=AIAssistantProviderResponse)
async def create_provider(
    provider: AIAssistantProviderCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new AI assistant provider"""
    try:
        service = AIAssistantService(db)
        created_provider = service.create_provider(current_user["id"], provider)
        return created_provider
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Error creating provider", user_id=current_user.get("id"), error=str(e))
        raise HTTPException(status_code=500, detail="Failed to create provider")

@router.put("/providers/{provider_id}", response_model=AIAssistantProviderResponse)
async def update_provider(
    provider_id: str,
    provider_update: AIAssistantProviderUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update an existing AI assistant provider"""
    try:
        service = AIAssistantService(db)
        updated_provider = service.update_provider(provider_id, current_user["id"], provider_update)

        if not updated_provider:
            raise HTTPException(status_code=404, detail="Provider not found")

        return updated_provider
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error updating provider", provider_id=provider_id, user_id=current_user.get("id"), error=str(e))
        raise HTTPException(status_code=500, detail="Failed to update provider")

@router.delete("/providers/{provider_id}")
async def delete_provider(
    provider_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete an AI assistant provider (soft delete)"""
    try:
        service = AIAssistantService(db)
        success = service.delete_provider(provider_id, current_user["id"])

        if not success:
            raise HTTPException(status_code=404, detail="Provider not found")

        return {"message": "Provider deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting provider", provider_id=provider_id, user_id=current_user.get("id"), error=str(e))
        raise HTTPException(status_code=500, detail="Failed to delete provider")

# System Prompt Endpoints

@router.get("/system-prompts", response_model=List[AIAssistantSystemPromptResponse])
async def get_system_prompts(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all system prompts for the current user's providers"""
    try:
        service = AIAssistantService(db)
        prompts = service.get_system_prompts(current_user["id"])
        return prompts
    except Exception as e:
        logger.error("Error getting system prompts", user_id=current_user.get("id"), error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve system prompts")

@router.post("/system-prompts", response_model=AIAssistantSystemPromptResponse)
async def create_system_prompt(
    prompt: AIAssistantSystemPromptCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new system prompt"""
    try:
        service = AIAssistantService(db)
        created_prompt = service.create_system_prompt(current_user["id"], prompt)
        return created_prompt
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Error creating system prompt", user_id=current_user.get("id"), error=str(e))
        raise HTTPException(status_code=500, detail="Failed to create system prompt")

# Health Check Endpoint

@router.get("/health")
async def health_check(db: Session = Depends(get_db)):
    """Health check for AI Assistant service"""
    try:
        service = AIAssistantService(db)
        health = service.health_check()
        return health
    except Exception as e:
        logger.error("Health check failed", error=str(e))
        raise HTTPException(status_code=500, detail="Health check failed")