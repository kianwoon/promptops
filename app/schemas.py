from pydantic import BaseModel, Field, ConfigDict
from typing import Dict, Any, List, Optional
from datetime import datetime
import enum

try:
    from app.utilslib.enums import (
        AIAssistantProviderType, AIAssistantProviderStatus, AIAssistantSystemPromptType,
        AIAssistantConversationStatus, AIAssistantMessageRole
    )
except ImportError:
    # Fallback enums for backwards compatibility
    class AIAssistantProviderType(str, enum.Enum):
        openai = "openai"
        anthropic = "anthropic"
        gemini = "gemini"
        qwen = "qwen"
        openrouter = "openrouter"
        ollama = "ollama"

    class AIAssistantProviderStatus(str, enum.Enum):
        active = "active"
        inactive = "inactive"
        error = "error"

    class AIAssistantSystemPromptType(str, enum.Enum):
        create_prompt = "create_prompt"
        edit_prompt = "edit_prompt"

    class AIAssistantConversationStatus(str, enum.Enum):
        active = "active"
        archived = "archived"
        deleted = "deleted"

    class AIAssistantMessageRole(str, enum.Enum):
        user = "user"
        assistant = "assistant"
        system = "system"

# Template schemas
class TemplateCreate(BaseModel):
    id: str
    version: str
    owner: str
    template_yaml: str
    metadata: Optional[Dict[str, Any]] = None

class TemplateResponse(BaseModel):
    id: str
    version: str
    owner: str
    hash: str
    metadata: Optional[Dict[str, Any]] = None
    created_by: str
    created_at: datetime
  
# Render schemas
class RenderRequest(BaseModel):
    id: str
    alias: str
    inputs: Dict[str, Any]
    tenant: Optional[str] = None
    overrides: Optional[Dict[str, Any]] = None

class Message(BaseModel):
    role: str
    content: str

class RenderResponse(BaseModel):
    messages: List[Message]
    hash: str
    template_id: str
    version: str
    inputs_used: Dict[str, Any]
    applied_policies: List[str]

# Alias schemas
class AliasUpdate(BaseModel):
    weights: Dict[str, float]
    description: Optional[str] = None

class AliasResponse(BaseModel):
    alias: str
    template_id: str
    target_version: str
    weights: Dict[str, float]
    etag: str
    updated_by: str
    updated_at: datetime
    
    class Config:
        from_attributes = True

# Evaluation schemas
class EvaluationRunCreate(BaseModel):
    template_id: str
    version: str
    suite_id: str

class EvaluationRunResponse(BaseModel):
    id: str
    template_id: str
    version: str
    suite_id: str
    metrics: Dict[str, Any]
    passed: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

# Policy schemas
class PolicyEvaluationRequest(BaseModel):
    template_id: str
    version: str
    inputs: Dict[str, Any]
    tenant: Optional[str] = None

class PolicyEvaluationResponse(BaseModel):
    allowed: bool
    reason: str
    policies_applied: List[str]

# Project schemas
class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    owner: str

class ProjectResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    owner: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

# Module schemas
class ModuleCreate(BaseModel):
    id: str
    version: str
    project_id: str
    slot: str
    render_body: str
    metadata: Optional[Dict[str, Any]] = None

class ModuleResponse(BaseModel):
    id: str
    version: str
    project_id: str
    slot: str
    render_body: str
    metadata: Optional[Dict[str, Any]] = Field(None, alias="metadata_json")
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        populate_by_name = True

class ModuleUpdate(BaseModel):
    slot: Optional[str] = None
    render_body: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

# Prompt schemas
class ModelSpecificPrompt(BaseModel):
    model_provider: str
    model_name: str
    content: str
    expected_output_format: Optional[str] = None
    instructions: Optional[str] = None

    model_config = ConfigDict(
        protected_namespaces=()
    )

class PromptCreate(BaseModel):
    id: str
    version: str
    module_id: str
    name: str
    description: Optional[str] = None
    target_models: List[str] = Field(..., description="List of model providers (e.g., ['openai', 'claude', 'gemini'])")
    model_specific_prompts: List[ModelSpecificPrompt]
    mas_intent: str
    mas_fairness_notes: str
    mas_testing_notes: Optional[str] = None
    mas_risk_level: str
    mas_approval_log: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(
        protected_namespaces=()
    )

