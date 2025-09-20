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
  Pause
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
  useApprovalFlowStats
} from '@/hooks/useApprovalFlows'
import { useUsers, useUpdateApprovalRequest } from '@/hooks/api'
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

  // Debug: Log approval requests structure
  console.log('🔍 [DEBUG] Approval requests structure:', approvalRequests)
  if (approvalRequests.length > 0) {
    console.log('🔍 [DEBUG] First approval request sample:', approvalRequests[0])
    console.log('🔍 [DEBUG] Available fields:', Object.keys(approvalRequests[0]))
  }

  // Create mappings for better display
  const userNameMap = useMemo(() => {
    const map: Record<string, string> = {}
    users.forEach((user: any) => {
      if (user.id && !map[user.id]) {
        map[user.id] = user.name || user.email || user.id
      }
    })
    return map
  }, [users])

  // Get unique prompt IDs from approval requests
  const uniquePromptIds = useMemo(() => {
    return [...new Set(approvalRequests.map((r: any) => r.prompt_id))]
  }, [approvalRequests])

  // Use useQueries to fetch multiple prompts without hooks order violation
  const promptQueries = useQueries({
    queries: uniquePromptIds.map((promptId) => ({
      queryKey: ['prompts', promptId, 'versions'],
      queryFn: () => apiRequest<any[]>(`/prompts/${promptId}`),
      enabled: !!promptId,
    }))
  })

  // Create prompt details map from query results
  const promptDetailsMap = useMemo(() => {
    const map: Record<string, any> = {}
    promptQueries.forEach((query, index) => {
      const promptId = uniquePromptIds[index]
      if (query.data && query.data.length > 0) {
        map[promptId] = query.data[0] // Get latest version
      }
    })
    return map
  }, [promptQueries, uniquePromptIds])

  // Fetch module details for each unique module_id using existing hooks
  const uniqueModuleIds = useMemo(() => {
    return [...new Set(Object.values(promptDetailsMap).map((p: any) => p?.module_id).filter(Boolean))]
  }, [promptDetailsMap])

  // Use useQueries to fetch multiple modules without hooks order violation
  const moduleQueries = useQueries({
    queries: uniqueModuleIds.map((moduleId) => ({
      queryKey: ['modules', moduleId, 'versions'],
      queryFn: () => apiRequest<any[]>(`/modules/${moduleId}`),
      enabled: !!moduleId,
    }))
  })

  // Create module details map from query results
  const moduleDetailsMap = useMemo(() => {
    const map: Record<string, any> = {}
    moduleQueries.forEach((query, index) => {
      const moduleId = uniqueModuleIds[index]
      if (query.data && query.data.length > 0) {
        map[moduleId] = query.data[0] // Get latest version
      }
    })
    return map
  }, [moduleQueries, uniqueModuleIds])

  // Create a mapping of prompt IDs to module slot names
  const moduleSlotMap = useMemo(() => {
    const map: Record<string, string> = {}

    approvalRequests.forEach((request: any) => {
      if (request.prompt_id && !map[request.prompt_id]) {
        const prompt = promptDetailsMap[request.prompt_id]

        if (prompt && prompt.module_id) {
          const module = moduleDetailsMap[prompt.module_id]

          if (module && module.slot) {
            map[request.prompt_id] = module.slot
          } else {
            map[request.prompt_id] = `Module ${prompt.module_id}`
          }
        } else {
          map[request.prompt_id] = 'Unknown Module'
        }
      }
    })

    return map
  }, [approvalRequests, promptDetailsMap, moduleDetailsMap])

  const createFlowMutation = useCreateApprovalFlow()
  const updateFlowMutation = useUpdateApprovalFlow()
  const deleteFlowMutation = useDeleteApprovalFlow()

  // Status update mutation
  const updateFlowStatusMutation = useMutation({
    mutationFn: async ({ flowId, status }: { flowId: string; status: string }) => {
      // Use the authenticated HTTP client
      return await authenticatedFetch(`${FLOWS_API_BASE}/flows/${flowId}`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-flows'] })
      toast.success('Flow status updated successfully')
    },
    onError: (error) => {
      toast.error(`Failed to update flow status: ${error.message}`)
    },
  })

  // State for search and filters
  const [flowsSearchQuery, setFlowsSearchQuery] = useState('')
  const [requestsSearchQuery, setRequestsSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [filterType, setFilterType] = useState<'all' | 'create' | 'edit'>('all')
  const [selectedRequest, setSelectedRequest] = useState<any>(null)
  const updateApprovalRequest = useUpdateApprovalRequest()
  const [approvalComments, setApprovalComments] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')

  // Debug: Log when selectedRequest changes
  console.log('🔍 [DEBUG] selectedRequest:', selectedRequest)

  // Handle approval actions
  const handleApprove = async () => {
    if (!selectedRequest) return

    try {
      await updateApprovalRequest.mutateAsync({
        requestId: selectedRequest.id,
        request: {
          status: 'approved',
          comments: approvalComments,
          approver: 'current_user' // This should come from auth context
        }
      })
      setSelectedRequest(null)
      setApprovalComments('')
      // Refresh the approval requests list
      queryClient.invalidateQueries({ queryKey: ['approval-requests'] })
      toast.success('Request approved successfully')
    } catch (error) {
      toast.error('Failed to approve request')
    }
  }

  const handleReject = async () => {
    if (!selectedRequest) return

    try {
      await updateApprovalRequest.mutateAsync({
        requestId: selectedRequest.id,
        request: {
          status: 'rejected',
          rejection_reason: rejectionReason,
          approver: 'current_user' // This should come from auth context
        }
      })
      setSelectedRequest(null)
      setRejectionReason('')
      // Refresh the approval requests list
      queryClient.invalidateQueries({ queryKey: ['approval-requests'] })
      toast.success('Request rejected successfully')
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


  const filteredRequests = useMemo(() => {
    return approvalRequests.filter((request: any) => {
      const moduleSlot = moduleSlotMap[request.prompt_id] || request.prompt_id
      const requestedByName = userNameMap[request.requested_by] || request.requested_by
      const matchesSearch = moduleSlot?.toLowerCase().includes(requestsSearchQuery.toLowerCase()) ||
                          requestedByName?.toLowerCase().includes(requestsSearchQuery.toLowerCase())
      const matchesStatus = filterStatus === 'all' || request.status === filterStatus
      const matchesType = filterType === 'all' || request.request_type === filterType

      return matchesSearch && matchesStatus && matchesType
    })
  }, [approvalRequests, requestsSearchQuery, filterStatus, filterType])

  const filteredFlows = useMemo(() => {
    return enhancedFlows.filter(flow => {
      const matchesSearch = flow.name.toLowerCase().includes(flowsSearchQuery.toLowerCase()) ||
                          flow.description.toLowerCase().includes(flowsSearchQuery.toLowerCase())
      return matchesSearch
    })
  }, [enhancedFlows, flowsSearchQuery])



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
          status: flow.status as 'active' | 'inactive' | 'draft',
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
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
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
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="requests">Approval Requests</TabsTrigger>
          <TabsTrigger value="designer">Approval Flow Designer</TabsTrigger>
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
                    <p className="text-2xl font-bold">{flowStats?.total_requests || 0}</p>
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
                    <p className="text-2xl font-bold">{flowStats?.pending_requests || 0}</p>
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
                    <p className="text-2xl font-bold">
                      {approvalRequests.filter((r: any) => r.status === 'approved').length}
                    </p>
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
                    <p className="text-2xl font-bold">
                      {approvalRequests.filter((r: any) => r.status === 'rejected').length}
                    </p>
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
                      <TableCell className="font-medium">{moduleSlotMap[request.prompt_id] || request.prompt_id}</TableCell>
                      <TableCell>
                        <Badge variant="default">
                          Create
                        </Badge>
                      </TableCell>
                      <TableCell>{userNameMap[request.requested_by] || request.requested_by}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {request.current_step_id || 'Pending'}
                        </Badge>
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* Approval Flow Designer Tab */}
        <TabsContent value="designer" className="space-y-6">
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
                              <Badge variant="default">
                                custom
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {flow.steps.slice(0, 3).map((step, index) => (
                                  <Badge key={index} variant="outline" className="text-xs">
                                    {step.name}
                                  </Badge>
                                ))}
                                {flow.steps.length > 3 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{flow.steps.length - 3} more
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={flow.status === 'active' ? 'default' : 'secondary'}>
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
            <DialogTitle>Review Approval Request</DialogTitle>
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
                    {moduleSlotMap[selectedRequest.prompt_id] || 'Unknown Module'}
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
              {promptDetailsMap[selectedRequest.prompt_id] && (
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-2">Prompt Details</h4>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-sm font-medium">Name</Label>
                      <p className="text-sm text-muted-foreground">
                        {promptDetailsMap[selectedRequest.prompt_id].name || 'Unnamed Prompt'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Description</Label>
                      <p className="text-sm text-muted-foreground">
                        {promptDetailsMap[selectedRequest.prompt_id].description || 'No description'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Risk Level</Label>
                      <Badge variant={
                        promptDetailsMap[selectedRequest.prompt_id].mas_risk_level === 'high' ? 'destructive' :
                        promptDetailsMap[selectedRequest.prompt_id].mas_risk_level === 'medium' ? 'default' : 'secondary'
                      }>
                        {promptDetailsMap[selectedRequest.prompt_id].mas_risk_level || 'low'} risk
                      </Badge>
                    </div>
                  </div>
                </div>
              )}

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
                      <Button
                        variant="destructive"
                        onClick={handleReject}
                        disabled={!rejectionReason.trim() || updateApprovalRequest.isPending}
                      >
                        {updateApprovalRequest.isPending ? 'Rejecting...' : 'Reject'}
                      </Button>
                      <Button
                        onClick={handleApprove}
                        disabled={updateApprovalRequest.isPending}
                      >
                        {updateApprovalRequest.isPending ? 'Approving...' : 'Approve'}
                      </Button>
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