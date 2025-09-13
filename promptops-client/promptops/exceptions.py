"""
Custom exceptions for PromptOps client library
"""

from typing import Any, Dict, Optional


class PromptOpsError(Exception):
    """Base exception for all PromptOps client errors"""

    def __init__(self, message: str, error_code: Optional[str] = None, details: Optional[Dict[str, Any]] = None):
        self.message = message
        self.error_code = error_code
        self.details = details or {}
        super().__init__(self.message)


class AuthenticationError(PromptOpsError):
    """Raised when authentication fails"""
    pass


class AuthorizationError(PromptOpsError):
    """Raised when authorization fails"""
    pass


class NetworkError(PromptOpsError):
    """Raised when network operations fail"""
    pass


class RateLimitError(PromptOpsError):
    """Raised when API rate limits are exceeded"""

    def __init__(self, message: str, retry_after: Optional[int] = None, **kwargs):
        self.retry_after = retry_after
        super().__init__(message, **kwargs)


class NotFoundError(PromptOpsError):
    """Raised when a resource is not found"""
    pass


class ValidationError(PromptOpsError):
    """Raised when data validation fails"""

    def __init__(self, message: str, validation_errors: Optional[Dict[str, Any]] = None, **kwargs):
        self.validation_errors = validation_errors or {}
        super().__init__(message, **kwargs)


class ConflictError(PromptOpsError):
    """Raised when a conflict occurs (e.g., duplicate resource)"""
    pass


class ServerError(PromptOpsError):
    """Raised when server errors occur"""
    pass


class ConfigurationError(PromptOpsError):
    """Raised when configuration is invalid"""
    pass


class CacheError(PromptOpsError):
    """Raised when cache operations fail"""
    pass


class TelemetryError(PromptOpsError):
    """Raised when telemetry operations fail"""
    pass


class PromptRenderingError(PromptOpsError):
    """Raised when prompt rendering fails"""
    pass


class PromptNotFoundError(NotFoundError):
    """Raised when a prompt is not found"""
    pass


class ModelCompatibilityError(PromptOpsError):
    """Raised when model compatibility issues occur"""
    pass


class ApprovalRequiredError(PromptOpsError):
    """Raised when prompt approval is required"""

    def __init__(self, message: str, approval_request_id: Optional[str] = None, **kwargs):
        self.approval_request_id = approval_request_id
        super().__init__(message, **kwargs)


class ComplianceError(PromptOpsError):
    """Raised when compliance violations occur"""
    pass


class QuotaExceededError(PromptOpsError):
    """Raised when usage quotas are exceeded"""

    def __init__(self, message: str, quota_limit: Optional[int] = None, current_usage: Optional[int] = None, **kwargs):
        self.quota_limit = quota_limit
        self.current_usage = current_usage
        super().__init__(message, **kwargs)