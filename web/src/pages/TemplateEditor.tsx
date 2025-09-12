import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MonacoTemplateEditor } from '@/components/MonacoTemplateEditor'
import { VersionManagement, AliasManagement, EvaluationResults } from '@/components/templates'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  ArrowLeft, 
  Save, 
  Play, 
  Copy, 
  Plus, 
  X,
  AlertCircle,
  Loader2,
  Settings,
  GitBranch,
  BarChart3,
  Activity
} from 'lucide-react'
import { 
  useTemplate, 
  useTemplateVersions, 
  useAliases, 
  useEvaluations,
  useCreateTemplate,
  useRenderTemplate 
} from '@/hooks/api'
import { Template, TemplateVersion, Alias, EvaluationRun } from '@/types/api'

const defaultTemplate = `name: prompt-template
version: "1.0.0"
description: "A prompt template for AI interactions"

# Template configuration
template: |
  You are a helpful AI assistant. Please respond to the following:
  
  {{input}}
  
  Response:

# Variables used in the template
variables:
  input:
    type: string
    description: "User input or question"
    required: true

# Module composition
modules: []

# Validation rules
validation:
  max_tokens: 1000
  required_variables: ["input"]

# Deployment settings
deployment:
  auto_deploy: false
  review_required: true`

export function TemplateEditor() {
  const { id, version } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('editor')
  const [yamlContent, setYamlContent] = useState(defaultTemplate)
  const [isLoading, setIsLoading] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testInput, setTestInput] = useState('')

  const { data: template, isLoading: templateLoading, error: templateError } = useTemplate(id || '', version || '')
  const { data: versions, isLoading: versionsLoading } = useTemplateVersions(id || '')
  const { data: aliases, isLoading: aliasesLoading } = useAliases()
  const { data: evaluations, isLoading: evaluationsLoading } = useEvaluations(id)
  const createTemplate = useCreateTemplate()
  const renderTemplate = useRenderTemplate()

  const templateAliases = aliases?.filter(alias => alias.template_id === id) || []
  const templateEvaluations = evaluations?.items?.filter(evaluation => evaluation.template_id === id) || []

  useEffect(() => {
    if (template && template.metadata?.template_yaml) {
      setYamlContent(template.metadata.template_yaml)
    }
  }, [template])

  useEffect(() => {
    if (!id) {
      setYamlContent(defaultTemplate)
    }
  }, [id])

  const handleSave = async (content: string) => {
    setIsLoading(true)
    try {
      const yamlLines = content.split('\n')
      const name = yamlLines.find(line => line.startsWith('name:'))?.replace('name:', '').trim() || 'untitled'
      const version = yamlLines.find(line => line.startsWith('version:'))?.replace('version:', '').trim() || '1.0.0'
      const description = yamlLines.find(line => line.startsWith('description:'))?.replace('description:', '').trim() || ''

      const templateData = {
        id: id || name,
        version: version,
        owner: 'current-user',
        template_yaml: content,
        metadata: {
          description: description,
          template_yaml: content
        }
      }

      await createTemplate.mutateAsync(templateData)
      
      if (!id) {
        navigate('/templates')
      }
    } catch (error) {
      console.error('Failed to save template:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleTest = async (content: string) => {
    if (!testInput.trim()) {
      alert('Please provide test input')
      return
    }

    setIsTesting(true)
    try {
      await renderTemplate.mutateAsync({
        id: id || 'test',
        alias: 'test',
        inputs: { input: testInput }
      })
      
      alert('Template test completed successfully!')
    } catch (error) {
      console.error('Failed to test template:', error)
      alert('Template test failed. Please check the template configuration.')
    } finally {
      setIsTesting(false)
    }
  }

  const handleViewVersion = (version: string) => {
    navigate(`/templates/${id}/versions/${version}`)
  }

  const handleCompareVersions = (version1: string, version2: string) => {
    // TODO: Implement version comparison
    console.log('Compare versions:', version1, version2)
  }

  const handlePromoteVersion = (version: string) => {
    // TODO: Implement version promotion
    console.log('Promote version:', version)
  }

  const handleDeleteVersion = (version: string) => {
    if (confirm('Are you sure you want to delete this version?')) {
      // TODO: Implement version deletion
      console.log('Delete version:', version)
    }
  }

  const handleDownloadVersion = (version: string) => {
    // TODO: Implement version download
    console.log('Download version:', version)
  }

  const handleCreateAlias = async (alias: Omit<Alias, 'updated_at'>) => {
    // TODO: Implement alias creation
    console.log('Create alias:', alias)
  }

  const handleUpdateAlias = (alias: string, updates: Partial<Alias>) => {
    // TODO: Implement alias update
    console.log('Update alias:', alias, updates)
  }

  const handleDeleteAlias = (alias: string) => {
    if (confirm('Are you sure you want to delete this alias?')) {
      // TODO: Implement alias deletion
      console.log('Delete alias:', alias)
    }
  }

  const handleTestAlias = (alias: string) => {
    // TODO: Implement alias testing
    console.log('Test alias:', alias)
  }

  const handleRunEvaluation = (suiteId: string) => {
    // TODO: Implement evaluation run
    console.log('Run evaluation:', suiteId)
  }

  const handleViewEvaluationDetails = (evaluationId: string) => {
    // TODO: Navigate to evaluation details
    console.log('View evaluation details:', evaluationId)
  }

  if (templateLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin mr-2" />
        <span>Loading template...</span>
      </div>
    )
  }

  if (templateError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load template. Please try again later.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/templates')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {id ? (template?.metadata?.description || id) : 'Create Template'}
            </h1>
            <p className="text-muted-foreground">
              {id ? 'Edit template configuration and YAML' : 'Create a new prompt template'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {version || 'latest'}
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="editor">
            <Settings className="w-4 h-4 mr-2" />
            Editor
          </TabsTrigger>
          {id && (
            <>
              <TabsTrigger value="versions">
                <GitBranch className="w-4 h-4 mr-2" />
                Versions
              </TabsTrigger>
              <TabsTrigger value="aliases">
                <Activity className="w-4 h-4 mr-2" />
                Aliases
              </TabsTrigger>
              <TabsTrigger value="evaluations">
                <BarChart3 className="w-4 h-4 mr-2" />
                Evaluations
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="editor" className="space-y-6">
          {/* Test Input */}
          {id && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Test Template</CardTitle>
                <CardDescription>
                  Test your template with sample input
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Label htmlFor="test-input">Test Input</Label>
                    <Textarea
                      id="test-input"
                      value={testInput}
                      onChange={(e) => setTestInput(e.target.value)}
                      placeholder="Enter test input for the template..."
                      rows={3}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button 
                      onClick={() => handleTest(yamlContent)}
                      disabled={isTesting || !testInput.trim()}
                    >
                      {isTesting ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4 mr-2" />
                      )}
                      Test
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Monaco Editor */}
          <MonacoTemplateEditor
            initialContent={yamlContent}
            onSave={handleSave}
            onTest={handleTest}
            height="800px"
          />
        </TabsContent>

        {id && (
          <>
            <TabsContent value="versions">
              <VersionManagement
                templateId={id}
                versions={versions || []}
                currentVersion={version}
                onViewVersion={handleViewVersion}
                onCompareVersions={handleCompareVersions}
                onPromoteVersion={handlePromoteVersion}
                onDeleteVersion={handleDeleteVersion}
                onDownloadVersion={handleDownloadVersion}
              />
            </TabsContent>

            <TabsContent value="aliases">
              <AliasManagement
                templateId={id}
                aliases={templateAliases}
                onCreateAlias={handleCreateAlias}
                onUpdateAlias={handleUpdateAlias}
                onDeleteAlias={handleDeleteAlias}
                onTestAlias={handleTestAlias}
              />
            </TabsContent>

            <TabsContent value="evaluations">
              <EvaluationResults
                templateId={id}
                evaluations={templateEvaluations}
                onRunEvaluation={handleRunEvaluation}
                onViewDetails={handleViewEvaluationDetails}
              />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  )
}