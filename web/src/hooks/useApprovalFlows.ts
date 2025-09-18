// Approval Flows API Hooks

import React from 'react'
import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryOptions,
  UseMutationOptions
} from '@tanstack/react-query'
import toast from 'react-hot-toast'

import type {
  ApprovalFlow,
  ApprovalFlowCreate,
  ApprovalFlowUpdate,
  ApprovalFlowResponse,
  ApprovalFlowListResponse,
  ApprovalFlowFilter,
  ApprovalRequest,
  ApprovalRequestCreate,
  ApprovalRequestUpdate,
  ApprovalRequestResponse,
  ApprovalRequestListResponse,
  ApprovalRequestFilter,
  FlowValidationResult,
  FlowDesignerState,
  CustomRole,
  ApprovalFlowStats,
  UserApprovalStats,
  FlowExportOptions,
  FlowImportResult,
  StepTemplate,
  FlowTemplate,
  ValidationError
} from '@/types/approval-flows'

import type {
  CustomRoleResponse,
  PermissionTemplateResponse
} from '@/types/governance'

// Import transformation utilities
import {
  transformBackendFlowToFlow,
  transformBackendFlowsToFlows,
  transformFlowToBackend
} from '../utils/approval-flow-transform'

// Base API clients for approval flows and requests
const FLOWS_API_BASE = '/v1/approval-flows'
const REQUESTS_API_BASE = '/v1/approval-requests'

async function apiRequest<T>(endpoint: string, options: RequestInit = {}, baseUrl: string = REQUESTS_API_BASE): Promise<T> {
  const url = `${baseUrl}${endpoint}`

  // Get authentication token from localStorage
  const accessToken = localStorage.getItem('access_token')
  console.log('🔍 [DEBUG] apiRequest: URL:', url)
  console.log('🔍 [DEBUG] apiRequest: Access token exists:', !!accessToken)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers as Record<string, string>,
  }

  // Add Authorization header if token exists
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
    console.log('🔍 [DEBUG] apiRequest: Authorization header added')
  } else {
    console.log('🔍 [DEBUG] apiRequest: No authorization header (no token)')
  }

  console.log('🔍 [DEBUG] apiRequest: Headers:', headers)
  console.log('🔍 [DEBUG] apiRequest: Options:', options)

  const response = await fetch(url, {
    headers,
    ...options,
  })

  console.log('🔍 [DEBUG] apiRequest: Response status:', response.status)
  console.log('🔍 [DEBUG] apiRequest: Response ok:', response.ok)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Network error' }))
    console.error('🔍 [DEBUG] apiRequest: Error response:', error)
    let errorMessage = error.message || `HTTP ${response.status}`

    // Handle specific error codes with better messages
    if (response.status === 409) {
      errorMessage = error.detail || 'A duplicate entry was found. Please check your data and try again.'
    } else if (response.status === 400) {
      errorMessage = error.detail || 'Invalid request. Please check your input data.'
    } else if (response.status === 404) {
      errorMessage = 'Resource not found.'
    } else if (response.status === 500) {
      errorMessage = error.detail || 'Server error. Please try again later.'
    }

    throw new Error(errorMessage)
  }

  const data = await response.json()
  console.log('🔍 [DEBUG] apiRequest: Success response data:', data)
  return data
}

// ============ APPROVAL FLOW HOOKS ============

