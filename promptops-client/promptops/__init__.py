"""
PromptOps Python Client Library

A comprehensive client library for interacting with the PromptOps API.
Provides async support, caching, telemetry, and robust error handling.
"""

__version__ = "1.0.0"
__author__ = "PromptOps Team"
__email__ = "team@promptops.ai"

# Core classes
from .client import PromptOpsClient, create_client, create_client_for_environment
from .models import (
    # Configuration
    ClientConfig,
    CacheConfig,
    RetryConfig,
    TelemetryConfig,
    EnvironmentConfig,

    # Data models
    PromptResponse,
    RenderRequest,
    RenderResponse,
    PromptVariables,
    ModelSpecificPrompt,
    Message,
    Project,
    Module,
    Template,
    User,

    # Enums
    ModelProvider,
    RiskLevel,
    CacheLevel,
    UserRole,

    # Statistics
    CacheStats,
    ClientStats,
)

# Environment management
from .environment import (
    Environment,
    EnvironmentConfig as DynamicEnvironmentConfig,
    create_environment_config,
    ConnectionManager,
)

# Exceptions
from .exceptions import (
    PromptOpsError,
    AuthenticationError,
    AuthorizationError,
    NetworkError,
    RateLimitError,
    NotFoundError,
    ValidationError,
    ConflictError,
    ServerError,
    ConfigurationError,
    CacheError,
    TelemetryError,
    PromptRenderingError,
    PromptNotFoundError,
    ModelCompatibilityError,
    ApprovalRequiredError,
    ComplianceError,
    QuotaExceededError,
)

# Version
__all__ = [
    # Core
    "PromptOpsClient",
    "create_client",
    "create_client_for_environment",

    # Configuration
    "ClientConfig",
    "CacheConfig",
    "RetryConfig",
    "TelemetryConfig",
    "EnvironmentConfig",

    # Data models
    "PromptResponse",
    "RenderRequest",
    "RenderResponse",
    "PromptVariables",
    "ModelSpecificPrompt",
    "Message",
    "Project",
    "Module",
    "Template",
    "User",

    # Enums
    "ModelProvider",
    "RiskLevel",
    "CacheLevel",
    "UserRole",

    # Statistics
    "CacheStats",
    "ClientStats",

    # Exceptions
    "PromptOpsError",
    "AuthenticationError",
    "AuthorizationError",
    "NetworkError",
    "RateLimitError",
    "NotFoundError",
    "ValidationError",
    "ConflictError",
    "ServerError",
    "ConfigurationError",
    "CacheError",
    "TelemetryError",
    "PromptRenderingError",
    "PromptNotFoundError",
    "ModelCompatibilityError",
    "ApprovalRequiredError",
    "ComplianceError",
    "QuotaExceededError",

    # Version
    "__version__",

    # Environment management
    "Environment",
    "DynamicEnvironmentConfig",
    "create_environment_config",
    "ConnectionManager",
]

# Default configuration
DEFAULT_BASE_URL = "https://api.promptops.ai"
DEFAULT_TIMEOUT = 30.0
DEFAULT_CACHE_LEVEL = CacheLevel.MEMORY
DEFAULT_CACHE_TTL = 300
DEFAULT_ENABLE_TELEMETRY = True

# Legacy constants for backward compatibility
DEFAULT_ENVIRONMENT = "production"