import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, Edit, Trash2, ArrowLeft, FileText, Shield, AlertTriangle, CheckCircle, Clock, TestTube, Award, Check, XCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { usePrompts, useDeletePrompt, useProject, useModule, useAIAssistantProviders, useApprovalRequests } from '@/hooks/api'
import { PromptEditor } from './PromptEditor'
import { formatDistanceToNow } from 'date-fns'
import type { Prompt, ApprovalRequest } from '@/types/api'

// Helper functions for approval status
const getApprovalStatusColor = (status?: string) => {
  switch (status) {
    case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'approved': return 'bg-green-100 text-green-800 border-green-200'
    case 'rejected': return 'bg-red-100 text-red-800 border-red-200'
    default: return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

const getApprovalStatusIcon = (status?: string) => {
  switch (status) {
    case 'pending': return <Clock className="w-4 h-4" />
    case 'approved': return <CheckCircle className="w-4 h-4" />
    case 'rejected': return <XCircle className="w-4 h-4" />
    default: return null
  }
}

const getApprovalStatusText = (status?: string) => {
  switch (status) {
    case 'pending': return 'Under Review'
    case 'approved': return 'Approved'
    case 'rejected': return 'Rejected'
    default: return 'Not Submitted'
  }
}

// Approval Status Badge Component
function ApprovalStatusBadge({ promptId }: { promptId: string }) {
  const { data: approvalRequests, isLoading } = useApprovalRequests(promptId)

  if (isLoading) {
    return (
      <Badge variant="outline" className="flex items-center gap-2">
        <div className="w-4 h-4 bg-gray-200 rounded animate-pulse" />
        Loading...
      </Badge>
    )
  }

  const latestRequest = approvalRequests?.[0] // Get the most recent approval request

  return (
    <Badge
      variant="outline"
      className={`flex items-center gap-2 ${getApprovalStatusColor(latestRequest?.status)}`}
    >
      {getApprovalStatusIcon(latestRequest?.status)}
      {getApprovalStatusText(latestRequest?.status)}
    </Badge>
  )
}

interface ModulePromptsProps {
  projectId: string
  moduleId: string
}

export function ModulePrompts({ projectId, moduleId }: ModulePromptsProps) {
  const navigate = useNavigate()
  const { data: project } = useProject(projectId)
  const { data: module } = useModule(moduleId, '1.0.0')
  const { data: prompts, isLoading, refetch } = usePrompts(moduleId)
  const { data: aiProviders } = useAIAssistantProviders()
  const deletePrompt = useDeletePrompt()

  const [isCreatePromptOpen, setIsCreatePromptOpen] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState<{ prompt: Prompt; version: string } | null>(null)
  const [deletePromptDialog, setDeletePromptDialog] = useState<{ promptId: string; version: string; promptName: string } | null>(null)

  const handleDeletePrompt = async (promptId: string, version: string, promptName: string) => {
    setDeletePromptDialog({ promptId, version, promptName })
  }

  const confirmDeletePrompt = async () => {
    if (deletePromptDialog) {
      try {
        await deletePrompt.mutateAsync({
          promptId: deletePromptDialog.promptId,
          version: deletePromptDialog.version
        })
        setDeletePromptDialog(null)
      } catch (error) {
        console.error('Failed to delete prompt:', error)
      }
    }
  }

  const openEditDialog = (prompt: Prompt, version: string) => {
    setEditingPrompt({ prompt, version })
  }

  const handlePromptSaved = () => {
    setIsCreatePromptOpen(false)
    setEditingPrompt(null)
    refetch()
  }

  const handleCancel = () => {
    setIsCreatePromptOpen(false)
    setEditingPrompt(null)
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

  const getProviderName = (providerId: string | null | undefined) => {
    if (!providerId) return 'Default for all providers'

    const provider = aiProviders?.find(p => p.id === providerId)
    if (provider) {
      return `${provider.name} (${provider.provider_type})`
    }

    return providerId || 'Default for all providers'
  }

  if (isLoading) {
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
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => navigate(`/projects/${projectId}`)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Project
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Prompts</h1>
            <p className="text-muted-foreground">
              {module?.slot || 'Unknown Module'} • {project?.name || 'Unknown Project'}
            </p>
          </div>
        </div>

        <Dialog open={isCreatePromptOpen} onOpenChange={setIsCreatePromptOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Prompt
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Prompt</DialogTitle>
              <DialogDescription>
                Create a new prompt for this module with AI assistant support.
              </DialogDescription>
            </DialogHeader>
            <PromptEditor
              projectId={projectId}
              moduleId={moduleId}
              isNew={true}
              moduleData={module}
              onSave={handlePromptSaved}
              onCancel={handleCancel}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Module Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="w-5 h-5 mr-2" />
            Module Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Module ID</div>
              <p className="font-mono text-sm">{module?.id}</p>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Slot</div>
              <p>{module?.slot}</p>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Version</div>
              <p>{module?.version}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Prompts Grid */}
      {prompts && prompts.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {prompts.map((prompt) => (
            <Card key={`${prompt.id}-${prompt.version}`} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">
                      {prompt.name || 'Untitled Prompt'}
                    </CardTitle>
                    <CardDescription className="flex items-center mt-1">
                      ID: {prompt.id} v{prompt.version}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Risk Level and Approval Status Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <Badge
                      variant="outline"
                      className={`flex items-center gap-2 ${getRiskLevelColor(prompt.mas_risk_level)}`}
                    >
                      {getRiskLevelIcon(prompt.mas_risk_level)}
                      {(prompt.mas_risk_level || 'low').toUpperCase()} Risk
                    </Badge>
                    <ApprovalStatusBadge promptId={prompt.id} />
                  </div>

                  {/* Description */}
                  <div className="min-h-fit">
                    <div className="text-sm text-muted-foreground mb-1">Description</div>
                    <p className="text-sm whitespace-normal break-words">
                      {prompt.description || 'No description provided'}
                    </p>
                  </div>

                  {/* Target Models */}
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Target Models</div>
                    <p className="text-sm">
                      {prompt.target_models?.join(', ') || 'None specified'}
                    </p>
                  </div>

                  {/* AI Provider */}
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">AI Provider</div>
                    <Badge variant="secondary" className="text-xs">
                      {getProviderName(prompt.provider_id)}
                    </Badge>
                  </div>

                  {/* MAS Compliance Badge */}
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">MAS Compliance</div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`flex items-center gap-2 ${prompt.mas_intent && prompt.mas_fairness_notes ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}
                      >
                        {prompt.mas_intent && prompt.mas_fairness_notes ? (
                          <Award className="w-4 h-4" />
                        ) : (
                          <Shield className="w-4 h-4" />
                        )}
                        {prompt.mas_intent && prompt.mas_fairness_notes ? 'Compliant' : 'Partial'}
                      </Badge>
                      <div className="flex gap-1">
                        <div className={`p-1 rounded-full ${prompt.mas_intent ? 'bg-green-100' : 'bg-gray-100'}`}>
                          <Check className={`w-3 h-3 ${prompt.mas_intent ? 'text-green-600' : 'text-gray-400'}`} />
                        </div>
                        <div className={`p-1 rounded-full ${prompt.mas_fairness_notes ? 'bg-green-100' : 'bg-gray-100'}`}>
                          <Check className={`w-3 h-3 ${prompt.mas_fairness_notes ? 'text-green-600' : 'text-gray-400'}`} />
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div className="flex items-center">
                        <CheckCircle className={`w-3 h-3 mr-1 ${prompt.mas_intent ? 'text-green-500' : 'text-gray-300'}`} />
                        Intent
                      </div>
                      <div className="flex items-center">
                        <CheckCircle className={`w-3 h-3 mr-1 ${prompt.mas_fairness_notes ? 'text-green-500' : 'text-gray-300'}`} />
                        Fairness
                      </div>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {formatDistanceToNow(new Date(prompt.updated_at), { addSuffix: true })}
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {prompt.version}
                    </Badge>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => openEditDialog(prompt, prompt.version)}
                    >
                      <Edit className="w-3 h-3 mr-2" />
                      Edit Prompt
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => navigate(`/projects/${projectId}/modules/${moduleId}/prompts/${prompt.id}/${prompt.version}/testing`)}
                    >
                      <TestTube className="w-3 h-3 mr-2" />
                      Model Testing
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      onClick={() => handleDeletePrompt(prompt.id, prompt.version, prompt.name || prompt.description || 'Untitled Prompt')}
                    >
                      <Trash2 className="w-3 h-3 mr-2" />
                      Delete Prompt
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No prompts yet</h3>
            <p className="text-muted-foreground mb-4 text-center">
              Create your first prompt for this module.
            </p>
            <Button onClick={() => setIsCreatePromptOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create First Prompt
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Edit Prompt Dialog */}
      <Dialog open={!!editingPrompt} onOpenChange={() => setEditingPrompt(null)}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Prompt</DialogTitle>
            <DialogDescription>
              Edit existing prompt content and configuration.
            </DialogDescription>
          </DialogHeader>
          {editingPrompt && (
            <PromptEditor
              projectId={projectId}
              moduleId={moduleId}
              promptId={editingPrompt.prompt.id}
              version={editingPrompt.version}
              onSave={handlePromptSaved}
              onCancel={handleCancel}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletePromptDialog} onOpenChange={() => setDeletePromptDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Prompt</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletePromptDialog?.promptName}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletePromptDialog(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeletePrompt}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}