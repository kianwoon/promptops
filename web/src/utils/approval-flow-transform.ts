// Data transformation utilities for approval flows
import type {
  ApprovalFlow,
  ApprovalFlowStep,
  NotificationSettings
} from '../types/approval-flows'

// Backend step structure (from steps_json)
interface BackendApprovalFlowStep {
  id?: string
  name: string
  description?: string
  step_type: string
  order?: number
  required?: boolean
  timeout_hours?: number
  approval_roles?: string[]
  min_approvals?: number
  is_parallel?: boolean
  notification_settings?: NotificationSettings
  [key: string]: any // Allow for additional backend fields
}

// Backend flow structure
interface BackendApprovalFlow {
  id: string
  name: string
  description: string
  version?: string
  status?: string
  category?: string
  trigger_condition?: Record<string, any>
  steps_json?: BackendApprovalFlowStep[] | string
  steps?: BackendApprovalFlowStep[]
  timeout_minutes?: number
  requires_evidence?: boolean
  auto_approve_threshold?: number | null
  escalation_rules?: any[] | null
  notification_settings?: any | null
  created_by?: string
  created_at?: string
  updated_at?: string
  tenant_id?: string
  [key: string]: any // Allow for additional backend fields
}

// Default notification settings
const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  email_enabled: true,
  in_app_enabled: true,
  webhook_enabled: false,
  reminder_hours: 12,
  escalation_hours: 24
}

// Transform backend step to frontend ApprovalFlowStep
export function transformBackendStepToStep(
  backendStep: BackendApprovalFlowStep,
  index: number = 0
): ApprovalFlowStep {
  // Handle case where step_type might need mapping
  const stepTypeMapping: Record<string, string> = {
    'manual': 'manual_approval',
    'approval': 'manual_approval',
    'automatic': 'automated_approval',
    'parallel': 'parallel_approval',
    'sequential': 'sequential_approval',
    'conditional': 'conditional_approval',
    'notify': 'notification',
    'collect': 'data_collection',
    'external': 'external_system',
    'wait': 'timer',
    'escalate': 'escalation'
  }

  const mappedStepType = stepTypeMapping[backendStep.step_type] || backendStep.step_type

  return {
    id: backendStep.id || `step-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
    name: backendStep.name || `Step ${index + 1}`,
    description: backendStep.description || '',
    step_type: mappedStepType,
    order: backendStep.order ?? index,
    required: backendStep.required ?? true,
    timeout_hours: backendStep.timeout_hours ?? 24,
    assigned_roles: backendStep.approval_roles || [],
    min_approvals: backendStep.min_approvals ?? 1,
    is_parallel: backendStep.is_parallel ?? false,
    notification_settings: backendStep.notification_settings || DEFAULT_NOTIFICATION_SETTINGS,
    conditions: [],
    actions: [],
    depends_on: []
  }
}

// Transform backend flow to frontend ApprovalFlow
export function transformBackendFlowToFlow(backendFlow: BackendApprovalFlow): ApprovalFlow {
  console.log('🔍 [DEBUG] transformBackendFlowToFlow: Input backendFlow:', backendFlow)

  // Parse steps from steps_json if it's a string, or use steps array directly
  let steps: BackendApprovalFlowStep[] = []

  if (typeof backendFlow.steps_json === 'string') {
    try {
      steps = JSON.parse(backendFlow.steps_json)
    } catch (error) {
      console.warn('Failed to parse steps_json:', error)
      steps = []
    }
  } else if (Array.isArray(backendFlow.steps_json)) {
    steps = backendFlow.steps_json
  } else if (Array.isArray(backendFlow.steps)) {
    steps = backendFlow.steps
  }

  console.log('🔍 [DEBUG] transformBackendFlowToFlow: Parsed steps:', steps)

  // Transform each step
  const transformedSteps = steps.map((step, index) =>
    transformBackendStepToStep(step, index)
  )

  console.log('🔍 [DEBUG] transformBackendFlowToFlow: Transformed steps:', transformedSteps)

  const result = {
    id: backendFlow.id,
    name: backendFlow.name,
    description: backendFlow.description,
    version: backendFlow.version || '1.0.0',
    status: backendFlow.status || 'active',
    category: backendFlow.category || 'general',
    trigger_condition: backendFlow.trigger_condition || {},
    steps: transformedSteps,
    timeout_minutes: backendFlow.timeout_minutes ?? 1440, // 24 hours default
    requires_evidence: backendFlow.requires_evidence ?? false,
    auto_approve_threshold: backendFlow.auto_approve_threshold,
    escalation_rules: backendFlow.escalation_rules || [],
    notification_settings: backendFlow.notification_settings,
    created_by: backendFlow.created_by || 'system',
    created_at: backendFlow.created_at || new Date().toISOString(),
    updated_at: backendFlow.updated_at || new Date().toISOString(),
    tenant_id: backendFlow.tenant_id || 'default'
  }

  console.log('🔍 [DEBUG] transformBackendFlowToFlow: Result:', result)
  return result
}

// Transform multiple backend flows to frontend flows
export function transformBackendFlowsToFlows(backendFlows: BackendApprovalFlow[]): ApprovalFlow[] {
  console.log('🔍 [DEBUG] transformBackendFlowsToFlows: Input:', backendFlows)
  const result = backendFlows.map(transformBackendFlowToFlow)
  console.log('🔍 [DEBUG] transformBackendFlowsToFlows: Output:', result)
  return result
}

// Transform frontend step to backend format (for API requests)
export function transformStepToBackend(step: ApprovalFlowStep): BackendApprovalFlowStep {
  return {
    id: step.id,
    name: step.name,
    description: step.description,
    step_type: step.step_type,
    order: step.order,
    required: step.required,
    timeout_hours: step.timeout_hours,
    approval_roles: step.assigned_roles,
    min_approvals: step.min_approvals,
    is_parallel: step.is_parallel,
    notification_settings: step.notification_settings
  }
}

// Transform frontend flow to backend format (for API requests)
export function transformFlowToBackend(flow: Omit<ApprovalFlow, 'id' | 'created_at' | 'updated_at'>): Omit<BackendApprovalFlow, 'id' | 'created_at' | 'updated_at'> {
  return {
    name: flow.name,
    description: flow.description,
    version: flow.version,
    status: flow.status,
    category: flow.category,
    trigger_condition: flow.trigger_condition,
    steps: flow.steps.map(transformStepToBackend),
    timeout_minutes: flow.timeout_minutes,
    requires_evidence: flow.requires_evidence,
    auto_approve_threshold: flow.auto_approve_threshold,
    escalation_rules: flow.escalation_rules,
    notification_settings: flow.notification_settings,
    created_by: flow.created_by,
    tenant_id: flow.tenant_id
  }
}