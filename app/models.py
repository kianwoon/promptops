from sqlalchemy import Column, String, DateTime, Integer, Boolean, JSON, ForeignKey, Enum, ForeignKeyConstraint, UniqueConstraint, text, select, func
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from sqlalchemy.ext.hybrid import hybrid_property
from app.database import Base
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

    class AIAssistantConversationStatus(enum.Enum):
        active = "active"
        archived = "archived"
        deleted = "deleted"

    class AIAssistantMessageRole(enum.Enum):
        user = "user"
        assistant = "assistant"
        system = "system"

class UserRole(enum.Enum):
    ADMIN = "admin"
    EDITOR = "editor"
    APPROVER = "approver"
    USER = "user"
    VIEWER = "viewer"

class AuthProvider(enum.Enum):
    LOCAL = "local"
    GOOGLE = "google"
    GITHUB = "github"

class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True)
    email = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.VIEWER, nullable=False)
    organization = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    company_size = Column(String, nullable=True)
    avatar = Column(String, nullable=True)
    
    # OAuth fields
    provider = Column(Enum(AuthProvider), default=AuthProvider.LOCAL, nullable=True)
    provider_id = Column(String, nullable=True, index=True)
    is_verified = Column(Boolean, default=False, nullable=False)
    
    # Authentication
    hashed_password = Column(String, nullable=True)

    # Status
    is_active = Column(Boolean, default=True, nullable=False)

    # AI Assistant defaults
    default_ai_provider_id = Column(String, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    ai_assistant_providers = relationship("AIAssistantProvider", back_populates="user", cascade="all, delete-orphan")
    ai_assistant_conversations = relationship("AIAssistantConversation", back_populates="user", cascade="all, delete-orphan")

    # Governance relationships
    created_workflow_definitions = relationship("WorkflowDefinition", foreign_keys="WorkflowDefinition.created_by", back_populates="creator")
    updated_workflow_definitions = relationship("WorkflowDefinition", foreign_keys="WorkflowDefinition.updated_by", back_populates="updater")
    initiated_workflow_instances = relationship("WorkflowInstance", foreign_keys="WorkflowInstance.initiated_by", back_populates="initiator")
    assigned_workflow_instances = relationship("WorkflowInstance", foreign_keys="WorkflowInstance.current_assignee", back_populates="assignee")

    created_permission_templates = relationship("PermissionTemplate", foreign_keys="PermissionTemplate.created_by", back_populates="creator")
    updated_permission_templates = relationship("PermissionTemplate", foreign_keys="PermissionTemplate.updated_by", back_populates="updater")
    created_role_permissions = relationship("RolePermission", foreign_keys="RolePermission.created_by", back_populates="creator")
    updated_role_permissions = relationship("RolePermission", foreign_keys="RolePermission.updated_by", back_populates="updater")

    generated_compliance_reports = relationship("ComplianceReport", foreign_keys="ComplianceReport.generated_by", back_populates="generator")

    # Security and audit relationships
    security_events = relationship("SecurityEvent", foreign_keys="SecurityEvent.user_id", back_populates="user")
    resolved_security_events = relationship("SecurityEvent", foreign_keys="SecurityEvent.resolved_by", back_populates="resolver")
    audit_logs = relationship("AuditLog", foreign_keys="AuditLog.actor", back_populates="actor_user")

    # Template and prompt relationships
    templates = relationship("Template", foreign_keys="Template.owner", back_populates="owner_user")
    created_templates = relationship("Template", foreign_keys="Template.created_by", back_populates="creator_user")
    created_prompts = relationship("Prompt", foreign_keys="Prompt.created_by", back_populates="creator_user")
    activated_prompts = relationship("Prompt", foreign_keys="Prompt.activated_by", back_populates="activator_user")
    updated_aliases = relationship("Alias", foreign_keys="Alias.updated_by", back_populates="updater_user")

    # Approval request relationships
    requested_approval_requests = relationship("ApprovalRequest", foreign_keys="ApprovalRequest.requested_by", back_populates="requester_user")
    approved_approval_requests = relationship("ApprovalRequest", foreign_keys="ApprovalRequest.approver", back_populates="approver_user")

    # Project relationships
    owned_projects = relationship("Project", foreign_keys="Project.owner", back_populates="owner_user")

    # System prompt relationships
    created_system_prompts = relationship("AIAssistantSystemPrompt", foreign_keys="AIAssistantSystemPrompt.created_by", back_populates="creator_user")

class Template(Base):
    __tablename__ = "templates"
    
    id = Column(String, primary_key=True)
    version = Column(String, primary_key=True)
    owner = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=False)
    hash = Column(String, nullable=False)
    metadata_json = Column(JSON)
    created_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    aliases = relationship("Alias", back_populates="template")
    owner_user = relationship("User", foreign_keys=[owner], back_populates="templates")
    creator_user = relationship("User", foreign_keys=[created_by], back_populates="created_templates")

class Alias(Base):
    __tablename__ = "aliases"
    
    alias = Column(String, primary_key=True)
    template_id = Column(String, nullable=False)
    target_version = Column(String, nullable=False)
    weights_json = Column(JSON)
    etag = Column(String)
    updated_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Foreign key constraint
    __table_args__ = (
        ForeignKeyConstraint(['template_id', 'target_version'], ['templates.id', 'templates.version']),
    )
    
    # Relationships
    template = relationship("Template", back_populates="aliases")
    updater_user = relationship("User", foreign_keys=[updated_by], back_populates="updated_aliases")

class Module(Base):
    __tablename__ = "modules"

    id = Column(String, primary_key=True)
    version = Column(String, primary_key=True)
    project_id = Column(String, nullable=False)
    slot = Column(String, nullable=False)
    render_body = Column(String, nullable=False)
    metadata_json = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Foreign key
    __table_args__ = (
        ForeignKeyConstraint(['project_id'], ['projects.id']),
    )

    # Relationships
    project = relationship("Project", back_populates="modules")
    prompts = relationship("Prompt", back_populates="module")

class Variant(Base):
    __tablename__ = "variants"
    
    template_id = Column(String, primary_key=True)
    name = Column(String, primary_key=True)
    overlay_json = Column(JSON)

class Policy(Base):
    __tablename__ = "policies"
    
    id = Column(String, primary_key=True)
    version = Column(String, primary_key=True)
    type = Column(String, nullable=False)
    config_json = Column(JSON)

