import React, { useRef, useEffect, useState } from 'react'
import Editor from '@monaco-editor/react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Save,
  Play,
  Eye,
  EyeOff,
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  TestTube,
  Send,
  GitCommit,
  BarChart3,
  FileText,
  Bot,
  Copy,
  Check,
  GitCompare
} from 'lucide-react'
import { AIAssistantLoading } from '@/components/ai/AIAssistantLoading'
import { DiffViewer } from '@/components/DiffViewer'
import { usePrompt, useUpdatePrompt, useCreatePrompt, useModelCompatibilities, useTestPromptCompatibility, useCompatibilityMatrix, useApprovalRequests, useCreateApprovalRequest, useAIAssistantProviders } from '@/hooks/api'
import type { Prompt, PromptCreate, PromptUpdate } from '@/types/api'
import { formatDistanceToNow } from 'date-fns'
import { useAuth } from '@/contexts/AuthContext'

interface PromptEditorProps {
  projectId?: string
  moduleId?: string
  promptId?: string
  version?: string
  isNew?: boolean
  moduleData?: any
  onSave?: (prompt: Prompt) => void
  onCancel?: () => void
}

interface MASComplianceValidation {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

// Force reload detection - Updated at: 2025-09-16 v5 - FRESH START
export function PromptEditor({
  projectId,
  moduleId,
  promptId,
  version = '1.0.0',
  isNew = false,
  moduleData,
  onSave,
  onCancel
}: PromptEditorProps) {
  const { user, isAuthenticated } = useAuth()

  // Show error if not authenticated
  if (!isAuthenticated || !user) {
    return (
      <div className="p-6 border border-red-200 bg-red-50 rounded-lg">
        <div className="flex items-center gap-2 text-red-800">
          <AlertTriangle className="w-5 h-5" />
          <span className="font-semibold">Authentication Required</span>
        </div>
        <p className="text-red-700 mt-2">
          Please log in to edit prompts.
        </p>
      </div>
    )
  }
  const editorRef = useRef<any>(null)
  const [content, setContent] = useState('')
  const [description, setDescription] = useState('')
  const [providerId, setProviderId] = useState<string>('')
  const [masIntent, setMasIntent] = useState('')
  const [masFairnessNotes, setMasFairnessNotes] = useState('')
  const [masTestingNotes, setMasTestingNotes] = useState('')
  const [masRiskLevel, setMasRiskLevel] = useState<'low' | 'medium' | 'high'>('low')

  // Safe access function to prevent undefined access
  const getSafeMasRiskLevel = (risk?: 'low' | 'medium' | 'high') => {
    return risk || 'low'
  }

  // Get appropriate button text based on user role and approval requirements
  const getSaveButtonText = () => {
    if (!user) return 'Create'

    const userRole = user.role?.toLowerCase() || ''

    // For new prompts that require approval, show "Submit for Approval"
    if (isNew && !['admin', 'approver'].includes(userRole)) {
      return 'Submit for Approval'
    }

    // For admin/approver users or updates, show standard text
    return isNew ? 'Create' : 'Save'
  }

  
  // Force cache bust - try different approach
  console.log('CACHE BUST: v4')
  const [isPreviewVisible, setIsPreviewVisible] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [validation, setValidation] = useState<MASComplianceValidation>({ isValid: true, errors: [], warnings: [] })
  const [showApprovalDialog, setShowApprovalDialog] = useState(false)
  const [activeTab, setActiveTab] = useState('content')
  const [showAIAssistantLoading, setShowAIAssistantLoading] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [showDiff, setShowDiff] = useState(false)
  const [originalContent, setOriginalContent] = useState('')
  
  const { data: prompt, isLoading } = usePrompt(promptId || '', version || '')
  const module = moduleData

  // Component ready state to prevent rendering during initialization
  const [isComponentReady, setIsComponentReady] = useState(false)
  const updatePrompt = useUpdatePrompt()
  const createPrompt = useCreatePrompt()
  const { data: compatibilities } = useModelCompatibilities(promptId)
  const { data: matrix } = useCompatibilityMatrix(promptId || '', version)
  const { data: approvalRequests } = useApprovalRequests(promptId)
  const { data: aiProviders } = useAIAssistantProviders()
  const testCompatibility = useTestPromptCompatibility()
  const createApprovalRequest = useCreateApprovalRequest()

  // Initialize form with prompt data if editing
  useEffect(() => {
    if (prompt && !isNew) {
      // Use main content field first, fallback to first model-specific prompt
      const contentToUse = prompt.content ||
                          prompt.model_specific_prompts?.[0]?.content ||
                          ''
      setContent(contentToUse)
      setDescription(prompt.description || '')
      setProviderId(prompt.provider_id || '')
      setMasIntent(prompt.mas_intent)
      setMasFairnessNotes(prompt.mas_fairness_notes)
      setMasTestingNotes(prompt.mas_testing_notes || '')
      setMasRiskLevel(prompt.mas_risk_level || 'low')
    }
  }, [prompt, isNew])

  // Auto-populate description with module slot when creating new prompt
  useEffect(() => {
    if (isNew && moduleId && module && !description) {
      setDescription(module.slot || '')
    }
  }, [isNew, moduleId, module])

  // Mark component as ready after initial load
  useEffect(() => {
    setIsComponentReady(true)
  }, [])

  

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor

    // Configure editor options for prompt editing
    editor.updateOptions({
      fontSize: 14,
      tabSize: 2,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      wordWrap: 'on',
      lineNumbers: 'on',
      renderLineHighlight: 'all',
      selectOnLineNumbers: true,
      matchBrackets: 'always',
      autoIndent: 'advanced',
      formatOnPaste: true,
      formatOnType: true,
      quickSuggestions: true,
      suggestOnTriggerCharacters: true,
      acceptSuggestionOnEnter: 'on',
      tabCompletion: 'on',
      wordBasedSuggestions: true,
      parameterHints: { enabled: true }
    })
  }

