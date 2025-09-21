"""
Data models for PromptOps client library
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field, validator
from .exceptions import ValidationError


class UserRole(str, Enum):
    """User roles in the system"""
    ADMIN = "admin"
    USER = "user"
    VIEWER = "viewer"


class ModelProvider(str, Enum):
    """Supported model providers"""
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GOOGLE = "google"
    COHERE = "cohere"
    HUGGINGFACE = "huggingface"
    LOCAL = "local"


class RiskLevel(str, Enum):
    """MAS risk levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class CacheLevel(str, Enum):
    """Cache levels"""
    NONE = "none"
    MEMORY = "memory"
    REDIS = "redis"
    HYBRID = "hybrid"


class Message(BaseModel):
    """Chat message model"""
    role: str
    content: str


class ModelSpecificPrompt(BaseModel):
    """Model-specific prompt configuration"""
    model_provider: ModelProvider
    model_name: str
    content: str
    expected_output_format: Optional[str] = None
    instructions: Optional[str] = None

    @validator('content')
    def validate_content(cls, v):
        if not v or not v.strip():
            raise ValidationError("Prompt content cannot be empty")
        return v.strip()


class PromptVariables(BaseModel):
    """Variables for prompt substitution"""
    variables: Dict[str, Any] = Field(default_factory=dict)

    def get(self, key: str, default: Any = None) -> Any:
        """Get variable value with fallback"""
        return self.variables.get(key, default)

    def set(self, key: str, value: Any) -> None:
        """Set variable value"""
        self.variables[key] = value

    def update(self, variables: Dict[str, Any]) -> None:
        """Update multiple variables"""
        self.variables.update(variables)


class PromptResponse(BaseModel):
    """Response from prompt retrieval"""
    id: str
    version: str
    module_id: str
    name: str
    description: Optional[str] = None
    content: str
    target_models: List[ModelProvider]
    model_specific_prompts: List[ModelSpecificPrompt]
    mas_intent: str
    mas_fairness_notes: str
    mas_testing_notes: Optional[str] = None
    mas_risk_level: RiskLevel
    mas_approval_log: Optional[Dict[str, Any]] = None
    created_by: str
    created_at: datetime
    updated_at: datetime

    @validator('target_models')
    def validate_target_models(cls, v):
        if not v:
            raise ValidationError("At least one target model must be specified")
        return v


class RenderRequest(BaseModel):
    """Request to render a prompt"""
    prompt_id: str
    version: Optional[str] = None
    variables: PromptVariables = Field(default_factory=PromptVariables)
    model_provider: Optional[ModelProvider] = None
    model_name: Optional[str] = None
    tenant: Optional[str] = None
    overrides: Optional[Dict[str, Any]] = None


class RenderResponse(BaseModel):
    """Response from prompt rendering"""
    messages: List[Message]
    rendered_content: str
    prompt_id: str
    version: str
    variables_used: Dict[str, Any]
    applied_policies: List[str]
    cache_key: Optional[str] = None
    cached: bool = False


class CacheConfig(BaseModel):
    """Cache configuration"""
    level: CacheLevel = CacheLevel.MEMORY
    ttl: int = Field(300, ge=0, description="Time-to-live in seconds")
    max_size: int = Field(1000, ge=0, description="Maximum cache size")
    redis_url: Optional[str] = None
    redis_prefix: str = "promptops:"

    @validator('ttl')
    def validate_ttl(cls, v):
        if v < 0:
            raise ValidationError("TTL cannot be negative")
        return v

    class Config:
        extra = "forbid"


class RetryConfig(BaseModel):
    """Retry configuration"""
    max_attempts: int = Field(3, ge=1, le=10)
    base_delay: float = Field(1.0, ge=0.1)
    max_delay: float = Field(60.0, ge=1.0)
    exponential_base: float = Field(2.0, ge=1.0)
    jitter: bool = True


class TelemetryConfig(BaseModel):
    """Telemetry configuration"""
    enabled: bool = True
    endpoint: Optional[str] = None
    sample_rate: float = Field(1.0, ge=0.0, le=1.0)
    batch_size: int = Field(100, ge=1)
    flush_interval: float = Field(30.0, ge=1.0)

    class Config:
        extra = "forbid"




class Project(BaseModel):
    """Project model"""
    id: str
    name: str
    description: Optional[str] = None
    owner: str
    created_at: datetime
    updated_at: datetime


class Module(BaseModel):
    """Module model"""
    id: str
    version: str
    project_id: str
    slot: str
    render_body: str
    metadata: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime


class Template(BaseModel):
    """Template model"""
    id: str
    version: str
    owner: str
    hash: str
    metadata: Optional[Dict[str, Any]] = None
    created_by: str
    created_at: datetime


class Alias(BaseModel):
    """Alias model"""
    alias: str
    template_id: str
    target_version: str
    weights: Dict[str, float]
    etag: str
    updated_by: str
    updated_at: datetime


class ModelCompatibility(BaseModel):
    """Model compatibility model"""
    id: str
    prompt_id: str
    model_name: str
    model_provider: ModelProvider
    is_compatible: bool
    compatibility_notes: Optional[str] = None
    created_at: datetime


class ApprovalRequest(BaseModel):
    """Approval request model"""
    id: str
    prompt_id: str
    requested_by: str
    requested_at: datetime
    status: str
    approver: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    comments: Optional[str] = None