class PromptResponse(BaseModel):
    id: str
    version: str
    module_id: str
    name: str
    description: Optional[str] = None
    created_by: str
    created_at: datetime
    updated_at: datetime
    mas_intent: str
    mas_fairness_notes: str
    mas_testing_notes: Optional[str] = None
    mas_risk_level: str
    mas_approval_log: Optional[Dict[str, Any]] = None
    target_models: List[str]
    model_specific_prompts: List[ModelSpecificPrompt]

    model_config = ConfigDict(
        protected_namespaces=(),
        from_attributes=True
    )

class PromptUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    target_models: Optional[List[str]] = None
    model_specific_prompts: Optional[List[ModelSpecificPrompt]] = None
    mas_intent: Optional[str] = None
    mas_fairness_notes: Optional[str] = None
    mas_testing_notes: Optional[str] = None
    mas_risk_level: Optional[str] = None
    mas_approval_log: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(
        protected_namespaces=()
    )

# ModelCompatibility schemas
class ModelCompatibilityCreate(BaseModel):
    prompt_id: str
    model_name: str
    model_provider: str
    is_compatible: bool
    compatibility_notes: Optional[str] = None

    model_config = ConfigDict(
        protected_namespaces=()
    )

class ModelCompatibilityResponse(BaseModel):
    id: str
    prompt_id: str
    model_name: str
    model_provider: str
    is_compatible: bool
    compatibility_notes: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(
        protected_namespaces=(),
        from_attributes=True
    )

class ModelCompatibilityUpdate(BaseModel):
    is_compatible: Optional[bool] = None
    compatibility_notes: Optional[str] = None

    model_config = ConfigDict(
        protected_namespaces=()
    )

# ApprovalRequest schemas
class ApprovalRequestCreate(BaseModel):
    prompt_id: str
    requested_by: str
    status: str
    approver: Optional[str] = None
    rejection_reason: Optional[str] = None
    comments: Optional[str] = None

class ApprovalRequestResponse(BaseModel):
    id: str
    prompt_id: str
    requested_by: str
    requested_at: datetime
    status: str
    approver: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    comments: Optional[str] = None

    class Config:
        from_attributes = True

class ApprovalRequestUpdate(BaseModel):
    status: Optional[str] = None
    approver: Optional[str] = None
    rejection_reason: Optional[str] = None
    comments: Optional[str] = None

# User schemas
class UserCreate(BaseModel):
    email: str
    name: str
    role: str = "user"
    organization: Optional[str] = None
    phone: Optional[str] = None
    company_size: Optional[str] = None
    hashed_password: Optional[str] = None

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
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

    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    name: Optional[str] = None
    organization: Optional[str] = None
    phone: Optional[str] = None
    company_size: Optional[str] = None
    avatar: Optional[str] = None
    role: Optional[str] = None
    is_verified: Optional[bool] = None

# Client API Schemas
class ClientApiKeyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)

    # Rate limiting configuration
    rate_limit_per_minute: int = Field(default=60, ge=1, le=10000)
    rate_limit_per_hour: int = Field(default=3600, ge=1, le=100000)
    rate_limit_per_day: int = Field(default=86400, ge=1, le=1000000)

    # Permissions
    allowed_projects: Optional[List[str]] = None  # None means all projects
    allowed_scopes: List[str] = Field(default=["read"], min_items=1)

    # Optional expiration
    expires_at: Optional[datetime] = None

class ClientApiKeyResponse(BaseModel):
    id: str
    user_id: str
    tenant_id: str
    name: str
    description: Optional[str] = None
    api_key_prefix: str
    api_key: Optional[str] = None  # Decrypted API key if available
    secret_key: Optional[str] = None  # Decrypted secret key if available
    rate_limit_per_minute: int
    rate_limit_per_hour: int
    rate_limit_per_day: int
    allowed_projects: Optional[List[str]] = None
    allowed_scopes: List[str]
    status: str
    last_used_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ClientApiKeyUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    rate_limit_per_minute: Optional[int] = Field(None, ge=1, le=10000)
    rate_limit_per_hour: Optional[int] = Field(None, ge=1, le=100000)
    rate_limit_per_day: Optional[int] = Field(None, ge=1, le=1000000)
    allowed_projects: Optional[List[str]] = None
    allowed_scopes: Optional[List[str]] = Field(None, min_items=1)
    expires_at: Optional[datetime] = None

