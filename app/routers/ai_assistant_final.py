"""
Final AI Assistant Router with Real Database Operations and Fallback Authentication
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import uuid
import structlog
from datetime import datetime

from app.database import get_db
from app.services.ai_assistant_service_proper import AIAssistantService
from app.models import User, UserRole, AuthProvider
from app.auth import get_current_user_or_demo
from app.config import settings
from app.schemas import (
    AIAssistantProviderCreate, AIAssistantProviderUpdate, AIAssistantProviderResponse,
    AIAssistantProviderEditResponse,
    AIAssistantSystemPromptCreate, AIAssistantSystemPromptUpdate, AIAssistantSystemPromptResponse,
    AIAssistantMessage as AIAssistantMessageSchema,
    AIAssistantConversationCreate, AIAssistantConversationResponse,
    AIAssistantChatRequest, AIAssistantChatResponse,
    AIAssistantPromptGenerationRequest, AIAssistantPromptGenerationResponse,
    AIAssistantProviderTestRequest, AIAssistantProviderTestResponse
)

logger = structlog.get_logger()

router = APIRouter(tags=["ai-assistant"])


def _normalize_roles(user: dict) -> set[str]:
    """Extract normalized role names from a user dict."""
    roles_raw = user.get("roles")

    if not roles_raw:
        roles_raw = []
    elif isinstance(roles_raw, str):
        roles_raw = [roles_raw]

    normalized = {str(role).lower() for role in roles_raw if role}

    single_role = user.get("role")
    if single_role:
        normalized.add(str(single_role).lower())

    if user.get("is_admin"):
        normalized.add("admin")

    return normalized


def _is_admin_user(user: dict) -> bool:
    """Determine if the given user should have admin-level access."""
    roles = _normalize_roles(user)
    admin_aliases = {
        "admin",
        "platform_admin",
        "system_admin",
        "governance_admin",
        "super_admin",
        "owner"
    }

    return any(role in admin_aliases or role.endswith("_admin") for role in roles)

# AI-driven prompt generation - no hardcoded templates
# All prompts will be generated dynamically using AI providers based on user descriptions

# AI-driven MAS intent generation - no hardcoded keyword matching
# MAS intent will be generated dynamically using AI providers based on prompt description

# AI-driven MAS fairness notes generation - no hardcoded keyword matching
# MAS fairness notes will be generated dynamically using AI providers based on prompt description


# Provider Endpoints

@router.get("/providers", response_model=List[AIAssistantProviderResponse])
async def get_providers(
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_or_demo)
):
    """Get all AI assistant providers for the current user"""
    try:
        service = AIAssistantService(db)
        roles = {role.lower() for role in current_user.get("roles", [])}
        is_admin = "admin" in roles or "governance_admin" in roles
        tenant_id = current_user.get("tenant_id") or current_user.get("tenant")
        providers = service.get_providers(
            user_id=current_user["user_id"],
            include_all=is_admin,
            tenant_id=tenant_id
        )
        logger.info("Retrieved providers", count=len(providers), user_id=current_user["user_id"], include_all=is_admin)
        return providers
    except Exception as e:
        logger.error("Error getting providers", user_id=current_user.get("user_id"), error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve providers")

@router.get("/providers/{provider_id}", response_model=AIAssistantProviderResponse)
async def get_provider(
    provider_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_or_demo)
):
    """Get a specific AI assistant provider"""
    try:
        service = AIAssistantService(db)
        roles = {role.lower() for role in current_user.get("roles", [])}
        is_admin = "admin" in roles or "governance_admin" in roles
        tenant_id = current_user.get("tenant_id") or current_user.get("tenant")
        provider = service.get_provider(
            provider_id,
            current_user["user_id"],
            include_all=is_admin,
            tenant_id=tenant_id
        )

        if not provider:
            raise HTTPException(status_code=404, detail="Provider not found")

        return provider
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error getting provider", provider_id=provider_id, user_id=current_user.get("user_id"), error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve provider")

@router.get("/providers/{provider_id}/edit", response_model=AIAssistantProviderEditResponse)
async def get_provider_for_edit(
    provider_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_or_demo)
):
    """Get a specific AI assistant provider with full API key for editing"""
    try:
        service = AIAssistantService(db)
        roles = {role.lower() for role in current_user.get("roles", [])}
        is_admin = "admin" in roles or "governance_admin" in roles
        tenant_id = current_user.get("tenant_id") or current_user.get("tenant")
        provider = service.get_provider_for_edit(
            provider_id,
            current_user["user_id"],
            include_all=is_admin,
            tenant_id=tenant_id
        )

        if not provider:
            raise HTTPException(status_code=404, detail="Provider not found")

        return provider
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error getting provider for edit", provider_id=provider_id, user_id=current_user.get("user_id"), error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve provider for editing")

@router.post("/providers", response_model=AIAssistantProviderResponse)
async def create_provider(
    provider: AIAssistantProviderCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_or_demo)
):
    """Create a new AI assistant provider"""
    try:
        service = AIAssistantService(db)
        created_provider = service.create_provider(current_user["user_id"], provider)
        logger.info("Created provider",
                   provider_id=created_provider.id,
                   name=created_provider.name,
                   user_id=current_user["user_id"])
        return created_provider
    except ValueError as e:
        logger.warning(f"Provider creation validation failed: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Error creating provider", user_id=current_user.get("user_id"), error=str(e))
        raise HTTPException(status_code=500, detail="Failed to create provider")

@router.put("/providers/{provider_id}", response_model=AIAssistantProviderResponse)
async def update_provider(
    provider_id: str,
    provider_update: AIAssistantProviderUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_or_demo)
):
    """Update an existing AI assistant provider"""
    try:
        service = AIAssistantService(db)
        roles = {role.lower() for role in current_user.get("roles", [])}
        is_admin = "admin" in roles or "governance_admin" in roles
        tenant_id = current_user.get("tenant_id") or current_user.get("tenant")
        updated_provider = service.update_provider(
            provider_id,
            current_user["user_id"],
            provider_update,
            include_all=is_admin,
            tenant_id=tenant_id
        )

        if not updated_provider:
            raise HTTPException(status_code=404, detail="Provider not found")

        logger.info("Updated provider", provider_id=provider_id, user_id=current_user["user_id"])
        return updated_provider
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error updating provider", provider_id=provider_id, user_id=current_user.get("user_id"), error=str(e))
        raise HTTPException(status_code=500, detail="Failed to update provider")

@router.delete("/providers/{provider_id}")
async def delete_provider(
    provider_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_or_demo)
):
    """Delete an AI assistant provider (soft delete)"""
    try:
        service = AIAssistantService(db)
        roles = {role.lower() for role in current_user.get("roles", [])}
        is_admin = "admin" in roles or "governance_admin" in roles
        tenant_id = current_user.get("tenant_id") or current_user.get("tenant")
        success = service.delete_provider(
            provider_id,
            current_user["user_id"],
            include_all=is_admin,
            tenant_id=tenant_id
        )

        if not success:
            raise HTTPException(status_code=404, detail="Provider not found")

        logger.info("Deleted provider", provider_id=provider_id, user_id=current_user["user_id"])
        return {"message": "Provider deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting provider", provider_id=provider_id, user_id=current_user.get("user_id"), error=str(e))
        raise HTTPException(status_code=500, detail="Failed to delete provider")

@router.post("/providers/{provider_id}/test", response_model=AIAssistantProviderTestResponse)
async def test_provider(
    provider_id: str,
    test_request: AIAssistantProviderTestRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_or_demo)
):
    """Test an AI assistant provider configuration"""
    try:
        service = AIAssistantService(db)
        roles = {role.lower() for role in current_user.get("roles", [])}
        is_admin = "admin" in roles or "governance_admin" in roles
        tenant_id = current_user.get("tenant_id") or current_user.get("tenant")
        test_result = service.test_provider(
            provider_id,
            current_user["user_id"],
            test_request,
            include_all=is_admin,
            tenant_id=tenant_id
        )

        if not test_result:
            raise HTTPException(status_code=404, detail="Provider not found")

        return test_result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error testing provider", provider_id=provider_id, user_id=current_user.get("user_id"), error=str(e))
        raise HTTPException(status_code=500, detail="Failed to test provider")

# System Prompt Endpoints

@router.get("/system-prompts", response_model=List[AIAssistantSystemPromptResponse])
async def get_system_prompts(
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_or_demo)
):
    """Get all system prompts for the current user's providers"""
    try:
        service = AIAssistantService(db)
        roles = {role.lower() for role in current_user.get("roles", [])}
        is_admin = "admin" in roles or "governance_admin" in roles
        tenant_id = current_user.get("tenant_id") or current_user.get("tenant")
        prompts = service.get_system_prompts(
            user_id=current_user["user_id"],
            include_all=is_admin,
            tenant_id=tenant_id
        )
        return prompts
    except Exception as e:
        logger.error("Error getting system prompts", user_id=current_user.get("user_id"), error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve system prompts")

@router.post("/system-prompts", response_model=AIAssistantSystemPromptResponse)
async def create_system_prompt(
    prompt: AIAssistantSystemPromptCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_or_demo)
):
    """Create a new system prompt"""
    try:
        service = AIAssistantService(db)
        created_prompt = service.create_system_prompt(current_user["user_id"], prompt)
        return created_prompt
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Error creating system prompt", user_id=current_user.get("user_id"), error=str(e))
        raise HTTPException(status_code=500, detail="Failed to create system prompt")

