import { useState, useMemo, useEffect } from 'react'
import { useQuery, useQueries } from '@tanstack/react-query'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  FileSignature,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Plus,
  GitBranch,
  Users,
  Edit,
  Settings,
  Palette,
  Save,
  RotateCcw,
  Trash2,
  AlertTriangle,
  Layers,
  Play,
  Pause,
  Lock,
  Info
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { FlowDesigner } from '@/components/approval/FlowDesigner'
import { FlowTemplateSelector } from '@/components/approval/FlowTemplateSelector'
import { authenticatedFetch } from '@/lib/httpInterceptor'

// API request function matching the implementation in api.ts
const API_BASE = '/v1'
async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`
  // Use the authenticated HTTP client
  return authenticatedFetch<T>(url, options)
}

// Import the enhanced types
import type {
  ApprovalFlow as EnhancedApprovalFlow,
  ApprovalFlowStep,
  CustomRole,
  ApprovalFlowCreate,
  FlowTemplate
} from '@/types/approval-flows'
import { PREDEFINED_FLOW_TEMPLATES } from '@/types/approval-flows'

// Import hooks
import {
  useApprovalFlows,
  useCreateApprovalFlow,
  useUpdateApprovalFlow,
  useDeleteApprovalFlow,
  useApprovalRequests,
  useAvailableRoles,
  useApprovalFlowStats,
  useApprovalPermissions,
  useUpdateFlowStatus
} from '@/hooks/useApprovalFlows'
import { useUsers, useModules, usePrompts, useUpdateApprovalRequest, useApprovalRequestComparison } from '@/hooks/api'
import { SimpleDiffView } from '@/components/SimpleDiffView'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'


export function PromptApprovalWorkflow() {
  console.log('🔍 [DEBUG] PromptApprovalWorkflow: Component rendering')
  const [activeTab, setActiveTab] = useState<'requests' | 'designer'>('requests')
  const [showFlowDesigner, setShowFlowDesigner] = useState(false)
  const [showTemplateSelector, setShowTemplateSelector] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<FlowTemplate | null>(null)
  const [editingFlow, setEditingFlow] = useState<EnhancedApprovalFlow | null>(null)

  // API constants
  const FLOWS_API_BASE = '/v1/approval-flows'
  const queryClient = useQueryClient()

  // Use the new hooks for enhanced functionality
  const { data: enhancedFlows = [], isLoading, error, refetch } = useApprovalFlows()

  // Debug logging
  console.log('🔍 [DEBUG] PromptApprovalWorkflow: enhancedFlows:', enhancedFlows)
  console.log('🔍 [DEBUG] PromptApprovalWorkflow: isLoading:', isLoading)
  console.log('🔍 [DEBUG] PromptApprovalWorkflow: error:', error)

  // Force a refetch to clear stale cache and remove query data
  useEffect(() => {
    console.log('🔍 [DEBUG] PromptApprovalWorkflow: useEffect running...')

    // Clear the cached data for this query
    queryClient.removeQueries(['approval-flows'])
    console.log('🔍 [DEBUG] PromptApprovalWorkflow: Cache cleared')

    // Force a refetch
    setTimeout(() => {
      console.log('🔍 [DEBUG] PromptApprovalWorkflow: Executing refetch...')
      refetch()
    }, 100)
  }, [queryClient, refetch])

  // Also try to force the query to execute with a different approach
  const handleManualRefetch = () => {
    console.log('🔍 [DEBUG] PromptApprovalWorkflow: Manual refetch triggered')
    queryClient.removeQueries(['approval-flows'])
    refetch()
  }

  // Check localStorage for auth data (for debugging only)
  const isAuthenticated = localStorage.getItem('isAuthenticated')
  const user = localStorage.getItem('user')
  console.log('🔍 [DEBUG] PromptApprovalWorkflow: Auth check:')
  console.log('  - isAuthenticated:', isAuthenticated)
  console.log('  - user exists:', !!user)
  if (user) {
    try {
      console.log('  - user data:', JSON.parse(user))
    } catch (e) {
      console.log('  - user data (parse failed):', user)
    }
  }
  const { data: roles = [] } = useAvailableRoles()
  const { data: flowStats } = useApprovalFlowStats()
  const { data: approvalRequests = [] } = useApprovalRequests()
  const { data: users = [] } = useUsers()

    const { data: modules = [] } = useModules()
  const { data: prompts = [] } = usePrompts()
  const { user: authUser, hasPermission } = useAuth()

  // Check if user has permission to design approval flows
  const canDesignApprovalFlows = hasPermission('approval-flows:design')


  // State for search and filters
  const [flowsSearchQuery, setFlowsSearchQuery] = useState('')
  const [requestsSearchQuery, setRequestsSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [filterType, setFilterType] = useState<'all' | 'create' | 'edit'>('all')
  const [approvalTab, setApprovalTab] = useState<'all' | 'pending' | 'approved'>('pending')
  const [selectedRequest, setSelectedRequest] = useState<any>(null)
  const updateApprovalRequest = useUpdateApprovalRequest()
  const [approvalComments, setApprovalComments] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')

  // Flow management mutations
  const createFlowMutation = useCreateApprovalFlow()
  const updateFlowMutation = useUpdateApprovalFlow()
  const deleteFlowMutation = useDeleteApprovalFlow()
  const updateFlowStatusMutation = useUpdateFlowStatus() // Dedicated mutation for status changes

  // Permission checking for selected request - moved after state initialization
  const { data: permissions, isLoading: permissionsLoading } = useApprovalPermissions(
    selectedRequest?.id
  )

  // Fetch comparison data for selected request
  const { data: comparisonData, isLoading: comparisonLoading } = useApprovalRequestComparison(
    selectedRequest?.id
  )

  // Debug: Log when selectedRequest changes
  console.log('🔍 [DEBUG] selectedRequest:', selectedRequest)

  // Helper function to get user ID safely
  const getUserId = (): string | null => {
    if (!authUser) return null

    // First try to get from auth context
    if (authUser.id) return authUser.id

    // Fallback: try to get from JWT token in localStorage
    try {
      const token = localStorage.getItem('access_token')
      if (token) {
        const payload = token.split('.')[1]
        const decoded = JSON.parse(atob(payload))
        return decoded.sub || decoded.user_id
      }
    } catch (error) {
      console.error('Error parsing JWT token:', error)
    }

    return null
  }

  // Handle approval actions
  const handleApprove = async () => {
    if (!selectedRequest || !authUser) return

    const approverId = getUserId()
    if (!approverId) {
      toast.error('User ID not found. Please log in again.')
      return
    }

    try {
      const requestData = {
        status: 'approved',
        comments: approvalComments,
        approver: approverId
      }
      console.log('🔍 [DEBUG] Sending approval request:', requestData)
      console.log('🔍 [DEBUG] Selected request before approval:', selectedRequest)

      const result = await updateApprovalRequest.mutateAsync({
        requestId: selectedRequest.id,
        request: requestData
      })

      console.log('🔍 [DEBUG] Approval result:', result)

      setSelectedRequest(null)
      setApprovalComments('')

      // Enhanced query invalidation for workflow progression
      console.log('🔄 [DEBUG] Invalidating queries after approval...')
      queryClient.invalidateQueries({ queryKey: ['approval-requests'] })
      queryClient.invalidateQueries({ queryKey: ['approval-request', selectedRequest.id] })
      queryClient.invalidateQueries({ queryKey: ['workflow-context', selectedRequest.id] })
      queryClient.invalidateQueries({ queryKey: ['approval-permissions', selectedRequest.id] })

      // Show enhanced success message
      if (result?.workflow_progressed) {
        if (result?.final_step) {
          toast.success('Request approved and workflow completed!')
        } else if (result?.next_step) {
          toast.success(`Request approved! Advanced to ${result.next_step_name || 'next step'}`)
        } else {
          toast.success('Request approved successfully')
        }
      } else {
        toast.success('Request approved successfully')
      }
    } catch (error) {
      console.error('🔍 [DEBUG] Approval error:', error)
      toast.error(`Failed to approve request: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleReject = async () => {
    if (!selectedRequest || !authUser) return

    const approverId = getUserId()
    if (!approverId) {
      toast.error('User ID not found. Please log in again.')
      return
    }

    try {
      console.log('🔍 [DEBUG] Sending rejection request:', {
        status: 'rejected',
        rejection_reason: rejectionReason,
        approver: approverId
      })

      const result = await updateApprovalRequest.mutateAsync({
        requestId: selectedRequest.id,
        request: {
          status: 'rejected',
          rejection_reason: rejectionReason,
          approver: approverId
        }
      })

      console.log('🔍 [DEBUG] Rejection result:', result)

      setSelectedRequest(null)
      setRejectionReason('')

      // Enhanced query invalidation for workflow progression
      console.log('🔄 [DEBUG] Invalidating queries after rejection...')
      queryClient.invalidateQueries({ queryKey: ['approval-requests'] })
      queryClient.invalidateQueries({ queryKey: ['approval-request', selectedRequest.id] })
      queryClient.invalidateQueries({ queryKey: ['workflow-context', selectedRequest.id] })
      queryClient.invalidateQueries({ queryKey: ['approval-permissions', selectedRequest.id] })

      // Show enhanced success message
      if (result?.workflow_progressed) {
        toast.success('Request rejected and workflow terminated!')
      } else {
        toast.success('Request rejected successfully')
      }
    } catch (error) {
      toast.error('Failed to reject request')
    }
  }

  // Reset form when dialog closes
  const handleDialogClose = () => {
    setSelectedRequest(null)
    setApprovalComments('')
    setRejectionReason('')
  }

  const [isDeleteFlowDialogOpen, setIsDeleteFlowDialogOpen] = useState(false)
  const [flowToDelete, setFlowToDelete] = useState<EnhancedApprovalFlow | null>(null)


  // Create maps for efficient lookups
  const moduleSlotMap = useMemo(() => {
    return modules.reduce((acc, module) => {
      acc[module.id] = module.name || module.slot || `Module ${module.id}`
      return acc
    }, {} as Record<string, string>)
  }, [modules])

  // Create prompt-to-module lookup map
  const promptToModuleMap = useMemo(() => {
    return prompts.reduce((acc, prompt) => {
      if (prompt.module_id) {
        acc[prompt.id] = moduleSlotMap[prompt.module_id] || `Module ${prompt.module_id}`
      }
      return acc
    }, {} as Record<string, string>)
  }, [prompts, moduleSlotMap])

  // Create prompt-to-module-id lookup map (fallback for backward compatibility)
  const promptToModuleIdMap = useMemo(() => {
    return prompts.reduce((acc, prompt) => {
      if (prompt.module_id) {
        acc[prompt.id] = prompt.module_id
      }
      return acc
    }, {} as Record<string, string>)
  }, [prompts])

  const userNameMap = useMemo(() => {
    return users.reduce((acc, user) => {
      acc[user.id] = user.name || user.email || `User ${user.id}`
      return acc
    }, {} as Record<string, string>)
  }, [users])

  const promptDetailsMap = useMemo(() => {
    return prompts.reduce((acc, prompt) => {
      acc[prompt.id] = {
        name: prompt.name,
        version: prompt.version,
        description: prompt.description,
        mas_risk_level: prompt.mas_risk_level
      }
      return acc
    }, {} as Record<string, any>)
  }, [prompts])

  const filteredRequests = useMemo(() => {
    return approvalRequests
      .filter((request: any) => {
        const moduleId = request.prompt_module_id || promptToModuleIdMap[request.prompt_id] || request.prompt_id
        const requestedByName = userNameMap[request.requested_by] || request.requested_by
        const matchesSearch = moduleId?.toLowerCase().includes(requestsSearchQuery.toLowerCase()) ||
                            requestedByName?.toLowerCase().includes(requestsSearchQuery.toLowerCase())
        const matchesStatus = filterStatus === 'all' || request.status === filterStatus
        const matchesType = filterType === 'all' || request.request_type === filterType
        const matchesApprovalTab = approvalTab === 'all' || request.status === approvalTab

        return matchesSearch && matchesStatus && matchesType && matchesApprovalTab
      })
      .sort((a: any, b: any) => {
        // Sort by requested_at in descending order (newest first)
        return new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime()
      })
  }, [approvalRequests, requestsSearchQuery, filterStatus, filterType, approvalTab, promptToModuleIdMap, userNameMap])

  const filteredFlows = useMemo(() => {
    return enhancedFlows.filter(flow => {
      const matchesSearch = flow.name.toLowerCase().includes(flowsSearchQuery.toLowerCase()) ||
                          flow.description.toLowerCase().includes(flowsSearchQuery.toLowerCase())
      return matchesSearch
    })
  }, [enhancedFlows, flowsSearchQuery])

  // Calculate counts for tab counters
  const requestCounts = useMemo(() => {
    const all = approvalRequests.length
    const pending = approvalRequests.filter((request: any) => request.status === 'pending').length
    const approved = approvalRequests.filter((request: any) => request.status === 'approved').length
    const rejected = approvalRequests.filter((request: any) => request.status === 'rejected').length

    return { all, pending, approved, rejected }
  }, [approvalRequests])

  // Enhanced flow designer handlers
  const handleCreateCustomFlow = () => {
    setEditingFlow(null)
    setShowFlowDesigner(true)
  }

  const handleEditCustomFlow = (flow: EnhancedApprovalFlow) => {
    setEditingFlow(flow)
    setShowFlowDesigner(true)
  }

  const handleSaveCustomFlow = (flow: EnhancedApprovalFlow) => {
    if (editingFlow) {
      // Update existing flow
      updateFlowMutation.mutate({
        flowId: editingFlow.id,
        flow: {
          name: flow.name,
          description: flow.description,
          status: flow.status as 'active' | 'inactive' | 'draft' | 'archived',
          steps: flow.steps,
        }
      }, {
        onSuccess: () => {
          // Close flow designer only after successful save
          setShowFlowDesigner(false)
          setEditingFlow(null)
          setSelectedTemplate(null)
        },
        onError: (error) => {
          // Keep flow designer open on error so user can retry
          console.error('Failed to update flow:', error)
        }
      })
    } else {
      // Create new flow
      createFlowMutation.mutate({
        name: flow.name,
        description: flow.description,
        flow_type: selectedTemplate ? 'predefined' : 'custom',
        steps: flow.steps,
      }, {
        onSuccess: () => {
          // Close flow designer only after successful save
          setShowFlowDesigner(false)
          setEditingFlow(null)
          setSelectedTemplate(null)
        },
        onError: (error) => {
          // Keep flow designer open on error so user can retry
          console.error('Failed to save flow:', error)
        }
      })
    }
  }

  const handleDeleteFlow = (flowId: string) => {
    const flow = enhancedFlows.find(f => f.id === flowId)
    if (flow) {
      setFlowToDelete(flow)
      setIsDeleteFlowDialogOpen(true)
    }
  }

  const handleConfirmDelete = () => {
    if (flowToDelete) {
      deleteFlowMutation.mutate(flowToDelete.id)
      setIsDeleteFlowDialogOpen(false)
      setFlowToDelete(null)
    }
  }

  const handleToggleFlowStatus = (flowId: string, currentStatus: string) => {
    // Handle different status transitions
    let newStatus: 'active' | 'inactive' | 'draft' | 'archived'

    if (currentStatus === 'active') {
      newStatus = 'inactive'
    } else if (currentStatus === 'inactive') {
      newStatus = 'active'
    } else if (currentStatus === 'draft') {
      newStatus = 'active'
    } else if (currentStatus === 'archived') {
      newStatus = 'active'
    } else {
      newStatus = 'active' // fallback
    }

    updateFlowStatusMutation.mutate({ flowId, status: newStatus })
  }

  const handleCancelDelete = () => {
    setIsDeleteFlowDialogOpen(false)
    setFlowToDelete(null)
  }

  const handleCancelFlowDesigner = () => {
    setShowFlowDesigner(false)
    setEditingFlow(null)
    setSelectedTemplate(null)
  }

  const handleCreateFromTemplate = () => {
    setShowTemplateSelector(true)
  }

  const handleCloseTemplateSelector = () => {
    setShowTemplateSelector(false)
  }

  const handleTemplateCreate = (_template: FlowTemplate, _customName?: string, _customRoles?: Record<string, string[]>) => {
    // This is handled by the createFlowFromTemplate mutation
    setShowTemplateSelector(false)
  }

  const handleCreateFromQuickTemplate = (templateId: string) => {
    const template = PREDEFINED_FLOW_TEMPLATES.find(t => t.id === templateId)
    if (template) {
      setSelectedTemplate(template)
      setShowTemplateSelector(false)
      setShowFlowDesigner(true)
    }
  }


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Prompt Approval Workflow</h1>
        <p className="text-muted-foreground">
          Manage approval flows and track prompt approval requests
        </p>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'requests' | 'designer')}>
        <TabsList className={`grid w-full ${canDesignApprovalFlows ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <TabsTrigger value="requests">Approval Requests</TabsTrigger>
          {canDesignApprovalFlows && (
            <TabsTrigger value="designer">Approval Flow Designer</TabsTrigger>
          )}
        </TabsList>

  
        {/* Approval Requests Tab */}
        <TabsContent value="requests" className="space-y-6">
          {/* Requests Header */}
          <div>
            <h2 className="text-xl font-semibold">Approval Requests</h2>
            <p className="text-muted-foreground">Review and manage individual prompt approval requests</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <FileSignature className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold">{requestCounts.all}</p>
                    <p className="text-sm text-muted-foreground">Total Requests</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Clock className="h-5 w-5 text-yellow-500" />
                  <div>
                    <p className="text-2xl font-bold">{requestCounts.pending}</p>
                    <p className="text-sm text-muted-foreground">Pending Review</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold">{requestCounts.approved}</p>
                    <p className="text-sm text-muted-foreground">Approved</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <XCircle className="h-5 w-5 text-red-500" />
                  <div>
                    <p className="text-2xl font-bold">{requestCounts.rejected}</p>
                    <p className="text-sm text-muted-foreground">Rejected</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters and Search */}
          <Card>
            <CardHeader>
              <CardTitle>Filter Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex space-x-4">
                <div className="flex-1">
                  <Input
                    placeholder="Search by prompt name or requester..."
                    value={requestsSearchQuery}
                    onChange={(e) => setRequestsSearchQuery(e.target.value)}
                    className="max-w-md"
                  />
                </div>
                <Tabs value={filterStatus} onValueChange={(value) => setFilterStatus(value as any)}>
                  <TabsList>
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="pending">Pending</TabsTrigger>
                    <TabsTrigger value="approved">Approved</TabsTrigger>
                    <TabsTrigger value="rejected">Rejected</TabsTrigger>
                  </TabsList>
                </Tabs>
                <Tabs value={filterType} onValueChange={(value) => setFilterType(value as any)}>
                  <TabsList>
                    <TabsTrigger value="all">All Types</TabsTrigger>
                    <TabsTrigger value="create">Create</TabsTrigger>
                    <TabsTrigger value="edit">Edit</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardContent>
          </Card>

          {/* Requests Table */}
          <Card>
            <CardHeader>
              <CardTitle>Approval Requests</CardTitle>
              <CardDescription>
                Review and manage prompt approval requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={approvalTab} onValueChange={(value) => setApprovalTab(value as 'all' | 'pending' | 'approved')}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="all">All Requests ({requestCounts.all})</TabsTrigger>
                  <TabsTrigger value="pending">Pending ({requestCounts.pending})</TabsTrigger>
                  <TabsTrigger value="approved">Approved ({requestCounts.approved})</TabsTrigger>
                </TabsList>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Module Slot</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Requested By</TableHead>
                    <TableHead>Current Step</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.map((request: any) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">
                        <div className="space-y-1">
                          <div>
                            {request.prompt_module_id || request.prompt_id}
                          </div>
                          {request.prompt_version && (
                            <div className="text-xs text-muted-foreground">
                              Version: {request.prompt_version}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="default">
                          Create
                        </Badge>
                      </TableCell>
                      <TableCell>{userNameMap[request.requested_by] || request.requested_by}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge variant="outline">
                            {request.workflow_context?.has_workflow && request.workflow_context?.total_steps && request.workflow_context?.current_step !== undefined
                              ? request.workflow_context?.current_step_display || `${request.workflow_context.current_step + 1}/${request.workflow_context.total_steps}`
                              : 'Single Step'
                            }
                          </Badge>

                          {/* Debug information */}
                          {process.env.NODE_ENV === 'development' && request.workflow_context?.has_workflow && (
                            <div className="text-xs text-muted-foreground space-y-1">
                              <div>Step: {request.workflow_context.current_step_display}</div>
                              <div>Progress: {request.workflow_context.step_progression?.progress_percentage || 0}%</div>
                              <div>Remaining: {request.workflow_context.step_progression?.steps_remaining || 0} steps</div>
                              {request.workflow_context.step_progression?.next_step_name && (
                                <div className="text-blue-600">Next: {request.workflow_context.step_progression.next_step_name}</div>
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          request.status === 'approved' ? 'default' :
                          request.status === 'rejected' ? 'destructive' : 'secondary'
                        }>
                          {request.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDistanceToNow(new Date(request.requested_at))} ago</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedRequest(request)}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Review
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Approval Flow Designer Tab */}
        <TabsContent value="designer" className="space-y-6">
          {canDesignApprovalFlows ? (
            <>
              {showFlowDesigner ? (
            <FlowDesigner
              initialFlow={editingFlow || undefined}
              initialTemplate={selectedTemplate || undefined}
              onSave={handleSaveCustomFlow}
              onCancel={handleCancelFlowDesigner}
            />
          ) : showTemplateSelector ? (
            <FlowTemplateSelector
              onCreate={handleTemplateCreate}
              onClose={handleCloseTemplateSelector}
            />
          ) : (
            <div className="space-y-6">
              {/* Designer Header */}
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold">Approval Flow Designer</h2>
                  <p className="text-muted-foreground">
                    Create custom approval flows with drag-and-drop step designer
                  </p>
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline" onClick={handleCreateFromTemplate}>
                    <Settings className="h-4 w-4 mr-2" />
                    Use Template
                  </Button>
                  <Button onClick={handleCreateCustomFlow}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Custom
                  </Button>
                </div>
              </div>

              {/* Quick Start Templates */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Quick Start Templates</CardTitle>
                  <CardDescription>
                    Get started quickly with predefined approval flow templates
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-blue-200" onClick={() => handleCreateFromQuickTemplate('basic_approval')}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center space-x-2">
                          <CheckCircle className="h-5 w-5 text-green-500" />
                          <span>Basic Approval</span>
                        </CardTitle>
                        <CardDescription>
                          Simple two-step approval: Editor review → Final approval
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex items-center justify-between text-sm text-gray-600">
                          <span>• Editor Review (24h)</span>
                          <span>• Final Approval (24h)</span>
                        </div>
                        <div className="flex items-center justify-between text-sm text-gray-600 mt-1">
                          <span>⏱️ ~48 hours</span>
                          <span>📋 Simple</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-blue-200" onClick={() => handleCreateFromQuickTemplate('multi_level_approval')}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center space-x-2">
                          <Layers className="h-5 w-5 text-blue-500" />
                          <span>Multi-Level Approval</span>
                        </CardTitle>
                        <CardDescription>
                          Comprehensive three-step approval with escalation path
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex items-center justify-between text-sm text-gray-600">
                          <span>• Editor Review (24h)</span>
                          <span>• Manager Approval (24h)</span>
                        </div>
                        <div className="flex items-center justify-between text-sm text-gray-600 mt-1">
                          <span>⏱️ ~72 hours</span>
                          <span>📋 Medium</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>

              {/* Existing Approval Flows */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>Existing Approval Flows</CardTitle>
                      <CardDescription>
                        Manage your existing approval flow configurations
                      </CardDescription>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Input
                        placeholder="Search flows..."
                        value={flowsSearchQuery}
                        onChange={(e) => setFlowsSearchQuery(e.target.value)}
                        className="max-w-xs"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleManualRefetch}
                      >
                        Refresh Flows
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Steps</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredFlows.length > 0 ? (
                        filteredFlows.map((flow) => (
                          <TableRow key={flow.id}>
                            <TableCell className="font-medium">
                              <div>
                                <div>{flow.name}</div>
                                <div className="text-sm text-muted-foreground">{flow.description}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={flow.flow_type === 'predefined' ? 'secondary' : 'default'}>
                                {flow.flow_type || 'custom'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {flow.steps.slice(0, 3).map((step, index) => (
                                  <Badge key={index} variant="outline" className="text-xs" title={`${step.step_type}: ${step.description || step.name}`}>
                                    {step.step_type === 'manual_approval' ? '👤 ' : '🤖 '}{step.name}
                                  </Badge>
                                ))}
                                {flow.steps.length > 3 && (
                                  <Badge variant="outline" className="text-xs" title={`${flow.steps.length - 3} additional steps`}>
                                    +{flow.steps.length - 3} more
                                  </Badge>
                                )}
                                {flow.steps.length === 0 && (
                                  <Badge variant="outline" className="text-xs text-muted-foreground">
                                    No steps
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={
                                flow.status === 'active' ? 'default' :
                                flow.status === 'inactive' ? 'secondary' :
                                flow.status === 'draft' ? 'outline' :
                                'destructive'
                              }>
                                {flow.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {formatDistanceToNow(new Date(flow.created_at))} ago
                            </TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Button
                                  variant={flow.status === 'active' ? 'secondary' : 'default'}
                                  size="sm"
                                  onClick={() => handleToggleFlowStatus(flow.id, flow.status)}
                                  disabled={updateFlowStatusMutation.isPending}
                                >
                                  {flow.status === 'active' ? (
                                    <>
                                      <Pause className="h-3 w-3 mr-1" />
                                      Deactivate
                                    </>
                                  ) : flow.status === 'archived' ? (
                                    <>
                                      <Play className="h-3 w-3 mr-1" />
                                      Restore
                                    </>
                                  ) : (
                                    <>
                                      <Play className="h-3 w-3 mr-1" />
                                      Activate
                                    </>
                                  )}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditCustomFlow(flow)}
                                >
                                  <Edit className="h-3 w-3 mr-1" />
                                  Edit
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteFlow(flow.id)}
                                >
                                  <Trash2 className="h-3 w-3 mr-1" />
                                  Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            <Palette className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>No approval flows found</p>
                            <p className="text-sm">Create your first approval flow to get started</p>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )
              }
            </>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Access Denied</CardTitle>
                <CardDescription>
                  You don't have permission to access the Approval Flow Designer.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  This feature requires admin privileges. Please contact your system administrator if you need access to design approval flows.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Delete Flow Confirmation Dialog */}
      <Dialog open={isDeleteFlowDialogOpen} onOpenChange={setIsDeleteFlowDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <DialogTitle>Delete Approval Flow</DialogTitle>
            </div>
            <DialogDescription className="pt-2">
              Are you sure you want to delete the approval flow "<span className="font-semibold">{flowToDelete?.name}</span>"?
              This action cannot be undone and will permanently remove the flow from the system.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-red-50 border border-red-200 rounded-md p-3 mt-4">
            <div className="flex items-center space-x-2 text-red-800">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">Warning</span>
            </div>
            <p className="text-sm text-red-700 mt-1">
              Deleting this flow will affect all pending and future approval requests that use this flow.
            </p>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={handleCancelDelete}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteFlowMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteFlowMutation.isPending ? 'Deleting...' : 'Delete Flow'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Request Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Review Approval Request
              {selectedRequest?.prompt_name && (
                <span className="text-base font-normal text-muted-foreground ml-2">
                  - {selectedRequest.prompt_name} v{selectedRequest.prompt_version}
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              Review and approve or reject this prompt approval request
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-6">
              {/* Request Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Module</Label>
                  <p className="text-sm text-muted-foreground">
                    {selectedRequest.prompt_module_id || promptToModuleMap[selectedRequest.prompt_id] || 'Unknown Module'}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Prompt ID</Label>
                  <p className="text-sm text-muted-foreground font-mono text-xs">
                    {selectedRequest.prompt_id}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Requested By</Label>
                  <p className="text-sm text-muted-foreground">
                    {userNameMap[selectedRequest.requested_by] || selectedRequest.requested_by}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Requested At</Label>
                  <p className="text-sm text-muted-foreground">
                    {new Date(selectedRequest.requested_at).toLocaleString()}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Current Status</Label>
                  <Badge variant={
                    selectedRequest.status === 'approved' ? 'default' :
                    selectedRequest.status === 'rejected' ? 'destructive' : 'secondary'
                  }>
                    {selectedRequest.status}
                  </Badge>
                </div>
              </div>

              {/* Prompt Details */}
              <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-2">Prompt Details</h4>
                <div className="space-y-2">
                  {/* Version Information */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">Prompt Name</Label>
                      <p className="text-sm text-muted-foreground">
                        {selectedRequest.prompt_name || promptDetailsMap[selectedRequest.prompt_id]?.name || 'Unnamed Prompt'}
                      </p>
                    </div>
                    <div className="text-right">
                      <Label className="text-sm font-medium">Version</Label>
                      <Badge variant="outline" className="ml-2">
                        {selectedRequest.prompt_version || promptDetailsMap[selectedRequest.prompt_id]?.version || 'N/A'}
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Description</Label>
                    <p className="text-sm text-muted-foreground">
                      {selectedRequest.prompt_description || promptDetailsMap[selectedRequest.prompt_id]?.description || 'No description'}
                    </p>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Risk Level</Label>
                    <Badge variant={
                      (selectedRequest.mas_risk_level || promptDetailsMap[selectedRequest.prompt_id]?.mas_risk_level) === 'high' ? 'destructive' :
                      (selectedRequest.mas_risk_level || promptDetailsMap[selectedRequest.prompt_id]?.mas_risk_level) === 'medium' ? 'default' : 'secondary'
                    }>
                      {(selectedRequest.mas_risk_level || promptDetailsMap[selectedRequest.prompt_id]?.mas_risk_level) || 'low'} risk
                    </Badge>
                  </div>

                  {/* Additional Version Context */}
                  {selectedRequest.prompt_created_at && (
                    <div>
                      <Label className="text-sm font-medium">Created</Label>
                      <p className="text-sm text-muted-foreground">
                        {new Date(selectedRequest.prompt_created_at).toLocaleDateString()} by {selectedRequest.prompt_created_by || 'Unknown'}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Version Comparison Section */}
              {comparisonLoading ? (
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3">Version Comparison</h4>
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                    <span className="text-sm text-muted-foreground">Loading comparison data...</span>
                  </div>
                </div>
              ) : comparisonData && (
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3">Version Comparison</h4>

                  {/* Comparison Summary */}
                  {comparisonData.comparison_summary && (
                    <div className="mb-4 p-3 bg-blue-50 rounded-md">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Version Changes</span>
                        <Badge variant="outline" className="text-xs">
                          {comparisonData.comparison_summary.version_comparison?.is_version_upgrade ? 'Version Upgrade' : 'Version Change'}
                        </Badge>
                      </div>
                      {comparisonData.comparison_summary.version_comparison && (
                        <div className="text-xs text-muted-foreground">
                          {comparisonData.comparison_summary.version_comparison.current_version || 'First version'} → {comparisonData.comparison_summary.version_comparison.new_version}
                        </div>
                      )}
                      {comparisonData.comparison_summary.content_changes?.has_content_changes && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Content length difference: {comparisonData.comparison_summary.content_changes.content_length_diff || 0} characters
                        </div>
                      )}
                    </div>
                  )}

                  {/* Side-by-side comparison */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Current Active Prompt */}
                    {comparisonData.current_active_prompt ? (
                      <div className="border rounded-md p-3">
                        <h5 className="text-sm font-medium mb-2 text-green-700">Current Active Version</h5>
                        <div className="space-y-2 text-xs">
                          <div>
                            <span className="font-medium">Version:</span> {comparisonData.current_active_prompt.version}
                          </div>
                          <div>
                            <span className="font-medium">Name:</span> {comparisonData.current_active_prompt.name || 'Unnamed'}
                          </div>
                          <div>
                            <span className="font-medium">Risk Level:</span>{' '}
                            <Badge variant={
                              comparisonData.current_active_prompt.mas_risk_level === 'high' ? 'destructive' :
                              comparisonData.current_active_prompt.mas_risk_level === 'medium' ? 'default' : 'secondary'
                            } className="text-xs">
                              {comparisonData.current_active_prompt.mas_risk_level || 'low'} risk
                            </Badge>
                          </div>
                          {comparisonData.current_active_prompt.description && (
                            <div>
                              <span className="font-medium">Description:</span>
                              <p className="text-muted-foreground mt-1">{comparisonData.current_active_prompt.description}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="border rounded-md p-3 bg-gray-50">
                        <h5 className="text-sm font-medium mb-2 text-gray-600">First Version</h5>
                        <p className="text-xs text-muted-foreground">No active version exists. This will be the first active version.</p>
                      </div>
                    )}

                    {/* New Prompt Version */}
                    <div className="border rounded-md p-3">
                      <h5 className="text-sm font-medium mb-2 text-blue-700">New Version</h5>
                      <div className="space-y-2 text-xs">
                        <div>
                          <span className="font-medium">Version:</span> {comparisonData.new_prompt_version.version}
                        </div>
                        <div>
                          <span className="font-medium">Name:</span> {comparisonData.new_prompt_version.name || 'Unnamed'}
                        </div>
                        <div>
                          <span className="font-medium">Risk Level:</span>{' '}
                          <Badge variant={
                            comparisonData.new_prompt_version.mas_risk_level === 'high' ? 'destructive' :
                            comparisonData.new_prompt_version.mas_risk_level === 'medium' ? 'default' : 'secondary'
                          } className="text-xs">
                            {comparisonData.new_prompt_version.mas_risk_level || 'low'} risk
                          </Badge>
                        </div>
                        {comparisonData.new_prompt_version.description && (
                          <div>
                            <span className="font-medium">Description:</span>
                            <p className="text-muted-foreground mt-1">{comparisonData.new_prompt_version.description}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Content Changes */}
                  {comparisonData.current_active_prompt && comparisonData.comparison_summary?.content_changes?.has_content_changes && (
                    <div className="mt-4">
                      <h5 className="text-sm font-medium mb-2">Content Changes</h5>
                      <div className="text-xs mb-2 text-muted-foreground">
                        Showing differences between versions (highlighted changes)
                      </div>
                      <div className="border rounded-md bg-gray-50 p-2 max-h-64 overflow-y-auto">
                        <SimpleDiffView
                          oldContent={comparisonData.current_active_prompt.content}
                          newContent={comparisonData.new_prompt_version.content}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Permission Information */}
              <div className="border rounded-lg p-4 bg-gray-50">
                <h4 className="font-medium mb-3">Approval Permissions</h4>
                {permissionsLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                    <span className="text-sm text-muted-foreground">Checking permissions...</span>
                  </div>
                ) : permissions ? (
                  <div className="space-y-3">
                    {/* User Role Display */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Your Role:</span>
                      <div className="flex space-x-1">
                        {permissions.user_roles.map((role, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {role}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Workflow Step Information */}
                    {permissions.workflow_context && permissions.workflow_context.total_steps > 1 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Current Step:</span>
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline" className="text-xs">
                              {permissions.current_step_name || `Step ${permissions.current_step! + 1}`}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {permissions.workflow_context.current_step_display || `${permissions.current_step! + 1} of ${permissions.workflow_context.total_steps}`}
                            </span>
                          </div>
                        </div>

                        {/* Enhanced Progress Information */}
                        {permissions.workflow_context.step_progression && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">Progress:</span>
                              <span className="text-xs text-muted-foreground">
                                {permissions.workflow_context.step_progression.progress_percentage || 0}%
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{ width: `${permissions.workflow_context.step_progression.progress_percentage || 0}%` }}
                              ></div>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {permissions.workflow_context.step_progression.steps_completed || 0} completed, {permissions.workflow_context.step_progression.steps_remaining || 0} remaining
                            </div>
                          </div>
                        )}

                        {/* Debug Information */}
                        {process.env.NODE_ENV === 'development' && (
                          <div className="border-t pt-2 mt-2">
                            <div className="text-xs font-mono text-muted-foreground space-y-1">
                              <div>Instance ID: {permissions.workflow_context.workflow_instance_id}</div>
                              <div>Step Index: {permissions.workflow_context.current_step}</div>
                              <div>Total Steps: {permissions.workflow_context.total_steps}</div>
                              <div>Is First Step: {permissions.workflow_context.step_progression?.is_first_step ? 'Yes' : 'No'}</div>
                              <div>Is Last Step: {permissions.workflow_context.step_progression?.is_last_step ? 'Yes' : 'No'}</div>
                              <div>Has Next Step: {permissions.workflow_context.step_progression?.has_next_step ? 'Yes' : 'No'}</div>
                              {permissions.workflow_context.step_progression?.next_step_name && (
                                <div>Next Step: {permissions.workflow_context.step_progression.next_step_name}</div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Workflow Progress */}
                        {permissions.workflow_context.workflow_name && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Workflow:</span>
                            <span className="text-xs text-muted-foreground">
                              {permissions.workflow_context.workflow_name}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Required Roles Display */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {permissions.workflow_context && permissions.workflow_context.total_steps > 1
                          ? `Step ${permissions.current_step! + 1} Required Roles:`
                          : 'Required Roles:'}
                      </span>
                      <div className="flex space-x-1">
                        {permissions.current_step_roles.map((role, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {role}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Permission Status */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center space-x-2">
                        {permissions.can_approve ? (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        ) : (
                          <XCircle className="h-3 w-3 text-red-500" />
                        )}
                        <span>Can Approve</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {permissions.can_reject ? (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        ) : (
                          <XCircle className="h-3 w-3 text-red-500" />
                        )}
                        <span>Can Reject</span>
                      </div>
                    </div>

                    {/* Permission Details */}
                    {!permissions.can_approve && !permissions.can_reject && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-2">
                        <div className="flex items-center space-x-2 text-yellow-800">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="text-sm font-medium">Insufficient Permissions</span>
                        </div>
                        <p className="text-xs text-yellow-700 mt-1">
                          {permissions.workflow_context && permissions.workflow_context.total_steps > 1
                            ? `You don't have the required roles (${permissions.current_step_roles.join(', ')}) for ${permissions.current_step_name || `Step ${permissions.current_step! + 1}`}.`
                            : `You don't have the required roles (${permissions.current_step_roles.join(', ')}) to approve or reject this request.`
                          }
                          Contact your administrator if you believe this is an error.
                        </p>
                      </div>
                    )}

                    {/* Step-specific Access Indicator */}
                    {permissions.permission_details?.step_specific_access && permissions.workflow_context?.total_steps > 1 && (
                      <div className="bg-blue-50 border border-blue-200 rounded-md p-2">
                        <div className="flex items-center space-x-2 text-blue-800">
                          <Info className="h-4 w-4" />
                          <span className="text-sm font-medium">Step-Specific Access</span>
                        </div>
                        <p className="text-xs text-blue-700 mt-1">
                          This request is part of a multi-step workflow. Your access is determined by the roles required for the current step.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Unable to check permissions. Please refresh the page.
                  </div>
                )}
              </div>

              {/* Approval Actions */}
              {selectedRequest.status === 'pending' && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="approvalComments" className="text-sm font-medium">
                      Approval Comments (Optional)
                    </Label>
                    <Textarea
                      id="approvalComments"
                      placeholder="Add any comments about your approval decision..."
                      value={approvalComments}
                      onChange={(e) => setApprovalComments(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label htmlFor="rejectionReason" className="text-sm font-medium">
                      Rejection Reason (Required for rejection)
                    </Label>
                    <Textarea
                      id="rejectionReason"
                      placeholder="If rejecting, please provide a reason..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <DialogFooter className="flex justify-between">
                    <Button
                      variant="outline"
                      onClick={handleDialogClose}
                    >
                      Cancel
                    </Button>
                    <div className="flex space-x-2">
                      {/* Reject Button - Only shown if user has permission */}
                      {permissions?.can_reject && (
                        <Button
                          variant="destructive"
                          onClick={handleReject}
                          disabled={!rejectionReason.trim() || updateApprovalRequest.isPending}
                        >
                          {updateApprovalRequest.isPending ? 'Rejecting...' : 'Reject'}
                        </Button>
                      )}

                      {/* Approve Button - Only shown if user has permission */}
                      {permissions?.can_approve && (
                        <Button
                          onClick={handleApprove}
                          disabled={updateApprovalRequest.isPending}
                        >
                          {updateApprovalRequest.isPending ? 'Approving...' : 'Approve'}
                        </Button>
                      )}

                      {/* Show message if user lacks permissions */}
                      {!permissions?.can_approve && !permissions?.can_reject && (
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <Lock className="h-4 w-4" />
                          <span>Insufficient permissions to take action</span>
                        </div>
                      )}
                    </div>
                  </DialogFooter>
                </div>
              )}

              {/* Show final status if already decided */}
              {selectedRequest.status !== 'pending' && (
                <DialogFooter>
                  <Button variant="outline" onClick={handleDialogClose}>
                    Close
                  </Button>
                </DialogFooter>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}