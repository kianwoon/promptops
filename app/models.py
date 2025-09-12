from sqlalchemy import Column, String, DateTime, Integer, Boolean, JSON, ForeignKey, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base
import enum

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
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships (will be updated as needed)
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
    
    # Relationships
    template = relationship("Template", back_populates="aliases")

class Module(Base):
    __tablename__ = "modules"
    
    id = Column(String, primary_key=True)
    version = Column(String, primary_key=True)
    slot = Column(String, nullable=False)
    render_body = Column(String, nullable=False)
    metadata_json = Column(JSON)

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