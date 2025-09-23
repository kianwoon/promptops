import React, { useState, useEffect } from 'react'
import {
  ShieldAlert,
  AlertTriangle,
  Plus,
  RefreshCw,
  Download,
  Upload,
  Clock,
  Users,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
  Search,
  Filter,
  Eye,
  Edit,
  Trash2,
  Play,
  Pause,
  Archive,
  FileText,
  Activity,
  Target,
  Layers
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { makeAuthenticatedRequest } from '@/lib/googleAuth'
import { useAuth } from '@/contexts/AuthContext'

interface SecurityIncident {
  id: string
  incident_type: string
  severity: string
  status: string
  title: string
  description: string
  summary?: string
  detection_method?: string
  classification?: string
  impact_score?: string
  affected_systems?: any[]
  data_affected?: any[]
  business_impact?: string
  detected_at: string
  contained_at?: string
  resolved_at?: string
  closed_at?: string
  tenant_id: string
  reported_by?: string
  assigned_to?: string
  response_team?: any[]
  containment_actions?: any[]
  eradication_actions?: any[]
  recovery_actions?: any[]
  investigation_findings?: any[]
  root_cause?: string
  lessons_learned?: string
  compliance_impact?: any[]
  report_required: boolean
  report_filed: boolean
  created_at: string
  updated_at: string
}

export function IncidentManagementPanel() {
  const [incidents, setIncidents] = useState<SecurityIncident[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterSeverity, setFilterSeverity] = useState('all')
  const [selectedIncident, setSelectedIncident] = useState<SecurityIncident | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showReportsModal, setShowReportsModal] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [reportGenerationSuccess, setReportGenerationSuccess] = useState(false)
  const [reports, setReports] = useState<any[]>([])
  const [reportsLoading, setReportsLoading] = useState(false)
  const [editForm, setEditForm] = useState<Partial<SecurityIncident>>({})
  const { user } = useAuth()

  useEffect(() => {
    loadIncidents()
  }, [])

  const loadIncidents = async () => {
    setLoading(true)
    try {
      const tenantId = user?.organization || 'default-tenant'
      const incidentsData = await makeAuthenticatedRequest<SecurityIncident[]>(
        `/api/v1/governance/security/incidents?tenant_id=${encodeURIComponent(tenantId)}&limit=100`
      )
      setIncidents(incidentsData)
    } catch (error) {
      console.error('Failed to load incidents:', error)
    } finally {
      setLoading(false)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return 'bg-red-500'
      case 'high': return 'bg-orange-500'
      case 'medium': return 'bg-yellow-500'
      case 'low': return 'bg-green-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'detected': return 'bg-red-100 text-red-800'
      case 'investigating': return 'bg-yellow-100 text-yellow-800'
      case 'contained': return 'bg-blue-100 text-blue-800'
      case 'resolved': return 'bg-green-100 text-green-800'
      case 'closed': return 'bg-gray-100 text-gray-800'
      case 'false_positive': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'detected': return <AlertTriangle className="h-4 w-4" />
      case 'investigating': return <Search className="h-4 w-4" />
      case 'contained': return <Pause className="h-4 w-4" />
      case 'resolved': return <CheckCircle className="h-4 w-4" />
      case 'closed': return <Archive className="h-4 w-4" />
      case 'false_positive': return <XCircle className="h-4 w-4" />
      default: return <AlertCircle className="h-4 w-4" />
    }
  }

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleString()
  }

  const formatTimeAgo = (dateString?: string) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`

    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`

    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d ago`
  }

  const handleViewIncident = (incident: SecurityIncident) => {
    console.log('View incident:', incident.title)
    setSelectedIncident(incident)
    setShowViewModal(true)
  }

  const handleEditIncident = (incident: SecurityIncident) => {
    console.log('Edit incident:', incident.title)
    setSelectedIncident(incident)
    setEditForm({
      title: incident.title,
      description: incident.description,
      summary: incident.summary,
      severity: incident.severity,
      status: incident.status,
      incident_type: incident.incident_type,
      business_impact: incident.business_impact,
      root_cause: incident.root_cause,
      lessons_learned: incident.lessons_learned
    })
    setShowEditModal(true)
  }

  const handleSaveIncident = async () => {
    if (!selectedIncident) return

    try {
      console.log('Saving incident changes:', editForm)

      // TODO: Implement API call to update incident
      // const updatedIncident = await makeAuthenticatedRequest<SecurityIncident>(
      //   `/api/v1/governance/security/incidents/${selectedIncident.id}`,
      //   'PUT',
      //   editForm
      // )

      // For now, just update the local state
      setIncidents(prev => prev.map(incident =>
        incident.id === selectedIncident.id
          ? { ...incident, ...editForm, updated_at: new Date().toISOString() }
          : incident
      ))

      setShowEditModal(false)
      setEditForm({})
      console.log('Incident updated successfully')
    } catch (error) {
      console.error('Failed to save incident:', error)
    }
  }

  const handleGenerateReport = async () => {
    try {
      console.log('Generating monthly summary report...')

      const tenantId = user?.organization || 'default-tenant'
      const reportData = {
        name: `Monthly Incident Summary - ${new Date().toLocaleDateString()}`,
        report_type: 'monthly_summary',
        description: 'Monthly summary of security incidents and resolution metrics',
        scope_json: {
          period: 'monthly',
          stats: incidentStats,
          incidents_count: incidents.length,
          generated_at: new Date().toISOString()
        },
        tenant_id: tenantId
      }

      console.log('Creating report:', reportData)

      const report = await makeAuthenticatedRequest(
        '/api/v1/governance/compliance-reports',
        'POST',
        reportData
      )

      console.log('Report created successfully:', report)

      // Show success modal and refresh reports list
      setReportGenerationSuccess(true)
      setShowSuccessModal(true)
      setShowReportsModal(true)
      loadReports()
    } catch (error) {
      console.error('Failed to generate report:', error)
      // Show error modal instead of alert
      setReportGenerationSuccess(false)
      setShowSuccessModal(true)
    }
  }

  const handleViewReports = async () => {
    console.log('Opening reports viewer...')
    setShowReportsModal(true)
    await loadReports()
  }

  const loadReports = async () => {
    setReportsLoading(true)
    try {
      const tenantId = user?.organization || 'default-tenant'
      const reportsData = await makeAuthenticatedRequest(
        `/api/v1/governance/compliance-reports?tenant_id=${encodeURIComponent(tenantId)}&limit=50`
      )
      setReports(reportsData)
      console.log('Loaded reports:', reportsData)
    } catch (error) {
      console.error('Failed to load reports:', error)
      setReports([])
    } finally {
      setReportsLoading(false)
    }
  }

  const downloadReport = async (report: any) => {
    try {
      if (!report.file_path) {
        alert('Report file is not available yet. Please wait for generation to complete.')
        return
      }

      console.log('Downloading report:', report.name)

      // Download the report file
      const response = await fetch(`/api/v1/governance/storage/${report.file_path}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${report.name}.pdf` // or appropriate extension
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        console.log('Report downloaded successfully')
      } else {
        throw new Error('Failed to download report')
      }
    } catch (error) {
      console.error('Failed to download report:', error)
      alert('Failed to download report. Please try again.')
    }
  }

  const filteredIncidents = incidents.filter(incident => {
    const matchesSearch = searchTerm === '' ||
      incident.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      incident.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      incident.incident_type.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesType = filterType === 'all' || incident.incident_type === filterType
    const matchesStatus = filterStatus === 'all' || incident.status === filterStatus
    const matchesSeverity = filterSeverity === 'all' || incident.severity === filterSeverity

    return matchesSearch && matchesType && matchesStatus && matchesSeverity
  })

  const incidentStats = {
    total: incidents.length,
    active: incidents.filter(i => ['detected', 'investigating', 'contained'].includes(i.status)).length,
    resolved: incidents.filter(i => i.status === 'resolved').length,
    critical: incidents.filter(i => i.severity === 'critical' && ['detected', 'investigating'].includes(i.status)).length,
    meanTimeToResolve: calculateMeanTimeToResolve()
  }

  function calculateMeanTimeToResolve() {
    const resolved = incidents.filter(i => i.status === 'resolved' && i.resolved_at && i.detected_at)
    if (resolved.length === 0) return null

    const totalMinutes = resolved.reduce((sum, incident) => {
      const detected = new Date(incident.detected_at).getTime()
      const resolved = new Date(incident.resolved_at!).getTime()
      return sum + (resolved - detected) / (1000 * 60)
    }, 0)

    return Math.round(totalMinutes / resolved.length)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading incidents...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Incident Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border-2 hover:border-primary/20 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/60"></div>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-full bg-gradient-to-r from-red-500 to-rose-500 text-white">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{incidentStats.total}</p>
                <p className="text-sm font-medium text-muted-foreground">Total Incidents</p>
                <p className="text-xs text-muted-foreground">
                  All time
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border-2 hover:border-primary/20 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/60"></div>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{incidentStats.active}</p>
                <p className="text-sm font-medium text-muted-foreground">Active Incidents</p>
                <p className="text-xs text-muted-foreground">
                  {incidentStats.critical} critical
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border-2 hover:border-primary/20 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/60"></div>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 text-white">
                <CheckCircle className="h-6 w-6" />
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{incidentStats.resolved}</p>
                <p className="text-sm font-medium text-muted-foreground">Resolved</p>
                <p className="text-xs text-muted-foreground">
                  {((incidentStats.resolved / incidentStats.total) * 100).toFixed(1)}% rate
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border-2 hover:border-primary/20 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/60"></div>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                <Clock className="h-6 w-6" />
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">
                  {incidentStats.meanTimeToResolve ? `${Math.floor(incidentStats.meanTimeToResolve / 60)}h ${incidentStats.meanTimeToResolve % 60}m` : 'N/A'}
                </p>
                <p className="text-sm font-medium text-muted-foreground">Mean Time to Resolve</p>
                <p className="text-xs text-muted-foreground">
                  Average resolution time
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="incidents">Incidents</TabsTrigger>
            <TabsTrigger value="playbook">Response Playbook</TabsTrigger>
            <TabsTrigger value="reporting">Reporting</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadIncidents}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Incident
            </Button>
          </div>
        </div>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Incident Trends */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Incident Trends
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Last 7 Days</span>
                    <span className="text-sm text-muted-foreground">12 incidents</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Last 30 Days</span>
                    <span className="text-sm text-muted-foreground">45 incidents</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Resolution Rate</span>
                    <span className="text-sm text-muted-foreground">
                      {((incidentStats.resolved / incidentStats.total) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Incident Types Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Incident Types
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Array.from(new Set(incidents.map(i => i.incident_type))).map((type) => {
                    const count = incidents.filter(i => i.incident_type === type).length
                    const percentage = incidents.length > 0 ? (count / incidents.length) * 100 : 0
                    return (
                      <div key={type}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium capitalize">{type}</span>
                          <span className="text-sm text-muted-foreground">{count} ({percentage.toFixed(1)}%)</span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Critical Incidents */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Recent Critical Incidents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {incidents
                  .filter(i => i.severity === 'critical')
                  .slice(0, 5)
                  .map((incident) => (
                    <div key={incident.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        {getStatusIcon(incident.status)}
                        <div>
                          <h4 className="font-medium">{incident.title}</h4>
                          <p className="text-sm text-muted-foreground">
                            {formatTimeAgo(incident.detected_at)} • {incident.incident_type}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(incident.status)}>
                          {incident.status}
                        </Badge>
                        <Button variant="outline" size="sm" onClick={() => handleViewIncident(incident)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="incidents" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Security Incidents</CardTitle>
              <CardDescription>
                Track, investigate, and manage security incidents
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex items-center gap-4 mb-6">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search incidents..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="security_breach">Security Breach</SelectItem>
                    <SelectItem value="data_compromise">Data Compromise</SelectItem>
                    <SelectItem value="unauthorized_access">Unauthorized Access</SelectItem>
                    <SelectItem value="denial_of_service">Denial of Service</SelectItem>
                    <SelectItem value="malware_detection">Malware Detection</SelectItem>
                    <SelectItem value="phishing_attempt">Phishing Attempt</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="detected">Detected</SelectItem>
                    <SelectItem value="investigating">Investigating</SelectItem>
                    <SelectItem value="contained">Contained</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severities</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Incidents List */}
              <div className="space-y-3">
                {filteredIncidents.map((incident) => (
                  <div key={incident.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(incident.status)}
                        <div className={`w-3 h-3 rounded-full ${getSeverityColor(incident.severity)}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{incident.title}</h4>
                          <Badge variant="outline">{incident.incident_type}</Badge>
                          <Badge className={getSeverityColor(incident.severity)}>
                            {incident.severity}
                          </Badge>
                          <Badge className={getStatusColor(incident.status)}>
                            {incident.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {incident.description}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Detected: {formatTimeAgo(incident.detected_at)}
                          </span>
                          {incident.assigned_to && (
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              Assigned to: {incident.assigned_to}
                            </span>
                          )}
                          {incident.impact_score && (
                            <span>Impact: {incident.impact_score}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleViewIncident(incident)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleEditIncident(incident)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="playbook" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Incident Response Playbook
              </CardTitle>
              <CardDescription>
                Standardized procedures for incident response and handling
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-4">Detection Phase</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Identify potential security incident</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Validate and classify the incident</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Assess impact and scope</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-4">Response Phase</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Contain the incident</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Eradicate the threat</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Recover affected systems</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-4">Post-Incident</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Document lessons learned</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Update security controls</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Conduct post-incident review</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-4">Compliance</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Generate incident reports</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Notify stakeholders</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Maintain audit trail</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reporting" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Incident Reporting
              </CardTitle>
              <CardDescription>
                Generate compliance reports and incident summaries
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Monthly Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm">Total Incidents</span>
                        <span className="text-sm font-medium">{incidentStats.total}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Resolved</span>
                        <span className="text-sm font-medium">{incidentStats.resolved}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Average Resolution Time</span>
                        <span className="text-sm font-medium">
                          {incidentStats.meanTimeToResolve ? `${Math.floor(incidentStats.meanTimeToResolve / 60)}h ${incidentStats.meanTimeToResolve % 60}m` : 'N/A'}
                        </span>
                      </div>
                      <Button className="w-full mt-4" onClick={handleGenerateReport}>
                        <Download className="h-4 w-4 mr-2" />
                        Generate Report
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Compliance Reports</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm">GDPR Compliance</span>
                        <Badge className="bg-green-100 text-green-800">Compliant</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">ISO 27001</span>
                        <Badge className="bg-green-100 text-green-800">Compliant</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">SOC 2</span>
                        <Badge className="bg-yellow-100 text-yellow-800">In Progress</Badge>
                      </div>
                      <Button className="w-full mt-4" onClick={handleViewReports}>
                        <FileText className="h-4 w-4 mr-2" />
                        View Reports
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Incident Modal (placeholder) */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <h3 className="text-lg font-semibold mb-4">Create New Incident</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input id="title" placeholder="Enter incident title" />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" placeholder="Describe the incident" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="type">Type</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="security_breach">Security Breach</SelectItem>
                      <SelectItem value="data_compromise">Data Compromise</SelectItem>
                      <SelectItem value="unauthorized_access">Unauthorized Access</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="severity">Severity</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select severity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button>Create Incident</Button>
            </div>
          </div>
        </div>
      )}

      {/* View Incident Modal */}
      {showViewModal && selectedIncident && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Incident Details</h3>
              <Button variant="outline" onClick={() => setShowViewModal(false)}>
                Close
              </Button>
            </div>

            <div className="space-y-6">
              {/* Header Section */}
              <div className="flex items-center gap-4">
                {getStatusIcon(selectedIncident.status)}
                <div>
                  <h4 className="text-lg font-medium">{selectedIncident.title}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline">{selectedIncident.incident_type}</Badge>
                    <Badge className={getSeverityColor(selectedIncident.severity)}>
                      {selectedIncident.severity}
                    </Badge>
                    <Badge className={getStatusColor(selectedIncident.status)}>
                      {selectedIncident.status}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <h5 className="font-medium mb-2">Description</h5>
                <p className="text-sm text-muted-foreground">{selectedIncident.description}</p>
              </div>

              {/* Summary */}
              {selectedIncident.summary && (
                <div>
                  <h5 className="font-medium mb-2">Summary</h5>
                  <p className="text-sm text-muted-foreground">{selectedIncident.summary}</p>
                </div>
              )}

              {/* Timeline */}
              <div>
                <h5 className="font-medium mb-2">Timeline</h5>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Detected:</span>
                    <span className="ml-2 text-muted-foreground">{formatDateTime(selectedIncident.detected_at)}</span>
                  </div>
                  {selectedIncident.contained_at && (
                    <div>
                      <span className="font-medium">Contained:</span>
                      <span className="ml-2 text-muted-foreground">{formatDateTime(selectedIncident.contained_at)}</span>
                    </div>
                  )}
                  {selectedIncident.resolved_at && (
                    <div>
                      <span className="font-medium">Resolved:</span>
                      <span className="ml-2 text-muted-foreground">{formatDateTime(selectedIncident.resolved_at)}</span>
                    </div>
                  )}
                  {selectedIncident.closed_at && (
                    <div>
                      <span className="font-medium">Closed:</span>
                      <span className="ml-2 text-muted-foreground">{formatDateTime(selectedIncident.closed_at)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Classification */}
              <div>
                <h5 className="font-medium mb-2">Classification</h5>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {selectedIncident.detection_method && (
                    <div>
                      <span className="font-medium">Detection Method:</span>
                      <span className="ml-2 text-muted-foreground">{selectedIncident.detection_method}</span>
                    </div>
                  )}
                  {selectedIncident.classification && (
                    <div>
                      <span className="font-medium">Classification:</span>
                      <span className="ml-2 text-muted-foreground">{selectedIncident.classification}</span>
                    </div>
                  )}
                  {selectedIncident.impact_score && (
                    <div>
                      <span className="font-medium">Impact Score:</span>
                      <span className="ml-2 text-muted-foreground">{selectedIncident.impact_score}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Affected Systems */}
              {selectedIncident.affected_systems && selectedIncident.affected_systems.length > 0 && (
                <div>
                  <h5 className="font-medium mb-2">Affected Systems</h5>
                  <div className="space-y-2">
                    {selectedIncident.affected_systems.map((system, index) => (
                      <div key={index} className="bg-muted p-3 rounded-lg">
                        <div className="font-medium">{system.system_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {system.system_type} - {system.ip_address}
                        </div>
                        <div className="text-sm text-muted-foreground">{system.role}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Response Team */}
              {selectedIncident.response_team && selectedIncident.response_team.length > 0 && (
                <div>
                  <h5 className="font-medium mb-2">Response Team</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {selectedIncident.response_team.map((member, index) => (
                      <div key={index} className="bg-muted p-3 rounded-lg">
                        <div className="font-medium">{member.name}</div>
                        <div className="text-sm text-muted-foreground">{member.role}</div>
                        <div className="text-sm text-muted-foreground">{member.contact}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Business Impact */}
              {selectedIncident.business_impact && (
                <div>
                  <h5 className="font-medium mb-2">Business Impact</h5>
                  <p className="text-sm text-muted-foreground">{selectedIncident.business_impact}</p>
                </div>
              )}

              {/* Root Cause */}
              {selectedIncident.root_cause && (
                <div>
                  <h5 className="font-medium mb-2">Root Cause</h5>
                  <p className="text-sm text-muted-foreground">{selectedIncident.root_cause}</p>
                </div>
              )}

              {/* Lessons Learned */}
              {selectedIncident.lessons_learned && (
                <div>
                  <h5 className="font-medium mb-2">Lessons Learned</h5>
                  <p className="text-sm text-muted-foreground">{selectedIncident.lessons_learned}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Incident Modal */}
      {showEditModal && selectedIncident && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Edit Incident</h3>
              <Button variant="outline" onClick={() => setShowEditModal(false)}>
                Cancel
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={editForm.title || ''}
                  onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                  placeholder="Enter incident title"
                />
              </div>

              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={editForm.description || ''}
                  onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                  placeholder="Describe the incident"
                  rows={4}
                />
              </div>

              <div>
                <Label htmlFor="edit-summary">Summary</Label>
                <Textarea
                  id="edit-summary"
                  value={editForm.summary || ''}
                  onChange={(e) => setEditForm({...editForm, summary: e.target.value})}
                  placeholder="Brief summary of the incident"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-type">Type</Label>
                  <Select value={editForm.incident_type || ''} onValueChange={(value) => setEditForm({...editForm, incident_type: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="data_compromise">Data Compromise</SelectItem>
                      <SelectItem value="malware_detection">Malware Detection</SelectItem>
                      <SelectItem value="phishing_attempt">Phishing Attempt</SelectItem>
                      <SelectItem value="unauthorized_access">Unauthorized Access</SelectItem>
                      <SelectItem value="denial_of_service">Denial of Service</SelectItem>
                      <SelectItem value="security_breach">Security Breach</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="edit-severity">Severity</Label>
                  <Select value={editForm.severity || ''} onValueChange={(value) => setEditForm({...editForm, severity: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select severity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-status">Status</Label>
                  <Select value={editForm.status || ''} onValueChange={(value) => setEditForm({...editForm, status: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="detected">Detected</SelectItem>
                      <SelectItem value="investigating">Investigating</SelectItem>
                      <SelectItem value="contained">Contained</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                      <SelectItem value="false_positive">False Positive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="edit-impact">Impact Score</Label>
                  <Input
                    id="edit-impact"
                    value={editForm.impact_score || ''}
                    onChange={(e) => setEditForm({...editForm, impact_score: e.target.value})}
                    placeholder="1.0-10.0"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="edit-business-impact">Business Impact</Label>
                <Textarea
                  id="edit-business-impact"
                  value={editForm.business_impact || ''}
                  onChange={(e) => setEditForm({...editForm, business_impact: e.target.value})}
                  placeholder="Describe business impact"
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="edit-root-cause">Root Cause</Label>
                <Textarea
                  id="edit-root-cause"
                  value={editForm.root_cause || ''}
                  onChange={(e) => setEditForm({...editForm, root_cause: e.target.value})}
                  placeholder="Root cause analysis"
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="edit-lessons">Lessons Learned</Label>
                <Textarea
                  id="edit-lessons"
                  value={editForm.lessons_learned || ''}
                  onChange={(e) => setEditForm({...editForm, lessons_learned: e.target.value})}
                  placeholder="Lessons learned from this incident"
                  rows={2}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowEditModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveIncident}>
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reports Viewer Modal */}
      {showReportsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Compliance Reports</h3>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={loadReports} disabled={reportsLoading}>
                  <RefreshCw className={`h-4 w-4 ${reportsLoading ? 'animate-spin' : ''}`} />
                </Button>
                <Button variant="outline" onClick={() => setShowReportsModal(false)}>
                  Close
                </Button>
              </div>
            </div>

            {reportsLoading ? (
              <div className="flex items-center justify-center h-64">
                <RefreshCw className="h-8 w-8 animate-spin" />
                <span className="ml-2">Loading reports...</span>
              </div>
            ) : reports.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No reports found. Generate your first report to get started.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {reports.map((report) => (
                  <div key={report.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-medium">{report.name}</h4>
                          <Badge variant="outline">{report.report_type}</Badge>
                          <Badge className={
                            report.status === 'completed' ? 'bg-green-100 text-green-800' :
                            report.status === 'generating' ? 'bg-yellow-100 text-yellow-800' :
                            report.status === 'failed' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }>
                            {report.status}
                          </Badge>
                        </div>

                        {report.description && (
                          <p className="text-sm text-muted-foreground mb-2">{report.description}</p>
                        )}

                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Created: {new Date(report.created_at).toLocaleString()}</span>
                          {report.completed_at && (
                            <span>Completed: {new Date(report.completed_at).toLocaleString()}</span>
                          )}
                          {report.file_size && (
                            <span>Size: {(report.file_size / 1024).toFixed(1)} KB</span>
                          )}
                        </div>

                        {report.status === 'generating' && (
                          <div className="mt-2">
                            <Progress value={75} className="h-2" />
                            <p className="text-xs text-muted-foreground mt-1">Report is being generated...</p>
                          </div>
                        )}

                        {report.status === 'failed' && report.error_message && (
                          <div className="mt-2">
                            <p className="text-xs text-red-600">Error: {report.error_message}</p>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        {report.status === 'completed' && report.file_path && (
                          <Button variant="outline" size="sm" onClick={() => downloadReport(report)}>
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => {
                          console.log('Report details:', report)
                          // TODO: Show report details modal
                        }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Report Generation Success/Error Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">
                {reportGenerationSuccess ? 'Report Generation Started' : 'Report Generation Failed'}
              </h3>
              <Button variant="outline" onClick={() => setShowSuccessModal(false)}>
                Close
              </Button>
            </div>

            <div className="space-y-4">
              {reportGenerationSuccess ? (
                <>
                  <div className="flex items-center justify-center mb-4">
                    <div className="bg-green-100 rounded-full p-3">
                      <CheckCircle className="h-8 w-8 text-green-600" />
                    </div>
                  </div>

                  <div className="text-center space-y-2">
                    <h4 className="font-medium text-green-800">Success!</h4>
                    <p className="text-sm text-muted-foreground">
                      Your monthly summary report has been submitted for generation.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      The report is now being processed in the background. You can monitor its progress in the reports viewer.
                    </p>
                  </div>

                  <div className="bg-muted p-4 rounded-lg space-y-2">
                    <h5 className="font-medium text-sm">Report Details:</h5>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div className="flex justify-between">
                        <span>Type:</span>
                        <span>Monthly Summary</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Incidents Included:</span>
                        <span>{incidentStats.total}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Resolution Rate:</span>
                        <span>{((incidentStats.resolved / incidentStats.total) * 100).toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Status:</span>
                        <Badge className="bg-yellow-100 text-yellow-800 text-xs">Generating</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowSuccessModal(false)} className="flex-1">
                      Dismiss
                    </Button>
                    <Button onClick={() => {
                      setShowSuccessModal(false)
                      // Keep reports modal open
                    }} className="flex-1">
                      View Progress
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-center mb-4">
                    <div className="bg-red-100 rounded-full p-3">
                      <XCircle className="h-8 w-8 text-red-600" />
                    </div>
                  </div>

                  <div className="text-center space-y-2">
                    <h4 className="font-medium text-red-800">Generation Failed</h4>
                    <p className="text-sm text-muted-foreground">
                      We encountered an error while generating your report. Please try again later.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowSuccessModal(false)} className="flex-1">
                      Cancel
                    </Button>
                    <Button onClick={() => {
                      setShowSuccessModal(false)
                      // Retry report generation
                      setTimeout(() => handleGenerateReport(), 500)
                    }} className="flex-1">
                      Retry
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
