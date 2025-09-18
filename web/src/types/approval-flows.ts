// Approval Flow Types for Custom Workflow Design

import {
  CustomRole,
  ApiResponse,
  PaginatedResponse
} from './governance'

// ============ APPROVAL FLOW CORE TYPES ============

export interface ApprovalFlow {
  id: string
  name: string
  description: string
  version: string
  status: string
  category: string
  trigger_condition: Record<string, any>
  steps: ApprovalFlowStep[]
  timeout_minutes: number
  requires_evidence: boolean
  auto_approve_threshold?: number | null
  escalation_rules?: any[] | null
  notification_settings?: any | null
  created_by: string
  created_at: string
  updated_at: string
  tenant_id: string
}

export interface ApprovalFlowStep {
  id?: string
  name: string
  description?: string
  step_type: string
  order: number
  required: boolean
  timeout_hours?: number
  assigned_roles?: string[]
  approval_roles?: string[]
  min_approvals?: number
  is_parallel: boolean
  notification_settings?: NotificationSettings
  conditions?: any[]
  actions?: any[]
  depends_on?: string[]
}

export type ApprovalStepType =
  | 'manual_approval'
  | 'automated_approval'
  | 'parallel_approval'
  | 'sequential_approval'
  | 'conditional_approval'
  | 'notification'
  | 'data_collection'
  | 'external_system'
  | 'timer'
  | 'escalation'

export interface FlowCondition {
  id: string
  name: string
  description?: string
  condition_type: 'resource' | 'user' | 'role' | 'custom' | 'system'
  expression: string
  required: boolean
  metadata?: Record<string, any>
}

export interface StepCondition {
  id: string
  field: string
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'in' | 'not_in'
  value: any
  required: boolean
  description?: string
}

export interface StepAction {
  id: string
  action_type: 'notify' | 'escalate' | 'auto_approve' | 'auto_reject' | 'assign' | 'update_status'
  trigger: 'on_create' | 'on_approve' | 'on_reject' | 'on_timeout' | 'on_condition'
  parameters: Record<string, any>
}

export interface NotificationSettings {
  email_enabled: boolean
  in_app_enabled: boolean
  webhook_enabled: boolean
  reminder_hours?: number
  escalation_hours?: number
  custom_webhooks?: string[]
}

export interface FlowMetadata {
  category?: string
  tags?: string[]
  priority?: 'low' | 'medium' | 'high' | 'critical'
  compliance_requirements?: string[]
  sla_hours?: number
  custom_fields?: Record<string, any>
}

// ============ APPROVAL REQUEST TYPES ============

export interface ApprovalRequest {
  id: string
  flow_id: string
  flow_name: string
  resource_type: string
  resource_id: string
  resource_name: string
  request_type: 'create' | 'update' | 'delete'
  requested_by: string
  requested_at: string
  current_step_id?: string
  status: RequestStatus
  steps: RequestStep[]
  data: Record<string, any>
  attachments?: RequestAttachment[]
  comments?: RequestComment[]
  metadata: RequestMetadata
}

export type RequestStatus =
  | 'pending'
  | 'in_progress'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'escalated'
  | 'timeout'

export interface RequestStep {
  id: string
  step_id: string
  step_name: string
  status: StepStatus
  assigned_to: string[]
  assigned_at?: string
  started_at?: string
  completed_at?: string
  action?: 'approve' | 'reject' | 'escalate' | 'request_changes'
  comments?: string
  metadata?: Record<string, any>
}

export type StepStatus =
  | 'pending'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'skipped'
  | 'timeout'

export interface RequestAttachment {
  id: string
  filename: string
  file_type: string
  file_size: number
  url: string
  uploaded_by: string
  uploaded_at: string
}

export interface RequestComment {
  id: string
  step_id?: string
  author: string
  content: string
  created_at: string
  is_internal: boolean
  metadata?: Record<string, any>
}

export interface RequestMetadata {
  priority?: 'low' | 'medium' | 'high' | 'critical'
  due_date?: string
  tags?: string[]
  custom_fields?: Record<string, any>
  source_ip?: string
  user_agent?: string
}

// ============ FLOW DESIGNER TYPES ============

export interface FlowDesignerState {
  flow: ApprovalFlow | null
  availableRoles: CustomRole[]
  availableSteps: StepTemplate[]
  isEditing: boolean
  isCreating: boolean
  validationErrors: ValidationError[]
  selectedStep: string | null
  isDragging: boolean
  previewMode: boolean
}

