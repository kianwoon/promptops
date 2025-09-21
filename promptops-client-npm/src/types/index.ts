/**
 * Core types for PromptOps Client
 */

// Performance monitoring types
export * from './performance';

// A/B Testing types
export * from './ab-testing';

// Environment types
export * from './environment';

export interface PromptOpsConfig {
  baseUrl?: string;
  apiKey?: string;
  timeout?: number;
  retries?: number;
  enableCache?: boolean;
  cacheTTL?: number;
  enableTelemetry?: boolean;
  redisUrl?: string;
  telemetryEndpoint?: string;
  userAgent?: string;
  environment?: string;
  autoDetectEnvironment?: boolean;
  connectionTimeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  enableConnectionTest?: boolean;
  healthCheckEndpoint?: string;
}

export interface PromptRequest {
  promptId: string;
  version?: string;
  variables?: Record<string, any>;
  modelProvider?: string;
  modelName?: string;
  tenantId?: string;
  projectId?: string;
  overrides?: Record<string, any>;
}

export interface PromptResponse {
  id: string;
  version: string;
  module_id: string;
  name: string;
  description?: string;
  content: string;
  model_specific_prompts: ModelSpecificPrompt[];
  target_models: string[];
  mas_intent: string;
  mas_fairness_notes: string;
  mas_testing_notes?: string;
  mas_risk_level: 'low' | 'medium' | 'high';
  mas_approval_log?: Record<string, any>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ModelSpecificPrompt {
  model_provider: string;
  model_name: string;
  content: string;
  expected_output_format?: string;
  instructions?: string;
}

export interface Module {
  id: string;
  version: string;
  project_id: string;
  slot: string;
  render_body: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  owner: string;
  created_at: string;
  updated_at: string;
}

export interface CacheConfig {
  memoryCacheSize?: number;
  redisUrl?: string;
  defaultTTL?: number;
  enableRedis?: boolean;
}

export interface TelemetryConfig {
  enabled: boolean;
  endpoint?: string;
  batchSize?: number;
  flushInterval?: number;
  sampleRate?: number;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  jitter: boolean;
}

export interface VariableSubstitutionConfig {
  enableStrictMode: boolean;
  fallbackValue?: any;
  enableRecursiveSubstitution: boolean;
  maxRecursionDepth: number;
}

export interface ModelCompatibility {
  id: string;
  prompt_id: string;
  model_name: string;
  model_provider: string;
  is_compatible: boolean;
  compatibility_notes?: string;
  created_at: string;
}

export interface ApprovalRequest {
  id: string;
  prompt_id: string;
  requested_by: string;
  requested_at: string;
  status: 'pending' | 'approved' | 'rejected';
  approver?: string;
  approved_at?: string;
  rejection_reason?: string;
  comments?: string;
}

export interface RenderResult {
  messages: Array<{
    role: string;
    content: string;
  }>;
  hash: string;
  template_id: string;
  version: string;
  inputs_used: Record<string, any>;
  applied_policies: string[];
}

export interface APIError {
  code: string;
  message: string;
  details?: Record<string, any>;
  stack?: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}