export const useApprovalFlows = (filters?: ApprovalFlowFilter, options?: UseQueryOptions<ApprovalFlow[]>) => {
  console.log('🔍 [DEBUG] useApprovalFlows: Hook being called with filters:', filters)

  const query = useQuery({
    queryKey: ['approval-flows', filters],
    queryFn: async () => {
      console.log('🔍 [DEBUG] useApprovalFlows: Fetching approval flows...')

      const params = new URLSearchParams()
      if (filters?.search) params.append('search', filters.search)
      if (filters?.flow_type) params.append('flow_type', filters.flow_type)
      if (filters?.status) params.append('status', filters.status)
      if (filters?.created_by) params.append('created_by', filters.created_by)
      if (filters?.category) params.append('category', filters.category)
      if (filters?.tags) params.append('tags', filters.tags.join(','))
      if (filters?.date_range) {
        params.append('start_date', filters.date_range.start)
        params.append('end_date', filters.date_range.end)
      }

      const endpoint = params.toString() ? `/flows?${params.toString()}` : '/flows'
      console.log('🔍 [DEBUG] useApprovalFlows: Endpoint:', `${FLOWS_API_BASE}${endpoint}`)

      try {
        const backendFlows = await apiRequest<any[]>(endpoint, {}, FLOWS_API_BASE)
        console.log('🔍 [DEBUG] useApprovalFlows: Raw backend response:', backendFlows)

        const transformedFlows = transformBackendFlowsToFlows(backendFlows)
        console.log('🔍 [DEBUG] useApprovalFlows: Transformed flows:', transformedFlows)

        return transformedFlows
      } catch (error) {
        console.error('🔍 [DEBUG] useApprovalFlows: Error fetching flows:', error)
        throw error
      }
    },
    ...options,
  })

  console.log('🔍 [DEBUG] useApprovalFlows: Query state:', {
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isSuccess: query.isSuccess,
    isError: query.isError,
    error: query.error,
    data: query.data,
    isDisabled: query.isDisabled
  })

  return query
}

export const useApprovalFlow = (flowId: string, options?: UseQueryOptions<ApprovalFlow>) =>
  useQuery({
    queryKey: ['approval-flows', flowId],
    queryFn: async () => {
      const backendFlow = await apiRequest<any>(`/flows/${flowId}`, {}, FLOWS_API_BASE)
      return transformBackendFlowToFlow(backendFlow)
    },
    enabled: !!flowId,
    ...options,
  })

export const useCreateApprovalFlow = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (flow: ApprovalFlowCreate) => {
      // Transform frontend flow structure to backend structure
      const backendFlow = {
        name: flow.name,
        description: flow.description,
        category: "approval", // Required field in backend
        trigger_condition: { event: "prompt_created" },
        steps: flow.steps?.map(step => ({
          name: step.name,
          description: step.description,
          step_type: step.step_type,
          order: step.order,
          required: step.required,
          approval_roles: step.assigned_roles,
          min_approvals: 1,
          is_parallel: step.is_parallel,
          notification_settings: step.notification_settings || {
            email_enabled: true,
            in_app_enabled: true,
            webhook_enabled: false
          }
        })) || [],
        timeout_minutes: 1440, // Default 24 hours - required field in backend
        requires_evidence: false, // Default value - required field in backend
        auto_approve_threshold: null, // Optional field
        escalation_rules: null, // Optional field
        notification_settings: null // Optional field
      }

      const backendResponse = await apiRequest<any>('/flows', {
        method: 'POST',
        body: JSON.stringify(backendFlow),
      }, FLOWS_API_BASE)

      // Transform the response back to frontend format
      return transformBackendFlowToFlow(backendResponse)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-flows'] })
      toast.success('Approval flow created successfully')
    },
    onError: (error) => {
      let userMessage = error.message

      // Provide more user-friendly messages for common constraint violations
      if (error.message.includes('uq_workflow_name_version_tenant')) {
        userMessage = 'An approval flow with this name already exists. Please use a different name.'
      } else if (error.message.includes('duplicate key value')) {
        userMessage = 'This approval flow already exists. Please check the name and try again.'
      } else if (error.message.includes('violates foreign key constraint')) {
        userMessage = 'Invalid reference to another record. Please check your flow configuration.'
      } else if (error.message.includes('violates check constraint')) {
        userMessage = 'Invalid data format. Please check all fields and try again.'
      }

      toast.error(`Failed to create approval flow: ${userMessage}`)
    },
  })
}

