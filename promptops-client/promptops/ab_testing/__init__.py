"""
A/B Testing Framework for PromptOps Python Client
"""

from .manager import ABTestingManager
from .models import (
    ExperimentStatus,
    TrafficAllocationStrategy,
    EventType,
    ExperimentVariant,
    ExperimentCreateRequest,
    ExperimentUpdateRequest,
    Experiment,
    ExperimentAssignment,
    ExperimentEventCreateRequest,
    ExperimentEvent,
    ExperimentResult,
    FeatureFlagCreateRequest,
    FeatureFlagUpdateRequest,
    FeatureFlag,
    UserSegmentCreateRequest,
    UserSegmentUpdateRequest,
    UserSegment,
    ExperimentStats,
    VariantPerformance,
    ABTestingConfig,
    ExperimentContext,
    PromptVariant,
    ABTestPromptRequest
)

__all__ = [
    "ABTestingManager",
    "ExperimentStatus",
    "TrafficAllocationStrategy",
    "EventType",
    "ExperimentVariant",
    "ExperimentCreateRequest",
    "ExperimentUpdateRequest",
    "Experiment",
    "ExperimentAssignment",
    "ExperimentEventCreateRequest",
    "ExperimentEvent",
    "ExperimentResult",
    "FeatureFlagCreateRequest",
    "FeatureFlagUpdateRequest",
    "FeatureFlag",
    "UserSegmentCreateRequest",
    "UserSegmentUpdateRequest",
    "UserSegment",
    "ExperimentStats",
    "VariantPerformance",
    "ABTestingConfig",
    "ExperimentContext",
    "PromptVariant",
    "ABTestPromptRequest"
]