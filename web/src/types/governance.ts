// Governance System Types for Enhanced RBAC

// Base Types
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

// Enhanced RBAC Types
export interface Permission {
  id: string
  name: string
  description: string
  category: 'project' | 'module' | 'prompt' | 'template' | 'policy' | 'system' | 'user' | 'role' | 'permission_template' | 'workflow' | 'compliance_report' | 'audit_log' | 'api_key' | 'tenant'
  resource_type: string
  action: string
  conditions?: Record<string, any>
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PermissionType {
  value: string
  label: string
  description: string
}

export interface ResourceType {
  value: string
  label: string
  description: string
}

export interface InheritanceType {
  value: string
  label: string
  description: string
}

// Custom Role Management
export interface CustomRole {
  name: string
  description?: string
  permissions: string[]
  permission_templates: string[]
  inherited_roles: string[]
  inheritance_type: string
  conditions: Record<string, any>
  is_active: boolean
  created_at: string
  created_by?: string
  updated_at: string
  updated_by?: string
  tenant_id?: string
}

export interface CustomRoleCreate {
  name: string
  description?: string
  permissions: string[]
  permission_templates?: string[]
  inherited_roles?: string[]
  inheritance_type?: string
  conditions?: Record<string, any>
}

export interface CustomRoleUpdate {
  description?: string
  permissions?: string[]
  permission_templates?: string[]
  inherited_roles?: string[]
  inheritance_type?: string
  conditions?: Record<string, any>
}

export interface CustomRoleResponse {
  name: string
  description?: string
  permissions: string[]
  permission_templates: string[]
  inherited_roles: string[]
  inheritance_type: string
  conditions: Record<string, any>
  is_active: boolean
  created_at: string
  created_by?: string
  updated_at: string
  updated_by?: string
  tenant_id?: string
}

// Permission Templates
export interface PermissionTemplate {
  id: string
  name: string
  description?: string
  permissions: PermissionTemplatePermission[]
  category: string
  is_system: boolean
  is_active: boolean
  created_at: string
  created_by?: string
  updated_at: string
  updated_by?: string
  tenant_id?: string
}

export interface PermissionTemplatePermission {
  resource_type: string
  action: string
  conditions?: Record<string, any>
}

export interface PermissionTemplateCreate {
  name: string
  description?: string
  permissions: PermissionTemplatePermission[]
  category?: string
}

export interface PermissionTemplateUpdate {
  name?: string
  description?: string
  permissions?: PermissionTemplatePermission[]
  category?: string
  is_active?: boolean
}

export interface PermissionTemplateResponse {
  id: string
  name: string
  description?: string
  permissions: PermissionTemplatePermission[]
  category: string
  is_system: boolean
  is_active: boolean
  created_at: string
  created_by?: string
  updated_at: string
  updated_by?: string
  tenant_id?: string
}

// Role Inheritance
export interface RoleInheritance {
  parent_role: string
  child_role: string
  inheritance_type: string
  conditions: Record<string, any>
  is_active: boolean
  created_at: string
  created_by?: string
  tenant_id?: string
}

export interface RoleInheritanceCreate {
  parent_role: string
  child_role: string
  inheritance_type?: string
  conditions?: Record<string, any>
}

export interface RoleInheritanceResponse {
  parent_role: string
  child_role: string
  inheritance_type: string
  conditions: Record<string, any>
  is_active: boolean
  created_at: string
  created_by?: string
  tenant_id?: string
}

// Resource-Specific Permissions
export interface ResourceSpecificPermission {
  id: string
  role_name: string
  resource_type: string
  resource_id: string
  action: string
  conditions: Record<string, any>
  expires_at?: string
  is_active: boolean
  created_at: string
  created_by?: string
  tenant_id?: string
}

export interface ResourceSpecificPermissionCreate {
  role_name: string
  resource_type: string
  resource_id: string
  action: string
  conditions?: Record<string, any>
  expires_at?: string
}

export interface ResourceSpecificPermissionUpdate {
  conditions?: Record<string, any>
  expires_at?: string
  is_active?: boolean
}

export interface ResourceSpecificPermissionResponse {
  id: string
  role_name: string
  resource_type: string
  resource_id: string
  action: string
  conditions: Record<string, any>
  expires_at?: string
  is_active: boolean
  created_at: string
  created_by?: string
  tenant_id?: string
}

// Access Reviews
export interface AccessReview {
  id: string
  title: string
  description?: string
  review_type: 'periodic' | 'event_based' | 'user_driven'
  scope: AccessReviewScope
  reviewers: string[]
  status: 'pending' | 'in_progress' | 'completed' | 'expired' | 'cancelled'
  due_date?: string
  findings: AccessReviewFinding[]
  recommendations: AccessReviewRecommendation[]
  created_at: string
  created_by?: string
  completed_at?: string
  tenant_id?: string
}

export interface AccessReviewScope {
  users?: string[]
  roles?: string[]
  resources?: {
    type: string
    ids: string[]
  }[]
  time_period?: {
    start: string
    end: string
  }
}

export interface AccessReviewFinding {
  id: string
  type: 'excessive_access' | 'unused_permissions' | 'compliance_violation' | 'security_risk'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  affected_users: string[]
  affected_resources: {
    type: string
    id: string
  }[]
  recommendation: string
  evidence?: Record<string, any>
}

export interface AccessReviewRecommendation {
  id: string
  type: 'remove_access' | 'add_permissions' | 'modify_role' | 'create_review'
  priority: 'low' | 'medium' | 'high'
  description: string
  affected_users: string[]
  affected_roles?: string[]
  implementation_steps: string[]
  estimated_effort?: string
}

export interface AccessReviewCreate {
  title: string
  description?: string
  review_type: 'periodic' | 'event_based' | 'user_driven'
  scope: AccessReviewScope
  reviewers: string[]
  due_date?: string
}

export interface AccessReviewUpdate {
  title?: string
  description?: string
  reviewers?: string[]
  due_date?: string
  status?: 'pending' | 'in_progress' | 'completed' | 'expired' | 'cancelled'
}

export interface AccessReviewResponse {
  id: string
  title: string
  description?: string
  review_type: 'periodic' | 'event_based' | 'user_driven'
  scope: AccessReviewScope
  reviewers: string[]
  status: 'pending' | 'in_progress' | 'completed' | 'expired' | 'cancelled'
  due_date?: string
  findings: AccessReviewFinding[]
  recommendations: AccessReviewRecommendation[]
  created_at: string
  created_by?: string
  completed_at?: string
  tenant_id?: string
}

// Permission Checking
export interface PermissionCheckRequest {
  user_roles: string[]
  action: string
  resource_type: string
  resource_id?: string
  context?: Record<string, any>
  tenant_id?: string
}

export interface PermissionCheckResponse {
  allowed: boolean
  reason?: string
  conditions_met?: Record<string, boolean>
  effective_permissions: string[]
  inheritance_chain: string[]
}

export interface EnhancedPermissionCheckResponse {
  allowed: boolean
  reason: string
  conditions_met: Record<string, boolean>
  effective_permissions: string[]
  inheritance_chain: string[]
}

// Bulk Operations
export interface BulkRoleAssignmentRequest {
  user_ids: string[]
  role_names: string[]
  resource_type?: string
  resource_id?: string
  conditions?: Record<string, any>
}

export interface BulkRoleAssignmentResponse {
  success_count: number
  failure_count: number
  errors: string[]
  details: BulkAssignmentDetail[]
}

export interface BulkAssignmentDetail {
  user_id: string
  role: string
  status: 'success' | 'failed' | 'error'
  error?: string
}

export interface BulkPermissionUpdateRequest {
  role_name: string
  updates: BulkPermissionUpdate[]
}

export interface BulkPermissionUpdate {
  action: string
  operation: 'add' | 'remove'
}

export interface BulkPermissionUpdateResponse {
  success_count: number
  failure_count: number
  errors: string[]
}

// Role Permission Management
export interface RolePermission {
  id: string
  role_name: string
  resource_type: string
  action: string
  conditions?: Record<string, any>
  permission_template_id?: string
  is_active: boolean
  created_at: string
  created_by?: string
  updated_at: string
  updated_by?: string
  tenant_id?: string
}

export interface RolePermissionCreate {
  role_name: string
  resource_type: string
  action: string
  conditions?: Record<string, any>
  permission_template_id?: string
  is_active?: boolean
  tenant_id?: string
}

export interface RolePermissionUpdate {
  resource_type?: string
  action?: string
  conditions?: Record<string, any>
  permission_template_id?: string
  is_active?: boolean
}

export interface RolePermissionResponse {
  id: string
  role_name: string
  resource_type: string
  action: string
  conditions?: Record<string, any>
  permission_template_id?: string
  is_active: boolean
  created_at: string
  created_by?: string
  updated_at: string
  updated_by?: string
  tenant_id?: string
}

// System Information
export interface SystemPermissions {
  permissions: Permission[]
  resource_types: ResourceType[]
  inheritance_types: InheritanceType[]
  available_conditions: ConditionType[]
}

export interface ConditionType {
  type: string
  name: string
  description: string
  parameters: ConditionParameter[]
}

export interface ConditionParameter {
  name: string
  type: string
  required: boolean
  description: string
  default_value?: any
}

// Role Hierarchy
export interface RoleHierarchy {
  roles: RoleHierarchyNode[]
  inheritance: RoleInheritance[]
}

export interface RoleHierarchyNode {
  name: string
  type: 'system' | 'custom'
  description?: string
  permissions: string[]
  children: string[]
  parents: string[]
}

// Permission Matrix
export interface PermissionMatrix {
  roles: string[]
  resources: string[]
  actions: string[]
  matrix: PermissionMatrixCell[]
}

export interface PermissionMatrixCell {
  role: string
  resource: string
  action: string
  has_permission: boolean
  conditions?: Record<string, any>
  source: 'direct' | 'inherited' | 'template'
}

// Audit and Compliance
export interface PermissionAuditLog {
  id: string
  timestamp: string
  user_id: string
  action: string
  resource_type: string
  resource_id?: string
  role_name?: string
  permission?: string
  details: Record<string, any>
  result: 'success' | 'failure' | 'error'
  error_message?: string
  ip_address?: string
  user_agent?: string
}

export interface ComplianceReport {
  id: string
  name: string
  report_type: string
  status: 'generating' | 'completed' | 'failed' | 'archived'
  scope: Record<string, any>
  findings?: Record<string, any>
  recommendations?: Record<string, any>
  metrics?: Record<string, any>
  generated_by?: string
  tenant_id?: string
  file_path?: string
  file_size?: number
  file_hash?: string
  created_at: string
  updated_at: string
  completed_at?: string
}

// UI Components State Types
export interface RoleManagementState {
  roles: CustomRole[]
  templates: PermissionTemplate[]
  loading: boolean
  error: string | null
  selectedRole: CustomRole | null
  isCreating: boolean
  isEditing: boolean
}

export interface PermissionMatrixState {
  matrix: PermissionMatrix | null
  loading: boolean
  error: string | null
  selectedRoles: string[]
  selectedResources: string[]
  filter: {
    search: string
    category: string
    isActive: boolean
  }
}

export interface AccessReviewState {
  reviews: AccessReview[]
  loading: boolean
  error: string | null
  selectedReview: AccessReview | null
  isCreating: boolean
  filters: {
    status: string
    type: string
    reviewer: string
  }
}

export interface PermissionTemplateState {
  templates: PermissionTemplate[]
  loading: boolean
  error: string | null
  selectedTemplate: PermissionTemplate | null
  isCreating: boolean
  isEditing: boolean
}

// API Response Wrappers
export interface CustomRoleListResponse extends ApiResponse<CustomRole[]> {
  pagination?: PaginatedResponse<CustomRole[]>
}

export interface PermissionTemplateListResponse extends ApiResponse<PermissionTemplate[]> {
  pagination?: PaginatedResponse<PermissionTemplate[]>
}

export interface AccessReviewListResponse extends ApiResponse<AccessReview[]> {
  pagination?: PaginatedResponse<AccessReview[]>
}

export interface RoleHierarchyResponse extends ApiResponse<RoleHierarchy> {}

export interface PermissionMatrixResponse extends ApiResponse<PermissionMatrix> {}

export interface SystemPermissionsResponse extends ApiResponse<SystemPermissions> {}

// Form Types
export interface RoleFormData {
  name: string
  description: string
  permissions: string[]
  permission_templates: string[]
  inherited_roles: string[]
  inheritance_type: string
  conditions: Record<string, any>
}

export interface TemplateFormData {
  name: string
  description: string
  category: string
  permissions: PermissionTemplatePermission[]
}

export interface ReviewFormData {
  title: string
  description: string
  review_type: 'periodic' | 'event_based' | 'user_driven'
  reviewers: string[]
  due_date?: string
  scope: AccessReviewScope
}

// Filter and Search Types
export interface RoleFilter {
  search?: string
  type?: 'system' | 'custom'
  isActive?: boolean
  created_by?: string
  date_range?: {
    start: string
    end: string
  }
}

export interface PermissionFilter {
  resource_type?: string
  action?: string
  category?: string
  is_active?: boolean
}

export interface ReviewFilter {
  status?: string
  type?: string
  reviewer?: string
  date_range?: {
    start: string
    end: string
  }
}

// ============ AUDIT LOG TYPES ============

export interface AuditLog {
  id: string
  actor: string
  action: string
  subject: string
  subject_type: string
  subject_id: string
  tenant_id: string
  before_json?: Record<string, any>
  after_json?: Record<string, any>
  changes_json?: Record<string, any>
  metadata_json?: Record<string, any>
  session_id?: string
  ip_address?: string
  user_agent?: string
  request_id?: string
  result?: string
  error_message?: string
  ts: string
}

export interface AuditLogFilter {
  actor?: string
  action?: string
  subject_type?: string
  subject_id?: string
  result?: string
  start_date?: string
  end_date?: string
  ip_address?: string
  session_id?: string
  request_id?: string
  search?: string
  skip?: number
  limit?: number
}

export interface AuditLogStats {
  total_events: number
  events_by_action: Record<string, number>
  events_by_subject_type: Record<string, number>
  events_by_actor: Record<string, number>
  events_by_result: Record<string, number>
  events_by_date: Record<string, number>
  top_actors: Array<{
    actor: string
    count: number
  }>
  top_resources: Array<{
    resource: string
    count: number
  }>
  recent_errors: Array<{
    id: string
    action: string
    subject: string
    error_message: string
    timestamp: string
    actor: string
  }>
}

export interface AuditLogExportRequest {
  filters: AuditLogFilter
  format: 'json' | 'csv' | 'xlsx'
  include_metadata?: boolean
  include_changes?: boolean
}

export interface AuditLogExportResponse {
  export_id: string
  file_url?: string
  status: string
  total_records: number
  estimated_size?: number
  created_at: string
}

// Common audit log action types
export const AUDIT_ACTIONS = {
  // User actions
  CREATE_USER: 'create_user',
  UPDATE_USER: 'update_user',
  DELETE_USER: 'delete_user',
  LOGIN: 'login',
  LOGOUT: 'logout',

  // Resource actions
  CREATE_PROJECT: 'create_project',
  UPDATE_PROJECT: 'update_project',
  DELETE_PROJECT: 'delete_project',

  CREATE_MODULE: 'create_module',
  UPDATE_MODULE: 'update_module',
  DELETE_MODULE: 'delete_module',

  CREATE_PROMPT: 'create_prompt',
  UPDATE_PROMPT: 'update_prompt',
  DELETE_PROMPT: 'delete_prompt',

  CREATE_TEMPLATE: 'create_template',
  UPDATE_TEMPLATE: 'update_template',
  DELETE_TEMPLATE: 'delete_template',

  // Permission actions
  CREATE_ROLE: 'create_role',
  UPDATE_ROLE: 'update_role',
  DELETE_ROLE: 'delete_role',

  CREATE_PERMISSION: 'create_permission',
  UPDATE_PERMISSION: 'update_permission',
  DELETE_PERMISSION: 'delete_permission',

  // System actions
  SYSTEM_CONFIG_CHANGE: 'system_config_change',
  SECURITY_EVENT: 'security_event',
  APPROVAL_REQUEST: 'approval_request',
  APPROVAL_ACTION: 'approval_action',

  // API Key actions
  CREATE_API_KEY: 'create_api_key',
  UPDATE_API_KEY: 'update_api_key',
  DELETE_API_KEY: 'delete_api_key',
  REVOKE_API_KEY: 'revoke_api_key'
} as const

// Common subject types
export const SUBJECT_TYPES = {
  USER: 'user',
  PROJECT: 'project',
  MODULE: 'module',
  PROMPT: 'prompt',
  TEMPLATE: 'template',
  ROLE: 'role',
  PERMISSION: 'permission',
  API_KEY: 'api_key',
  SECURITY_EVENT: 'security_event',
  WORKFLOW: 'workflow',
  COMPLIANCE_REPORT: 'compliance_report',
  TENANT: 'tenant',
  SYSTEM: 'system'
} as const

// Result types
export const RESULT_TYPES = {
  SUCCESS: 'success',
  FAILURE: 'failure',
  ERROR: 'error',
  PENDING: 'pending'
} as const

// Export all types for easy importing
export type {
  // Re-export commonly used types from api.ts
  User,
  ApiResponse,
  PaginatedResponse
} from './api'