class ClientApiKeyCreateResponse(BaseModel):
    api_key: str
    secret_key: str
    api_key_data: ClientApiKeyResponse

class UsageLogCreate(BaseModel):
    endpoint: str
    method: str
    prompt_id: Optional[str] = None
    project_id: Optional[str] = None
    tokens_requested: Optional[int] = None
    tokens_used: Optional[int] = None
    response_size: Optional[int] = None
    processing_time_ms: Optional[int] = None
    estimated_cost_usd: Optional[str] = None
    status_code: int
    error_message: Optional[str] = None
    user_agent: Optional[str] = None
    ip_address: Optional[str] = None
    request_id: Optional[str] = None

class UsageLogResponse(BaseModel):
    id: str
    api_key_id: str
    user_id: str
    tenant_id: str
    endpoint: str
    method: str
    prompt_id: Optional[str] = None
    project_id: Optional[str] = None
    tokens_requested: Optional[int] = None
    tokens_used: Optional[int] = None
    response_size: Optional[int] = None
    processing_time_ms: Optional[int] = None
    estimated_cost_usd: Optional[str] = None
    status_code: int
    error_message: Optional[str] = None
    user_agent: Optional[str] = None
    ip_address: Optional[str] = None
    request_id: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True

class UsageStatsRequest(BaseModel):
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    prompt_id: Optional[str] = None
    project_id: Optional[str] = None

class UsageStatsResponse(BaseModel):
    total_requests: int
    total_tokens_requested: int
    total_tokens_used: int
    total_cost_usd: str
    average_response_time_ms: float
    success_rate: float
    requests_by_endpoint: Dict[str, int]
    requests_by_hour: List[Dict[str, Any]]
    top_prompts: List[Dict[str, Any]]
    period_start: datetime
    period_end: datetime

class UsageLimitsResponse(BaseModel):
    current_usage_minute: int
    current_usage_hour: int
    current_usage_day: int
    limits_minute: int
    limits_hour: int
    limits_day: int
    remaining_minute: int
    remaining_hour: int
    remaining_day: int
    reset_time_minute: datetime
    reset_time_hour: datetime
    reset_time_day: datetime

class APIKeyValidationRequest(BaseModel):
    api_key: str
    signature: str
    timestamp: str
    endpoint: str
    method: str

class APIKeyValidationResponse(BaseModel):
    valid: bool
    api_key_id: Optional[str] = None
    user_id: Optional[str] = None
    tenant_id: Optional[str] = None
    scopes: List[str] = []
    allowed_projects: Optional[List[str]] = None
    rate_limits: Optional[Dict[str, int]] = None
    error: Optional[str] = None

class BatchPromptRequest(BaseModel):
    prompt_ids: List[str] = Field(..., min_items=1, max_items=100)
    project_id: Optional[str] = None
    include_versions: bool = False
    include_metadata: bool = False

class BatchPromptResponse(BaseModel):
    prompts: Dict[str, Any]
    errors: List[Dict[str, str]]
    total_requested: int
    total_found: int

class PromptSearchRequest(BaseModel):
    query: Optional[str] = None
    project_id: Optional[str] = None
    module_id: Optional[str] = None
    limit: int = Field(default=50, ge=1, le=1000)
    offset: int = Field(default=0, ge=0)
    sort_by: str = Field(default="created_at", pattern="^(created_at|updated_at|name)$")
    sort_order: str = Field(default="desc", pattern="^(asc|desc)$")

class PromptSearchResponse(BaseModel):
    prompts: List[Dict[str, Any]]
    total: int
    limit: int
    offset: int
    has_more: bool

# AI Assistant Schemas

class AIAssistantProviderCreate(BaseModel):
    provider_type: AIAssistantProviderType
    name: str = Field(..., min_length=1, max_length=100)
    api_key: Optional[str] = None
    api_base_url: Optional[str] = None
    model_name: Optional[str] = None
    organization: Optional[str] = None
    project: Optional[str] = None
    config_json: Optional[Dict[str, Any]] = None

class AIAssistantProviderUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    status: Optional[AIAssistantProviderStatus] = None
    api_key: Optional[str] = None
    api_base_url: Optional[str] = None
    model_name: Optional[str] = None
    organization: Optional[str] = None
    project: Optional[str] = None
    config_json: Optional[Dict[str, Any]] = None