export const useUpdateApprovalFlow = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ flowId, flow }: { flowId: string; flow: ApprovalFlowUpdate }) => {
      const backendResponse = await apiRequest<any>(`/flows/${flowId}`, {
        method: 'PUT',
        body: JSON.stringify(flow),
      }, FLOWS_API_BASE)

      // Transform the response back to frontend format
      return transformBackendFlowToFlow(backendResponse)
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['approval-flows'] })
      queryClient.invalidateQueries({ queryKey: ['approval-flows', variables.flowId] })
      toast.success('Approval flow updated successfully')
    },
    onError: (error) => {
      toast.error(`Failed to update approval flow: ${error.message}`)
    },
  })
}

export const useDeleteApprovalFlow = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (flowId: string) =>
      apiRequest<any>(`/flows/${flowId}`, {
        method: 'DELETE',
      }, FLOWS_API_BASE),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-flows'] })
      toast.success('Approval flow deleted successfully')
    },
    onError: (error) => {
      toast.error(`Failed to delete approval flow: ${error.message}`)
    },
  })
}

export const useValidateApprovalFlow = () => {
  return useMutation({
    mutationFn: async (flow: Partial<ApprovalFlow>) => {
      // Mock validation for now since backend doesn't exist yet
      const errors = []

      if (!flow.name || flow.name.length < 3) {
        errors.push({
          field: 'name',
          message: 'Flow name must be at least 3 characters long',
          severity: 'error' as const
        })
      }

      if (!flow.steps || flow.steps.length === 0) {
        errors.push({
          field: 'steps',
          message: 'Flow must have at least one step',
          severity: 'error' as const
        })
      }

      for (let i = 0; i < flow.steps?.length || 0; i++) {
        const step = flow.steps[i]
        if (!step.assigned_roles || step.assigned_roles.length === 0) {
          errors.push({
            field: `steps.${i}.assigned_roles`,
            message: `Step "${step.name}" must have at least one role assigned`,
            severity: 'error' as const
          })
        }
      }

      return {
        is_valid: errors.length === 0,
        errors: errors,
        warnings: [],
        suggestions: []
      }
    },
    onError: (error) => {
      toast.error(`Flow validation failed: ${error.message}`)
    },
  })
}

export const useDuplicateApprovalFlow = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ flowId, newName }: { flowId: string; newName: string }) => {
      const backendResponse = await apiRequest<any>(`/flows/${flowId}/duplicate`, {
        method: 'POST',
        body: JSON.stringify({ name: newName }),
      }, FLOWS_API_BASE)

      // Transform the response back to frontend format
      return transformBackendFlowToFlow(backendResponse)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-flows'] })
      toast.success('Approval flow duplicated successfully')
    },
    onError: (error) => {
      toast.error(`Failed to duplicate approval flow: ${error.message}`)
    },
  })
}

export const useExportApprovalFlow = () => {
  return useMutation({
    mutationFn: ({ flowId, options }: { flowId: string; options: FlowExportOptions }) =>
      apiRequest<{ download_url: string; filename: string }>(`/flows/${flowId}/export`, {
        method: 'POST',
        body: JSON.stringify(options),
      }, FLOWS_API_BASE),
    onError: (error) => {
      toast.error(`Failed to export approval flow: ${error.message}`)
    },
  })
}

export const useImportApprovalFlow = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData()
      formData.append('file', file)

      return fetch(`${FLOWS_API_BASE}/flows/import`, {
        method: 'POST',
        body: formData,
      }).then(response => {
        if (!response.ok) {
          throw new Error('Import failed')
        }
        return response.json() as Promise<FlowImportResult>
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-flows'] })
      toast.success('Approval flow imported successfully')
    },
    onError: (error) => {
      toast.error(`Failed to import approval flow: ${error.message}`)
    },
  })
}

// ============ APPROVAL REQUEST HOOKS ============

