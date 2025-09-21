"""
Main PromptOps client class
"""

import asyncio
import os
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple, Union

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
    CacheConfig,
    TelemetryConfig,
    ClientStats,
    ABTestingConfig,
    EnvironmentConfig
)
from .prompts import PromptManager
from .telemetry import TelemetryManager
from .ab_testing import ABTestingManager, ABTestPromptRequest, ExperimentContext
from .environment import Environment, create_environment_config, ConnectionManager

logger = structlog.get_logger(__name__)


class PromptOpsClient:
    """Main client for interacting with PromptOps API"""

    def __init__(self, config: ClientConfig):
        """
        Initialize PromptOps client

        Args:
            config: Client configuration
        """
        self.config = self._resolve_config(config)
        self._initialized = False
        self._closed = False
        self._stats = ClientStats()

        # Initialize environment and connection manager
        self.connection_manager = ConnectionManager(
            self.config.environment,
            max_retries=self.config.environment.max_retries,
            base_delay=self.config.environment.retry_delay
        )

        # Initialize managers
        self.auth_manager = AuthenticationManager(self.config)
        self.cache_manager = CacheManager(self.config.cache)
        self.telemetry_manager = TelemetryManager(self.config.telemetry)
        self.prompt_manager = PromptManager(
            self.auth_manager,
            self.cache_manager,
            self.telemetry_manager,
            self.config.base_url,
            self.config.timeout
        )
        self.ab_testing_manager = ABTestingManager(
            self.auth_manager,
            self.cache_manager,
            self.telemetry_manager,
            self.config.base_url,
            self.config.timeout,
            self.config.ab_testing
        )

    def _resolve_config(self, config: ClientConfig) -> ClientConfig:
        """
        Resolve configuration with environment detection and defaults

        Args:
            config: Initial client configuration

        Returns:
            Resolved configuration
        """
        # Create a copy of the config
        resolved_config = config.copy()

        # Get API key from environment if not provided
        if not resolved_config.api_key:
            api_key = os.environ.get('PROMPTOPS_API_KEY')
            if api_key:
                resolved_config.api_key = api_key
                logger.info("Using API key from environment variable")
            else:
                # For development, we can be more lenient
                if self._is_development_environment(resolved_config):
                    logger.warning("No API key provided - some features may not work")
                    resolved_config.api_key = "dev-api-key"
                else:
                    raise ConfigurationError("API key is required. Set PROMPTOPS_API_KEY environment variable or provide in config.")

        # Auto-detect environment if requested
        if resolved_config.auto_detect_environment and not resolved_config.base_url:
            env_config = create_environment_config()
            resolved_config.base_url = env_config.base_url
            resolved_config.environment.environment = env_config.environment.value
            logger.info("Auto-detected environment",
                       environment=env_config.environment.value,
                       base_url=env_config.base_url)

        # Ensure base_url is set
        if not resolved_config.base_url:
            resolved_config.base_url = resolved_config.environment.base_url

        # Apply environment-specific recommendations
        recommendations = resolved_config.environment.get_recommendations()
        if resolved_config.environment.environment == "development":
            # Development-specific optimizations
            if not resolved_config.cache.ttl:
                resolved_config.cache.ttl = int(recommendations["cache_ttl"])
            if not resolved_config.timeout:
                resolved_config.timeout = float(recommendations["timeout"])

        logger.info("Configuration resolved",
                   environment=resolved_config.environment.environment,
                   base_url=resolved_config.base_url,
                   auto_detect=resolved_config.auto_detect_environment)

        return resolved_config

    def _is_development_environment(self, config: ClientConfig) -> bool:
        """Check if this appears to be a development environment"""
        # Check environment variable
        env = os.environ.get('PROMPTOPS_ENVIRONMENT', '').lower()
        if env == 'development':
            return True

        # Check if base URL suggests development
        if config.base_url and ('localhost' in config.base_url or '127.0.0.1' in config.base_url):
            return True

        # Check common development indicators
        if os.environ.get('DEBUG', '').lower() == 'true':
            return True

        return False

    async def initialize(self) -> None:
        """Initialize the client"""
        if self._initialized:
            return

        try:
            # Validate configuration
            self._validate_config()

            # Test connection if enabled
            if self.config.environment.enable_connection_test:
                logger.info("Testing connection to PromptOps API",
                           base_url=self.config.base_url)
                connection_ok = await self.connection_manager.test_connection_with_retry()
                if not connection_ok:
                    if self.config.environment.environment == "development":
                        logger.warning("Connection test failed, but continuing in development mode")
                    else:
                        raise PromptOpsError(f"Failed to connect to {self.config.base_url}")

            # Test authentication
            await self.auth_manager.test_connection()

            # Set up telemetry
            self.telemetry_manager.set_user_id("user")  # TODO: Get from config/auth

            self._initialized = True
            logger.info("PromptOps client initialized successfully",
                       environment=self.config.environment.environment,
                       base_url=self.config.base_url)

        except Exception as e:
            logger.error("Client initialization failed", error=str(e))
            raise PromptOpsError(f"Initialization failed: {str(e)}")

    def _validate_config(self) -> None:
        """Validate client configuration"""
        if not self.config.base_url:
            raise ConfigurationError("Base URL is required")

        if not self.config.api_key and self.config.environment.environment != "development":
            raise ConfigurationError("API key is required")

        if self.config.timeout <= 0:
            raise ConfigurationError("Timeout must be positive")

        # Validate environment configuration
        is_valid, error_msg = self.config.environment.validate()
        if not is_valid:
            raise ConfigurationError(f"Environment configuration invalid: {error_msg}")

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

    def get_environment_info(self) -> Dict[str, Any]:
        """
        Get information about the current environment

        Returns:
            Dictionary with environment information
        """
        return {
            "environment": self.config.environment.environment,
            "base_url": self.config.base_url,
            "auto_detected": self.config.auto_detect_environment,
            "connection_test_enabled": self.config.environment.enable_connection_test,
            "connection_status": self.connection_manager.get_connection_status(),
            "recommendations": self.config.environment.get_recommendations()
        }

    async def test_connection_with_retry(self) -> bool:
        """
        Test connection with retry logic

        Returns:
            True if connection is successful
        """
        return await self.connection_manager.test_connection_with_retry()

    def get_connection_status(self) -> Dict[str, Any]:
        """
        Get current connection status

        Returns:
            Connection status dictionary
        """
        return self.connection_manager.get_connection_status()

    async def health_check(self) -> Dict[str, Any]:
        """
        Perform comprehensive health check

        Returns:
            Health check results
        """
        results = {
            "timestamp": datetime.utcnow().isoformat(),
            "environment": self.config.environment.environment,
            "base_url": self.config.base_url,
            "client_initialized": self._initialized,
            "connection": {},
            "authentication": False,
            "cache": {},
            "overall": False
        }

        # Test connection
        try:
            connection_ok = await self.connection_manager.test_connection_with_retry()
            results["connection"] = {
                "healthy": connection_ok,
                "details": self.connection_manager.get_connection_status()
            }
        except Exception as e:
            results["connection"] = {
                "healthy": False,
                "error": str(e)
            }

        # Test authentication
        try:
            auth_ok = await self.auth_manager.test_connection()
            results["authentication"] = auth_ok
        except Exception as e:
            results["authentication"] = False

        # Test cache
        try:
            if self.cache_manager.is_enabled():
                cache_health = await self.cache_manager.health_check()
                results["cache"] = {
                    "enabled": True,
                    "healthy": cache_health,
                    "stats": self.cache_manager.get_stats().__dict__
                }
            else:
                results["cache"] = {
                    "enabled": False
                }
        except Exception as e:
            results["cache"] = {
                "enabled": True,
                "healthy": False,
                "error": str(e)
            }

        # Overall health
        results["overall"] = (
            results["connection"].get("healthy", False) and
            results["authentication"] and
            (not results["cache"]["enabled"] or results["cache"].get("healthy", True))
        )

        return results

    # ========== A/B Testing Methods ==========

    async def get_prompt_with_variant(
        self,
        request: ABTestPromptRequest
    ) -> Tuple[PromptResponse, Optional[dict], Optional[dict]]:
        """
        Get prompt with A/B testing variant support

        Args:
            request: A/B test prompt request

        Returns:
            Tuple of (prompt_response, variant_info, assignment_info)
        """
        self._ensure_initialized()
        async with self.ab_testing_manager:
            response, variant, assignment = await self.ab_testing_manager.get_prompt_with_variant(
                request,
                lambda req: self.get_prompt(
                    req.prompt_id,
                    req.version,
                    req.project_id
                )
            )
            return (
                response,
                variant.__dict__ if variant else None,
                assignment.__dict__ if assignment else None
            )

    async def track_ab_test_event(self, event: dict) -> dict:
        """
        Track an A/B testing event

        Args:
            event: Event data

        Returns:
            Tracked event data
        """
        self._ensure_initialized()
        async with self.ab_testing_manager:
            return (await self.ab_testing_manager.track_event(
                self.ab_testing_manager.ExperimentEventCreateRequest(**event)
            )).__dict__

    async def track_conversion(
        self,
        experiment_id: str,
        assignment_id: str,
        conversion_value: Optional[float] = None,
        context: Optional[dict] = None
    ) -> dict:
        """
        Track a conversion event for A/B testing

        Args:
            experiment_id: Experiment ID
            assignment_id: Assignment ID
            conversion_value: Optional conversion value
            context: Optional experiment context

        Returns:
            Tracked event data
        """
        self._ensure_initialized()
        exp_context = ExperimentContext(**context) if context else None
        async with self.ab_testing_manager:
            return (await self.ab_testing_manager.track_conversion(
                experiment_id, assignment_id, conversion_value, exp_context
            )).__dict__

    async def create_experiment(self, experiment: dict) -> dict:
        """Create an A/B testing experiment"""
        self._ensure_initialized()
        async with self.ab_testing_manager:
            return (await self.ab_testing_manager.create_experiment(
                self.ab_testing_manager.ExperimentCreateRequest(**experiment)
            )).__dict__

    async def get_experiment(self, experiment_id: str) -> Optional[dict]:
        """Get A/B testing experiment details"""
        self._ensure_initialized()
        async with self.ab_testing_manager:
            experiment = await self.ab_testing_manager.get_experiment(experiment_id)
            return experiment.__dict__ if experiment else None

    async def update_experiment(self, experiment_id: str, update: dict) -> dict:
        """Update an A/B testing experiment"""
        self._ensure_initialized()
        async with self.ab_testing_manager:
            return (await self.ab_testing_manager.update_experiment(
                experiment_id, self.ab_testing_manager.ExperimentUpdateRequest(**update)
            )).__dict__

    async def start_experiment(self, experiment_id: str) -> dict:
        """Start an A/B testing experiment"""
        self._ensure_initialized()
        async with self.ab_testing_manager:
            return await self.ab_testing_manager.start_experiment(experiment_id)

    async def pause_experiment(self, experiment_id: str) -> dict:
        """Pause an A/B testing experiment"""
        self._ensure_initialized()
        async with self.ab_testing_manager:
            return await self.ab_testing_manager.pause_experiment(experiment_id)

    async def complete_experiment(self, experiment_id: str) -> dict:
        """Complete an A/B testing experiment"""
        self._ensure_initialized()
        async with self.ab_testing_manager:
            return await self.ab_testing_manager.complete_experiment(experiment_id)

    async def get_experiment_results(self, experiment_id: str) -> List[dict]:
        """Get experiment results"""
        self._ensure_initialized()
        async with self.ab_testing_manager:
            results = await self.ab_testing_manager.get_experiment_results(experiment_id)
            return [result.__dict__ for result in results]

    async def get_variant_performance(self, experiment_id: str) -> List[dict]:
        """Get variant performance metrics"""
        self._ensure_initialized()
        async with self.ab_testing_manager:
            performance = await self.ab_testing_manager.get_variant_performance(experiment_id)
            return [perf.__dict__ for perf in performance]

    async def get_ab_test_stats(self, project_id: Optional[str] = None) -> dict:
        """Get A/B testing statistics"""
        self._ensure_initialized()
        async with self.ab_testing_manager:
            return (await self.ab_testing_manager.get_stats(project_id)).__dict__

    async def create_feature_flag(self, feature_flag: dict) -> dict:
        """Create a feature flag"""
        self._ensure_initialized()
        async with self.ab_testing_manager:
            return (await self.ab_testing_manager.create_feature_flag(
                self.ab_testing_manager.FeatureFlagCreateRequest(**feature_flag)
            )).__dict__

    async def get_feature_flags(
        self,
        project_id: Optional[str] = None,
        enabled: Optional[bool] = None
    ) -> List[dict]:
        """Get feature flags"""
        self._ensure_initialized()
        async with self.ab_testing_manager:
            flags = await self.ab_testing_manager.get_feature_flags(project_id, enabled)
            return [flag.__dict__ for flag in flags]

    async def is_feature_enabled(
        self,
        feature_flag_name: str,
        context: Optional[dict] = None
    ) -> bool:
        """Check if a feature is enabled"""
        self._ensure_initialized()
        exp_context = ExperimentContext(**context) if context else None
        async with self.ab_testing_manager:
            return await self.ab_testing_manager.is_feature_enabled(feature_flag_name, exp_context)

    def clear_session_assignments(self, session_id: str) -> None:
        """Clear session assignments (useful for logout)"""
        self.ab_testing_manager.clear_session_assignments(session_id)

    def update_ab_testing_config(self, config: dict) -> None:
        """Update A/B testing configuration"""
        self.ab_testing_manager.update_config(ABTestingConfig(**config))

    def get_ab_testing_config(self) -> dict:
        """Get A/B testing configuration"""
        return self.ab_testing_manager.get_config().__dict__

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
    base_url: Optional[str] = None,
    api_key: Optional[str] = None,
    timeout: float = 30.0,
    cache_level: CacheLevel = CacheLevel.MEMORY,
    enable_telemetry: bool = True,
    environment: Optional[str] = None,
    auto_detect: bool = True
) -> PromptOpsClient:
    """
    Create and initialize a PromptOps client

    Args:
        base_url: PromptOps API base URL (auto-detected if None)
        api_key: API key for authentication (from environment if None)
        timeout: Request timeout in seconds
        cache_level: Cache level
        enable_telemetry: Whether to enable telemetry
        environment: Environment (development, staging, production)
        auto_detect: Whether to auto-detect environment

    Returns:
        Initialized PromptOps client
    """
    config = ClientConfig(
        base_url=base_url,
        api_key=api_key,
        timeout=timeout,
        cache=CacheConfig(level=cache_level),
        telemetry=TelemetryConfig(enabled=enable_telemetry),
        auto_detect_environment=auto_detect
    )

    # Set environment if specified
    if environment:
        config.environment.environment = environment

    client = PromptOpsClient(config)
    await client.initialize()
    return client