export interface StepTemplate {
  id: string
  name: string
  description: string
  step_type: ApprovalStepType
  default_timeout_hours?: number
  required_roles?: string[]
  default_conditions?: StepCondition[]
  default_actions?: StepAction[]
  icon?: string
  category: 'approval' | 'review' | 'notification' | 'escalation' | 'automatic'
}

export interface ValidationError {
  field: string
  message: string
  severity: 'error' | 'warning' | 'info'
  step_id?: string
}

export interface FlowValidationResult {
  is_valid: boolean
  errors: ValidationError[]
  warnings: ValidationError[]
  suggestions: string[]
}

// ============ API REQUEST/RESPONSE TYPES ============

export interface ApprovalFlowCreate {
  name: string
  description: string
  flow_type: 'predefined' | 'custom'
  steps: Omit<ApprovalFlowStep, 'id'>[]
  conditions?: FlowCondition[]
  metadata?: Partial<FlowMetadata>
}

export interface ApprovalFlowUpdate {
  name?: string
  description?: string
  status?: 'active' | 'inactive' | 'draft'
  steps?: ApprovalFlowStep[]
  conditions?: FlowCondition[]
  metadata?: Partial<FlowMetadata>
}

export interface ApprovalFlowResponse extends ApiResponse<ApprovalFlow> {}

export interface ApprovalFlowListResponse extends ApiResponse<ApprovalFlow[]> {
  pagination?: PaginatedResponse<ApprovalFlow[]>
}

export interface ApprovalRequestCreate {
  flow_id: string
  resource_type: string
  resource_id: string
  resource_name: string
  request_type: 'create' | 'update' | 'delete'
  data: Record<string, any>
  attachments?: Omit<RequestAttachment, 'id' | 'uploaded_at'>[]
  metadata?: Partial<RequestMetadata>
}

export interface ApprovalRequestUpdate {
  status?: RequestStatus
  step_id?: string
  action?: 'approve' | 'reject' | 'escalate' | 'request_changes'
  comments?: string
  metadata?: Partial<RequestMetadata>
}

export interface ApprovalRequestResponse extends ApiResponse<ApprovalRequest> {}

export interface ApprovalRequestListResponse extends ApiResponse<ApprovalRequest[]> {
  pagination?: PaginatedResponse<ApprovalRequest[]>
}

// ============ FLOW EXECUTION TYPES ============

export interface FlowExecutionContext {
  request: ApprovalRequest
  flow: ApprovalFlow
  current_step: ApprovalFlowStep
  user_context: UserContext
  system_context: SystemContext
}

export interface UserContext {
  user_id: string
  roles: string[]
  permissions: string[]
  department?: string
  level?: number
}

export interface SystemContext {
  timestamp: string
  tenant_id?: string
  environment: 'development' | 'staging' | 'production'
  configuration: Record<string, any>
}

export interface FlowExecutionResult {
  success: boolean
  next_step_id?: string
  actions_taken: ExecutionAction[]
  errors: string[]
  warnings: string[]
  metadata?: Record<string, any>
}

export interface ExecutionAction {
  action_type: 'notify' | 'escalate' | 'assign' | 'update_status' | 'custom'
  target: string
  parameters: Record<string, any>
  timestamp: string
  result: 'success' | 'failed' | 'pending'
  error_message?: string
}

// ============ FILTER AND SEARCH TYPES ============

export interface ApprovalFlowFilter {
  search?: string
  flow_type?: 'predefined' | 'custom'
  status?: 'active' | 'inactive' | 'draft'
  created_by?: string
  category?: string
  tags?: string[]
  date_range?: {
    start: string
    end: string
  }
}

export interface ApprovalRequestFilter {
  search?: string
  status?: RequestStatus
  requested_by?: string
  resource_type?: string
  flow_id?: string
  priority?: 'low' | 'medium' | 'high' | 'critical'
  date_range?: {
    start: string
    end: string
  }
  assigned_to?: string
}

// ============ DASHBOARD AND STATISTICS TYPES ============

export interface ApprovalFlowStats {
  total_flows: number
  active_flows: number
  total_requests: number
  pending_requests: number
  avg_processing_time_hours: number
  flows_by_category: Record<string, number>
  requests_by_status: Record<string, number>
  top_performing_flows: Array<{
    flow_id: string
    flow_name: string
    success_rate: number
    avg_time_hours: number
  }>
}