export const useApprovalRequests = (filters?: ApprovalRequestFilter, options?: UseQueryOptions<ApprovalRequest[]>) =>
  useQuery({
    queryKey: ['approval-requests', filters],
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters?.search) params.append('search', filters.search)
      if (filters?.status) params.append('status', filters.status)
      if (filters?.requested_by) params.append('requested_by', filters.requested_by)
      if (filters?.resource_type) params.append('resource_type', filters.resource_type)
      if (filters?.flow_id) params.append('flow_id', filters.flow_id)
      if (filters?.priority) params.append('priority', filters.priority)
      if (filters?.assigned_to) params.append('assigned_to', filters.assigned_to)
      if (filters?.date_range) {
        params.append('start_date', filters.date_range.start)
        params.append('end_date', filters.date_range.end)
      }

      const endpoint = params.toString() ? `/?${params.toString()}` : '/'
      return apiRequest<ApprovalRequest[]>(endpoint)
    },
    ...options,
  })

export const useApprovalRequest = (requestId: string, options?: UseQueryOptions<ApprovalRequest>) =>
  useQuery({
    queryKey: ['approval-requests', requestId],
    queryFn: () => apiRequest<ApprovalRequest>(`/${requestId}`),
    enabled: !!requestId,
    ...options,
  })

export const useCreateApprovalRequest = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: ApprovalRequestCreate) =>
      apiRequest<ApprovalRequest>('/', {
        method: 'POST',
        body: JSON.stringify(request),
      }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['approval-requests'] })
      if (variables.flow_id) {
        queryClient.invalidateQueries({ queryKey: ['approval-requests', { flow_id: variables.flow_id }] })
      }
      toast.success('Approval request created successfully')
    },
    onError: (error) => {
      toast.error(`Failed to create approval request: ${error.message}`)
    },
  })
}

export const useUpdateApprovalRequest = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ requestId, request }: { requestId: string; request: ApprovalRequestUpdate }) =>
      apiRequest<ApprovalRequest>(`/${requestId}`, {
        method: 'PUT',
        body: JSON.stringify(request),
      }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['approval-requests'] })
      queryClient.invalidateQueries({ queryKey: ['approval-requests', variables.requestId] })
      toast.success('Approval request updated successfully')
    },
    onError: (error) => {
      toast.error(`Failed to update approval request: ${error.message}`)
    },
  })
}

export const useDeleteApprovalRequest = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (requestId: string) =>
      apiRequest<ApprovalRequest>(`/${requestId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-requests'] })
      toast.success('Approval request deleted successfully')
    },
    onError: (error) => {
      toast.error(`Failed to delete approval request: ${error.message}`)
    },
  })
}

export const useApproveRequest = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ requestId, stepId, comments }: { requestId: string; stepId?: string; comments?: string }) =>
      apiRequest<ApprovalRequest>(`/${requestId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ step_id: stepId, comments }),
      }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['approval-requests'] })
      queryClient.invalidateQueries({ queryKey: ['approval-requests', variables.requestId] })
      toast.success('Request approved successfully')
    },
    onError: (error) => {
      toast.error(`Failed to approve request: ${error.message}`)
    },
  })
}

