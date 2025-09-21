import React from 'react'
import {
  History,
  AlertTriangle,
  Fingerprint,
  ShieldAlert,
  TrendingUp
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AuditTrailViewer } from '@/components/governance/AuditTrailViewer'
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
      <Tabs defaultValue="audit" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-1">
          <TabsTrigger value="audit" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 text-xs sm:text-sm">
            <History className="h-4 w-4 flex-shrink-0" />
            <span className="text-center">Audit</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 text-xs sm:text-sm">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span className="text-center">Security</span>
          </TabsTrigger>
          <TabsTrigger value="threat-intel" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 text-xs sm:text-sm">
            <Fingerprint className="h-4 w-4 flex-shrink-0" />
            <span className="text-center">Threat Intel</span>
          </TabsTrigger>
          <TabsTrigger value="incidents" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 text-xs sm:text-sm">
            <ShieldAlert className="h-4 w-4 flex-shrink-0" />
            <span className="text-center">Incidents</span>
          </TabsTrigger>
          <TabsTrigger value="anomaly" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 text-xs sm:text-sm">
            <TrendingUp className="h-4 w-4 flex-shrink-0" />
            <span className="text-center">Anomaly</span>
          </TabsTrigger>
        </TabsList>


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
                  return makeAuthenticatedRequest<AuditLog[]>(`/api/v1/governance/audit-logs?${params}`)
                }}
                onFetchStats={async (startDate?: string, endDate?: string) => {
                  // Real API call to governance service
                  const params = new URLSearchParams()
                  if (startDate) params.append('start_date', startDate)
                  if (endDate) params.append('end_date', endDate)
                  return makeAuthenticatedRequest<AuditLogStats>(`/api/v1/governance/audit-logs/stats?${params}`)
                }}
                onExportLogs={async (request: AuditLogExportRequest) => {
                  // Real API call to governance service
                  return makeAuthenticatedRequest<AuditLogExportResponse>(
                    '/api/v1/governance/audit-logs/export',
                    {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(request)
                    }
                  )
                }}
                onGetLogDetails={async (logId: string) => {
                  // Real API call to governance service
                  return makeAuthenticatedRequest<AuditLog>(`/api/v1/governance/audit-logs/${logId}`)
                }}
              />
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
        {/* Anomaly Detection Tab */}
        <TabsContent value="anomaly" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Anomaly Detection Panel
              </CardTitle>
              <CardDescription>
                Detect and analyze unusual patterns, behaviors, and potential security anomalies
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AnomalyDetectionPanel />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
