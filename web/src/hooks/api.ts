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
  Project,
  ProjectCreate,
  ProjectUpdate,
  Module,
  ModuleCreate,
  ModuleUpdate,
  Prompt,
  PromptCreate,
  PromptUpdate,
  ModelCompatibility,
  ModelCompatibilityCreate,
  ModelCompatibilityUpdate,
  ApprovalRequest,
  ApprovalRequestCreate,
  ApprovalRequestUpdate,
  CompatibilityMatrixResponse,
  ProjectCompatibilitySummary,
  AIAssistantProvider,
  AIAssistantProviderCreate,
  AIAssistantProviderUpdate,
  BatchTestResult,
  CompatibilityTrend,
  ApiResponse,
  PaginatedResponse,
  User,
  UserCreate,
  UserUpdate
} from '@/types/api'

// Base API client
const API_BASE = '/v1'

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`

  // Get authentication token from localStorage
  const accessToken = localStorage.getItem('access_token')

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers as Record<string, string>,
  }

  // Add Authorization header if token exists
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  const response = await fetch(url, {
    headers,
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

export const useDeleteTemplate = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ templateId, version }: { templateId: string; version?: string }) =>
      apiRequest<ApiResponse<null>>(version ? `/templates/${templateId}/${version}` : `/templates/${templateId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
      toast.success('Template deleted successfully')
    },
    onError: (error) => {
      toast.error(`Failed to delete template: ${error.message}`)
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

// Project APIs
export const useProjects = () =>
  useQuery({
    queryKey: ['projects'],
    queryFn: () => apiRequest<Project[]>('/projects'),
  })

export const useProject = (projectId: string) =>
  useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => apiRequest<Project>(`/projects/${projectId}`),
    enabled: !!projectId,
  })

export const useCreateProject = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (project: ProjectCreate) =>
      apiRequest<ApiResponse<Project>>('/projects', {
        method: 'POST',
        body: JSON.stringify(project),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Project created successfully')
    },
    onError: (error) => {
      toast.error(`Failed to create project: ${error.message}`)
    },
  })
}

export const useUpdateProject = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ projectId, project }: { projectId: string; project: ProjectUpdate }) =>
      apiRequest<ApiResponse<Project>>(`/projects/${projectId}`, {
        method: 'PUT',
        body: JSON.stringify(project),
      }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['projects', variables.projectId] })
      toast.success('Project updated successfully')
    },
    onError: (error) => {
      toast.error(`Failed to update project: ${error.message}`)
    },
  })
}

export const useDeleteProject = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (projectId: string) =>
      apiRequest<ApiResponse<null>>(`/projects/${projectId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Project deleted successfully')
    },
    onError: (error) => {
      toast.error(`Failed to delete project: ${error.message}`)
    },
  })
}

// Module APIs
export const useModules = (projectId?: string) =>
  useQuery({
    queryKey: ['modules', projectId],
    queryFn: () => {
      const endpoint = projectId ? `/modules?project_id=${projectId}` : '/modules'
      return apiRequest<Module[]>(endpoint)
    },
    enabled: projectId !== undefined,
  })

export const useModuleVersions = (moduleId: string) =>
  useQuery({
    queryKey: ['modules', moduleId, 'versions'],
    queryFn: () => apiRequest<Module[]>(`/modules/${moduleId}`),
    enabled: !!moduleId,
  })

export const useModule = (moduleId: string, version: string) =>
  useQuery({
    queryKey: ['modules', moduleId, version],
    queryFn: () => apiRequest<Module>(`/modules/${moduleId}/${version}`),
    enabled: !!moduleId && !!version,
  })

export const useCreateModule = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (module: ModuleCreate) =>
      apiRequest<ApiResponse<Module>>('/modules', {
        method: 'POST',
        body: JSON.stringify(module),
      }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['modules', variables.project_id] })
      queryClient.invalidateQueries({ queryKey: ['modules'] })
      toast.success('Module created successfully')
    },
    onError: (error) => {
      toast.error(`Failed to create module: ${error.message}`)
    },
  })
}

export const useUpdateModule = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ moduleId, version, module }: { moduleId: string; version: string; module: ModuleUpdate }) =>
      apiRequest<ApiResponse<Module>>(`/modules/${moduleId}/${version}`, {
        method: 'PUT',
        body: JSON.stringify(module),
      }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['modules'] })
      queryClient.invalidateQueries({ queryKey: ['modules', variables.moduleId] })
      queryClient.invalidateQueries({ queryKey: ['modules', variables.moduleId, 'versions'] })
      toast.success('Module updated successfully')
    },
    onError: (error) => {
      toast.error(`Failed to update module: ${error.message}`)
    },
  })
}

export const useDeleteModule = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ moduleId, version }: { moduleId: string; version: string }) =>
      apiRequest<ApiResponse<null>>(`/modules/${moduleId}/${version}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modules'] })
      toast.success('Module deleted successfully')
    },
    onError: (error) => {
      // Handle 404 errors specifically
      if (error.message.includes('404') || error.message.includes('not found')) {
        toast.error('Module not found. Refreshing the page...')
        // Refresh the data to show current state
        queryClient.invalidateQueries({ queryKey: ['modules'] })
      } else {
        toast.error(`Failed to delete module: ${error.message}`)
      }
    },
  })
}