export const useRejectRequest = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ requestId, stepId, comments }: { requestId: string; stepId?: string; comments: string }) =>
      apiRequest<ApprovalRequest>(`/${requestId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ step_id: stepId, comments }),
      }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['approval-requests'] })
      queryClient.invalidateQueries({ queryKey: ['approval-requests', variables.requestId] })
      toast.success('Request rejected successfully')
    },
    onError: (error) => {
      toast.error(`Failed to reject request: ${error.message}`)
    },
  })
}

export const useEscalateRequest = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ requestId, stepId, reason }: { requestId: string; stepId?: string; reason: string }) =>
      apiRequest<ApprovalRequest>(`/${requestId}/escalate`, {
        method: 'POST',
        body: JSON.stringify({ step_id: stepId, reason }),
      }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['approval-requests'] })
      queryClient.invalidateQueries({ queryKey: ['approval-requests', variables.requestId] })
      toast.success('Request escalated successfully')
    },
    onError: (error) => {
      toast.error(`Failed to escalate request: ${error.message}`)
    },
  })
}

// ============ FLOW TEMPLATES HOOKS ============

export const useFlowTemplates = (options?: UseQueryOptions<FlowTemplate[]>) =>
  useQuery({
    queryKey: ['flow-templates'],
    queryFn: async () => {
      // Import predefined flow templates
      const { PREDEFINED_FLOW_TEMPLATES } = await import('@/types/approval-flows')
      return PREDEFINED_FLOW_TEMPLATES
    },
    ...options,
  })

export const useCreateFlowFromTemplate = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ template, customName, customRoles }: {
      template: FlowTemplate;
      customName?: string;
      customRoles?: Record<string, string[]>
    }) => {
      // Apply customizations to template
      const customizedSteps = template.steps.map(step => ({
        ...step,
        assigned_roles: customRoles?.[step.step_type] || step.assigned_roles,
        id: `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      }))

      const flowData: ApprovalFlowCreate = {
        name: customName || template.name,
        description: template.description,
        flow_type: 'predefined',
        steps: customizedSteps,
        conditions: template.conditions,
        metadata: {
          ...template.metadata,
          template_id: template.id,
          template_name: template.name
        }
      }

      const backendResponse = await apiRequest<any>('/flows', {
        method: 'POST',
        body: JSON.stringify({
          name: flowData.name,
          description: flowData.description,
          category: "approval", // Required field in backend
          trigger_condition: { event: "prompt_created" },
          steps: flowData.steps?.map(step => ({
            name: step.name,
            description: step.description,
            step_type: step.step_type,
            order: step.order,
            required: step.required,
            approval_roles: step.assigned_roles,
            min_approvals: 1,
            is_parallel: step.is_parallel,
            notification_settings: step.notification_settings || {
              email_enabled: true,
              in_app_enabled: true,
              webhook_enabled: false
            }
          })) || [],
          timeout_minutes: 1440, // Default 24 hours - required field in backend
          requires_evidence: false, // Default value - required field in backend
          auto_approve_threshold: null, // Optional field
          escalation_rules: null, // Optional field
          notification_settings: null // Optional field
        }),
      }, FLOWS_API_BASE)

      // Transform the response back to frontend format
      return transformBackendFlowToFlow(backendResponse)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-flows'] })
      toast.success('Flow created from template successfully')
    },
    onError: (error) => {
      toast.error(`Failed to create flow from template: ${error.message}`)
    },
  })
}

// ============ STEP TEMPLATES HOOKS ============

export const useStepTemplates = (options?: UseQueryOptions<StepTemplate[]>) =>
  useQuery({
    queryKey: ['step-templates'],
    queryFn: async () => {
      // Return mock step templates for now since backend doesn't exist yet
      return [
        {
          id: 'manual_approval',
          name: 'Manual Approval',
          description: 'Requires manual approval from specified users or roles',
          step_type: 'manual_approval' as const,
          default_timeout_hours: 24,
          category: 'approval' as const,
          icon: 'users'
        },
        {
          id: 'automated_approval',
          name: 'Automated Approval',
          description: 'Automated approval based on predefined rules',
          step_type: 'automated_approval' as const,
          default_timeout_hours: 1,
          category: 'approval' as const,
          icon: 'robot'
        },
        {
          id: 'parallel_approval',
          name: 'Parallel Approval',
          description: 'Requires approval from multiple approvers in parallel',
          step_type: 'parallel_approval' as const,
          default_timeout_hours: 24,
          category: 'approval' as const,
          icon: 'git-branch'
        },
        {
          id: 'sequential_approval',
          name: 'Sequential Approval',
          description: 'Requires approval in sequence from multiple approvers',
          step_type: 'sequential_approval' as const,
          default_timeout_hours: 48,
          category: 'approval' as const,
          icon: 'list-ordered'
        },
        {
          id: 'conditional_approval',
          name: 'Conditional Approval',
          description: 'Approval based on specific conditions',
          step_type: 'conditional_approval' as const,
          default_timeout_hours: 24,
          category: 'approval' as const,
          icon: 'code'
        },
        {
          id: 'notification',
          name: 'Notification',
          description: 'Send notifications to stakeholders',
          step_type: 'notification' as const,
          category: 'notification' as const,
          icon: 'bell'
        },
        {
          id: 'data_collection',
          name: 'Data Collection',
          description: 'Collect data from users or systems',
          step_type: 'data_collection' as const,
          default_timeout_hours: 24,
          category: 'data' as const,
          icon: 'database'
        },
        {
          id: 'external_system',
          name: 'External System',
          description: 'Integrate with external systems',
          step_type: 'external_system' as const,
          default_timeout_hours: 24,
          category: 'integration' as const,
          icon: 'external-link'
        },
        {
          id: 'timer',
          name: 'Timer',
          description: 'Wait for a specified time period',
          step_type: 'timer' as const,
          default_timeout_hours: 24,
          category: 'timing' as const,
          icon: 'clock'
        },
        {
          id: 'escalation',
          name: 'Escalation',
          description: 'Escalate to higher authorities',
          step_type: 'escalation' as const,
          default_timeout_hours: 24,
          category: 'escalation' as const,
          icon: 'arrow-up'
        }
      ]
    },
    ...options,
  })

