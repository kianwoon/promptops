import React, { useState, useEffect } from 'react'
import {
  Shield,
  AlertTriangle,
  Activity,
  TrendingUp,
  Users,
  Fingerprint,
  BarChart3,
  RefreshCw,
  Download,
  Filter,
  Search,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { makeAuthenticatedRequest } from '@/lib/googleAuth'
import { useAuth } from '@/contexts/AuthContext'

interface SecurityMetrics {
  total_events: number
  critical_events: number
  high_severity_events: number
  active_alerts: number
  critical_alerts: number
  active_incidents: number
  critical_incidents: number
  compliance_score?: string
  threat_indicators: number
  blocked_threats: number
  anomaly_score?: string
  mean_time_to_resolve_minutes?: number
  unique_active_users: number
  suspicious_activities: number
}

interface SecurityEvent {
  id: string
  event_type: string
  severity: string
  description: string
  created_at: string
  ip_address?: string
  user_agent?: string
  is_resolved: boolean
}

interface SecurityAlert {
  id: string
  alert_type: string
  severity: string
  title: string
  description: string
  status: string
  detected_at: string
  assigned_to?: string
}

export function SecurityMonitoringDashboard() {
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null)
  const [events, setEvents] = useState<SecurityEvent[]>([])
  const [alerts, setAlerts] = useState<SecurityAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h')
  const { user } = useAuth()

  useEffect(() => {
    loadSecurityData()
  }, [selectedTimeRange])

  const loadSecurityData = async () => {
    setLoading(true)
    try {
      const tenantId = user?.organization || 'default-tenant'

      const [metricsData, eventsData, alertsData] = await Promise.all([
        makeAuthenticatedRequest<SecurityMetrics>(
          `/api/v1/governance/security/dashboard/metrics?tenant_id=${encodeURIComponent(tenantId)}&time_range=${selectedTimeRange}`
        ),
        makeAuthenticatedRequest<SecurityEvent[]>(
          `/api/v1/governance/security/events?tenant_id=${encodeURIComponent(tenantId)}&limit=50`
        ),
        makeAuthenticatedRequest<SecurityAlert[]>(
          `/api/v1/governance/security/alerts?tenant_id=${encodeURIComponent(tenantId)}&limit=20`
        )
      ])

      setMetrics(metricsData)
      setEvents(eventsData)
      setAlerts(alertsData)
    } catch (error) {
      console.error('Failed to load security data:', error)
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
      case 'open': return 'bg-red-100 text-red-800'
      case 'investigating': return 'bg-yellow-100 text-yellow-800'
      case 'resolved': return 'bg-green-100 text-green-800'
      case 'false_positive': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatTimeAgo = (dateString: string) => {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading security data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Events</p>
                <p className="text-2xl font-bold">{metrics?.total_events || 0}</p>
                <div className="flex items-center gap-1 mt-1">
                  <div className={`w-2 h-2 rounded-full ${getSeverityColor('critical')}`} />
                  <span className="text-xs text-muted-foreground">
                    {metrics?.critical_events || 0} critical
                  </span>
                </div>
              </div>
              <Activity className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Alerts</p>
                <p className="text-2xl font-bold">{metrics?.active_alerts || 0}</p>
                <div className="flex items-center gap-1 mt-1">
                  <div className={`w-2 h-2 rounded-full ${getSeverityColor('critical')}`} />
                  <span className="text-xs text-muted-foreground">
                    {metrics?.critical_alerts || 0} critical
                  </span>
                </div>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Incidents</p>
                <p className="text-2xl font-bold">{metrics?.active_incidents || 0}</p>
                <div className="flex items-center gap-1 mt-1">
                  <div className={`w-2 h-2 rounded-full ${getSeverityColor('critical')}`} />
                  <span className="text-xs text-muted-foreground">
                    {metrics?.critical_incidents || 0} critical
                  </span>
                </div>
              </div>
              <Shield className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Compliance Score</p>
                <p className="text-2xl font-bold">{metrics?.compliance_score || 'N/A'}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Users className="h-3 w-3" />
                  <span className="text-xs text-muted-foreground">
                    {metrics?.unique_active_users || 0} users
                  </span>
                </div>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="events">Security Events</TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
            <TabsTrigger value="threats">Threat Intelligence</TabsTrigger>
            <TabsTrigger value="anomalies">Anomalies</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <select
              value={selectedTimeRange}
              onChange={(e) => setSelectedTimeRange(e.target.value)}
              className="px-3 py-2 border rounded-md text-sm"
            >
              <option value="1h">Last Hour</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
            <Button variant="outline" size="sm" onClick={loadSecurityData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <TabsContent value="overview" className="space-y-6">
          {/* Security Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Security Posture
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Threat Detection</span>
                    <span className="text-sm text-muted-foreground">
                      {metrics?.blocked_threats || 0} / {metrics?.threat_indicators || 0}
                    </span>
                  </div>
                  <Progress
                    value={metrics?.threat_indicators ? ((metrics?.blocked_threats || 0) / metrics?.threat_indicators) * 100 : 0}
                    className="h-2"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Alert Resolution</span>
                    <span className="text-sm text-muted-foreground">
                      {metrics?.active_alerts || 0} active
                    </span>
                  </div>
                  <Progress
                    value={metrics?.active_alerts ? Math.max(0, 100 - (metrics?.active_alerts || 0) * 10) : 100}
                    className="h-2"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Mean Time to Resolve</span>
                    <span className="text-sm text-muted-foreground">
                      {metrics?.mean_time_to_resolve_minutes ? `${Math.floor(metrics.mean_time_to_resolve_minutes / 60)}h ${metrics.mean_time_to_resolve_minutes % 60}m` : 'N/A'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {events.slice(0, 5).map((event) => (
                    <div key={event.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${getSeverityColor(event.severity)}`} />
                        <div>
                          <p className="text-sm font-medium">{event.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatTimeAgo(event.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {event.is_resolved ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="events" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Security Events</CardTitle>
              <CardDescription>
                Real-time security events and activities across the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {events.map((event) => (
                  <div key={event.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className={`w-4 h-4 rounded-full ${getSeverityColor(event.severity)}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{event.event_type}</Badge>
                          <Badge className={getSeverityColor(event.severity)}>
                            {event.severity}
                          </Badge>
                        </div>
                        <p className="text-sm mt-1">{event.description}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>{formatTimeAgo(event.created_at)}</span>
                          {event.ip_address && <span>IP: {event.ip_address}</span>}
                          {event.user_agent && <span>User Agent: {event.user_agent.substring(0, 30)}...</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {event.is_resolved ? (
                        <Badge className="bg-green-100 text-green-800">Resolved</Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-800">Open</Badge>
                      )}
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Security Alerts</CardTitle>
              <CardDescription>
                Active security alerts requiring investigation and response
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <div key={alert.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <AlertTriangle className={`h-5 w-5 ${alert.severity === 'critical' ? 'text-red-500' : 'text-orange-500'}`} />
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{alert.title}</h4>
                          <Badge className={getSeverityColor(alert.severity)}>
                            {alert.severity}
                          </Badge>
                          <Badge className={getStatusColor(alert.status)}>
                            {alert.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{alert.description}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTimeAgo(alert.detected_at)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Fingerprint className="h-3 w-3" />
                            {alert.alert_type}
                          </span>
                          {alert.assigned_to && (
                            <span>Assigned to: {alert.assigned_to}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm">Investigate</Button>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="threats" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Threat Intelligence</CardTitle>
              <CardDescription>
                Known threats, indicators of compromise, and blocking status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-2xl font-bold">{metrics?.threat_indicators || 0}</p>
                          <p className="text-sm text-muted-foreground">Threat Indicators</p>
                        </div>
                        <Fingerprint className="h-8 w-8 text-blue-500" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-2xl font-bold">{metrics?.blocked_threats || 0}</p>
                          <p className="text-sm text-muted-foreground">Blocked Threats</p>
                        </div>
                        <Shield className="h-8 w-8 text-green-500" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-2xl font-bold">{metrics?.suspicious_activities || 0}</p>
                          <p className="text-sm text-muted-foreground">Suspicious Activities</p>
                        </div>
                        <AlertCircle className="h-8 w-8 text-orange-500" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="anomalies" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Anomaly Detection</CardTitle>
              <CardDescription>
                Machine learning-based anomaly detection and unusual behavior patterns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <TrendingUp className="h-6 w-6 text-purple-500" />
                    <div>
                      <h4 className="font-medium">Anomaly Score</h4>
                      <p className="text-sm text-muted-foreground">Current system anomaly detection score</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">{metrics?.anomaly_score || '0.0'}</p>
                    <p className="text-sm text-muted-foreground">out of 10.0</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