class User(BaseModel):
    """User model"""
    id: str
    email: str
    name: str
    role: UserRole
    organization: Optional[str] = None
    phone: Optional[str] = None
    company_size: Optional[str] = None
    avatar: Optional[str] = None
    provider: Optional[str] = None
    provider_id: Optional[str] = None
    is_verified: bool
    created_at: datetime
    updated_at: datetime
    last_login: Optional[datetime] = None


class TelemetryEvent(BaseModel):
    """Telemetry event model"""
    event_type: str
    timestamp: datetime
    session_id: str
    user_id: Optional[str] = None
    properties: Dict[str, Any] = Field(default_factory=dict)
    measurements: Dict[str, float] = Field(default_factory=dict)


class CacheStats(BaseModel):
    """Cache statistics"""
    hits: int = 0
    misses: int = 0
    evictions: int = 0
    size: int = 0
    hit_rate: float = 0.0

    @property
    def total_requests(self) -> int:
        return self.hits + self.misses

    def update_hit_rate(self) -> None:
        """Update hit rate based on current hits and misses"""
        if self.total_requests > 0:
            self.hit_rate = self.hits / self.total_requests
        else:
            self.hit_rate = 0.0


class ClientStats(BaseModel):
    """Client statistics"""
    total_requests: int = 0
    successful_requests: int = 0
    failed_requests: int = 0
    cache_stats: CacheStats = Field(default_factory=CacheStats)
    average_response_time: float = 0.0
    last_request_time: Optional[datetime] = None

    @property
    def success_rate(self) -> float:
        if self.total_requests > 0:
            return self.successful_requests / self.total_requests
        return 0.0


class ABTestingConfig(BaseModel):
    """A/B testing configuration"""
    enable_automatic_assignment: bool = Field(default=True)
    enable_event_tracking: bool = Field(default=True)
    enable_result_calculation: bool = Field(default=True)
    cache_ttl: int = Field(default=300000, ge=1000)  # 5 minutes minimum
    assignment_consistency: bool = Field(default=True)
    default_session_timeout: int = Field(default=3600000, ge=60000)  # 1 hour minimum


class EnvironmentConfig(BaseModel):
    """Environment configuration"""
    environment: str = Field(default="production", description="Environment name (development, staging, production)")
    base_url: str = Field(default="https://api.promptops.ai", description="API base URL")
    auto_detect: bool = Field(default=True, description="Auto-detect environment")
    connection_timeout: float = Field(default=5.0, ge=1.0, le=30.0, description="Connection test timeout")
    max_retries: int = Field(default=3, ge=1, le=10, description="Maximum connection retries")
    retry_delay: float = Field(default=1.0, ge=0.1, le=10.0, description="Base retry delay")
    enable_connection_test: bool = Field(default=True, description="Enable connection testing")
    health_check_endpoint: str = Field(default="/health", description="Health check endpoint path")

    @validator('environment')
    def validate_environment(cls, v):
        valid_environments = ['development', 'staging', 'production']
        if v.lower() not in valid_environments:
            raise ValidationError(f"Environment must be one of: {valid_environments}")
        return v.lower()

    @validator('base_url')
    def validate_base_url(cls, v):
        if not v.startswith(('http://', 'https://')):
            raise ValidationError("Base URL must start with http:// or https://")
        return v.rstrip('/')


class ClientConfig(BaseModel):
    """Main client configuration"""
    base_url: Optional[str] = Field(None, description="PromptOps API base URL (auto-detected if not provided)")
    api_key: Optional[str] = Field(None, description="API key for authentication (can be from environment)")
    timeout: float = Field(30.0, ge=1.0, le=300.0)
    cache: CacheConfig = Field(default_factory=CacheConfig)
    retry: RetryConfig = Field(default_factory=RetryConfig)
    telemetry: TelemetryConfig = Field(default_factory=TelemetryConfig)
    ab_testing: ABTestingConfig = Field(default_factory=ABTestingConfig)
    environment: EnvironmentConfig = Field(default_factory=EnvironmentConfig)
    user_agent: str = "promptops-client/1.0.0"
    verify_ssl: bool = True
    auto_detect_environment: bool = Field(default=True, description="Auto-detect environment if not specified")

    @validator('base_url')
    def validate_base_url(cls, v):
        if v is not None:
            if not v.startswith(('http://', 'https://')):
                raise ValidationError("Base URL must start with http:// or https://")
            return v.rstrip('/')
        return v

    @validator('api_key')
    def validate_api_key(cls, v):
        if v is not None:
            if not v or not v.strip():
                raise ValidationError("API key cannot be empty")
            return v.strip()
        return v


class PromptRequest(BaseModel):
    """Request to get a prompt"""
    prompt_id: str = Field(..., description="Prompt ID")
    version: Optional[str] = Field(None, description="Prompt version")
    variables: Dict[str, Any] = Field(default_factory=dict, description="Variables for substitution")
    model_provider: Optional[ModelProvider] = Field(None, description="Target model provider")
    model_name: Optional[str] = Field(None, description="Target model name")
    tenant_id: Optional[str] = Field(None, description="Tenant ID")
    project_id: Optional[str] = Field(None, description="Project ID")
    overrides: Optional[Dict[str, Any]] = Field(None, description="Override values")