// Prompt APIs
export const usePrompts = (moduleId?: string) =>
  useQuery({
    queryKey: ['prompts', moduleId],
    queryFn: () => {
      const endpoint = moduleId ? `/prompts?module_id=${moduleId}` : '/prompts'
      return apiRequest<Prompt[]>(endpoint)
    },
    enabled: moduleId !== undefined,
  })

export const usePromptVersions = (promptId: string) =>
  useQuery({
    queryKey: ['prompts', promptId, 'versions'],
    queryFn: () => apiRequest<Prompt[]>(`/prompts/${promptId}`),
    enabled: !!promptId,
  })

export const usePrompt = (promptId: string, version: string) =>
  useQuery({
    queryKey: ['prompts', promptId, version],
    queryFn: () => apiRequest<Prompt>(`/prompts/${promptId}/${version}`),
    enabled: !!promptId && !!version,
  })

export const useCreatePrompt = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (prompt: PromptCreate) =>
      apiRequest<ApiResponse<Prompt>>('/prompts', {
        method: 'POST',
        body: JSON.stringify(prompt),
      }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['prompts', variables.module_id] })
      queryClient.invalidateQueries({ queryKey: ['prompts'] })
      toast.success('Prompt created successfully')
    },
    onError: (error) => {
      toast.error(`Failed to create prompt: ${error.message}`)
    },
  })
}

export const useUpdatePrompt = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ promptId, version, prompt }: { promptId: string; version: string; prompt: PromptUpdate }) =>
      apiRequest<ApiResponse<Prompt>>(`/prompts/${promptId}/${version}`, {
        method: 'PUT',
        body: JSON.stringify(prompt),
      }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] })
      queryClient.invalidateQueries({ queryKey: ['prompts', variables.promptId] })
      queryClient.invalidateQueries({ queryKey: ['prompts', variables.promptId, 'versions'] })
      toast.success('Prompt updated successfully')
    },
    onError: (error) => {
      toast.error(`Failed to update prompt: ${error.message}`)
    },
  })
}