export interface UserApprovalStats {
  total_assigned: number
  pending_review: number
  approved: number
  rejected: number
  avg_response_time_hours: number
  recent_activity: Array<{
    request_id: string
    action: string
    timestamp: string
    resource_name: string
  }>
}

// ============ PREDEFINED TEMPLATES ============

export interface FlowTemplate {
  id: string
  name: string
  description: string
  category: 'basic' | 'advanced' | 'compliance' | 'custom'
  flow_type: 'predefined' | 'custom'
  icon: string
  steps: Omit<ApprovalFlowStep, 'id'>[]
  conditions?: FlowCondition[]
  metadata: Partial<FlowMetadata>
  estimated_duration_hours: number
  complexity: 'simple' | 'medium' | 'complex'
  tags: string[]
}

export const PREDEFINED_FLOW_TEMPLATES: FlowTemplate[] = [
  {
    id: 'basic_approval',
    name: 'Basic Approval',
    description: 'Simple two-step approval process: Editor review followed by final approval',
    category: 'basic',
    flow_type: 'predefined',
    icon: 'check-circle',
    estimated_duration_hours: 48,
    complexity: 'simple',
    tags: ['quick', 'standard', 'content'],
    steps: [
      {
        name: 'Editor Review',
        description: 'Initial review and content validation by editors',
        step_type: 'manual_approval',
        order: 0,
        required: true,
        timeout_hours: 24,
        assigned_roles: ['editor'],
        conditions: [],
        actions: [],
        notification_settings: {
          email_enabled: true,
          in_app_enabled: true,
          webhook_enabled: false,
          reminder_hours: 12,
          escalation_hours: 20
        },
        is_parallel: false,
        depends_on: []
      },
      {
        name: 'Final Approval',
        description: 'Final approval by designated approvers',
        step_type: 'manual_approval',
        order: 1,
        required: true,
        timeout_hours: 24,
        assigned_roles: ['approver'],
        conditions: [],
        actions: [],
        notification_settings: {
          email_enabled: true,
          in_app_enabled: true,
          webhook_enabled: false,
          reminder_hours: 12,
          escalation_hours: 20
        },
        is_parallel: false,
        depends_on: []
      }
    ],
    conditions: [],
    metadata: {
      category: 'content',
      priority: 'medium',
      tags: ['basic', 'content', 'standard']
    }
  },
  {
    id: 'multi_level_approval',
    name: 'Multi-Level Approval',
    description: 'Comprehensive three-step approval process with escalation path',
    category: 'advanced',
    flow_type: 'predefined',
    icon: 'layers',
    estimated_duration_hours: 72,
    complexity: 'medium',
    tags: ['comprehensive', 'escalation', 'critical'],
    steps: [
      {
        name: 'Editor Review',
        description: 'Initial content review and validation',
        step_type: 'manual_approval',
        order: 0,
        required: true,
        timeout_hours: 24,
        assigned_roles: ['editor'],
        conditions: [],
        actions: [],
        notification_settings: {
          email_enabled: true,
          in_app_enabled: true,
          webhook_enabled: false,
          reminder_hours: 12,
          escalation_hours: 20
        },
        is_parallel: false,
        depends_on: []
      },
      {
        name: 'Manager Approval',
        description: 'Manager review and approval',
        step_type: 'manual_approval',
        order: 1,
        required: true,
        timeout_hours: 24,
        assigned_roles: ['manager'],
        conditions: [],
        actions: [],
        notification_settings: {
          email_enabled: true,
          in_app_enabled: true,
          webhook_enabled: false,
          reminder_hours: 12,
          escalation_hours: 20
        },
        is_parallel: false,
        depends_on: []
      },
      {
        name: 'Admin Review',
        description: 'Administrative review for high-impact items',
        step_type: 'manual_approval',
        order: 2,
        required: true,
        timeout_hours: 24,
        assigned_roles: ['admin'],
        conditions: [],
        actions: [],
        notification_settings: {
          email_enabled: true,
          in_app_enabled: true,
          webhook_enabled: false,
          reminder_hours: 12,
          escalation_hours: 20
        },
        is_parallel: false,
        depends_on: []
      }
    ],
    conditions: [],
    metadata: {
      category: 'governance',
      priority: 'high',
      tags: ['multi-level', 'comprehensive', 'critical']
    }
  }
]

