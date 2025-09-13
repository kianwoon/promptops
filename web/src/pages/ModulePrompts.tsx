import React from 'react'
import { useParams } from 'react-router-dom'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ModulePrompts } from '@/components/prompts/ModulePrompts'

export function ModulePromptsPage() {
  const { projectId, moduleId } = useParams<{ projectId: string; moduleId: string }>()

  if (!projectId || !moduleId) {
    return (
      <Alert>
        <AlertDescription>
          Invalid project or module ID. Please check the URL and try again.
        </AlertDescription>
      </Alert>
    )
  }

  return <ModulePrompts projectId={projectId} moduleId={moduleId} />
}