"""
A/B Testing Framework Models for Python Client
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Union


class ExperimentStatus(Enum):
    """Experiment status enumeration"""
    DRAFT = "draft"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class TrafficAllocationStrategy(Enum):
    """Traffic allocation strategy enumeration"""
    UNIFORM = "uniform"
    WEIGHTED = "weighted"
    STICKY = "sticky"
    GEOGRAPHIC = "geographic"
    USER_ATTRIBUTE = "user_attribute"


class EventType(Enum):
    """Event type enumeration"""
    PROMPT_REQUEST = "prompt_request"
    PROMPT_RENDER = "prompt_render"
    MODEL_RESPONSE = "model_response"
    CONVERSION = "conversion"
    ERROR = "error"
    CUSTOM = "custom"


@dataclass
class ExperimentVariant:
    """Experiment variant configuration"""
    id: str
    name: str
    description: Optional[str] = None
    weight: int = 1
    prompt_config: Dict[str, Any] = field(default_factory=dict)
    is_control: bool = False


@dataclass
class ExperimentCreateRequest:
    """Experiment creation request"""
    name: str
    project_id: str
    prompt_id: str
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    traffic_percentage: int = 50
    allocation_strategy: TrafficAllocationStrategy = TrafficAllocationStrategy.UNIFORM
    target_audience: Optional[Dict[str, Any]] = None
    geographic_targeting: Optional[Dict[str, Any]] = None
    user_attributes: Optional[Dict[str, Any]] = None
    min_sample_size: int = 1000
    statistical_significance: int = 95
    primary_metric: str = ""
    secondary_metrics: Optional[List[str]] = None
    control_variant: ExperimentVariant = field(default_factory=ExperimentVariant)
    treatment_variants: List[ExperimentVariant] = field(default_factory=list)


@dataclass
class ExperimentUpdateRequest:
    """Experiment update request"""
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[ExperimentStatus] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    traffic_percentage: Optional[int] = None
    target_audience: Optional[Dict[str, Any]] = None
    geographic_targeting: Optional[Dict[str, Any]] = None
    user_attributes: Optional[Dict[str, Any]] = None
    min_sample_size: Optional[int] = None
    statistical_significance: Optional[int] = None
    primary_metric: Optional[str] = None
    secondary_metrics: Optional[List[str]] = None


@dataclass
class Experiment:
    """Experiment representation"""
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


@dataclass
class ExperimentAssignment:
    """Experiment assignment for user/session"""
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


@dataclass
class ExperimentEventCreateRequest:
    """Event creation request"""
    experiment_id: str
    event_type: EventType
    event_name: str
    session_id: str
    assignment_id: Optional[str] = None
    event_data: Optional[Dict[str, Any]] = None
    user_id: Optional[str] = None
    device_id: Optional[str] = None
    response_time_ms: Optional[int] = None
    tokens_used: Optional[int] = None
    cost_usd: Optional[str] = None
    conversion_value: Optional[str] = None
    success_indicator: Optional[bool] = None
    error_message: Optional[str] = None
    occurred_at: Optional[datetime] = None


@dataclass
class ExperimentEvent:
    """Event representation"""
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


@dataclass
class ExperimentResult:
    """Experiment result representation"""
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


@dataclass
class FeatureFlagCreateRequest:
    """Feature flag creation request"""
    name: str
    description: Optional[str] = None
    project_id: str
    prompt_id: Optional[str] = None
    enabled: bool = False
    rollout_percentage: int = 0
    rollout_strategy: TrafficAllocationStrategy = TrafficAllocationStrategy.UNIFORM
    targeting_rules: Optional[Dict[str, Any]] = None
    is_staged_rollout: bool = False
    current_stage: int = 1
    total_stages: int = 5
    stage_rollout_percentage: Optional[List[int]] = None
    is_canary_release: bool = False
    canary_percentage: int = 5
    canary_duration_hours: int = 24
    scheduled_enable_time: Optional[datetime] = None
    scheduled_disable_time: Optional[datetime] = None


@dataclass
class FeatureFlagUpdateRequest:
    """Feature flag update request"""
    name: Optional[str] = None
    description: Optional[str] = None
    enabled: Optional[bool] = None
    rollout_percentage: Optional[int] = None
    rollout_strategy: Optional[TrafficAllocationStrategy] = None
    targeting_rules: Optional[Dict[str, Any]] = None
    is_staged_rollout: Optional[bool] = None
    current_stage: Optional[int] = None
    total_stages: Optional[int] = None
    stage_rollout_percentage: Optional[List[int]] = None
    is_canary_release: Optional[bool] = None
    canary_percentage: Optional[int] = None
    canary_duration_hours: Optional[int] = None
    scheduled_enable_time: Optional[datetime] = None
    scheduled_disable_time: Optional[datetime] = None


@dataclass
class FeatureFlag:
    """Feature flag representation"""
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


@dataclass
class UserSegmentCreateRequest:
    """User segment creation request"""
    name: str
    description: Optional[str] = None
    project_id: str
    segment_conditions: Dict[str, Any]
    segment_type: str
    estimated_user_count: int = 0


@dataclass
class UserSegmentUpdateRequest:
    """User segment update request"""
    name: Optional[str] = None
    description: Optional[str] = None
    segment_conditions: Optional[Dict[str, Any]] = None
    segment_type: Optional[str] = None
    estimated_user_count: Optional[int] = None
    is_active: Optional[bool] = None


@dataclass
class UserSegment:
    """User segment representation"""
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


@dataclass
class ExperimentStats:
    """A/B testing statistics"""
    total_experiments: int
    active_experiments: int
    completed_experiments: int
    total_events: int
    total_assignments: int
    experiments_by_project: Dict[str, int]
    events_by_type: Dict[str, int]


@dataclass
class VariantPerformance:
    """Variant performance metrics"""
    variant_id: str
    variant_name: str
    sample_size: int
    conversion_rate: float
    confidence_interval_lower: float
    confidence_interval_upper: float
    p_value: float
    is_winner: bool
    improvement_over_control: float


@dataclass
class ABTestingConfig:
    """A/B testing configuration"""
    enable_automatic_assignment: bool = True
    enable_event_tracking: bool = True
    enable_result_calculation: bool = True
    cache_ttl: int = 300000  # 5 minutes
    assignment_consistency: bool = True
    default_session_timeout: int = 3600000  # 1 hour


@dataclass
class ExperimentContext:
    """Experiment context information"""
    user_id: Optional[str] = None
    session_id: str = ""
    device_id: Optional[str] = None
    user_agent: Optional[str] = None
    ip_address: Optional[str] = None
    timestamp: datetime = field(default_factory=datetime.now)
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class PromptVariant:
    """Prompt variant information"""
    variant_id: str
    variant_name: str
    prompt_content: str
    variables: Optional[Dict[str, Any]] = None
    model_provider: Optional[str] = None
    model_name: Optional[str] = None
    is_control: bool = False


@dataclass
class ABTestPromptRequest:
    """A/B test prompt request"""
    prompt_id: str
    version: Optional[str] = None
    variables: Optional[Dict[str, Any]] = None
    model_provider: Optional[str] = None
    model_name: Optional[str] = None
    tenant_id: Optional[str] = None
    project_id: Optional[str] = None
    experiment_id: Optional[str] = None
    force_variant: Optional[str] = None
    skip_assignment: bool = False
    context: Optional[ExperimentContext] = None