// ============ STATISTICS HOOKS ============

export const useApprovalFlowStats = (options?: UseQueryOptions<ApprovalFlowStats>) =>
  useQuery({
    queryKey: ['approval-flows', 'stats'],
    queryFn: async () => {
      // Return mock stats for now since backend doesn't exist yet
      return {
        total_flows: 5,
        active_flows: 3,
        total_requests: 42,
        pending_requests: 8,
        avg_processing_time_hours: 24.5,
        flows_by_category: {
          'general': 2,
          'technical': 2,
          'administrative': 1
        },
        requests_by_status: {
          'pending': 8,
          'approved': 28,
          'rejected': 4,
          'in_progress': 2
        },
        top_performing_flows: [
          {
            flow_id: '1',
            flow_name: 'Standard Review',
            success_rate: 95,
            avg_time_hours: 18
          }
        ]
      }
    },
    ...options,
  })

export const useUserApprovalStats = (userId?: string, options?: UseQueryOptions<UserApprovalStats>) =>
  useQuery({
    queryKey: ['approval-flows', 'user-stats', userId],
    queryFn: () => {
      const endpoint = userId ? `/stats/user/${userId}` : '/stats/user'
      return apiRequest<UserApprovalStats>(endpoint)
    },
    enabled: !!userId,
    ...options,
  })

// ============ ROLE INTEGRATION HOOKS ============

export const useAvailableRoles = (options?: UseQueryOptions<CustomRole[]>) =>
  useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const response = await fetch('/v1/roles/', {
        headers: {
          'Content-Type': 'application/json',
        },
      })
      if (!response.ok) {
        throw new Error('Failed to fetch roles')
      }
      return response.json()
    },
    ...options,
  })

export const useAvailablePermissionTemplates = (options?: UseQueryOptions<PermissionTemplateResponse[]>) =>
  useQuery({
    queryKey: ['permission-templates'],
    queryFn: async () => {
      const response = await fetch('/v1/roles/templates/', {
        headers: {
          'Content-Type': 'application/json',
        },
      })
      if (!response.ok) {
        throw new Error('Failed to fetch permission templates')
      }
      return response.json()
    },
    ...options,
  })

// ============ UTILITY HOOKS ============

export const useFlowDesignerState = (initialState?: Partial<FlowDesignerState>) => {
  const [state, setState] = React.useState<FlowDesignerState>({
    flow: null,
    availableRoles: [],
    availableSteps: [],
    isEditing: false,
    isCreating: false,
    validationErrors: [],
    selectedStep: null,
    isDragging: false,
    previewMode: false,
    ...initialState,
  })

  const updateState = (updates: Partial<FlowDesignerState>) => {
    setState(prev => ({ ...prev, ...updates }))
  }

  const addValidationError = (error: ValidationError) => {
    setState(prev => ({
      ...prev,
      validationErrors: [...prev.validationErrors, error]
    }))
  }

  const removeValidationError = (field: string) => {
    setState(prev => ({
      ...prev,
      validationErrors: prev.validationErrors.filter(e => e.field !== field)
    }))
  }

  const clearValidationErrors = () => {
    setState(prev => ({ ...prev, validationErrors: [] }))
  }

  return {
    state,
    updateState,
    addValidationError,
    removeValidationError,
    clearValidationErrors,
  }
}

