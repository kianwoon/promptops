import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CheckCircle, XCircle, Clock, Users, TrendingUp, AlertTriangle,
  Search, Filter, Download, RefreshCw, Eye, ThumbsUp, ThumbsDown
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface WorkflowInstance {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected' | 'cancelled' | 'error';
  resourceType: string;
  resourceId: string;
  initiatedBy: string;
  currentStep: number;
  totalSteps: number;
  context: Record<string, any>;
  approvers?: string[];
  currentAssignee?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  errorMessage?: string;
}

interface WorkflowMetrics {
  id: string;
  workflowDefinitionId: string;
  tenantId: string;
  totalDurationMinutes?: number;
  stepDurationMinutes?: Record<string, number>;
  approvalTimeMinutes?: number;
  escalationCount: number;
  successRate?: string;
  completionRate?: string;
  timeoutCount: number;
  slaMet?: boolean;
  slaBreachMinutes?: number;
  averageStepsCompleted?: string;
  averageApprovalsPerWorkflow?: string;
  userSatisfactionScore?: string;
  metricDate: string;
  isAggregated: boolean;
}

interface WorkflowStepExecution {
  id: string;
  workflowInstanceId: string;
  stepNumber: number;
  stepType: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed' | 'cancelled';
  approvers?: string[];
  approvalsReceived?: Array<{ userId: string; timestamp: string; comments?: string }>;
  rejectionsReceived?: Array<{ userId: string; timestamp: string; comments?: string }>;
  startedAt?: string;
  completedAt?: string;
  dueDate?: string;
  executedBy?: string;
  executionTimeMs?: number;
}

interface ApprovalDashboardProps {
  onRefresh?: () => void;
  onExport?: (format: 'csv' | 'xlsx') => void;
}

const statusConfig = {
  pending: { label: 'Pending', color: 'secondary', icon: Clock },
  in_progress: { label: 'In Progress', color: 'default', icon: Clock },
  completed: { label: 'Completed', color: 'default', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'destructive', icon: XCircle },
  cancelled: { label: 'Cancelled', color: 'secondary', icon: XCircle },
  error: { label: 'Error', color: 'destructive', icon: AlertTriangle },
};

