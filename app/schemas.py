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
    id: Optional[str] = None
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

class AliasesListResponse(BaseModel):
    aliases: List[AliasResponse]

class EvaluationsListResponse(BaseModel):
    evaluations: List[EvaluationRunResponse]
    total: int
    limit: int
    offset: int
    has_more: bool

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
    modules_count: Optional[int] = None
    prompts_count: Optional[int] = None

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
    content: str
    name: str
    description: Optional[str] = None
    provider_id: Optional[str] = None
    target_models: List[str] = Field(..., description="List of model providers (e.g., ['openai', 'claude', 'gemini'])")
    model_specific_prompts: List[ModelSpecificPrompt]
    mas_intent: str
    mas_fairness_notes: str
    mas_testing_notes: Optional[str] = None
    mas_risk_level: str
    mas_approval_log: Optional[Dict[str, Any]] = None
    is_active: bool = Field(default=True, description="Whether this prompt version is active and available for use")
    activation_reason: Optional[str] = Field(default=None, description="Reason for activation status change")

    model_config = ConfigDict(
        protected_namespaces=()
    )

class PromptResponse(BaseModel):
    id: str
    version: str
    module_id: str
    content: str
    name: str
    description: Optional[str] = None
    provider_id: Optional[str] = None
    provider_name: Optional[str] = None
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
    is_active: bool
    activated_at: Optional[datetime] = None
    activated_by: Optional[str] = None
    activation_reason: Optional[str] = None

    model_config = ConfigDict(
        protected_namespaces=(),
        from_attributes=True
    )

class PromptUpdate(BaseModel):
    content: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    provider_id: Optional[str] = None
    target_models: Optional[List[str]] = None
    model_specific_prompts: Optional[List[ModelSpecificPrompt]] = None
    mas_intent: Optional[str] = None
    mas_fairness_notes: Optional[str] = None
    mas_testing_notes: Optional[str] = None
    mas_risk_level: Optional[str] = None
    mas_approval_log: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = Field(default=None, description="Whether this prompt version is active and available for use")
    activation_reason: Optional[str] = Field(default=None, description="Reason for activation status change")
    version: Optional[str] = Field(default=None, description="New version number. Only allowed for prompts under review.")

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
class ApprovalRequestUpdate(BaseModel):
    status: Optional[str] = None
    approver: Optional[str] = None
    rejection_reason: Optional[str] = None
    comments: Optional[str] = None
    # Workflow integration
    evidence: Optional[Dict[str, Any]] = None
    workflow_action: Optional[str] = None  # "approve", "reject", "request_changes"

class ApprovalRequestCreate(BaseModel):
    prompt_id: str
    requested_by: str
    status: str
    approver: Optional[str] = None
    rejection_reason: Optional[str] = None
    comments: Optional[str] = None
    # Workflow integration
    workflow_definition_id: Optional[str] = None
    context: Optional[Dict[str, Any]] = None
    evidence: Optional[Dict[str, Any]] = None

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
    # Prompt version information
    prompt_version: str
    prompt_name: str
    prompt_description: Optional[str] = None
    prompt_is_active: bool
    prompt_created_by: str
    prompt_created_at: datetime

    class Config:
        from_attributes = True

class PromptComparisonResponse(BaseModel):
    """Schema for prompt comparison endpoint response"""
    approval_request: ApprovalRequestResponse
    current_active_prompt: Optional[PromptResponse] = None
    new_prompt_version: PromptResponse
    comparison_summary: Dict[str, Any] = {}

    class Config:
        from_attributes = True

class WorkflowStepInfo(BaseModel):
    step_index: Optional[int] = None
    step_name: Optional[str] = None
    step_type: Optional[str] = None
    required_roles: List[str] = []
    required_users: List[str] = []
    is_current_step: bool = False
    is_completed: bool = False
    status: Optional[str] = None

class WorkflowContext(BaseModel):
    has_workflow: bool = False
    workflow_instance_id: Optional[str] = None
    workflow_name: Optional[str] = None
    workflow_description: Optional[str] = None
    current_step: Optional[int] = None
    total_steps: Optional[int] = None
    workflow_status: Optional[str] = None
    current_step_info: Optional[WorkflowStepInfo] = None
    evidence_required: bool = False
    current_evidence: Dict[str, Any] = {}
    initiated_by: Optional[str] = None
    created_at: Optional[datetime] = None
    due_date: Optional[datetime] = None

class ApprovalRequestResponseEnhanced(BaseModel):
    id: str
    prompt_id: str
    requested_by: str
    requested_at: datetime
    status: str
    approver: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    comments: Optional[str] = None
    # Prompt version information
    prompt_version: str
    prompt_name: str
    prompt_description: Optional[str] = None
    prompt_is_active: bool
    prompt_created_by: str
    prompt_created_at: datetime
    # Workflow integration
    workflow_instance_id: Optional[str] = None
    workflow_step: Optional[int] = None
    evidence_required: bool = False
    evidence: Optional[Dict[str, Any]] = None
    workflow_context: Optional[WorkflowContext] = None
    # Permission context
    user_can_approve: bool = False
    user_can_reject: bool = False
    user_has_permission: bool = False

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
    is_active: bool
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
    is_active: Optional[bool] = None

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
    is_default: Optional[bool] = False

    model_config = ConfigDict(
        protected_namespaces=()
    )

class AIAssistantProviderUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    status: Optional[AIAssistantProviderStatus] = None
    api_key: Optional[str] = None
    api_base_url: Optional[str] = None
    model_name: Optional[str] = None
    organization: Optional[str] = None
    project: Optional[str] = None
    config_json: Optional[Dict[str, Any]] = None
    is_default: Optional[bool] = None

    model_config = ConfigDict(
        protected_namespaces=()
    )

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
    is_default: bool = False

    model_config = ConfigDict(
        protected_namespaces=(),
        from_attributes=True
    )


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
    is_default: bool = False

    model_config = ConfigDict(
        protected_namespaces=(),
        from_attributes=True
    )

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

# Governance System Schemas

class SecurityEventCreate(BaseModel):
    event_type: str = Field(..., pattern="^(login_attempt|login_success|login_failure|permission_denied|data_access|data_modification|config_change|security_policy_violation|suspicious_activity|rate_limit_exceeded|api_key_compromise)$")
    severity: str = Field(..., pattern="^(low|medium|high|critical)$")
    user_id: Optional[str] = None
    tenant_id: str
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    action: str
    description: str
    details_json: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    session_id: Optional[str] = None

class SecurityEventUpdate(BaseModel):
    is_resolved: Optional[bool] = None
    resolved_by: Optional[str] = None
    resolution_notes: Optional[str] = None