export const useDeletePrompt = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ promptId, version }: { promptId: string; version: string }) =>
      apiRequest<ApiResponse<null>>(`/prompts/${promptId}/${version}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] })
      toast.success('Prompt deleted successfully')
    },
    onError: (error) => {
      toast.error(`Failed to delete prompt: ${error.message}`)
    },
  })
}

// Model Compatibility APIs
export const useModelCompatibilities = (promptId?: string) =>
  useQuery({
    queryKey: ['model-compatibilities', promptId],
    queryFn: () => {
      const endpoint = promptId ? `/model-compatibilities?prompt_id=${promptId}` : '/model-compatibilities'
      return apiRequest<ModelCompatibility[]>(endpoint)
    },
    enabled: promptId !== undefined,
  })

export const useModelCompatibility = (compatibilityId: string) =>
  useQuery({
    queryKey: ['model-compatibilities', compatibilityId],
    queryFn: () => apiRequest<ModelCompatibility>(`/model-compatibilities/${compatibilityId}`),
    enabled: !!compatibilityId,
  })

export const useCreateModelCompatibility = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (compatibility: ModelCompatibilityCreate) =>
      apiRequest<ApiResponse<ModelCompatibility>>('/model-compatibilities', {
        method: 'POST',
        body: JSON.stringify(compatibility),
      }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['model-compatibilities', variables.prompt_id] })
      queryClient.invalidateQueries({ queryKey: ['model-compatibilities'] })
      toast.success('Model compatibility created successfully')
    },
    onError: (error) => {
      toast.error(`Failed to create model compatibility: ${error.message}`)
    },
  })
}

export const useUpdateModelCompatibility = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ compatibilityId, compatibility }: { compatibilityId: string; compatibility: ModelCompatibilityUpdate }) =>
      apiRequest<ApiResponse<ModelCompatibility>>(`/model-compatibilities/${compatibilityId}`, {
        method: 'PUT',
        body: JSON.stringify(compatibility),
      }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['model-compatibilities'] })
      queryClient.invalidateQueries({ queryKey: ['model-compatibilities', variables.compatibilityId] })
      toast.success('Model compatibility updated successfully')
    },
    onError: (error) => {
      toast.error(`Failed to update model compatibility: ${error.message}`)
    },
  })
}

export const useDeleteModelCompatibility = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (compatibilityId: string) =>
      apiRequest<ApiResponse<null>>(`/model-compatibilities/${compatibilityId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['model-compatibilities'] })
      toast.success('Model compatibility deleted successfully')
    },
    onError: (error) => {
      toast.error(`Failed to delete model compatibility: ${error.message}`)
    },
  })
}

export const useTestPromptCompatibility = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ promptId, version, providers }: { promptId: string; version: string; providers?: string[] }) =>
      apiRequest<any>(`/model-compatibilities/test/${promptId}/${version}`, {
        method: 'POST',
        body: JSON.stringify({ providers }),
      }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['model-compatibilities', variables.promptId] })
      queryClient.invalidateQueries({ queryKey: ['model-compatibilities'] })
      toast.success('Compatibility test completed successfully')
    },
    onError: (error) => {
      toast.error(`Failed to test prompt compatibility: ${error.message}`)
    },
  })
}

export const useCompatibilityMatrix = (promptId: string, version?: string) =>
  useQuery({
    queryKey: ['model-compatibilities', 'matrix', promptId, version],
    queryFn: () => {
      const endpoint = version
        ? `/model-compatibilities/matrix/${promptId}?version=${version}`
        : `/model-compatibilities/matrix/${promptId}`
      return apiRequest<CompatibilityMatrixResponse>(endpoint)
    },
    enabled: !!promptId,
  })

export const useProjectCompatibilitySummary = (projectId: string) =>
  useQuery({
    queryKey: ['model-compatibilities', 'summary', projectId],
    queryFn: () => apiRequest<ProjectCompatibilitySummary>(`/model-compatibilities/summary/${projectId}`),
    enabled: !!projectId,
  })

export const useRunBatchCompatibilityTests = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ promptIds, versions, providers }: { promptIds: string[]; versions?: string[]; providers?: string[] }) =>
      apiRequest<BatchTestResult>('/model-compatibilities/test/batch', {
        method: 'POST',
        body: JSON.stringify({ prompt_ids: promptIds, versions, providers }),
      }),
    onSuccess: (data) => {
      // Invalidate all prompt compatibility queries
      data.results.forEach((result, key) => {
        const [promptId, version] = key.split('@')
        queryClient.invalidateQueries({ queryKey: ['model-compatibilities', promptId] })
        queryClient.invalidateQueries({ queryKey: ['model-compatibilities', 'matrix', promptId, version] })
      })
      toast.success(`Batch compatibility test completed for ${data.total_prompts_tested} prompts`)
    },
    onError: (error) => {
      toast.error(`Failed to run batch compatibility tests: ${error.message}`)
    },
  })
}

export const useCompatibilityTrends = (promptId: string, days: number = 30) =>
  useQuery({
    queryKey: ['model-compatibilities', 'trends', promptId, days],
    queryFn: () => apiRequest<CompatibilityTrend>(`/model-compatibilities/trends/${promptId}?days=${days}`),
    enabled: !!promptId,
  })

// Approval Request APIs
export const useApprovalRequests = (promptId?: string) =>
  useQuery({
    queryKey: ['approval-requests', promptId],
    queryFn: () => {
      const endpoint = promptId ? `/approval-requests?prompt_id=${promptId}` : '/approval-requests'
      return apiRequest<ApprovalRequest[]>(endpoint)
    },
    enabled: promptId !== undefined,
  })

