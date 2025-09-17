// API Response Types
export interface ApiResponse<T> {
  data: T
  message?: string
  success: boolean
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

// Template Types
export interface Template {
  id: string
  version: string
  owner: string
  hash: string
  metadata?: TemplateMetadata
  created_by: string
  created_at: string
}

export interface TemplateMetadata {
  description?: string
  author?: string
  tags?: string[]
  template_yaml?: string
}

export interface TemplateVersion {
  template_id: string
  version: string
  created_at: string
  hash: string
  created_by: string
}

export interface TemplateCreate {
  id?: string
  version: string
  owner: string
  template_yaml: string
  metadata?: TemplateMetadata
}

// Alias Types
export interface Alias {
  alias: string
  template_id: string
  target_version: string
  weights: Record<string, number>
  etag: string
  updated_by: string
  updated_at: string
}

export interface AliasUpdate {
  weights: Record<string, number>
  description?: string
}

// Render Types
export interface RenderRequest {
  id: string
  alias: string
  inputs: Record<string, any>
  tenant?: string
  overrides?: Record<string, any>
}

export interface RenderResponse {
  messages: Message[]
  hash: string
  template_id: string
  version: string
  inputs_used: Record<string, any>
  applied_policies: string[]
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_call_id?: string
}

// Evaluation Types
export interface EvaluationRun {
  id: string
  template_id: string
  version: string
  suite_id: string
  metrics: EvaluationMetrics
  passed: boolean
  created_at: string
}

export interface EvaluationMetrics {
  accuracy?: number
  latency_ms?: number
  cost_usd?: number
  pass_rate?: number
  [key: string]: any
}

export interface EvaluationRunCreate {
  template_id: string
  version: string
  suite_id: string
}

// Policy Types
export interface PolicyEvaluationRequest {
  template_id: string
  version: string
  inputs: Record<string, any>
  tenant?: string
}

export interface PolicyEvaluationResponse {
  allowed: boolean
  reason: string
  policies_applied: string[]
}

// Dashboard Types
export interface DashboardStats {
  total_templates: number
  total_deployments: number
  active_evaluations: number
  total_requests: number
}

export interface UsageMetrics {
  timestamp: string
  requests: number
  latency_ms: number
  cost_usd: number
}

// User Types
export interface User {
  id: string
  email: string
  name: string
  phone?: string
  organization?: string
  companySize?: string
  role: string
  roles: string[]
  tenant?: string
  createdAt?: string
  is_active?: boolean
  avatar?: string
}

export interface UserCreate {
  email: string
  name: string
  role?: string
  organization?: string
  phone?: string
  companySize?: string
  hashed_password?: string
}

export interface UserUpdate {
  name?: string
  email?: string
  phone?: string
  organization?: string
  companySize?: string
  role?: string
  is_active?: boolean
}

// Project Types
export interface Project {
  id: string
  name: string
  description?: string
  owner: string
  created_at: string
  updated_at: string
  modules_count?: number
  prompts_count?: number
}

export interface ProjectCreate {
  name: string
  description?: string
  owner: string
}

export interface ProjectUpdate {
  name?: string
  description?: string
}

// Module Types
export interface Module {
  id: string
  version: string
  project_id: string
  slot: string
  render_body: string
  metadata?: Record<string, any>
  created_at: string
  updated_at: string
}

export interface ModuleCreate {
  id: string
  version: string
  project_id: string
  slot: string
  render_body: string
  metadata?: Record<string, any>
}

export interface ModuleUpdate {
  slot?: string
  render_body?: string
  metadata?: Record<string, any>
}

// Prompt Types
export interface ModelSpecificPrompt {
  model_provider: string
  model_name: string
  content: string
  expected_output_format?: string
  instructions?: string
}

export interface Prompt {
  id: string
  version: string
  module_id: string
  content: string
  name: string
  description?: string
  provider_id?: string | null
  provider_name?: string | null
  created_by: string
  created_at: string
  updated_at: string
  mas_intent: string
  mas_fairness_notes: string
  mas_testing_notes?: string
  mas_risk_level: string
  mas_approval_log?: Record<string, any>
  target_models: string[]
  model_specific_prompts: ModelSpecificPrompt[]
}

export interface PromptCreate {
  id: string
  version: string
  module_id: string
  content: string
  name: string
  description?: string
  provider_id?: string | null
  target_models: string[]
  model_specific_prompts: ModelSpecificPrompt[]
  mas_intent: string
  mas_fairness_notes: string
  mas_testing_notes?: string
  mas_risk_level: string
  mas_approval_log?: Record<string, any>
}

export interface PromptUpdate {
  name?: string
  description?: string
  content?: string
  provider_id?: string | null
  target_models?: string[]
  model_specific_prompts?: ModelSpecificPrompt[]
  mas_intent?: string
  mas_fairness_notes?: string
  mas_testing_notes?: string
  mas_risk_level?: string
  mas_approval_log?: Record<string, any>
}

// Compatibility Matrix Types
export interface CompatibilityTestResult {
  status: 'works' | 'needs_tuning' | 'not_supported'
  response_time: number
  quality_score: number
  estimated_cost: number
  error?: string
}

export interface CompatibilityMatrixResponse {
  prompt_preview: string
  results: Record<string, CompatibilityTestResult>
  summary: {
    total_providers: number
    working_count: number
    needs_tuning_count: number
    not_supported_count: number
    working_providers: string[]
    needs_tuning: string[]
    not_supported: string[]
  }
  recommendations: string[]
  cached?: boolean
}

export interface ProjectCompatibilitySummary {
  project_id: string
  provider_summary: Record<string, {
    compatible: number
    incompatible: number
  }>
  total_tests: number
}

export interface BatchTestResult {
  batch_id: string
  total_prompts_tested: number
  results: Record<string, CompatibilityMatrixResponse>
  errors: Record<string, string>
  summary: {
    providers_tested: string[]
    provider_success_rates: Record<string, number>
    best_overall_provider: string
  }
}

export interface CompatibilityTrend {
  prompt_id: string
  period_days: number
  trends: Record<string, Record<string, {
    status: string
    quality_score: number
    response_time: number
  }>>
  data_points: number
}

export interface ModelCompatibility {
  id: string
  prompt_id: string
  model_name: string
  model_provider: string
  provider_type: string
  is_compatible: boolean
  compatibility_notes?: string
  created_at: string
}

export interface ModelCompatibilityCreate {
  prompt_id: string
  model_name: string
  model_provider: string
  provider_type: string
  is_compatible: boolean
  compatibility_notes?: string
}

export interface ModelCompatibilityUpdate {
  is_compatible?: boolean
  compatibility_notes?: string
}

// Approval Request Types
export interface ApprovalRequest {
  id: string
  prompt_id: string
  requested_by: string
  requested_at: string
  status: 'pending' | 'approved' | 'rejected'
  approver?: string
  approved_at?: string
  rejection_reason?: string
  comments?: string
}

export interface ApprovalRequestCreate {
  prompt_id: string
  requested_by: string
  status: 'pending' | 'approved' | 'rejected'
  approver?: string
  rejection_reason?: string
  comments?: string
}

export interface ApprovalRequestUpdate {
  status?: 'pending' | 'approved' | 'rejected'
  approver?: string
  rejection_reason?: string
  comments?: string
}

// AI Assistant Provider Types
export interface AIAssistantProvider {
  id: string
  user_id: string
  provider_type: 'openai' | 'anthropic' | 'gemini' | 'qwen' | 'openrouter' | 'ollama'
  name: string
  status: 'active' | 'error' | 'inactive'
  api_key?: string
  api_base_url?: string
  model_name?: string
  organization?: string
  created_at: string
  updated_at: string
}

export interface AIAssistantProviderCreate {
  provider_type: 'openai' | 'anthropic' | 'gemini' | 'qwen' | 'openrouter' | 'ollama'
  name: string
  api_key?: string
  api_base_url?: string
  model_name?: string
  organization?: string
}

export interface AIAssistantProviderUpdate {
  name?: string
  api_key?: string
  api_base_url?: string
  model_name?: string
  organization?: string
  status?: 'active' | 'error' | 'inactive'
}