export const PREDEFINED_STEP_TEMPLATES: StepTemplate[] = [
  {
    id: 'editor_review',
    name: 'Editor Review',
    description: 'Initial review by content editors',
    step_type: 'manual_approval',
    default_timeout_hours: 24,
    category: 'approval',
    icon: 'edit'
  },
  {
    id: 'approver_review',
    name: 'Approver Review',
    description: 'Final approval by designated approvers',
    step_type: 'manual_approval',
    default_timeout_hours: 48,
    category: 'approval',
    icon: 'check-circle'
  },
  {
    id: 'admin_review',
    name: 'Admin Review',
    description: 'Administrative review for high-impact items',
    step_type: 'manual_approval',
    default_timeout_hours: 72,
    category: 'approval',
    icon: 'shield'
  },
  {
    id: 'parallel_approval',
    name: 'Parallel Approval',
    description: 'Requires approval from multiple approvers in parallel',
    step_type: 'parallel_approval',
    default_timeout_hours: 24,
    category: 'approval',
    icon: 'users'
  },
  {
    id: 'sequential_approval',
    name: 'Sequential Approval',
    description: 'Requires approval in sequence from multiple approvers',
    step_type: 'sequential_approval',
    default_timeout_hours: 48,
    category: 'approval',
    icon: 'list-ol'
  },
  {
    id: 'conditional_approval',
    name: 'Conditional Approval',
    description: 'Approval based on specific conditions',
    step_type: 'conditional_approval',
    default_timeout_hours: 24,
    category: 'approval',
    icon: 'code-branch'
  },
  {
    id: 'automated_approval',
    name: 'Automated Approval',
    description: 'Automated approval based on predefined rules',
    step_type: 'automated_approval',
    default_timeout_hours: 1,
    category: 'approval',
    icon: 'robot'
  },
  {
    id: 'notification',
    name: 'Notification',
    description: 'Send notifications to stakeholders',
    step_type: 'notification',
    category: 'notification',
    icon: 'bell'
  },
  {
    id: 'escalation',
    name: 'Escalation',
    description: 'Escalate to higher authorities',
    step_type: 'escalation',
    default_timeout_hours: 24,
    category: 'escalation',
    icon: 'arrow-up'
  },
  {
    id: 'data_collection',
    name: 'Data Collection',
    description: 'Collect data from users or systems',
    step_type: 'data_collection',
    default_timeout_hours: 24,
    category: 'data',
    icon: 'database'
  },
  {
    id: 'external_system',
    name: 'External System',
    description: 'Integrate with external systems',
    step_type: 'external_system',
    default_timeout_hours: 24,
    category: 'integration',
    icon: 'external-link'
  },
  {
    id: 'timer',
    name: 'Timer',
    description: 'Wait for a specified time period',
    step_type: 'timer',
    default_timeout_hours: 24,
    category: 'timing',
    icon: 'clock'
  }
]

export const VALIDATION_RULES = {
  FLOW_NAME: {
    required: true,
    min_length: 3,
    max_length: 100,
    pattern: /^[a-zA-Z0-9\s\-_]+$/
  },
  STEP_NAME: {
    required: true,
    min_length: 2,
    max_length: 50,
    pattern: /^[a-zA-Z0-9\s\-_]+$/
  },
  ROLE_ASSIGNMENT: {
    min_roles: 1,
    max_roles: 10
  },
  TIMEOUT_HOURS: {
    min: 1,
    max: 720, // 30 days
    default: 24
  }
}

// ============ UTILITY TYPES ============

export type FlowStepId = string
export type FlowRoleId = string
export type FlowConditionId = string

export interface FlowExportOptions {
  format: 'json' | 'yaml' | 'xml'
  include_metadata: boolean
  include_statistics: boolean
  date_range?: {
    start: string
    end: string
  }
}

export interface FlowImportResult {
  success: boolean
  imported_flows: number
  errors: string[]
  warnings: string[]
  details: Array<{
    flow_name: string
    status: 'success' | 'failed' | 'warning'
    message?: string
  }>
}

// ============ EVENT TYPES ============

export interface ApprovalFlowEvent {
  event_type:
    | 'flow_created'
    | 'flow_updated'
    | 'flow_deleted'
    | 'flow_activated'
    | 'flow_deactivated'
    | 'request_created'
    | 'request_updated'
    | 'request_completed'
    | 'step_assigned'
    | 'step_completed'
    | 'step_timeout'
  flow_id?: string
  request_id?: string
  step_id?: string
  user_id: string
  timestamp: string
  metadata?: Record<string, any>
}