class SecurityEventResponse(BaseModel):
    id: str
    event_type: str
    severity: str
    user_id: Optional[str] = None
    tenant_id: str
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    action: str
    description: str
    details_json: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    session_id: Optional[str] = None
    is_resolved: bool
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    resolution_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class WorkflowDefinitionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    version: str = Field(..., min_length=1, max_length=20)
    category: str = Field(..., pattern="^(approval|compliance|security|access_control)$")
    trigger_condition: Dict[str, Any]
    steps_json: List[Dict[str, Any]]
    timeout_minutes: int = Field(default=1440, ge=1, le=10080)  # 1 minute to 1 week
    requires_evidence: bool = False
    auto_approve_threshold: Optional[int] = Field(None, ge=1)
    escalation_rules: Optional[Dict[str, Any]] = None
    notification_settings: Optional[Dict[str, Any]] = None
    tenant_id: str

class WorkflowDefinitionUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    status: Optional[str] = Field(None, pattern="^(draft|active|inactive|archived)$")
    trigger_condition: Optional[Dict[str, Any]] = None
    steps_json: Optional[List[Dict[str, Any]]] = None
    timeout_minutes: Optional[int] = Field(None, ge=1, le=10080)
    requires_evidence: Optional[bool] = None
    auto_approve_threshold: Optional[int] = Field(None, ge=1)
    escalation_rules: Optional[Dict[str, Any]] = None
    notification_settings: Optional[Dict[str, Any]] = None

class WorkflowDefinitionResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    version: str
    status: str
    category: str
    trigger_condition: Dict[str, Any]
    steps_json: List[Dict[str, Any]]
    timeout_minutes: int
    requires_evidence: bool
    auto_approve_threshold: Optional[int] = None
    escalation_rules: Optional[Dict[str, Any]] = None
    notification_settings: Optional[Dict[str, Any]] = None
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    tenant_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class WorkflowInstanceCreate(BaseModel):
    workflow_definition_id: str
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    resource_type: str
    resource_id: str
    context_json: Dict[str, Any]
    due_date: Optional[datetime] = None
    tenant_id: str

class WorkflowInstanceUpdate(BaseModel):
    status: Optional[str] = Field(None, pattern="^(pending|in_progress|completed|rejected|cancelled|error)$")
    current_step: Optional[int] = Field(None, ge=0)
    context_json: Optional[Dict[str, Any]] = None
    steps_json: Optional[List[Dict[str, Any]]] = None
    evidence: Optional[Dict[str, Any]] = None
    approvers: Optional[List[str]] = None
    current_assignee: Optional[str] = None
    due_date: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None

class WorkflowInstanceResponse(BaseModel):
    id: str
    workflow_definition_id: str
    status: str
    title: str
    description: Optional[str] = None
    resource_type: str
    resource_id: str
    initiated_by: Optional[str] = None
    current_step: int
    context_json: Dict[str, Any]
    steps_json: List[Dict[str, Any]]
    evidence: Optional[Dict[str, Any]] = None
    approvers: Optional[List[str]] = None
    current_assignee: Optional[str] = None
    due_date: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    tenant_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ComplianceReportCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    report_type: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    scope_json: Dict[str, Any]
    tenant_id: str

class ComplianceReportUpdate(BaseModel):
    status: Optional[str] = Field(None, pattern="^(generating|completed|failed|archived)$")
    findings: Optional[Dict[str, Any]] = None
    recommendations: Optional[Dict[str, Any]] = None
    metrics: Optional[Dict[str, Any]] = None
    file_path: Optional[str] = None
    file_size: Optional[int] = Field(None, ge=0)
    file_hash: Optional[str] = None

class ComplianceReportResponse(BaseModel):
    id: str
    name: str
    report_type: str
    description: Optional[str] = None
    status: str
    scope_json: Dict[str, Any]
    findings: Optional[Dict[str, Any]] = None
    recommendations: Optional[Dict[str, Any]] = None
    metrics: Optional[Dict[str, Any]] = None
    generated_by: Optional[str] = None
    tenant_id: str
    file_path: Optional[str] = None
    file_size: Optional[int] = None
    file_hash: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class PermissionTemplateCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    permissions: List[Dict[str, Any]]
    category: str = Field(..., pattern="^(admin|user|viewer|custom)$")
    is_active: bool = True
    tenant_id: str

class PermissionTemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    permissions: Optional[List[Dict[str, Any]]] = None
    category: Optional[str] = Field(None, pattern="^(admin|user|viewer|custom)$")
    is_active: Optional[bool] = None

class PermissionTemplateResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    permissions: List[Dict[str, Any]]
    category: str
    is_system: bool
    is_active: bool
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    tenant_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class RolePermissionCreate(BaseModel):
    role_name: str = Field(..., min_length=1, max_length=50)
    resource_type: str = Field(..., min_length=1, max_length=50)
    action: str = Field(..., min_length=1, max_length=50)
    conditions: Optional[Dict[str, Any]] = None
    permission_template_id: Optional[str] = None
    is_active: bool = True
    tenant_id: str

class RolePermissionUpdate(BaseModel):
    role_name: Optional[str] = Field(None, min_length=1, max_length=50)
    resource_type: Optional[str] = Field(None, min_length=1, max_length=50)
    action: Optional[str] = Field(None, min_length=1, max_length=50)
    conditions: Optional[Dict[str, Any]] = None
    permission_template_id: Optional[str] = None
    is_active: Optional[bool] = None

class RolePermissionResponse(BaseModel):
    id: str
    role_name: str
    resource_type: str
    action: str
    conditions: Optional[Dict[str, Any]] = None
    permission_template_id: Optional[str] = None
    is_active: bool
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    tenant_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class WorkflowStepAction(BaseModel):
    step_id: str
    action: str = Field(..., pattern="^(approve|reject|request_changes|escalate|assign|add_evidence)$")
    comments: Optional[str] = None
    evidence: Optional[Dict[str, Any]] = None
    assignee: Optional[str] = None

class BulkRolePermissionCreate(BaseModel):
    permissions: List[RolePermissionCreate]

class BulkRolePermissionResponse(BaseModel):
    created_count: int
    failed_count: int
    errors: List[Dict[str, str]]

class PermissionCheckRequest(BaseModel):
    role_name: str
    resource_type: str
    action: str
    context: Optional[Dict[str, Any]] = None

class PermissionCheckResponse(BaseModel):
    has_permission: bool
    reason: Optional[str] = None
    conditions_met: Optional[Dict[str, bool]] = None


