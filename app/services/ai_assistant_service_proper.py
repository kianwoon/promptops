"""
Proper AI Assistant Service Layer with Real Database Operations
"""

import uuid
import structlog
import aiohttp
import asyncio
from datetime import datetime
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from app.models import (
    AIAssistantProvider, AIAssistantSystemPrompt, AIAssistantConversation,
    AIAssistantMessage, User, AIAssistantProviderStatus, AIAssistantProviderType,
    AIAssistantSystemPromptType, AIAssistantConversationStatus, AIAssistantMessageRole
)
from app.database import Base
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


class AIAssistantService:
    """Service layer for AI Assistant operations with proper database integration"""

    def __init__(self, db: Session):
        self.db = db

    def _refresh_user_table_metadata(self):
        """Refresh the User table metadata to ensure SQLAlchemy sees the latest schema changes"""
        try:
            # Simpler approach: clear the session and force a fresh query
            self.db.expire_all()

            # Force fresh metadata reflection
            from sqlalchemy import inspect
            inspector = inspect(self.db.bind)

            # Get the actual table structure from the database
            user_table_info = inspector.get_columns('users')
            logger.info("Refreshed User table metadata", columns_found=len(user_table_info))

        except Exception as e:
            logger.warning("Failed to refresh User table metadata", error=str(e))
            # Don't raise the exception as this is a best-effort operation

    # Provider Operations
    def get_providers(self, user_id: str) -> List[AIAssistantProviderResponse]:
        """Get all AI assistant providers for a user"""
        try:
            providers = self.db.query(AIAssistantProvider).filter(
                AIAssistantProvider.user_id == user_id
            ).order_by(AIAssistantProvider.created_at.desc()).all()

            return [
                AIAssistantProviderResponse(
                    id=p.id,
                    user_id=p.user_id,
                    provider_type=p.provider_type.value if hasattr(p.provider_type, 'value') else p.provider_type,
                    name=p.name,
                    status=p.status.value if hasattr(p.status, 'value') else p.status,
                    api_key="***" if p.api_key else None,  # Never return actual API keys
                    api_key_prefix=p.api_key[:8] if p.api_key and len(p.api_key) > 8 else None,
                    api_base_url=p.api_base_url,
                    model_name=p.model_name,
                    organization=p.organization,
                    project=p.project,
                    config_json=p.config_json or {},
                    created_at=p.created_at,
                    updated_at=p.updated_at,
                    last_used_at=p.last_used_at
                )
                for p in providers
            ]
        except Exception as e:
            logger.error("Error getting providers", user_id=user_id, error=str(e))
            return []

    def get_provider(self, provider_id: str, user_id: str) -> Optional[AIAssistantProviderResponse]:
        """Get a specific provider by ID"""
        try:
            provider = self.db.query(AIAssistantProvider).filter(
                and_(
                    AIAssistantProvider.id == provider_id,
                    AIAssistantProvider.user_id == user_id
                )
            ).first()

            if not provider:
                return None

            return AIAssistantProviderResponse(
                id=provider.id,
                user_id=provider.user_id,
                provider_type=provider.provider_type.value if hasattr(provider.provider_type, 'value') else provider.provider_type,
                name=provider.name,
                status=provider.status.value if hasattr(provider.status, 'value') else provider.status,
                api_key="***" if provider.api_key else None,
                api_key_prefix=provider.api_key[:8] if provider.api_key and len(provider.api_key) > 8 else None,
                api_base_url=provider.api_base_url,
                model_name=provider.model_name,
                organization=provider.organization,
                project=provider.project,
                config_json=provider.config_json or {},
                created_at=provider.created_at,
                updated_at=provider.updated_at,
                last_used_at=provider.last_used_at
            )
        except Exception as e:
            logger.error("Error getting provider", provider_id=provider_id, user_id=user_id, error=str(e))
            return None

    def get_provider_for_edit(self, provider_id: str, user_id: str) -> Optional[AIAssistantProviderEditResponse]:
        """Get a specific provider by ID with full API key for editing"""
        try:
            provider = self.db.query(AIAssistantProvider).filter(
                and_(
                    AIAssistantProvider.id == provider_id,
                    AIAssistantProvider.user_id == user_id
                )
            ).first()

            if not provider:
                return None

            return AIAssistantProviderEditResponse(
                id=provider.id,
                user_id=provider.user_id,
                provider_type=provider.provider_type.value if hasattr(provider.provider_type, 'value') else provider.provider_type,
                name=provider.name,
                status=provider.status.value if hasattr(provider.status, 'value') else provider.status,
                api_key=provider.api_key,  # Return full API key for editing
                api_key_prefix=provider.api_key[:8] if provider.api_key and len(provider.api_key) > 8 else None,
                api_base_url=provider.api_base_url,
                model_name=provider.model_name,
                organization=provider.organization,
                project=provider.project,
                config_json=provider.config_json or {},
                created_at=provider.created_at,
                updated_at=provider.updated_at,
                last_used_at=provider.last_used_at
            )
        except Exception as e:
            logger.error("Error getting provider for edit", provider_id=provider_id, user_id=user_id, error=str(e))
            return None

    def create_provider(self, user_id: str, provider_data: AIAssistantProviderCreate) -> AIAssistantProviderResponse:
        """Create a new AI assistant provider"""
        try:
            # Check if user already has an active provider of this type
            existing_provider = self.db.query(AIAssistantProvider).filter(
                and_(
                    AIAssistantProvider.user_id == user_id,
                    AIAssistantProvider.provider_type == provider_data.provider_type,
                    AIAssistantProvider.status == AIAssistantProviderStatus.active
                )
            ).first()

            if existing_provider:
                raise ValueError(f"User already has an active {provider_data.provider_type.value} provider")

            # Create new provider
            provider_id = str(uuid.uuid4())
            provider = AIAssistantProvider(
                id=provider_id,
                user_id=user_id,
                provider_type=provider_data.provider_type,
                name=provider_data.name,
                status=AIAssistantProviderStatus.active,
                api_key=provider_data.api_key or "",
                api_base_url=provider_data.api_base_url or "",
                model_name=provider_data.model_name or "",
                organization=provider_data.organization or "",
                project=provider_data.project or "",
                config_json=provider_data.config_json or {}
            )

            self.db.add(provider)
            self.db.commit()
            self.db.refresh(provider)

            return AIAssistantProviderResponse(
                id=provider.id,
                user_id=provider.user_id,
                provider_type=provider.provider_type.value if hasattr(provider.provider_type, 'value') else provider.provider_type,
                name=provider.name,
                status=provider.status.value if hasattr(provider.status, 'value') else provider.status,
                api_key="***" if provider.api_key else None,
                api_key_prefix=provider.api_key[:8] if provider.api_key and len(provider.api_key) > 8 else None,
                api_base_url=provider.api_base_url,
                model_name=provider.model_name,
                organization=provider.organization,
                project=provider.project,
                config_json=provider.config_json or {},
                created_at=provider.created_at,
                updated_at=provider.updated_at,
                last_used_at=provider.last_used_at
            )
        except Exception as e:
            self.db.rollback()
            logger.error("Error creating provider", user_id=user_id, error=str(e))
            raise e

    def update_provider(self, provider_id: str, user_id: str, update_data: AIAssistantProviderUpdate) -> Optional[AIAssistantProviderResponse]:
        """Update an existing provider"""
        try:
            provider = self.db.query(AIAssistantProvider).filter(
                and_(
                    AIAssistantProvider.id == provider_id,
                    AIAssistantProvider.user_id == user_id
                )
            ).first()

            if not provider:
                return None

            # Update fields
            if update_data.name is not None:
                provider.name = update_data.name
            if update_data.api_key is not None:
                provider.api_key = update_data.api_key
            if update_data.api_base_url is not None:
                provider.api_base_url = update_data.api_base_url
            if update_data.model_name is not None:
                provider.model_name = update_data.model_name
            if update_data.organization is not None:
                provider.organization = update_data.organization
            if update_data.project is not None:
                provider.project = update_data.project
            if update_data.config_json is not None:
                provider.config_json = update_data.config_json

            provider.updated_at = datetime.utcnow()
            self.db.commit()
            self.db.refresh(provider)

            return AIAssistantProviderResponse(
                id=provider.id,
                user_id=provider.user_id,
                provider_type=provider.provider_type.value if hasattr(provider.provider_type, 'value') else provider.provider_type,
                name=provider.name,
                status=provider.status.value if hasattr(provider.status, 'value') else provider.status,
                api_key="***" if provider.api_key else None,
                api_key_prefix=provider.api_key[:8] if provider.api_key and len(provider.api_key) > 8 else None,
                api_base_url=provider.api_base_url,
                model_name=provider.model_name,
                organization=provider.organization,
                project=provider.project,
                config_json=provider.config_json or {},
                created_at=provider.created_at,
                updated_at=provider.updated_at,
                last_used_at=provider.last_used_at
            )
        except Exception as e:
            self.db.rollback()
            logger.error("Error updating provider", provider_id=provider_id, user_id=user_id, error=str(e))
            return None

    def delete_provider(self, provider_id: str, user_id: str) -> bool:
        """Delete a provider (hard delete from database)"""
        try:
            provider = self.db.query(AIAssistantProvider).filter(
                and_(
                    AIAssistantProvider.id == provider_id,
                    AIAssistantProvider.user_id == user_id
                )
            ).first()

            if not provider:
                return False

            # Hard delete - remove from database completely
            self.db.delete(provider)
            self.db.commit()

            return True
        except Exception as e:
            self.db.rollback()
            logger.error("Error deleting provider", provider_id=provider_id, user_id=user_id, error=str(e))
            return False

    def test_provider(self, provider_id: str, user_id: str, test_request: AIAssistantProviderTestRequest) -> Optional[AIAssistantProviderTestResponse]:
        """Test an AI provider configuration with a simple API call"""
        try:
            # Get provider
            provider = self.db.query(AIAssistantProvider).filter(
                and_(
                    AIAssistantProvider.id == provider_id,
                    AIAssistantProvider.user_id == user_id
                )
            ).first()

            if not provider:
                return None

            # Test different provider types
            provider_type = str(provider.provider_type).lower().strip()
            logger.info("Testing provider", provider_id=provider_id, original_type=provider.provider_type, normalized_type=provider_type)

            if provider_type in ["openai", "open ai"]:
                logger.info("Using OpenAI test")
                return self._test_openai_provider(provider, test_request)
            elif "anthropic" in provider_type or "claude" in provider_type:
                logger.info("Using Anthropic test - detected in provider type:", provider_type)
                return self._test_anthropic_provider(provider, test_request)
            elif provider_type in ["gemini", "google"]:
                logger.info("Using Gemini test")
                return self._test_gemini_provider(provider, test_request)
            else:
                # Generic test for other providers
                logger.info("Using generic test for provider type:", provider_type)
                return self._test_generic_provider(provider, test_request)

        except Exception as e:
            logger.error("Error testing provider", provider_id=provider_id, user_id=user_id, error=str(e))
            return AIAssistantProviderTestResponse(
                success=False,
                response_time_ms=0,
                status_code=500,
                error_message=str(e),
                response_data=None,
                timestamp=datetime.utcnow().isoformat()
            )

    def _test_openai_provider(self, provider: AIAssistantProvider, test_request: AIAssistantProviderTestRequest) -> AIAssistantProviderTestResponse:
        """Test OpenAI provider with real API call"""
        try:
            import openai
            import time

            if not provider.api_key:
                return AIAssistantProviderTestResponse(
                    success=False,
                    response_time_ms=0,
                    status_code=400,
                    error_message="No API key configured",
                    response_data=None,
                    timestamp=datetime.utcnow().isoformat()
                )

            # Configure OpenAI client
            client = openai.OpenAI(
                api_key=provider.api_key,
                base_url=provider.api_base_url if provider.api_base_url else None
            )

            # Use provided model or default
            model = provider.model_name or "gpt-3.5-turbo"

            start_time = time.time()

            # Make real API call
            response = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": test_request.test_message}],
                max_tokens=50,
                temperature=0.7
            )

            end_time = time.time()
            response_time_ms = int((end_time - start_time) * 1000)

            return AIAssistantProviderTestResponse(
                success=True,
                response_time_ms=response_time_ms,
                status_code=200,
                error_message=None,
                response_data={
                    "provider": "openai",
                    "model": model,
                    "test_message": test_request.test_message,
                    "response": response.choices[0].message.content,
                    "usage": {
                        "prompt_tokens": response.usage.prompt_tokens,
                        "completion_tokens": response.usage.completion_tokens,
                        "total_tokens": response.usage.total_tokens
                    }
                },
                timestamp=datetime.utcnow().isoformat()
            )

        except openai.AuthenticationError as e:
            return AIAssistantProviderTestResponse(
                success=False,
                response_time_ms=0,
                status_code=401,
                error_message=f"Authentication failed: {str(e)}",
                response_data=None,
                timestamp=datetime.utcnow().isoformat()
            )
        except openai.RateLimitError as e:
            return AIAssistantProviderTestResponse(
                success=False,
                response_time_ms=0,
                status_code=429,
                error_message=f"Rate limit exceeded: {str(e)}",
                response_data=None,
                timestamp=datetime.utcnow().isoformat()
            )
        except openai.APIError as e:
            return AIAssistantProviderTestResponse(
                success=False,
                response_time_ms=0,
                status_code=e.status_code if hasattr(e, 'status_code') else 500,
                error_message=f"API error: {str(e)}",
                response_data=None,
                timestamp=datetime.utcnow().isoformat()
            )
        except Exception as e:
            return AIAssistantProviderTestResponse(
                success=False,
                response_time_ms=0,
                status_code=500,
                error_message=f"Connection error: {str(e)}",
                response_data=None,
                timestamp=datetime.utcnow().isoformat()
            )

    def _test_anthropic_provider(self, provider: AIAssistantProvider, test_request: AIAssistantProviderTestRequest) -> AIAssistantProviderTestResponse:
        """Test Anthropic provider with real API call"""
        try:
            import anthropic
            import time

            if not provider.api_key:
                return AIAssistantProviderTestResponse(
                    success=False,
                    response_time_ms=0,
                    status_code=400,
                    error_message="No API key configured",
                    response_data=None,
                    timestamp=datetime.utcnow().isoformat()
                )

            # Configure Anthropic client
            client = anthropic.Anthropic(
                api_key=provider.api_key,
                base_url=provider.api_base_url if provider.api_base_url else None
            )

            # Use provided model or default
            model = provider.model_name or "claude-3-sonnet-20240229"

            start_time = time.time()

            # Make real API call
            response = client.messages.create(
                model=model,
                max_tokens=50,
                messages=[{"role": "user", "content": test_request.test_message}]
            )

            end_time = time.time()
            response_time_ms = int((end_time - start_time) * 1000)

            return AIAssistantProviderTestResponse(
                success=True,
                response_time_ms=response_time_ms,
                status_code=200,
                error_message=None,
                response_data={
                    "provider": "anthropic",
                    "model": model,
                    "test_message": test_request.test_message,
                    "response": response.content[0].text if response.content else "No response",
                    "usage": {
                        "input_tokens": response.usage.input_tokens,
                        "output_tokens": response.usage.output_tokens,
                        "total_tokens": response.usage.input_tokens + response.usage.output_tokens
                    }
                },
                timestamp=datetime.utcnow().isoformat()
            )

        except anthropic.AuthenticationError as e:
            return AIAssistantProviderTestResponse(
                success=False,
                response_time_ms=0,
                status_code=401,
                error_message=f"Authentication failed: {str(e)}",
                response_data=None,
                timestamp=datetime.utcnow().isoformat()
            )
        except anthropic.RateLimitError as e:
            return AIAssistantProviderTestResponse(
                success=False,
                response_time_ms=0,
                status_code=429,
                error_message=f"Rate limit exceeded: {str(e)}",
                response_data=None,
                timestamp=datetime.utcnow().isoformat()
            )
        except anthropic.APIError as e:
            return AIAssistantProviderTestResponse(
                success=False,
                response_time_ms=0,
                status_code=500,
                error_message=f"API error: {str(e)}",
                response_data=None,
                timestamp=datetime.utcnow().isoformat()
            )
        except Exception as e:
            return AIAssistantProviderTestResponse(
                success=False,
                response_time_ms=0,
                status_code=500,
                error_message=f"Connection error: {str(e)}",
                response_data=None,
                timestamp=datetime.utcnow().isoformat()
            )

    def _test_gemini_provider(self, provider: AIAssistantProvider, test_request: AIAssistantProviderTestRequest) -> AIAssistantProviderTestResponse:
        """Test Google Gemini provider with real API call"""
        try:
            import google.generativeai as genai
            import time

            if not provider.api_key:
                return AIAssistantProviderTestResponse(
                    success=False,
                    response_time_ms=0,
                    status_code=400,
                    error_message="No API key configured",
                    response_data=None,
                    timestamp=datetime.utcnow().isoformat()
                )

            # Configure Gemini API
            genai.configure(api_key=provider.api_key)

            # Use provided model or default
            model = provider.model_name or "gemini-pro"

            start_time = time.time()

            # Make real API call
            model_instance = genai.GenerativeModel(model)
            response = model_instance.generate_content(test_request.test_message)

            end_time = time.time()
            response_time_ms = int((end_time - start_time) * 1000)

            return AIAssistantProviderTestResponse(
                success=True,
                response_time_ms=response_time_ms,
                status_code=200,
                error_message=None,
                response_data={
                    "provider": "gemini",
                    "model": model,
                    "test_message": test_request.test_message,
                    "response": response.text if hasattr(response, 'text') else "No response",
                    "usage": {
                        # Gemini doesn't provide detailed usage info in basic response
                        "response_generated": True
                    }
                },
                timestamp=datetime.utcnow().isoformat()
            )

        except Exception as e:
            error_msg = str(e)
            if "API key" in error_msg:
                status_code = 401
                error_msg = f"Authentication failed: {error_msg}"
            elif "quota" in error_msg.lower() or "rate" in error_msg.lower():
                status_code = 429
                error_msg = f"Rate limit exceeded: {error_msg}"
            else:
                status_code = 500
                error_msg = f"API error: {error_msg}"

            return AIAssistantProviderTestResponse(
                success=False,
                response_time_ms=0,
                status_code=status_code,
                error_message=error_msg,
                response_data=None,
                timestamp=datetime.utcnow().isoformat()
            )

    def _test_generic_provider(self, provider: AIAssistantProvider, test_request: AIAssistantProviderTestRequest) -> AIAssistantProviderTestResponse:
        """Test generic provider with HTTP connectivity test"""
        try:
            import requests
            import time

            if not provider.api_key:
                return AIAssistantProviderTestResponse(
                    success=False,
                    response_time_ms=0,
                    status_code=400,
                    error_message="No API key configured",
                    response_data=None,
                    timestamp=datetime.utcnow().isoformat()
                )

            # Determine API URL based on provider type
            base_url = provider.api_base_url
            if not base_url:
                if provider.provider_type == "qwen":
                    base_url = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation"
                elif provider.provider_type == "openrouter":
                    base_url = "https://openrouter.ai/api/v1/chat/completions"
                elif provider.provider_type == "ollama":
                    base_url = "http://localhost:11434/api/generate"
                else:
                    return AIAssistantProviderTestResponse(
                        success=False,
                        response_time_ms=0,
                        status_code=400,
                        error_message="No API base URL configured for this provider type",
                        response_data=None,
                        timestamp=datetime.utcnow().isoformat()
                    )

            # Test HTTP connectivity
            start_time = time.time()

            # Create a simple test request based on provider type
            headers = {
                "Authorization": f"Bearer {provider.api_key}",
                "Content-Type": "application/json"
            }

            if provider.provider_type == "qwen":
                payload = {
                    "model": provider.model_name or "qwen-turbo",
                    "input": {
                        "messages": [{"role": "user", "content": test_request.test_message}]
                    }
                }
            elif provider.provider_type == "openrouter":
                payload = {
                    "model": provider.model_name or "openai/gpt-3.5-turbo",
                    "messages": [{"role": "user", "content": test_request.test_message}],
                    "max_tokens": 50
                }
            elif provider.provider_type == "ollama":
                payload = {
                    "model": provider.model_name or "llama2",
                    "prompt": test_request.test_message,
                    "stream": False
                }
            else:
                # Generic JSON-RPC style test
                payload = {
                    "jsonrpc": "2.0",
                    "method": "test",
                    "params": {
                        "message": test_request.test_message,
                        "model": provider.model_name or "default"
                    },
                    "id": 1
                }

            # Make synchronous HTTP request
            try:
                response = requests.post(
                    base_url,
                    headers=headers,
                    json=payload,
                    timeout=10
                )

                end_time = time.time()
                response_time_ms = int((end_time - start_time) * 1000)

                # Try to parse response as JSON
                response_data = None
                try:
                    response_data = response.json()
                except:
                    response_data = {"raw_response": response.text}

                # Check if we got a successful response
                if response.status_code >= 200 and response.status_code < 300:
                    return AIAssistantProviderTestResponse(
                        success=True,
                        response_time_ms=response_time_ms,
                        status_code=response.status_code,
                        error_message=None,
                        response_data={
                            "provider": provider.provider_type,
                            "model": provider.model_name or "default",
                            "test_message": test_request.test_message,
                            "response": "HTTP connection successful",
                            "http_status": response.status_code,
                            "response_preview": response.text[:200] + "..." if len(response.text) > 200 else response.text
                        },
                        timestamp=datetime.utcnow().isoformat()
                    )
                else:
                    return AIAssistantProviderTestResponse(
                        success=False,
                        response_time_ms=response_time_ms,
                        status_code=response.status_code,
                        error_message=f"HTTP {response.status_code}: {response.text[:200]}",
                        response_data={
                            "provider": provider.provider_type,
                            "model": provider.model_name or "default",
                            "http_status": response.status_code,
                            "response_preview": response.text[:200] + "..." if len(response.text) > 200 else response.text
                        },
                        timestamp=datetime.utcnow().isoformat()
                    )

            except requests.exceptions.Timeout:
                return AIAssistantProviderTestResponse(
                    success=False,
                    response_time_ms=10000,
                    status_code=408,
                    error_message="Request timeout (10 seconds)",
                    response_data=None,
                    timestamp=datetime.utcnow().isoformat()
                )
            except requests.exceptions.ConnectionError as e:
                return AIAssistantProviderTestResponse(
                    success=False,
                    response_time_ms=0,
                    status_code=0,
                    error_message=f"Connection error: {str(e)}",
                    response_data=None,
                    timestamp=datetime.utcnow().isoformat()
                )
            except Exception as e:
                return AIAssistantProviderTestResponse(
                    success=False,
                    response_time_ms=0,
                    status_code=500,
                    error_message=f"HTTP request failed: {str(e)}",
                    response_data=None,
                    timestamp=datetime.utcnow().isoformat()
                )

        except Exception as e:
            return AIAssistantProviderTestResponse(
                success=False,
                response_time_ms=0,
                status_code=500,
                error_message=f"Connection test failed: {str(e)}",
                response_data=None,
                timestamp=datetime.utcnow().isoformat()
            )

    # System Prompt Operations
    def get_system_prompts(self, user_id: str) -> List[AIAssistantSystemPromptResponse]:
        """Get all system prompts for user's providers"""
        try:
            prompts = self.db.query(AIAssistantSystemPrompt).join(
                AIAssistantProvider,
                AIAssistantSystemPrompt.provider_id == AIAssistantProvider.id
            ).filter(
                AIAssistantProvider.user_id == user_id,
                AIAssistantSystemPrompt.is_active == True
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
        except Exception as e:
            logger.error("Error getting system prompts", user_id=user_id, error=str(e))
            return []

    def create_system_prompt(self, user_id: str, prompt_data: AIAssistantSystemPromptCreate) -> AIAssistantSystemPromptResponse:
        """Create a new system prompt"""
        try:
            # Verify provider belongs to user
            provider = self.db.query(AIAssistantProvider).filter(
                and_(
                    AIAssistantProvider.id == prompt_data.provider_id,
                    AIAssistantProvider.user_id == user_id
                )
            ).first()

            if not provider:
                raise ValueError("Provider not found or access denied")

            # Check if prompt type already exists for this provider
            existing_prompt = self.db.query(AIAssistantSystemPrompt).filter(
                and_(
                    AIAssistantSystemPrompt.provider_id == prompt_data.provider_id,
                    AIAssistantSystemPrompt.prompt_type == prompt_data.prompt_type.value,
                    AIAssistantSystemPrompt.is_active == True
                )
            ).first()

            if existing_prompt:
                raise ValueError(f"System prompt of type {prompt_data.prompt_type} already exists for this provider")

            prompt_id = str(uuid.uuid4())
            prompt = AIAssistantSystemPrompt(
                id=prompt_id,
                provider_id=prompt_data.provider_id,
                prompt_type=prompt_data.prompt_type.value,
                name=prompt_data.name,
                content=prompt_data.content,
                description=prompt_data.description,
                is_mas_feat_compliant=prompt_data.is_mas_feat_compliant,
                is_active=prompt_data.is_active,
                created_by=user_id
            )

            self.db.add(prompt)
            self.db.commit()
            self.db.refresh(prompt)

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
        except Exception as e:
            self.db.rollback()
            logger.error("Error creating system prompt", user_id=user_id, error=str(e))
            raise e

    # System Prompt Management Methods

    def update_system_prompt(self, prompt_id: str, user_id: str, update_data: AIAssistantSystemPromptUpdate) -> Optional[AIAssistantSystemPromptResponse]:
        """Update an existing system prompt"""
        try:
            prompt = self.db.query(AIAssistantSystemPrompt).join(
                AIAssistantProvider,
                AIAssistantSystemPrompt.provider_id == AIAssistantProvider.id
            ).filter(
                AIAssistantSystemPrompt.id == prompt_id,
                AIAssistantProvider.user_id == user_id
            ).first()

            if not prompt:
                return None

            # Update fields
            if update_data.name is not None:
                prompt.name = update_data.name
            if update_data.content is not None:
                prompt.content = update_data.content
            if update_data.description is not None:
                prompt.description = update_data.description
            if update_data.is_mas_feat_compliant is not None:
                prompt.is_mas_feat_compliant = update_data.is_mas_feat_compliant
            if update_data.is_active is not None:
                prompt.is_active = update_data.is_active

            prompt.updated_at = datetime.utcnow()
            self.db.commit()
            self.db.refresh(prompt)

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
        except Exception as e:
            self.db.rollback()
            logger.error("Error updating system prompt", prompt_id=prompt_id, user_id=user_id, error=str(e))
            return None

    def delete_system_prompt(self, prompt_id: str, user_id: str) -> bool:
        """Delete a system prompt (hard delete from database)"""
        try:
            prompt = self.db.query(AIAssistantSystemPrompt).join(
                AIAssistantProvider,
                AIAssistantSystemPrompt.provider_id == AIAssistantProvider.id
            ).filter(
                AIAssistantSystemPrompt.id == prompt_id,
                AIAssistantProvider.user_id == user_id
            ).first()

            if not prompt:
                return False

            # Hard delete - remove from database completely
            self.db.delete(prompt)
            self.db.commit()

            return True
        except Exception as e:
            self.db.rollback()
            logger.error("Error deleting system prompt", prompt_id=prompt_id, user_id=user_id, error=str(e))
            return False

    # Default Provider Management
    def get_default_provider(self, user_id: str) -> Optional[AIAssistantProviderResponse]:
        """Get the user's default AI provider"""
        try:
            # Refresh User table metadata to ensure we see the latest schema
            self._refresh_user_table_metadata()

            user = self.db.query(User).filter(User.id == user_id).first()
            if not user or not user.default_ai_provider_id:
                return None

            provider = self.db.query(AIAssistantProvider).filter(
                AIAssistantProvider.id == user.default_ai_provider_id,
                AIAssistantProvider.user_id == user_id,
                AIAssistantProvider.status == AIAssistantProviderStatus.active
            ).first()

            if not provider:
                return None

            return AIAssistantProviderResponse(
                id=provider.id,
                user_id=provider.user_id,
                provider_type=provider.provider_type,
                name=provider.name,
                status=provider.status,
                api_key=provider.api_key,
                api_base_url=provider.api_base_url,
                model_name=provider.model_name,
                organization=provider.organization,
                project=provider.project,
                config_json=provider.config_json,
                created_at=provider.created_at,
                updated_at=provider.updated_at,
                last_used_at=provider.last_used_at
            )
        except Exception as e:
            logger.error("Error getting default provider", user_id=user_id, error=str(e))
            return None

    def set_default_provider(self, user_id: str, provider_id: str) -> AIAssistantProviderResponse:
        """Set the user's default AI provider"""
        try:
            # Refresh User table metadata to ensure we see the latest schema
            self._refresh_user_table_metadata()

            # Verify the provider exists and belongs to the user
            provider = self.db.query(AIAssistantProvider).filter(
                AIAssistantProvider.id == provider_id,
                AIAssistantProvider.user_id == user_id,
                AIAssistantProvider.status == AIAssistantProviderStatus.active
            ).first()

            if not provider:
                raise ValueError("Provider not found or not accessible")

            # Update the user's default provider
            user = self.db.query(User).filter(User.id == user_id).first()
            if not user:
                raise ValueError("User not found")

            user.default_ai_provider_id = provider_id
            self.db.commit()

            return AIAssistantProviderResponse(
                id=provider.id,
                user_id=provider.user_id,
                provider_type=provider.provider_type,
                name=provider.name,
                status=provider.status,
                api_key=provider.api_key,
                api_base_url=provider.api_base_url,
                model_name=provider.model_name,
                organization=provider.organization,
                project=provider.project,
                config_json=provider.config_json,
                created_at=provider.created_at,
                updated_at=provider.updated_at,
                last_used_at=provider.last_used_at
            )
        except Exception as e:
            self.db.rollback()
            logger.error("Error setting default provider", user_id=user_id, provider_id=provider_id, error=str(e))
            raise

    def clear_default_provider(self, user_id: str) -> None:
        """Clear the user's default AI provider"""
        try:
            # Refresh User table metadata to ensure we see the latest schema
            self._refresh_user_table_metadata()

            user = self.db.query(User).filter(User.id == user_id).first()
            if not user:
                raise ValueError("User not found")

            user.default_ai_provider_id = None
            self.db.commit()
        except Exception as e:
            self.db.rollback()
            logger.error("Error clearing default provider", user_id=user_id, error=str(e))
            raise

    # Health Check
    def health_check(self) -> Dict[str, Any]:
        """Health check for the AI Assistant service"""
        try:
            # Test database connection
            provider_count = self.db.query(AIAssistantProvider).count()
            prompt_count = self.db.query(AIAssistantSystemPrompt).count()

            return {
                "status": "healthy",
                "database": {
                    "providers_count": provider_count,
                    "system_prompts_count": prompt_count,
                    "connection": "ok"
                },
                "timestamp": datetime.utcnow().isoformat()
            }
        except Exception as e:
            logger.error("Health check failed", error=str(e))
            return {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }