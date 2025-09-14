from sqlalchemy import Column, String, DateTime, Integer, Boolean, JSON, ForeignKey, Enum, ForeignKeyConstraint, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
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
    USER = "user"
    VIEWER = "viewer"

class AuthProvider(enum.Enum):
    LOCAL = "local"
    GOOGLE = "google"

class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True)
    email = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.USER, nullable=False)
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

    # AI Assistant defaults
    default_ai_provider_id = Column(String, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    ai_assistant_providers = relationship("AIAssistantProvider", back_populates="user", cascade="all, delete-orphan")
    ai_assistant_conversations = relationship("AIAssistantConversation", back_populates="user", cascade="all, delete-orphan")
    # templates = relationship("Template", foreign_keys="Template.created_by")
    # audit_logs = relationship("AuditLog", foreign_keys="AuditLog.actor")

class Template(Base):
    __tablename__ = "templates"
    
    id = Column(String, primary_key=True)
    version = Column(String, primary_key=True)
    owner = Column(String, nullable=False)
    hash = Column(String, nullable=False)
    metadata_json = Column(JSON)
    created_by = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    aliases = relationship("Alias", back_populates="template")

class Alias(Base):
    __tablename__ = "aliases"
    
    alias = Column(String, primary_key=True)
    template_id = Column(String, nullable=False)
    target_version = Column(String, nullable=False)
    weights_json = Column(JSON)
    etag = Column(String)
    updated_by = Column(String, nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Foreign key constraint
    __table_args__ = (
        ForeignKeyConstraint(['template_id', 'target_version'], ['templates.id', 'templates.version']),
    )
    
    # Relationships
    template = relationship("Template", back_populates="aliases")

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
    actor = Column(String, nullable=False)
    action = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    before_json = Column(JSON)
    after_json = Column(JSON)
    ts = Column(DateTime(timezone=True), server_default=func.now())

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
    owner = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    modules = relationship("Module", back_populates="project")

class Prompt(Base):
    __tablename__ = "prompts"

    id = Column(String, primary_key=True)
    version = Column(String, primary_key=True)
    module_id = Column(String, nullable=False)
    content = Column(String, nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    created_by = Column(String, nullable=False)
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

    # Foreign key
    __table_args__ = (
        ForeignKeyConstraint(['module_id'], ['modules.id']),
    )

    # Relationships
    module = relationship("Module", back_populates="prompts")
    model_compatibilities = relationship("ModelCompatibility", back_populates="prompt")
    approval_requests = relationship("ApprovalRequest", back_populates="prompt")

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
    requested_by = Column(String, nullable=False)
    requested_at = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String, nullable=False)
    approver = Column(String, nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(String, nullable=True)
    comments = Column(String, nullable=True)

    # Foreign key
    __table_args__ = (
        ForeignKeyConstraint(['prompt_id'], ['prompts.id']),
    )

    # Relationships
    prompt = relationship("Prompt", back_populates="approval_requests")

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
    created_by = Column(String, nullable=False)

    # Relationships
    provider = relationship("AIAssistantProvider", backref="system_prompts")

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