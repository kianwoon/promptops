import React, { useState, useEffect, useRef } from 'react'
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { makeAuthenticatedRequest, getAccessToken } from '@/lib/googleAuth'
import { useAuth } from '@/contexts/AuthContext'

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
  const [isAddRuleDialogOpen, setIsAddRuleDialogOpen] = useState(false)
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false)
  const [isViewRuleDialogOpen, setIsViewRuleDialogOpen] = useState(false)
  const [isViewResultDialogOpen, setIsViewResultDialogOpen] = useState(false)
  const [viewingRule, setViewingRule] = useState<AnomalyDetectionRule | null>(null)
  const [viewingResult, setViewingResult] = useState<AnomalyDetectionResult | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingRule, setEditingRule] = useState<AnomalyDetectionRule | null>(null)
  const [newRule, setNewRule] = useState({
    name: '',
    description: '',
    rule_type: '',
    target_metric: '',
    detection_config: {},
    threshold_config: {},
    sensitivity: 'medium',
    alert_on_detection: true,
    alert_severity: 'medium',
    evaluation_frequency_minutes: 60,
    is_active: true
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { user } = useAuth()

  // Export/Import state
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [exportStatus, setExportStatus] = useState<string | null>(null)
  const [importStatus, setImportStatus] = useState<string | null>(null)
  const [exportProgress, setExportProgress] = useState(0)
  const [importProgress, setImportProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadAnomalyDetectionData()
  }, [])

  const loadAnomalyDetectionData = async () => {
    setLoading(true)
    try {
      const tenantId = user?.organization || 'default-tenant'

      const [rulesData, resultsData] = await Promise.all([
        makeAuthenticatedRequest<AnomalyDetectionRule[]>(
          `/api/v1/governance/security/anomaly-rules?tenant_id=${encodeURIComponent(tenantId)}`
        ),
        makeAuthenticatedRequest<AnomalyDetectionResult[]>(
          `/api/v1/governance/security/anomaly-results?tenant_id=${encodeURIComponent(tenantId)}&limit=50`
        )
      ])

      setRules(rulesData)
      setResults(resultsData)
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

  const validateRuleForm = () => {
    const newErrors: Record<string, string> = {}

    if (!newRule.name.trim()) {
      newErrors.name = 'Rule name is required'
    }

    if (!newRule.rule_type) {
      newErrors.rule_type = 'Rule type is required'
    }

    if (!newRule.target_metric.trim()) {
      newErrors.target_metric = 'Target metric is required'
    }

    if (newRule.evaluation_frequency_minutes < 1 || newRule.evaluation_frequency_minutes > 1440) {
      newErrors.evaluation_frequency_minutes = 'Evaluation frequency must be between 1 and 1440 minutes'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleAddRule = async () => {
    if (!validateRuleForm()) {
      return
    }

    setIsSubmitting(true)
    try {
      const tenantId = user?.organization || 'default-tenant'
      const ruleData = {
        ...newRule,
        tenant_id: tenantId,
        created_by: user?.email || 'unknown'
      }

      const createdRule = await makeAuthenticatedRequest<AnomalyDetectionRule>(
        `/api/v1/governance/security/anomaly-rules?tenant_id=${encodeURIComponent(tenantId)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(ruleData)
        }
      )

      setRules(prev => [createdRule, ...prev])
      setIsAddRuleDialogOpen(false)
      setNewRule({
        name: '',
        description: '',
        rule_type: '',
        target_metric: '',
        detection_config: {},
        threshold_config: {},
        sensitivity: 'medium',
        alert_on_detection: true,
        alert_severity: 'medium',
        evaluation_frequency_minutes: 60,
        is_active: true
      })
      setErrors({})
    } catch (error) {
      console.error('Failed to create anomaly detection rule:', error)
      setErrors({ submit: 'Failed to create rule. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRuleInputChange = (field: string, value: string | number | boolean | any) => {
    setNewRule(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleOpenSettings = (rule: AnomalyDetectionRule) => {
    setEditingRule(rule)
    setIsSettingsDialogOpen(true)
  }

  const handleViewRule = (rule: AnomalyDetectionRule) => {
    console.log('View rule:', rule.name)
    setViewingRule(rule)
    setIsViewRuleDialogOpen(true)
  }

  const handleViewResult = (result: AnomalyDetectionResult) => {
    console.log('View result:', result.id)
    setViewingResult(result)
    setIsViewResultDialogOpen(true)
  }

  const handleUpdateRule = async () => {
    if (!editingRule) return

    setIsSubmitting(true)
    try {
      const tenantId = user?.organization || 'default-tenant'
      const response = await makeAuthenticatedRequest<AnomalyDetectionRule>(
        `/api/v1/governance/security/anomaly-rules/${editingRule.id}?tenant_id=${encodeURIComponent(tenantId)}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(editingRule)
        }
      )

      // Update the rule in the list
      setRules(prev => prev.map(rule => rule.id === editingRule.id ? response : rule))

      // Reset form and close dialog
      setEditingRule(null)
      setIsSettingsDialogOpen(false)
    } catch (error) {
      console.error('Failed to update rule:', error)
      setErrors({ submit: 'Failed to update rule. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleExportConfig = async () => {
    setIsExporting(true)
    setExportStatus('Starting export...')
    setExportProgress(0)

    try {
      const tenantId = user?.organization || 'default-tenant'

      // Start the export process
      setExportStatus('Initializing export...')
      const exportResponse = await makeAuthenticatedRequest<{
        export_id: string
        status: string
        total_rules: number
        progress: number
      }>(
        `/api/v1/governance/security/anomaly-rules/export?tenant_id=${encodeURIComponent(tenantId)}`,
        {
          method: 'POST'
        }
      )

      setExportProgress(exportResponse.progress || 10)
      setExportStatus(`Export initiated: ${exportResponse.total_rules} rules`)
      console.log('Initial export response:', exportResponse)

      // Poll for export status
      const checkExportStatus = async (exportId: string) => {
        setExportStatus('Processing configuration...')
        setExportProgress(30)

        try {
          const statusResponse = await makeAuthenticatedRequest<{
            status: string
            progress: number
            file_url?: string
            error?: string
          }>(
            `/api/v1/governance/security/anomaly-rules/export/${exportId}/status?tenant_id=${encodeURIComponent(tenantId)}`
          )

          const progress = statusResponse.progress || 0
          const calculatedProgress = 30 + (progress * 0.6)
          setExportProgress(calculatedProgress)
          setExportStatus(`Processing: ${progress}%`)
          console.log('Export status response:', statusResponse)
          console.log('Calculated progress:', calculatedProgress)

          if (statusResponse.status === 'completed' && statusResponse.download_url) {
            // Download the file
            setExportStatus('Downloading configuration...')
            setExportProgress(90)

            const token = getAccessToken()
            const response = await fetch(statusResponse.download_url, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            })
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`)
            }

            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url

            // Create filename with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
            link.download = `anomaly-detection-config-${timestamp}.json`

            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            window.URL.revokeObjectURL(url)

            setExportProgress(100)
            setExportStatus('Export completed successfully!')

            // Reset after a short delay
            setTimeout(() => {
              setExportStatus(null)
              setExportProgress(0)
            }, 3000)
          } else if (statusResponse.status === 'failed') {
            throw new Error(statusResponse.error || 'Export failed')
          } else {
            // Continue polling
            setTimeout(() => checkExportStatus(exportId), 1000)
          }
        } catch (error) {
          console.error('Error checking export status:', error)
          throw error
        }
      }

      await checkExportStatus(exportResponse.export_id)

    } catch (error) {
      console.error('Export failed:', error)
      setExportStatus(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`)

      // Reset after a delay
      setTimeout(() => {
        setExportStatus(null)
        setExportProgress(0)
      }, 5000)
    } finally {
      setIsExporting(false)
    }
  }

  const handleImportConfig = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.json')) {
      setImportStatus('Please select a JSON file')
      setTimeout(() => setImportStatus(null), 3000)
      return
    }

    setIsImporting(true)
    setImportStatus('Reading configuration file...')
    setImportProgress(0)

    try {
      // Read the file
      const text = await file.text()
      setImportProgress(20)
      setImportStatus('Validating configuration...')

      let config
      try {
        config = JSON.parse(text)
      } catch (error) {
        throw new Error('Invalid JSON format')
      }

      // Basic validation
      if (!config || typeof config !== 'object') {
        throw new Error('Invalid configuration format')
      }

      setImportProgress(40)
      setImportStatus('Uploading configuration...')

      // Upload and import the configuration
      const tenantId = user?.organization || 'default-tenant'
      const formData = new FormData()
      formData.append('file', file)

      const response = await makeAuthenticatedRequest<{
        message: string
        rules_imported: number
        rules_updated: number
        errors?: string[]
        import_id?: string
      }>(
        `/api/v1/governance/security/anomaly-rules/import?tenant_id=${encodeURIComponent(tenantId)}`,
        {
          method: 'POST',
          body: formData
        }
      )

      setImportProgress(70)
      setImportStatus('Processing import...')

      // If there's an import_id, poll for status
      if (response.import_id) {
        const checkImportStatus = async (importId: string) => {
          try {
            const statusResponse = await makeAuthenticatedRequest<{
              status: string
              progress: number
              message: string
              rules_imported?: number
              rules_updated?: number
              errors?: string[]
            }>(
              `/api/v1/governance/security/anomaly-rules/import/${importId}/status?tenant_id=${encodeURIComponent(tenantId)}`
            )

            setImportProgress(70 + (statusResponse.progress * 0.25))
            setImportStatus(statusResponse.message || `Processing: ${statusResponse.progress}%`)

            if (statusResponse.status === 'completed') {
              setImportProgress(100)
              setImportStatus(`Import completed! Imported: ${statusResponse.imported_rules || 0}, Skipped: ${statusResponse.skipped_rules || 0}`)

              // Refresh the data
              await loadAnomalyDetectionData()

              // Reset after a delay
              setTimeout(() => {
                setImportStatus(null)
                setImportProgress(0)
              }, 5000)
            } else if (statusResponse.status === 'failed') {
              throw new Error(statusResponse.message || 'Import failed')
            } else {
              // Continue polling
              setTimeout(() => checkImportStatus(importId), 1000)
            }
          } catch (error) {
            console.error('Error checking import status:', error)
            throw error
          }
        }

        await checkImportStatus(response.import_id)
      } else {
        // Immediate response
        setImportProgress(100)
        setImportStatus(`Import completed! Imported: ${response.imported_rules}, Skipped: ${response.skipped_rules}`)

        // Refresh the data
        await loadAnomalyDetectionData()

        // Reset after a delay
        setTimeout(() => {
          setImportStatus(null)
          setImportProgress(0)
        }, 5000)
      }

    } catch (error) {
      console.error('Import failed:', error)
      setImportStatus(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`)

      // Reset after a delay
      setTimeout(() => {
        setImportStatus(null)
        setImportProgress(0)
      }, 5000)
    } finally {
      setIsImporting(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
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
        <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border-2 hover:border-primary/20 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/60"></div>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 text-white">
                <Brain className="h-6 w-6" />
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{anomalyStats.activeRules}</p>
                <p className="text-sm font-medium text-muted-foreground">Active Rules</p>
                <p className="text-xs text-muted-foreground">
                  {anomalyStats.totalRules} total
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border-2 hover:border-primary/20 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/60"></div>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-full bg-gradient-to-r from-cyan-500 to-teal-500 text-white">
                <Activity className="h-6 w-6" />
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{anomalyStats.totalDetections}</p>
                <p className="text-sm font-medium text-muted-foreground">Total Detections</p>
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
              <div className="p-3 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 text-white">
                <Target className="h-6 w-6" />
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{anomalyStats.accuracy.toFixed(1)}%</p>
                <p className="text-sm font-medium text-muted-foreground">Accuracy</p>
                <p className="text-xs text-muted-foreground">
                  Average across rules
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border-2 hover:border-primary/20 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/60"></div>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-full bg-gradient-to-r from-red-500 to-rose-500 text-white">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{anomalyStats.recentAnomalies}</p>
                <p className="text-sm font-medium text-muted-foreground">Recent Anomalies</p>
                <p className="text-xs text-muted-foreground">Last 24 hours</p>
              </div>
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
            <Button onClick={() => setIsAddRuleDialogOpen(true)}>
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
                      <Button variant="outline" size="sm" onClick={() => handleOpenSettings(rule)}>
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleViewRule(rule)}>
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
                      <Button variant="outline" size="sm" onClick={() => handleViewResult(result)}>
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
                  <Button
                    variant="outline"
                    onClick={handleExportConfig}
                    disabled={isExporting}
                  >
                    {isExporting ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Export Configuration
                  </Button>
                  <Button
                    variant="outline"
                    onClick={triggerFileInput}
                    disabled={isImporting}
                  >
                    {isImporting ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    Import Configuration
                  </Button>

                  {/* Hidden file input for import */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleImportConfig}
                    style={{ display: 'none' }}
                  />
                </div>

                {/* Export Progress */}
                {isExporting && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-blue-800">
                        {exportStatus}
                      </span>
                      <span className="text-sm text-blue-600">
                        {exportProgress}%
                      </span>
                    </div>
                    <Progress value={exportProgress} className="h-2" />
                  </div>
                )}

                {/* Import Progress */}
                {isImporting && (
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-green-800">
                        {importStatus}
                      </span>
                      <span className="text-sm text-green-600">
                        {importProgress}%
                      </span>
                    </div>
                    <Progress value={importProgress} className="h-2" />
                  </div>
                )}

                {/* Status Messages */}
                {exportStatus && !isExporting && (
                  <div className={`mt-4 p-4 rounded-lg ${
                    exportStatus.includes('failed')
                      ? 'bg-red-50 border border-red-200'
                      : 'bg-blue-50 border border-blue-200'
                  }`}>
                    <p className={`text-sm ${
                      exportStatus.includes('failed')
                        ? 'text-red-800'
                        : 'text-blue-800'
                    }`}>
                      {exportStatus}
                    </p>
                  </div>
                )}

                {importStatus && !isImporting && (
                  <div className={`mt-4 p-4 rounded-lg ${
                    importStatus.includes('failed')
                      ? 'bg-red-50 border border-red-200'
                      : 'bg-green-50 border border-green-200'
                  }`}>
                    <p className={`text-sm ${
                      importStatus.includes('failed')
                        ? 'text-red-800'
                        : 'text-green-800'
                    }`}>
                      {importStatus}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Rule Dialog */}
      <Dialog open={isAddRuleDialogOpen} onOpenChange={setIsAddRuleDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Anomaly Detection Rule</DialogTitle>
            <DialogDescription>
              Configure a new rule to detect unusual behavior patterns in your system.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {errors.submit && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-600">{errors.submit}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Rule Name *</Label>
                <Input
                  id="name"
                  value={newRule.name}
                  onChange={(e) => handleRuleInputChange('name', e.target.value)}
                  placeholder="Enter rule name"
                  className={errors.name ? 'border-red-500' : ''}
                />
                {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="rule_type">Rule Type *</Label>
                <Select value={newRule.rule_type} onValueChange={(value) => handleRuleInputChange('rule_type', value)}>
                  <SelectTrigger className={errors.rule_type ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Select rule type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="statistical">Statistical</SelectItem>
                    <SelectItem value="ml_model">ML Model</SelectItem>
                    <SelectItem value="threshold">Threshold</SelectItem>
                    <SelectItem value="pattern">Pattern</SelectItem>
                  </SelectContent>
                </Select>
                {errors.rule_type && <p className="text-sm text-red-500">{errors.rule_type}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={newRule.description}
                onChange={(e) => handleRuleInputChange('description', e.target.value)}
                placeholder="Describe what this rule detects"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="target_metric">Target Metric *</Label>
              <Input
                id="target_metric"
                value={newRule.target_metric}
                onChange={(e) => handleRuleInputChange('target_metric', e.target.value)}
                placeholder="e.g., response_time, error_rate, cpu_usage"
                className={errors.target_metric ? 'border-red-500' : ''}
              />
              {errors.target_metric && <p className="text-sm text-red-500">{errors.target_metric}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sensitivity">Sensitivity</Label>
                <Select value={newRule.sensitivity} onValueChange={(value) => handleRuleInputChange('sensitivity', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="alert_severity">Alert Severity</Label>
                <Select value={newRule.alert_severity} onValueChange={(value) => handleRuleInputChange('alert_severity', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="evaluation_frequency_minutes">Evaluation Frequency (minutes) *</Label>
              <Input
                id="evaluation_frequency_minutes"
                type="number"
                min="1"
                max="1440"
                value={newRule.evaluation_frequency_minutes}
                onChange={(e) => handleRuleInputChange('evaluation_frequency_minutes', parseInt(e.target.value) || 60)}
                className={errors.evaluation_frequency_minutes ? 'border-red-500' : ''}
              />
              {errors.evaluation_frequency_minutes && <p className="text-sm text-red-500">{errors.evaluation_frequency_minutes}</p>}
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="alert_on_detection"
                checked={newRule.alert_on_detection}
                onCheckedChange={(checked) => handleRuleInputChange('alert_on_detection', checked)}
              />
              <Label htmlFor="alert_on_detection">Generate alerts on detection</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={newRule.is_active}
                onCheckedChange={(checked) => handleRuleInputChange('is_active', checked)}
              />
              <Label htmlFor="is_active">Activate rule immediately</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddRuleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddRule} disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configure Anomaly Detection Rule</DialogTitle>
            <DialogDescription>
              Update the configuration for this anomaly detection rule.
            </DialogDescription>
          </DialogHeader>

          {editingRule && (
            <div className="grid gap-4 py-4">
              {errors.submit && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <p className="text-sm text-red-600">{errors.submit}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Rule Name *</Label>
                  <Input
                    id="edit-name"
                    value={editingRule.name}
                    onChange={(e) => setEditingRule(prev => prev ? { ...prev, name: e.target.value } : null)}
                    placeholder="Enter rule name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-rule_type">Rule Type *</Label>
                  <Select
                    value={editingRule.rule_type}
                    onValueChange={(value) => setEditingRule(prev => prev ? { ...prev, rule_type: value } : null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select rule type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="statistical">Statistical</SelectItem>
                      <SelectItem value="ml_model">ML Model</SelectItem>
                      <SelectItem value="threshold">Threshold</SelectItem>
                      <SelectItem value="pattern">Pattern</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Input
                  id="edit-description"
                  value={editingRule.description || ''}
                  onChange={(e) => setEditingRule(prev => prev ? { ...prev, description: e.target.value } : null)}
                  placeholder="Describe what this rule detects"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-target_metric">Target Metric *</Label>
                <Input
                  id="edit-target_metric"
                  value={editingRule.target_metric}
                  onChange={(e) => setEditingRule(prev => prev ? { ...prev, target_metric: e.target.value } : null)}
                  placeholder="e.g., response_time, error_rate, cpu_usage"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-sensitivity">Sensitivity</Label>
                  <Select
                    value={editingRule.sensitivity || 'medium'}
                    onValueChange={(value) => setEditingRule(prev => prev ? { ...prev, sensitivity: value } : null)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-alert_severity">Alert Severity</Label>
                  <Select
                    value={editingRule.alert_severity || 'medium'}
                    onValueChange={(value) => setEditingRule(prev => prev ? { ...prev, alert_severity: value } : null)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-evaluation_frequency_minutes">Evaluation Frequency (minutes) *</Label>
                <Input
                  id="edit-evaluation_frequency_minutes"
                  type="number"
                  min="1"
                  max="1440"
                  value={editingRule.evaluation_frequency_minutes}
                  onChange={(e) => setEditingRule(prev => prev ? { ...prev, evaluation_frequency_minutes: parseInt(e.target.value) || 60 } : null)}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-alert_on_detection"
                  checked={editingRule.alert_on_detection}
                  onCheckedChange={(checked) => setEditingRule(prev => prev ? { ...prev, alert_on_detection: checked } : null)}
                />
                <Label htmlFor="edit-alert_on_detection">Generate alerts on detection</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-is_active"
                  checked={editingRule.is_active}
                  onCheckedChange={(checked) => setEditingRule(prev => prev ? { ...prev, is_active: checked } : null)}
                />
                <Label htmlFor="edit-is_active">Rule is active</Label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSettingsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateRule}
              disabled={isSubmitting || !editingRule || !editingRule.name || !editingRule.rule_type || !editingRule.target_metric}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Rule'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Rule Dialog */}
      <Dialog open={isViewRuleDialogOpen} onOpenChange={setIsViewRuleDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Anomaly Detection Rule Details</DialogTitle>
            <DialogDescription>
              View detailed information about this anomaly detection rule.
            </DialogDescription>
          </DialogHeader>

          {viewingRule && (
            <div className="grid gap-6 py-4">
              {/* Header Information */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Brain className="h-6 w-6 text-blue-500" />
                  <div>
                    <h4 className="text-lg font-medium">{viewingRule.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">{viewingRule.rule_type}</Badge>
                      {viewingRule.is_active ? (
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
                  </div>
                </div>

                {viewingRule.description && (
                  <p className="text-sm text-muted-foreground">{viewingRule.description}</p>
                )}
              </div>

              {/* Configuration Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h5 className="font-medium">Detection Configuration</h5>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Target Metric:</span>
                      <span className="font-medium">{viewingRule.target_metric}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Rule Type:</span>
                      <span className="font-medium">{viewingRule.rule_type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sensitivity:</span>
                      <span className="font-medium capitalize">{viewingRule.sensitivity}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Evaluation Frequency:</span>
                      <span className="font-medium">{viewingRule.evaluation_frequency_minutes} minutes</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h5 className="font-medium">Alert Configuration</h5>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Alert on Detection:</span>
                      <span className="font-medium">{viewingRule.alert_on_detection ? 'Yes' : 'No'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Alert Severity:</span>
                      <Badge className={
                        viewingRule.alert_severity === 'critical' ? 'bg-red-100 text-red-800' :
                        viewingRule.alert_severity === 'high' ? 'bg-orange-100 text-orange-800' :
                        viewingRule.alert_severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }>
                        {viewingRule.alert_severity}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="space-y-3">
                <h5 className="font-medium">Performance Metrics</h5>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold">{viewingRule.total_detections}</div>
                    <div className="text-xs text-muted-foreground">Total Detections</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold">{viewingRule.true_positives}</div>
                    <div className="text-xs text-muted-foreground">True Positives</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold">{calculateAccuracy(viewingRule).toFixed(1)}%</div>
                    <div className="text-xs text-muted-foreground">Accuracy</div>
                  </div>
                </div>
              </div>

              {/* Detection Configuration JSON */}
              <div className="space-y-3">
                <h5 className="font-medium">Detection Configuration</h5>
                <div className="bg-muted p-3 rounded-lg">
                  <pre className="text-xs overflow-auto max-h-32">
                    {JSON.stringify(viewingRule.detection_config, null, 2)}
                  </pre>
                </div>
              </div>

              {/* Threshold Configuration JSON */}
              <div className="space-y-3">
                <h5 className="font-medium">Threshold Configuration</h5>
                <div className="bg-muted p-3 rounded-lg">
                  <pre className="text-xs overflow-auto max-h-32">
                    {JSON.stringify(viewingRule.threshold_config, null, 2)}
                  </pre>
                </div>
              </div>

              {/* Timestamps */}
              <div className="space-y-3">
                <h5 className="font-medium">Timeline</h5>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Created:</span>
                    <span className="ml-2 font-medium">{formatDateTime(viewingRule.created_at)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last Updated:</span>
                    <span className="ml-2 font-medium">{formatDateTime(viewingRule.updated_at)}</span>
                  </div>
                  {viewingRule.last_detection_at && (
                    <div>
                      <span className="text-muted-foreground">Last Detection:</span>
                      <span className="ml-2 font-medium">{formatDateTime(viewingRule.last_detection_at)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewRuleDialogOpen(false)}>
              Close
            </Button>
            {viewingRule && (
              <Button onClick={() => {
                setIsViewRuleDialogOpen(false)
                handleOpenSettings(viewingRule)
              }}>
                <Settings className="h-4 w-4 mr-2" />
                Edit Rule
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Result Dialog */}
      <Dialog open={isViewResultDialogOpen} onOpenChange={setIsViewResultDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detection Result Details</DialogTitle>
            <DialogDescription>
              View detailed information about this anomaly detection result.
            </DialogDescription>
          </DialogHeader>

          {viewingResult && (
            <div className="grid gap-6 py-4">
              {/* Header Information */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  {viewingResult.is_anomaly ? (
                    <AlertTriangle className="h-6 w-6 text-orange-500" />
                  ) : (
                    <CheckCircle className="h-6 w-6 text-green-500" />
                  )}
                  <div>
                    <h4 className="text-lg font-medium">{viewingResult.metric_name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      {viewingResult.is_anomaly && (
                        <>
                          <Badge className={
                            viewingResult.severity === 'critical' ? 'bg-red-100 text-red-800' :
                            viewingResult.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                            viewingResult.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }>
                            {viewingResult.severity}
                          </Badge>
                          <Badge className={
                            viewingResult.confidence_level === 'high' ? 'bg-green-100 text-green-800' :
                            viewingResult.confidence_level === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }>
                            {viewingResult.confidence_level} confidence
                          </Badge>
                        </>
                      )}
                      {viewingResult.alert_generated && (
                        <Badge className="bg-red-100 text-red-800">
                          Alert Generated
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Detection Values */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h5 className="font-medium">Detection Values</h5>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Actual Value:</span>
                      <span className="font-medium">{viewingResult.actual_value}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Baseline Value:</span>
                      <span className="font-medium">{viewingResult.baseline_value}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Deviation:</span>
                      <span className={`font-medium ${viewingResult.is_anomaly ? 'text-red-600' : 'text-green-600'}`}>
                        {viewingResult.deviation_percentage}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Anomaly Score:</span>
                      <span className="font-medium">{viewingResult.anomaly_score}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h5 className="font-medium">Classification</h5>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Is Anomaly:</span>
                      <Badge className={viewingResult.is_anomaly ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}>
                        {viewingResult.is_anomaly ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                    {viewingResult.entity_type && viewingResult.entity_id && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Entity:</span>
                        <span className="font-medium">{viewingResult.entity_type}:{viewingResult.entity_id}</span>
                      </div>
                    )}
                    {viewingResult.alert_id && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Alert ID:</span>
                        <span className="font-medium">{viewingResult.alert_id}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Time Window */}
              <div className="space-y-3">
                <h5 className="font-medium">Detection Time Window</h5>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Window Start:</span>
                    <span className="ml-2 font-medium">{formatDateTime(viewingResult.time_window_start)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Window End:</span>
                    <span className="ml-2 font-medium">{formatDateTime(viewingResult.time_window_end)}</span>
                  </div>
                </div>
              </div>

              {/* Detection Details */}
              <div className="space-y-3">
                <h5 className="font-medium">Detection Details</h5>
                <div className="bg-muted p-3 rounded-lg">
                  <pre className="text-xs overflow-auto max-h-32">
                    {JSON.stringify(viewingResult.detection_details, null, 2)}
                  </pre>
                </div>
              </div>

              {/* Contributing Factors */}
              {viewingResult.contributing_factors && viewingResult.contributing_factors.length > 0 && (
                <div className="space-y-3">
                  <h5 className="font-medium">Contributing Factors</h5>
                  <div className="space-y-1">
                    {viewingResult.contributing_factors.map((factor, index) => (
                      <div key={index} className="text-sm bg-muted p-2 rounded">
                        {factor}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewResultDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