# System Prompt Management Endpoints

@router.put("/system-prompts/{prompt_id}", response_model=AIAssistantSystemPromptResponse)
async def update_system_prompt(
    prompt_id: str,
    prompt_update: AIAssistantSystemPromptUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_or_demo)
):
    """Update an existing system prompt"""
    try:
        service = AIAssistantService(db)
        updated_prompt = service.update_system_prompt(prompt_id, current_user["user_id"], prompt_update)

        if not updated_prompt:
            raise HTTPException(status_code=404, detail="System prompt not found")

        return updated_prompt
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error updating system prompt", prompt_id=prompt_id, user_id=current_user.get("user_id"), error=str(e))
        raise HTTPException(status_code=500, detail="Failed to update system prompt")

@router.delete("/system-prompts/{prompt_id}")
async def delete_system_prompt(
    prompt_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_or_demo)
):
    """Delete a system prompt"""
    try:
        service = AIAssistantService(db)
        success = service.delete_system_prompt(prompt_id, current_user["user_id"])

        if not success:
            raise HTTPException(status_code=404, detail="System prompt not found")

        return {"message": "System prompt deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting system prompt", prompt_id=prompt_id, user_id=current_user.get("user_id"), error=str(e))
        raise HTTPException(status_code=500, detail="Failed to delete system prompt")