class AIAssistantProviderResponse(BaseModel):
    id: str
    user_id: str
    provider_type: AIAssistantProviderType
    name: str
    status: AIAssistantProviderStatus
    api_key_prefix: Optional[str] = None  # Only first few characters for security
    api_base_url: Optional[str] = None
    model_name: Optional[str] = None
    organization: Optional[str] = None
    project: Optional[str] = None
    config_json: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime
    last_used_at: Optional[datetime] = None


class AIAssistantProviderEditResponse(BaseModel):
    id: str
    user_id: str
    provider_type: AIAssistantProviderType
    name: str
    status: AIAssistantProviderStatus
    api_key: Optional[str] = None  # Full API key for editing
    api_key_prefix: Optional[str] = None  # Only first few characters for security
    api_base_url: Optional[str] = None
    model_name: Optional[str] = None
    organization: Optional[str] = None
    project: Optional[str] = None
    config_json: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime
    last_used_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class AIAssistantSystemPromptCreate(BaseModel):
    provider_id: str
    prompt_type: AIAssistantSystemPromptType
    name: str = Field(..., min_length=1, max_length=100)
    content: str = Field(..., min_length=1)
    description: Optional[str] = None
    is_mas_feat_compliant: bool = True
    is_active: bool = True

class AIAssistantSystemPromptUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    content: Optional[str] = Field(None, min_length=1)
    description: Optional[str] = None
    is_mas_feat_compliant: Optional[bool] = None
    is_active: Optional[bool] = None

class AIAssistantSystemPromptResponse(BaseModel):
    id: str
    provider_id: str
    prompt_type: AIAssistantSystemPromptType
    name: str
    content: str
    description: Optional[str] = None
    is_mas_feat_compliant: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime
    created_by: str

    class Config:
        from_attributes = True

class AIAssistantMessage(BaseModel):
    role: str
    content: str
    metadata_json: Optional[Dict[str, Any]] = None

class AIAssistantConversationCreate(BaseModel):
    provider_id: str
    context_type: str = Field(..., pattern="^(create_prompt|edit_prompt|general)$")
    context_id: Optional[str] = None
    title: Optional[str] = None
    initial_message: Optional[AIAssistantMessage] = None

class AIAssistantConversationResponse(BaseModel):
    id: str
    user_id: str
    provider_id: str
    context_type: str
    context_id: Optional[str] = None
    title: Optional[str] = None
    messages: List[AIAssistantMessage]
    current_provider_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class AIAssistantChatRequest(BaseModel):
    conversation_id: Optional[str] = None
    message: str = Field(..., min_length=1)
    provider_id: Optional[str] = None  # Allow switching providers during conversation
    context_type: Optional[str] = Field(None, pattern="^(create_prompt|edit_prompt|general)$")
    context_id: Optional[str] = None
    system_prompt_overrides: Optional[Dict[str, Any]] = None

class AIAssistantChatResponse(BaseModel):
    conversation_id: str
    message_id: str
    role: str
    content: str
    metadata_json: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True

class AIAssistantPromptGenerationRequest(BaseModel):
    provider_id: str
    prompt_type: AIAssistantSystemPromptType = Field(..., pattern="^(create_prompt|edit_prompt)$")
    context: Dict[str, Any] = Field(...)  # Context about what prompt to create/edit
    description: Optional[str] = None
    target_models: Optional[List[str]] = None
    custom_instructions: Optional[str] = None
    system_prompt_overrides: Optional[Dict[str, Any]] = None

class AIAssistantPromptGenerationResponse(BaseModel):
    conversation_id: str
    generated_prompt: Dict[str, Any]  # Generated prompt structure
    mas_feat_compliance: Dict[str, Any]  # Compliance information
    metadata_json: Optional[Dict[str, Any]] = None
    created_at: datetime

class AIAssistantProviderTestRequest(BaseModel):
    test_message: str = "Hello, this is a test message."

class AIAssistantProviderTestResponse(BaseModel):
    success: bool
    response_time_ms: int
    status_code: int
    error_message: Optional[str] = None
    response_data: Optional[Dict[str, Any]] = None
    timestamp: str

    class Config:
        from_attributes = True