  // Configure editor language for prompts
  useEffect(() => {
    if (editorRef.current) {
      const editor = editorRef.current
      const model = editor.getModel()
      if (model) {
        // Set language to markdown for prompt editing
        const monaco = (window as any).monaco
        if (monaco) {
          monaco.editor.setModelLanguage(model, 'markdown')
        }
      }
    }
  }, [editorRef.current])

  const validateMASCompliance = (): MASComplianceValidation => {
    const errors: string[] = []
    const warnings: string[] = []

    // Required fields validation
    if (!masIntent.trim()) {
      errors.push('MAS Intent is required')
    }

    if (!masFairnessNotes.trim()) {
      errors.push('MAS Fairness Notes are required')
    }

    // Risk level validation
    if (getSafeMasRiskLevel(masRiskLevel) === 'high') {
      warnings.push('High risk prompts require approval before deployment')
    }

    // Content validation
    if (content.length < 50) {
      warnings.push('Prompt content seems too short for effective use')
    }

    // Sensitive content detection - more targeted validation with role-based exemptions
    // Skip strict validation only for users with highest privileges (admin, approver)
    // Editors still get validation but with more targeted rules
    const userRole = user?.role?.toLowerCase() || ''
    const skipStrictValidation = ['admin', 'approver'].includes(userRole)
    const isEditor = ['editor'].includes(userRole)

    if (!skipStrictValidation) {
      // More targeted sensitive keywords - focus on actual sensitive data, not technical terms
      const sensitiveKeywords = [
        'password',
        'secret'
      ]

      // Check for context that makes these keywords legitimately sensitive
      const hasSensitiveContext = sensitiveKeywords.some(keyword => {
        const keywordIndex = content.toLowerCase().indexOf(keyword)
        if (keywordIndex === -1) return false

        // Look for surrounding context that indicates actual sensitive data
        const surroundingText = content.substring(
          Math.max(0, keywordIndex - 30),
          Math.min(content.length, keywordIndex + keyword.length + 30)
        ).toLowerCase()

        // Context patterns that suggest actual sensitive information
        const sensitiveContexts = [
          'your', 'my', 'real', 'actual', 'current', 'live', 'production',
          'credentials', 'login', 'auth', 'token', 'key', 'secret'
        ]

        return sensitiveContexts.some(context => surroundingText.includes(context))
      })

      // More specific detection for actual sensitive patterns, not compliance content
      const hasPersonalInfoPattern = /(ssn|social security|credit card|bank account)/i.test(content)
      const hasCredentialPattern = /(username.*password|password.*username)/i.test(content)

      // For editors, only flag the most obvious sensitive patterns (very restricted)
      // For regular users, flag all sensitive patterns
      const shouldFlagError = isEditor
        ? hasPersonalInfoPattern  // Editors only blocked for highly sensitive personal info (SSN, credit cards, etc.)
        : hasSensitiveContext || hasPersonalInfoPattern || hasCredentialPattern  // Regular users blocked for all patterns

      if (shouldFlagError) {
        errors.push('Prompt contains potentially sensitive content that requires additional safeguards')
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  const handleSave = async () => {
    // Get user role for approval workflow
    const userRole = user?.role?.toLowerCase() || ''

    // Validate that content is not empty
    if (!content.trim()) {
      setValidation({
        isValid: false,
        errors: ['Prompt content cannot be empty'],
        warnings: []
      })
      return
    }

    const complianceValidation = validateMASCompliance()
    setValidation(complianceValidation)

    if (!complianceValidation.isValid) {
      return
    }

    try {
      if (isNew && moduleId) {
        const generatedPromptId = promptId || `prompt-${Date.now()}`
        const newPrompt: PromptCreate = {
          id: generatedPromptId,
          version,
          module_id: moduleId,
          content,
          name: description || 'Untitled Prompt',
          description,
          provider_id: providerId || null,
          target_models: [], // Let user specify target models or leave empty
          model_specific_prompts: [], // Model-specific prompts can be configured later
          mas_intent: masIntent,
          mas_fairness_notes: masFairnessNotes,
          mas_testing_notes: masTestingNotes,
          mas_risk_level: masRiskLevel
        }

              const result = await createPrompt.mutateAsync(newPrompt)

        // Auto-submit all prompts for approval (except for admin and approver roles)
        if (userRole && !['admin', 'approver'].includes(userRole)) {
          try {
            await createApprovalRequest.mutateAsync({
              prompt_id: result.data.id,
              requested_by: user.id,
              status: 'pending'
            })
            // Show success message for auto-submission
            setValidation(prev => ({
              ...prev,
              warnings: [...prev.warnings, 'Prompt has been automatically submitted for approval']
            }))
          } catch (approvalError) {
            console.error('Failed to auto-submit for approval:', approvalError)
            // Don't fail the save if approval submission fails
            setValidation(prev => ({
              ...prev,
              warnings: [...prev.warnings, 'Prompt saved but approval submission failed. Please submit manually.']
            }))
          }
        }

        onSave?.(result.data)
      } else if (promptId && version) {
        const updateData: PromptUpdate = {
          content,
          name: description || 'Untitled Prompt',
          description,
          provider_id: providerId || null,
          target_models: [],
          model_specific_prompts: [],
          mas_intent: masIntent,
          mas_fairness_notes: masFairnessNotes,
          mas_testing_notes: masTestingNotes,
          mas_risk_level: masRiskLevel
        }

        const userRole = user?.role?.toLowerCase() || ''
        const result = await updatePrompt.mutateAsync({
          promptId,
          version,
          prompt: updateData
        })

        // Check if prompt update needs approval (for non-admin/approver roles)
        if (userRole && !['admin', 'approver'].includes(userRole)) {
          // Check if there's already a pending approval request
          const existingPendingRequest = approvalRequests?.find(req => req.status === 'pending')
          if (!existingPendingRequest) {
            try {
              await createApprovalRequest.mutateAsync({
                prompt_id: promptId,
                requested_by: user.id,
                status: 'pending'
              })
              // Show success message for auto-submission
              setValidation(prev => ({
                ...prev,
                warnings: [...prev.warnings, 'Prompt update has been automatically submitted for approval']
              }))
            } catch (approvalError) {
              console.error('Failed to auto-submit for approval:', approvalError)
              // Don't fail the save if approval submission fails
              setValidation(prev => ({
                ...prev,
                warnings: [...prev.warnings, 'Prompt updated but approval submission failed. Please submit manually.']
              }))
            }
          }
        }

        onSave?.(result.data)
      }
    } catch (error) {
      console.error('Failed to save prompt:', error)
      console.error('Save attempt details:', {
        isNew,
        promptId,
        version,
        moduleId,
        contentLength: content.length,
        contentPreview: content.substring(0, 100)
      })
    }
  }

  const handleTestCompatibility = async () => {
    if (!promptId || !version) return

    setIsTesting(true)
    try {
      await testCompatibility.mutateAsync({
        promptId,
        version,
        providers: ['openai', 'anthropic', 'google']
      })
    } catch (error) {
      console.error('Compatibility test failed:', error)
    } finally {
      setIsTesting(false)
    }
  }

  const handleAIAssistant = async () => {
    if (!projectId || !moduleId) return

    try {
      // Save the current content as original before AI modifies it
      setOriginalContent(content)

      // Show the AI Assistant loading screen immediately
      setShowAIAssistantLoading(true)

      // Check if user has AI Assistant providers configured
      const token = localStorage.getItem('access_token') || localStorage.getItem('token') || 'demo-token'
      const response = await fetch('/v1/ai-assistant/providers', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (!response.ok) {
        alert('Please configure an AI Assistant provider first in the Assistant page.')
        setShowAIAssistantLoading(false)
        return
      }

      const providers = await response.json()

      // The API returns an array directly, not wrapped in a providers property
      if (!providers || providers.length === 0) {
        alert('Please configure an AI Assistant provider first in the Assistant page.')
        setShowAIAssistantLoading(false)
        return
      }

      // Call the AI generation API directly instead of waiting for loading animation
      const requestBody = {
        provider_id: providers[0].id,
        prompt_type: isNew ? 'create_prompt' : 'edit_prompt',
        context: {
          description: description || 'Create a prompt',
          module_info: '',
          requirements: ''
        },
        target_models: ['gpt-4', 'claude-3-sonnet']
      }

      const generationResponse = await fetch('/v1/ai-assistant/generate-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      })

      if (generationResponse.ok) {
        const result = await generationResponse.json()

        // Update form with generated content and MAS fields
        if (result.generated_content) {
          setContent(result.generated_content)
        }

        // Populate MAS FEAT fields
        if (result.mas_intent) {
          setMasIntent(result.mas_intent)
        }
        if (result.mas_fairness_notes) {
          setMasFairnessNotes(result.mas_fairness_notes)
        }
        if (result.mas_risk_level) {
          setMasRiskLevel(result.mas_risk_level || 'low')
        }
        if (result.mas_testing_notes) {
          setMasTestingNotes(result.mas_testing_notes)
        }
      } else {
        alert('Failed to generate AI content. Please try again.')
      }

      // Hide loading screen immediately after content is updated
      setShowAIAssistantLoading(false)

    } catch (error) {
      console.error('AI Assistant error:', error)
      alert('Failed to connect to AI Assistant. Please check your configuration.')
      setShowAIAssistantLoading(false)
    }
  }

  const handleCopyContent = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy content:', error)
    }
  }

  
  const handleSubmitForApproval = async () => {
    if (!promptId) return

    try {
      await createApprovalRequest.mutateAsync({
        prompt_id: promptId,
        requested_by: user.id,
        status: 'pending'
      })
      setShowApprovalDialog(false)
    } catch (error) {
      console.error('Failed to create approval request:', error)
    }
  }

  const getRiskLevelColor = (risk?: string) => {
    switch (risk) {
      case 'low': return 'bg-green-100 text-green-800 border-green-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'high': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getRiskLevelIcon = (risk?: string) => {
    switch (risk) {
      case 'low': return <CheckCircle className="w-4 h-4" />
      case 'medium': return <AlertTriangle className="w-4 h-4" />
      case 'high': return <Shield className="w-4 h-4" />
      default: return <CheckCircle className="w-4 h-4" />
    }
  }

  
  if (isLoading && !isNew) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Prevent rendering if component is not ready yet
  if (!isComponentReady && !isNew) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isNew ? 'Create New Prompt' : `Edit Prompt: ${promptId || 'Untitled'}`}
          </h1>
          <p className="text-muted-foreground">
            {isNew ? 'Create a new prompt with MAS FEAT compliance' : `Version ${version}`}
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Temporarily commented out to test error source */}
          {/*
          <Badge
            variant="outline"
            className={`flex items-center gap-2 ${getRiskLevelColor(getSafeMasRiskLevel(masRiskLevel))}`}
          >
            {getRiskLevelIcon(getSafeMasRiskLevel(masRiskLevel))}
            {getSafeMasRiskLevel(masRiskLevel).toUpperCase()} Risk
          </Badge>
          */}

          {!isNew && (
            <Button
              variant="outline"
              onClick={() => setShowApprovalDialog(true)}
              disabled={getSafeMasRiskLevel(masRiskLevel) !== 'high'}
            >
              <Send className="w-4 h-4 mr-2" />
              Submit for Approval
            </Button>
          )}

          <Button
            variant="siri"
            onClick={handleAIAssistant}
            className="flex items-center"
          >
            <Bot className="w-4 h-4 mr-2" />
            AI Assistant
          </Button>

          <Button onClick={handleSave} disabled={!validation.isValid}>
            <Save className="w-4 h-4 mr-2" />
            {getSaveButtonText()}
          </Button>
        </div>
      </div>

      {/* Validation Errors */}
      {validation.errors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <strong>Please fix the following errors:</strong>
              {validation.errors.map((error, index) => (
                <div key={index}>• {error}</div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Validation Warnings */}
      {validation.warnings.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <strong>Warnings:</strong>
              {validation.warnings.map((warning, index) => (
                <div key={index}>• {warning}</div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="content" className="flex items-center">
            <FileText className="w-4 h-4 mr-2" />
            Content
          </TabsTrigger>
          <TabsTrigger value="compliance" className="flex items-center">
            <Shield className="w-4 h-4 mr-2" />
            MAS FEAT
          </TabsTrigger>
          <TabsTrigger value="testing" className="flex items-center">
            <TestTube className="w-4 h-4 mr-2" />
            Testing
          </TabsTrigger>
          <TabsTrigger value="versions" className="flex items-center">
            <GitCommit className="w-4 h-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="space-y-4">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of this prompt"
                    rows={4}
                    className="resize-y min-h-[120px] max-h-[200px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="provider">AI Provider</Label>
                  <Select value={providerId || 'default'} onValueChange={(value: string) => setProviderId(value === 'default' ? '' : value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select AI Provider (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default for all providers</SelectItem>
                      {aiProviders?.map((provider) => (
                        <SelectItem key={provider.id} value={provider.id}>
                          {provider.name} ({provider.provider_type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="risk-level">MAS Risk Level</Label>
                  <Select value={masRiskLevel} onValueChange={(value: 'low' | 'medium' | 'high') => setMasRiskLevel(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low Risk</SelectItem>
                      <SelectItem value="medium">Medium Risk</SelectItem>
                      <SelectItem value="high">High Risk</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Editor */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Prompt Content</CardTitle>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyContent}
                  className="flex items-center space-x-1"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy</span>
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDiff(true)}
                  disabled={!originalContent}
                  className="flex items-center space-x-1"
                >
                  <GitCompare className="w-4 h-4" />
                  <span>Show Diff</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPreviewVisible(!isPreviewVisible)}
                >
                  {isPreviewVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {isPreviewVisible ? "Hide Preview" : "Show Preview"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Show helpful message when editing a prompt with empty content */}
              {!isNew && prompt && !content && !prompt.model_specific_prompts?.length && (
                <Alert className="mb-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    This prompt has no content yet. You can use the AI Assistant to generate prompt content, or write your own manually.
                  </AlertDescription>
                </Alert>
              )}

              <div className="border rounded-md overflow-hidden">
                <Editor
                  height="600px"
                  language="markdown"
                  theme="vs-dark"
                  value={content}
                  onChange={(value) => setContent(value || '')}
                  onMount={handleEditorDidMount}
                  options={{
                    readOnly: false,
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    minimap: { enabled: false },
                    lineNumbers: 'on',
                    folding: true,
                    renderWhitespace: 'selection',
                  }}
                />
              </div>

              {isPreviewVisible && (
                <div className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Preview</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="prose prose-sm max-w-none">
                        <pre className="bg-muted p-4 rounded-md text-sm overflow-auto max-h-96 whitespace-pre-wrap">
                          {content}
                        </pre>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="w-5 h-5 mr-2" />
                  MAS FEAT Compliance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="mas-intent">MAS Intent *</Label>
                  <Textarea
                    id="mas-intent"
                    value={masIntent}
                    onChange={(e) => setMasIntent(e.target.value)}
                    placeholder="Describe the intended purpose and use case of this prompt"
                    rows={3}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mas-fairness">MAS Fairness Notes *</Label>
                  <Textarea
                    id="mas-fairness"
                    value={masFairnessNotes}
                    onChange={(e) => setMasFairnessNotes(e.target.value)}
                    placeholder="Document fairness considerations and potential biases"
                    rows={3}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mas-testing">MAS Testing Notes</Label>
                  <Textarea
                    id="mas-testing"
                    value={masTestingNotes}
                    onChange={(e) => setMasTestingNotes(e.target.value)}
                    placeholder="Document testing methodology and results"
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Compliance Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Risk Assessment</span>
                    <Badge className={getRiskLevelColor(getSafeMasRiskLevel(masRiskLevel))}>
                      {getSafeMasRiskLevel(masRiskLevel).toUpperCase()}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Intent Documentation</span>
                    <Badge variant={masIntent.trim() ? "default" : "secondary"}>
                      {masIntent.trim() ? "Complete" : "Required"}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Fairness Documentation</span>
                    <Badge variant={masFairnessNotes.trim() ? "default" : "secondary"}>
                      {masFairnessNotes.trim() ? "Complete" : "Required"}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Testing Documentation</span>
                    <Badge variant={masTestingNotes.trim() ? "default" : "outline"}>
                      {masTestingNotes.trim() ? "Complete" : "Optional"}
                    </Badge>
                  </div>
                </div>

                {approvalRequests && approvalRequests.length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-2">Approval Status</h4>
                    <div className="space-y-2">
                      {approvalRequests.map((request) => (
                        <div key={request.id} className="flex items-center justify-between text-sm">
                          <span>{request.status}</span>
                          <span className="text-muted-foreground">
                            {formatDistanceToNow(new Date(request.requested_at), { addSuffix: true })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="testing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TestTube className="w-5 h-5 mr-2" />
                Model Compatibility Testing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Test prompt compatibility across different model providers
                </p>
                <Button
                  onClick={handleTestCompatibility}
                  disabled={isTesting || !promptId}
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  {isTesting ? 'Testing...' : 'Run Tests'}
                </Button>
              </div>

              {matrix && (
                <div className="space-y-4">
                  <h4 className="font-medium">Compatibility Matrix</h4>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {matrix.results?.map((result: any, index: number) => (
                      <Card key={index}>
                        <CardContent className="pt-4">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{result.provider}</span>
                              <Badge variant={result.is_compatible ? "default" : "destructive"}>
                                {result.is_compatible ? "Compatible" : "Incompatible"}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {result.model_name}
                            </p>
                            {result.compatibility_notes && (
                              <p className="text-xs text-muted-foreground">
                                {result.compatibility_notes}
                              </p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="versions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <GitCommit className="w-5 h-5 mr-2" />
                Version History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {isNew ? 'No versions yet. Create the first version to get started.' : 'Version history and comparison will be available here.'}
              </p>

              {!isNew && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <span className="font-medium">{version}</span>
                      <span className="text-sm text-muted-foreground ml-2">
                        {formatDistanceToNow(new Date(prompt?.updated_at || ''), { addSuffix: true })}
                      </span>
                    </div>
                    <Badge variant="default">Current</Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Approval Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit for Approval</DialogTitle>
            <DialogDescription>
              This high-risk prompt requires approval before deployment. Submitting will create an approval request.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 text-yellow-800 mt-0.5 mr-3" />
                <div>
                  <h4 className="text-sm font-medium text-yellow-800">High Risk Alert</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    This prompt has been classified as high risk and requires approval before it can be deployed to production.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApprovalDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitForApproval}>
              Submit for Approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Assistant Loading Component */}
      <AIAssistantLoading
        isOpen={showAIAssistantLoading}
        onClose={() => setShowAIAssistantLoading(false)}
        getContext={() => ({
          description: description || 'Create a prompt',
          existingContent: content,
          promptType: isNew ? 'create_prompt' : 'edit_prompt'
        })}
      />

      {/* Diff Viewer */}
      {showDiff && (
        <DiffViewer
          isOpen={showDiff}
          onClose={() => {
            setShowDiff(false)
            // Reset original content after viewing diff
            setOriginalContent('')
          }}
          oldContent={originalContent}
          newContent={content}
          title="Prompt Content Changes"
        />
      )}
    </div>
  )
}