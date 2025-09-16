import React, { useState, useEffect } from 'react'
import {
  TrendingUp,
  Brain,
  Activity,
  AlertTriangle,
  Plus,
  RefreshCw,
  Settings,
  Play,
  Pause,
  BarChart3,
  Target,
  Zap,
  Shield,
  Clock,
  CheckCircle,
  XCircle,
  Filter,
  Search,
  Eye,
  Edit,
  Trash2,
  Download,
  Upload
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

interface AnomalyDetectionRule {
  id: string
  name: string
  description?: string
  rule_type: string
  target_metric: string
  detection_config: any
  threshold_config: any
  sensitivity?: string
  alert_on_detection: boolean
  alert_severity?: string
  alert_message_template?: string
  is_active: boolean
  evaluation_frequency_minutes: number
  scope_config?: any
  total_detections: number
  true_positives: number
  false_positives: number
  last_detection_at?: string
  tenant_id: string
  created_by: string
  created_at: string
  updated_at: string
}

interface AnomalyDetectionResult {
  id: string
  rule_id: string
  anomaly_score: string
  baseline_value: string
  actual_value: string
  deviation_percentage: string
  is_anomaly: boolean
  severity?: string
  confidence_level?: string
  entity_type?: string
  entity_id?: string
  metric_name: string
  time_window_start: string
  time_window_end: string
  detection_details: any
  contributing_factors?: string[]
  alert_generated: boolean
  alert_id?: string
  created_at: string
}

export function AnomalyDetectionPanel() {
  const [rules, setRules] = useState<AnomalyDetectionRule[]>([])
  const [results, setResults] = useState<AnomalyDetectionResult[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('rules')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  useEffect(() => {
    loadAnomalyDetectionData()
  }, [])

  const loadAnomalyDetectionData = async () => {
    setLoading(true)
    try {
      // Mock API calls - replace with real implementations
      const [rulesResponse, resultsResponse] = await Promise.all([
        fetch('/v1/governance/security/anomaly-rules?tenant_id=default'),
        fetch('/v1/governance/security/anomaly-results?tenant_id=default&limit=50')
      ])

      if (rulesResponse.ok) {
        const rulesData = await rulesResponse.json()
        setRules(rulesData)
      }

      if (resultsResponse.ok) {
        const resultsData = await resultsResponse.json()
        setResults(resultsData)
      }
    } catch (error) {
      console.error('Failed to load anomaly detection data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getSeverityColor = (severity?: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical': return 'bg-red-500'
      case 'high': return 'bg-orange-500'
      case 'medium': return 'bg-yellow-500'
      case 'low': return 'bg-green-500'
      default: return 'bg-gray-500'
    }
  }

  const getConfidenceColor = (confidence?: string) => {
    switch (confidence?.toLowerCase()) {
      case 'high': return 'bg-green-500'
      case 'medium': return 'bg-yellow-500'
      case 'low': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const formatDateTime = (dateString: string) => {
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

  const calculateAccuracy = (rule: AnomalyDetectionRule) => {
    const total = rule.true_positives + rule.false_positives
    if (total === 0) return 0
    return (rule.true_positives / total) * 100
  }

  const filteredRules = rules.filter(rule => {
    const matchesSearch = searchTerm === '' ||
      rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rule.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rule.target_metric.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesType = filterType === 'all' || rule.rule_type === filterType
    const matchesStatus = filterStatus === 'all' ||
      (filterStatus === 'active' && rule.is_active) ||
      (filterStatus === 'inactive' && !rule.is_active)

    return matchesSearch && matchesType && matchesStatus
  })

  const anomalyStats = {
    totalRules: rules.length,
    activeRules: rules.filter(r => r.is_active).length,
    totalDetections: rules.reduce((sum, r) => sum + r.total_detections, 0),
    accuracy: rules.length > 0 ?
      rules.reduce((sum, r) => sum + calculateAccuracy(r), 0) / rules.length : 0,
    recentAnomalies: results.filter(r => r.is_anomaly && new Date(r.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)).length
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading anomaly detection data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Anomaly Detection Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Rules</p>
                <p className="text-2xl font-bold">{anomalyStats.activeRules}</p>
                <p className="text-xs text-muted-foreground">
                  {anomalyStats.totalRules} total
                </p>
              </div>
              <Brain className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Detections</p>
                <p className="text-2xl font-bold">{anomalyStats.totalDetections}</p>
                <p className="text-xs text-muted-foreground">
                  All time
                </p>
              </div>
              <Activity className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Accuracy</p>
                <p className="text-2xl font-bold">{anomalyStats.accuracy.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">
                  Average across rules
                </p>
              </div>
              <Target className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Recent Anomalies</p>
                <p className="text-2xl font-bold">{anomalyStats.recentAnomalies}</p>
                <p className="text-xs text-muted-foreground">
                  Last 24 hours
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="rules">Detection Rules</TabsTrigger>
            <TabsTrigger value="results">Detection Results</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadAnomalyDetectionData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Rule
            </Button>
          </div>
        </div>

        <TabsContent value="rules" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Anomaly Detection Rules</CardTitle>
              <CardDescription>
                Configure machine learning rules to detect unusual behavior patterns
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex items-center gap-4 mb-6">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search rules..."
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
                    <SelectItem value="statistical">Statistical</SelectItem>
                    <SelectItem value="ml_model">ML Model</SelectItem>
                    <SelectItem value="threshold">Threshold</SelectItem>
                    <SelectItem value="pattern">Pattern</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Rules List */}
              <div className="space-y-3">
                {filteredRules.map((rule) => (
                  <div key={rule.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <Brain className="h-6 w-6 text-blue-500" />
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{rule.name}</h4>
                          <Badge variant="outline">{rule.rule_type}</Badge>
                          {rule.is_active ? (
                            <Badge className="bg-green-100 text-green-800">
                              <Play className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          ) : (
                            <Badge className="bg-gray-100 text-gray-800">
                              <Pause className="h-3 w-3 mr-1" />
                              Inactive
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {rule.description || `Monitoring: ${rule.target_metric}`}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Target className="h-3 w-3" />
                            Metric: {rule.target_metric}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Every {rule.evaluation_frequency_minutes}m
                          </span>
                          <span className="flex items-center gap-1">
                            <Activity className="h-3 w-3" />
                            {rule.total_detections} detections
                          </span>
                          <span className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            {calculateAccuracy(rule).toFixed(1)}% accuracy
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {rule.last_detection_at && (
                        <span className="text-xs text-muted-foreground">
                          Last: {formatTimeAgo(rule.last_detection_at)}
                        </span>
                      )}
                      <Button variant="outline" size="sm">
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Detection Results</CardTitle>
              <CardDescription>
                Recent anomaly detection results and alerts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {results.slice(0, 20).map((result) => (
                  <div key={result.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      {result.is_anomaly ? (
                        <AlertTriangle className="h-6 w-6 text-orange-500" />
                      ) : (
                        <CheckCircle className="h-6 w-6 text-green-500" />
                      )}
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{result.metric_name}</h4>
                          {result.is_anomaly && (
                            <>
                              <Badge className={getSeverityColor(result.severity)}>
                                {result.severity}
                              </Badge>
                              <Badge className={getConfidenceColor(result.confidence_level)}>
                                {result.confidence_level} confidence
                              </Badge>
                            </>
                          )}
                          {result.alert_generated && (
                            <Badge className="bg-red-100 text-red-800">
                              Alert Generated
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          Value: {result.actual_value} (baseline: {result.baseline_value})
                          {result.deviation_percentage && ` • Deviation: ${result.deviation_percentage}%`}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTimeAgo(result.created_at)}
                          </span>
                          {result.entity_type && result.entity_id && (
                            <span>Entity: {result.entity_type}:{result.entity_id}</span>
                          )}
                          <span>Anomaly Score: {result.anomaly_score}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Anomaly Detection Analytics</CardTitle>
              <CardDescription>
                Performance metrics and insights from anomaly detection
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Rule Performance */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Rule Performance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {rules.slice(0, 5).map((rule) => (
                        <div key={rule.id}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-medium truncate" title={rule.name}>
                              {rule.name}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {calculateAccuracy(rule).toFixed(1)}%
                            </span>
                          </div>
                          <Progress value={calculateAccuracy(rule)} className="h-2" />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Detection Types */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Detection Types</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Array.from(new Set(rules.map(r => r.rule_type))).map((type) => {
                        const count = rules.filter(r => r.rule_type === type).length
                        const percentage = rules.length > 0 ? (count / rules.length) * 100 : 0
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

              {/* Recent Anomalies Timeline */}
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="text-lg">Recent Anomalies Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {results
                      .filter(r => r.is_anomaly)
                      .slice(0, 10)
                      .map((result) => (
                        <div key={result.id} className="flex items-center gap-3 p-2 border rounded">
                          <div className={`w-3 h-3 rounded-full ${getSeverityColor(result.severity)}`} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{result.metric_name}</span>
                              <span className="text-xs text-muted-foreground">
                                Score: {result.anomaly_score}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {formatTimeAgo(result.created_at)}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Anomaly Detection Settings</CardTitle>
              <CardDescription>
                Configure global anomaly detection settings and parameters
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-3">Detection Settings</h4>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="auto-enable">Auto-enable new rules</Label>
                          <p className="text-xs text-muted-foreground">Automatically enable newly created detection rules</p>
                        </div>
                        <Switch id="auto-enable" defaultChecked />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="auto-alert">Auto-alert on detection</Label>
                          <p className="text-xs text-muted-foreground">Automatically generate alerts for anomalies</p>
                        </div>
                        <Switch id="auto-alert" defaultChecked />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="learning-mode">Learning mode</Label>
                          <p className="text-xs text-muted-foreground">Run in learning mode without generating alerts</p>
                        </div>
                        <Switch id="learning-mode" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Performance Settings</h4>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="batch-size">Batch processing size</Label>
                        <Select defaultValue="100">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="100">100</SelectItem>
                            <SelectItem value="200">200</SelectItem>
                            <SelectItem value="500">500</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="retention-days">Data retention (days)</Label>
                        <Select defaultValue="90">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="30">30 days</SelectItem>
                            <SelectItem value="60">60 days</SelectItem>
                            <SelectItem value="90">90 days</SelectItem>
                            <SelectItem value="180">180 days</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3">Advanced Settings</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="enable-ml">Enable ML models</Label>
                        <p className="text-xs text-muted-foreground">Use machine learning for advanced anomaly detection</p>
                      </div>
                      <Switch id="enable-ml" defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="real-time">Real-time processing</Label>
                        <p className="text-xs text-muted-foreground">Process anomalies in real-time</p>
                      </div>
                      <Switch id="real-time" defaultChecked />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Rebuild Models
                  </Button>
                  <Button variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Export Configuration
                  </Button>
                  <Button variant="outline">
                    <Upload className="h-4 w-4 mr-2" />
                    Import Configuration
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}