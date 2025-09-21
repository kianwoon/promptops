"""
Environment detection and configuration management for PromptOps clients
"""

import os
import socket
import asyncio
import urllib.request
from enum import Enum
from typing import Dict, Optional, Tuple, Union
from urllib.parse import urlparse
import structlog

from .exceptions import ConfigurationError, NetworkError

logger = structlog.get_logger(__name__)


class Environment(str, Enum):
    """Supported deployment environments"""
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"


class EnvironmentConfig:
    """Configuration for different environments"""

    DEFAULT_URLS = {
        Environment.DEVELOPMENT: "http://localhost:8000",
        Environment.STAGING: "https://staging-api.promptops.ai",
        Environment.PRODUCTION: "https://api.promptops.ai"
    }

    def __init__(self, environment: Environment, base_url: Optional[str] = None):
        self.environment = environment
        self.base_url = base_url or self.DEFAULT_URLS[environment]

    @classmethod
    def detect_environment(cls, base_url: Optional[str] = None) -> 'EnvironmentConfig':
        """
        Detect the current environment and return appropriate configuration

        Args:
            base_url: Optional override for base URL

        Returns:
            EnvironmentConfig instance
        """
        # Check for explicit environment variable
        env_from_var = os.environ.get('PROMPTOPS_ENVIRONMENT', '').lower()
        if env_from_var:
            try:
                env = Environment(env_from_var)
                logger.info("Environment specified via environment variable", environment=env.value)
                return cls(env, base_url)
            except ValueError:
                logger.warning("Invalid environment in PROMPTOPS_ENVIRONMENT", value=env_from_var)

        # Check for explicit base URL in environment variable
        base_url_from_var = os.environ.get('PROMPTOPS_BASE_URL')
        if base_url_from_var:
            logger.info("Base URL specified via environment variable", base_url=base_url_from_var)
            # Infer environment from base URL
            if 'localhost' in base_url_from_var or '127.0.0.1' in base_url_from_var:
                return cls(Environment.DEVELOPMENT, base_url_from_var)
            elif 'staging' in base_url_from_var:
                return cls(Environment.STAGING, base_url_from_var)
            else:
                return cls(Environment.PRODUCTION, base_url_from_var)

        # If base_url is provided explicitly, use it
        if base_url:
            if 'localhost' in base_url or '127.0.0.1' in base_url:
                return cls(Environment.DEVELOPMENT, base_url)
            elif 'staging' in base_url:
                return cls(Environment.STAGING, base_url)
            else:
                return cls(Environment.PRODUCTION, base_url)

        # Auto-detect: check if localhost:8000 is accessible
        if cls._is_localhost_accessible():
            logger.info("Local development environment detected")
            return cls(Environment.DEVELOPMENT)

        # Default to production
        logger.info("Defaulting to production environment")
        return cls(Environment.PRODUCTION)

    @staticmethod
    def _is_localhost_accessible() -> bool:
        """Check if localhost:8000 is accessible"""
        try:
            # Try to connect to localhost:8000 with timeout
            socket.create_connection(('localhost', 8000), timeout=2.0)
            return True
        except (socket.timeout, socket.error, OSError):
            return False

    @staticmethod
    async def test_connection(base_url: str, timeout: float = 5.0) -> Tuple[bool, str]:
        """
        Test connection to a given base URL

        Args:
            base_url: URL to test
            timeout: Connection timeout in seconds

        Returns:
            Tuple of (success, message)
        """
        try:
            # Try to access the health endpoint
            health_url = f"{base_url.rstrip('/')}/health"

            # Create opener with timeout
            opener = urllib.request.build_opener()
            opener.addheaders = [('User-Agent', 'promptops-client/1.0.0')]

            # Make request with timeout
            with urllib.request.urlopen(health_url, timeout=timeout) as response:
                if response.status == 200:
                    return True, "Connection successful"
                else:
                    return False, f"HTTP {response.status}: {response.reason}"

        except urllib.error.HTTPError as e:
            return False, f"HTTP {e.code}: {e.reason}"
        except urllib.error.URLError as e:
            return False, f"Connection failed: {e.reason}"
        except Exception as e:
            return False, f"Unexpected error: {str(e)}"

    def get_recommendations(self) -> Dict[str, Union[str, bool]]:
        """Get configuration recommendations for this environment"""
        recommendations = {
            "environment": self.environment.value,
            "base_url": self.base_url,
            "enable_debug_logging": self.environment == Environment.DEVELOPMENT,
            "enable_cache": True,
            "cache_ttl": 300 if self.environment == Environment.DEVELOPMENT else 600,
            "enable_telemetry": self.environment != Environment.DEVELOPMENT,
            "retry_attempts": 3 if self.environment == Environment.DEVELOPMENT else 5,
            "timeout": 30.0 if self.environment == Environment.DEVELOPMENT else 60.0,
        }

        return recommendations

    def validate(self) -> Tuple[bool, Optional[str]]:
        """Validate the configuration"""
        if not self.base_url:
            return False, "Base URL is required"

        try:
            parsed = urlparse(self.base_url)
            if not parsed.scheme or not parsed.netloc:
                return False, "Invalid base URL format"

            if parsed.scheme not in ['http', 'https']:
                return False, "Base URL must use HTTP or HTTPS"

        except Exception as e:
            return False, f"Invalid base URL: {str(e)}"

        return True, None


