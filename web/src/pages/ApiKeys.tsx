import React, { useState, useEffect } from 'react'
import {
  Key,
  Plus,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  Calendar,
  BarChart3,
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  X
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { useAuth, usePermission } from '@/contexts/AuthContext'
import { formatDate } from '@/lib/utils'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

// API interfaces
interface Project {
  id: string
  name: string
  description?: string
  created_at: string
  updated_at: string
}

interface ClientApiKey {
  id: string
  user_id: string
  tenant_id: string
  name: string
  description?: string
  api_key_prefix: string
  api_key?: string
  secret_key?: string
  rate_limit_per_minute: number
  rate_limit_per_hour: number
  rate_limit_per_day: number
  allowed_projects?: string[]
  allowed_scopes: string[]
  status: 'active' | 'revoked' | 'expired'
  last_used_at?: string
  expires_at?: string
  created_at: string
  updated_at: string
}

interface UsageStats {
  total_requests: number
  total_tokens_requested: number
  total_tokens_used: number
  total_cost_usd: string
  average_response_time_ms: number
  success_rate: number
  period_start: string
  period_end: string
}

interface UsageLimits {
  current_usage_minute: number
  current_usage_hour: number
  current_usage_day: number
  limits_minute: number
  limits_hour: number
  limits_day: number
  remaining_minute: number
  remaining_hour: number
  remaining_day: number
}

interface ClientApiKeyCreateResponse {
  api_key: string
  secret_key: string
  api_key_data: ClientApiKey
}

// API service functions
const fetchApiKeys = async (): Promise<ClientApiKey[]> => {
  const response = await fetch('/v1/client/web/auth/api-keys', {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  })
  if (!response.ok) {
    throw new Error('Failed to fetch API keys')
  }
  return response.json()
}

const createApiKey = async (data: any): Promise<ClientApiKeyCreateResponse> => {
  console.log('Sending API key creation data:', JSON.stringify(data, null, 2))
  const response = await fetch('/v1/client/auth/api-keys', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    body: JSON.stringify(data)
  })
  if (!response.ok) {
    const errorData = await response.json()
    console.error('API key creation error:', JSON.stringify(errorData, null, 2))
    const errorMessage = errorData.detail && Array.isArray(errorData.detail)
      ? errorData.detail.map((err: any) => {
          console.log('Validation error item:', JSON.stringify(err, null, 2))
          return err.msg || err.loc?.join('.') || JSON.stringify(err)
        }).join(', ')
      : errorData.detail || JSON.stringify(errorData)
    throw new Error(errorMessage || 'Failed to create API key')
  }
  return response.json()
}

