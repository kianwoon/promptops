import React, { useState, useEffect } from 'react'
import {
  Fingerprint,
  Shield,
  AlertTriangle,
  Plus,
  RefreshCw,
  Download,
  Upload,
  Settings,
  Search,
  Filter,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  Globe,
  Server,
  User,
  Mail
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { makeAuthenticatedRequest } from '@/lib/googleAuth'
import { useAuth } from '@/contexts/AuthContext'

interface ThreatIntelligenceFeed {
  id: string
  name: string
  description?: string
  feed_type: string
  source_url?: string
  is_active: boolean
  update_frequency_minutes: number
  last_updated_at?: string
  next_update_at?: string
  status: string
  total_indicators: number
  new_indicators_last_update: number
  created_at: string
}

interface ThreatIndicator {
  id: string
  indicator_type: string
  indicator_value: string
  threat_type: string
  threat_actor?: string
  confidence_score?: string
  severity?: string
  description?: string
  tags?: string[]
  is_active: boolean
  is_false_positive: boolean
  times_detected: number
  last_detected_at?: string
  auto_blocked: boolean
  block_reason?: string
  first_seen?: string
  last_seen?: string
  expires_at?: string
}

export function ThreatIntelligencePanel() {
  const [feeds, setFeeds] = useState<ThreatIntelligenceFeed[]>([])
  const [indicators, setIndicators] = useState<ThreatIndicator[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('feeds')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [isAddFeedDialogOpen, setIsAddFeedDialogOpen] = useState(false)
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingFeed, setEditingFeed] = useState<ThreatIntelligenceFeed | null>(null)
  const [newFeed, setNewFeed] = useState({
    name: '',
    description: '',
    feed_type: '',
    source_url: '',
    update_frequency_minutes: 60,
    is_active: true
  })
  const { user } = useAuth()

  useEffect(() => {
    loadThreatIntelligenceData()
  }, [])

  const loadThreatIntelligenceData = async () => {
    setLoading(true)
    try {
      const tenantId = user?.organization || 'default-tenant'

      const [feedsData, indicatorsData] = await Promise.all([
        makeAuthenticatedRequest<ThreatIntelligenceFeed[]>(
          `/api/v1/governance/security/threat-intelligence/feeds?tenant_id=${encodeURIComponent(tenantId)}`
        ),
        makeAuthenticatedRequest<ThreatIndicator[]>(
          `/api/v1/governance/security/threat-intelligence/indicators?tenant_id=${encodeURIComponent(tenantId)}`
        )
      ])

      setFeeds(feedsData)
      setIndicators(indicatorsData)
    } catch (error) {
      console.error('Failed to load threat intelligence data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddFeed = async () => {
    if (!newFeed.name || !newFeed.feed_type) {
      alert('Name and feed type are required')
      return
    }

    setIsSubmitting(true)
    try {
      const tenantId = user?.organization || 'default-tenant'
      const response = await makeAuthenticatedRequest<ThreatIntelligenceFeed>(
        `/api/v1/governance/security/threat-intelligence/feeds?tenant_id=${encodeURIComponent(tenantId)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(newFeed)
        }
      )

      // Add the new feed to the list
      setFeeds(prev => [...prev, response])

      // Reset form and close dialog
      setNewFeed({
        name: '',
        description: '',
        feed_type: '',
        source_url: '',
        update_frequency_minutes: 60,
        is_active: true
      })
      setIsAddFeedDialogOpen(false)
    } catch (error) {
      console.error('Failed to add feed:', error)
      alert('Failed to add feed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenSettings = (feed: ThreatIntelligenceFeed) => {
    setEditingFeed(feed)
    setIsSettingsDialogOpen(true)
  }

  const handleUpdateFeed = async () => {
    if (!editingFeed) return

    setIsSubmitting(true)
    try {
      const tenantId = user?.organization || 'default-tenant'
      const response = await makeAuthenticatedRequest<ThreatIntelligenceFeed>(
        `/api/v1/governance/security/threat-intelligence/feeds/${editingFeed.id}?tenant_id=${encodeURIComponent(tenantId)}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(editingFeed)
        }
      )

      // Update the feed in the list
      setFeeds(prev => prev.map(feed => feed.id === editingFeed.id ? response : feed))

      // Reset form and close dialog
      setEditingFeed(null)
      setIsSettingsDialogOpen(false)
    } catch (error) {
      console.error('Failed to update feed:', error)
      alert('Failed to update feed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getIndicatorTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'ip': return <Server className="h-4 w-4" />
      case 'domain': return <Globe className="h-4 w-4" />
      case 'url': return <Globe className="h-4 w-4" />
      case 'hash': return <Fingerprint className="h-4 w-4" />
      case 'email': return <Mail className="h-4 w-4" />
      case 'user': return <User className="h-4 w-4" />
      default: return <AlertTriangle className="h-4 w-4" />
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

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'error': return 'bg-red-100 text-red-800'
      case 'disabled': return 'bg-gray-100 text-gray-800'
      default: return 'bg-blue-100 text-blue-800'
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

  const filteredIndicators = indicators.filter(indicator => {
    const matchesSearch = searchTerm === '' ||
      indicator.indicator_value.toLowerCase().includes(searchTerm.toLowerCase()) ||
      indicator.threat_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      indicator.description?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesType = filterType === 'all' || indicator.indicator_type === filterType
    const matchesStatus = filterStatus === 'all' ||
      (filterStatus === 'active' && indicator.is_active) ||
      (filterStatus === 'blocked' && indicator.auto_blocked) ||
      (filterStatus === 'false_positive' && indicator.is_false_positive)

    return matchesSearch && matchesType && matchesStatus
  })

  const feedStats = {
    totalFeeds: feeds.length,
    activeFeeds: feeds.filter(f => f.is_active).length,
    totalIndicators: feeds.reduce((sum, f) => sum + f.total_indicators, 0),
    newIndicators: feeds.reduce((sum, f) => sum + f.new_indicators_last_update, 0)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading threat intelligence...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Threat Intelligence Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border-2 hover:border-primary/20 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/60"></div>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                <Fingerprint className="h-6 w-6" />
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{feedStats.totalFeeds}</p>
                <p className="text-sm font-medium text-muted-foreground">Total Feeds</p>
                <p className="text-xs text-muted-foreground">
                  {feedStats.activeFeeds} active
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border-2 hover:border-primary/20 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/60"></div>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-full bg-gradient-to-r from-violet-500 to-purple-500 text-white">
                <Shield className="h-6 w-6" />
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{feedStats.totalIndicators}</p>
                <p className="text-sm font-medium text-muted-foreground">Indicators</p>
                <p className="text-xs text-muted-foreground">
                  {feedStats.newIndicators} new
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
                <p className="text-2xl font-bold">
                  {indicators.filter(i => i.auto_blocked).length}
                </p>
                <p className="text-sm font-medium text-muted-foreground">Blocked</p>
                <p className="text-xs text-muted-foreground">
                  {((indicators.filter(i => i.auto_blocked).length / indicators.length) * 100).toFixed(1)}% of total
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border-2 hover:border-primary/20 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/60"></div>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                <XCircle className="h-6 w-6" />
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">
                  {indicators.filter(i => i.is_false_positive).length}
                </p>
                <p className="text-sm font-medium text-muted-foreground">False Positives</p>
                <p className="text-xs text-muted-foreground">
                  {((indicators.filter(i => i.is_false_positive).length / indicators.length) * 100).toFixed(1)}% of total
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
            <TabsTrigger value="feeds">Intelligence Feeds</TabsTrigger>
            <TabsTrigger value="indicators">Threat Indicators</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadThreatIntelligenceData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        <TabsContent value="feeds" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Threat Intelligence Feeds</CardTitle>
                  <CardDescription>
                    Manage external threat intelligence feeds and data sources
                  </CardDescription>
                </div>
                <Button onClick={() => setIsAddFeedDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Feed
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {feeds.map((feed) => (
                  <div key={feed.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <Fingerprint className="h-6 w-6 text-blue-500" />
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{feed.name}</h4>
                          <Badge className={getStatusColor(feed.status)}>
                            {feed.status}
                          </Badge>
                          {!feed.is_active && (
                            <Badge className="bg-gray-100 text-gray-800">Inactive</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {feed.description || `Type: ${feed.feed_type}`}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Updates every {feed.update_frequency_minutes}m
                          </span>
                          <span>{feed.total_indicators} indicators</span>
                          {feed.last_updated_at && (
                            <span>Last updated: {formatTimeAgo(feed.last_updated_at)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleOpenSettings(feed)}>
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="indicators" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Threat Indicators</CardTitle>
              <CardDescription>
                Known malicious indicators and their blocking status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex items-center gap-4 mb-6">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search indicators..."
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
                    <SelectItem value="ip">IP Address</SelectItem>
                    <SelectItem value="domain">Domain</SelectItem>
                    <SelectItem value="url">URL</SelectItem>
                    <SelectItem value="hash">Hash</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                    <SelectItem value="false_positive">False Positive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Indicators List */}
              <div className="space-y-3">
                {filteredIndicators.map((indicator) => (
                  <div key={indicator.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        {getIndicatorTypeIcon(indicator.indicator_type)}
                        <div className={`w-3 h-3 rounded-full ${getSeverityColor(indicator.severity)}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium font-mono text-sm">{indicator.indicator_value}</h4>
                          <Badge variant="outline">{indicator.indicator_type}</Badge>
                          <Badge variant="outline">{indicator.threat_type}</Badge>
                          {indicator.severity && (
                            <Badge className={getSeverityColor(indicator.severity)}>
                              {indicator.severity}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {indicator.description || `Threat: ${indicator.threat_type}`}
                          {indicator.threat_actor && ` • Actor: ${indicator.threat_actor}`}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Fingerprint className="h-3 w-3" />
                            Detected {indicator.times_detected} times
                          </span>
                          {indicator.last_detected_at && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Last seen: {formatTimeAgo(indicator.last_detected_at)}
                            </span>
                          )}
                          {indicator.expires_at && (
                            <span>Expires: {new Date(indicator.expires_at).toLocaleDateString()}</span>
                          )}
                        </div>
                        {indicator.tags && indicator.tags.length > 0 && (
                          <div className="flex items-center gap-2 mt-2">
                            {indicator.tags.slice(0, 3).map((tag, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                            {indicator.tags.length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{indicator.tags.length - 3} more
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {indicator.auto_blocked ? (
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Blocked
                        </Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-800">
                          <XCircle className="h-3 w-3 mr-1" />
                          Not Blocked
                        </Badge>
                      )}
                      {indicator.is_false_positive && (
                        <Badge className="bg-orange-100 text-orange-800">
                          False Positive
                        </Badge>
                      )}
                      {!indicator.is_active && (
                        <Badge className="bg-gray-100 text-gray-800">
                          Inactive
                        </Badge>
                      )}
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4" />
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
              <CardTitle>Threat Intelligence Analytics</CardTitle>
              <CardDescription>
                Analytics and insights from threat intelligence data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Indicator Types Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Indicator Types</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {['ip', 'domain', 'url', 'hash', 'email', 'user'].map((type) => {
                        const count = indicators.filter(i => i.indicator_type === type).length
                        const percentage = indicators.length > 0 ? (count / indicators.length) * 100 : 0
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

                {/* Threat Types Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Threat Types</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Array.from(new Set(indicators.map(i => i.threat_type))).slice(0, 6).map((type) => {
                        const count = indicators.filter(i => i.threat_type === type).length
                        const percentage = indicators.length > 0 ? (count / indicators.length) * 100 : 0
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Threat Intelligence Settings</CardTitle>
              <CardDescription>
                Configure threat intelligence collection and processing settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-3">Collection Settings</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Automatic feed updates</span>
                        <Button variant="outline" size="sm">Configure</Button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Indicator deduplication</span>
                        <Button variant="outline" size="sm">Configure</Button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Data retention period</span>
                        <Button variant="outline" size="sm">Configure</Button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Processing Settings</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Auto-blocking rules</span>
                        <Button variant="outline" size="sm">Configure</Button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">False positive detection</span>
                        <Button variant="outline" size="sm">Configure</Button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Alert thresholds</span>
                        <Button variant="outline" size="sm">Configure</Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3">Manual Operations</h4>
                  <div className="flex items-center gap-2">
                    <Button variant="outline">
                      <Upload className="h-4 w-4 mr-2" />
                      Import Indicators
                    </Button>
                    <Button variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      Export Indicators
                    </Button>
                    <Button variant="outline">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh All Feeds
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Feed Dialog */}
      <Dialog open={isAddFeedDialogOpen} onOpenChange={setIsAddFeedDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Threat Intelligence Feed</DialogTitle>
            <DialogDescription>
              Configure a new threat intelligence feed to monitor for security threats.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name *
              </Label>
              <Input
                id="name"
                value={newFeed.name}
                onChange={(e) => setNewFeed(prev => ({ ...prev, name: e.target.value }))}
                className="col-span-3"
                placeholder="Enter feed name"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">
                Description
              </Label>
              <Textarea
                id="description"
                value={newFeed.description}
                onChange={(e) => setNewFeed(prev => ({ ...prev, description: e.target.value }))}
                className="col-span-3"
                placeholder="Enter feed description"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="feed_type" className="text-right">
                Feed Type *
              </Label>
              <Select
                value={newFeed.feed_type}
                onValueChange={(value) => setNewFeed(prev => ({ ...prev, feed_type: value }))}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select feed type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="xml">XML</SelectItem>
                  <SelectItem value="stix">STIX</SelectItem>
                  <SelectItem value="taxii">TAXII</SelectItem>
                  <SelectItem value="api">API</SelectItem>
                  <SelectItem value="rss">RSS</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="source_url" className="text-right">
                Source URL
              </Label>
              <Input
                id="source_url"
                value={newFeed.source_url}
                onChange={(e) => setNewFeed(prev => ({ ...prev, source_url: e.target.value }))}
                className="col-span-3"
                placeholder="https://example.com/feed.json"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="update_frequency" className="text-right">
                Update Frequency
              </Label>
              <Select
                value={newFeed.update_frequency_minutes.toString()}
                onValueChange={(value) => setNewFeed(prev => ({ ...prev, update_frequency_minutes: parseInt(value) }))}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                  <SelectItem value="240">4 hours</SelectItem>
                  <SelectItem value="360">6 hours</SelectItem>
                  <SelectItem value="720">12 hours</SelectItem>
                  <SelectItem value="1440">24 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="is_active" className="text-right">
                Active
              </Label>
              <Select
                value={newFeed.is_active.toString()}
                onValueChange={(value) => setNewFeed(prev => ({ ...prev, is_active: value === 'true' }))}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddFeedDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddFeed} disabled={isSubmitting || !newFeed.name || !newFeed.feed_type}>
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Feed'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Configure Threat Intelligence Feed</DialogTitle>
            <DialogDescription>
              Update the configuration for this threat intelligence feed.
            </DialogDescription>
          </DialogHeader>
          {editingFeed && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-name" className="text-right">
                  Name *
                </Label>
                <Input
                  id="edit-name"
                  value={editingFeed.name}
                  onChange={(e) => setEditingFeed(prev => prev ? { ...prev, name: e.target.value } : null)}
                  className="col-span-3"
                  placeholder="Enter feed name"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-description" className="text-right">
                  Description
                </Label>
                <Textarea
                  id="edit-description"
                  value={editingFeed.description || ''}
                  onChange={(e) => setEditingFeed(prev => prev ? { ...prev, description: e.target.value } : null)}
                  className="col-span-3"
                  placeholder="Enter feed description"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-feed_type" className="text-right">
                  Feed Type *
                </Label>
                <Select
                  value={editingFeed.feed_type}
                  onValueChange={(value) => setEditingFeed(prev => prev ? { ...prev, feed_type: value } : null)}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select feed type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="json">JSON</SelectItem>
                    <SelectItem value="xml">XML</SelectItem>
                    <SelectItem value="stix">STIX</SelectItem>
                    <SelectItem value="taxii">TAXII</SelectItem>
                    <SelectItem value="api">API</SelectItem>
                    <SelectItem value="rss">RSS</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-source_url" className="text-right">
                  Source URL
                </Label>
                <Input
                  id="edit-source_url"
                  value={editingFeed.source_url || ''}
                  onChange={(e) => setEditingFeed(prev => prev ? { ...prev, source_url: e.target.value } : null)}
                  className="col-span-3"
                  placeholder="https://example.com/feed.json"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-update_frequency" className="text-right">
                  Update Frequency
                </Label>
                <Select
                  value={editingFeed.update_frequency_minutes.toString()}
                  onValueChange={(value) => setEditingFeed(prev => prev ? { ...prev, update_frequency_minutes: parseInt(value) } : null)}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                    <SelectItem value="240">4 hours</SelectItem>
                    <SelectItem value="360">6 hours</SelectItem>
                    <SelectItem value="720">12 hours</SelectItem>
                    <SelectItem value="1440">24 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-is_active" className="text-right">
                  Active
                </Label>
                <Select
                  value={editingFeed.is_active.toString()}
                  onValueChange={(value) => setEditingFeed(prev => prev ? { ...prev, is_active: value === 'true' } : null)}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSettingsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateFeed}
              disabled={isSubmitting || !editingFeed || !editingFeed.name || !editingFeed.feed_type}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Feed'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
