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
    
    class Config:
        from_attributes = True

# Module schemas
class ModuleCreate(BaseModel):
    id: str
    version: str
    slot: str
    render_body: str
    metadata: Optional[Dict[str, Any]] = None

class ModuleResponse(BaseModel):
    id: str
    version: str
    slot: str
    render_body: str
    metadata: Optional[Dict[str, Any]] = None
    
    class Config:
        from_attributes = True

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