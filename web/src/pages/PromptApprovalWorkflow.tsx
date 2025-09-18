import { useState, useMemo } from 'react'
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
  AlertTriangle
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { FlowDesigner } from '@/components/approval/FlowDesigner'

// Import the enhanced types
import type {
  ApprovalFlow as EnhancedApprovalFlow,
  ApprovalFlowStep,
  CustomRole,
  ApprovalFlowCreate
} from '@/types/approval-flows'

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

// Keep the existing interface for backward compatibility
interface ApprovalFlow {
  id: string
  name: string
  description: string
  flowType: 'editor_approver_admin' | 'editor_approver'
  steps: Array<{
    name: string
    type: 'editor_review' | 'approver_review' | 'admin_review'
    required: boolean
    assignees?: string[]
  }>
  isActive: boolean
  createdAt: string
  updatedAt: string
  createdBy: string
  totalRequests: number
  avgProcessingTime: number
}

interface PromptApprovalRequest {
  id: string
  promptId: string
  promptName: string
  promptContent: string
  requestType: 'create' | 'edit'
  requestedBy: string
  requestedAt: string
  currentStep: 'editor_review' | 'approver_review' | 'admin_review'
  status: 'pending' | 'approved' | 'rejected'
  reviewers: string[]
  comments?: string
  workflowType: 'editor_approver_admin' | 'editor_approver'
  flowId?: string
}

