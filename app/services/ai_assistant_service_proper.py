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


DEFAULT_PROMPT_INSTRUCTIONS = (
    "Generate a comprehensive, professional AI prompt that downstream users can run without extra clarification. "
    "Ensure the final prompt describes role expectations, responsibilities, communication approach, quality controls, "
    "and compliance requirements while aligning with MAS FEAT considerations."
)


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
            logger.warning(f"Failed to refresh User table metadata: {str(e)}")
            # Don't raise the exception as this is a best-effort operation

    def _format_provider_response(self, provider: AIAssistantProvider) -> AIAssistantProviderResponse:
        """Convert a provider ORM object into an API response"""
        provider_type_value = (
            provider.provider_type.value
            if hasattr(provider.provider_type, "value")
            else provider.provider_type
        )
        status_value = (
            provider.status.value
            if hasattr(provider.status, "value")
            else provider.status
        )

        api_key_prefix: Optional[str] = None
        if provider.api_key:
            api_key_prefix = provider.api_key[:4] if len(provider.api_key) > 4 else provider.api_key

        return AIAssistantProviderResponse(
            id=provider.id,
            user_id=provider.user_id,
            provider_type=provider_type_value,
            name=provider.name,
            status=status_value,
            api_key_prefix=api_key_prefix,
            api_base_url=provider.api_base_url,
            model_name=provider.model_name,
            organization=provider.organization,
            project=provider.project,
            config_json=provider.config_json or {},
            is_default=getattr(provider, "is_default", False),
            created_at=provider.created_at,
            updated_at=provider.updated_at,
            last_used_at=provider.last_used_at
        )

    def _pick_fallback_provider(self, user_id: str) -> Optional[AIAssistantProvider]:
        """Select the best available provider when no default is configured"""
        # First try user's own active providers
        user_provider = (
            self.db.query(AIAssistantProvider)
            .filter(
                AIAssistantProvider.user_id == user_id,
                AIAssistantProvider.status == AIAssistantProviderStatus.active
            )
            .order_by(
                AIAssistantProvider.last_used_at.desc(),
                AIAssistantProvider.created_at.asc()
            )
            .first()
        )

        if user_provider:
            return user_provider

        # CRITICAL FIX: If no user providers, fall back to system-wide default providers
        # This ensures all users can access AI Assistant functionality
        logger.info(f"No user providers found for {user_id}, falling back to system-wide providers")

        # Try to find any default provider in the system
        system_default_provider = (
            self.db.query(AIAssistantProvider)
            .filter(
                AIAssistantProvider.is_default == True,
                AIAssistantProvider.status == AIAssistantProviderStatus.active
            )
            .order_by(
                AIAssistantProvider.last_used_at.desc(),
                AIAssistantProvider.created_at.asc()
            )
            .first()
        )

        if system_default_provider:
            return system_default_provider

        # Final fallback: any active provider in the system
        any_active_provider = (
            self.db.query(AIAssistantProvider)
            .filter(
                AIAssistantProvider.status == AIAssistantProviderStatus.active
            )
            .order_by(
                AIAssistantProvider.last_used_at.desc(),
                AIAssistantProvider.created_at.asc()
            )
            .first()
        )

        if any_active_provider:
            logger.info(f"Using system-wide active provider for user {user_id}")
            return any_active_provider

        logger.warning(f"No active providers found in the system for user {user_id}")
        return None

    def _clear_default_provider(self, user_id: str, exclude_id: Optional[str] = None) -> None:
        """Unset the default flag for all providers belonging to the user"""
        query = self.db.query(AIAssistantProvider).filter(
            AIAssistantProvider.user_id == user_id,
        )
        if exclude_id:
            query = query.filter(AIAssistantProvider.id != exclude_id)

        query.update({AIAssistantProvider.is_default: False}, synchronize_session=False)

    def _assign_default_provider(self, user_id: str, provider: AIAssistantProvider) -> None:
        """Mark a provider as default while clearing other defaults for the user"""
        self._clear_default_provider(user_id, exclude_id=provider.id)
        provider.is_default = True

        user = self.db.query(User).filter(User.id == user_id).first()
        if user:
            user.default_ai_provider_id = provider.id
            user.updated_at = datetime.utcnow()

    # Provider Operations
    def get_providers(
        self,
        user_id: str,
        include_all: bool = False,
        tenant_id: Optional[str] = None
    ) -> List[AIAssistantProviderResponse]:
        """Get AI assistant providers, with fallback to shared providers for system-wide access."""
        try:
            base_query = self.db.query(AIAssistantProvider)
            providers: List[AIAssistantProvider] = []

            if include_all:
                # Admin users can see all providers
                query = base_query
                if tenant_id:
                    query = query.join(User, User.id == AIAssistantProvider.user_id).filter(
                        or_(
                            User.organization == tenant_id,
                            User.organization.is_(None),
                            AIAssistantProvider.user_id == user_id
                        )
                    )
                providers = query.order_by(AIAssistantProvider.created_at.desc()).all()
            else:
                # Regular users get their own providers plus shared providers
                # Start with user's own providers
                user_providers = (
                    base_query
                    .filter(AIAssistantProvider.user_id == user_id)
                    .order_by(AIAssistantProvider.created_at.desc())
                    .all()
                )
                providers.extend(user_providers)

                # Add tenant-level shared providers
                if tenant_id:
                    shared_query = (
                        self.db.query(AIAssistantProvider)
                        .join(User, User.id == AIAssistantProvider.user_id)
                        .filter(
                            User.organization == tenant_id,
                            AIAssistantProvider.is_default == True,
                            AIAssistantProvider.status == AIAssistantProviderStatus.active
                        )
                    )
                    shared_providers = shared_query.all()

                    existing_ids = {p.id for p in providers}
                    for provider in shared_providers:
                        if provider.id not in existing_ids:
                            providers.append(provider)
                            existing_ids.add(provider.id)

                # CRITICAL FIX: If no providers found, add system-wide active providers
                # This ensures all users have access to AI Assistant functionality
                if not providers:
                    logger.info(f"No providers found for user {user_id}, falling back to system-wide providers")

                    # Get all active default providers as system-wide fallback
                    system_wide_query = (
                        base_query
                        .filter(
                            AIAssistantProvider.is_default == True,
                            AIAssistantProvider.status == AIAssistantProviderStatus.active
                        )
                        .order_by(AIAssistantProvider.created_at.desc())
                    )
                    system_providers = system_wide_query.all()

                    # If no default providers, get any active providers as final fallback
                    if not system_providers:
                        logger.info(f"No default providers found, using any active providers for user {user_id}")
                        system_wide_query = (
                            base_query
                            .filter(
                                AIAssistantProvider.status == AIAssistantProviderStatus.active
                            )
                            .order_by(AIAssistantProvider.created_at.desc())
                        )
                        system_providers = system_wide_query.all()

                    providers.extend(system_providers)

            logger.info(f"Returning {len(providers)} providers for user {user_id}")
            return [self._format_provider_response(p) for p in providers]
        except Exception as e:
            logger.error(f"Error getting providers for user {user_id}: {str(e)}")
            return []

    def get_provider(
        self,
        provider_id: str,
        user_id: str,
        include_all: bool = False,
        tenant_id: Optional[str] = None
    ) -> Optional[AIAssistantProviderResponse]:
        """Get a specific provider by ID"""
        try:
            query = self.db.query(AIAssistantProvider)

            if include_all:
                query = query.filter(AIAssistantProvider.id == provider_id)
                if tenant_id:
                    query = query.join(User, User.id == AIAssistantProvider.user_id).filter(
                        or_(
                            User.organization == tenant_id,
                            User.organization.is_(None),
                            AIAssistantProvider.user_id == user_id
                        )
                    )
            else:
                query = query.filter(
                    and_(
                        AIAssistantProvider.id == provider_id,
                        AIAssistantProvider.user_id == user_id
                    )
                )

            provider = query.first()

            if not provider:
                return None

            return self._format_provider_response(provider)
        except Exception as e:
            logger.error(f"Error getting provider {provider_id} for user {user_id}: {str(e)}")
            return None

    def get_provider_for_edit(
        self,
        provider_id: str,
        user_id: str,
        include_all: bool = False,
        tenant_id: Optional[str] = None
    ) -> Optional[AIAssistantProviderEditResponse]:
        """Get a specific provider by ID with full API key for editing"""
        try:
            query = self.db.query(AIAssistantProvider)

            if include_all:
                query = query.filter(AIAssistantProvider.id == provider_id)
                if tenant_id:
                    query = query.join(User, User.id == AIAssistantProvider.user_id).filter(
                        or_(
                            User.organization == tenant_id,
                            User.organization.is_(None),
                            AIAssistantProvider.user_id == user_id
                        )
                    )
            else:
                query = query.filter(
                    and_(
                        AIAssistantProvider.id == provider_id,
                        AIAssistantProvider.user_id == user_id
                    )
                )

            provider = query.first()

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
                last_used_at=provider.last_used_at,
                is_default=getattr(provider, "is_default", False)
            )
        except Exception as e:
            logger.error(f"Error getting provider {provider_id} for edit for user {user_id}: {str(e)}")
            return None

    def get_provider_model(
        self,
        provider_id: str,
        user_id: str,
        include_all: bool = False,
        tenant_id: Optional[str] = None
    ) -> Optional[AIAssistantProvider]:
        """Get the raw provider model for internal use"""
        try:
            query = self.db.query(AIAssistantProvider)

            # Always try to find the provider by ID first, especially if include_all is True
            provider = query.filter(AIAssistantProvider.id == provider_id).first()

            if not provider and not include_all:
                # If not found and include_all is False, then it must belong to the user
                provider = query.filter(
                    and_(
                        AIAssistantProvider.id == provider_id,
                        AIAssistantProvider.user_id == user_id
                    )
                ).first()

            if not provider and tenant_id:
                # Fallback: if still not found, and tenant_id is present, try to find it as a default tenant provider
                provider = (
                    self.db.query(AIAssistantProvider)
                    .join(User, User.id == AIAssistantProvider.user_id)
                    .filter(
                        AIAssistantProvider.id == provider_id,
                        User.organization == tenant_id,
                        AIAssistantProvider.is_default == True,
                        AIAssistantProvider.status == AIAssistantProviderStatus.active
                    )
                    .first()
                )

            if not provider:
                logger.warning(
                    "Provider not found in get_provider_model",
                    provider_id=provider_id,
                    user_id=user_id,
                    include_all=include_all,
                    tenant_id=tenant_id
                )
            return provider
        except Exception as e:
            logger.error(
                "Error getting provider model",
                provider_id=provider_id,
                user_id=user_id,
                include_all=include_all,
                tenant_id=tenant_id,
                error=str(e),
                exc_info=True # Add exc_info for full traceback
            )
            return None

    def create_provider(self, user_id: str, provider_data: AIAssistantProviderCreate) -> AIAssistantProviderResponse:
        """Create a new AI assistant provider"""
        try:
            user = self.db.query(User).filter(User.id == user_id).first()
            if not user:
                raise ValueError("User not found")

            existing_default = self.db.query(AIAssistantProvider).filter(
                AIAssistantProvider.user_id == user_id,
                AIAssistantProvider.is_default == True
            ).first()

            should_set_default = bool(getattr(provider_data, "is_default", False)) or existing_default is None

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
                config_json=provider_data.config_json or {},
                is_default=False
            )

            self.db.add(provider)

            if should_set_default:
                self._clear_default_provider(user_id)
                provider.is_default = True
                user.default_ai_provider_id = provider_id
                user.updated_at = datetime.utcnow()

            self.db.commit()
            self.db.refresh(provider)

            return self._format_provider_response(provider)
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error creating provider for user {user_id}: {str(e)}")
            raise e

    def update_provider(
        self,
        provider_id: str,
        user_id: str,
        update_data: AIAssistantProviderUpdate,
        include_all: bool = False,
        tenant_id: Optional[str] = None
    ) -> Optional[AIAssistantProviderResponse]:
        """Update an existing provider"""
        try:
            query = self.db.query(AIAssistantProvider)

            if include_all:
                query = query.filter(AIAssistantProvider.id == provider_id)
                if tenant_id:
                    query = query.join(User, User.id == AIAssistantProvider.user_id).filter(
                        or_(
                            User.organization == tenant_id,
                            User.organization.is_(None),
                            AIAssistantProvider.user_id == user_id
                        )
                    )
            else:
                query = query.filter(
                    and_(
                        AIAssistantProvider.id == provider_id,
                        AIAssistantProvider.user_id == user_id
                    )
                )

            provider = query.first()

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
            if update_data.status is not None:
                provider.status = update_data.status
            if update_data.is_default is not None:
                target_user_id = provider.user_id
                if update_data.is_default:
                    self._assign_default_provider(target_user_id, provider)
                else:
                    provider.is_default = False
                    user = self.db.query(User).filter(User.id == target_user_id).first()
                    if user and user.default_ai_provider_id == provider.id:
                        user.default_ai_provider_id = None
                        user.updated_at = datetime.utcnow()

            provider.updated_at = datetime.utcnow()
            self.db.commit()
            self.db.refresh(provider)

            return self._format_provider_response(provider)
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error updating provider {provider_id} for user {user_id}: {str(e)}")
            return None

    def delete_provider(
        self,
        provider_id: str,
        user_id: str,
        include_all: bool = False,
        tenant_id: Optional[str] = None
    ) -> bool:
        """Delete a provider (hard delete from database)"""
        try:
            query = self.db.query(AIAssistantProvider)

            if include_all:
                query = query.filter(AIAssistantProvider.id == provider_id)
                if tenant_id:
                    query = query.join(User, User.id == AIAssistantProvider.user_id).filter(
                        or_(
                            User.organization == tenant_id,
                            User.organization.is_(None),
                            AIAssistantProvider.user_id == user_id
                        )
                    )
            else:
                query = query.filter(
                    and_(
                        AIAssistantProvider.id == provider_id,
                        AIAssistantProvider.user_id == user_id
                    )
                )

            provider = query.first()

            if not provider:
                return False

            was_default = getattr(provider, "is_default", False)

            # Hard delete - remove from database completely
            self.db.delete(provider)
            self.db.commit()

            if was_default:
                fallback = self._pick_fallback_provider(provider.user_id)
                if fallback:
                    self._assign_default_provider(provider.user_id, fallback)
                    self.db.commit()
            return True
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error deleting provider {provider_id} for user {user_id}: {str(e)}")
            return False

    def test_provider(
        self,
        provider_id: str,
        user_id: str,
        test_request: AIAssistantProviderTestRequest,
        include_all: bool = False,
        tenant_id: Optional[str] = None
    ) -> Optional[AIAssistantProviderTestResponse]:
        """Test an AI provider configuration with a simple API call"""
        try:
            # Get provider
            query = self.db.query(AIAssistantProvider)

            if include_all:
                query = query.filter(AIAssistantProvider.id == provider_id)
                if tenant_id:
                    query = query.join(User, User.id == AIAssistantProvider.user_id).filter(
                        or_(
                            User.organization == tenant_id,
                            User.organization.is_(None),
                            AIAssistantProvider.user_id == user_id
                        )
                    )
            else:
                query = query.filter(
                    and_(
                        AIAssistantProvider.id == provider_id,
                        AIAssistantProvider.user_id == user_id
                    )
                )

            provider = query.first()

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
            logger.error(f"Error testing provider {provider_id} for user {user_id}: {str(e)}")
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

            # Use provided model or default from configuration
            model = provider.model_name or settings.default_openai_model

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

            # Use provided model or default from configuration
            model = provider.model_name or settings.default_anthropic_model

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

            # Use provided model or default from configuration
            model = provider.model_name or settings.default_gemini_model

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
                    "model": provider.model_name or settings.default_openrouter_model,
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
                        "model": provider.model_name or settings.default_generic_model
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
                            "model": provider.model_name or settings.default_generic_model,
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
                            "model": provider.model_name or settings.default_generic_model,
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
    def get_system_prompt_by_type(self, user_id: str, prompt_type: str) -> Optional[AIAssistantSystemPrompt]:
        """Get a specific system prompt by type for the user"""
        try:
            system_prompt = self.db.query(AIAssistantSystemPrompt).join(
                AIAssistantProvider, AIAssistantSystemPrompt.provider_id == AIAssistantProvider.id
            ).filter(
                AIAssistantProvider.user_id == user_id,
                AIAssistantSystemPrompt.prompt_type == prompt_type,
                AIAssistantSystemPrompt.is_active == True
            ).first()

            return system_prompt
        except Exception as e:
            logger.error(f"Failed to get system prompt by type {prompt_type} for user {user_id}: {str(e)}")
            return None

    def get_system_prompt_for_provider(self, provider_id: str, prompt_type: str) -> Optional[AIAssistantSystemPrompt]:
        """Get the active system prompt for a specific provider"""
        try:
            system_prompt = (
                self.db.query(AIAssistantSystemPrompt)
                .filter(
                    AIAssistantSystemPrompt.provider_id == provider_id,
                    AIAssistantSystemPrompt.prompt_type == prompt_type,
                    AIAssistantSystemPrompt.is_active == True
                )
                .order_by(AIAssistantSystemPrompt.updated_at.desc())
                .first()
            )

            return system_prompt
        except Exception as e:
            logger.error(
                "Failed to get system prompt for provider",
                error=str(e),
                provider_id=provider_id,
                prompt_type=prompt_type,
            )
            return None

    def get_system_prompts(
        self,
        user_id: str,
        include_all: bool = False,
        tenant_id: Optional[str] = None
    ) -> List[AIAssistantSystemPromptResponse]:
        """Get all system prompts for the user's providers"""
        try:
            query = self.db.query(AIAssistantSystemPrompt).join(
                AIAssistantProvider,
                AIAssistantSystemPrompt.provider_id == AIAssistantProvider.id
            )

            if include_all:
                # Admin users can see all system prompts, no filtering needed
                pass
            else:
                # Regular users can only see system prompts from their own providers
                query = query.filter(AIAssistantProvider.user_id == user_id)

            prompts = query.filter(
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
            logger.error(f"Error getting system prompts for user {user_id}: {str(e)}")
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
            logger.error(f"Error creating system prompt for user {user_id}: {str(e)}")
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
            logger.error(f"Error updating system prompt {prompt_id} for user {user_id}: {str(e)}")
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
            logger.error(f"Error deleting system prompt {prompt_id} for user {user_id}: {str(e)}")
            return False

    # Default Provider Management
    def get_default_provider(self, user_id: str) -> Optional[AIAssistantProviderResponse]:
        """Get the user's default AI provider"""
        try:
            # Refresh User table metadata to ensure we see the latest schema
            self._refresh_user_table_metadata()

            user = self.db.query(User).filter(User.id == user_id).first()
            if not user:
                return None

            provider = self.db.query(AIAssistantProvider).filter(
                AIAssistantProvider.user_id == user_id,
                AIAssistantProvider.is_default == True,
                AIAssistantProvider.status == AIAssistantProviderStatus.active
            ).first()

            if not provider and user.default_ai_provider_id:
                provider = self.db.query(AIAssistantProvider).filter(
                    AIAssistantProvider.id == user.default_ai_provider_id,
                    AIAssistantProvider.user_id == user_id,
                    AIAssistantProvider.status == AIAssistantProviderStatus.active
                ).first()
                if provider:
                    try:
                        self._assign_default_provider(user_id, provider)
                        self.db.commit()
                        self.db.refresh(provider)
                    except Exception as commit_error:
                        self.db.rollback()
                        logger.warning(
                            "Failed to persist stored default provider",
                            user_id=user_id,
                            provider_id=provider.id,
                            error=str(commit_error)
                        )
                        provider = None

            if not provider:
                provider = self._pick_fallback_provider(user_id)
                if provider:
                    try:
                        self._assign_default_provider(user_id, provider)
                        self.db.commit()
                        self.db.refresh(provider)
                    except Exception as commit_error:
                        self.db.rollback()
                        logger.warning(
                            "Failed to persist fallback default provider",
                            user_id=user_id,
                            provider_id=provider.id,
                            error=str(commit_error)
                        )
                        provider = None

            if not provider:
                return None

            return self._format_provider_response(provider)
        except Exception as e:
            logger.error(f"Error getting default provider for user {user_id}: {str(e)}", exc_info=True)
            return None

    def set_default_provider(
        self,
        user_id: str,
        provider_id: str,
        include_all: bool = False,
        tenant_id: Optional[str] = None
    ) -> AIAssistantProviderResponse:
        """Set the user's default AI provider"""
        try:
            # Refresh User table metadata to ensure we see the latest schema
            self._refresh_user_table_metadata()

            # Verify the provider exists and belongs to the user
            provider = self.get_provider(
                provider_id=provider_id,
                user_id=user_id,
                include_all=include_all,
                tenant_id=tenant_id
            )
            if not provider or provider.status != AIAssistantProviderStatus.active:
                raise ValueError("Provider not found or not accessible")

            provider_model = self.db.query(AIAssistantProvider).filter(
                AIAssistantProvider.id == provider.id
            ).first()

            if not provider_model:
                raise ValueError("Provider not found")


            # Update the user's default provider
            user = self.db.query(User).filter(User.id == user_id).first()
            if not user:
                raise ValueError("User not found")

            target_user_id = provider_model.user_id if include_all else user_id
            self._assign_default_provider(target_user_id, provider_model)
            self.db.commit()

            self.db.refresh(provider_model)

            return self._format_provider_response(provider_model)
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error setting default provider {provider_id} for user {user_id}: {str(e)}")
            raise

    def clear_default_provider(self, user_id: str) -> None:
        """Clear the user's default AI provider"""
        try:
            # Refresh User table metadata to ensure we see the latest schema
            self._refresh_user_table_metadata()

            user = self.db.query(User).filter(User.id == user_id).first()
            if not user:
                raise ValueError("User not found")

            self._clear_default_provider(user_id)
            user.default_ai_provider_id = None
            user.updated_at = datetime.utcnow()
            self.db.commit()
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error clearing default provider for user {user_id}: {str(e)}")
            raise

    # Health Check
    async def generate_prompt(
        self,
        provider_id: str,
        user_id: str,
        description: str,
        module_info: str = "",
        requirements: str = "",
        *,
        system_prompt_content: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate a prompt using the configured AI provider"""
        try:
            # Get the provider
            provider = self.get_provider_model(provider_id, user_id)
            if not provider:
                raise ValueError(f"Provider {provider_id} not found")

            # Create the prompt for the AI provider
            base_instructions = (
                system_prompt_content.strip()
                if system_prompt_content and system_prompt_content.strip()
                else DEFAULT_PROMPT_INSTRUCTIONS
            )

            ai_prompt = (
                f"{base_instructions}\n\n"
                f"Description: {description}\n"
                f"Module Info: {module_info}\n"
                f"Requirements: {requirements}"
            )

            # Call the appropriate AI provider based on provider type
            if provider.provider_type == "anthropic":
                return await self._generate_with_anthropic(provider, ai_prompt)
            elif provider.provider_type == "openai":
                return await self._generate_with_openai(provider, ai_prompt)
            elif provider.provider_type == "openrouter":
                return await self._generate_with_openrouter(provider, ai_prompt)
            else:
                # Fallback to generic generation
                return await self._generate_with_generic(provider, ai_prompt)

        except Exception as e:
            logger.error(f"Failed to generate prompt for provider {provider_id} user {user_id}: {str(e)}")
            raise

    async def _generate_with_anthropic(self, provider: AIAssistantProvider, prompt: str) -> Dict[str, Any]:
        """Generate prompt using Anthropic provider"""
        try:
            import aiohttp

            headers = {
                "Content-Type": "application/json",
                "x-api-key": provider.api_key,
                "anthropic-version": "2023-06-01"
            }

            payload = {
                "model": provider.model_name or settings.default_anthropic_model,
                "max_tokens": 2000,
                "messages": [
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            }

            api_base_url = provider.api_base_url or "https://api.anthropic.com"

            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{api_base_url}/v1/messages",
                    headers=headers,
                    json=payload
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        return {
                            "success": True,
                            "generated_content": result["content"][0]["text"],
                            "provider_id": provider.id,
                            "provider_type": provider.provider_type
                        }
                    else:
                        error_text = await response.text()
                        logger.error(f"Anthropic API error: status {response.status}, error {error_text}")
                        raise Exception(f"Anthropic API error: {response.status}")
        except Exception as e:
            logger.error(f"Anthropic generation failed: {str(e)}")
            raise

    async def _generate_with_openai(self, provider: AIAssistantProvider, prompt: str) -> Dict[str, Any]:
        """Generate prompt using OpenAI provider"""
        try:
            import aiohttp

            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {provider.api_key}"
            }

            payload = {
                "model": provider.model_name or settings.default_openai_model,
                "messages": [
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                "max_tokens": 2000
            }

            api_base_url = provider.api_base_url or "https://api.openai.com"

            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{api_base_url}/v1/chat/completions",
                    headers=headers,
                    json=payload
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        return {
                            "success": True,
                            "generated_content": result["choices"][0]["message"]["content"],
                            "provider_id": provider.id,
                            "provider_type": provider.provider_type
                        }
                    else:
                        error_text = await response.text()
                        logger.error(f"OpenAI API error: status {response.status}, error {error_text}")
                        raise Exception(f"OpenAI API error: {response.status}")
        except Exception as e:
            logger.error(f"OpenAI generation failed: {str(e)}")
            raise

    async def _generate_with_openrouter(self, provider: AIAssistantProvider, prompt: str) -> Dict[str, Any]:
        """Generate prompt using OpenRouter provider"""
        try:
            import aiohttp

            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {provider.api_key}"
            }

            payload = {
                "model": provider.model_name or settings.default_openrouter_model,
                "messages": [
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                "max_tokens": 2000
            }

            api_base_url = provider.api_base_url or "https://openrouter.ai/api"

            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{api_base_url}/v1/chat/completions",
                    headers=headers,
                    json=payload
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        return {
                            "success": True,
                            "generated_content": result["choices"][0]["message"]["content"],
                            "provider_id": provider.id,
                            "provider_type": provider.provider_type
                        }
                    else:
                        error_text = await response.text()
                        logger.error(f"OpenRouter API error: status {response.status}, error {error_text}")
                        raise Exception(f"OpenRouter API error: {response.status}")
        except Exception as e:
            logger.error(f"OpenRouter generation failed: {str(e)}")
            raise

    async def _generate_with_generic(self, provider: AIAssistantProvider, prompt: str) -> Dict[str, Any]:
        """Generate prompt using generic JSON-RPC style provider"""
        try:
            import aiohttp

            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {provider.api_key}"
            }

            payload = {
                "jsonrpc": "2.0",
                "method": "generate",
                "params": {
                    "prompt": prompt,
                    "max_tokens": 2000
                },
                "id": 1
            }

            api_base_url = provider.api_base_url

            if not api_base_url:
                raise Exception("No API base URL configured for generic provider")

            async with aiohttp.ClientSession() as session:
                async with session.post(
                    api_base_url,
                    headers=headers,
                    json=payload
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        return {
                            "success": True,
                            "generated_content": result.get("result", {}).get("text", ""),
                            "provider_id": provider.id,
                            "provider_type": provider.provider_type
                        }
                    else:
                        error_text = await response.text()
                        logger.error(f"Generic API error: status {response.status}, error {error_text}")
                        raise Exception(f"Generic API error: {response.status}")
        except Exception as e:
            logger.error(f"Generic generation failed: {str(e)}")
            raise

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
            logger.error(f"Health check failed: {str(e)}")
            return {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
