import React from 'react'
import {
  Shield,
  Users,
  Key,
  Eye,
  CheckCircle,
  FileText,
  Activity,
  History,
  GitBranch,
  LayoutDashboard,
  AlertTriangle,
  Fingerprint,
  BarChart3,
  ShieldAlert,
  Network,
  TrendingUp
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PermissionMatrix } from '@/components/governance/PermissionMatrix'
import { UserRoleAssignmentComponent } from '@/components/governance/UserRoleAssignment'
import { AccessReviewDashboard } from '@/components/governance/AccessReviewDashboard'
import { PermissionTemplates } from '@/components/governance/PermissionTemplates'
import { AuditTrailViewer } from '@/components/governance/AuditTrailViewer'
import { WorkflowDesigner } from '@/components/governance/WorkflowDesigner'
import { ApprovalDashboard } from '@/components/governance/ApprovalDashboard'
import { SecurityMonitoringDashboard } from '@/components/governance/SecurityMonitoringDashboard'
import { ThreatIntelligencePanel } from '@/components/governance/ThreatIntelligencePanel'
import { IncidentManagementPanel } from '@/components/governance/IncidentManagementPanel'
import { AnomalyDetectionPanel } from '@/components/governance/AnomalyDetectionPanel'
import {
  AuditLog,
  AuditLogFilter,
  AuditLogStats,
  AuditLogExportRequest,
  AuditLogExportResponse
} from '@/types/governance'

