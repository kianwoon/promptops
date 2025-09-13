"""
Prompt manager for PromptOps client operations
"""

import re
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple, Union

import httpx
import structlog
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from .exceptions import (
    PromptNotFoundError,
    ValidationError,
    PromptRenderingError,
    ModelCompatibilityError,
    NetworkError,
    ServerError
)
from .models import (
    PromptResponse,
    ModelSpecificPrompt,
    RenderRequest,
    RenderResponse,
    PromptVariables,
    ModelProvider,
    Message
)
from .auth import AuthenticationManager
from .cache import CacheManager
from .telemetry import TelemetryManager

logger = structlog.get_logger(__name__)


class PromptManager:
    """Manages prompt operations for PromptOps client"""

    def __init__(
        self,
        auth_manager: AuthenticationManager,
        cache_manager: CacheManager,
        telemetry_manager: TelemetryManager,
        base_url: str,
        timeout: float
    ):
        self.auth_manager = auth_manager
        self.cache_manager = cache_manager
        self.telemetry_manager = telemetry_manager
        self.base_url = base_url
        self.timeout = timeout
        self._client = httpx.AsyncClient(timeout=timeout)

    async def get_prompt(
        self,
        prompt_id: str,
        version: Optional[str] = None,
        project_id: Optional[str] = None,
        use_cache: bool = True
    ) -> PromptResponse:
        """
        Get a prompt by ID and version

        Args:
            prompt_id: Prompt ID
            version: Prompt version (if None, gets latest version)
            project_id: Project ID for access control (optional)
            use_cache: Whether to use cache

        Returns:
            Prompt response

        Raises:
            PromptNotFoundError: If prompt not found
            NetworkError: If network request fails
            ServerError: If server error occurs
        """
        cache_key = f"prompt:{prompt_id}:{version or 'latest'}:{project_id or 'all'}"
        start_time = time.time()

        # Try cache first
        if use_cache and self.cache_manager.is_enabled():
            cached_prompt = await self.cache_manager.get(cache_key)
            if cached_prompt:
                logger.debug("Prompt cache hit", prompt_id=prompt_id, version=version)
                self.telemetry_manager.track_cache_hit("memory", cache_key)
                return cached_prompt
            else:
                self.telemetry_manager.track_cache_miss("memory", cache_key)

        # Make API request
        try:
            if version:
                endpoint = f"/api/prompts/{prompt_id}/{version}"
            else:
                endpoint = f"/api/prompts/{prompt_id}"

            params = {}
            if project_id:
                params["project_id"] = project_id

            headers = await self.auth_manager.get_auth_headers(endpoint, "GET")
            response = await self._client.get(
                f"{self.base_url}{endpoint}",
                headers=headers,
                params=params if params else None
            )

            if response.status_code == 404:
                raise PromptNotFoundError(f"Prompt not found: {prompt_id}@{version}")
            elif response.status_code >= 500:
                raise ServerError(f"Server error: {response.status_code}")
            elif response.status_code >= 400:
                raise ValidationError(f"Validation error: {response.text}")

            prompt_data = response.json()
            prompt = PromptResponse(**prompt_data)

            # Cache the result
            if use_cache and self.cache_manager.is_enabled():
                await self.cache_manager.set(cache_key, prompt)

            duration = time.time() - start_time
            self.telemetry_manager.track_request(
                endpoint, "GET", duration, response.status_code
            )

            logger.info("Prompt retrieved successfully", prompt_id=prompt_id, version=version)
            return prompt

        except httpx.RequestError as e:
            duration = time.time() - start_time
            self.telemetry_manager.track_request(
                endpoint, "GET", duration, 0, str(e)
            )
            raise NetworkError(f"Network error: {str(e)}")
        except Exception as e:
            duration = time.time() - start_time
            self.telemetry_manager.track_request(
                endpoint, "GET", duration, 0, str(e)
            )
            raise

    async def render_prompt(
        self,
        request: RenderRequest,
        use_cache: bool = True
    ) -> RenderResponse:
        """
        Render a prompt with variables

        Args:
            request: Render request
            use_cache: Whether to use cache

        Returns:
            Rendered prompt response

        Raises:
            PromptNotFoundError: If prompt not found
            ValidationError: If validation fails
            PromptRenderingError: If rendering fails
        """
        cache_key = f"render:{request.prompt_id}:{request.version or 'latest'}:{hash(str(request.variables))}"
        start_time = time.time()

        # Try cache first
        if use_cache and self.cache_manager.is_enabled():
            cached_response = await self.cache_manager.get(cache_key)
            if cached_response:
                logger.debug("Render cache hit", prompt_id=request.prompt_id)
                self.telemetry_manager.track_cache_hit("memory", cache_key)
                return cached_response
            else:
                self.telemetry_manager.track_cache_miss("memory", cache_key)

        # Get the prompt first
        prompt = await self.get_prompt(request.prompt_id, request.version, use_cache)

        # Select appropriate model-specific prompt
        model_prompt = self._select_model_prompt(prompt, request.model_provider, request.model_name)

        # Render the prompt with variables
        try:
            rendered_content = self._render_content(model_prompt.content, request.variables)
            messages = self._create_messages(rendered_content)

            response = RenderResponse(
                messages=messages,
                rendered_content=rendered_content,
                prompt_id=prompt.id,
                version=prompt.version,
                variables_used=request.variables.variables,
                applied_policies=[],  # TODO: Implement policy application
                cache_key=cache_key if use_cache else None,
                cached=False
            )

            # Cache the result
            if use_cache and self.cache_manager.is_enabled():
                await self.cache_manager.set(cache_key, response)

            duration = time.time() - start_time
            self.telemetry_manager.track_prompt_usage(
                prompt.id, prompt.version,
                request.model_provider or prompt.target_models[0],
                request.model_name or "default",
                duration
            )

            logger.info("Prompt rendered successfully", prompt_id=prompt.id, version=prompt.version)
            return response

        except Exception as e:
            duration = time.time() - start_time
            self.telemetry_manager.track_error("prompt_rendering", str(e), {
                "prompt_id": request.prompt_id,
                "version": request.version
            })
            raise PromptRenderingError(f"Prompt rendering failed: {str(e)}")

    def _select_model_prompt(
        self,
        prompt: PromptResponse,
        model_provider: Optional[ModelProvider] = None,
        model_name: Optional[str] = None
    ) -> ModelSpecificPrompt:
        """Select the appropriate model-specific prompt"""
        if model_provider and model_name:
            # Try to find exact match
            for mp in prompt.model_specific_prompts:
                if mp.model_provider == model_provider and mp.model_name == model_name:
                    return mp

        # Try to find match by provider only
        if model_provider:
            for mp in prompt.model_specific_prompts:
                if mp.model_provider == model_provider:
                    return mp

        # Use first available prompt
        if prompt.model_specific_prompts:
            return prompt.model_specific_prompts[0]

        # Fallback to main content
        return ModelSpecificPrompt(
            model_provider=ModelProvider.OPENAI,
            model_name="gpt-3.5-turbo",
            content=prompt.content
        )

    def _render_content(self, content: str, variables: PromptVariables) -> str:
        """Render content with variable substitution"""
        try:
            # Simple variable substitution
            for key, value in variables.variables.items():
                placeholder = f"{{{key}}}"
                if placeholder in content:
                    content = content.replace(placeholder, str(value))

            # Validate that all variables were substituted
            remaining_vars = re.findall(r'\{([^}]+)\}', content)
            if remaining_vars:
                missing_vars = [var for var in remaining_vars if var not in variables.variables]
                if missing_vars:
                    raise ValidationError(f"Missing required variables: {missing_vars}")

            return content

        except Exception as e:
            raise PromptRenderingError(f"Content rendering failed: {str(e)}")

    def _create_messages(self, content: str) -> List[Message]:
        """Create message list from content"""
        # Simple implementation - create single user message
        # In a more sophisticated implementation, this could parse structured content
        return [Message(role="user", content=content)]

    async def list_prompts(
        self,
        module_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
        use_cache: bool = True
    ) -> List[PromptResponse]:
        """
        List prompts

        Args:
            module_id: Filter by module ID
            skip: Number of items to skip
            limit: Maximum number of items to return
            use_cache: Whether to use cache

        Returns:
            List of prompts
        """
        cache_key = f"prompts:list:{module_id}:{skip}:{limit}"
        start_time = time.time()

        # Try cache first
        if use_cache and self.cache_manager.is_enabled():
            cached_prompts = await self.cache_manager.get(cache_key)
            if cached_prompts:
                logger.debug("Prompt list cache hit", module_id=module_id)
                self.telemetry_manager.track_cache_hit("memory", cache_key)
                return cached_prompts
            else:
                self.telemetry_manager.track_cache_miss("memory", cache_key)

        # Make API request
        try:
            endpoint = "/api/prompts/"
            params = {"skip": skip, "limit": limit}
            if module_id:
                params["module_id"] = module_id

            headers = await self.auth_manager.get_auth_headers(endpoint, "GET", str(params))
            response = await self._client.get(
                f"{self.base_url}{endpoint}",
                headers=headers,
                params=params
            )

            if response.status_code >= 500:
                raise ServerError(f"Server error: {response.status_code}")
            elif response.status_code >= 400:
                raise ValidationError(f"Validation error: {response.text}")

            prompts_data = response.json()
            prompts = [PromptResponse(**prompt_data) for prompt_data in prompts_data]

            # Cache the result
            if use_cache and self.cache_manager.is_enabled():
                await self.cache_manager.set(cache_key, prompts)

            duration = time.time() - start_time
            self.telemetry_manager.track_request(
                endpoint, "GET", duration, response.status_code
            )

            logger.info("Prompt list retrieved successfully", count=len(prompts))
            return prompts

        except httpx.RequestError as e:
            duration = time.time() - start_time
            self.telemetry_manager.track_request(
                endpoint, "GET", duration, 0, str(e)
            )
            raise NetworkError(f"Network error: {str(e)}")
        except Exception as e:
            duration = time.time() - start_time
            self.telemetry_manager.track_request(
                endpoint, "GET", duration, 0, str(e)
            )
            raise

    async def create_prompt(self, prompt_data: Dict[str, Any]) -> PromptResponse:
        """
        Create a new prompt

        Args:
            prompt_data: Prompt creation data

        Returns:
            Created prompt
        """
        start_time = time.time()
        endpoint = "/api/prompts/"

        try:
            headers = await self.auth_manager.get_auth_headers(endpoint, "POST", str(prompt_data))
            response = await self._client.post(
                f"{self.base_url}{endpoint}",
                headers=headers,
                json=prompt_data
            )

            if response.status_code >= 500:
                raise ServerError(f"Server error: {response.status_code}")
            elif response.status_code >= 400:
                raise ValidationError(f"Validation error: {response.text}")

            prompt_data = response.json()
            prompt = PromptResponse(**prompt_data)

            # Clear cache
            await self.cache_manager.clear()

            duration = time.time() - start_time
            self.telemetry_manager.track_request(
                endpoint, "POST", duration, response.status_code
            )

            logger.info("Prompt created successfully", prompt_id=prompt.id, version=prompt.version)
            return prompt

        except httpx.RequestError as e:
            duration = time.time() - start_time
            self.telemetry_manager.track_request(
                endpoint, "POST", duration, 0, str(e)
            )
            raise NetworkError(f"Network error: {str(e)}")
        except Exception as e:
            duration = time.time() - start_time
            self.telemetry_manager.track_request(
                endpoint, "POST", duration, 0, str(e)
            )
            raise

    async def delete_prompt(self, prompt_id: str, version: str) -> bool:
        """
        Delete a prompt version

        Args:
            prompt_id: Prompt ID
            version: Prompt version

        Returns:
            True if deleted successfully
        """
        start_time = time.time()
        endpoint = f"/api/prompts/{prompt_id}/{version}"

        try:
            headers = await self.auth_manager.get_auth_headers(endpoint, "DELETE")
            response = await self._client.delete(f"{self.base_url}{endpoint}", headers=headers)

            if response.status_code == 404:
                raise PromptNotFoundError(f"Prompt not found: {prompt_id}@{version}")
            elif response.status_code >= 500:
                raise ServerError(f"Server error: {response.status_code}")
            elif response.status_code >= 400:
                raise ValidationError(f"Validation error: {response.text}")

            # Clear cache
            await self.cache_manager.clear()

            duration = time.time() - start_time
            self.telemetry_manager.track_request(
                endpoint, "DELETE", duration, response.status_code
            )

            logger.info("Prompt deleted successfully", prompt_id=prompt_id, version=version)
            return True

        except httpx.RequestError as e:
            duration = time.time() - start_time
            self.telemetry_manager.track_request(
                endpoint, "DELETE", duration, 0, str(e)
            )
            raise NetworkError(f"Network error: {str(e)}")
        except Exception as e:
            duration = time.time() - start_time
            self.telemetry_manager.track_request(
                endpoint, "DELETE", duration, 0, str(e)
            )
            raise

    async def close(self) -> None:
        """Close the HTTP client"""
        await self._client.aclose()