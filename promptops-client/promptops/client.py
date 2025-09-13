"""
Main PromptOps client class
"""

import asyncio
from datetime import datetime
from typing import Any, Dict, List, Optional, Union

import structlog

from .auth import AuthenticationManager
from .cache import CacheManager
from .exceptions import PromptOpsError, ConfigurationError, AuthenticationError
from .models import (
    ClientConfig,
    PromptResponse,
    RenderRequest,
    RenderResponse,
    PromptVariables,
    ModelProvider,
    CacheLevel,
    ClientStats
)
from .prompts import PromptManager
from .telemetry import TelemetryManager

logger = structlog.get_logger(__name__)


class PromptOpsClient:
    """Main client for interacting with PromptOps API"""

    def __init__(self, config: ClientConfig):
        """
        Initialize PromptOps client

        Args:
            config: Client configuration
        """
        self.config = config
        self._initialized = False
        self._closed = False
        self._stats = ClientStats()

        # Initialize managers
        self.auth_manager = AuthenticationManager(config)
        self.cache_manager = CacheManager(config.cache)
        self.telemetry_manager = TelemetryManager(config.telemetry)
        self.prompt_manager = PromptManager(
            self.auth_manager,
            self.cache_manager,
            self.telemetry_manager,
            config.base_url,
            config.timeout
        )

    async def initialize(self) -> None:
        """Initialize the client"""
        if self._initialized:
            return

        try:
            # Validate configuration
            self._validate_config()

            # Test authentication
            await self.auth_manager.test_connection()

            # Set up telemetry
            self.telemetry_manager.set_user_id("user")  # TODO: Get from config/auth

            self._initialized = True
            logger.info("PromptOps client initialized successfully")

        except Exception as e:
            logger.error("Client initialization failed", error=str(e))
            raise PromptOpsError(f"Initialization failed: {str(e)}")

    def _validate_config(self) -> None:
        """Validate client configuration"""
        if not self.config.base_url:
            raise ConfigurationError("Base URL is required")

        if not self.config.api_key:
            raise ConfigurationError("API key is required")

        if self.config.timeout <= 0:
            raise ConfigurationError("Timeout must be positive")

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
            PromptOpsError: If operation fails
        """
        self._ensure_initialized()
        start_time = datetime.utcnow()

        try:
            result = await self.prompt_manager.get_prompt(prompt_id, version, project_id, use_cache)

            # Update stats
            self._stats.total_requests += 1
            self._stats.successful_requests += 1
            self._stats.last_request_time = datetime.utcnow()

            # Track telemetry
            duration = (datetime.utcnow() - start_time).total_seconds()
            self.telemetry_manager.track_user_action("get_prompt", {
                "prompt_id": prompt_id,
                "version": version,
                "project_id": project_id,
                "use_cache": use_cache
            })

            return result

        except Exception as e:
            self._stats.total_requests += 1
            self._stats.failed_requests += 1
            self.telemetry_manager.track_error("get_prompt", str(e), {
                "prompt_id": prompt_id,
                "version": version,
                "project_id": project_id
            })
            raise

    async def render_prompt(
        self,
        prompt_id: str,
        variables: Union[Dict[str, Any], PromptVariables],
        version: Optional[str] = None,
        model_provider: Optional[ModelProvider] = None,
        model_name: Optional[str] = None,
        use_cache: bool = True
    ) -> RenderResponse:
        """
        Render a prompt with variables

        Args:
            prompt_id: Prompt ID
            variables: Variables for substitution
            version: Prompt version (if None, gets latest version)
            model_provider: Target model provider
            model_name: Target model name
            use_cache: Whether to use cache

        Returns:
            Rendered prompt response

        Raises:
            PromptOpsError: If operation fails
        """
        self._ensure_initialized()
        start_time = datetime.utcnow()

        try:
            # Convert variables to PromptVariables if needed
            if isinstance(variables, dict):
                variables = PromptVariables(variables=variables)

            request = RenderRequest(
                prompt_id=prompt_id,
                version=version,
                variables=variables,
                model_provider=model_provider,
                model_name=model_name
            )

            result = await self.prompt_manager.render_prompt(request, use_cache)

            # Update stats
            self._stats.total_requests += 1
            self._stats.successful_requests += 1
            self._stats.last_request_time = datetime.utcnow()

            # Track telemetry
            duration = (datetime.utcnow() - start_time).total_seconds()
            self.telemetry_manager.track_user_action("render_prompt", {
                "prompt_id": prompt_id,
                "version": version,
                "model_provider": model_provider,
                "model_name": model_name,
                "use_cache": use_cache,
                "duration_ms": duration * 1000
            })

            return result

        except Exception as e:
            self._stats.total_requests += 1
            self._stats.failed_requests += 1
            self.telemetry_manager.track_error("render_prompt", str(e), {
                "prompt_id": prompt_id,
                "version": version,
                "model_provider": model_provider,
                "model_name": model_name
            })
            raise

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

        Raises:
            PromptOpsError: If operation fails
        """
        self._ensure_initialized()
        start_time = datetime.utcnow()

        try:
            result = await self.prompt_manager.list_prompts(module_id, skip, limit, use_cache)

            # Update stats
            self._stats.total_requests += 1
            self._stats.successful_requests += 1
            self._stats.last_request_time = datetime.utcnow()

            # Track telemetry
            duration = (datetime.utcnow() - start_time).total_seconds()
            self.telemetry_manager.track_user_action("list_prompts", {
                "module_id": module_id,
                "skip": skip,
                "limit": limit,
                "use_cache": use_cache,
                "duration_ms": duration * 1000
            })

            return result

        except Exception as e:
            self._stats.total_requests += 1
            self._stats.failed_requests += 1
            self.telemetry_manager.track_error("list_prompts", str(e), {
                "module_id": module_id,
                "skip": skip,
                "limit": limit
            })
            raise

    async def create_prompt(self, prompt_data: Dict[str, Any]) -> PromptResponse:
        """
        Create a new prompt

        Args:
            prompt_data: Prompt creation data

        Returns:
            Created prompt

        Raises:
            PromptOpsError: If operation fails
        """
        self._ensure_initialized()
        start_time = datetime.utcnow()

        try:
            result = await self.prompt_manager.create_prompt(prompt_data)

            # Update stats
            self._stats.total_requests += 1
            self._stats.successful_requests += 1
            self._stats.last_request_time = datetime.utcnow()

            # Track telemetry
            duration = (datetime.utcnow() - start_time).total_seconds()
            self.telemetry_manager.track_user_action("create_prompt", {
                "prompt_id": result.id,
                "version": result.version,
                "duration_ms": duration * 1000
            })

            return result

        except Exception as e:
            self._stats.total_requests += 1
            self._stats.failed_requests += 1
            self.telemetry_manager.track_error("create_prompt", str(e))
            raise

    async def delete_prompt(self, prompt_id: str, version: str) -> bool:
        """
        Delete a prompt version

        Args:
            prompt_id: Prompt ID
            version: Prompt version

        Returns:
            True if deleted successfully

        Raises:
            PromptOpsError: If operation fails
        """
        self._ensure_initialized()
        start_time = datetime.utcnow()

        try:
            result = await self.prompt_manager.delete_prompt(prompt_id, version)

            # Update stats
            self._stats.total_requests += 1
            self._stats.successful_requests += 1
            self._stats.last_request_time = datetime.utcnow()

            # Track telemetry
            duration = (datetime.utcnow() - start_time).total_seconds()
            self.telemetry_manager.track_user_action("delete_prompt", {
                "prompt_id": prompt_id,
                "version": version,
                "duration_ms": duration * 1000
            })

            return result

        except Exception as e:
            self._stats.total_requests += 1
            self._stats.failed_requests += 1
            self.telemetry_manager.track_error("delete_prompt", str(e), {
                "prompt_id": prompt_id,
                "version": version
            })
            raise

    def get_cache_stats(self) -> Dict[str, Any]:
        """
        Get cache statistics

        Returns:
            Cache statistics
        """
        if not self.cache_manager.is_enabled():
            return {"enabled": False}

        stats = self.cache_manager.get_stats()
        return {
            "enabled": True,
            "level": self.cache_manager.get_cache_level(),
            "hits": stats.hits,
            "misses": stats.misses,
            "hit_rate": stats.hit_rate,
            "size": stats.size,
            "evictions": stats.evictions
        }

    def get_stats(self) -> ClientStats:
        """
        Get client statistics

        Returns:
            Client statistics
        """
        # Update cache stats
        if self.cache_manager.is_enabled():
            self._stats.cache_stats = self.cache_manager.get_stats()

        return self._stats.copy()

    def reset_stats(self) -> None:
        """Reset client statistics"""
        self._stats = ClientStats()
        self.cache_manager.reset_stats()

    def get_telemetry_summary(self) -> Dict[str, Any]:
        """
        Get telemetry summary

        Returns:
            Telemetry summary
        """
        return self.telemetry_manager.get_summary()

    def flush_telemetry(self) -> None:
        """Flush pending telemetry events"""
        self.telemetry_manager.flush()

    def enable_telemetry(self) -> None:
        """Enable telemetry"""
        self.telemetry_manager.enable()

    def disable_telemetry(self) -> None:
        """Disable telemetry"""
        self.telemetry_manager.disable()

    def clear_cache(self) -> None:
        """Clear all cache entries"""
        asyncio.create_task(self.cache_manager.clear())

    def enable_cache(self, level: CacheLevel = CacheLevel.MEMORY) -> None:
        """
        Enable caching

        Args:
            level: Cache level to enable
        """
        self.config.cache.level = level
        logger.info("Cache enabled", level=level)

    def disable_cache(self) -> None:
        """Disable caching"""
        self.config.cache.level = CacheLevel.NONE
        logger.info("Cache disabled")

    async def test_connection(self) -> bool:
        """
        Test connection to PromptOps API

        Returns:
            True if connection is successful

        Raises:
            AuthenticationError: If authentication fails
            NetworkError: If network connection fails
        """
        self._ensure_initialized()
        return await self.auth_manager.test_connection()

    def _ensure_initialized(self) -> None:
        """Ensure client is initialized"""
        if not self._initialized:
            raise PromptOpsError("Client not initialized. Call initialize() first.")

    async def close(self) -> None:
        """Close the client and clean up resources"""
        if self._closed:
            return

        try:
            # Flush telemetry
            self.telemetry_manager.flush()

            # Close HTTP client
            await self.prompt_manager.close()

            self._closed = True
            logger.info("PromptOps client closed successfully")

        except Exception as e:
            logger.error("Error closing client", error=str(e))
            raise PromptOpsError(f"Error closing client: {str(e)}")

    async def __aenter__(self):
        """Async context manager entry"""
        await self.initialize()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.close()

    def __enter__(self):
        """Sync context manager entry (not recommended)"""
        raise RuntimeError("Use async context manager: 'async with PromptOpsClient(...) as client:'")

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Sync context manager exit"""
        pass


async def create_client(
    base_url: str,
    api_key: str,
    timeout: float = 30.0,
    cache_level: CacheLevel = CacheLevel.MEMORY,
    enable_telemetry: bool = True
) -> PromptOpsClient:
    """
    Create and initialize a PromptOps client

    Args:
        base_url: PromptOps API base URL
        api_key: API key for authentication
        timeout: Request timeout in seconds
        cache_level: Cache level
        enable_telemetry: Whether to enable telemetry

    Returns:
        Initialized PromptOps client
    """
    config = ClientConfig(
        base_url=base_url,
        api_key=api_key,
        timeout=timeout,
        cache=type('', (), {'level': cache_level})(),  # Simple config object
        telemetry=type('', (), {'enabled': enable_telemetry})()  # Simple config object
    )

    client = PromptOpsClient(config)
    await client.initialize()
    return client