class EvaluationRun(Base):
    __tablename__ = "evaluation_runs"
    
    id = Column(String, primary_key=True)
    template_id = Column(String, nullable=False)
    version = Column(String, nullable=False)
    suite_id = Column(String, nullable=False)
    metrics_json = Column(JSON)
    passed = Column(Boolean, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True)
    actor = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=False, index=True)
    action = Column(String, nullable=False, index=True)
    subject = Column(String, nullable=False)
    subject_type = Column(String, nullable=False, index=True)  # "user", "prompt", "template", "workflow", etc.
    subject_id = Column(String, nullable=False, index=True)  # ID of the subject resource
    tenant_id = Column(String, nullable=False, index=True)
    before_json = Column(JSON)
    after_json = Column(JSON)
    changes_json = Column(JSON, nullable=True)  # Structured change summary
    metadata_json = Column(JSON, nullable=True)  # Additional context
    session_id = Column(String, nullable=True)
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    request_id = Column(String, nullable=True)
    result = Column(String, nullable=True)  # "success", "failure", "error"
    error_message = Column(String, nullable=True)
    ts = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Relationships
    actor_user = relationship("User", foreign_keys=[actor])

class TenantOverlay(Base):
    __tablename__ = "tenant_overlays"

    tenant_id = Column(String, primary_key=True)
    template_id = Column(String, primary_key=True)
    version = Column(String, primary_key=True)
    overrides_json = Column(JSON)

class Project(Base):
    __tablename__ = "projects"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    owner = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    modules = relationship("Module", back_populates="project")
    owner_user = relationship("User", foreign_keys=[owner], back_populates="owned_projects")

    @hybrid_property
    def modules_count(self):
        return len(self.modules)

    @modules_count.expression
    def modules_count(cls):
        return (
            select(func.count(Module.id))
            .where(Module.project_id == cls.id)
            .label("modules_count")
        )

    @hybrid_property
    def prompts_count(self):
        return sum(len(module.prompts) for module in self.modules)

    @prompts_count.expression
    def prompts_count(cls):
        return (
            select(func.count(Prompt.id))
            .join(Module)
            .where(Module.project_id == cls.id)
            .label("prompts_count")
        )

class Prompt(Base):
    __tablename__ = "prompts"

    id = Column(String, primary_key=True)
    version = Column(String, primary_key=True)
    module_id = Column(String, nullable=False)
    content = Column(String, nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    provider_id = Column(String, ForeignKey("ai_assistant_providers.id"), nullable=True)
    created_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Model-specific prompt variations
    target_models = Column(JSON, nullable=False)
    model_specific_prompts = Column(JSON, nullable=False)

    # MAS FEAT compliance fields
    mas_intent = Column(String, nullable=False)
    mas_fairness_notes = Column(String, nullable=False)
    mas_testing_notes = Column(String, nullable=True)
    mas_risk_level = Column(String, nullable=False)
    mas_approval_log = Column(JSON, nullable=True)

    # Activation status fields
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    activated_at = Column(DateTime(timezone=True), nullable=True)
    activated_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    activation_reason = Column(String, nullable=True)

    # Foreign key
    __table_args__ = (
        ForeignKeyConstraint(['module_id'], ['modules.id']),
    )

    # Relationships
    module = relationship("Module", back_populates="prompts")
    provider = relationship("AIAssistantProvider", backref="prompts")
    model_compatibilities = relationship("ModelCompatibility", back_populates="prompt")
    approval_requests = relationship("ApprovalRequest", back_populates="prompt")
    creator_user = relationship("User", foreign_keys=[created_by], back_populates="created_prompts")
    activator_user = relationship("User", foreign_keys=[activated_by], back_populates="activated_prompts")

class ModelCompatibility(Base):
    __tablename__ = "model_compatibilities"

    id = Column(String, primary_key=True)
    prompt_id = Column(String, nullable=False)
    model_name = Column(String, nullable=False)
    model_provider = Column(String, nullable=False)
    is_compatible = Column(Boolean, nullable=False)
    compatibility_notes = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Foreign key
    __table_args__ = (
        ForeignKeyConstraint(['prompt_id'], ['prompts.id']),
    )

    # Relationships
    prompt = relationship("Prompt", back_populates="model_compatibilities")

class ApprovalRequest(Base):
    __tablename__ = "approval_requests"

    id = Column(String, primary_key=True)
    prompt_id = Column(String, nullable=False)
    requested_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=False)
    requested_at = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String, nullable=False)
    approver = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(String, nullable=True)
    comments = Column(String, nullable=True)

    # Workflow support
    workflow_instance_id = Column(String, ForeignKey("workflow_instances.id", ondelete="SET NULL"), nullable=True)
    workflow_step = Column(Integer, nullable=True)  # Which step in the workflow this request represents
    evidence_required = Column(Boolean, default=False, nullable=False)
    evidence = Column(JSON, nullable=True)  # Evidence submitted with request
    auto_approve = Column(Boolean, default=False, nullable=False)
    escalation_level = Column(Integer, default=0, nullable=False)  # For escalation workflows
    tenant_id = Column(String, nullable=False, index=True)

    # Foreign key
    __table_args__ = (
        ForeignKeyConstraint(['prompt_id'], ['prompts.id']),
    )

    # Relationships
    prompt = relationship("Prompt", back_populates="approval_requests")
    workflow_instance = relationship("WorkflowInstance", foreign_keys=[workflow_instance_id])
    requester_user = relationship("User", foreign_keys=[requested_by], back_populates="requested_approval_requests")
    approver_user = relationship("User", foreign_keys=[approver], back_populates="approved_approval_requests")

# Client API Models
class ClientApiKeyStatus(enum.Enum):
    ACTIVE = "active"
    REVOKED = "revoked"
    EXPIRED = "expired"

class ClientApiKey(Base):
    __tablename__ = "client_api_keys"

    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False, index=True)
    tenant_id = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)

    # API Key details
    api_key_prefix = Column(String, nullable=False, unique=True, index=True)
    api_key_hash = Column(String, nullable=False)
    api_key_encrypted = Column(String, nullable=True)  # Encrypted full API key for display
    secret_key_hash = Column(String, nullable=False)
    secret_key_encrypted = Column(String, nullable=True)  # Encrypted secret key for display

    # Rate limiting configuration
    rate_limit_per_minute = Column(Integer, default=60, nullable=False)
    rate_limit_per_hour = Column(Integer, default=3600, nullable=False)
    rate_limit_per_day = Column(Integer, default=86400, nullable=False)

    # Permissions
    allowed_projects = Column(JSON, nullable=True)  # List of project IDs or None for all
    allowed_scopes = Column(JSON, nullable=False)  # ["read", "write", "admin"]

    # Status and metadata
    status = Column(Enum(ClientApiKeyStatus), default=ClientApiKeyStatus.ACTIVE, nullable=False)
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Foreign key
    __table_args__ = (
        ForeignKeyConstraint(['user_id'], ['users.id']),
    )

