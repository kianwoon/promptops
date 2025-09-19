"""
Simple AI Assistant router for development without database dependencies
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import uuid
import structlog
from datetime import datetime

from app.database import get_db
from app.schemas import (
    AIAssistantProviderCreate, AIAssistantProviderUpdate, AIAssistantProviderResponse,
    AIAssistantSystemPromptCreate, AIAssistantSystemPromptUpdate, AIAssistantSystemPromptResponse,
    AIAssistantMessage as AIAssistantMessageSchema,
    AIAssistantConversationCreate, AIAssistantConversationResponse,
    AIAssistantChatRequest, AIAssistantChatResponse,
    AIAssistantPromptGenerationRequest, AIAssistantPromptGenerationResponse,
    AIAssistantProviderTestRequest, AIAssistantProviderTestResponse
)
# Simple MAS FEAT templates for development
class SimpleMASFEATTemplates:
    @staticmethod
    def get_template_by_name(template_name: str) -> str:
        templates = {
            'create_prompt': """You are an expert AI prompt engineer specializing in MAS FEAT compliance.
Create prompts that adhere to the Monetary Authority of Singapore's Fairness, Ethics,
Accountability, and Transparency guidelines.

## MAS FEAT Requirements:
- Fairness: Ensure equal opportunity and avoid discriminatory outcomes
- Ethics: Maintain human oversight and respect privacy
- Accountability: Document clear responsibilities and processes
- Transparency: Make AI capabilities and limitations clear

Create a comprehensive prompt based on the user's requirements.""",

            'edit_prompt': """You are an expert AI prompt engineer specializing in MAS FEAT compliance.
Review and improve existing prompts to ensure they meet Singapore's AI governance guidelines.

## Review Requirements:
- Assess for fairness and bias issues
- Check for ethical concerns and privacy implications
- Evaluate accountability mechanisms
- Review transparency aspects

Enhance the prompt while maintaining its original intent."""
        }
        return templates.get(template_name, templates['create_prompt'])

logger = structlog.get_logger()

router = APIRouter(prefix="/ai-assistant", tags=["ai-assistant"])

security = HTTPBearer()


# Mock data for development
mock_providers = []
mock_system_prompts_response = []

def get_mock_user():
    """Return mock user for development"""
    return {
        "id": "demo-user",
        "email": "demo@example.com",
        "name": "Demo User",
        "role": "admin"
    }

@router.get("/providers", response_model=List[AIAssistantProviderResponse])
async def get_providers(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """Get all AI assistant providers for the current user"""
    try:
        # For development, return mock data
        if mock_providers:
            return mock_providers
        return []
    except Exception as e:
        logger.error("Error getting providers:", error=str(e))
        return []

@router.post("/providers", response_model=AIAssistantProviderResponse)
async def create_provider(
    provider: AIAssistantProviderCreate,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """Create a new AI assistant provider"""
    try:
        # For development, create mock provider
        provider_id = str(uuid.uuid4())
        mock_provider = AIAssistantProviderResponse(
            id=provider_id,
            user_id="demo-user",
            provider_type=provider.provider_type,
            name=provider.name,
            status="active",
            api_key="***",  # Don't return actual API key
            api_base_url=provider.api_base_url,
            model_name=provider.model_name,
            organization=provider.organization,
            project=provider.project,
            config_json=provider.config_json or {},
            created_at=datetime.now(),
            updated_at=datetime.now(),
            last_used_at=None,
            is_default=False
        )
        mock_providers.append(mock_provider)
        return mock_provider
    except Exception as e:
        logger.error("Error creating provider:", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/system-prompts", response_model=List[AIAssistantSystemPromptResponse])
async def get_system_prompts(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """Get all system prompts for the current user"""
    try:
        # For development, return mock data
        if mock_system_prompts_response:
            return mock_system_prompts_response
        return []
    except Exception as e:
        logger.error("Error getting system prompts:", error=str(e))
        return []

@router.post("/system-prompts", response_model=AIAssistantSystemPromptResponse)
async def create_system_prompt(
    prompt: AIAssistantSystemPromptCreate,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """Create a new system prompt"""
    try:
        # For development, create mock prompt
        prompt_id = str(uuid.uuid4())
        mock_prompt = AIAssistantSystemPromptResponse(
            id=prompt_id,
            provider_id=prompt.provider_id,
            prompt_type=prompt.prompt_type,
            name=prompt.name,
            content=prompt.content,
            description=prompt.description,
            is_mas_feat_compliant=prompt.is_mas_feat_compliant,
            is_active=True,
            created_at=datetime.now(),
            updated_at=datetime.now(),
            created_by="demo-user"
        )
        mock_system_prompts_response.append(mock_prompt)
        return mock_prompt
    except Exception as e:
        logger.error("Error creating system prompt:", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/providers/{provider_id}/test", response_model=AIAssistantProviderTestResponse)
async def test_provider(
    provider_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """Test an AI provider connection"""
    try:
        # For development, return success
        return AIAssistantProviderTestResponse(
            success=True,
            response="Connection successful (mock)",
            response_time_ms=500,
            model_used="gpt-4",
            created_at=datetime.now()
        )
    except Exception as e:
        logger.error("Error testing provider:", error=str(e))
        return AIAssistantProviderTestResponse(
            success=False,
            error_message=str(e),
            response_time_ms=0,
            model_used="",
            created_at=datetime.now()
        )

@router.post("/chat", response_model=AIAssistantChatResponse)
async def chat(
    request: AIAssistantChatRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """Chat with AI assistant"""
    try:
        # For development, return mock response
        return AIAssistantChatResponse(
            conversation_id=str(uuid.uuid4()),
            message_id=str(uuid.uuid4()),
            role="assistant",
            content="This is a mock response from the AI Assistant. In a real implementation, this would connect to your configured AI provider.",
            created_at=datetime.now()
        )
    except Exception as e:
        logger.error("Error in chat:", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-prompt", response_model=AIAssistantPromptGenerationResponse)
async def generate_prompt(
    request: AIAssistantPromptGenerationRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """Generate a prompt using AI Assistant"""
    try:
        # Get appropriate MAS FEAT template
        template = SimpleMASFEATTemplates.get_template_by_name(request.prompt_type)

        # For development, return generated prompt
        generated_content = f"""# Generated {request.prompt_type} Prompt

This is a mock generated prompt that follows MAS FEAT compliance guidelines.

## Context:
- Description: {request.context.get('description', '')}
- Target Models: {', '.join(request.target_models)}
- Module Info: {request.context.get('module_info', '')}

## MAS FEAT Compliance:
- Fairness: Ensures equal treatment and avoids bias
- Ethics: Maintains human oversight and transparency
- Accountability: Documents decision criteria and processes
- Transparency: Clear about AI capabilities and limitations

## Generated Prompt:
Create a comprehensive prompt that addresses the user's requirements while ensuring MAS FEAT compliance."""

        return AIAssistantPromptGenerationResponse(
            conversation_id=str(uuid.uuid4()),
            generated_prompt={"content": generated_content, "type": request.prompt_type},
            mas_feat_compliance={"score": 0.85, "status": "compliant", "framework": "MAS_FEAT"},
            metadata_json={
                "template_used": request.prompt_type,
                "suggestions": [
                    "Review the generated prompt for specific requirements",
                    "Ensure compliance with your organization's guidelines",
                    "Test the prompt with sample inputs before deployment"
                ],
                "compliance_score": 0.85
            },
            created_at=datetime.now()
        )
    except Exception as e:
        logger.error("Error generating prompt:", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