export const useApprovalRequest = (requestId: string) =>
  useQuery({
    queryKey: ['approval-requests', requestId],
    queryFn: () => apiRequest<ApprovalRequest>(`/approval-requests/${requestId}`),
    enabled: !!requestId,
  })

export const useCreateApprovalRequest = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: ApprovalRequestCreate) =>
      apiRequest<ApiResponse<ApprovalRequest>>('/approval-requests', {
        method: 'POST',
        body: JSON.stringify(request),
      }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['approval-requests', variables.prompt_id] })
      queryClient.invalidateQueries({ queryKey: ['approval-requests'] })
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
      apiRequest<ApiResponse<ApprovalRequest>>(`/approval-requests/${requestId}`, {
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
      apiRequest<ApiResponse<null>>(`/approval-requests/${requestId}`, {
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

// User APIs
export const useUsers = () =>
  useQuery({
    queryKey: ['users'],
    queryFn: () => apiRequest<User[]>('/users'),
  })

export const useCreateUser = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (userData: UserCreate) =>
      apiRequest<ApiResponse<User>>('/users', {
        method: 'POST',
        body: JSON.stringify(userData),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User created successfully')
    },
    onError: (error) => {
      toast.error(`Failed to create user: ${error.message}`)
    },
  })
}

export const useUpdateUser = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userId, userData }: { userId: string; userData: UserUpdate }) =>
      apiRequest<ApiResponse<User>>(`/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(userData),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User updated successfully')
    },
    onError: (error) => {
      toast.error(`Failed to update user: ${error.message}`)
    },
  })
}

export const useDeleteUser = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (userId: string) =>
      apiRequest<ApiResponse<null>>(`/users/${userId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User deleted successfully')
    },
    onError: (error) => {
      toast.error(`Failed to delete user: ${error.message}`)
    },
  })
}

// Model Testing Hooks
export const useUserProviders = () => {
  return useQuery({
    queryKey: ['user-providers'],
    queryFn: () => apiRequest<{ providers: Array<any> }>('/model-testing/user-providers'),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export const useTestPromptAcrossProviders = () => {
  return useMutation({
    mutationFn: (requestData: { system_prompt: string; user_message: string; providers?: string[] }) =>
      apiRequest<any>('/model-testing/test-prompt-across-providers', {
        method: 'POST',
        body: JSON.stringify(requestData),
      }),
    onError: (error) => {
      toast.error(`Failed to test prompt: ${error.message}`)
    },
  })
}

// AI Assistant Provider Hooks
export const useAIAssistantProviders = () =>
  useQuery({
    queryKey: ['ai-assistant-providers'],
    queryFn: () => apiRequest<AIAssistantProvider[]>('/ai-assistant/providers'),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

export const useAIAssistantProvider = (id: string) =>
  useQuery({
    queryKey: ['ai-assistant-providers', id],
    queryFn: () => apiRequest<AIAssistantProvider>(`/ai-assistant/providers/${id}`),
    enabled: !!id,
  })

export const useCreateAIAssistantProvider = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (providerData: AIAssistantProviderCreate) =>
      apiRequest<AIAssistantProvider>('/ai-assistant/providers', {
        method: 'POST',
        body: JSON.stringify(providerData),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-assistant-providers'] })
      toast.success('AI provider created successfully')
    },
    onError: (error) => {
      toast.error(`Failed to create AI provider: ${error.message}`)
    },
  })
}

export const useUpdateAIAssistantProvider = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, providerData }: { id: string; providerData: AIAssistantProviderUpdate }) =>
      apiRequest<AIAssistantProvider>(`/ai-assistant/providers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(providerData),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-assistant-providers'] })
      queryClient.invalidateQueries({ queryKey: ['ai-assistant-providers'] })
      toast.success('AI provider updated successfully')
    },
    onError: (error) => {
      toast.error(`Failed to update AI provider: ${error.message}`)
    },
  })
}

export const useDeleteAIAssistantProvider = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<ApiResponse<null>>(`/ai-assistant/providers/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-assistant-providers'] })
      toast.success('AI provider deleted successfully')
    },
    onError: (error) => {
      toast.error(`Failed to delete AI provider: ${error.message}`)
    },
  })
}