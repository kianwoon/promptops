/**
 * A/B Testing Framework Types
 */

import { PromptRequest, PromptResponse } from './index';

export enum ExperimentStatus {
  DRAFT = 'draft',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export enum TrafficAllocationStrategy {
  UNIFORM = 'uniform',
  WEIGHTED = 'weighted',
  STICKY = 'sticky',
  GEOGRAPHIC = 'geographic',
  USER_ATTRIBUTE = 'user_attribute'
}

export enum EventType {
  PROMPT_REQUEST = 'prompt_request',
  PROMPT_RENDER = 'prompt_render',
  MODEL_RESPONSE = 'model_response',
  CONVERSION = 'conversion',
  ERROR = 'error',
  CUSTOM = 'custom'
}

export interface ExperimentVariant {
  id: string;
  name: string;
  description?: string;
  weight: number;
  prompt_config: Record<string, any>;
  is_control: boolean;
}

export interface ExperimentCreateRequest {
  name: string;
  description?: string;
  project_id: string;
  prompt_id: string;
  start_time?: Date;
  end_time?: Date;
  traffic_percentage: number;
  allocation_strategy: TrafficAllocationStrategy;
  target_audience?: Record<string, any>;
  geographic_targeting?: Record<string, any>;
  user_attributes?: Record<string, any>;
  min_sample_size: number;
  statistical_significance: number;
  primary_metric: string;
  secondary_metrics?: string[];
  control_variant: ExperimentVariant;
  treatment_variants: ExperimentVariant[];
}

export interface ExperimentUpdateRequest {
  name?: string;
  description?: string;
  status?: ExperimentStatus;
  start_time?: Date;
  end_time?: Date;
  traffic_percentage?: number;
  target_audience?: Record<string, any>;
  geographic_targeting?: Record<string, any>;
  user_attributes?: Record<string, any>;
  min_sample_size?: number;
  statistical_significance?: number;
  primary_metric?: string;
  secondary_metrics?: string[];
}

export interface Experiment {
  id: string;
  name: string;
  description?: string;
  project_id: string;
  prompt_id: string;
  status: ExperimentStatus;
  start_time?: Date;
  end_time?: Date;
  traffic_percentage: number;
  allocation_strategy: TrafficAllocationStrategy;
  target_audience?: Record<string, any>;
  geographic_targeting?: Record<string, any>;
  user_attributes?: Record<string, any>;
  min_sample_size: number;
  statistical_significance: number;
  primary_metric: string;
  secondary_metrics?: string[];
  control_variant: ExperimentVariant;
  treatment_variants: ExperimentVariant[];
  results?: Record<string, any>;
  winner_determined: boolean;
  winning_variant?: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface ExperimentAssignment {
  id: string;
  experiment_id: string;
  user_id?: string;
  session_id: string;
  device_id?: string;
  variant_id: string;
  variant_name: string;
  variant_config: Record<string, any>;
  assigned_at: Date;
  assignment_reason?: string;
  is_consistent: boolean;
}

export interface ExperimentEventCreateRequest {
  experiment_id: string;
  assignment_id?: string;
  event_type: EventType;
  event_name: string;
  event_data?: Record<string, any>;
  user_id?: string;
  session_id: string;
  device_id?: string;
  response_time_ms?: number;
  tokens_used?: number;
  cost_usd?: string;
  conversion_value?: string;
  success_indicator?: boolean;
  error_message?: string;
  occurred_at?: Date;
}

export interface ExperimentEvent {
  id: string;
  experiment_id: string;
  assignment_id?: string;
  event_type: EventType;
  event_name: string;
  event_data?: Record<string, any>;
  user_id?: string;
  session_id: string;
  device_id?: string;
  response_time_ms?: number;
  tokens_used?: number;
  cost_usd?: string;
  conversion_value?: string;
  success_indicator?: boolean;
  error_message?: string;
  occurred_at: Date;
  created_at: Date;
}

export interface ExperimentResult {
  id: string;
  experiment_id: string;
  variant_id: string;
  variant_name: string;
  sample_size: number;
  conversion_count: number;
  conversion_rate: string;
  confidence_interval_lower: string;
  confidence_interval_upper: string;
  p_value: string;
  statistical_significance: boolean;
  average_response_time?: number;
  average_tokens_used?: number;
  total_cost?: string;
  metric_period_start: Date;
  metric_period_end: Date;
  is_control: boolean;
  calculation_method: string;
  calculated_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface FeatureFlagCreateRequest {
  name: string;
  description?: string;
  project_id: string;
  prompt_id?: string;
  enabled: boolean;
  rollout_percentage: number;
  rollout_strategy: TrafficAllocationStrategy;
  targeting_rules?: Record<string, any>;
  is_staged_rollout: boolean;
  current_stage: number;
  total_stages: number;
  stage_rollout_percentage?: number[];
  is_canary_release: boolean;
  canary_percentage: number;
  canary_duration_hours: number;
  scheduled_enable_time?: Date;
  scheduled_disable_time?: Date;
}

export interface FeatureFlagUpdateRequest {
  name?: string;
  description?: string;
  enabled?: boolean;
  rollout_percentage?: number;
  rollout_strategy?: TrafficAllocationStrategy;
  targeting_rules?: Record<string, any>;
  is_staged_rollout?: boolean;
  current_stage?: number;
  total_stages?: number;
  stage_rollout_percentage?: number[];
  is_canary_release?: boolean;
  canary_percentage?: number;
  canary_duration_hours?: number;
  scheduled_enable_time?: Date;
  scheduled_disable_time?: Date;
}

export interface FeatureFlag {
  id: string;
  name: string;
  description?: string;
  project_id: string;
  prompt_id?: string;
  enabled: boolean;
  rollout_percentage: number;
  rollout_strategy: TrafficAllocationStrategy;
  targeting_rules?: Record<string, any>;
  is_staged_rollout: boolean;
  current_stage: number;
  total_stages: number;
  stage_rollout_percentage?: number[];
  is_canary_release: boolean;
  canary_percentage: number;
  canary_duration_hours: number;
  scheduled_enable_time?: Date;
  scheduled_disable_time?: Date;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface UserSegmentCreateRequest {
  name: string;
  description?: string;
  project_id: string;
  segment_conditions: Record<string, any>;
  segment_type: string;
  estimated_user_count: number;
}

export interface UserSegmentUpdateRequest {
  name?: string;
  description?: string;
  segment_conditions?: Record<string, any>;
  segment_type?: string;
  estimated_user_count?: number;
  is_active?: boolean;
}

export interface UserSegment {
  id: string;
  name: string;
  description?: string;
  project_id: string;
  segment_conditions: Record<string, any>;
  segment_type: string;
  estimated_user_count: number;
  actual_user_count: number;
  is_active: boolean;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface ExperimentStats {
  total_experiments: number;
  active_experiments: number;
  completed_experiments: number;
  total_events: number;
  total_assignments: number;
  experiments_by_project: Record<string, number>;
  events_by_type: Record<string, number>;
}

export interface VariantPerformance {
  variant_id: string;
  variant_name: string;
  sample_size: number;
  conversion_rate: number;
  confidence_interval_lower: number;
  confidence_interval_upper: number;
  p_value: number;
  is_winner: boolean;
  improvement_over_control: number;
}

export interface ABTestingConfig {
  enableAutomaticAssignment: boolean;
  enableEventTracking: boolean;
  enableResultCalculation: boolean;
  cacheTTL: number;
  assignmentConsistency: boolean;
  defaultSessionTimeout: number;
}

export interface ExperimentContext {
  userId?: string;
  sessionId: string;
  deviceId?: string;
  userAgent?: string;
  ipAddress?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface PromptVariant {
  variantId: string;
  variantName: string;
  promptContent: string;
  variables?: Record<string, any>;
  modelProvider?: string;
  modelName?: string;
  isControl: boolean;
}

export interface ABTestPromptRequest extends PromptRequest {
  experimentId?: string;
  forceVariant?: string;
  skipAssignment?: boolean;
  context?: ExperimentContext;
}