export const ApprovalDashboard: React.FC<ApprovalDashboardProps> = ({
  onRefresh = () => {},
  onExport = () => {},
}) => {
  const [instances, setInstances] = useState<WorkflowInstance[]>([]);
  const [metrics, setMetrics] = useState<WorkflowMetrics[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    status: '',
    resourceType: '',
    search: '',
    assignee: '',
    dateRange: '7d',
  });
  const [loading, setLoading] = useState(false);

  // Mock data for demonstration
  const mockInstances: WorkflowInstance[] = [
    {
      id: '1',
      title: 'Prompt Review: Customer Service Chatbot',
      description: 'Review and approve new customer service chatbot prompt',
      status: 'in_progress',
      resourceType: 'prompt',
      resourceId: 'prompt-123',
      initiatedBy: 'john.doe@company.com',
      currentStep: 2,
      totalSteps: 3,
      approvers: ['alice.smith@company.com', 'bob.johnson@company.com'],
      currentAssignee: 'alice.smith@company.com',
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      context: {
        promptType: 'customer_service',
        riskLevel: 'medium',
        priority: 'high',
      },
    },
    {
      id: '2',
      title: 'API Key Access Request',
      description: 'Request for API key access to production environment',
      status: 'pending',
      resourceType: 'api_key',
      resourceId: 'api-456',
      initiatedBy: 'jane.wilson@company.com',
      currentStep: 1,
      totalSteps: 2,
      approvers: ['security-team@company.com'],
      currentAssignee: 'security-team@company.com',
      dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      context: {
        environment: 'production',
        accessLevel: 'read_write',
        justification: 'Production monitoring and debugging',
      },
    },
    {
      id: '3',
      title: 'User Role Change Request',
      description: 'Change user role from viewer to admin for new team member',
      status: 'completed',
      resourceType: 'user',
      resourceId: 'user-789',
      initiatedBy: 'mike.brown@company.com',
      currentStep: 2,
      totalSteps: 2,
      approvers: ['hr-team@company.com', 'it-admin@company.com'],
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      completedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      context: {
        currentRole: 'viewer',
        requestedRole: 'admin',
        department: 'engineering',
      },
    },
  ];

  const mockMetrics: WorkflowMetrics[] = [
    {
      id: '1',
      workflowDefinitionId: 'prompt-approval',
      tenantId: 'tenant-1',
      totalDurationMinutes: 1440,
      stepDurationMinutes: { '1': 120, '2': 960, '3': 360 },
      approvalTimeMinutes: 480,
      escalationCount: 2,
      successRate: '95%',
      completionRate: '92%',
      timeoutCount: 3,
      slaMet: true,
      averageStepsCompleted: '2.8',
      averageApprovalsPerWorkflow: '2.1',
      userSatisfactionScore: '4.2/5',
      metricDate: new Date().toISOString(),
      isAggregated: false,
    },
  ];

  const filteredInstances = useMemo(() => {
    return mockInstances.filter(instance => {
      const matchesStatus = filters.status === "all" || !filters.status || instance.status === filters.status;
      const matchesResourceType = filters.resourceType === "all" || !filters.resourceType || instance.resourceType === filters.resourceType;
      const matchesSearch = !filters.search ||
        instance.title.toLowerCase().includes(filters.search.toLowerCase()) ||
        instance.description?.toLowerCase().includes(filters.search.toLowerCase());
      const matchesAssignee = !filters.assignee ||
        instance.currentAssignee?.toLowerCase().includes(filters.assignee.toLowerCase());

      return matchesStatus && matchesResourceType && matchesSearch && matchesAssignee;
    });
  }, [filters]);

  const selectedInstanceData = useMemo(() => {
    return mockInstances.find(instance => instance.id === selectedInstance);
  }, [selectedInstance, mockInstances]);

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status as keyof typeof statusConfig];
    if (!config) return <Badge variant="secondary">{status}</Badge>;

    const Icon = config.icon;
    return (
      <Badge variant={config.color as any} className="flex items-center space-x-1">
        <Icon className="h-3 w-3" />
        <span>{config.label}</span>
      </Badge>
    );
  };

  const handleApprove = useCallback(async (instanceId: string) => {
    setLoading(true);
    try {
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setInstances(prev =>
        prev.map(instance =>
          instance.id === instanceId
            ? { ...instance, status: 'completed' as const, completedAt: new Date().toISOString() }
            : instance
        )
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const handleReject = useCallback(async (instanceId: string) => {
    setLoading(true);
    try {
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setInstances(prev =>
        prev.map(instance =>
          instance.id === instanceId
            ? { ...instance, status: 'rejected' as const, completedAt: new Date().toISOString() }
            : instance
        )
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const calculateStats = useCallback(() => {
    const stats = {
      total: mockInstances.length,
      pending: mockInstances.filter(i => i.status === 'pending').length,
      inProgress: mockInstances.filter(i => i.status === 'in_progress').length,
      completed: mockInstances.filter(i => i.status === 'completed').length,
      rejected: mockInstances.filter(i => i.status === 'rejected').length,
      avgCompletionTime: mockMetrics.reduce((acc, m) => acc + (m.totalDurationMinutes || 0), 0) / mockMetrics.length,
      slaCompliance: (mockMetrics.filter(m => m.slaMet).length / mockMetrics.length) * 100,
    };

    return stats;
  }, [mockInstances, mockMetrics]);

  const stats = calculateStats();

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Approval Dashboard</h1>
          <p className="text-gray-600">Manage and monitor approval workflows</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => onRefresh?.()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Select onValueChange={(value) => onExport?.(value as 'csv' | 'xlsx')}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Export" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">Export CSV</SelectItem>
              <SelectItem value="xlsx">Export XLSX</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Workflows</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg. Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(stats.avgCompletionTime / 60)}h</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">SLA Compliance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.slaCompliance.toFixed(1)}%</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="workflows" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="workflows">Active Workflows</TabsTrigger>
          <TabsTrigger value="metrics">Performance Metrics</TabsTrigger>
          <TabsTrigger value="approvals">My Approvals</TabsTrigger>
        </TabsList>

        <TabsContent value="workflows" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Filter className="h-4 w-4" />
                <span>Filters</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div>
                  <Label htmlFor="status-filter">Status</Label>
                  <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      {Object.entries(statusConfig).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="resource-filter">Resource Type</Label>
                  <Select value={filters.resourceType} onValueChange={(value) => setFilters(prev => ({ ...prev, resourceType: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="prompt">Prompt</SelectItem>
                      <SelectItem value="api_key">API Key</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="template">Template</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="assignee-filter">Assignee</Label>
                  <Input
                    id="assignee-filter"
                    placeholder="Filter by assignee"
                    value={filters.assignee}
                    onChange={(e) => setFilters(prev => ({ ...prev, assignee: e.target.value }))}
                  />
                </div>

                <div>
                  <Label htmlFor="search-filter">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      id="search-filter"
                      placeholder="Search workflows..."
                      value={filters.search}
                      onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                      className="pl-8"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="date-filter">Date Range</Label>
                  <Select value={filters.dateRange} onValueChange={(value) => setFilters(prev => ({ ...prev, dateRange: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1d">Last 24 hours</SelectItem>
                      <SelectItem value="7d">Last 7 days</SelectItem>
                      <SelectItem value="30d">Last 30 days</SelectItem>
                      <SelectItem value="90d">Last 90 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Workflow Instances Table */}
          <Card>
            <CardHeader>
              <CardTitle>Workflow Instances</CardTitle>
              <CardDescription>
                {filteredInstances.length} workflow{filteredInstances.length !== 1 ? 's' : ''} found
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Assignee</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInstances.map(instance => (
                    <TableRow
                      key={instance.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => setSelectedInstance(instance.id)}
                    >
                      <TableCell>
                        <div>
                          <div className="font-medium">{instance.title}</div>
                          <div className="text-sm text-gray-500">
                            {instance.resourceType} • {formatDistanceToNow(new Date(instance.createdAt), { addSuffix: true })}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(instance.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Progress value={(instance.currentStep / instance.totalSteps) * 100} className="w-16" />
                          <span className="text-sm text-gray-600">
                            {instance.currentStep}/{instance.totalSteps}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <Users className="h-4 w-4 text-gray-400" />
                          <span className="text-sm">
                            {instance.currentAssignee || 'Unassigned'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {instance.dueDate ? (
                          <div className="text-sm">
                            {formatDistanceToNow(new Date(instance.dueDate), { addSuffix: true })}
                          </div>
                        ) : (
                          <span className="text-gray-400">No due date</span>
                        )}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex space-x-1">
                          {instance.status === 'in_progress' && instance.currentAssignee === 'current-user@example.com' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleApprove(instance.id)}
                                disabled={loading}
                              >
                                <ThumbsUp className="h-3 w-3 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleReject(instance.id)}
                                disabled={loading}
                              >
                                <ThumbsDown className="h-3 w-3 mr-1" />
                                Reject
                              </Button>
                            </>
                          )}
                          <Button size="sm" variant="ghost">
                            <Eye className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {filteredInstances.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No workflow instances found matching your filters.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="h-4 w-4" />
                  <span>Performance Metrics</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockMetrics.map(metric => (
                    <div key={metric.id} className="border-b pb-4 last:border-b-0">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <Label className="text-gray-600">Success Rate</Label>
                          <div className="font-medium">{metric.successRate}</div>
                        </div>
                        <div>
                          <Label className="text-gray-600">Completion Rate</Label>
                          <div className="font-medium">{metric.completionRate}</div>
                        </div>
                        <div>
                          <Label className="text-gray-600">Avg. Approval Time</Label>
                          <div className="font-medium">{Math.round(metric.approvalTimeMinutes! / 60)}h</div>
                        </div>
                        <div>
                          <Label className="text-gray-600">Escalations</Label>
                          <div className="font-medium">{metric.escalationCount}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>SLA Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockMetrics.map(metric => (
                    <div key={metric.id} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">SLA Status</span>
                        <Badge variant={metric.slaMet ? 'default' : 'destructive'}>
                          {metric.slaMet ? 'Met' : 'Breached'}
                        </Badge>
                      </div>
                      {metric.slaBreachMinutes && (
                        <div className="text-sm text-red-600">
                          SLA breached by {Math.round(metric.slaBreachMinutes / 60)} hours
                        </div>
                      )}
                      <div className="text-sm text-gray-600">
                        User Satisfaction: {metric.userSatisfactionScore}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="approvals" className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This section shows workflows that require your approval. Configure your user settings to see relevant items.
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>

      {/* Instance Detail Modal */}
      {selectedInstanceData && (
        <Card>
          <CardHeader>
            <CardTitle>Workflow Details: {selectedInstanceData.title}</CardTitle>
            <CardDescription>{selectedInstanceData.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-600">Status</Label>
                <div>{getStatusBadge(selectedInstanceData.status)}</div>
              </div>
              <div>
                <Label className="text-gray-600">Resource</Label>
                <div>{selectedInstanceData.resourceType}:{selectedInstanceData.resourceId}</div>
              </div>
              <div>
                <Label className="text-gray-600">Initiated By</Label>
                <div>{selectedInstanceData.initiatedBy}</div>
              </div>
              <div>
                <Label className="text-gray-600">Created</Label>
                <div>{formatDistanceToNow(new Date(selectedInstanceData.createdAt), { addSuffix: true })}</div>
              </div>
              <div>
                <Label className="text-gray-600">Approvers</Label>
                <div>{selectedInstanceData.approvers?.join(', ') || 'No approvers assigned'}</div>
              </div>
              <div>
                <Label className="text-gray-600">Progress</Label>
                <div className="flex items-center space-x-2">
                  <Progress value={(selectedInstanceData.currentStep / selectedInstanceData.totalSteps) * 100} className="w-24" />
                  <span>{selectedInstanceData.currentStep}/{selectedInstanceData.totalSteps} steps</span>
                </div>
              </div>
            </div>

            {Object.keys(selectedInstanceData.context).length > 0 && (
              <div className="mt-4">
                <Label className="text-gray-600">Context</Label>
                <div className="mt-2 p-3 bg-gray-50 rounded text-sm">
                  {Object.entries(selectedInstanceData.context).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="font-medium">{key}:</span>
                      <span>{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};