export function Governance() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Governance</h1>
        <p className="text-muted-foreground">
          Manage access controls, policies, and compliance
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Shield className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">RBAC</p>
                <p className="text-sm text-muted-foreground">Role Management</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Users className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">Users</p>
                <p className="text-sm text-muted-foreground">Role Assignment</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Key className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">Matrix</p>
                <p className="text-sm text-muted-foreground">Permission Matrix</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Eye className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">Reviews</p>
                <p className="text-sm text-muted-foreground">Access Reviews</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <FileText className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">Templates</p>
                <p className="text-sm text-muted-foreground">Permission Templates</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <History className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-2xl font-bold">Audit</p>
                <p className="text-sm text-muted-foreground">Audit Trail</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <GitBranch className="h-8 w-8 text-cyan-500" />
              <div>
                <p className="text-2xl font-bold">Workflows</p>
                <p className="text-sm text-muted-foreground">Approval Workflows</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <LayoutDashboard className="h-8 w-8 text-indigo-500" />
              <div>
                <p className="text-2xl font-bold">Approvals</p>
                <p className="text-sm text-muted-foreground">Approval Dashboard</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <AlertTriangle className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-2xl font-bold">Security</p>
                <p className="text-sm text-muted-foreground">Monitoring Dashboard</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Fingerprint className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">Threat</p>
                <p className="text-sm text-muted-foreground">Intelligence</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <ShieldAlert className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">Incidents</p>
                <p className="text-sm text-muted-foreground">Management</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <TrendingUp className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">Anomaly</p>
                <p className="text-sm text-muted-foreground">Detection</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Governance Tabs */}
      <Tabs defaultValue="matrix" className="space-y-6">
        <TabsList className="grid w-full grid-cols-11">
          <TabsTrigger value="matrix" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Matrix
          </TabsTrigger>
          <TabsTrigger value="assignments" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Assignments
          </TabsTrigger>
          <TabsTrigger value="reviews" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Reviews
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Audit Trail
          </TabsTrigger>
          <TabsTrigger value="workflows" className="flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            Workflows
          </TabsTrigger>
          <TabsTrigger value="approvals" className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Approvals
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="threat-intel" className="flex items-center gap-2">
            <Fingerprint className="h-4 w-4" />
            Threat Intel
          </TabsTrigger>
          <TabsTrigger value="incidents" className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            Incidents
          </TabsTrigger>
        </TabsList>

        {/* Permission Matrix Tab */}
        <TabsContent value="matrix" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Permission Matrix
              </CardTitle>
              <CardDescription>
                Visual matrix showing permissions across all roles and resources
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PermissionMatrix />
            </CardContent>
          </Card>
        </TabsContent>

        {/* User Role Assignment Tab */}
        <TabsContent value="assignments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                User Role Assignment
              </CardTitle>
              <CardDescription>
                Assign roles to users with resource-specific permissions and conditions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UserRoleAssignmentComponent />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Access Review Tab */}
        <TabsContent value="reviews" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Access Review Dashboard
              </CardTitle>
              <CardDescription>
                Monitor and manage access reviews, compliance, and security findings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AccessReviewDashboard />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Permission Templates Tab */}
        <TabsContent value="templates" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Permission Templates
              </CardTitle>
              <CardDescription>
                Create and manage permission templates for common scenarios and apply them to roles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PermissionTemplates />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Trail Tab */}
        <TabsContent value="audit" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Audit Trail Viewer
              </CardTitle>
              <CardDescription>
                Monitor and analyze system activities, security events, and compliance activities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AuditTrailViewer
                onFetchLogs={async (filters: AuditLogFilter) => {
                  // Mock API call - replace with real implementation
                  const params = new URLSearchParams()
                  Object.entries(filters).forEach(([key, value]) => {
                    if (value !== undefined && value !== null) {
                      params.append(key, value.toString())
                    }
                  })
                  const response = await fetch(`/v1/governance/audit-logs?${params}`)
                  if (!response.ok) throw new Error('Failed to fetch audit logs')
                  return response.json()
                }}
                onFetchStats={async (startDate?: string, endDate?: string) => {
                  // Mock API call - replace with real implementation
                  const params = new URLSearchParams()
                  if (startDate) params.append('start_date', startDate)
                  if (endDate) params.append('end_date', endDate)
                  const response = await fetch(`/v1/governance/audit-logs/stats?${params}`)
                  if (!response.ok) throw new Error('Failed to fetch audit stats')
                  return response.json()
                }}
                onExportLogs={async (request: AuditLogExportRequest) => {
                  // Mock API call - replace with real implementation
                  const response = await fetch('/v1/governance/audit-logs/export', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(request)
                  })
                  if (!response.ok) throw new Error('Failed to export audit logs')
                  return response.json()
                }}
                onGetLogDetails={async (logId: string) => {
                  // Mock API call - replace with real implementation
                  const response = await fetch(`/v1/governance/audit-logs/${logId}`)
                  if (!response.ok) throw new Error('Failed to fetch audit log details')
                  return response.json()
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
        {/* Approval Dashboard Tab */}
        <TabsContent value="approvals" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LayoutDashboard className="h-5 w-5" />
                Approval Dashboard
              </CardTitle>
              <CardDescription>
                Monitor and manage approval workflows, track performance metrics, and handle pending approvals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ApprovalDashboard />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Workflow Designer Tab */}
        <TabsContent value="workflows" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                Workflow Designer
              </CardTitle>
              <CardDescription>
                Design and configure multi-step approval workflows with conditional logic and escalation rules
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WorkflowDesigner />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Monitoring Tab */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Security Monitoring Dashboard
              </CardTitle>
              <CardDescription>
                Monitor security events, alerts, incidents, and overall security posture in real-time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SecurityMonitoringDashboard />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Threat Intelligence Tab */}
        <TabsContent value="threat-intel" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Fingerprint className="h-5 w-5" />
                Threat Intelligence Panel
              </CardTitle>
              <CardDescription>
                Manage threat intelligence feeds, indicators, and automated threat blocking rules
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ThreatIntelligencePanel />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Incident Management Tab */}
        <TabsContent value="incidents" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5" />
                Incident Management Panel
              </CardTitle>
              <CardDescription>
                Track, investigate, and resolve security incidents with automated workflows and compliance reporting
              </CardDescription>
            </CardHeader>
            <CardContent>
              <IncidentManagementPanel />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}