async def create_client_for_environment(
    environment: str = "development",
    api_key: Optional[str] = None,
    **kwargs
) -> PromptOpsClient:
    """
    Create a client configured for a specific environment

    Args:
        environment: Environment name (development, staging, production)
        api_key: API key (from environment if None)
        **kwargs: Additional client configuration

    Returns:
        Initialized PromptOps client
    """
    env_config = create_environment_config(environment=environment)

    # Set defaults based on environment
    if environment == "development":
        kwargs.setdefault('base_url', 'http://localhost:8000')
        kwargs.setdefault('timeout', 30.0)
        kwargs.setdefault('enable_telemetry', False)
    elif environment == "staging":
        kwargs.setdefault('base_url', 'https://staging-api.promptops.ai')
        kwargs.setdefault('timeout', 45.0)
        kwargs.setdefault('enable_telemetry', True)
    else:  # production
        kwargs.setdefault('base_url', 'https://api.promptops.ai')
        kwargs.setdefault('timeout', 60.0)
        kwargs.setdefault('enable_telemetry', True)

    return await create_client(
        base_url=kwargs.get('base_url'),
        api_key=api_key,
        timeout=kwargs.get('timeout'),
        cache_level=kwargs.get('cache_level', CacheLevel.MEMORY),
        enable_telemetry=kwargs.get('enable_telemetry', True),
        environment=environment,
        auto_detect=False
    )