const revokeApiKey = async (apiKeyId: string): Promise<void> => {
  const response = await fetch(`/v1/client/web/auth/api-keys/${apiKeyId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  })
  if (!response.ok) {
    throw new Error('Failed to revoke API key')
  }
}

const fetchUsageStats = async (): Promise<UsageStats> => {
  const response = await fetch('/v1/client/usage/stats', {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  })
  if (!response.ok) {
    throw new Error('Failed to fetch usage stats')
  }
  return response.json()
}

const fetchUsageLimits = async (): Promise<UsageLimits> => {
  const response = await fetch('/v1/client/web/usage/limits', {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  })
  if (!response.ok) {
    throw new Error('Failed to fetch usage limits')
  }
  return response.json()
}

const fetchProjects = async (): Promise<Project[]> => {
  const response = await fetch('/v1/projects', {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  })
  if (!response.ok) {
    throw new Error('Failed to fetch projects')
  }
  return response.json()
}

export function ApiKeysPage() {
  const { user, hasPermission } = useAuth()
  const queryClient = useQueryClient()
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showNewKeyDialog, setShowNewKeyDialog] = useState(false)
  const [newKeyData, setNewKeyData] = useState<ClientApiKeyCreateResponse | null>(null)
  const [copiedKeys, setCopiedKeys] = useState<{ [key: string]: boolean }>({})
  const [visibleKeys, setVisibleKeys] = useState<{ [key: string]: boolean }>({})
  const [selectedKeyForStats, setSelectedKeyForStats] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'active' | 'revoked'>('active')
  const [searchQuery, setSearchQuery] = useState('')

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    rate_limit_per_minute: 60,
    rate_limit_per_hour: 3600,
    rate_limit_per_day: 86400,
    allowed_projects: [] as string[],
    allowed_scopes: ['read'],
    expires_at: ''
  })

  // Remove permission check - API keys accessible to all users

  // Fetch API keys
  const { data: apiKeys = [], isLoading, error } = useQuery({
    queryKey: ['apiKeys'],
    queryFn: fetchApiKeys,
    enabled: true
  })

  // Fetch usage statistics
  const { data: usageStats, isLoading: statsLoading } = useQuery({
    queryKey: ['usageStats'],
    queryFn: fetchUsageStats,
    enabled: selectedKeyForStats !== null
  })

  // Fetch projects
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
    enabled: true
  })

  // Fetch usage limits
  const { data: usageLimits, isLoading: limitsLoading } = useQuery({
    queryKey: ['usageLimits'],
    queryFn: fetchUsageLimits,
    enabled: true
  })

  // Create API key mutation
  const createMutation = useMutation({
    mutationFn: createApiKey,
    onSuccess: (data) => {
      setNewKeyData(data)
      setShowCreateDialog(false)
      setShowNewKeyDialog(true)

      // Add the new API key with secret key to the list
      const newApiKeyWithSecret = {
        ...data.api_key_data,
        secret_key: data.secret_key
      }

      queryClient.setQueryData(['apiKeys'], (oldData: ClientApiKey[] = []) => {
        return [newApiKeyWithSecret, ...oldData]
      })

      queryClient.invalidateQueries({ queryKey: ['apiKeys'] })
      toast.success('API key created successfully!')
    },
    onError: (error: any) => {
      toast.error(`Failed to create API key: ${error.message}`)
    }
  })

  // Revoke API key mutation
  const revokeMutation = useMutation({
    mutationFn: revokeApiKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] })
      toast.success('API key revoked successfully')
    },
    onError: (error: any) => {
      toast.error(`Failed to revoke API key: ${error.message}`)
    }
  })

  const handleCreateApiKey = () => {
    const payload = {
      ...formData,
      allowed_projects: Array.isArray(formData.allowed_projects) ? formData.allowed_projects : [],
      expires_at: formData.expires_at ? new Date(formData.expires_at).toISOString() : null
    }
    createMutation.mutate(payload)
  }

  const handleCopyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKeys(prev => ({ ...prev, [type]: true }))
      setTimeout(() => setCopiedKeys(prev => ({ ...prev, [type]: false })), 2000)
      toast.success('Copied to clipboard!')
    } catch (err) {
      toast.error('Failed to copy to clipboard')
    }
  }

  const handleRevokeKey = (apiKeyId: string) => {
    if (confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      revokeMutation.mutate(apiKeyId)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-500">Active</Badge>
      case 'revoked':
        return <Badge variant="destructive">Revoked</Badge>
      case 'expired':
        return <Badge variant="secondary">Expired</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const toggleKeyVisibility = (keyId: string) => {
    setVisibleKeys(prev => ({ ...prev, [keyId]: !prev[keyId] }))
  }

  const handleViewStats = (apiKeyId: string) => {
    setSelectedKeyForStats(selectedKeyForStats === apiKeyId ? null : apiKeyId)
  }

  const handleClearSearch = () => {
    setSearchQuery('')
  }

  // API Keys are now accessible to all users - removed permission check

  // Filter API keys based on active tab and search query
  const filteredApiKeys = apiKeys.filter(key => {
    // First filter by status (tab)
    if (key.status !== activeTab) {
      return false
    }

    // Then filter by search query if present
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      const nameMatch = key.name.toLowerCase().includes(query)
      const descriptionMatch = key.description?.toLowerCase().includes(query)
      const prefixMatch = key.api_key_prefix.toLowerCase().includes(query)

      return nameMatch || descriptionMatch || prefixMatch
    }

    return true
  })

  // Count API keys for each tab
  const activeKeyCount = apiKeys.filter(key => key.status === 'active').length
  const revokedKeyCount = apiKeys.filter(key => key.status === 'revoked').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">API Keys</h1>
            <p className="text-muted-foreground">
              Manage your API keys for accessing PromptOps services
            </p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create API Key
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New API Key</DialogTitle>
              <DialogDescription>
                Create a new API key for accessing PromptOps services. The key will only be shown once.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Key Name</Label>
                  <Input
                    id="name"
                    placeholder="My Application Key"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    placeholder="For production environment"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Allowed Projects</Label>
                <Select
                  multiple
                  value={formData.allowed_projects}
                  onValueChange={(values) => setFormData(prev => ({ ...prev, allowed_projects: values }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select projects (leave empty for all projects)" />
                  </SelectTrigger>
                  <SelectContent>
                    {projectsLoading ? (
                      <SelectItem value="">Loading projects...</SelectItem>
                    ) : projects.length === 0 ? (
                      <SelectItem value="">No projects found</SelectItem>
                    ) : (
                      projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                          {project.description && ` - ${project.description}`}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {formData.allowed_projects.length === 0
                    ? "API key will have access to all projects"
                    : `Selected ${formData.allowed_projects.length} project(s)`}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Rate Limits</Label>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="minute" className="text-sm">Per Minute</Label>
                    <Input
                      id="minute"
                      type="number"
                      value={formData.rate_limit_per_minute}
                      onChange={(e) => setFormData(prev => ({ ...prev, rate_limit_per_minute: parseInt(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="hour" className="text-sm">Per Hour</Label>
                    <Input
                      id="hour"
                      type="number"
                      value={formData.rate_limit_per_hour}
                      onChange={(e) => setFormData(prev => ({ ...prev, rate_limit_per_hour: parseInt(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="day" className="text-sm">Per Day</Label>
                    <Input
                      id="day"
                      type="number"
                      value={formData.rate_limit_per_day}
                      onChange={(e) => setFormData(prev => ({ ...prev, rate_limit_per_day: parseInt(e.target.value) }))}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="scopes">Permissions (Scopes)</Label>
                <Select
                  value={formData.allowed_scopes[0]}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, allowed_scopes: [value] }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select permissions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="read">Read Only</SelectItem>
                    <SelectItem value="write">Read & Write</SelectItem>
                    <SelectItem value="admin">Full Access</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expires">Expires At (Optional)</Label>
                <Input
                  id="expires"
                  type="datetime-local"
                  value={formData.expires_at}
                  onChange={(e) => setFormData(prev => ({ ...prev, expires_at: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateApiKey}
                disabled={!formData.name || createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating...' : 'Create API Key'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search API keys by name, description, or prefix..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearSearch}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Usage Statistics Overview */}
      {usageLimits && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Current Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Minute:</span>
                  <span>{usageLimits.current_usage_minute} / {usageLimits.limits_minute}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Hour:</span>
                  <span>{usageLimits.current_usage_hour} / {usageLimits.limits_hour}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Day:</span>
                  <span>{usageLimits.current_usage_day} / {usageLimits.limits_day}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Remaining Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Minute:</span>
                  <span className="font-medium">{usageLimits.remaining_minute}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Hour:</span>
                  <span className="font-medium">{usageLimits.remaining_hour}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Day:</span>
                  <span className="font-medium">{usageLimits.remaining_day}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {usageStats && (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Request Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Total Requests:</span>
                      <span className="font-medium">{usageStats.total_requests}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Success Rate:</span>
                      <span className="font-medium">{(usageStats.success_rate * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Avg Response:</span>
                      <span className="font-medium">{usageStats.average_response_time_ms.toFixed(0)}ms</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Token Usage</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Tokens Used:</span>
                      <span className="font-medium">{usageStats.total_tokens_used.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Cost:</span>
                      <span className="font-medium">${usageStats.total_cost_usd}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Period:</span>
                      <span className="text-xs">30 days</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* API Keys List */}
      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading API keys...</p>
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load API keys. Please try again later.
          </AlertDescription>
        </Alert>
      ) : apiKeys.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Key className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No API Keys</h3>
            <p className="text-muted-foreground mb-4">
              Create your first API key to start using PromptOps services.
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create API Key
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={(value) => {
    setActiveTab(value as 'active' | 'revoked')
    setSearchQuery('') // Clear search when switching tabs
  }}>
          <TabsList>
            <TabsTrigger value="active" className="flex items-center space-x-2">
              <span>Active</span>
              <Badge variant="secondary" className="ml-2">
                {activeKeyCount}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="revoked" className="flex items-center space-x-2">
              <span>Revoked</span>
              <Badge variant="secondary" className="ml-2">
                {revokedKeyCount}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            {filteredApiKeys.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Search className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    {searchQuery ? 'No Matching API Keys' : 'No Active API Keys'}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {searchQuery
                      ? `No active API keys found matching "${searchQuery}". Try a different search term.`
                      : 'Create your first API key to start using PromptOps services.'
                    }
                  </p>
                  {!searchQuery && (
                    <Button onClick={() => setShowCreateDialog(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create API Key
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              filteredApiKeys.map((apiKey) => (
            <Card key={apiKey.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div>
                      <CardTitle className="flex items-center space-x-2">
                        <span>{apiKey.name}</span>
                        {getStatusBadge(apiKey.status)}
                      </CardTitle>
                      {apiKey.description && (
                        <CardDescription>{apiKey.description}</CardDescription>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewStats(apiKey.id)}
                    >
                      <BarChart3 className="w-4 h-4 mr-2" />
                      {selectedKeyForStats === apiKey.id ? 'Hide Stats' : 'View Stats'}
                    </Button>
                    {apiKey.status === 'active' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRevokeKey(apiKey.id)}
                        disabled={revokeMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Revoke
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">API Key Prefix</Label>
                        <div className="flex items-center space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleKeyVisibility(`${apiKey.id}-prefix`)}
                            className="h-6 w-6 p-0"
                          >
                            {visibleKeys[`${apiKey.id}-prefix`] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyToClipboard(apiKey.api_key_prefix, `${apiKey.id}-prefix`)}
                            className="h-6 w-6 p-0"
                          >
                            {copiedKeys[`${apiKey.id}-prefix`] ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          </Button>
                        </div>
                      </div>
                      <div className="font-mono text-sm bg-muted p-2 rounded">
                        {visibleKeys[`${apiKey.id}-prefix`] ? apiKey.api_key_prefix : '••••••••'}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">API Key</Label>
                        <div className="flex items-center space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleKeyVisibility(`${apiKey.id}-full`)}
                            className="h-6 w-6 p-0"
                          >
                            {visibleKeys[`${apiKey.id}-full`] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyToClipboard(apiKey.api_key || apiKey.api_key_prefix + '••••••••', `${apiKey.id}-full`)}
                            className="h-6 w-6 p-0"
                            title={apiKey.api_key ? "Copy full API key" : "Full API key only available on creation"}
                          >
                            {copiedKeys[`${apiKey.id}-full`] ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          </Button>
                        </div>
                      </div>
                      <div className="font-mono text-sm bg-muted p-2 rounded">
                        {visibleKeys[`${apiKey.id}-full`]
                          ? (apiKey.api_key || apiKey.api_key_prefix + '••••••••')
                          : '••••••••••••••'
                        }
                      </div>
                      {!visibleKeys[`${apiKey.id}-full`] && apiKey.api_key && (
                        <p className="text-xs text-muted-foreground">Click eye icon to reveal full API key</p>
                      )}
                      {!visibleKeys[`${apiKey.id}-full`] && !apiKey.api_key && (
                        <p className="text-xs text-muted-foreground">Full API key cannot be retrieved - may require server restart</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Secret Key</Label>
                        <div className="flex items-center space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleKeyVisibility(`${apiKey.id}-secret`)}
                            className="h-6 w-6 p-0"
                          >
                            {visibleKeys[`${apiKey.id}-secret`] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyToClipboard(apiKey.secret_key || 'secret-key-not-available', `${apiKey.id}-secret`)}
                            className="h-6 w-6 p-0"
                            title={apiKey.secret_key ? "Copy secret key" : "Secret key only available on creation"}
                          >
                            {copiedKeys[`${apiKey.id}-secret`] ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          </Button>
                        </div>
                      </div>
                      <div className="font-mono text-sm bg-muted p-2 rounded">
                        {visibleKeys[`${apiKey.id}-secret`]
                          ? (apiKey.secret_key || '•••••••••••••••••••••••••••••••••••••••••••••••••••')
                          : '•••••••••••••••••••••••••••••••••••••••••••••••••••'
                        }
                      </div>
                      {!visibleKeys[`${apiKey.id}-secret`] && apiKey.secret_key && (
                        <p className="text-xs text-muted-foreground">Click eye icon to reveal secret key</p>
                      )}
                      {!visibleKeys[`${apiKey.id}-secret`] && !apiKey.secret_key && (
                        <p className="text-xs text-muted-foreground">Secret key cannot be retrieved - may require server restart</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Rate Limits</Label>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Per minute:</span>
                        <span>{apiKey.rate_limit_per_minute.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Per hour:</span>
                        <span>{apiKey.rate_limit_per_hour.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Per day:</span>
                        <span>{apiKey.rate_limit_per_day.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Permissions</Label>
                    <div className="flex flex-wrap gap-1">
                      {apiKey.allowed_scopes.map((scope) => (
                        <Badge key={scope} variant="outline" className="text-xs">
                          {scope}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Created</Label>
                    <div className="text-sm text-muted-foreground">
                      {formatDate(apiKey.created_at)}
                    </div>
                  </div>

                  {apiKey.last_used_at && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Last Used</Label>
                      <div className="text-sm text-muted-foreground">
                        {formatDate(apiKey.last_used_at)}
                      </div>
                    </div>
                  )}

                  {apiKey.expires_at && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Expires</Label>
                      <div className="text-sm text-muted-foreground">
                        {formatDate(apiKey.expires_at)}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>

              {/* Detailed Statistics Section */}
              {selectedKeyForStats === apiKey.id && usageStats && (
                <CardContent className="border-t pt-6">
                  <div className="mt-6">
                    <h4 className="text-lg font-semibold mb-4 flex items-center">
                      <BarChart3 className="w-5 h-5 mr-2" />
                      Detailed Usage Statistics
                    </h4>
                    {statsLoading ? (
                      <div className="text-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                        <p className="mt-2 text-sm text-muted-foreground">Loading statistics...</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Requests</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">{usageStats.total_requests}</div>
                            <div className="text-xs text-muted-foreground">
                              Total in last 30 days
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">{(usageStats.success_rate * 100).toFixed(1)}%</div>
                            <div className="text-xs text-muted-foreground">
                              Successful requests
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">{usageStats.average_response_time_ms.toFixed(0)}ms</div>
                            <div className="text-xs text-muted-foreground">
                              Average processing time
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">${usageStats.total_cost_usd}</div>
                            <div className="text-xs text-muted-foreground">
                              Estimated usage cost
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="revoked" className="space-y-4">
            {filteredApiKeys.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Search className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    {searchQuery ? 'No Matching API Keys' : 'No Revoked API Keys'}
                  </h3>
                  <p className="text-muted-foreground">
                    {searchQuery
                      ? `No revoked API keys found matching "${searchQuery}". Try a different search term.`
                      : 'No API keys have been revoked yet.'
                    }
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredApiKeys.map((apiKey) => (
            <Card key={apiKey.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div>
                      <CardTitle className="flex items-center space-x-2">
                        <span>{apiKey.name}</span>
                        {getStatusBadge(apiKey.status)}
                      </CardTitle>
                      {apiKey.description && (
                        <CardDescription>{apiKey.description}</CardDescription>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewStats(apiKey.id)}
                    >
                      <BarChart3 className="w-4 h-4 mr-2" />
                      {selectedKeyForStats === apiKey.id ? 'Hide Stats' : 'View Stats'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">API Key Prefix</Label>
                        <div className="flex items-center space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleKeyVisibility(`${apiKey.id}-prefix`)}
                            className="h-6 w-6 p-0"
                          >
                            {visibleKeys[`${apiKey.id}-prefix`] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyToClipboard(apiKey.api_key_prefix, `${apiKey.id}-prefix`)}
                            className="h-6 w-6 p-0"
                          >
                            {copiedKeys[`${apiKey.id}-prefix`] ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          </Button>
                        </div>
                      </div>
                      <div className="font-mono text-sm bg-muted p-2 rounded">
                        {visibleKeys[`${apiKey.id}-prefix`] ? apiKey.api_key_prefix : '••••••••'}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">API Key</Label>
                        <div className="flex items-center space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleKeyVisibility(`${apiKey.id}-full`)}
                            className="h-6 w-6 p-0"
                          >
                            {visibleKeys[`${apiKey.id}-full`] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyToClipboard(apiKey.api_key || apiKey.api_key_prefix + '••••••••', `${apiKey.id}-full`)}
                            className="h-6 w-6 p-0"
                            title={apiKey.api_key ? "Copy full API key" : "Full API key only available on creation"}
                          >
                            {copiedKeys[`${apiKey.id}-full`] ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          </Button>
                        </div>
                      </div>
                      <div className="font-mono text-sm bg-muted p-2 rounded">
                        {visibleKeys[`${apiKey.id}-full`]
                          ? (apiKey.api_key || apiKey.api_key_prefix + '••••••••')
                          : '••••••••••••••'
                        }
                      </div>
                      {!visibleKeys[`${apiKey.id}-full`] && apiKey.api_key && (
                        <p className="text-xs text-muted-foreground">Click eye icon to reveal full API key</p>
                      )}
                      {!visibleKeys[`${apiKey.id}-full`] && !apiKey.api_key && (
                        <p className="text-xs text-muted-foreground">Full API key cannot be retrieved - may require server restart</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Secret Key</Label>
                        <div className="flex items-center space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleKeyVisibility(`${apiKey.id}-secret`)}
                            className="h-6 w-6 p-0"
                          >
                            {visibleKeys[`${apiKey.id}-secret`] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyToClipboard(apiKey.secret_key || 'secret-key-not-available', `${apiKey.id}-secret`)}
                            className="h-6 w-6 p-0"
                            title={apiKey.secret_key ? "Copy secret key" : "Secret key only available on creation"}
                          >
                            {copiedKeys[`${apiKey.id}-secret`] ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          </Button>
                        </div>
                      </div>
                      <div className="font-mono text-sm bg-muted p-2 rounded">
                        {visibleKeys[`${apiKey.id}-secret`]
                          ? (apiKey.secret_key || '•••••••••••••••••••••••••••••••••••••••••••••••••••')
                          : '•••••••••••••••••••••••••••••••••••••••••••••••••••'
                        }
                      </div>
                      {!visibleKeys[`${apiKey.id}-secret`] && apiKey.secret_key && (
                        <p className="text-xs text-muted-foreground">Click eye icon to reveal secret key</p>
                      )}
                      {!visibleKeys[`${apiKey.id}-secret`] && !apiKey.secret_key && (
                        <p className="text-xs text-muted-foreground">Secret key cannot be retrieved - may require server restart</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Rate Limits</Label>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Per minute:</span>
                        <span>{apiKey.rate_limit_per_minute.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Per hour:</span>
                        <span>{apiKey.rate_limit_per_hour.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Per day:</span>
                        <span>{apiKey.rate_limit_per_day.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Permissions</Label>
                    <div className="flex flex-wrap gap-1">
                      {apiKey.allowed_scopes.map((scope) => (
                        <Badge key={scope} variant="outline" className="text-xs">
                          {scope}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Created</Label>
                    <div className="text-sm text-muted-foreground">
                      {formatDate(apiKey.created_at)}
                    </div>
                  </div>

                  {apiKey.last_used_at && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Last Used</Label>
                      <div className="text-sm text-muted-foreground">
                        {formatDate(apiKey.last_used_at)}
                      </div>
                    </div>
                  )}

                  {apiKey.expires_at && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Expires</Label>
                      <div className="text-sm text-muted-foreground">
                        {formatDate(apiKey.expires_at)}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>

              {/* Detailed Statistics Section */}
              {selectedKeyForStats === apiKey.id && usageStats && (
                <CardContent className="border-t pt-6">
                  <div className="mt-6">
                    <h4 className="text-lg font-semibold mb-4 flex items-center">
                      <BarChart3 className="w-5 h-5 mr-2" />
                      Detailed Usage Statistics
                    </h4>
                    {statsLoading ? (
                      <div className="text-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                        <p className="mt-2 text-sm text-muted-foreground">Loading statistics...</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Requests</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">{usageStats.total_requests}</div>
                            <div className="text-xs text-muted-foreground">
                              Total in last 30 days
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">{(usageStats.success_rate * 100).toFixed(1)}%</div>
                            <div className="text-xs text-muted-foreground">
                              Successful requests
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">{usageStats.average_response_time_ms.toFixed(0)}ms</div>
                            <div className="text-xs text-muted-foreground">
                              Average processing time
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">${usageStats.total_cost_usd}</div>
                            <div className="text-xs text-muted-foreground">
                              Estimated usage cost
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* New API Key Dialog */}
      <Dialog open={showNewKeyDialog} onOpenChange={setShowNewKeyDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New API Key Created</DialogTitle>
            <DialogDescription>
              Your new API key has been created. Please copy and save it now as it won't be shown again.
            </DialogDescription>
          </DialogHeader>
          {newKeyData && (
            <div className="space-y-4">
              <Alert>
                <AlertTitle>Important!</AlertTitle>
                <AlertDescription>
                  Please save your API key and secret key securely. You will not be able to see them again.
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="apiKey" className="text-sm font-medium">API Key</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="apiKey"
                      value={newKeyData.api_key}
                      readOnly
                      className="font-mono"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyToClipboard(newKeyData.api_key, 'apiKey')}
                    >
                      {copiedKeys['apiKey'] ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="secretKey" className="text-sm font-medium">Secret Key</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="secretKey"
                      type={visibleKeys['secretKey'] ? 'text' : 'password'}
                      value={newKeyData.secret_key}
                      readOnly
                      className="font-mono"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleKeyVisibility('secretKey')}
                    >
                      {visibleKeys['secretKey'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyToClipboard(newKeyData.secret_key, 'secretKey')}
                    >
                      {copiedKeys['secretKey'] ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-medium mb-2">Key Details</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Name:</span>
                    <span className="ml-2">{newKeyData.api_key_data.name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Prefix:</span>
                    <span className="ml-2 font-mono">{newKeyData.api_key_data.api_key_prefix}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowNewKeyDialog(false)}>
              I've Saved My Keys
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </div>
  )
}