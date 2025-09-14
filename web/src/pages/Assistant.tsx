import React, { useState, useEffect } from 'react'
import {
  Bot,
  Plus,
  Settings as SettingsIcon,
  Trash2,
  Edit,
  TestTube,
  Key,
  Globe,
  Copy,
  CheckCircle,
  AlertCircle,
  Loader2,
  MessageSquare,
  FileText,
  Save,
  AlertTriangle,
  Eye,
  EyeOff,
  Star
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth, usePermission } from '@/contexts/AuthContext'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface AIProvider {
  id: string
  name: string
  provider_type: string
  status: string
  api_key?: string
  api_key_prefix?: string
  api_base_url?: string
  model_name?: string
  organization?: string
  created_at: string
  last_used_at?: string
}

interface SystemPrompt {
  id: string
  provider_id: string
  prompt_type: string
  name: string
  content: string
  description?: string
  is_mas_feat_compliant: boolean
  is_active: boolean
  created_at: string
  created_by: string
}

export function AssistantPage() {
  const { user } = useAuth()
  const [providers, setProviders] = useState<AIProvider[]>([])
  const [systemPrompts, setSystemPrompts] = useState<SystemPrompt[]>([])
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null)
  const [defaultProvider, setDefaultProvider] = useState<AIProvider | null>(null)
  const [editingProvider, setEditingProvider] = useState<string | null>(null)
  const [editingPrompt, setEditingPrompt] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [isSavingPrompt, setIsSavingPrompt] = useState(false)
  const [error, setError] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [deleteProviderInfo, setDeleteProviderInfo] = useState<{ id: string; name: string } | null>(null)
  const [deletePromptInfo, setDeletePromptInfo] = useState<{ id: string; name: string } | null>(null)
  const [testResult, setTestResult] = useState<any>(null)
  const [showApiKey, setShowApiKey] = useState(false)

  // Form states
  const [providerForm, setProviderForm] = useState({
    name: '',
    provider_type: '',
    api_key: '',
    api_base_url: '',
    model_name: '',
    organization: '',
    project: ''
  })

  const [promptForm, setPromptForm] = useState({
    name: '',
    content: '',
    description: '',
    prompt_type: 'create_prompt',
    is_mas_feat_compliant: true
  })

  // Load providers and prompts
  useEffect(() => {
    loadProviders()
    loadSystemPrompts()
    loadDefaultProvider()
  }, [])

  const loadProviders = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/v1/ai-assistant/providers', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        // Backend returns array directly, not wrapped in providers property
        setProviders(Array.isArray(data) ? data : data.providers || [])
      } else {
        setError({ type: 'error', message: "Failed to load AI providers" })
      }
    } catch (error) {
      setError({ type: 'error', message: "Failed to load providers" })
    } finally {
      setIsLoading(false)
    }
  }

  const loadDefaultProvider = async () => {
    try {
      const response = await fetch('/v1/ai-assistant/default-provider', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setDefaultProvider(data)
      } else if (response.status === 404) {
        // No default provider set
        setDefaultProvider(null)
      } else {
        console.error("Failed to load default provider")
      }
    } catch (error) {
      console.error("Failed to load default provider")
    }
  }

  const loadSystemPrompts = async () => {
    try {
      const response = await fetch('/v1/ai-assistant/system-prompts', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        // Backend returns array directly, not wrapped in system_prompts property
        setSystemPrompts(Array.isArray(data) ? data : data.system_prompts || [])
      }
    } catch (error) {
      console.error('Failed to load system prompts:', error)
    }
  }

  const handleProviderSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id) return

    setIsLoading(true)
    try {
      const response = await fetch('/v1/ai-assistant/providers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ...providerForm,
          user_id: user.id
        })
      })

      if (response.ok) {
        setError({ type: 'success', message: "AI provider added successfully" })
        setProviderForm({
          name: '',
          provider_type: '',
          api_key: '',
          api_base_url: '',
          model_name: '',
          organization: '',
          project: ''
        })
        loadProviders()
      } else {
        const error = await response.json()
        setError({ type: 'error', message: error.detail || "Failed to add provider" })
      }
    } catch (error) {
      setError({ type: 'error', message: "Failed to add provider" })
    } finally {
      setIsLoading(false)
    }
  }

  const handleProviderDelete = async (id: string, name: string) => {
    setDeleteProviderInfo({ id, name })
  }

  const handleProviderDeleteConfirm = async () => {
    if (!deleteProviderInfo) return

    try {
      const response = await fetch(`/v1/ai-assistant/providers/${deleteProviderInfo.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      if (response.ok) {
        setError({ type: 'success', message: "Provider deleted successfully" })
        loadProviders()
      } else {
        setError({ type: 'error', message: "Failed to delete provider" })
      }
    } catch (error) {
      setError({ type: 'error', message: "Failed to delete provider" })
    } finally {
      setDeleteProviderInfo(null)
    }
  }

  const handleProviderEdit = async (provider: AIProvider) => {
    try {
      // Fetch full provider details including API key
      const response = await fetch(`/v1/ai-assistant/providers/${provider.id}/edit`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      if (response.ok) {
        const fullProvider = await response.json()
        setProviderForm({
          name: fullProvider.name,
          provider_type: fullProvider.provider_type,
          api_key: fullProvider.api_key || '', // Show existing API key for editing
          api_base_url: fullProvider.api_base_url || '',
          model_name: fullProvider.model_name || '',
          organization: fullProvider.organization || '',
          project: ''
        })
        setEditingProvider(provider.id)
        setTestResult(null) // Clear test results when editing
      } else {
        setError({ type: 'error', message: "Failed to load provider details for editing" })
      }
    } catch (error) {
      setError({ type: 'error', message: "Failed to load provider details for editing" })
    }
  }

  const handleCancelEdit = () => {
    setEditingProvider(null)
    setTestResult(null)
    setShowApiKey(false)
    setProviderForm({
      name: '',
      provider_type: 'openai',
      api_key: '',
      api_base_url: '',
      model_name: '',
      organization: '',
      project: ''
    })
  }

  const toggleApiKeyVisibility = () => {
    setShowApiKey(!showApiKey)
  }

  const handleProviderUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingProvider || !user?.id) return

    setIsLoading(true)
    try {
      const response = await fetch(`/v1/ai-assistant/providers/${editingProvider}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(providerForm)
      })

      if (response.ok) {
        setError({ type: 'success', message: "Provider updated successfully" })
        handleCancelEdit()
        loadProviders()
      } else {
        const error = await response.json()
        setError({ type: 'error', message: error.detail || "Failed to update provider" })
      }
    } catch (error) {
      setError({ type: 'error', message: "Failed to update provider" })
    } finally {
      setIsLoading(false)
    }
  }

  const handlePromptSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProvider || !user?.id) return

    setIsSavingPrompt(true)
    try {
      const response = await fetch('/v1/ai-assistant/system-prompts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ...promptForm,
          provider_id: selectedProvider,
          created_by: user.id
        })
      })

      if (response.ok) {
        setError({ type: 'success', message: "System prompt added successfully" })
        setPromptForm({
          name: '',
          content: '',
          description: '',
          prompt_type: 'create_prompt',
          is_mas_feat_compliant: true
        })
        loadSystemPrompts()
      } else {
        const error = await response.json()
        setError({ type: 'error', message: error.detail || "Failed to add prompt" })
      }
    } catch (error) {
      setError({ type: 'error', message: "Failed to add prompt" })
    } finally {
      setIsSavingPrompt(false)
    }
  }

  const handlePromptEdit = (prompt: SystemPrompt) => {
    setPromptForm({
      name: prompt.name,
      content: prompt.content,
      description: prompt.description || '',
      prompt_type: prompt.prompt_type,
      is_mas_feat_compliant: prompt.is_mas_feat_compliant
    })
    setSelectedProvider(prompt.provider_id)
    setEditingPrompt(prompt.id)
  }

  const handlePromptUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingPrompt || !user?.id) return

    setIsSavingPrompt(true)
    try {
      const response = await fetch(`/v1/ai-assistant/system-prompts/${editingPrompt}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(promptForm)
      })

      if (response.ok) {
        setError({ type: 'success', message: "System prompt updated successfully" })
        setEditingPrompt(null)
        setPromptForm({
          name: '',
          content: '',
          description: '',
          prompt_type: 'create_prompt',
          is_mas_feat_compliant: true
        })
        loadSystemPrompts()
      } else {
        const error = await response.json()
        setError({ type: 'error', message: error.detail || "Failed to update prompt" })
      }
    } catch (error) {
      setError({ type: 'error', message: "Failed to update prompt" })
    } finally {
      setIsSavingPrompt(false)
    }
  }

  const handlePromptDelete = async (id: string, name: string) => {
    setDeletePromptInfo({ id, name })
  }

  const handlePromptDeleteConfirm = async () => {
    if (!deletePromptInfo) return

    try {
      const response = await fetch(`/v1/ai-assistant/system-prompts/${deletePromptInfo.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      if (response.ok) {
        setError({ type: 'success', message: "System prompt deleted successfully" })
        loadSystemPrompts()
      } else {
        setError({ type: 'error', message: "Failed to delete system prompt" })
      }
    } catch (error) {
      setError({ type: 'error', message: "Failed to delete system prompt" })
    } finally {
      setDeletePromptInfo(null)
    }
  }

  const handleProviderTest = async (id: string) => {
    setIsTesting(true)
    setTestResult(null) // Clear previous test results
    setError(null) // Clear previous errors
    try {
      const response = await fetch(`/v1/ai-assistant/providers/${id}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ test_message: 'hi' })
      })

      const result = await response.json()

      if (result.success) {
        setTestResult(result)
        setError(null) // Clear error and use custom display
      } else {
        let errorMessage = result.error_message || "Provider test failed"
        if (result.status_code) {
          errorMessage += ` (Status: ${result.status_code})`
        }
        setError({ type: 'error', message: errorMessage })
      }
    } catch (error) {
      setError({ type: 'error', message: "Failed to test provider - connection error" })
    } finally {
      setIsTesting(false)
    }
  }

  const handleSetDefaultProvider = async (providerId: string) => {
    try {
      const response = await fetch(`/v1/ai-assistant/default-provider/${providerId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setDefaultProvider(data)
        setError({ type: 'success', message: 'Default provider updated successfully' })
      } else {
        const errorData = await response.json()
        setError({ type: 'error', message: errorData.detail || 'Failed to set default provider' })
      }
    } catch (error) {
      setError({ type: 'error', message: 'Failed to set default provider' })
    }
  }

  const handleClearDefaultProvider = async () => {
    try {
      const response = await fetch('/v1/ai-assistant/default-provider', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      if (response.ok) {
        setDefaultProvider(null)
        setError({ type: 'success', message: 'Default provider cleared successfully' })
      } else {
        setError({ type: 'error', message: 'Failed to clear default provider' })
      }
    } catch (error) {
      setError({ type: 'error', message: 'Failed to clear default provider' })
    }
  }

  const providerTypeOptions = [
    { value: 'openai', label: 'OpenAI (GPT)' },
    { value: 'anthropic', label: 'Anthropic (Claude)' },
    { value: 'gemini', label: 'Google Gemini' },
    { value: 'qwen', label: 'Alibaba Qwen' },
    { value: 'openrouter', label: 'OpenRouter' },
    { value: 'ollama', label: 'Ollama (Local)' }
  ]

  const selectedProviderData = providers.find(p => p.id === selectedProvider)

  return (
    <div className="space-y-6">
      {/* Error Alert */}
      {error && (
        <div className="mb-4">
          <Alert variant={error.type === 'error' ? 'destructive' : 'default'}>
            <AlertTitle>{error.type === 'error' ? 'Error' : 'Success'}</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Test Results Display */}
      {testResult && (
        <div className="mb-4">
          <Card className="border-green-200 bg-green-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-green-800 flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Provider Test Successful
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                {/* Response Time */}
                <div className="flex items-center gap-2">
                  <span className="text-green-700">⚡</span>
                  <span className="font-medium text-green-800">Response Time:</span>
                  <span className="text-green-700">{testResult.response_time_ms}ms</span>
                </div>

                {/* AI Response */}
                {(() => {
                  const aiResponse = testResult.response_data?.response ||
                                   testResult.response_data?.mock_response ||
                                   testResult.response_data?.content ||
                                   testResult.response_data?.text
                  if (aiResponse) {
                    return (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-green-700">🤖</span>
                          <span className="font-medium text-green-800">AI Response:</span>
                        </div>
                        <div className="ml-7 p-3 bg-white rounded border border-green-200 text-green-700">
                          "{aiResponse}"
                        </div>
                      </div>
                    )
                  }
                  return null
                })()}

                {/* Token Usage */}
                {testResult.response_data?.usage && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-green-700">📊</span>
                      <span className="font-medium text-green-800">Token Usage:</span>
                    </div>
                    <div className="ml-7 space-y-1 text-green-700">
                      {testResult.response_data.usage.total_tokens && (
                        <div>• Total: {testResult.response_data.usage.total_tokens}</div>
                      )}
                      {testResult.response_data.usage.input_tokens && (
                        <div>• Input: {testResult.response_data.usage.input_tokens}</div>
                      )}
                      {testResult.response_data.usage.output_tokens && (
                        <div>• Output: {testResult.response_data.usage.output_tokens}</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Configuration */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-green-700">🔧</span>
                    <span className="font-medium text-green-800">Configuration:</span>
                  </div>
                  <div className="ml-7 space-y-1 text-green-700">
                    <div>• Provider: {testResult.response_data?.provider}</div>
                    {testResult.response_data?.model && (
                      <div>• Model: {testResult.response_data.model}</div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Assistant</h1>
          <p className="text-muted-foreground">
            Configure your AI providers and system prompts for prompt generation
          </p>
        </div>
      </div>

      <Tabs defaultValue="providers" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="providers">AI Providers</TabsTrigger>
          <TabsTrigger value="prompts">System Prompts</TabsTrigger>
          <TabsTrigger value="templates">MAS FEAT Templates</TabsTrigger>
        </TabsList>

        {/* Providers Tab */}
        <TabsContent value="providers" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Add/Edit Provider Form */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    {editingProvider ? <Edit className="h-5 w-5 mr-2" /> : <Plus className="h-5 w-5 mr-2" />}
                    {editingProvider ? 'Edit AI Provider' : 'Add AI Provider'}
                  </CardTitle>
                  <CardDescription>
                    {editingProvider ? 'Update your AI service provider configuration' : 'Configure your AI service provider for prompt generation'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={editingProvider ? handleProviderUpdate : handleProviderSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="provider_name">Provider Name</Label>
                      <Input
                        id="provider_name"
                        value={providerForm.name}
                        onChange={(e) => setProviderForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="My OpenAI Provider"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="provider_type">Provider Type</Label>
                      <Select
                        value={providerForm.provider_type}
                        onValueChange={(value) => {
                          setProviderForm(prev => ({ ...prev, provider_type: value }))
                          setShowApiKey(false) // Hide API key when changing provider type
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select provider type" />
                        </SelectTrigger>
                        <SelectContent>
                          {providerTypeOptions.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {providerForm.provider_type === 'openai' && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="openai_key">OpenAI API Key</Label>
                          <div className="relative">
                            <Input
                              id="openai_key"
                              type={showApiKey ? "text" : "password"}
                              value={providerForm.api_key}
                              onChange={(e) => setProviderForm(prev => ({ ...prev, api_key: e.target.value }))}
                              placeholder="sk-..."
                              className="pr-10"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={toggleApiKeyVisibility}
                              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            >
                              {showApiKey ? (
                                <EyeOff className="h-4 w-4 text-gray-500" />
                              ) : (
                                <Eye className="h-4 w-4 text-gray-500" />
                              )}
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="org">Organization (Optional)</Label>
                          <Input
                            id="org"
                            value={providerForm.organization}
                            onChange={(e) => setProviderForm(prev => ({ ...prev, organization: e.target.value }))}
                            placeholder="org-..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="project">Project (Optional)</Label>
                          <Input
                            id="project"
                            value={providerForm.project}
                            onChange={(e) => setProviderForm(prev => ({ ...prev, project: e.target.value }))}
                            placeholder="proj-..."
                          />
                        </div>
                      </>
                    )}

                    {providerForm.provider_type === 'anthropic' && (
                      <div className="space-y-2">
                        <Label htmlFor="anthropic_key">Anthropic API Key</Label>
                        <div className="relative">
                          <Input
                            id="anthropic_key"
                            type={showApiKey ? "text" : "password"}
                            value={providerForm.api_key}
                            onChange={(e) => setProviderForm(prev => ({ ...prev, api_key: e.target.value }))}
                            placeholder="sk-ant-..."
                            className="pr-10"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={toggleApiKeyVisibility}
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          >
                            {showApiKey ? (
                              <EyeOff className="h-4 w-4 text-gray-500" />
                            ) : (
                              <Eye className="h-4 w-4 text-gray-500" />
                            )}
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="model">Default Model (Optional)</Label>
                      <Input
                        id="model"
                        value={providerForm.model_name}
                        onChange={(e) => setProviderForm(prev => ({ ...prev, model_name: e.target.value }))}
                        placeholder="gpt-4, claude-3-sonnet, etc."
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="base_url">Custom API Base URL (Optional)</Label>
                      <Input
                        id="base_url"
                        value={providerForm.api_base_url}
                        onChange={(e) => setProviderForm(prev => ({ ...prev, api_base_url: e.target.value }))}
                        placeholder="https://api.example.com/v1"
                      />
                    </div>

                    <div className="flex space-x-2">
                      <Button type="submit" className="flex-1" disabled={isLoading}>
                        {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : (editingProvider ? <Save className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />)}
                        {editingProvider ? 'Update Provider' : 'Add Provider'}
                      </Button>
                      {editingProvider && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleCancelEdit}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Providers List */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Key className="h-5 w-5 mr-2" />
                    Your AI Providers
                  </CardTitle>
                  <CardDescription>
                    Manage your configured AI service providers
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                  ) : providers.length === 0 ? (
                    <div className="text-center py-8">
                      <Bot className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2">No AI Providers configured</h3>
                      <p className="text-muted-foreground mb-4">
                        Add your first AI provider to start generating prompts
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {providers.map((provider) => (
                        <div
                          key={provider.id}
                          className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                            selectedProvider === provider.id
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:bg-accent'
                          }`}
                          onClick={() => setSelectedProvider(provider.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <h3 className="font-medium">{provider.name}</h3>
                                {defaultProvider?.id === provider.id && (
                                  <Badge variant="default" className="bg-yellow-500 text-white">
                                    <Star className="w-3 h-3 mr-1 fill-current" />
                                    Default
                                  </Badge>
                                )}
                                <Badge variant={
                                  provider.status === 'active' ? 'default' :
                                  provider.status === 'error' ? 'destructive' : 'secondary'
                                }>
                                  {provider.status}
                                </Badge>
                                <Badge variant="outline">
                                  {provider.provider_type}
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground space-y-1">
                                <div>API Key: {provider.api_key_prefix ? `••••••••${provider.api_key_prefix.slice(-4)}` : 'Not set'}</div>
                                {provider.model_name && <div>Model: {provider.model_name}</div>}
                                {provider.organization && <div>Organization: {provider.organization}</div>}
                                <div>Created: {new Date(provider.created_at).toLocaleDateString()}</div>
                                {provider.last_used_at && (
                                  <div>Last used: {new Date(provider.last_used_at).toLocaleDateString()}</div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleProviderTest(provider.id)
                                }}
                                disabled={isTesting}
                              >
                                <TestTube className="w-4 h-4" />
                              </Button>
                              <Button
                                variant={defaultProvider?.id === provider.id ? "default" : "outline"}
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (defaultProvider?.id === provider.id) {
                                    handleClearDefaultProvider()
                                  } else {
                                    handleSetDefaultProvider(provider.id)
                                  }
                                }}
                                title={defaultProvider?.id === provider.id ? "Remove as default" : "Set as default"}
                              >
                                <Star className={`w-4 h-4 ${defaultProvider?.id === provider.id ? 'fill-current' : ''}`} />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleProviderEdit(provider)
                                }}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleProviderDelete(provider.id, provider.name)
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* System Prompts Tab */}
        <TabsContent value="prompts" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Add/Edit Prompt Form */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    {editingPrompt ? <Edit className="h-5 w-5 mr-2" /> : <FileText className="h-5 w-5 mr-2" />}
                    {editingPrompt ? 'Edit System Prompt' : 'Add System Prompt'}
                  </CardTitle>
                  <CardDescription>
                    {editingPrompt ? 'Update your AI assistant system prompt' : 'Create system prompts for AI assistant behaviors'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={editingPrompt ? handlePromptUpdate : handlePromptSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="prompt_name">Prompt Name</Label>
                      <Input
                        id="prompt_name"
                        value={promptForm.name}
                        onChange={(e) => setPromptForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Customer Service Assistant"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="prompt_type">Prompt Type</Label>
                      <Select
                        value={promptForm.prompt_type}
                        onValueChange={(value) => setPromptForm(prev => ({ ...prev, prompt_type: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="create_prompt">Create Prompt</SelectItem>
                          <SelectItem value="edit_prompt">Edit Prompt</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="prompt_description">Description</Label>
                      <Input
                        id="prompt_description"
                        value={promptForm.description}
                        onChange={(e) => setPromptForm(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Brief description of this prompt"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="prompt_content">Prompt Content</Label>
                      <Textarea
                        id="prompt_content"
                        value={promptForm.content}
                        onChange={(e) => setPromptForm(prev => ({ ...prev, content: e.target.value }))}
                        placeholder="Enter your system prompt here..."
                        rows={8}
                        required
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="mas_compliant"
                        checked={promptForm.is_mas_feat_compliant}
                        onChange={(e) => setPromptForm(prev => ({ ...prev, is_mas_feat_compliant: e.target.checked }))}
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor="mas_compliant">MAS FEAT Compliant</Label>
                    </div>

                    <div className="flex space-x-2">
                      <Button type="submit" className="flex-1" disabled={isSavingPrompt || !selectedProvider}>
                        {isSavingPrompt ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : (editingPrompt ? <Save className="w-4 h-4 mr-2" /> : <FileText className="w-4 h-4 mr-2" />)}
                        {editingPrompt ? 'Update Prompt' : 'Add System Prompt'}
                      </Button>
                      {editingPrompt && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setEditingPrompt(null)
                            setPromptForm({
                              name: '',
                              content: '',
                              description: '',
                              prompt_type: 'create_prompt',
                              is_mas_feat_compliant: true
                            })
                          }}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* System Prompts List */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <SettingsIcon className="h-5 w-5 mr-2" />
                    System Prompts
                  </CardTitle>
                  <CardDescription>
                    Manage your AI assistant system prompts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {systemPrompts.length === 0 ? (
                    <div className="text-center py-8">
                      <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2">No system prompts configured</h3>
                      <p className="text-muted-foreground">
                        Add system prompts to guide AI assistant behavior
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {systemPrompts.map((prompt) => (
                        <div key={prompt.id} className="p-4 border border-border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <h3 className="font-medium">{prompt.name}</h3>
                              <Badge variant={prompt.is_active ? 'default' : 'secondary'}>
                                {prompt.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                              <Badge variant={prompt.is_mas_feat_compliant ? 'default' : 'outline'}>
                                {prompt.is_mas_feat_compliant ? 'MAS FEAT' : 'Custom'}
                              </Badge>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePromptEdit(prompt)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePromptDelete(prompt.id, prompt.name)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          {prompt.description && (
                            <p className="text-sm text-muted-foreground mb-2">{prompt.description}</p>
                          )}
                          <div className="text-sm bg-muted p-2 rounded">
                            <pre className="whitespace-pre-wrap">{prompt.content}</pre>
                          </div>
                          <div className="text-xs text-muted-foreground mt-2">
                            Type: {prompt.prompt_type} • Created by: {prompt.created_by} • {new Date(prompt.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* MAS FEAT Templates Tab */}
        <TabsContent value="templates" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CheckCircle className="h-5 w-5 mr-2" />
                MAS FEAT Compliance Templates
              </CardTitle>
              <CardDescription>
                Pre-built system prompts that comply with MAS FEAT guidelines
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border border-green-200 bg-green-50 rounded-lg">
                  <h3 className="font-medium text-green-900 mb-2">MAS FEAT Compliance Framework</h3>
                  <p className="text-sm text-green-800 mb-3">
                    All MAS FEAT compliant prompts follow the Monetary Authority of Singapore's Fairness,
                    Ethics, Accountability, and Transparency guidelines for AI governance.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="font-medium text-green-900">Fairness Requirements</h4>
                      <ul className="text-sm text-green-800 space-y-1">
                        <li>• Bias detection and mitigation</li>
                        <li>• Equal opportunity provisions</li>
                        <li>• Transparent decision criteria</li>
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-medium text-green-900">Ethical Considerations</h4>
                      <ul className="text-sm text-green-800 space-y-1">
                        <li>• Human oversight mechanisms</li>
                        <li>• Privacy protection</li>
                        <li>• Accountability frameworks</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Customer Service Template</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-3">
                        For creating customer service prompts that ensure fair and ethical interactions.
                      </p>
                      <Button variant="outline" className="w-full">
                        <Copy className="w-4 h-4 mr-2" />
                        Use Template
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Content Moderation Template</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-3">
                        For creating content moderation prompts with bias detection safeguards.
                      </p>
                      <Button variant="outline" className="w-full">
                        <Copy className="w-4 h-4 mr-2" />
                        Use Template
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Data Analysis Template</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-3">
                        For creating data analysis prompts that ensure transparency and fairness.
                      </p>
                      <Button variant="outline" className="w-full">
                        <Copy className="w-4 h-4 mr-2" />
                        Use Template
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">General Business Template</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-3">
                        For creating general business prompts with ethical considerations.
                      </p>
                      <Button variant="outline" className="w-full">
                        <Copy className="w-4 h-4 mr-2" />
                        Use Template
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

    {/* Delete Provider Confirmation Dialog */}
    <Dialog open={!!deleteProviderInfo} onOpenChange={() => setDeleteProviderInfo(null)}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete AI Provider
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the AI provider and all its associated system prompts.
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You are about to delete the AI provider <strong>"{deleteProviderInfo?.name}"</strong>
          </AlertDescription>
        </Alert>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setDeleteProviderInfo(null)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleProviderDeleteConfirm}>
            Delete Provider
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Delete System Prompt Confirmation Dialog */}
    <Dialog open={!!deletePromptInfo} onOpenChange={() => setDeletePromptInfo(null)}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete System Prompt
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the system prompt.
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You are about to delete the system prompt <strong>"{deletePromptInfo?.name}"</strong>
          </AlertDescription>
        </Alert>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setDeletePromptInfo(null)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handlePromptDeleteConfirm}>
            Delete Prompt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </div>
  )
}