# ============ ENHANCED RBAC SCHEMAS ============

class CustomRoleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    description: Optional[str] = Field(None, max_length=500)
    permissions: List[str] = []
    permission_templates: List[str] = []
    inherited_roles: List[str] = []
    inheritance_type: str = "none"
    conditions: Optional[Dict[str, Any]] = None

class CustomRoleUpdate(BaseModel):
    description: Optional[str] = Field(None, max_length=500)
    permissions: Optional[List[str]] = None
    permission_templates: Optional[List[str]] = None
    inherited_roles: Optional[List[str]] = None
    inheritance_type: Optional[str] = None
    conditions: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None

class CustomRoleResponse(BaseModel):
    name: str
    description: Optional[str] = None
    permissions: List[str]
    permission_templates: List[str]
    inherited_roles: List[str]
    inheritance_type: str
    conditions: Dict[str, Any]
    is_active: bool
    created_at: datetime
    created_by: Optional[str] = None
    updated_at: datetime
    updated_by: Optional[str] = None
    tenant_id: Optional[str] = None

    class Config:
        from_attributes = True

class PermissionTemplatePermission(BaseModel):
    resource_type: str = Field(..., min_length=1, max_length=50)
    action: str = Field(..., min_length=1, max_length=50)
    conditions: Optional[Dict[str, Any]] = None

class PermissionTemplateCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    permissions: List[PermissionTemplatePermission] = []
    category: Optional[str] = Field(None, max_length=50)

class PermissionTemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    permissions: Optional[List[PermissionTemplatePermission]] = None
    category: Optional[str] = Field(None, max_length=50)
    is_active: Optional[bool] = None

class PermissionTemplateResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    permissions: List[PermissionTemplatePermission]
    category: str
    is_system: bool
    is_active: bool
    created_at: datetime
    created_by: Optional[str] = None
    updated_at: datetime
    updated_by: Optional[str] = None
    tenant_id: Optional[str] = None

    class Config:
        from_attributes = True

class RoleInheritanceCreate(BaseModel):
    parent_role: str = Field(..., min_length=1, max_length=50)
    child_role: str = Field(..., min_length=1, max_length=50)
    inheritance_type: Optional[str] = "direct"
    conditions: Optional[Dict[str, Any]] = None

class RoleInheritanceUpdate(BaseModel):
    inheritance_type: Optional[str] = None
    conditions: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None

class RoleInheritanceResponse(BaseModel):
    parent_role: str
    child_role: str
    inheritance_type: str
    conditions: Dict[str, Any]
    is_active: bool
    created_at: datetime
    created_by: Optional[str] = None
    tenant_id: Optional[str] = None

    class Config:
        from_attributes = True

class ResourceSpecificPermissionCreate(BaseModel):
    role_name: str = Field(..., min_length=1, max_length=50)
    resource_type: str = Field(..., min_length=1, max_length=50)
    resource_id: str = Field(..., min_length=1)
    action: str = Field(..., min_length=1, max_length=50)
    conditions: Optional[Dict[str, Any]] = None
    expires_at: Optional[datetime] = None

class ResourceSpecificPermissionUpdate(BaseModel):
    conditions: Optional[Dict[str, Any]] = None
    expires_at: Optional[datetime] = None
    is_active: Optional[bool] = None

class ResourceSpecificPermissionResponse(BaseModel):
    id: str
    role_name: str
    resource_type: str
    resource_id: str
    action: str
    conditions: Dict[str, Any]
    expires_at: Optional[datetime] = None
    is_active: bool
    created_at: datetime
    created_by: Optional[str] = None
    tenant_id: Optional[str] = None

    class Config:
        from_attributes = True

class AccessReviewScope(BaseModel):
    users: Optional[List[str]] = None
    roles: Optional[List[str]] = None
    resources: Optional[List[Dict[str, Any]]] = None
    time_period: Optional[Dict[str, str]] = None

class AccessReviewCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    review_type: str = Field(..., pattern="^(periodic|event_based|user_driven)$")
    scope: AccessReviewScope
    reviewers: List[str] = Field(..., min_items=1)
    due_date: Optional[datetime] = None

class AccessReviewUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    reviewers: Optional[List[str]] = None
    due_date: Optional[datetime] = None
    status: Optional[str] = Field(None, pattern="^(pending|in_progress|completed|expired|cancelled)$")

