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
  ValidationError
} from '@/types/approval-flows'

import type {
  CustomRoleResponse,
  PermissionTemplateResponse
} from '@/types/governance'

// Base API client for approval flows
const API_BASE = '/v1/approval-flows'

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Network error' }))
    throw new Error(error.message || `HTTP ${response.status}`)
  }

  return response.json()
}

// ============ APPROVAL FLOW HOOKS ============

export const useApprovalFlows = (filters?: ApprovalFlowFilter, options?: UseQueryOptions<ApprovalFlow[]>) =>
  useQuery({
    queryKey: ['approval-flows', filters],
    queryFn: () => {
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
      return apiRequest<ApprovalFlow[]>(endpoint)
    },
    ...options,
  })

export const useApprovalFlow = (flowId: string, options?: UseQueryOptions<ApprovalFlow>) =>
  useQuery({
    queryKey: ['approval-flows', flowId],
    queryFn: () => apiRequest<ApprovalFlow>(`/flows/${flowId}`),
    enabled: !!flowId,
    ...options,
  })

export const useCreateApprovalFlow = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (flow: ApprovalFlowCreate) => {
      // Transform frontend flow structure to backend structure
      const backendFlow = {
        name: flow.name,
        description: flow.description,
        trigger_condition: { event: "prompt_created" },
        flow_type: flow.flow_type,
        status: flow.status,
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
        })) || []
      }

      return apiRequest<ApprovalFlowResponse>('/flows', {
        method: 'POST',
        body: JSON.stringify(backendFlow),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-flows'] })
      toast.success('Approval flow created successfully')
    },
    onError: (error) => {
      toast.error(`Failed to create approval flow: ${error.message}`)
    },
  })
}

export const useUpdateApprovalFlow = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ flowId, flow }: { flowId: string; flow: ApprovalFlowUpdate }) => {
      return apiRequest<ApprovalFlowResponse>(`/flows/${flowId}`, {
        method: 'PUT',
        body: JSON.stringify(flow),
      })
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
      apiRequest<ApprovalFlowResponse>(`/flows/${flowId}`, {
        method: 'DELETE',
      }),
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
    mutationFn: ({ flowId, newName }: { flowId: string; newName: string }) =>
      apiRequest<ApprovalFlowResponse>(`/flows/${flowId}/duplicate`, {
        method: 'POST',
        body: JSON.stringify({ name: newName }),
      }),
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
      }),
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

      return fetch(`${API_BASE}/flows/import`, {
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

      const endpoint = params.toString() ? `/requests?${params.toString()}` : '/requests'
      return apiRequest<ApprovalRequest[]>(endpoint)
    },
    ...options,
  })

export const useApprovalRequest = (requestId: string, options?: UseQueryOptions<ApprovalRequest>) =>
  useQuery({
    queryKey: ['approval-requests', requestId],
    queryFn: () => apiRequest<ApprovalRequest>(`/requests/${requestId}`),
    enabled: !!requestId,
    ...options,
  })

export const useCreateApprovalRequest = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: ApprovalRequestCreate) =>
      apiRequest<ApprovalRequestResponse>('/requests', {
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
      apiRequest<ApprovalRequestResponse>(`/requests/${requestId}`, {
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
      apiRequest<ApprovalRequestResponse>(`/requests/${requestId}`, {
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
      apiRequest<ApprovalRequestResponse>(`/requests/${requestId}/approve`, {
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
      apiRequest<ApprovalRequestResponse>(`/requests/${requestId}/reject`, {
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
      apiRequest<ApprovalRequestResponse>(`/requests/${requestId}/escalate`, {
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

// ============ STEP TEMPLATES HOOKS ============

export const useStepTemplates = (options?: UseQueryOptions<StepTemplate[]>) =>
  useQuery({
    queryKey: ['step-templates'],
    queryFn: async () => {
      // Return mock step templates for now since backend doesn't exist yet
      return [
        {
          id: 'review',
          name: 'Review',
          description: 'Initial review by team members',
          step_type: 'review' as const,
          default_timeout_hours: 24,
          category: 'review' as const,
          icon: 'eye'
        },
        {
          id: 'approval',
          name: 'Approval',
          description: 'Final approval by managers',
          step_type: 'approval' as const,
          default_timeout_hours: 48,
          category: 'approval' as const,
          icon: 'check-circle'
        },
        {
          id: 'verification',
          name: 'Verification',
          description: 'Technical verification by experts',
          step_type: 'verification' as const,
          default_timeout_hours: 72,
          category: 'approval' as const,
          icon: 'shield'
        },
        {
          id: 'notification',
          name: 'Notification',
          description: 'Send notifications to stakeholders',
          step_type: 'notification' as const,
          category: 'notification' as const,
          icon: 'bell'
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
      }),
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
      }),
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
      }),
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
      }),
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