import { 
  useQuery, 
  useMutation, 
  useQueryClient,
  UseQueryOptions,
  UseMutationOptions
} from '@tanstack/react-query'
import toast from 'react-hot-toast'
import type { 
  Template,
  TemplateCreate,
  TemplateVersion,
  Alias,
  AliasUpdate,
  RenderRequest,
  RenderResponse,
  EvaluationRun,
  EvaluationRunCreate,
  PolicyEvaluationRequest,
  PolicyEvaluationResponse,
  DashboardStats,
  UsageMetrics,
  ApiResponse,
  PaginatedResponse
} from '@/types/api'

// Base API client
const API_BASE = '/v1'

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

// Template APIs
export const useTemplates = (options?: UseQueryOptions<PaginatedResponse<Template>>) =>
  useQuery({
    queryKey: ['templates'],
    queryFn: () => apiRequest<PaginatedResponse<Template>>('/templates'),
    ...options,
  })

export const useTemplateVersions = (templateId: string) =>
  useQuery({
    queryKey: ['templates', templateId, 'versions'],
    queryFn: () => apiRequest<Template[]>(`/templates/${templateId}`),
    enabled: !!templateId,
  })

export const useTemplate = (templateId: string, version: string) =>
  useQuery({
    queryKey: ['templates', templateId, version],
    queryFn: () => apiRequest<Template>(`/templates/${templateId}/${version}`),
    enabled: !!templateId && !!version,
  })

export const useCreateTemplate = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (template: TemplateCreate) =>
      apiRequest<ApiResponse<Template>>('/templates', {
        method: 'POST',
        body: JSON.stringify(template),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
      toast.success('Template created successfully')
    },
    onError: (error) => {
      toast.error(`Failed to create template: ${error.message}`)
    },
  })
}

// Alias APIs
export const useAliases = () =>
  useQuery({
    queryKey: ['aliases'],
    queryFn: () => apiRequest<Alias[]>('/aliases'),
  })

export const useAlias = (alias: string) =>
  useQuery({
    queryKey: ['aliases', alias],
    queryFn: () => apiRequest<Alias>(`/aliases/${alias}`),
    enabled: !!alias,
  })

export const useUpdateAliasWeights = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ alias, weights }: { alias: string; weights: Record<string, number> }) =>
      apiRequest<ApiResponse<Alias>>(`/aliases/${alias}/weights`, {
        method: 'PATCH',
        body: JSON.stringify({ weights }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aliases'] })
      toast.success('Alias weights updated successfully')
    },
    onError: (error) => {
      toast.error(`Failed to update alias weights: ${error.message}`)
    },
  })
}

// Render APIs
export const useRenderTemplate = () => {
  return useMutation({
    mutationFn: (request: RenderRequest) =>
      apiRequest<RenderResponse>('/render', {
        method: 'POST',
        body: JSON.stringify(request),
      }),
  })
}

// Evaluation APIs
export const useEvaluations = (templateId?: string) =>
  useQuery({
    queryKey: ['evaluations', templateId],
    queryFn: () => {
      const endpoint = templateId 
        ? `/evaluations?template_id=${templateId}`
        : '/evaluations'
      return apiRequest<PaginatedResponse<EvaluationRun>>(endpoint)
    },
  })

export const useRunEvaluation = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (evaluation: EvaluationRunCreate) =>
      apiRequest<ApiResponse<EvaluationRun>>('/evaluations/run', {
        method: 'POST',
        body: JSON.stringify(evaluation),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evaluations'] })
      toast.success('Evaluation started successfully')
    },
    onError: (error) => {
      toast.error(`Failed to start evaluation: ${error.message}`)
    },
  })
}

// Policy APIs
export const useEvaluatePolicy = () => {
  return useMutation({
    mutationFn: (request: PolicyEvaluationRequest) =>
      apiRequest<PolicyEvaluationResponse>('/policies/evaluate', {
        method: 'POST',
        body: JSON.stringify(request),
      }),
  })
}

// Dashboard APIs
export const useDashboardStats = () =>
  useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => apiRequest<DashboardStats>('/dashboard/stats'),
  })

export const useUsageMetrics = (timeRange: string = '7d') =>
  useQuery({
    queryKey: ['dashboard', 'usage', timeRange],
    queryFn: () => apiRequest<UsageMetrics[]>(`/dashboard/usage?range=${timeRange}`),
  })