class AccessReviewResponse(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    review_type: str
    scope: AccessReviewScope
    reviewers: List[str]
    status: str
    due_date: Optional[datetime] = None
    findings: List[Dict[str, Any]]
    recommendations: List[Dict[str, Any]]
    created_at: datetime
    created_by: Optional[str] = None
    completed_at: Optional[datetime] = None
    tenant_id: Optional[str] = None

    class Config:
        from_attributes = True

class BulkRoleAssignmentRequest(BaseModel):
    user_ids: List[str] = Field(..., min_items=1)
    role_names: List[str] = Field(..., min_items=1)
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    conditions: Optional[Dict[str, Any]] = None

class BulkRoleAssignmentResponse(BaseModel):
    success_count: int
    failure_count: int
    errors: List[str]
    details: List[Dict[str, Any]]

class BulkPermissionUpdateRequest(BaseModel):
    role_name: str = Field(..., min_length=1, max_length=50)
    updates: List[Dict[str, Any]] = Field(..., min_items=1)

class BulkPermissionUpdateResponse(BaseModel):
    success_count: int
    failure_count: int
    errors: List[str]

class EnhancedPermissionCheckRequest(BaseModel):
    user_roles: List[str] = Field(..., min_items=1)
    action: str = Field(..., min_length=1, max_length=50)
    resource_type: str = Field(..., min_length=1, max_length=50)
    resource_id: Optional[str] = None
    context: Optional[Dict[str, Any]] = None
    tenant_id: Optional[str] = None

class EnhancedPermissionCheckResponse(BaseModel):
    allowed: bool
    reason: str
    conditions_met: Dict[str, bool]

# ============ AUDIT LOG SCHEMAS ============

class AuditLogResponse(BaseModel):
    id: str
    actor: str
    action: str
    subject: str
    subject_type: str
    subject_id: str
    tenant_id: str
    before_json: Optional[Dict[str, Any]] = None
    after_json: Optional[Dict[str, Any]] = None
    changes_json: Optional[Dict[str, Any]] = None
    metadata_json: Optional[Dict[str, Any]] = None
    session_id: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    request_id: Optional[str] = None
    result: Optional[str] = None
    error_message: Optional[str] = None
    ts: datetime

    class Config:
        from_attributes = True

class AuditLogFilter(BaseModel):
    actor: Optional[str] = None
    action: Optional[str] = None
    subject_type: Optional[str] = None
    subject_id: Optional[str] = None
    result: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    ip_address: Optional[str] = None
    session_id: Optional[str] = None
    request_id: Optional[str] = None
    search: Optional[str] = None
    skip: int = 0
    limit: int = 100

class AuditLogExportRequest(BaseModel):
    filters: AuditLogFilter
    format: str = Field(..., pattern="^(json|csv|xlsx)$")
    include_metadata: bool = True
    include_changes: bool = True

class AuditLogExportResponse(BaseModel):
    export_id: str
    file_url: Optional[str] = None
    status: str
    total_records: int
    estimated_size: Optional[int] = None
    created_at: datetime

class AuditLogStats(BaseModel):
    total_events: int
    events_by_action: Dict[str, int]
    events_by_subject_type: Dict[str, int]
    events_by_actor: Dict[str, int]
    events_by_result: Dict[str, int]
    events_by_date: Dict[str, int]
    top_actors: List[Dict[str, Any]]
    top_resources: List[Dict[str, Any]]
    recent_errors: List[Dict[str, Any]]
    effective_permissions: List[str]
    inheritance_chain: List[str]

# Enhanced Workflow Schemas

class WorkflowStepCreate(BaseModel):
    workflow_definition_id: str
    step_type: str
    step_number: int
    name: str
    description: Optional[str] = None
    config_json: Dict[str, Any]
    condition_type: Optional[str] = None
    condition_config: Optional[Dict[str, Any]] = None
    approval_required: bool = False
    approval_roles: Optional[List[str]] = None
    approval_users: Optional[List[str]] = None
    min_approvals: int = 1
    auto_approve_after: Optional[int] = None
    timeout_minutes: Optional[int] = None
    is_optional: bool = False
    can_skip: bool = False
    parent_step_id: Optional[str] = None
    child_steps: Optional[List[str]] = None
    outputs: Optional[Dict[str, Any]] = None
    transitions: Optional[Dict[str, Any]] = None

class WorkflowStepResponse(BaseModel):
    id: str
    workflow_definition_id: str
    step_type: str
    step_number: int
    name: str
    description: Optional[str] = None
    config_json: Dict[str, Any]
    condition_type: Optional[str] = None
    condition_config: Optional[Dict[str, Any]] = None
    approval_required: bool
    approval_roles: Optional[List[str]] = None
    approval_users: Optional[List[str]] = None
    min_approvals: int
    auto_approve_after: Optional[int] = None
    timeout_minutes: Optional[int] = None
    is_optional: bool
    can_skip: bool
    parent_step_id: Optional[str] = None
    child_steps: Optional[List[str]] = None
    outputs: Optional[Dict[str, Any]] = None
    transitions: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class WorkflowStepUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    config_json: Optional[Dict[str, Any]] = None
    condition_type: Optional[str] = None
    condition_config: Optional[Dict[str, Any]] = None
    approval_required: Optional[bool] = None
    approval_roles: Optional[List[str]] = None
    approval_users: Optional[List[str]] = None
    min_approvals: Optional[int] = None
    auto_approve_after: Optional[int] = None
    timeout_minutes: Optional[int] = None
    is_optional: Optional[bool] = None
    can_skip: Optional[bool] = None
    parent_step_id: Optional[str] = None
    child_steps: Optional[List[str]] = None
    outputs: Optional[Dict[str, Any]] = None
    transitions: Optional[Dict[str, Any]] = None

class WorkflowStepExecutionCreate(BaseModel):
    workflow_instance_id: str
    workflow_step_id: str
    step_number: int
    step_type: str
    config_json: Dict[str, Any]
    input_data: Optional[Dict[str, Any]] = None
    approvers: Optional[List[str]] = None
    due_date: Optional[datetime] = None

class WorkflowStepExecutionResponse(BaseModel):
    id: str
    workflow_instance_id: str
    workflow_step_id: Optional[str] = None
    step_number: int
    step_type: str
    status: str
    config_json: Dict[str, Any]
    input_data: Optional[Dict[str, Any]] = None
    output_data: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    approvers: Optional[List[str]] = None
    approvals_received: Optional[List[Dict[str, Any]]] = None
    rejections_received: Optional[List[Dict[str, Any]]] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    due_date: Optional[datetime] = None
    executed_by: Optional[str] = None
    execution_time_ms: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class WorkflowStepExecutionUpdate(BaseModel):
    status: Optional[str] = None
    input_data: Optional[Dict[str, Any]] = None
    output_data: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    approvals_received: Optional[List[Dict[str, Any]]] = None
    rejections_received: Optional[List[Dict[str, Any]]] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    due_date: Optional[datetime] = None
    executed_by: Optional[str] = None
    execution_time_ms: Optional[int] = None

class WorkflowEscalationRuleCreate(BaseModel):
    workflow_definition_id: str
    step_number: Optional[int] = None
    escalation_type: str
    trigger_condition: Dict[str, Any]
    target_roles: Optional[List[str]] = None
    target_users: Optional[List[str]] = None
    notification_method: Optional[str] = None
    notification_config: Optional[Dict[str, Any]] = None
    escalation_delay_minutes: int = 0
    max_escalation_level: int = 3
    auto_approve: bool = False
    auto_reject: bool = False
    reassign_to: Optional[str] = None

class WorkflowEscalationRuleResponse(BaseModel):
    id: str
    workflow_definition_id: str
    step_number: Optional[int] = None
    escalation_type: str
    trigger_condition: Dict[str, Any]
    target_roles: Optional[List[str]] = None
    target_users: Optional[List[str]] = None
    notification_method: Optional[str] = None
    notification_config: Optional[Dict[str, Any]] = None
    escalation_delay_minutes: int
    max_escalation_level: int
    auto_approve: bool
    auto_reject: bool
    reassign_to: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class WorkflowEscalationRuleUpdate(BaseModel):
    step_number: Optional[int] = None
    escalation_type: Optional[str] = None
    trigger_condition: Optional[Dict[str, Any]] = None
    target_roles: Optional[List[str]] = None
    target_users: Optional[List[str]] = None
    notification_method: Optional[str] = None
    notification_config: Optional[Dict[str, Any]] = None
    escalation_delay_minutes: Optional[int] = None
    max_escalation_level: Optional[int] = None
    auto_approve: Optional[bool] = None
    auto_reject: Optional[bool] = None
    reassign_to: Optional[str] = None
    is_active: Optional[bool] = None

class WorkflowTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category: str
    use_case: str
    workflow_definition: Dict[str, Any]
    steps_config: List[Dict[str, Any]]
    escalation_rules: Optional[List[Dict[str, Any]]] = None
    is_system: bool = False
    is_public: bool = False
    required_roles: Optional[List[str]] = None
    version: str = "1.0.0"

class WorkflowTemplateResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    category: str
    use_case: str
    workflow_definition: Dict[str, Any]
    steps_config: List[Dict[str, Any]]
    escalation_rules: Optional[List[Dict[str, Any]]] = None
    is_system: bool
    is_public: bool
    required_roles: Optional[List[str]] = None
    version: str
    status: str
    usage_count: int
    created_by: Optional[str] = None
    tenant_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class WorkflowTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    use_case: Optional[str] = None
    workflow_definition: Optional[Dict[str, Any]] = None
    steps_config: Optional[List[Dict[str, Any]]] = None
    escalation_rules: Optional[List[Dict[str, Any]]] = None
    is_public: Optional[bool] = None
    required_roles: Optional[List[str]] = None
    version: Optional[str] = None
    status: Optional[str] = None

class WorkflowNotificationCreate(BaseModel):
    workflow_instance_id: str
    step_execution_id: Optional[str] = None
    notification_type: str
    recipient_type: str
    recipient: str
    subject: Optional[str] = None
    message: str
    template_data: Optional[Dict[str, Any]] = None
    priority: str = "normal"
    max_retries: int = 3

class WorkflowNotificationResponse(BaseModel):
    id: str
    workflow_instance_id: str
    step_execution_id: Optional[str] = None
    notification_type: str
    recipient_type: str
    recipient: str
    subject: Optional[str] = None
    message: str
    template_data: Optional[Dict[str, Any]] = None
    status: str
    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    error_message: Optional[str] = None
    priority: str
    retry_count: int
    max_retries: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class WorkflowNotificationUpdate(BaseModel):
    status: Optional[str] = None
    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    error_message: Optional[str] = None
    retry_count: Optional[int] = None

class WorkflowMetricsCreate(BaseModel):
    workflow_definition_id: str
    workflow_instance_id: Optional[str] = None
    tenant_id: str
    total_duration_minutes: Optional[int] = None
    step_duration_minutes: Optional[Dict[str, Any]] = None
    approval_time_minutes: Optional[int] = None
    escalation_count: int = 0
    success_rate: Optional[str] = None
    completion_rate: Optional[str] = None
    timeout_count: int = 0
    sla_met: Optional[bool] = None
    sla_breach_minutes: Optional[int] = None
    average_steps_completed: Optional[str] = None
    average_approvals_per_workflow: Optional[str] = None
    user_satisfaction_score: Optional[str] = None
    metric_date: datetime
    is_aggregated: bool = False

class WorkflowMetricsResponse(BaseModel):
    id: str
    workflow_definition_id: str
    workflow_instance_id: Optional[str] = None
    tenant_id: str
    total_duration_minutes: Optional[int] = None
    step_duration_minutes: Optional[Dict[str, Any]] = None
    approval_time_minutes: Optional[int] = None
    escalation_count: int
    success_rate: Optional[str] = None
    completion_rate: Optional[str] = None
    timeout_count: int
    sla_met: Optional[bool] = None
    sla_breach_minutes: Optional[int] = None
    average_steps_completed: Optional[str] = None
    average_approvals_per_workflow: Optional[str] = None
    user_satisfaction_score: Optional[str] = None
    metric_date: datetime
    is_aggregated: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class WorkflowMetricsUpdate(BaseModel):
    total_duration_minutes: Optional[int] = None
    step_duration_minutes: Optional[Dict[str, Any]] = None
    approval_time_minutes: Optional[int] = None
    escalation_count: Optional[int] = None
    success_rate: Optional[str] = None
    completion_rate: Optional[str] = None
    timeout_count: Optional[int] = None
    sla_met: Optional[bool] = None
    sla_breach_minutes: Optional[int] = None
    average_steps_completed: Optional[str] = None
    average_approvals_per_workflow: Optional[str] = None
    user_satisfaction_score: Optional[str] = None

class WorkflowEngineRequest(BaseModel):
    workflow_definition_id: str
    resource_type: str
    resource_id: str
    context: Dict[str, Any]
    initiated_by: str
    due_date: Optional[datetime] = None
    priority: str = "normal"
    metadata: Optional[Dict[str, Any]] = None

class WorkflowEngineResponse(BaseModel):
    workflow_instance_id: str
    status: str
    message: str
    current_step: int
    next_steps: List[Dict[str, Any]]
    estimated_completion_time: Optional[datetime] = None
    assignees: List[str]
    notifications_sent: List[str]

class WorkflowApprovalAction(BaseModel):
    action: str = Field(..., pattern="^(approve|reject|request_changes|escalate|delegate)$")
    workflow_step_execution_id: str
    comments: Optional[str] = None
    evidence: Optional[Dict[str, Any]] = None
    delegate_to: Optional[str] = None
    escalation_level: Optional[int] = None

class WorkflowApprovalResponse(BaseModel):
    success: bool
    message: str
    workflow_instance_id: str
    current_status: str
    next_step: Optional[Dict[str, Any]] = None

# Security Monitoring Schemas

class SecurityAlertCreate(BaseModel):
    alert_type: str
    severity: str
    title: str
    description: str
    source: Optional[str] = None
    source_id: Optional[str] = None
    detection_details: Dict[str, Any]
    affected_resources: Optional[Dict[str, Any]] = None
    risk_score: Optional[str] = None
    confidence_score: Optional[str] = None
    tenant_id: str
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None

class SecurityAlertUpdate(BaseModel):
    status: Optional[str] = None
    assigned_to: Optional[str] = None
    investigation_notes: Optional[Dict[str, Any]] = None
    resolution_details: Optional[Dict[str, Any]] = None
    false_positive_reason: Optional[str] = None
    related_incident: Optional[str] = None

class SecurityAlertResponse(BaseModel):
    id: str
    alert_type: str
    severity: str
    status: str
    title: str
    description: str
    source: Optional[str] = None
    source_id: Optional[str] = None
    detection_details: Dict[str, Any]
    affected_resources: Optional[Dict[str, Any]] = None
    risk_score: Optional[str] = None
    confidence_score: Optional[str] = None
    tenant_id: str
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    assigned_to: Optional[str] = None
    investigation_notes: Optional[Dict[str, Any]] = None
    resolution_details: Optional[Dict[str, Any]] = None
    false_positive_reason: Optional[str] = None
    related_incident: Optional[str] = None
    detected_at: datetime
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class SecurityIncidentCreate(BaseModel):
    incident_type: str
    severity: str
    title: str
    description: str
    summary: Optional[str] = None
    detection_method: Optional[str] = None
    classification: Optional[str] = None
    impact_score: Optional[str] = None
    affected_systems: Optional[Dict[str, Any]] = None
    data_affected: Optional[Dict[str, Any]] = None
    business_impact: Optional[str] = None
    tenant_id: str
    reported_by: Optional[str] = None
    assigned_to: Optional[str] = None
    related_alerts: Optional[List[str]] = None
    related_events: Optional[List[str]] = None

class SecurityIncidentUpdate(BaseModel):
    status: Optional[str] = None
    classification: Optional[str] = None
    impact_score: Optional[str] = None
    affected_systems: Optional[Dict[str, Any]] = None
    data_affected: Optional[Dict[str, Any]] = None
    business_impact: Optional[str] = None
    response_team: Optional[Dict[str, Any]] = None
    containment_actions: Optional[Dict[str, Any]] = None
    eradication_actions: Optional[Dict[str, Any]] = None
    recovery_actions: Optional[Dict[str, Any]] = None
    investigation_findings: Optional[Dict[str, Any]] = None
    root_cause: Optional[str] = None
    lessons_learned: Optional[str] = None
    assigned_to: Optional[str] = None
    compliance_impact: Optional[Dict[str, Any]] = None
    report_required: Optional[bool] = None
    report_filed: Optional[bool] = None
    report_details: Optional[Dict[str, Any]] = None

class SecurityIncidentResponse(BaseModel):
    id: str
    incident_type: str
    severity: str
    status: str
    title: str
    description: str
    summary: Optional[str] = None
    detection_method: Optional[str] = None
    classification: Optional[str] = None
    impact_score: Optional[str] = None
    affected_systems: Optional[Dict[str, Any]] = None
    data_affected: Optional[Dict[str, Any]] = None
    business_impact: Optional[str] = None
    response_team: Optional[Dict[str, Any]] = None
    containment_actions: Optional[Dict[str, Any]] = None
    eradication_actions: Optional[Dict[str, Any]] = None
    recovery_actions: Optional[Dict[str, Any]] = None
    investigation_findings: Optional[Dict[str, Any]] = None
    root_cause: Optional[str] = None
    lessons_learned: Optional[str] = None
    detected_at: datetime
    contained_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    tenant_id: str
    reported_by: Optional[str] = None
    assigned_to: Optional[str] = None
    related_alerts: Optional[List[str]] = None
    related_events: Optional[List[str]] = None
    compliance_impact: Optional[Dict[str, Any]] = None
    report_required: bool
    report_filed: bool
    report_details: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class SecurityMetricsCreate(BaseModel):
    tenant_id: str
    metric_date: datetime
    total_security_events: Optional[int] = 0
    critical_events: Optional[int] = 0
    high_severity_events: Optional[int] = 0
    medium_severity_events: Optional[int] = 0
    low_severity_events: Optional[int] = 0
    total_alerts: Optional[int] = 0
    open_alerts: Optional[int] = 0
    resolved_alerts: Optional[int] = 0
    false_positive_alerts: Optional[int] = 0
    total_incidents: Optional[int] = 0
    active_incidents: Optional[int] = 0
    resolved_incidents: Optional[int] = 0
    mean_time_to_resolve_minutes: Optional[int] = None
    anomaly_score: Optional[str] = None
    baseline_anomaly_score: Optional[str] = None
    anomaly_detection_count: Optional[int] = 0
    compliance_score: Optional[str] = None
    policy_violations: Optional[int] = 0
    compliance_checks_passed: Optional[int] = 0
    compliance_checks_failed: Optional[int] = 0
    threat_indicators_detected: Optional[int] = 0
    known_threats_blocked: Optional[int] = 0
    suspicious_ips_blocked: Optional[int] = 0
    avg_response_time_ms: Optional[int] = None
    system_load_score: Optional[str] = None
    unique_active_users: Optional[int] = 0
    suspicious_user_activities: Optional[int] = 0
    metrics_json: Optional[Dict[str, Any]] = None

class SecurityMetricsResponse(BaseModel):
    id: str
    tenant_id: str
    metric_date: datetime
    total_security_events: int
    critical_events: int
    high_severity_events: int
    medium_severity_events: int
    low_severity_events: int
    total_alerts: int
    open_alerts: int
    resolved_alerts: int
    false_positive_alerts: int
    total_incidents: int
    active_incidents: int
    resolved_incidents: int
    mean_time_to_resolve_minutes: Optional[int] = None
    anomaly_score: Optional[str] = None
    baseline_anomaly_score: Optional[str] = None
    anomaly_detection_count: int
    compliance_score: Optional[str] = None
    policy_violations: int
    compliance_checks_passed: int
    compliance_checks_failed: int
    threat_indicators_detected: int
    known_threats_blocked: int
    suspicious_ips_blocked: int
    avg_response_time_ms: Optional[int] = None
    system_load_score: Optional[str] = None
    unique_active_users: int
    suspicious_user_activities: int
    metrics_json: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ThreatIntelligenceFeedCreate(BaseModel):
    name: str
    description: Optional[str] = None
    feed_type: str
    source_url: Optional[str] = None
    api_endpoint: Optional[str] = None
    is_active: bool = True
    update_frequency_minutes: int = 60
    api_key: Optional[str] = None
    auth_config: Optional[Dict[str, Any]] = None
    tenant_id: str

class ThreatIntelligenceFeedUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    feed_type: Optional[str] = None
    source_url: Optional[str] = None
    api_endpoint: Optional[str] = None
    is_active: Optional[bool] = None
    update_frequency_minutes: Optional[int] = None
    api_key: Optional[str] = None
    auth_config: Optional[Dict[str, Any]] = None

class ThreatIntelligenceFeedResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    feed_type: str
    source_url: Optional[str] = None
    api_endpoint: Optional[str] = None
    is_active: bool
    update_frequency_minutes: int
    last_updated_at: Optional[datetime] = None
    next_update_at: Optional[datetime] = None
    status: str
    error_message: Optional[str] = None
    total_indicators: int
    new_indicators_last_update: int
    tenant_id: str
    created_by: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class AnomalyDetectionRuleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    rule_type: str
    target_metric: str
    detection_config: Dict[str, Any]
    threshold_config: Dict[str, Any]
    sensitivity: Optional[str] = None
    alert_on_detection: bool = True
    alert_severity: Optional[str] = None
    alert_message_template: Optional[str] = None
    is_active: bool = True
    evaluation_frequency_minutes: int = 5
    scope_config: Optional[Dict[str, Any]] = None
    tenant_id: str

class AnomalyDetectionRuleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    rule_type: Optional[str] = None
    target_metric: Optional[str] = None
    detection_config: Optional[Dict[str, Any]] = None
    threshold_config: Optional[Dict[str, Any]] = None
    sensitivity: Optional[str] = None
    alert_on_detection: Optional[bool] = None
    alert_severity: Optional[str] = None
    alert_message_template: Optional[str] = None
    is_active: Optional[bool] = None
    evaluation_frequency_minutes: Optional[int] = None
    scope_config: Optional[Dict[str, Any]] = None

class AnomalyDetectionRuleResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    rule_type: str
    target_metric: str
    detection_config: Dict[str, Any]
    threshold_config: Dict[str, Any]
    sensitivity: Optional[str] = None
    alert_on_detection: bool
    alert_severity: Optional[str] = None
    alert_message_template: Optional[str] = None
    is_active: bool
    evaluation_frequency_minutes: int
    scope_config: Optional[Dict[str, Any]] = None
    total_detections: int
    true_positives: int
    false_positives: int
    last_detection_at: Optional[datetime] = None
    tenant_id: str
    created_by: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class SecurityDashboardMetrics(BaseModel):
    total_events: int
    critical_events: int
    high_severity_events: int
    active_alerts: int
    critical_alerts: int
    active_incidents: int
    critical_incidents: int
    compliance_score: Optional[str] = None
    threat_indicators: int
    blocked_threats: int
    anomaly_score: Optional[str] = None
    mean_time_to_resolve_minutes: Optional[int] = None
    unique_active_users: int
    suspicious_activities: int

class SecurityEventFilter(BaseModel):
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    event_types: Optional[List[str]] = None
    severities: Optional[List[str]] = None
    user_id: Optional[str] = None
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    ip_address: Optional[str] = None
    is_resolved: Optional[bool] = None
    limit: int = 100
    offset: int = 0

class SecurityAlertFilter(BaseModel):
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    alert_types: Optional[List[str]] = None
    severities: Optional[List[str]] = None
    statuses: Optional[List[str]] = None
    assigned_to: Optional[str] = None
    user_id: Optional[str] = None
    source: Optional[str] = None
    limit: int = 100
    offset: int = 0

class SecurityIncidentFilter(BaseModel):
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    incident_types: Optional[List[str]] = None
    severities: Optional[List[str]] = None
    statuses: Optional[List[str]] = None
    assigned_to: Optional[str] = None
    reported_by: Optional[str] = None
    limit: int = 100
    offset: int = 0

class AnomalyDetectionRequest(BaseModel):
    rule_id: str
    metric_value: float
    timestamp: datetime
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    context_data: Optional[Dict[str, Any]] = None

class AnomalyDetectionResponse(BaseModel):
    is_anomaly: bool
    anomaly_score: float
    baseline_value: Optional[float] = None
    confidence_level: Optional[str] = None
    severity: Optional[str] = None
    contributing_factors: Optional[List[str]] = None
    alert_generated: bool
    alert_id: Optional[str] = None

class SecurityThreatIntelligenceRequest(BaseModel):
    indicator_type: str
    indicator_value: str
    check_active_only: bool = True

class SecurityThreatIntelligenceResponse(BaseModel):
    is_threat: bool
    threat_type: Optional[str] = None
    threat_actor: Optional[str] = None
    confidence_score: Optional[str] = None
    severity: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    is_blocked: bool
    block_reason: Optional[str] = None
    first_seen: Optional[datetime] = None
    last_seen: Optional[datetime] = None
    expires_at: Optional[datetime] = None


class ThreatIndicatorResponse(BaseModel):
    id: str
    indicator_type: str
    value: str
    description: Optional[str] = None
    threat_types: List[str] = []
    confidence_level: Optional[str] = None
    source: Optional[str] = None
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    tags: List[str] = []
    metadata: Dict[str, Any] = {}


# Model Testing Schemas
class ModelTestRequest(BaseModel):
    system_prompt: str
    user_message: str
    providers: List[str] = Field(default_factory=list)  # Optional: specific providers to test
    test_type: str = Field(default="all", pattern="^(all|selected)$")


class ModelTestResult(BaseModel):
    provider_id: str
    provider_name: str
    provider_type: str
    response_content: str
    response_time_ms: int
    tokens_used: Optional[int] = None
    error: Optional[str] = None
    status: str = Field(pattern="^(success|error|timeout)$")


class ModelTestResponse(BaseModel):
    results: List[ModelTestResult]
    total_providers: int
    successful_tests: int
    failed_tests: int
    test_execution_time_ms: int


# A/B Testing Framework Schemas

class ExperimentStatus(str, enum.Enum):
    DRAFT = "draft"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class TrafficAllocationStrategy(str, enum.Enum):
    UNIFORM = "uniform"
    WEIGHTED = "weighted"
    STICKY = "sticky"
    GEOGRAPHIC = "geographic"
    USER_ATTRIBUTE = "user_attribute"

class EventType(str, enum.Enum):
    PROMPT_REQUEST = "prompt_request"
    PROMPT_RENDER = "prompt_render"
    MODEL_RESPONSE = "model_response"
    CONVERSION = "conversion"
    ERROR = "error"
    CUSTOM = "custom"

class ExperimentVariant(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    weight: int = Field(default=1, ge=1, le=100)
    prompt_config: Dict[str, Any] = Field(default_factory=dict)
    is_control: bool = False

class ExperimentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    project_id: str
    prompt_id: str
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    traffic_percentage: int = Field(default=50, ge=1, le=100)
    allocation_strategy: TrafficAllocationStrategy = TrafficAllocationStrategy.UNIFORM
    target_audience: Optional[Dict[str, Any]] = None
    geographic_targeting: Optional[Dict[str, Any]] = None
    user_attributes: Optional[Dict[str, Any]] = None
    min_sample_size: int = Field(default=1000, ge=100)
    statistical_significance: int = Field(default=95, ge=80, le=99)
    primary_metric: str = Field(..., min_length=1)
    secondary_metrics: Optional[List[str]] = None
    control_variant: ExperimentVariant
    treatment_variants: List[ExperimentVariant] = Field(..., min_items=1)

class ExperimentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    status: Optional[ExperimentStatus] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    traffic_percentage: Optional[int] = Field(None, ge=1, le=100)
    target_audience: Optional[Dict[str, Any]] = None
    geographic_targeting: Optional[Dict[str, Any]] = None
    user_attributes: Optional[Dict[str, Any]] = None
    min_sample_size: Optional[int] = Field(None, ge=100)
    statistical_significance: Optional[int] = Field(None, ge=80, le=99)
    primary_metric: Optional[str] = Field(None, min_length=1)
    secondary_metrics: Optional[List[str]] = None

class ExperimentResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    project_id: str
    prompt_id: str
    status: ExperimentStatus
    start_time: Optional[datetime]
    end_time: Optional[datetime]
    traffic_percentage: int
    allocation_strategy: TrafficAllocationStrategy
    target_audience: Optional[Dict[str, Any]]
    geographic_targeting: Optional[Dict[str, Any]]
    user_attributes: Optional[Dict[str, Any]]
    min_sample_size: int
    statistical_significance: int
    primary_metric: str
    secondary_metrics: Optional[List[str]]
    control_variant: ExperimentVariant
    treatment_variants: List[ExperimentVariant]
    results: Optional[Dict[str, Any]]
    winner_determined: bool
    winning_variant: Optional[str]
    created_by: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ExperimentAssignmentCreate(BaseModel):
    experiment_id: str
    user_id: Optional[str] = None
    session_id: str
    device_id: Optional[str] = None
    variant_id: str
    variant_name: str
    variant_config: Dict[str, Any]
    assignment_reason: Optional[str] = None
    is_consistent: bool = True

class ExperimentAssignmentResponse(BaseModel):
    id: str
    experiment_id: str
    user_id: Optional[str]
    session_id: str
    device_id: Optional[str]
    variant_id: str
    variant_name: str
    variant_config: Dict[str, Any]
    assigned_at: datetime
    assignment_reason: Optional[str]
    is_consistent: bool

    model_config = ConfigDict(from_attributes=True)

class ExperimentEventCreate(BaseModel):
    experiment_id: str
    assignment_id: Optional[str] = None
    event_type: EventType
    event_name: str
    event_data: Optional[Dict[str, Any]] = None
    user_id: Optional[str] = None
    session_id: str
    device_id: Optional[str] = None
    response_time_ms: Optional[int] = None
    tokens_used: Optional[int] = None
    cost_usd: Optional[str] = None
    conversion_value: Optional[str] = None
    success_indicator: Optional[bool] = None
    error_message: Optional[str] = None
    occurred_at: Optional[datetime] = None

class ExperimentEventResponse(BaseModel):
    id: str
    experiment_id: str
    assignment_id: Optional[str]
    event_type: EventType
    event_name: str
    event_data: Optional[Dict[str, Any]]
    user_id: Optional[str]
    session_id: str
    device_id: Optional[str]
    response_time_ms: Optional[int]
    tokens_used: Optional[int]
    cost_usd: Optional[str]
    conversion_value: Optional[str]
    success_indicator: Optional[bool]
    error_message: Optional[str]
    occurred_at: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ExperimentResultResponse(BaseModel):
    id: str
    experiment_id: str
    variant_id: str
    variant_name: str
    sample_size: int
    conversion_count: int
    conversion_rate: str
    confidence_interval_lower: str
    confidence_interval_upper: str
    p_value: str
    statistical_significance: bool
    average_response_time: Optional[int]
    average_tokens_used: Optional[int]
    total_cost: Optional[str]
    metric_period_start: datetime
    metric_period_end: datetime
    is_control: bool
    calculation_method: str
    calculated_at: datetime
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class FeatureFlagCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    project_id: str
    prompt_id: Optional[str] = None
    enabled: bool = False
    rollout_percentage: int = Field(default=0, ge=0, le=100)
    rollout_strategy: TrafficAllocationStrategy = TrafficAllocationStrategy.UNIFORM
    targeting_rules: Optional[Dict[str, Any]] = None
    is_staged_rollout: bool = False
    current_stage: int = Field(default=1, ge=1)
    total_stages: int = Field(default=5, ge=1)
    stage_rollout_percentage: Optional[List[int]] = None
    is_canary_release: bool = False
    canary_percentage: int = Field(default=5, ge=1, le=50)
    canary_duration_hours: int = Field(default=24, ge=1)
    scheduled_enable_time: Optional[datetime] = None
    scheduled_disable_time: Optional[datetime] = None

class FeatureFlagUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    enabled: Optional[bool] = None
    rollout_percentage: Optional[int] = Field(None, ge=0, le=100)
    rollout_strategy: Optional[TrafficAllocationStrategy] = None
    targeting_rules: Optional[Dict[str, Any]] = None
    is_staged_rollout: Optional[bool] = None
    current_stage: Optional[int] = Field(None, ge=1)
    total_stages: Optional[int] = Field(None, ge=1)
    stage_rollout_percentage: Optional[List[int]] = None
    is_canary_release: Optional[bool] = None
    canary_percentage: Optional[int] = Field(None, ge=1, le=50)
    canary_duration_hours: Optional[int] = Field(None, ge=1)
    scheduled_enable_time: Optional[datetime] = None
    scheduled_disable_time: Optional[datetime] = None

class FeatureFlagResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    project_id: str
    prompt_id: Optional[str]
    enabled: bool
    rollout_percentage: int
    rollout_strategy: TrafficAllocationStrategy
    targeting_rules: Optional[Dict[str, Any]]
    is_staged_rollout: bool
    current_stage: int
    total_stages: int
    stage_rollout_percentage: Optional[List[int]]
    is_canary_release: bool
    canary_percentage: int
    canary_duration_hours: int
    scheduled_enable_time: Optional[datetime]
    scheduled_disable_time: Optional[datetime]
    created_by: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class UserSegmentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    project_id: str
    segment_conditions: Dict[str, Any]
    segment_type: str = Field(..., min_length=1)
    estimated_user_count: int = Field(default=0, ge=0)

class UserSegmentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    segment_conditions: Optional[Dict[str, Any]] = None
    segment_type: Optional[str] = Field(None, min_length=1)
    estimated_user_count: Optional[int] = Field(None, ge=0)
    is_active: Optional[bool] = None

class UserSegmentResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    project_id: str
    segment_conditions: Dict[str, Any]
    segment_type: str
    estimated_user_count: int
    actual_user_count: int
    is_active: bool
    created_by: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ExperimentStats(BaseModel):
    total_experiments: int
    active_experiments: int
    completed_experiments: int
    total_events: int
    total_assignments: int
    experiments_by_project: Dict[str, int]
    events_by_type: Dict[str, int]

class VariantPerformance(BaseModel):
    variant_id: str
    variant_name: str
    sample_size: int
    conversion_rate: float
    confidence_interval_lower: float
    confidence_interval_upper: float
    p_value: float
    is_winner: bool
    improvement_over_control: float
