import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, AlertTriangle, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { usePrompt, useProject, useModule, usePromptVersions } from '@/hooks/api'
import { ModelTestingInterface } from '@/components/testing/ModelTestingInterface'

export function ModelTesting() {
  const { projectId, moduleId, promptId, version } = useParams<{
    projectId: string
    moduleId: string
    promptId: string
    version?: string
  }>()
  const navigate = useNavigate()

  const { data: project, isLoading: isLoadingProject } = useProject(projectId || '')
  const { data: module, isLoading: isLoadingModule } = useModule(moduleId || '', '1.0.0')

  // If version is provided in URL, use it directly, otherwise fetch all versions and use the latest
  const targetVersion = version || ''
  const { data: promptVersions, isLoading: isLoadingPromptVersions } = usePromptVersions(promptId || '')

  // Get the latest version if not provided in URL
  const latestVersion = promptVersions && promptVersions.length > 0 ? promptVersions[0].version : '1.0.0'
  const versionToUse = targetVersion || latestVersion
  const { data: prompt, isLoading: isLoadingPrompt, error: promptError } = usePrompt(promptId || '', versionToUse)

  const [systemPrompt, setSystemPrompt] = useState('')

  // Debug logging to see what parameters we're getting
  useEffect(() => {
    console.log('ModelTesting - URL Parameters:', { projectId, moduleId, promptId, version })
    console.log('ModelTesting - Data:', { project, module, promptVersions, prompt, versionToUse })
    console.log('ModelTesting - Loading states:', {
      isLoadingProject,
      isLoadingModule,
      isLoadingPromptVersions,
      isLoadingPrompt
    })
  }, [projectId, moduleId, promptId, version, project, module, promptVersions, prompt, versionToUse,
      isLoadingProject, isLoadingModule, isLoadingPromptVersions, isLoadingPrompt])

  useEffect(() => {
    if (prompt) {
      // Use the main prompt content as the system prompt
      setSystemPrompt(prompt.content)
    }
  }, [prompt])

  if (isLoadingProject || isLoadingModule || isLoadingPromptVersions || isLoadingPrompt) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (promptError || (!isLoadingPromptVersions && promptVersions && promptVersions.length === 0)) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {promptError ? 'Failed to load prompt. Please check if the prompt exists and you have access to it.' : 'No prompt versions found for this prompt.'}
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button onClick={() => navigate(`/projects/${projectId}/modules/${moduleId}/prompts`)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Prompts
          </Button>
        </div>
      </div>
    )
  }

  if (!prompt || !project || !module || !promptVersions) {
    return (
      <div className="container mx-auto py-8">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Prompt, project, or module not found.
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button onClick={() => navigate(`/projects/${projectId}/modules/${moduleId}/prompts`)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Prompts
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => navigate(`/projects/${projectId}/modules/${moduleId}/prompts`)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Prompts
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Model Testing</h1>
            <p className="text-muted-foreground">
              Test this prompt across multiple AI providers
            </p>
          </div>
        </div>
      </div>

      {/* Context Information */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Project</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{project.name}</p>
            <p className="text-sm text-muted-foreground">{project.id}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Module</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{module.slot}</p>
            <p className="text-sm text-muted-foreground">{module.id}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Prompt</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{prompt.description || 'Untitled Prompt'}</p>
            <p className="text-sm text-muted-foreground">{prompt.id} v{prompt.version}</p>
          </CardContent>
        </Card>
      </div>

      {/* Model Testing Interface */}
      <ModelTestingInterface
        systemPrompt={systemPrompt}
        promptName={prompt.description}
      />
    </div>
  )
}