class ConnectionManager:
    """Manages connection testing and retry logic"""

    def __init__(self, config: EnvironmentConfig, max_retries: int = 3, base_delay: float = 1.0):
        self.config = config
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.connection_tested = False
        self.connection_healthy = False

    async def test_connection_with_retry(self) -> bool:
        """
        Test connection with retry logic

        Returns:
            True if connection is successful
        """
        if self.connection_tested:
            return self.connection_healthy

        logger.info("Testing connection", base_url=self.config.base_url)

        for attempt in range(self.max_retries):
            try:
                success, message = await EnvironmentConfig.test_connection(
                    self.config.base_url,
                    timeout=10.0
                )

                if success:
                    self.connection_tested = True
                    self.connection_healthy = True
                    logger.info("Connection test successful", base_url=self.config.base_url)
                    return True
                else:
                    logger.warning(
                        "Connection test failed",
                        attempt=attempt + 1,
                        max_retries=self.max_retries,
                        message=message
                    )

                    if attempt < self.max_retries - 1:
                        delay = self.base_delay * (2 ** attempt)  # Exponential backoff
                        logger.info("Retrying connection", delay=delay)
                        await asyncio.sleep(delay)

            except Exception as e:
                logger.error("Connection test error", error=str(e), attempt=attempt + 1)

                if attempt < self.max_retries - 1:
                    delay = self.base_delay * (2 ** attempt)
                    await asyncio.sleep(delay)

        self.connection_tested = True
        self.connection_healthy = False
        logger.error("All connection attempts failed", base_url=self.config.base_url)
        return False

    def get_connection_status(self) -> Dict[str, Union[bool, str, int]]:
        """Get current connection status"""
        return {
            "tested": self.connection_tested,
            "healthy": self.connection_healthy,
            "base_url": self.config.base_url,
            "environment": self.config.environment.value,
            "max_retries": self.max_retries
        }


def create_environment_config(
    environment: Optional[str] = None,
    base_url: Optional[str] = None,
    force_environment: Optional[str] = None
) -> EnvironmentConfig:
    """
    Create environment configuration with multiple override options

    Args:
        environment: Environment name (development, staging, production)
        base_url: Base URL override
        force_environment: Force specific environment (bypasses detection)

    Returns:
        EnvironmentConfig instance
    """
    # Force environment if specified
    if force_environment:
        try:
            env = Environment(force_environment.lower())
            logger.info("Environment forced", environment=env.value)
            return EnvironmentConfig(env, base_url)
        except ValueError:
            raise ConfigurationError(f"Invalid environment: {force_environment}")

    # Use specific environment if provided
    if environment:
        try:
            env = Environment(environment.lower())
            return EnvironmentConfig(env, base_url)
        except ValueError:
            raise ConfigurationError(f"Invalid environment: {environment}")

    # Auto-detect environment
    return EnvironmentConfig.detect_environment(base_url)