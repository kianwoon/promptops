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
  id: string
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
  roles: string[]
  tenant?: string
}