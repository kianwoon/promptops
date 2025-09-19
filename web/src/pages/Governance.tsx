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
import { makeAuthenticatedRequest } from '@/lib/googleAuth'

export function Governance() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Governance</h1>
        <p className="text-muted-foreground">
          Manage access controls, policies, and compliance
        </p>
      </div>

      {/* Overview cards removed - navigation is available through tabs below */}

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
                  // Real API call to governance service
                  const params = new URLSearchParams()
                  Object.entries(filters).forEach(([key, value]) => {
                    if (value !== undefined && value !== null) {
                      params.append(key, value.toString())
                    }
                  })
                  return makeAuthenticatedRequest<AuditLog[]>(`/v1/governance/audit-logs?${params}`)
                }}
                onFetchStats={async (startDate?: string, endDate?: string) => {
                  // Real API call to governance service
                  const params = new URLSearchParams()
                  if (startDate) params.append('start_date', startDate)
                  if (endDate) params.append('end_date', endDate)
                  return makeAuthenticatedRequest<AuditLogStats>(`/v1/governance/audit-logs/stats?${params}`)
                }}
                onExportLogs={async (request: AuditLogExportRequest) => {
                  // Real API call to governance service
                  return makeAuthenticatedRequest<AuditLogExportResponse>(
                    '/v1/governance/audit-logs/export',
                    {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(request)
                    }
                  )
                }}
                onGetLogDetails={async (logId: string) => {
                  // Real API call to governance service
                  return makeAuthenticatedRequest<AuditLog>(`/v1/governance/audit-logs/${logId}`)
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