# Default Provider Management

@router.get("/default-provider", response_model=Optional[AIAssistantProviderResponse])
async def get_default_provider(
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_or_demo)
):
    """Get the user's default AI provider"""
    try:
        service = AIAssistantService(db)
        default_provider = service.get_default_provider(current_user["user_id"])
        if not default_provider:
            return None
        return default_provider
    except ValueError as e:
        logger.error("Validation error getting default provider", user_id=current_user.get("user_id"), error=str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Error getting default provider", user_id=current_user.get("user_id"), error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to get default provider")

@router.post("/default-provider/{provider_id}", response_model=AIAssistantProviderResponse)
async def set_default_provider(
    provider_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_or_demo)
):
    """Set the user's default AI provider"""
    try:
        service = AIAssistantService(db)
        roles = {role.lower() for role in current_user.get("roles", [])}
        is_admin = "admin" in roles or "governance_admin" in roles
        tenant_id = current_user.get("tenant_id") or current_user.get("tenant")
        default_provider = service.set_default_provider(
            user_id=current_user["user_id"],
            provider_id=provider_id,
            include_all=is_admin,
            tenant_id=tenant_id
        )
        return default_provider
    except ValueError as e:
        logger.error("Error setting default provider", user_id=current_user.get("user_id"), provider_id=provider_id, error=str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Error setting default provider", user_id=current_user.get("user_id"), provider_id=provider_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to set default provider")

@router.delete("/default-provider")
async def clear_default_provider(
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_or_demo)
):
    """Clear the user's default AI provider"""
    try:
        service = AIAssistantService(db)
        service.clear_default_provider(current_user["user_id"])
        return {"message": "Default provider cleared successfully"}
    except Exception as e:
        logger.error("Error clearing default provider", user_id=current_user.get("user_id"), error=str(e))
        raise HTTPException(status_code=500, detail="Failed to clear default provider")

# Health Check Endpoint

@router.get("/health")
async def health_check(db: Session = Depends(get_db)):
    """Health check for AI Assistant service"""
    try:
        service = AIAssistantService(db)
        health = service.health_check()
        return health
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Health check failed")

# Generate Prompt Endpoint