class ClientUsageLog(Base):
    __tablename__ = "client_usage_logs"

    id = Column(String, primary_key=True)
    api_key_id = Column(String, nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)
    tenant_id = Column(String, nullable=False, index=True)

    # Request details
    endpoint = Column(String, nullable=False)
    method = Column(String, nullable=False)
    prompt_id = Column(String, nullable=True, index=True)
    project_id = Column(String, nullable=True, index=True)

    # Usage metrics
    tokens_requested = Column(Integer, nullable=True)
    tokens_used = Column(Integer, nullable=True)
    response_size = Column(Integer, nullable=True)
    processing_time_ms = Column(Integer, nullable=True)

    # Cost tracking
    estimated_cost_usd = Column(String, nullable=True)

    # Status
    status_code = Column(Integer, nullable=False)
    error_message = Column(String, nullable=True)

    # Metadata
    user_agent = Column(String, nullable=True)
    ip_address = Column(String, nullable=True)
    request_id = Column(String, nullable=True)

    # Timestamps
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Foreign key
    __table_args__ = (
        ForeignKeyConstraint(['api_key_id'], ['client_api_keys.id']),
    )

class RateLimitRecord(Base):
    __tablename__ = "rate_limit_records"

    id = Column(String, primary_key=True)
    api_key_id = Column(String, nullable=False, index=True)
    window_type = Column(String, nullable=False)  # "minute", "hour", "day"
    window_start = Column(DateTime(timezone=True), nullable=False, index=True)
    request_count = Column(Integer, default=0, nullable=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Foreign key and unique constraint
    __table_args__ = (
        ForeignKeyConstraint(['api_key_id'], ['client_api_keys.id']),
        UniqueConstraint('api_key_id', 'window_type', 'window_start', name='uq_rate_limit_window')
    )

# AI Assistant Models
class AIAssistantProvider(Base):
    __tablename__ = "ai_assistant_providers"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    provider_type = Column(Enum(AIAssistantProviderType, name="aiassistantprovidertype", native_enum=True, values_callable=lambda e: [m.value for m in e], create_type=False), nullable=False)
    name = Column(String, nullable=False)  # User-friendly name for this provider config
    status = Column(Enum(AIAssistantProviderStatus, name="aiassistantproviderstatus", native_enum=True, values_callable=lambda e: [m.value for m in e], create_type=False), default=AIAssistantProviderStatus.active, nullable=False)
    is_default = Column('default', Boolean, nullable=False, server_default=text('false'), default=False)

    # Configuration details
    api_key = Column(String, nullable=True)  # API key for authentication
    api_base_url = Column(String, nullable=True)  # Custom API base URL
    model_name = Column(String, nullable=True)  # Default model for this provider
    organization = Column(String, nullable=True)  # For OpenAI organization
    project = Column(String, nullable=True)  # For OpenAI project

    # Additional provider-specific config
    config_json = Column(JSON, nullable=True)  # Additional configuration options

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_used_at = Column(DateTime(timezone=True), nullable=True)

    # Unique constraint to ensure one active provider per type per user
    __table_args__ = (
        UniqueConstraint('user_id', 'provider_type', name='uq_user_provider_type'),
    )

    # Relationships
    user = relationship("User", back_populates="ai_assistant_providers")

class AIAssistantSystemPrompt(Base):
    __tablename__ = "ai_assistant_system_prompts"

    id = Column(String, primary_key=True)
    provider_id = Column(String, ForeignKey("ai_assistant_providers.id", ondelete="CASCADE"), nullable=False)
    prompt_type = Column(String, nullable=False)
    name = Column(String, nullable=False)
    content = Column(String, nullable=False)
    description = Column(String, nullable=True)
    is_mas_feat_compliant = Column(Boolean, default=True, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=False)

    # Relationships
    provider = relationship("AIAssistantProvider", backref="system_prompts")
    creator_user = relationship("User", foreign_keys=[created_by], back_populates="created_system_prompts")

class AIAssistantConversation(Base):
    __tablename__ = "ai_assistant_conversations"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    provider_id = Column(String, ForeignKey("ai_assistant_providers.id", ondelete="SET NULL"), nullable=True)
    context_type = Column(String, nullable=False)  # "create_prompt", "edit_prompt", "general"
    context_id = Column(String, nullable=True)  # Related prompt ID, module ID, etc.
    title = Column(String, nullable=True)

    # Conversation state
    messages = Column(JSON, nullable=False)  # Array of message objects
    current_provider_id = Column(String, nullable=True)  # Currently active provider

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="ai_assistant_conversations")
    provider = relationship("AIAssistantProvider")
    messages = relationship("AIAssistantMessage", back_populates="conversation", cascade="all, delete-orphan")

