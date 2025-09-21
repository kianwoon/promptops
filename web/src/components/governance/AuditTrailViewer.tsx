import React, { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Calendar,
  Download,
  Eye,
  Filter,
  Search,
  RefreshCw,
  BarChart3,
  Users,
  AlertTriangle,
  Clock,
  FileText,
  Activity,
  Hash,
  Globe,
  Shield,
  ChevronDown,
  ChevronUp,
  Info,
  Copy,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react'
import {
  AuditLog,
  AuditLogFilter,
  AuditLogStats,
  AuditLogExportRequest,
  AuditLogExportResponse,
  AUDIT_ACTIONS,
  SUBJECT_TYPES,
  RESULT_TYPES
} from '@/types/governance'
import { formatDate, formatRelativeTime } from '@/lib/utils'
import { useUsers } from '@/hooks/api'
import { User } from '@/types/api'

interface AuditTrailViewerProps {
  initialLogs?: AuditLog[]
  onFetchLogs: (filters: AuditLogFilter) => Promise<AuditLog[]>
  onFetchStats: (startDate?: string, endDate?: string) => Promise<AuditLogStats>
  onExportLogs: (request: AuditLogExportRequest) => Promise<AuditLogExportResponse>
  onGetLogDetails: (logId: string) => Promise<AuditLog>
}

export function AuditTrailViewer({
  initialLogs = [],
  onFetchLogs,
  onFetchStats,
  onExportLogs,
  onGetLogDetails
}: AuditTrailViewerProps) {
  const [logs, setLogs] = useState<AuditLog[]>(initialLogs)
  const [stats, setStats] = useState<AuditLogStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [statsLoading, setStatsLoading] = useState(false)
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set())

  // Users data for actor name resolution
  const { data: users = [] } = useUsers()

  // Create user ID to name mapping
  const userMap = useMemo(() => {
    const map: Record<string, string> = {}
    users.forEach((user: User) => {
      map[user.id] = user.name
    })
    return map
  }, [users])

  // Helper function to get actor display name
  const getActorDisplayName = (actorId: string) => {
    return userMap[actorId] || actorId // Fallback to ID if name not found
  }

  // Filter states
  const [filters, setFilters] = useState<AuditLogFilter>({
    skip: 0,
    limit: 50
  })

  // Export dialog state
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [exportRequest, setExportRequest] = useState<AuditLogExportRequest>({
    filters: { ...filters },
    format: 'json',
    include_metadata: true,
    include_changes: true
  })

  // Date range for stats
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  })

  // Load initial data
  useEffect(() => {
    loadLogs()
    loadStats()
  }, [])

  const loadLogs = async () => {
    setLoading(true)
    try {
      const result = await onFetchLogs(filters)
      setLogs(result)
    } catch (error) {
      console.error('Error loading audit logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    setStatsLoading(true)
    try {
      const result = await onFetchStats(
        dateRange.start || undefined,
        dateRange.end || undefined
      )
      setStats(result)
    } catch (error) {
      console.error('Error loading audit stats:', error)
    } finally {
      setStatsLoading(false)
    }
  }

  const handleFilterChange = (key: keyof AuditLogFilter, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const applyFilters = () => {
    setFilters(prev => ({ ...prev, skip: 0 }))
    loadLogs()
  }

  const clearFilters = () => {
    setFilters({ skip: 0, limit: 50 })
    loadLogs()
  }

  const handleExport = async () => {
    try {
      const request = {
        ...exportRequest,
        filters: { ...filters }
      }
      const result = await onExportLogs(request)
      setExportDialogOpen(false)

      // In a real app, you'd handle the download
      console.log('Export started:', result)
    } catch (error) {
      console.error('Error exporting logs:', error)
    }
  }

  const toggleLogExpansion = (logId: string) => {
    const newExpanded = new Set(expandedLogs)
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId)
    } else {
      newExpanded.add(logId)
    }
    setExpandedLogs(newExpanded)
  }

  const getActionIcon = (action: string) => {
    if (action.includes('create')) return <CheckCircle className="h-4 w-4 text-green-500" />
    if (action.includes('update') || action.includes('edit')) return <Activity className="h-4 w-4 text-blue-500" />
    if (action.includes('delete') || action.includes('revoke')) return <XCircle className="h-4 w-4 text-red-500" />
    if (action.includes('login')) return <Users className="h-4 w-4 text-purple-500" />
    if (action.includes('logout')) return <Users className="h-4 w-4 text-gray-500" />
    return <FileText className="h-4 w-4 text-gray-500" />
  }

  const getResultBadge = (result?: string) => {
    if (!result) return <Badge variant="secondary">Unknown</Badge>

    switch (result.toLowerCase()) {
      case 'success':
        return <Badge variant="default" className="bg-green-500">Success</Badge>
      case 'failure':
        return <Badge variant="destructive">Failure</Badge>
      case 'error':
        return <Badge variant="destructive">Error</Badge>
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>
      default:
        return <Badge variant="secondary">{result}</Badge>
    }
  }

  const formatChanges = (changes?: Record<string, any>) => {
    if (!changes || Object.keys(changes).length === 0) return null

    return (
      <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
        <div className="font-medium mb-1">Changes:</div>
        {Object.entries(changes).map(([key, value]) => (
          <div key={key} className="flex justify-between">
            <span className="font-mono text-xs">{key}:</span>
            <span className="font-mono text-xs">{JSON.stringify(value)}</span>
          </div>
        ))}
      </div>
    )
  }

  const formatMetadata = (metadata?: Record<string, any>) => {
    if (!metadata || Object.keys(metadata).length === 0) return null

    return (
      <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
        <div className="font-medium mb-1">Metadata:</div>
        {Object.entries(metadata).map(([key, value]) => (
          <div key={key} className="flex justify-between">
            <span className="font-mono text-xs">{key}:</span>
            <span className="font-mono text-xs">{JSON.stringify(value)}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          {/* Header removed - already shown in parent tab */}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setExportDialogOpen(true)}
            disabled={logs.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={loadLogs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Activity className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.total_events.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Total Events</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Users className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{Object.keys(stats.events_by_actor).length}</p>
                  <p className="text-sm text-muted-foreground">Active Users</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <AlertTriangle className="h-8 w-8 text-red-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.recent_errors.length}</p>
                  <p className="text-sm text-muted-foreground">Recent Errors</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Clock className="h-8 w-8 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold">{Object.keys(stats.events_by_date).length}</p>
                  <p className="text-sm text-muted-foreground">Days Active</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        {showFilters && (
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="actor">Actor</Label>
                <Input
                  id="actor"
                  placeholder="Filter by actor..."
                  value={filters.actor || ''}
                  onChange={(e) => handleFilterChange('actor', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="action">Action</Label>
                <Select
                  value={filters.action || ''}
                  onValueChange={(value) => handleFilterChange('action', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select action..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Actions</SelectItem>
                    {Object.values(AUDIT_ACTIONS).map((action) => (
                      <SelectItem key={action} value={action}>
                        {action.replace(/_/g, ' ').toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="subject_type">Subject Type</Label>
                <Select
                  value={filters.subject_type || ''}
                  onValueChange={(value) => handleFilterChange('subject_type', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Types</SelectItem>
                    {Object.values(SUBJECT_TYPES).map((type) => (
                      <SelectItem key={type} value={type}>
                        {type.replace(/_/g, ' ').toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="result">Result</Label>
                <Select
                  value={filters.result || ''}
                  onValueChange={(value) => handleFilterChange('result', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select result..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Results</SelectItem>
                    {Object.values(RESULT_TYPES).map((result) => (
                      <SelectItem key={result} value={result}>
                        {result.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="datetime-local"
                  value={filters.start_date || ''}
                  onChange={(e) => handleFilterChange('start_date', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="end_date">End Date</Label>
                <Input
                  id="end_date"
                  type="datetime-local"
                  value={filters.end_date || ''}
                  onChange={(e) => handleFilterChange('end_date', e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={applyFilters} disabled={loading}>
                <Search className="h-4 w-4 mr-2" />
                Apply Filters
              </Button>
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Audit Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Audit Logs
          </CardTitle>
          <CardDescription>
            Detailed audit trail of all system activities
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading audit logs...</span>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]"></TableHead>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <React.Fragment key={log.id}>
                        <TableRow className="cursor-pointer hover:bg-gray-50">
                          <TableCell>
                            {getActionIcon(log.action)}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {formatDate(log.ts)}
                          </TableCell>
                          <TableCell className="font-medium">{getActorDisplayName(log.actor)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{log.action.replace(/_/g, ' ')}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div className="font-medium">{log.subject_type.replace(/_/g, ' ')}</div>
                              <div className="text-muted-foreground font-mono text-xs">{log.subject_id}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {getResultBadge(log.result)}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {log.ip_address || '-'}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleLogExpansion(log.id)}
                            >
                              {expandedLogs.has(log.id) ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                        {expandedLogs.has(log.id) && (
                          <TableRow>
                            <TableCell colSpan={8} className="p-4 bg-gray-50">
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <Label className="font-medium">Session ID:</Label>
                                    <div className="font-mono text-xs">{log.session_id || 'N/A'}</div>
                                  </div>
                                  <div>
                                    <Label className="font-medium">Request ID:</Label>
                                    <div className="font-mono text-xs">{log.request_id || 'N/A'}</div>
                                  </div>
                                  <div>
                                    <Label className="font-medium">User Agent:</Label>
                                    <div className="text-xs break-all">{log.user_agent || 'N/A'}</div>
                                  </div>
                                  <div>
                                    <Label className="font-medium">Error Message:</Label>
                                    <div className="text-xs text-red-600">{log.error_message || 'None'}</div>
                                  </div>
                                </div>
                                {formatChanges(log.changes_json)}
                                {formatMetadata(log.metadata_json)}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {logs.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No audit logs found matching your filters
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Export Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Export Audit Logs</DialogTitle>
            <DialogDescription>
              Export audit logs with current filters applied
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="format">Format</Label>
              <Select
                value={exportRequest.format}
                onValueChange={(value) => setExportRequest(prev => ({
                  ...prev,
                  format: value as 'json' | 'csv' | 'xlsx'
                }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="xlsx">Excel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="include_metadata"
                checked={exportRequest.include_metadata}
                onChange={(e) => setExportRequest(prev => ({
                  ...prev,
                  include_metadata: e.target.checked
                }))}
              />
              <Label htmlFor="include_metadata">Include metadata</Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="include_changes"
                checked={exportRequest.include_changes}
                onChange={(e) => setExportRequest(prev => ({
                  ...prev,
                  include_changes: e.target.checked
                }))}
              />
              <Label htmlFor="include_changes">Include change details</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}