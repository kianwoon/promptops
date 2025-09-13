from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional
from datetime import datetime

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

    class Config:
        from_attributes = True

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

# ModelCompatibility schemas
class ModelCompatibilityCreate(BaseModel):
    prompt_id: str
    model_name: str
    model_provider: str
    is_compatible: bool
    compatibility_notes: Optional[str] = None

    class Config:
        protected_namespaces = ()

class ModelCompatibilityResponse(BaseModel):
    id: str
    prompt_id: str
    model_name: str
    model_provider: str
    is_compatible: bool
    compatibility_notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
        protected_namespaces = ()

class ModelCompatibilityUpdate(BaseModel):
    is_compatible: Optional[bool] = None
    compatibility_notes: Optional[str] = None

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