// Hook for managing flow step operations
export const useFlowStepOperations = (flowId?: string) => {
  const queryClient = useQueryClient()

  const addStep = useMutation({
    mutationFn: ({ step, order }: { step: any; order: number }) =>
      apiRequest(`/flows/${flowId}/steps`, {
        method: 'POST',
        body: JSON.stringify({ step, order }),
      }, FLOWS_API_BASE),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-flows', flowId] })
      toast.success('Step added successfully')
    },
    onError: (error) => {
      toast.error(`Failed to add step: ${error.message}`)
    },
  })

  const updateStep = useMutation({
    mutationFn: ({ stepId, step }: { stepId: string; step: any }) =>
      apiRequest(`/flows/${flowId}/steps/${stepId}`, {
        method: 'PUT',
        body: JSON.stringify(step),
      }, FLOWS_API_BASE),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-flows', flowId] })
      toast.success('Step updated successfully')
    },
    onError: (error) => {
      toast.error(`Failed to update step: ${error.message}`)
    },
  })

  const removeStep = useMutation({
    mutationFn: (stepId: string) =>
      apiRequest(`/flows/${flowId}/steps/${stepId}`, {
        method: 'DELETE',
      }, FLOWS_API_BASE),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-flows', flowId] })
      toast.success('Step removed successfully')
    },
    onError: (error) => {
      toast.error(`Failed to remove step: ${error.message}`)
    },
  })

  const reorderSteps = useMutation({
    mutationFn: ({ stepOrders }: { stepOrders: Array<{ step_id: string; order: number }> }) =>
      apiRequest(`/flows/${flowId}/steps/reorder`, {
        method: 'POST',
        body: JSON.stringify({ step_orders: stepOrders }),
      }, FLOWS_API_BASE),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-flows', flowId] })
      toast.success('Steps reordered successfully')
    },
    onError: (error) => {
      toast.error(`Failed to reorder steps: ${error.message}`)
    },
  })

  return {
    addStep,
    updateStep,
    removeStep,
    reorderSteps,
  }
}

// Hook for real-time flow validation
export const useFlowValidation = (flow?: Partial<ApprovalFlow>) => {
  const [validationErrors, setValidationErrors] = React.useState<ValidationError[]>([])
  const [isValidating, setIsValidating] = React.useState(false)

  const validateFlow = React.useCallback(async (flowData: Partial<ApprovalFlow>) => {
    if (!flowData) return

    setIsValidating(true)
    try {
      // Mock validation for now since backend doesn't exist yet
      const errors = []

      if (!flowData.name || flowData.name.length < 3) {
        errors.push({
          field: 'name',
          message: 'Flow name must be at least 3 characters long',
          severity: 'error' as const
        })
      }

      if (!flowData.steps || flowData.steps.length === 0) {
        errors.push({
          field: 'steps',
          message: 'Flow must have at least one step',
          severity: 'error' as const
        })
      }

      if (flowData.steps) {
        for (let i = 0; i < flowData.steps.length; i++) {
          const step = flowData.steps[i]
          if (!step.assigned_roles || step.assigned_roles.length === 0) {
            errors.push({
              field: `steps.${i}.assigned_roles`,
              message: `Step "${step.name}" must have at least one role assigned`,
              severity: 'error' as const
            })
          }
        }
      }

      const result: FlowValidationResult = {
        is_valid: errors.length === 0,
        errors: errors,
        warnings: [],
        suggestions: []
      }

      setValidationErrors([...result.errors, ...result.warnings])
      return result
    } catch (error) {
      toast.error(`Flow validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return null
    } finally {
      setIsValidating(false)
    }
  }, [])

  return {
    validationErrors,
    isValidating,
    validateFlow,
    setValidationErrors,
  }
}

export default useApprovalFlows