export function PromptApprovalWorkflow() {
  const [activeTab, setActiveTab] = useState<'flows' | 'requests' | 'designer'>('flows')
  const [showFlowDesigner, setShowFlowDesigner] = useState(false)
  const [editingFlow, setEditingFlow] = useState<EnhancedApprovalFlow | null>(null)

  // Use the new hooks for enhanced functionality
  const { data: enhancedFlows = [] } = useApprovalFlows()
  const { data: roles = [] } = useAvailableRoles()
  const { data: flowStats } = useApprovalFlowStats()

  const createFlowMutation = useCreateApprovalFlow()
  const updateFlowMutation = useUpdateApprovalFlow()
  const deleteFlowMutation = useDeleteApprovalFlow()

  // Keep existing state for backward compatibility
  const [flowsSearchQuery, setFlowsSearchQuery] = useState('')
  const [selectedFlow, setSelectedFlow] = useState<ApprovalFlow | null>(null)
  const [isCreateFlowDialogOpen, setIsCreateFlowDialogOpen] = useState(false)
  const [isEditFlowDialogOpen, setIsEditFlowDialogOpen] = useState(false)
  const [isDeleteFlowDialogOpen, setIsDeleteFlowDialogOpen] = useState(false)
  const [flowToDelete, setFlowToDelete] = useState<ApprovalFlow | null>(null)
  const [legacyEditingFlow, setLegacyEditingFlow] = useState<ApprovalFlow | null>(null)
  const [newFlow, setNewFlow] = useState({
    name: '',
    description: '',
    flowType: 'editor_approver' as 'editor_approver_admin' | 'editor_approver'
  })

  // Requests state
  const [requestsSearchQuery, setRequestsSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [filterType, setFilterType] = useState<'all' | 'create' | 'edit'>('all')
  const [selectedRequest, setSelectedRequest] = useState<PromptApprovalRequest | null>(null)

  // Mock data - replace with API calls
  const [flows, setFlows] = useState<ApprovalFlow[]>([
    {
      id: 'flow-1',
      name: 'Standard Prompt Approval',
      description: 'Standard approval workflow for general-purpose prompts',
      flowType: 'editor_approver',
      steps: [
        { name: 'Editor Review', type: 'editor_review', required: true },
        { name: 'Approver Review', type: 'approver_review', required: true }
      ],
      isActive: true,
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      createdBy: 'admin@example.com',
      totalRequests: 45,
      avgProcessingTime: 2.5
    },
    {
      id: 'flow-2',
      name: 'Critical Prompt Approval',
      description: 'Enhanced approval workflow for critical and high-impact prompts',
      flowType: 'editor_approver_admin',
      steps: [
        { name: 'Editor Review', type: 'editor_review', required: true },
        { name: 'Approver Review', type: 'approver_review', required: true },
        { name: 'Admin Review', type: 'admin_review', required: true }
      ],
      isActive: true,
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      createdBy: 'admin@example.com',
      totalRequests: 12,
      avgProcessingTime: 4.2
    }
  ])

  const [requests, setRequests] = useState<PromptApprovalRequest[]>([
    {
      id: '1',
      promptId: 'prompt-1',
      promptName: 'Customer Support Bot',
      promptContent: 'You are a helpful customer support assistant. Please help customers with their inquiries in a friendly and professional manner. Always be polite and provide accurate information.',
      requestType: 'create',
      requestedBy: 'john.doe@example.com',
      requestedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      currentStep: 'approver_review',
      status: 'pending',
      reviewers: ['jane.smith@example.com', 'admin@example.com'],
      workflowType: 'editor_approver_admin'
    },
    {
      id: '2',
      promptId: 'prompt-2',
      promptName: 'Technical Documentation Writer',
      promptContent: 'You are an expert technical writer. Create clear and concise documentation for software products. Use proper formatting and include examples where necessary.',
      requestType: 'edit',
      requestedBy: 'alice.johnson@example.com',
      requestedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      currentStep: 'editor_review',
      status: 'pending',
      reviewers: ['bob.wilson@example.com'],
      workflowType: 'editor_approver'
    },
    {
      id: '3',
      promptId: 'prompt-3',
      promptName: 'Code Review Assistant',
      promptContent: 'Review the provided code and suggest improvements. Focus on code quality, performance, security, and best practices. Provide specific, actionable feedback.',
      requestType: 'create',
      requestedBy: 'charlie.brown@example.com',
      requestedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      currentStep: 'admin_review',
      status: 'approved',
      reviewers: ['david.lee@example.com', 'admin@example.com'],
      workflowType: 'editor_approver_admin'
    },
    {
      id: '4',
      promptId: 'prompt-4',
      promptName: 'Sales Email Generator',
      promptContent: 'Generate personalized sales emails based on customer data and product information. Focus on benefits and value proposition.',
      requestType: 'edit',
      requestedBy: 'emma.davis@example.com',
      requestedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      currentStep: 'approver_review',
      status: 'rejected',
      reviewers: ['frank.miller@example.com'],
      comments: 'The prompt is too vague and needs more specific guidelines about tone and target audience.',
      workflowType: 'editor_approver'
    }
  ])

  const filteredRequests = useMemo(() => {
    return requests.filter(request => {
      const matchesSearch = request.promptName.toLowerCase().includes(requestsSearchQuery.toLowerCase()) ||
                          request.requestedBy.toLowerCase().includes(requestsSearchQuery.toLowerCase())
      const matchesStatus = filterStatus === 'all' || request.status === filterStatus
      const matchesType = filterType === 'all' || request.requestType === filterType

      return matchesSearch && matchesStatus && matchesType
    })
  }, [requests, requestsSearchQuery, filterStatus, filterType])

  const filteredFlows = useMemo(() => {
    return flows.filter(flow => {
      const matchesSearch = flow.name.toLowerCase().includes(flowsSearchQuery.toLowerCase()) ||
                          flow.description.toLowerCase().includes(flowsSearchQuery.toLowerCase())
      return matchesSearch
    })
  }, [flows, flowsSearchQuery])

  const handleApprove = (requestId: string) => {
    setRequests(prev => prev.map(req =>
      req.id === requestId
        ? { ...req, status: 'approved' as const, currentStep: 'admin_review' as const }
        : req
    ))
  }

  const handleReject = (requestId: string, comments: string) => {
    setRequests(prev => prev.map(req =>
      req.id === requestId
        ? { ...req, status: 'rejected' as const, comments }
        : req
    ))
  }

  const handleCreateFlow = () => {
    const steps = newFlow.flowType === 'editor_approver_admin'
      ? [
          { name: 'Editor Review', type: 'editor_review' as const, required: true },
          { name: 'Approver Review', type: 'approver_review' as const, required: true },
          { name: 'Admin Review', type: 'admin_review' as const, required: true }
        ]
      : [
          { name: 'Editor Review', type: 'editor_review' as const, required: true },
          { name: 'Approver Review', type: 'approver_review' as const, required: true }
        ]

    const flow: ApprovalFlow = {
      id: `flow-${Date.now()}`,
      name: newFlow.name,
      description: newFlow.description,
      flowType: newFlow.flowType,
      steps,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'current@example.com',
      totalRequests: 0,
      avgProcessingTime: 0
    }

    setFlows(prev => [...prev, flow])
    setNewFlow({ name: '', description: '', flowType: 'editor_approver' })
    setIsCreateFlowDialogOpen(false)
  }

  const handleEditFlow = (flow: ApprovalFlow) => {
    setLegacyEditingFlow(flow)
    setIsEditFlowDialogOpen(true)
  }

  const handleUpdateFlow = () => {
    if (!legacyEditingFlow) return

    const steps = legacyEditingFlow.flowType === 'editor_approver_admin'
      ? [
          { name: 'Editor Review', type: 'editor_review' as const, required: true },
          { name: 'Approver Review', type: 'approver_review' as const, required: true },
          { name: 'Admin Review', type: 'admin_review' as const, required: true }
        ]
      : [
          { name: 'Editor Review', type: 'editor_review' as const, required: true },
          { name: 'Approver Review', type: 'approver_review' as const, required: true }
        ]

    const updatedFlow: ApprovalFlow = {
      ...legacyEditingFlow,
      steps,
      updatedAt: new Date().toISOString()
    }

    setFlows(prev => prev.map(flow => flow.id === legacyEditingFlow.id ? updatedFlow : flow))
    setIsEditFlowDialogOpen(false)
    setLegacyEditingFlow(null)
  }

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
          status: flow.status,
          steps: flow.steps,
          conditions: flow.conditions,
          metadata: flow.metadata,
        }
      })
    } else {
      // Create new flow
      createFlowMutation.mutate({
        name: flow.name,
        description: flow.description,
        flow_type: 'custom',
        steps: flow.steps,
        conditions: flow.conditions,
        metadata: flow.metadata,
      })
    }
    setShowFlowDesigner(false)
    setEditingFlow(null)
  }

  const handleDeleteCustomFlow = (flowId: string) => {
    const flow = enhancedFlows.find(f => f.id === flowId)
    if (flow) {
      setFlowToDelete(flow)
      setIsDeleteFlowDialogOpen(true)
    }
  }

  const handleCancelFlowDesigner = () => {
    setShowFlowDesigner(false)
    setEditingFlow(null)
  }

  const handleConfirmDelete = () => {
    if (flowToDelete) {
      deleteFlowMutation.mutate(flowToDelete.id)
      setIsDeleteFlowDialogOpen(false)
      setFlowToDelete(null)
    }
  }

  const handleCancelDelete = () => {
    setIsDeleteFlowDialogOpen(false)
    setFlowToDelete(null)
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
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'flows' | 'requests' | 'designer')}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="flows">Approval Flows</TabsTrigger>
          <TabsTrigger value="requests">Approval Requests</TabsTrigger>
          <TabsTrigger value="designer">Flow Designer</TabsTrigger>
        </TabsList>

        {/* Approval Flows Tab */}
        <TabsContent value="flows" className="space-y-6">
          {/* Flows Header */}
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Approval Flows</h2>
              <p className="text-muted-foreground">Configure and manage approval workflow templates</p>
            </div>
            <Button onClick={() => setIsCreateFlowDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Flow
            </Button>
          </div>

          {/* Flows Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <GitBranch className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold">{flows.length}</p>
                    <p className="text-sm text-muted-foreground">Total Flows</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold">{flows.filter(f => f.isActive).length}</p>
                    <p className="text-sm text-muted-foreground">Active</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Users className="h-5 w-5 text-purple-500" />
                  <div>
                    <p className="text-2xl font-bold">{flows.reduce((sum, f) => sum + f.totalRequests, 0)}</p>
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
                    <p className="text-2xl font-bold">{(flows.reduce((sum, f) => sum + f.avgProcessingTime, 0) / flows.length).toFixed(1)}h</p>
                    <p className="text-sm text-muted-foreground">Avg Processing</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Flows Search */}
          <Card>
            <CardContent className="p-4">
              <div className="flex space-x-4">
                <div className="flex-1">
                  <Input
                    placeholder="Search flows..."
                    value={flowsSearchQuery}
                    onChange={(e) => setFlowsSearchQuery(e.target.value)}
                    className="max-w-md"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Flows Table */}
          <Card>
            <CardHeader>
              <CardTitle>Workflow Templates</CardTitle>
              <CardDescription>
                Manage approval flow configurations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Steps</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Requests</TableHead>
                    <TableHead>Avg Time</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFlows.map((flow) => (
                    <TableRow key={flow.id}>
                      <TableCell className="font-medium">
                        <div>
                          <div>{flow.name}</div>
                          <div className="text-sm text-muted-foreground">{flow.description}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={flow.flowType === 'editor_approver_admin' ? 'default' : 'secondary'}>
                          {flow.flowType.replace('_', ' → ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {flow.steps.map((step, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {step.name}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={flow.isActive ? 'default' : 'secondary'}>
                          {flow.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>{flow.totalRequests}</TableCell>
                      <TableCell>{flow.avgProcessingTime}h</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedFlow(flow)}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            View
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditFlow(flow)}
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            Edit
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
                    <p className="text-2xl font-bold">{requests.length}</p>
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
                    <p className="text-2xl font-bold">{requests.filter(r => r.status === 'pending').length}</p>
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
                    <p className="text-2xl font-bold">{requests.filter(r => r.status === 'approved').length}</p>
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
                    <p className="text-2xl font-bold">{requests.filter(r => r.status === 'rejected').length}</p>
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
                    <TableHead>Prompt Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Requested By</TableHead>
                    <TableHead>Current Step</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">{request.promptName}</TableCell>
                      <TableCell>
                        <Badge variant={request.requestType === 'create' ? 'default' : 'secondary'}>
                          {request.requestType}
                        </Badge>
                      </TableCell>
                      <TableCell>{request.requestedBy}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {request.currentStep.replace('_', ' ')}
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
                      <TableCell>{formatDistanceToNow(new Date(request.requestedAt))} ago</TableCell>
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
                          {request.status === 'pending' && (
                            <>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleApprove(request.id)}
                              >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Approve
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                  const comments = prompt('Please provide rejection comments:')
                                  if (comments) handleReject(request.id, comments)
                                }}
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                                Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Flow Designer Tab */}
        <TabsContent value="designer" className="space-y-6">
          {showFlowDesigner ? (
            <FlowDesigner
              initialFlow={editingFlow || undefined}
              onSave={handleSaveCustomFlow}
              onCancel={handleCancelFlowDesigner}
            />
          ) : (
            <div className="space-y-6">
              {/* Designer Header */}
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold">Flow Designer</h2>
                  <p className="text-muted-foreground">
                    Create custom approval flows with drag-and-drop step designer
                  </p>
                </div>
                <div className="flex space-x-2">
                  <Button onClick={handleCreateCustomFlow}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create New Flow
                  </Button>
                </div>
              </div>

              {/* Enhanced Flows Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Legacy Flows */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Legacy Flows</CardTitle>
                    <CardDescription>
                      Predefined approval workflows (read-only)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {flows.map(flow => (
                        <div key={flow.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <div className="font-medium">{flow.name}</div>
                            <div className="text-sm text-muted-foreground">{flow.description}</div>
                            <Badge variant={flow.isActive ? 'default' : 'secondary'} className="mt-1">
                              {flow.flowType.replace('_', ' → ')}
                            </Badge>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedFlow(flow)}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            View
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Custom Flows */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Custom Flows</CardTitle>
                    <CardDescription>
                      Advanced approval flows with role assignments
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {enhancedFlows.length > 0 ? (
                        enhancedFlows.map(flow => (
                          <div key={flow.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <div className="font-medium">{flow.name}</div>
                              <div className="text-sm text-muted-foreground">{flow.description}</div>
                              <div className="flex items-center space-x-2 mt-1">
                                <Badge variant={flow.flow_type === 'custom' ? 'default' : 'secondary'}>
                                  {flow.flow_type}
                                </Badge>
                                <Badge variant={flow.status === 'active' ? 'default' : 'secondary'}>
                                  {flow.status}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {flow.steps.length} steps
                                </Badge>
                              </div>
                            </div>
                            <div className="flex space-x-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditCustomFlow(flow)}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteCustomFlow(flow.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Palette className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>No custom flows created yet</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={handleCreateCustomFlow}
                          >
                            Create Your First Flow
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Stats */}
              {flowStats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center space-x-2">
                        <GitBranch className="h-5 w-5 text-blue-500" />
                        <div>
                          <p className="text-2xl font-bold">{flowStats.total_flows}</p>
                          <p className="text-sm text-muted-foreground">Total Flows</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        <div>
                          <p className="text-2xl font-bold">{flowStats.active_flows}</p>
                          <p className="text-sm text-muted-foreground">Active</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center space-x-2">
                        <Users className="h-5 w-5 text-purple-500" />
                        <div>
                          <p className="text-2xl font-bold">{roles.length}</p>
                          <p className="text-sm text-muted-foreground">Available Roles</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center space-x-2">
                        <Clock className="h-5 w-5 text-yellow-500" />
                        <div>
                          <p className="text-2xl font-bold">{flowStats.avg_processing_time_hours || 0}h</p>
                          <p className="text-sm text-muted-foreground">Avg Time</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Flow Dialog */}
      <Dialog open={isCreateFlowDialogOpen} onOpenChange={() => setIsCreateFlowDialogOpen(false)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Approval Flow</DialogTitle>
            <DialogDescription>
              Configure a new approval workflow template
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="flowName">Flow Name</Label>
              <Input
                id="flowName"
                placeholder="Enter flow name"
                value={newFlow.name}
                onChange={(e) => setNewFlow({...newFlow, name: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="flowDescription">Description</Label>
              <Textarea
                id="flowDescription"
                placeholder="Describe the purpose of this flow"
                value={newFlow.description}
                onChange={(e) => setNewFlow({...newFlow, description: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="flowType">Flow Type</Label>
              <Select value={newFlow.flowType} onValueChange={(value) => setNewFlow({...newFlow, flowType: value as any})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select flow type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="editor_approver">Editor → Approver</SelectItem>
                  <SelectItem value="editor_approver_admin">Editor → Approver → Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateFlowDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFlow}>
              Create Flow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Flow Dialog */}
      <Dialog open={isEditFlowDialogOpen} onOpenChange={() => setIsEditFlowDialogOpen(false)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Approval Flow</DialogTitle>
            <DialogDescription>
              Modify the approval workflow template
            </DialogDescription>
          </DialogHeader>
          {legacyEditingFlow && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="editFlowName">Flow Name</Label>
                <Input
                  id="editFlowName"
                  value={legacyEditingFlow.name}
                  onChange={(e) => setLegacyEditingFlow({...legacyEditingFlow, name: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="editFlowDescription">Description</Label>
                <Textarea
                  id="editFlowDescription"
                  value={legacyEditingFlow.description}
                  onChange={(e) => setLegacyEditingFlow({...legacyEditingFlow, description: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="editFlowType">Flow Type</Label>
                <Select value={legacyEditingFlow.flowType} onValueChange={(value) => setLegacyEditingFlow({...legacyEditingFlow, flowType: value as any})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="editor_approver">Editor → Approver</SelectItem>
                    <SelectItem value="editor_approver_admin">Editor → Approver → Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="editFlowStatus">Status</Label>
                <Select value={legacyEditingFlow.isActive ? 'active' : 'inactive'} onValueChange={(value) => setLegacyEditingFlow({...legacyEditingFlow, isActive: value === 'active'})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditFlowDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateFlow}>
              Update Flow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Flow Details Dialog */}
      <Dialog open={!!selectedFlow} onOpenChange={() => setSelectedFlow(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Approval Flow Details</DialogTitle>
            <DialogDescription>
              View flow configuration and statistics
            </DialogDescription>
          </DialogHeader>
          {selectedFlow && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold">{selectedFlow.name}</h3>
                <p className="text-muted-foreground">{selectedFlow.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Flow Type</p>
                  <p>{selectedFlow.flowType.replace('_', ' → ')}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant={selectedFlow.isActive ? 'default' : 'secondary'}>
                    {selectedFlow.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Requests</p>
                  <p>{selectedFlow.totalRequests}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Processing Time</p>
                  <p>{selectedFlow.avgProcessingTime}h</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Workflow Steps</p>
                <div className="space-y-2">
                  {selectedFlow.steps.map((step, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <Badge variant="outline">{step.name}</Badge>
                      <span className="text-sm text-muted-foreground">
                        ({step.type.replace('_', ' ')})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedFlow(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Prompt Request</DialogTitle>
            <DialogDescription>
              Review the prompt content and approve or reject the request
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold">Prompt Details</h3>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p>{selectedRequest.promptName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Type</p>
                    <p>{selectedRequest.requestType}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Requested By</p>
                    <p>{selectedRequest.requestedBy}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Workflow</p>
                    <p>{selectedRequest.workflowType.replace('_', ' → ')}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold">Prompt Content</h3>
                <div className="mt-2 p-4 bg-muted rounded-md">
                  <pre className="whitespace-pre-wrap text-sm">{selectedRequest.promptContent}</pre>
                </div>
              </div>

              <div>
                <h3 className="font-semibold">Review Status</h3>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center space-x-2">
                    <Badge variant={selectedRequest.currentStep === 'editor_review' ? 'default' : 'secondary'}>
                      Editor Review
                    </Badge>
                    <span>→</span>
                    <Badge variant={selectedRequest.currentStep === 'approver_review' ? 'default' : 'secondary'}>
                      Approver Review
                    </Badge>
                    {selectedRequest.workflowType === 'editor_approver_admin' && (
                      <>
                        <span>→</span>
                        <Badge variant={selectedRequest.currentStep === 'admin_review' ? 'default' : 'secondary'}>
                          Admin Review
                        </Badge>
                      </>
                    )}
                  </div>
                  {selectedRequest.comments && (
                    <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-sm font-medium text-red-800">Rejection Comments:</p>
                      <p className="text-sm text-red-700">{selectedRequest.comments}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedRequest(null)}>
              Close
            </Button>
            {selectedRequest?.status === 'pending' && (
              <>
                <Button
                  variant="destructive"
                  onClick={() => {
                    const comments = prompt('Please provide rejection comments:')
                    if (comments) {
                      handleReject(selectedRequest.id, comments)
                      setSelectedRequest(null)
                    }
                  }}
                >
                  Reject Request
                </Button>
                <Button
                  onClick={() => {
                    handleApprove(selectedRequest!.id)
                    setSelectedRequest(null)
                  }}
                >
                  Approve Request
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </div>
  )
}