@router.post("/generate-prompt")
async def generate_prompt(
    http_request: Request,
    request_data: dict,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_or_demo)
):
    """Generate a prompt using AI assistant"""
    try:
        service = AIAssistantService(db)

        provider_id = request_data.get("provider_id")
        prompt_type = request_data.get("prompt_type")
        context = request_data.get("context", {})
        target_models = request_data.get("target_models", [])

        if not provider_id:
            raise HTTPException(status_code=400, detail="Provider ID is required")

        # Verify provider exists and belongs to user
        roles = {role.lower() for role in current_user.get("roles", [])}
        is_admin = "admin" in roles or "governance_admin" in roles

        tenant_id = current_user.get("tenant_id") or current_user.get("tenant")
        provider = service.get_provider_model(
            provider_id,
            current_user["user_id"],
            include_all=is_admin,
            tenant_id=tenant_id
        )
        if not provider:
            raise HTTPException(status_code=404, detail="Provider not found")

        # Generate intelligent prompt content based on description and context
        description = context.get('description', '').lower()
        module_info = context.get('module_info', '')
        requirements = context.get('requirements', '')

        # Use the AI provider to generate intelligent content based on description
        logger.info("Generating prompt using AI provider", description=description, provider_id=provider_id)

        # Get the appropriate system prompt from database
        system_prompt_type = "create_prompt" if prompt_type == "create_prompt" else "edit_prompt"
        system_prompt = service.get_system_prompt_for_provider(provider.id, system_prompt_type)
        system_prompt_content = None

        if system_prompt:
            system_prompt_content = system_prompt.content
        else:
            logger.warning(
                "System prompt not configured; using default instructions",
                user_id=current_user.get("user_id"),
                provider_id=provider_id,
                prompt_type=system_prompt_type
            )

        # Use the AI service to generate the prompt
        try:
            generation_result = await service.generate_prompt(
                provider_id=provider_id,
                user_id=current_user["user_id"],
                description=description,
                module_info=module_info,
                requirements=requirements,
                system_prompt_content=system_prompt_content
            )

            if generation_result.get("success"):
                generated_content = generation_result["generated_content"]
            else:
                # If AI generation fails, return an error response instead of using hardcoded templates
                logger.error(f"AI generation failed: {generation_result.get('error')}")
                raise HTTPException(status_code=500, detail=f"AI generation failed: {generation_result.get('error', 'Unknown error')}")
        except Exception as e:
            logger.error(f"AI service generation failed: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to generate prompt: {str(e)}")

        # Generate MAS FEAT compliance fields using AI provider
        mas_fields_prompt = f"""Based on the following prompt description, generate appropriate MAS FEAT compliance fields:

Description: {description}
Module Info: {module_info}
Requirements: {requirements}

Please provide:
1. MAS Intent: A clear statement of the prompt's purpose with fairness considerations
2. MAS Fairness Notes: Specific fairness considerations and bias mitigation strategies
3. Risk Level: low, medium, or high with justification
4. Testing Notes: Recommended testing approach

Respond in JSON format with keys: mas_intent, mas_fairness_notes, mas_risk_level, mas_testing_notes"""

        try:
            mas_result = await service.generate_prompt(
                provider_id=provider_id,
                user_id=current_user["user_id"],
                description=mas_fields_prompt,
                module_info="",
                requirements=""
            )

            if mas_result.get("success"):
                import json
                try:
                    # Try to parse JSON response
                    mas_content = mas_result["generated_content"]
                    mas_data = json.loads(mas_content)
                    mas_intent = mas_data.get("mas_intent", "To assist users effectively while ensuring fair and transparent interactions.")
                    mas_fairness_notes = mas_data.get("mas_fairness_notes", "Designed with fairness considerations and regular bias audits.")
                    mas_risk_level = mas_data.get("mas_risk_level", "low")
                    mas_testing_notes = mas_data.get("mas_testing_notes", "AI-generated prompt requiring human review.")
                except json.JSONDecodeError:
                    # Fallback if JSON parsing fails
                    mas_intent = "To assist users effectively while ensuring fair and transparent interactions."
                    mas_fairness_notes = "Designed with fairness considerations and regular bias audits."
                    mas_risk_level = "low"
                    mas_testing_notes = "AI-generated prompt requiring human review."
            else:
                # Fallback if AI generation fails
                mas_intent = "To assist users effectively while ensuring fair and transparent interactions."
                mas_fairness_notes = "Designed with fairness considerations and regular bias audits."
                mas_risk_level = "low"
                mas_testing_notes = "AI-generated prompt requiring human review."
        except Exception as e:
            logger.warning(f"MAS field generation failed, using fallback: {str(e)}")
            # Fallback if MAS generation fails
            mas_intent = "To assist users effectively while ensuring fair and transparent interactions."
            mas_fairness_notes = "Designed with fairness considerations and regular bias audits."
            mas_risk_level = "low"
            mas_testing_notes = "AI-generated prompt requiring human review."

        logger.info("Generated prompt", provider_id=provider_id, user_id=current_user["user_id"])

        return {
            "generated_content": generated_content,
            "mas_intent": mas_intent,
            "mas_fairness_notes": mas_fairness_notes,
            "mas_risk_level": mas_risk_level,
            "mas_testing_notes": mas_testing_notes,
            "success": True,
            "provider_id": provider_id,
            "prompt_type": prompt_type,
            "created_at": datetime.utcnow().isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate prompt: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate prompt: {str(e)}")