class AIAssistantMessage(Base):
    __tablename__ = "ai_assistant_messages"

    id = Column(String, primary_key=True)
    conversation_id = Column(String, ForeignKey("ai_assistant_conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(Enum(AIAssistantMessageRole), nullable=False)  # "user", "assistant", "system"
    content = Column(String, nullable=False)
    metadata_json = Column(JSON, nullable=True)  # Additional metadata (tokens, model, etc.)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    conversation = relationship("AIAssistantConversation", back_populates="messages")

# Governance System Models

class SecurityEventType(enum.Enum):
    LOGIN_ATTEMPT = "login_attempt"
    LOGIN_SUCCESS = "login_success"
    LOGIN_FAILURE = "login_failure"
    PERMISSION_DENIED = "permission_denied"
    DATA_ACCESS = "data_access"
    DATA_MODIFICATION = "data_modification"
    CONFIG_CHANGE = "config_change"
    SECURITY_POLICY_VIOLATION = "security_policy_violation"
    SUSPICIOUS_ACTIVITY = "suspicious_activity"
    RATE_LIMIT_EXCEEDED = "rate_limit_exceeded"
    API_KEY_COMPROMISE = "api_key_compromise"

class SecuritySeverity(enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class SecurityEvent(Base):
    __tablename__ = "security_events"

    id = Column(String, primary_key=True)
    event_type = Column(Enum(SecurityEventType), nullable=False, index=True)
    severity = Column(Enum(SecuritySeverity), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    tenant_id = Column(String, nullable=False, index=True)
    resource_type = Column(String, nullable=True)  # "user", "prompt", "template", "api_key", etc.
    resource_id = Column(String, nullable=True)  # ID of the affected resource
    action = Column(String, nullable=False)  # Specific action performed
    description = Column(String, nullable=False)  # Human-readable description
    details_json = Column(JSON, nullable=True)  # Additional event details
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    session_id = Column(String, nullable=True)
    is_resolved = Column(Boolean, default=False, nullable=False)
    resolved_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)  # User ID who resolved the event
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolution_notes = Column(String, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    resolver = relationship("User", foreign_keys=[resolved_by])

    # Indexes for performance
    __table_args__ = (
        {'extend_existing': True}
    )

class SecurityAlertType(enum.Enum):
    THREAT_DETECTION = "threat_detection"
    ANOMALY_DETECTED = "anomaly_detected"
    POLICY_VIOLATION = "policy_violation"
    COMPLIANCE_BREACH = "compliance_breach"
    RATE_LIMIT_BREACH = "rate_limit_breach"
    UNAUTHORIZED_ACCESS = "unauthorized_access"
    DATA_BREACH = "data_breach"
    SUSPICIOUS_PATTERN = "suspicious_pattern"
    INTEGRATION_FAILURE = "integration_failure"
    SYSTEM_ANOMALY = "system_anomaly"

class SecurityAlertStatus(enum.Enum):
    OPEN = "open"
    INVESTIGATING = "investigating"
    RESOLVED = "resolved"
    FALSE_POSITIVE = "false_positive"
    ESCALATED = "escalated"
    IGNORED = "ignored"

class SecurityIncidentType(enum.Enum):
    SECURITY_BREACH = "security_breach"
    DATA_COMPROMISE = "data_compromise"
    UNAUTHORIZED_ACCESS = "unauthorized_access"
    DENIAL_OF_SERVICE = "denial_of_service"
    MALWARE_DETECTION = "malware_detection"
    PHISHING_ATTEMPT = "phishing_attempt"
    INSIDER_THREAT = "insider_threat"
    CONFIGURATION_DRIFT = "configuration_drift"
    COMPLIANCE_VIOLATION = "compliance_violation"

class SecurityIncidentStatus(enum.Enum):
    DETECTED = "detected"
    INVESTIGATING = "investigating"
    CONTAINED = "contained"
    RESOLVED = "resolved"
    CLOSED = "closed"
    FALSE_POSITIVE = "false_positive"

class SecurityIncidentSeverity(enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class SecurityMetrics(Base):
    __tablename__ = "security_metrics"

    id = Column(String, primary_key=True)
    tenant_id = Column(String, nullable=False, index=True)
    metric_date = Column(DateTime(timezone=True), nullable=False, index=True)

    # Event counts by type
    total_security_events = Column(Integer, default=0, nullable=False)
    critical_events = Column(Integer, default=0, nullable=False)
    high_severity_events = Column(Integer, default=0, nullable=False)
    medium_severity_events = Column(Integer, default=0, nullable=False)
    low_severity_events = Column(Integer, default=0, nullable=False)

    # Alert metrics
    total_alerts = Column(Integer, default=0, nullable=False)
    open_alerts = Column(Integer, default=0, nullable=False)
    resolved_alerts = Column(Integer, default=0, nullable=False)
    false_positive_alerts = Column(Integer, default=0, nullable=False)

    # Incident metrics
    total_incidents = Column(Integer, default=0, nullable=False)
    active_incidents = Column(Integer, default=0, nullable=False)
    resolved_incidents = Column(Integer, default=0, nullable=False)
    mean_time_to_resolve_minutes = Column(Integer, nullable=True)

    # Anomaly detection metrics
    anomaly_score = Column(String, nullable=True)  # Current anomaly score
    baseline_anomaly_score = Column(String, nullable=True)  # Baseline for comparison
    anomaly_detection_count = Column(Integer, default=0, nullable=False)

    # Compliance metrics
    compliance_score = Column(String, nullable=True)
    policy_violations = Column(Integer, default=0, nullable=False)
    compliance_checks_passed = Column(Integer, default=0, nullable=False)
    compliance_checks_failed = Column(Integer, default=0, nullable=False)

    # Threat intelligence metrics
    threat_indicators_detected = Column(Integer, default=0, nullable=False)
    known_threats_blocked = Column(Integer, default=0, nullable=False)
    suspicious_ips_blocked = Column(Integer, default=0, nullable=False)

    # Performance metrics
    avg_response_time_ms = Column(Integer, nullable=True)
    system_load_score = Column(String, nullable=True)

    # User behavior metrics
    unique_active_users = Column(Integer, default=0, nullable=False)
    suspicious_user_activities = Column(Integer, default=0, nullable=False)

    # Additional metrics data
    metrics_json = Column(JSON, nullable=True)  # Additional custom metrics

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Indexes for performance
    __table_args__ = (
        {'extend_existing': True}
    )

class SecurityAlert(Base):
    __tablename__ = "security_alerts"

    id = Column(String, primary_key=True)
    alert_type = Column(Enum(SecurityAlertType), nullable=False, index=True)
    severity = Column(Enum(SecuritySeverity), nullable=False, index=True)
    status = Column(Enum(SecurityAlertStatus), default=SecurityAlertStatus.OPEN, nullable=False, index=True)

    # Alert metadata
    title = Column(String, nullable=False)
    description = Column(String, nullable=False)
    source = Column(String, nullable=True)  # "anomaly_detection", "threat_intelligence", "policy_engine", etc.
    source_id = Column(String, nullable=True)  # ID of the source event/system

    # Alert content
    detection_details = Column(JSON, nullable=False)  # Detection criteria and evidence
    affected_resources = Column(JSON, nullable=True)  # Resources affected by this alert
    risk_score = Column(String, nullable=True)  # Calculated risk score
    confidence_score = Column(String, nullable=True)  # Confidence in the detection

    # Context information
    tenant_id = Column(String, nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    session_id = Column(String, nullable=True)
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)

    # Alert lifecycle
    assigned_to = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)  # User assigned to investigate
    investigation_notes = Column(JSON, nullable=True)  # Investigation notes and evidence
    resolution_details = Column(JSON, nullable=True)  # Resolution steps and outcomes
    false_positive_reason = Column(String, nullable=True)

    # Timestamps
    detected_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    assignee = relationship("User", foreign_keys=[assigned_to])
    related_incident = Column(String, ForeignKey("security_incidents.id", ondelete="SET NULL"), nullable=True)

    # Indexes for performance
    __table_args__ = (
        {'extend_existing': True}
    )

class SecurityIncident(Base):
    __tablename__ = "security_incidents"

    id = Column(String, primary_key=True)
    incident_type = Column(Enum(SecurityIncidentType), nullable=False, index=True)
    severity = Column(Enum(SecurityIncidentSeverity), nullable=False, index=True)
    status = Column(Enum(SecurityIncidentStatus), default=SecurityIncidentStatus.DETECTED, nullable=False, index=True)

    # Incident metadata
    title = Column(String, nullable=False)
    description = Column(String, nullable=False)
    summary = Column(String, nullable=True)

    # Incident classification
    detection_method = Column(String, nullable=True)  # "automated", "manual", "reported", etc.
    classification = Column(String, nullable=True)  # "confirmed", "suspected", "false_positive"

    # Impact assessment
    impact_score = Column(String, nullable=True)
    affected_systems = Column(JSON, nullable=True)  # Systems and resources affected
    data_affected = Column(JSON, nullable=True)  # Data types and volumes affected
    business_impact = Column(String, nullable=True)  # Business impact description

    # Incident response
    response_team = Column(JSON, nullable=True)  # Team members involved in response
    containment_actions = Column(JSON, nullable=True)  # Actions taken to contain the incident
    eradication_actions = Column(JSON, nullable=True)  # Actions taken to eradicate the threat
    recovery_actions = Column(JSON, nullable=True)  # Actions taken to recover systems

    # Investigation details
    investigation_findings = Column(JSON, nullable=True)  # Investigation results and evidence
    root_cause = Column(String, nullable=True)  # Root cause analysis
    lessons_learned = Column(String, nullable=True)  # Lessons learned from the incident

    # Timeline
    detected_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    contained_at = Column(DateTime(timezone=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)

    # Context
    tenant_id = Column(String, nullable=False, index=True)
    reported_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    assigned_to = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Related entities
    related_alerts = Column(JSON, nullable=True)  # List of related alert IDs
    related_events = Column(JSON, nullable=True)  # List of related security event IDs

    # Compliance and reporting
    compliance_impact = Column(JSON, nullable=True)  # Compliance frameworks affected
    report_required = Column(Boolean, default=False, nullable=False)
    report_filed = Column(Boolean, default=False, nullable=False)
    report_details = Column(JSON, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    reporter = relationship("User", foreign_keys=[reported_by])
    assignee = relationship("User", foreign_keys=[assigned_to])

    # Indexes for performance
    __table_args__ = (
        {'extend_existing': True}
    )

class ThreatIntelligenceFeed(Base):
    __tablename__ = "threat_intelligence_feeds"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    feed_type = Column(String, nullable=False)  # "ioc", "malware", "phishing", "vulnerability", etc.
    source_url = Column(String, nullable=True)
    api_endpoint = Column(String, nullable=True)

    # Feed configuration
    is_active = Column(Boolean, default=True, nullable=False)
    update_frequency_minutes = Column(Integer, default=60, nullable=False)
    last_updated_at = Column(DateTime(timezone=True), nullable=True)
    next_update_at = Column(DateTime(timezone=True), nullable=True)

    # Authentication
    api_key = Column(String, nullable=True)
    auth_config = Column(JSON, nullable=True)

    # Feed status
    status = Column(String, default="active", nullable=False)  # "active", "error", "disabled"
    error_message = Column(String, nullable=True)
    total_indicators = Column(Integer, default=0, nullable=False)
    new_indicators_last_update = Column(Integer, default=0, nullable=False)

    # Tenant context
    tenant_id = Column(String, nullable=False, index=True)
    created_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    creator = relationship("User", foreign_keys=[created_by])

    # Indexes for performance
    __table_args__ = (
        {'extend_existing': True}
    )

class ThreatIndicator(Base):
    __tablename__ = "threat_indicators"

    id = Column(String, primary_key=True)
    indicator_type = Column(String, nullable=False, index=True)  # "ip", "domain", "url", "hash", "email", etc.
    indicator_value = Column(String, nullable=False, index=True)

    # Threat intelligence
    threat_type = Column(String, nullable=False)  # "malware", "phishing", "botnet", "apt", etc.
    threat_actor = Column(String, nullable=True)
    campaign = Column(String, nullable=True)

    # Confidence and severity
    confidence_score = Column(String, nullable=True)
    severity = Column(Enum(SecuritySeverity), nullable=True, index=True)

    # Validity period
    first_seen = Column(DateTime(timezone=True), nullable=True)
    last_seen = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)

    # Source information
    source_feed_id = Column(String, ForeignKey("threat_intelligence_feeds.id", ondelete="SET NULL"), nullable=True)
    source_confidence = Column(String, nullable=True)
    source_description = Column(String, nullable=True)

    # Additional context
    description = Column(String, nullable=True)
    tags = Column(JSON, nullable=True)  # List of tags for categorization
    context_data = Column(JSON, nullable=True)  # Additional context information

    # Status and tracking
    is_active = Column(Boolean, default=True, nullable=False)
    is_false_positive = Column(Boolean, default=False, nullable=False)
    times_detected = Column(Integer, default=0, nullable=False)
    last_detected_at = Column(DateTime(timezone=True), nullable=True)

    # Actions taken
    auto_blocked = Column(Boolean, default=False, nullable=False)
    block_reason = Column(String, nullable=True)
    block_expires_at = Column(DateTime(timezone=True), nullable=True)

    # Tenant context
    tenant_id = Column(String, nullable=False, index=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    source_feed = relationship("ThreatIntelligenceFeed", backref="indicators")

    # Indexes for performance
    __table_args__ = (
        {'extend_existing': True}
    )

class AnomalyDetectionRule(Base):
    __tablename__ = "anomaly_detection_rules"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)

    # Rule configuration
    rule_type = Column(String, nullable=False)  # "statistical", "ml_model", "threshold", "pattern", etc.
    target_metric = Column(String, nullable=False)  # What to monitor (e.g., "login_failures", "api_calls_per_minute")

    # Detection parameters
    detection_config = Column(JSON, nullable=False)  # Rule-specific configuration
    threshold_config = Column(JSON, nullable=False)  # Thresholds and conditions
    sensitivity = Column(String, nullable=True)  # "low", "medium", "high"

    # Alerting configuration
    alert_on_detection = Column(Boolean, default=True, nullable=False)
    alert_severity = Column(Enum(SecuritySeverity), nullable=True)
    alert_message_template = Column(String, nullable=True)

    # Schedule and scope
    is_active = Column(Boolean, default=True, nullable=False)
    evaluation_frequency_minutes = Column(Integer, default=5, nullable=False)
    scope_config = Column(JSON, nullable=True)  # What entities/tenants this applies to

    # Performance tracking
    total_detections = Column(Integer, default=0, nullable=False)
    true_positives = Column(Integer, default=0, nullable=False)
    false_positives = Column(Integer, default=0, nullable=False)
    last_detection_at = Column(DateTime(timezone=True), nullable=True)

    # Context
    tenant_id = Column(String, nullable=False, index=True)
    created_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    creator = relationship("User", foreign_keys=[created_by])

    # Indexes for performance
    __table_args__ = (
        {'extend_existing': True}
    )

class AnomalyDetectionResult(Base):
    __tablename__ = "anomaly_detection_results"

    id = Column(String, primary_key=True)
    rule_id = Column(String, ForeignKey("anomaly_detection_rules.id", ondelete="CASCADE"), nullable=False)

    # Detection results
    anomaly_score = Column(String, nullable=False)  # Calculated anomaly score
    baseline_value = Column(String, nullable=True)  # Expected/normal value
    actual_value = Column(String, nullable=False)  # Actual observed value
    deviation_percentage = Column(String, nullable=True)  # Percentage deviation from baseline

    # Classification
    is_anomaly = Column(Boolean, nullable=False, index=True)
    severity = Column(Enum(SecuritySeverity), nullable=True, index=True)
    confidence_level = Column(String, nullable=True)  # Confidence in the anomaly detection

    # Context information
    entity_type = Column(String, nullable=True)  # "user", "ip", "session", "resource", etc.
    entity_id = Column(String, nullable=True)  # ID of the entity being monitored
    metric_name = Column(String, nullable=False)  # Name of the metric being monitored
    time_window_start = Column(DateTime(timezone=True), nullable=False)
    time_window_end = Column(DateTime(timezone=True), nullable=False)

    # Additional data
    detection_details = Column(JSON, nullable=False)  # Detailed detection data and evidence
    contributing_factors = Column(JSON, nullable=True)  # Factors that contributed to the anomaly

    # Alert generation
    alert_generated = Column(Boolean, default=False, nullable=False)
    alert_id = Column(String, ForeignKey("security_alerts.id", ondelete="SET NULL"), nullable=True)

    # Context
    tenant_id = Column(String, nullable=False, index=True)

    # Timestamps
    detected_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    rule = relationship("AnomalyDetectionRule", backref="detection_results")
    alert = relationship("SecurityAlert", foreign_keys=[alert_id])

    # Indexes for performance
    __table_args__ = (
        {'extend_existing': True}
    )

# Security model relationships to be added to existing models

class WorkflowStatus(enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    INACTIVE = "inactive"
    ARCHIVED = "archived"

class WorkflowInstanceStatus(enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    REJECTED = "rejected"
    CANCELLED = "cancelled"
    ERROR = "error"

class ComplianceReportStatus(enum.Enum):
    GENERATING = "generating"
    COMPLETED = "completed"
    FAILED = "failed"
    ARCHIVED = "archived"

class WorkflowDefinition(Base):
    __tablename__ = "workflow_definitions"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    version = Column(String, nullable=False)
    status = Column(Enum(WorkflowStatus), default=WorkflowStatus.DRAFT, nullable=False)
    category = Column(String, nullable=False)  # "approval", "compliance", "security", "access_control"
    trigger_condition = Column(JSON, nullable=False)  # Conditions that trigger this workflow
    steps_json = Column(JSON, nullable=False)  # Workflow step definitions
    timeout_minutes = Column(Integer, default=1440, nullable=False)  # 24 hours default
    requires_evidence = Column(Boolean, default=False, nullable=False)
    auto_approve_threshold = Column(Integer, nullable=True)  # Auto-approve after X approvals
    escalation_rules = Column(JSON, nullable=True)  # Escalation conditions and actions
    notification_settings = Column(JSON, nullable=True)  # Notification preferences
    created_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=False)
    updated_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=False)
    tenant_id = Column(String, nullable=False, index=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    creator = relationship("User", foreign_keys=[created_by])
    updater = relationship("User", foreign_keys=[updated_by])
    instances = relationship("WorkflowInstance", back_populates="workflow_definition")
    steps = relationship("WorkflowStep", back_populates="workflow_definition")
    escalation_rule_relationships = relationship("WorkflowEscalationRule", back_populates="workflow_definition")
    metrics = relationship("WorkflowMetrics", back_populates="workflow_definition")

    # Unique constraint for name+version+tenant
    __table_args__ = (
        UniqueConstraint('name', 'version', 'tenant_id', name='uq_workflow_name_version_tenant'),
    )

class WorkflowInstance(Base):
    __tablename__ = "workflow_instances"

    id = Column(String, primary_key=True)
    workflow_definition_id = Column(String, ForeignKey("workflow_definitions.id", ondelete="CASCADE"), nullable=False)
    status = Column(Enum(WorkflowInstanceStatus), default=WorkflowInstanceStatus.PENDING, nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    resource_type = Column(String, nullable=False)  # "prompt", "user", "api_key", etc.
    resource_id = Column(String, nullable=False)  # ID of the resource being processed
    initiated_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=False)
    current_step = Column(Integer, default=0, nullable=False)  # Current step index
    context_json = Column(JSON, nullable=False)  # Workflow context and data
    steps_json = Column(JSON, nullable=False)  # Current state of all steps
    evidence = Column(JSON, nullable=True)  # Evidence collected during workflow
    approvers = Column(JSON, nullable=True)  # List of approver user IDs
    current_assignee = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)  # Currently assigned user
    due_date = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(String, nullable=True)
    tenant_id = Column(String, nullable=False, index=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    workflow_definition = relationship("WorkflowDefinition", back_populates="instances")
    initiator = relationship("User", foreign_keys=[initiated_by])
    assignee = relationship("User", foreign_keys=[current_assignee])
    metrics = relationship("WorkflowMetrics", back_populates="workflow_instance")

class ComplianceReport(Base):
    __tablename__ = "compliance_reports"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    report_type = Column(String, nullable=False)  # "security_audit", "compliance_check", "risk_assessment", etc.
    description = Column(String, nullable=True)
    status = Column(Enum(ComplianceReportStatus), default=ComplianceReportStatus.GENERATING, nullable=False, index=True)
    scope_json = Column(JSON, nullable=False)  # Report scope (time period, resources, etc.)
    findings = Column(JSON, nullable=True)  # Report findings and results
    recommendations = Column(JSON, nullable=True)  # Recommendations from the report
    metrics = Column(JSON, nullable=True)  # Compliance metrics and scores
    generated_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=False)
    tenant_id = Column(String, nullable=False, index=True)
    file_path = Column(String, nullable=True)  # Path to generated report file
    file_size = Column(Integer, nullable=True)  # File size in bytes
    file_hash = Column(String, nullable=True)  # File hash for integrity

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    generator = relationship("User", foreign_keys=[generated_by])

class PermissionTemplate(Base):
    __tablename__ = "permission_templates"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    permissions = Column(JSON, nullable=False)  # List of permissions in this template
    category = Column(String, nullable=False)  # "admin", "user", "viewer", "custom"
    is_system = Column(Boolean, default=False, nullable=False)  # System templates cannot be deleted
    is_active = Column(Boolean, default=True, nullable=False)
    created_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=False)
    updated_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=False)
    tenant_id = Column(String, nullable=False, index=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    creator = relationship("User", foreign_keys=[created_by])
    updater = relationship("User", foreign_keys=[updated_by])
    role_permissions = relationship("RolePermission", back_populates="template")

    # Unique constraint for name+tenant
    __table_args__ = (
        UniqueConstraint('name', 'tenant_id', name='uq_permission_template_name_tenant'),
    )

class RolePermission(Base):
    __tablename__ = "role_permissions"

    id = Column(String, primary_key=True)
    role_name = Column(String, nullable=False, index=True)  # "admin", "user", "viewer", custom role names
    resource_type = Column(String, nullable=False, index=True)  # "prompt", "template", "user", "api_key", etc.
    action = Column(String, nullable=False, index=True)  # "create", "read", "update", "delete", "approve", etc.
    conditions = Column(JSON, nullable=True)  # Conditions for permission (e.g., "owner_only", "tenant_only")
    permission_template_id = Column(String, ForeignKey("permission_templates.id", ondelete="SET NULL"), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=False)
    updated_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=False)
    tenant_id = Column(String, nullable=False, index=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    creator = relationship("User", foreign_keys=[created_by])
    updater = relationship("User", foreign_keys=[updated_by])
    template = relationship("PermissionTemplate", back_populates="role_permissions")

    # Unique constraint for role+resource+action+tenant
    __table_args__ = (
        UniqueConstraint('role_name', 'resource_type', 'action', 'tenant_id', name='uq_role_permission_resource_action_tenant'),
    )

# Enhanced Workflow Models

class WorkflowStepType(enum.Enum):
    MANUAL_APPROVAL = "manual_approval"
    AUTOMATED_APPROVAL = "automated_approval"
    PARALLEL_APPROVAL = "parallel_approval"
    SEQUENTIAL_APPROVAL = "sequential_approval"
    CONDITIONAL_APPROVAL = "conditional_approval"
    NOTIFICATION = "notification"
    DATA_COLLECTION = "data_collection"
    EXTERNAL_SYSTEM = "external_system"
    TIMER = "timer"
    ESCALATION = "escalation"

class WorkflowConditionType(enum.Enum):
    ROLE_BASED = "role_based"
    USER_BASED = "user_based"
    RESOURCE_BASED = "resource_based"
    TIME_BASED = "time_based"
    VALUE_BASED = "value_based"
    CUSTOM = "custom"

class WorkflowEscalationType(enum.Enum):
    TIMEOUT = "timeout"
    REJECTION = "rejection"
    INACTIVITY = "inactivity"
    MANUAL = "manual"

class WorkflowNotificationType(enum.Enum):
    EMAIL = "email"
    IN_APP = "in_app"
    SLACK = "slack"
    WEBHOOK = "webhook"
    SMS = "sms"

class WorkflowStepStatus(enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    SKIPPED = "skipped"
    FAILED = "failed"
    CANCELLED = "cancelled"

class WorkflowTemplateStatus(enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"
    DEPRECATED = "deprecated"

class WorkflowStep(Base):
    """Individual step within a workflow definition"""
    __tablename__ = "workflow_steps"

    id = Column(String, primary_key=True)
    workflow_definition_id = Column(String, ForeignKey("workflow_definitions.id", ondelete="CASCADE"), nullable=False)
    step_type = Column(Enum(WorkflowStepType), nullable=False)
    step_number = Column(Integer, nullable=False)  # Order in the workflow
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)

    # Step configuration
    config_json = Column(JSON, nullable=False)  # Step-specific configuration

    # Conditions for this step
    condition_type = Column(Enum(WorkflowConditionType), nullable=True)
    condition_config = Column(JSON, nullable=True)

    # Approval requirements
    approval_required = Column(Boolean, default=False, nullable=False)
    approval_roles = Column(JSON, nullable=True)  # Roles that can approve
    approval_users = Column(JSON, nullable=True)  # Specific users that can approve
    min_approvals = Column(Integer, default=1, nullable=False)  # Minimum approvals needed
    auto_approve_after = Column(Integer, nullable=True)  # Auto-approve after X minutes

    # Step execution settings
    timeout_minutes = Column(Integer, nullable=True)
    is_optional = Column(Boolean, default=False, nullable=False)
    can_skip = Column(Boolean, default=False, nullable=False)

    # Step relationships
    parent_step_id = Column(String, nullable=True)  # For parallel/sequential workflows
    child_steps = Column(JSON, nullable=True)  # Steps that depend on this one

    # Step outputs and transitions
    outputs = Column(JSON, nullable=True)  # Expected outputs from this step
    transitions = Column(JSON, nullable=True)  # Where to go next based on outcomes

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    workflow_definition = relationship("WorkflowDefinition", back_populates="steps")

class WorkflowStepExecution(Base):
    """Execution record for a workflow step"""
    __tablename__ = "workflow_step_executions"

    id = Column(String, primary_key=True)
    workflow_instance_id = Column(String, ForeignKey("workflow_instances.id", ondelete="CASCADE"), nullable=False)
    workflow_step_id = Column(String, ForeignKey("workflow_steps.id", ondelete="SET NULL"), nullable=True)
    step_number = Column(Integer, nullable=False)
    step_type = Column(Enum(WorkflowStepType), nullable=False)
    status = Column(Enum(WorkflowStepStatus), default=WorkflowStepStatus.PENDING, nullable=False)

    # Step configuration and execution data
    config_json = Column(JSON, nullable=False)
    input_data = Column(JSON, nullable=True)
    output_data = Column(JSON, nullable=True)
    error_message = Column(String, nullable=True)

    # Approval tracking
    approvers = Column(JSON, nullable=True)  # List of assigned approvers
    approvals_received = Column(JSON, nullable=True)  # Track who has approved
    rejections_received = Column(JSON, nullable=True)  # Track who has rejected

    # Timing
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    due_date = Column(DateTime(timezone=True), nullable=True)

    # Execution metadata
    executed_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    execution_time_ms = Column(Integer, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    workflow_instance = relationship("WorkflowInstance", backref="step_executions")
    executor = relationship("User", foreign_keys=[executed_by])

class WorkflowEscalationRule(Base):
    """Escalation rules for workflows"""
    __tablename__ = "workflow_escalation_rules"

    id = Column(String, primary_key=True)
    workflow_definition_id = Column(String, ForeignKey("workflow_definitions.id", ondelete="CASCADE"), nullable=False)
    step_number = Column(Integer, nullable=True)  # Specific step or null for entire workflow

    # Escalation trigger
    escalation_type = Column(Enum(WorkflowEscalationType), nullable=False)
    trigger_condition = Column(JSON, nullable=False)  # When to escalate

    # Escalation actions
    target_roles = Column(JSON, nullable=True)  # Roles to escalate to
    target_users = Column(JSON, nullable=True)  # Specific users to escalate to
    notification_method = Column(Enum(WorkflowNotificationType), nullable=True)
    notification_config = Column(JSON, nullable=True)

    # Escalation timing
    escalation_delay_minutes = Column(Integer, default=0, nullable=False)  # Wait time before escalating
    max_escalation_level = Column(Integer, default=3, nullable=False)  # Maximum escalation depth

    # Escalation actions
    auto_approve = Column(Boolean, default=False, nullable=False)
    auto_reject = Column(Boolean, default=False, nullable=False)
    reassign_to = Column(String, nullable=True)  # User to reassign to

    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    workflow_definition = relationship("WorkflowDefinition", back_populates="escalation_rule_relationships")

class WorkflowTemplate(Base):
    """Predefined workflow templates for common scenarios"""
    __tablename__ = "workflow_templates"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    category = Column(String, nullable=False)  # "approval", "compliance", "access_control", "security"
    use_case = Column(String, nullable=False)  # "prompt_approval", "user_access", "api_key_request", etc.

    # Template configuration
    workflow_definition = Column(JSON, nullable=False)  # Complete workflow definition
    steps_config = Column(JSON, nullable=False)  # Step configurations
    escalation_rules = Column(JSON, nullable=True)  # Default escalation rules

    # Template metadata
    is_system = Column(Boolean, default=False, nullable=False)  # System templates cannot be modified
    is_public = Column(Boolean, default=False, nullable=False)  # Available to all tenants
    required_roles = Column(JSON, nullable=True)  # Roles required to use this template

    # Version and status
    version = Column(String, nullable=False)
    status = Column(Enum(WorkflowTemplateStatus), default=WorkflowTemplateStatus.DRAFT, nullable=False)

    # Usage tracking
    usage_count = Column(Integer, default=0, nullable=False)
    created_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=False)
    tenant_id = Column(String, nullable=True)  # Null for public templates

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    creator = relationship("User", foreign_keys=[created_by])

    # Unique constraint for name+version+tenant
    __table_args__ = (
        UniqueConstraint('name', 'version', 'tenant_id', name='uq_workflow_template_name_version_tenant'),
    )

class WorkflowNotification(Base):
    """Notification records for workflow events"""
    __tablename__ = "workflow_notifications"

    id = Column(String, primary_key=True)
    workflow_instance_id = Column(String, ForeignKey("workflow_instances.id", ondelete="CASCADE"), nullable=False)
    step_execution_id = Column(String, ForeignKey("workflow_step_executions.id", ondelete="SET NULL"), nullable=True)

    # Notification details
    notification_type = Column(Enum(WorkflowNotificationType), nullable=False)
    recipient_type = Column(String, nullable=False)  # "user", "role", "email", "webhook"
    recipient = Column(String, nullable=False)  # User ID, role name, email, webhook URL

    # Notification content
    subject = Column(String, nullable=True)
    message = Column(String, nullable=False)
    template_data = Column(JSON, nullable=True)  # Template variables

    # Notification status
    status = Column(String, default="pending", nullable=False)  # "pending", "sent", "delivered", "failed"
    sent_at = Column(DateTime(timezone=True), nullable=True)
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(String, nullable=True)

    # Notification metadata
    priority = Column(String, default="normal", nullable=False)  # "low", "normal", "high", "urgent"
    retry_count = Column(Integer, default=0, nullable=False)
    max_retries = Column(Integer, default=3, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    workflow_instance = relationship("WorkflowInstance", backref="notifications")
    step_execution = relationship("WorkflowStepExecution", backref="notifications")

class WorkflowMetrics(Base):
    """Performance metrics for workflows"""
    __tablename__ = "workflow_metrics"

    id = Column(String, primary_key=True)
    workflow_definition_id = Column(String, ForeignKey("workflow_definitions.id", ondelete="CASCADE"), nullable=False)
    workflow_instance_id = Column(String, ForeignKey("workflow_instances.id", ondelete="SET NULL"), nullable=True)
    tenant_id = Column(String, nullable=False, index=True)

    # Performance metrics
    total_duration_minutes = Column(Integer, nullable=True)
    step_duration_minutes = Column(JSON, nullable=True)  # Duration per step
    approval_time_minutes = Column(Integer, nullable=True)
    escalation_count = Column(Integer, default=0, nullable=False)

    # Success metrics
    success_rate = Column(String, nullable=True)  # Calculated success rate
    completion_rate = Column(String, nullable=True)  # Calculated completion rate
    timeout_count = Column(Integer, default=0, nullable=False)

    # SLA metrics
    sla_met = Column(Boolean, nullable=True)  # Whether SLA was met
    sla_breach_minutes = Column(Integer, nullable=True)  # Minutes over SLA

    # User experience metrics
    average_steps_completed = Column(String, nullable=True)
    average_approvals_per_workflow = Column(String, nullable=True)
    user_satisfaction_score = Column(String, nullable=True)

    # Time period for aggregated metrics
    metric_date = Column(DateTime(timezone=True), nullable=False, index=True)  # Date these metrics are for
    is_aggregated = Column(Boolean, default=False, nullable=False)  # True for daily/weekly/monthly aggregates

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    workflow_definition = relationship("WorkflowDefinition", back_populates="metrics")
    workflow_instance = relationship("WorkflowInstance", back_populates="metrics")
