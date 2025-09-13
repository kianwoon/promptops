import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, Edit, Trash2, ArrowLeft, Folder, FileText, Code, Clock, Hash, Calendar, User, Eye, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { useProject, useModules, useCreateModule, useUpdateModule, useDeleteModule, usePrompts, useCreatePrompt } from '@/hooks/api'
import type { ModuleCreate, ModuleUpdate, PromptCreate } from '@/types/api'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'

export function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { data: project, isLoading: projectLoading, error: projectError } = useProject(projectId || '')
  const { data: modules } = useModules(projectId)
  const { data: prompts } = usePrompts()
  const createModule = useCreateModule()
  const updateModule = useUpdateModule()
  const deleteModule = useDeleteModule()
  const createPrompt = useCreatePrompt()

  const [isCreateModuleOpen, setIsCreateModuleOpen] = useState(false)
  const [isCreatePromptOpen, setIsCreatePromptOpen] = useState(false)
  const [editingModule, setEditingModule] = useState<any>(null)
  const [deleteModuleInfo, setDeleteModuleInfo] = useState<{id: string, version: string, slot: string} | null>(null)
  const [createForm, setCreateForm] = useState<ModuleCreate>({
    id: '',
    version: '1.0.0',
    project_id: projectId || '',
    slot: '',
    render_body: ''
  })
  const [updateForm, setUpdateForm] = useState<ModuleUpdate>({})
  const [activeModelTab, setActiveModelTab] = useState('openai')
  const [createPromptForm, setCreatePromptForm] = useState<PromptCreate>({
    id: '',
    version: '1.0.0',
    module_id: '',
    name: '',
    description: '',
    target_models: [],
    model_specific_prompts: [],
    mas_intent: '',
    mas_fairness_notes: '',
    mas_testing_notes: '',
    mas_risk_level: 'low'
  })

  const handleCreateModule = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      // Auto-generate module ID from slot name
      const moduleId = createForm.slot.toLowerCase().replace(/[^a-z0-9]+/g, '-')

      await createModule.mutateAsync({
        ...createForm,
        id: moduleId
      })
      setCreateForm({
        id: '',
        version: '1.0.0',
        project_id: projectId || '',
        slot: '',
        render_body: ''
      })
      setIsCreateModuleOpen(false)
    } catch (error) {
      console.error('Failed to create module:', error)
    }
  }

  const handleCreatePrompt = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createPrompt.mutateAsync(createPromptForm)
      setCreatePromptForm({
        id: '',
        version: '1.0.0',
        module_id: '',
        name: '',
        description: '',
        target_models: [],
        model_specific_prompts: [],
        mas_intent: '',
        mas_fairness_notes: '',
        mas_testing_notes: '',
        mas_risk_level: 'low'
      })
      setIsCreatePromptOpen(false)
      setActiveModelTab('openai')
    } catch (error) {
      console.error('Failed to create prompt:', error)
    }
  }

  const getDefaultModelName = (provider: string): string => {
    switch (provider) {
      case 'openai': return 'gpt-4'
      case 'claude': return 'claude-3-sonnet'
      case 'gemini': return 'gemini-pro'
      default: return 'default'
    }
  }

  const handleUpdateModule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingModule) return

    try {
      await updateModule.mutateAsync({
        moduleId: editingModule.id,
        version: editingModule.version,
        module: updateForm
      })
      setEditingModule(null)
      setUpdateForm({})
    } catch (error) {
      console.error('Failed to update module:', error)
    }
  }

  const handleDeleteModule = async (moduleId: string, version: string) => {
    // Verify the module exists in current data before attempting deletion
    const moduleExists = modules?.some(m => m.id === moduleId && m.version === version);

    if (!moduleExists) {
      toast.error('Module not found. Please refresh the page.');
      // Refresh the data to ensure we have the latest state
      window.location.reload();
      return;
    }

    // Find the module to get its slot name for the confirmation dialog
    const moduleToDelete = modules?.find(m => m.id === moduleId && m.version === version);

    if (moduleToDelete) {
      setDeleteModuleInfo({
        id: moduleId,
        version: version,
        slot: moduleToDelete.slot
      });
    }
  }

  const confirmDeleteModule = async () => {
    if (!deleteModuleInfo) return;

    try {
      await deleteModule.mutateAsync({
        moduleId: deleteModuleInfo.id,
        version: deleteModuleInfo.version
      })
      setDeleteModuleInfo(null); // Close the modal
    } catch (error) {
      console.error('Failed to delete module:', error)
      // The API hook will handle error display and data refresh
    }
  }

  const openEditDialog = (module: any) => {
    setEditingModule(module)
    setUpdateForm({
      slot: module.slot,
      render_body: module.render_body,
      metadata: module.metadata
    })
  }

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (projectError) {
    return (
      <Alert>
        <AlertDescription>Failed to load project. Please try again later.</AlertDescription>
      </Alert>
    )
  }

  if (!project) {
    return (
      <Alert>
        <AlertDescription>Project not found.</AlertDescription>
      </Alert>
    )
  }

  const promptsInProject = prompts?.filter(prompt =>
    modules?.some(module => module.id === prompt.module_id)
  ) || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => navigate('/projects')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Projects
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
            <p className="text-muted-foreground">
              {project.description || 'No description provided'}
            </p>
          </div>
        </div>
      </div>

      {/* Project Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Folder className="w-5 h-5 mr-2" />
            Project Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Owner</Label>
              <p className="flex items-center mt-1">
                <User className="w-4 h-4 mr-2 text-muted-foreground" />
                {project.owner}
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Created</Label>
              <p className="flex items-center mt-1">
                <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
                {formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Last Updated</Label>
              <p className="flex items-center mt-1">
                <Clock className="w-4 h-4 mr-2 text-muted-foreground" />
                {formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Modules and Prompts */}
      <Tabs defaultValue="modules" className="space-y-4">
        <TabsList>
          <TabsTrigger value="modules" className="flex items-center">
            <Code className="w-4 h-4 mr-2" />
            Modules ({modules?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="modules" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Modules</h2>
            <Dialog open={isCreateModuleOpen} onOpenChange={setIsCreateModuleOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Module
              </Button>
            </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Create New Module</DialogTitle>
                    <DialogDescription>
                      Create a new module to organize your prompts.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateModule} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="module-slot">Module Name</Label>
                      <Input
                        id="module-slot"
                        value={createForm.slot}
                        onChange={(e) => setCreateForm({ ...createForm, slot: e.target.value })}
                        placeholder="Enter module name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="module-description">Description</Label>
                      <Textarea
                        id="module-description"
                        value={createForm.render_body}
                        onChange={(e) => setCreateForm({ ...createForm, render_body: e.target.value })}
                        placeholder="Describe what this module contains"
                        rows={3}
                      />
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={createModule.isPending}>
                        {createModule.isPending ? 'Creating...' : 'Create Module'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
              <Dialog open={isCreatePromptOpen} onOpenChange={setIsCreatePromptOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    New Prompt
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Prompt</DialogTitle>
                  <DialogDescription>
                    Create a new prompt with model-specific variations for different LLM providers.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreatePrompt} className="space-y-6">
                  {/* Basic Info */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="prompt-name">Prompt Name</Label>
                        <Input
                          id="prompt-name"
                          value={createPromptForm.name}
                          onChange={(e) => setCreatePromptForm({ ...createPromptForm, name: e.target.value })}
                          placeholder="Rate user submission"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="prompt-version">Version</Label>
                        <Input
                          id="prompt-version"
                          value={createPromptForm.version}
                          onChange={(e) => setCreatePromptForm({ ...createPromptForm, version: e.target.value })}
                          placeholder="1.0.0"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="prompt-module">Target Module</Label>
                      <select
                        id="prompt-module"
                        value={createPromptForm.module_id}
                        onChange={(e) => setCreatePromptForm({ ...createPromptForm, module_id: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="">Select a module</option>
                        {modules?.map((module) => (
                          <option key={module.id} value={module.id}>
                            {module.slot}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="prompt-description">Description</Label>
                      <Textarea
                        id="prompt-description"
                        value={createPromptForm.description}
                        onChange={(e) => setCreatePromptForm({ ...createPromptForm, description: e.target.value })}
                        placeholder="Describe what this prompt does and its purpose"
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Target Models</Label>
                      <div className="grid grid-cols-3 gap-3">
                        {['openai', 'claude', 'gemini'].map((model) => (
                          <div key={model} className="flex items-center space-x-2">
                            <Checkbox
                              id={`model-${model}`}
                              checked={createPromptForm.target_models.includes(model)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setCreatePromptForm({
                                    ...createPromptForm,
                                    target_models: [...createPromptForm.target_models, model],
                                    model_specific_prompts: [...createPromptForm.model_specific_prompts, {
                                      model_provider: model,
                                      model_name: getDefaultModelName(model),
                                      content: ''
                                    }]
                                  })
                                } else {
                                  setCreatePromptForm({
                                    ...createPromptForm,
                                    target_models: createPromptForm.target_models.filter(m => m !== model),
                                    model_specific_prompts: createPromptForm.model_specific_prompts.filter(p => p.model_provider !== model)
                                  })
                                }
                              }}
                            />
                            <Label htmlFor={`model-${model}`} className="capitalize">{model}</Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Model-Specific Prompts */}
                  {createPromptForm.target_models.length > 0 && (
                    <div className="space-y-4">
                      <Label>Model-Specific Prompts</Label>
                      <Tabs value={activeModelTab} onValueChange={setActiveModelTab}>
                        <TabsList className="grid w-full grid-cols-3">
                          {createPromptForm.target_models.map((model) => (
                            <TabsTrigger key={model} value={model} className="capitalize">
                              {model}
                            </TabsTrigger>
                          ))}
                        </TabsList>

                        {createPromptForm.target_models.map((model) => {
                          const modelPrompt = createPromptForm.model_specific_prompts.find(p => p.model_provider === model)
                          return (
                            <TabsContent key={model} value={model} className="space-y-4">
                              <div className="space-y-2">
                                <Label htmlFor={`${model}-prompt`}>System Prompt</Label>
                                <Textarea
                                  id={`${model}-prompt`}
                                  value={modelPrompt?.content || ''}
                                  onChange={(e) => {
                                    const updatedPrompts = createPromptForm.model_specific_prompts.map(p =>
                                      p.model_provider === model
                                        ? { ...p, content: e.target.value }
                                        : p
                                    )
                                    setCreatePromptForm({ ...createPromptForm, model_specific_prompts: updatedPrompts })
                                  }}
                                  placeholder={`Enter the system prompt optimized for ${model}`}
                                  rows={8}
                                  required
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor={`${model}-output`}>Expected Output Format</Label>
                                  <Input
                                    id={`${model}-output`}
                                    value={modelPrompt?.expected_output_format || ''}
                                    onChange={(e) => {
                                      const updatedPrompts = createPromptForm.model_specific_prompts.map(p =>
                                        p.model_provider === model
                                          ? { ...p, expected_output_format: e.target.value }
                                          : p
                                      )
                                      setCreatePromptForm({ ...createPromptForm, model_specific_prompts: updatedPrompts })
                                    }}
                                    placeholder="JSON, text, etc."
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor={`${model}-instructions`}>Special Instructions</Label>
                                  <Input
                                    id={`${model}-instructions`}
                                    value={modelPrompt?.instructions || ''}
                                    onChange={(e) => {
                                      const updatedPrompts = createPromptForm.model_specific_prompts.map(p =>
                                        p.model_provider === model
                                          ? { ...p, instructions: e.target.value }
                                          : p
                                      )
                                      setCreatePromptForm({ ...createPromptForm, model_specific_prompts: updatedPrompts })
                                    }}
                                    placeholder="Model-specific instructions"
                                  />
                                </div>
                              </div>
                            </TabsContent>
                          )
                        })}
                      </Tabs>
                    </div>
                  )}

                  {/* MAS Compliance Fields */}
                  <div className="space-y-4 border-t pt-4">
                    <h4 className="font-medium">MAS Compliance Information</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="mas-intent">MAS Intent</Label>
                        <Input
                          id="mas-intent"
                          value={createPromptForm.mas_intent}
                          onChange={(e) => setCreatePromptForm({ ...createPromptForm, mas_intent: e.target.value })}
                          placeholder="Describe the intended use"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="mas-risk">Risk Level</Label>
                        <select
                          id="mas-risk"
                          value={createPromptForm.mas_risk_level}
                          onChange={(e) => setCreatePromptForm({ ...createPromptForm, mas_risk_level: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        >
                          <option value="">Select risk level</option>
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="mas-fairness">Fairness Notes</Label>
                      <Textarea
                        id="mas-fairness"
                        value={createPromptForm.mas_fairness_notes}
                        onChange={(e) => setCreatePromptForm({ ...createPromptForm, mas_fairness_notes: e.target.value })}
                        placeholder="Describe fairness considerations and bias mitigation"
                        rows={3}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="mas-testing">Testing Notes (Optional)</Label>
                      <Textarea
                        id="mas-testing"
                        value={createPromptForm.mas_testing_notes}
                        onChange={(e) => setCreatePromptForm({ ...createPromptForm, mas_testing_notes: e.target.value })}
                        placeholder="Describe testing procedures and results"
                        rows={3}
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button type="submit" disabled={createPrompt.isPending || createPromptForm.target_models.length === 0}>
                      {createPrompt.isPending ? 'Creating...' : 'Create Prompt'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {modules && modules.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {modules.map((module) => {
                const modulePromptCount = prompts?.filter(p => p.module_id === module.id).length || 0;
                const canDelete = modulePromptCount === 0;

                return (
                  <Card key={`${module.id}-${module.version}`} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">{module.slot}</CardTitle>
                          <CardDescription className="flex items-center mt-1">
                            <Hash className="w-4 h-4 mr-1" />
                            {module.id} v{module.version}
                          </CardDescription>
                        </div>
                        <div className="flex space-x-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditDialog(module)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteModule(module.id, module.version)}
                            disabled={!canDelete}
                            title={!canDelete ? `Cannot delete: ${modulePromptCount} prompt${modulePromptCount !== 1 ? 's' : ''}` : "Delete module"}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="text-sm text-muted-foreground">
                        Module container for organizing related prompts
                      </div>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          {formatDistanceToNow(new Date(module.created_at), { addSuffix: true })}
                        </div>
                        <Badge variant="secondary">v{module.version}</Badge>
                      </div>
                      <div className="pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => navigate(`/projects/${projectId}/modules/${module.id}/prompts`)}
                        >
                          <Eye className="w-3 h-3 mr-2" />
                          View Prompts ({modulePromptCount})
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Code className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No modules yet</h3>
                <p className="text-muted-foreground mb-4 text-center">
                  Create your first module to start organizing your prompts.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Module Dialog */}
      <Dialog open={!!editingModule} onOpenChange={() => setEditingModule(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Module</DialogTitle>
            <DialogDescription>
              Update module information.
            </DialogDescription>
          </DialogHeader>
          {editingModule && (
            <form onSubmit={handleUpdateModule} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-module-slot">Slot</Label>
                <Input
                  id="edit-module-slot"
                  value={updateForm.slot || ''}
                  onChange={(e) => setUpdateForm({ ...updateForm, slot: e.target.value })}
                  placeholder="Enter slot name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-module-body">Render Body</Label>
                <Textarea
                  id="edit-module-body"
                  value={updateForm.render_body || ''}
                  onChange={(e) => setUpdateForm({ ...updateForm, render_body: e.target.value })}
                  placeholder="Enter render body content"
                  rows={6}
                  required
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingModule(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateModule.isPending}>
                  {updateModule.isPending ? 'Updating...' : 'Update Module'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Module Confirmation Dialog */}
      <Dialog open={!!deleteModuleInfo} onOpenChange={() => setDeleteModuleInfo(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Module
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the module and all its data.
            </DialogDescription>
          </DialogHeader>

          {deleteModuleInfo && (
            <div className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  You are about to delete the module <strong>"{deleteModuleInfo.slot}"</strong> (ID: {deleteModuleInfo.id}, Version: {deleteModuleInfo.version})
                </AlertDescription>
              </Alert>

              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Important:</strong> This module can only be deleted because it has no prompts. If it had prompts, you would need to delete them first.
                </p>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDeleteModuleInfo(null)}
                  disabled={deleteModule.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={confirmDeleteModule}
                  disabled={deleteModule.isPending}
                >
                  {deleteModule.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Module
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}