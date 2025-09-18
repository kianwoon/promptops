import React, { useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  GripVertical,
  Edit,
  Trash2,
  Users,
  Clock,
  AlertTriangle,
  Copy
} from 'lucide-react'

import type {
  ApprovalFlow,
  ApprovalFlowStep,
  StepTemplate,
  ApprovalStepType
} from '@/types/approval-flows'

import { useFlowDesignerState, useAvailableRoles, useStepTemplates, useFlowValidation } from '@/hooks/useApprovalFlows'

import type { CustomRole } from '@/types/governance'

// Helper function to get step type labels
const getStepTypeLabel = (type: ApprovalStepType): string => {
  switch (type) {
    case 'review':
      return 'Review'
    case 'approval':
      return 'Approval'
    case 'verification':
      return 'Verification'
    case 'notification':
      return 'Notification'
    case 'escalation':
      return 'Escalation'
    case 'automatic':
      return 'Automatic'
    case 'conditional':
      return 'Conditional'
    default:
      return type
  }
}

// Sortable Step Component
interface SortableStepProps {
  step: ApprovalFlowStep
  roles: CustomRole[]
  onEdit: (step: ApprovalFlowStep) => void
  onDelete: (stepId: string) => void
  onDuplicate: (step: ApprovalFlowStep) => void
}

const SortableStep: React.FC<SortableStepProps> = ({ step, roles, onEdit, onDelete, onDuplicate }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const assignedRoles = roles.filter(role => step.assigned_roles?.includes(role.name))

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="mb-3"
    >
      <Card className={`transition-all duration-200 ${isDragging ? 'shadow-lg' : 'shadow-sm'}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div
                {...attributes}
                {...listeners}
                className="cursor-grab text-gray-400 hover:text-gray-600"
              >
                <GripVertical className="h-4 w-4" />
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant={step.required ? 'default' : 'secondary'}>
                  {!isNaN(step.order) ? step.order + 1 : 1}
                </Badge>
                <Badge variant="outline">
                  {getStepTypeLabel(step.step_type)}
                </Badge>
              </div>
              <div>
                <CardTitle className="text-sm">{step.name}</CardTitle>
                {step.description && (
                  <CardDescription className="text-xs">{step.description}</CardDescription>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {step.timeout_hours && !isNaN(step.timeout_hours) && step.timeout_hours > 0 && (
                <Badge variant="outline" className="text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  {Math.max(0, !isNaN(step.timeout_hours) ? step.timeout_hours : 0)}h
                </Badge>
              )}
              {assignedRoles.length > 0 && !isNaN(assignedRoles.length) && (
                <Badge variant="outline" className="text-xs">
                  <Users className="h-3 w-3 mr-1" />
                  {assignedRoles.length}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(step)}
              >
                <Edit className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDuplicate(step)}
              >
                <Copy className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(step.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {assignedRoles.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {assignedRoles.slice(0, 3).map(role => (
                <Badge key={role.name} variant="secondary" className="text-xs">
                  {role.name}
                </Badge>
              ))}
              {assignedRoles.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{Math.max(0, assignedRoles.length - 3)} more
                </Badge>
              )}
            </div>
          )}
          {step.conditions && !isNaN(step.conditions.length) && step.conditions.length > 0 && (
            <div className="text-xs text-gray-500">
              {!isNaN(step.conditions.length) ? step.conditions.length : 0} condition{!isNaN(step.conditions.length) && step.conditions.length > 1 ? 's' : ''}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Step Template Component
interface StepTemplateCardProps {
  template: StepTemplate
  onAdd: (template: StepTemplate) => void
}

const StepTemplateCard: React.FC<StepTemplateCardProps> = ({ template, onAdd }) => {
  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onAdd(template)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{template.name}</CardTitle>
          <Badge variant="outline" className="text-xs">
            {template.category}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <CardDescription className="text-xs mb-2">
          {template.description}
        </CardDescription>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{getStepTypeLabel(template.step_type)}</span>
          {template.default_timeout_hours && (
            <span>{template.default_timeout_hours}h timeout</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Step Editor Dialog
interface StepEditorDialogProps {
  step: ApprovalFlowStep | null
  roles: CustomRole[]
  open: boolean
  onClose: () => void
  onSave: (step: ApprovalFlowStep) => void
}

const StepEditorDialog: React.FC<StepEditorDialogProps> = ({ step, roles, open, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<ApprovalFlowStep>>({
    name: '',
    description: '',
    step_type: 'review',
    required: true,
    timeout_hours: 24,
    assigned_roles: [],
    conditions: [],
    actions: [],
    notification_settings: {
      email_enabled: true,
      in_app_enabled: true,
      webhook_enabled: false,
      reminder_hours: undefined,
      escalation_hours: undefined,
      custom_webhooks: undefined,
    },
    is_parallel: false,
    depends_on: [],
  })

  React.useEffect(() => {
    if (step) {
      setFormData(step)
    } else {
      setFormData({
        name: '',
        description: '',
        step_type: 'review',
        required: true,
        timeout_hours: 24,
        assigned_roles: [],
        conditions: [],
        actions: [],
        notification_settings: {
          email_enabled: true,
          in_app_enabled: true,
          webhook_enabled: false,
          reminder_hours: undefined,
          escalation_hours: undefined,
          custom_webhooks: undefined,
        },
        is_parallel: false,
        depends_on: [],
      })
    }
  }, [step])

  const handleSave = () => {
    if (!formData.name || !formData.step_type) return

    const stepData: ApprovalFlowStep = {
      id: step?.id || `step-${Date.now()}`,
      name: formData.name,
      description: formData.description || '',
      step_type: formData.step_type,
      order: step?.order || 0,
      required: formData.required || false,
      timeout_hours: formData.timeout_hours,
      assigned_roles: formData.assigned_roles || [],
      assigned_users: formData.assigned_users,
      conditions: formData.conditions || [],
      actions: formData.actions || [],
      notification_settings: formData.notification_settings || {
        email_enabled: true,
        in_app_enabled: true,
        webhook_enabled: false,
        reminder_hours: undefined,
        escalation_hours: undefined,
        custom_webhooks: undefined,
      },
      is_parallel: formData.is_parallel || false,
      depends_on: formData.depends_on || [],
      metadata: formData.metadata,
    }

    onSave(stepData)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{step ? 'Edit Step' : 'Add Step'}</DialogTitle>
          <DialogDescription>
            Configure approval step settings and role assignments
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="step-name">Step Name</Label>
            <Input
              id="step-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter step name"
            />
          </div>

          <div>
            <Label htmlFor="step-description">Description</Label>
            <Textarea
              id="step-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe this step"
            />
          </div>

          <div>
            <Label htmlFor="step-type">Step Type</Label>
            <Select
              value={formData.step_type}
              onValueChange={(value: ApprovalStepType) => setFormData({ ...formData, step_type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="review">Review</SelectItem>
                <SelectItem value="approval">Approval</SelectItem>
                <SelectItem value="verification">Verification</SelectItem>
                <SelectItem value="notification">Notification</SelectItem>
                <SelectItem value="escalation">Escalation</SelectItem>
                <SelectItem value="automatic">Automatic</SelectItem>
                <SelectItem value="conditional">Conditional</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="timeout">Timeout (hours)</Label>
              <Input
                id="timeout"
                type="number"
                value={formData.timeout_hours}
                onChange={(e) => {
                  const parsedValue = parseInt(e.target.value);
                  setFormData({ ...formData, timeout_hours: !isNaN(parsedValue) ? parsedValue : 24 });
                }}
                min="1"
                max="720"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="required"
                checked={formData.required}
                onCheckedChange={(checked) => setFormData({ ...formData, required: !!checked })}
              />
              <Label htmlFor="required">Required step</Label>
            </div>
          </div>

          <div>
            <Label>Assigned Roles</Label>
            <div className="border rounded-lg p-3 max-h-40 overflow-y-auto">
              {roles.map(role => (
                <div key={role.name} className="flex items-center space-x-2 mb-2">
                  <Checkbox
                    id={`role-${role.name}`}
                    checked={formData.assigned_roles?.includes(role.name) || false}
                    onCheckedChange={(checked) => {
                      const currentRoles = formData.assigned_roles || []
                      const updatedRoles = checked
                        ? [...currentRoles, role.name]
                        : currentRoles.filter(r => r !== role.name)
                      setFormData({ ...formData, assigned_roles: updatedRoles })
                    }}
                  />
                  <Label htmlFor={`role-${role.name}`} className="flex-1">
                    {role.name}
                  </Label>
                  <Badge variant="outline" className="text-xs">
                    {Math.max(0, role.permissions?.length || 0)} perms
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label>Notification Settings</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="email-notifications"
                  checked={formData.notification_settings?.email_enabled ?? true}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      notification_settings: {
                        email_enabled: !!checked,
                        in_app_enabled: formData.notification_settings?.in_app_enabled ?? true,
                        webhook_enabled: formData.notification_settings?.webhook_enabled ?? false,
                        reminder_hours: formData.notification_settings?.reminder_hours,
                        escalation_hours: formData.notification_settings?.escalation_hours,
                        custom_webhooks: formData.notification_settings?.custom_webhooks,
                      },
                    })
                  }
                />
                <Label htmlFor="email-notifications">Email notifications</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="app-notifications"
                  checked={formData.notification_settings?.in_app_enabled ?? true}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      notification_settings: {
                        email_enabled: formData.notification_settings?.email_enabled ?? true,
                        in_app_enabled: !!checked,
                        webhook_enabled: formData.notification_settings?.webhook_enabled ?? false,
                        reminder_hours: formData.notification_settings?.reminder_hours,
                        escalation_hours: formData.notification_settings?.escalation_hours,
                        custom_webhooks: formData.notification_settings?.custom_webhooks,
                      },
                    })
                  }
                />
                <Label htmlFor="app-notifications">In-app notifications</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="webhook-notifications"
                  checked={formData.notification_settings?.webhook_enabled ?? false}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      notification_settings: {
                        email_enabled: formData.notification_settings?.email_enabled ?? true,
                        in_app_enabled: formData.notification_settings?.in_app_enabled ?? true,
                        webhook_enabled: !!checked,
                        reminder_hours: formData.notification_settings?.reminder_hours,
                        escalation_hours: formData.notification_settings?.escalation_hours,
                        custom_webhooks: formData.notification_settings?.custom_webhooks,
                      },
                    })
                  }
                />
                <Label htmlFor="webhook-notifications">Webhook notifications</Label>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {step ? 'Update' : 'Add'} Step
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Main FlowDesigner Component
interface FlowDesignerProps {
  initialFlow?: ApprovalFlow
  onSave: (flow: ApprovalFlow) => void
  onCancel: () => void
}

export const FlowDesigner: React.FC<FlowDesignerProps> = ({ initialFlow, onSave, onCancel }) => {
  // Data fetching
  const { data: roles = [] } = useAvailableRoles()
  const { data: stepTemplates = [] } = useStepTemplates()

  // State management
  const { state, updateState } = useFlowDesignerState({
    flow: initialFlow || null,
    availableRoles: roles,
    availableSteps: stepTemplates,
    isCreating: !initialFlow,
    isEditing: !!initialFlow,
  })

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  // Step editor state
  const [editingStep, setEditingStep] = useState<ApprovalFlowStep | null>(null)
  const [isStepEditorOpen, setIsStepEditorOpen] = useState(false)

  // Flow metadata state
  const [flowMetadata, setFlowMetadata] = useState({
    name: initialFlow?.name || '',
    description: initialFlow?.description || '',
    category: initialFlow?.metadata?.category || '',
    priority: initialFlow?.metadata?.priority || 'medium',
    tags: initialFlow?.metadata?.tags || [],
  })

  // Validation
  const { validateFlow, isValidating } = useFlowValidation(state.flow || undefined)

  const handleDragStart = () => {
    updateState({ isDragging: true })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = state.flow?.steps.findIndex(step => step.id === active.id) || 0
      const newIndex = state.flow?.steps.findIndex(step => step.id === over.id) || 0

      if (state.flow) {
        const reorderedSteps = arrayMove(state.flow.steps, oldIndex, newIndex)
        const updatedSteps = reorderedSteps.map((step, index) => ({
          ...step,
          order: index,
        }))

        updateState({
          flow: {
            ...state.flow,
            steps: updatedSteps,
          },
        })
      }
    }

    updateState({ isDragging: false })
  }

  const handleAddStep = (template: StepTemplate) => {
    const newStep: ApprovalFlowStep = {
      id: `step-${Date.now()}`,
      name: template.name,
      description: template.description,
      step_type: template.step_type,
      order: (state.flow?.steps.length || 0),
      required: true,
      timeout_hours: template.default_timeout_hours || 24,
      assigned_roles: template.required_roles || [],
      conditions: template.default_conditions || [],
      actions: template.default_actions || [],
      notification_settings: {
        email_enabled: true,
        in_app_enabled: true,
        webhook_enabled: false,
        reminder_hours: undefined,
        escalation_hours: undefined,
        custom_webhooks: undefined,
      },
      is_parallel: false,
      depends_on: [],
    }

    if (state.flow) {
      updateState({
        flow: {
          ...state.flow,
          steps: [...state.flow.steps, newStep],
        },
      })
    } else {
      updateState({
        flow: {
          id: `flow-${Date.now()}`,
          name: '',
          description: '',
          version: 1,
          flow_type: 'custom',
          status: 'draft',
          steps: [newStep],
          conditions: [],
          metadata: {},
          created_at: new Date().toISOString(),
          created_by: 'current-user',
          updated_at: new Date().toISOString(),
        },
      })
    }
  }

  const handleEditStep = (step: ApprovalFlowStep) => {
    setEditingStep(step)
    setIsStepEditorOpen(true)
  }

  const handleSaveStep = (updatedStep: ApprovalFlowStep) => {
    if (state.flow) {
      const updatedSteps = state.flow.steps.map(step =>
        step.id === updatedStep.id ? updatedStep : step
      )
      updateState({
        flow: {
          ...state.flow,
          steps: updatedSteps,
        },
      })
    }
    setEditingStep(null)
    setIsStepEditorOpen(false)
  }

  const handleDeleteStep = (stepId: string) => {
    if (state.flow) {
      const updatedSteps = state.flow.steps
        .filter(step => step.id !== stepId)
        .map((step, index) => ({ ...step, order: index }))

      updateState({
        flow: {
          ...state.flow,
          steps: updatedSteps,
        },
      })
    }
  }

  const handleDuplicateStep = (step: ApprovalFlowStep) => {
    const duplicatedStep: ApprovalFlowStep = {
      ...step,
      id: `step-${Date.now()}`,
      name: `${step.name} (Copy)`,
      order: (state.flow?.steps.length || 0),
    }

    if (state.flow) {
      updateState({
        flow: {
          ...state.flow,
          steps: [...state.flow.steps, duplicatedStep],
        },
      })
    }
  }

  const handleSaveFlow = async () => {
    if (!state.flow) return

    // Validate flow before saving
    const validationResult = await validateFlow(state.flow || undefined)
    if (validationResult && !validationResult.is_valid) {
      updateState({ validationErrors: validationResult.errors })
      return
    }

    const finalFlow: ApprovalFlow = {
      ...state.flow,
      name: flowMetadata.name,
      description: flowMetadata.description,
      metadata: {
        ...state.flow.metadata,
        category: flowMetadata.category,
        priority: flowMetadata.priority,
        tags: flowMetadata.tags,
      },
    }

    onSave(finalFlow)
  }

  const handleValidateFlow = async () => {
    if (!state.flow) return
    await validateFlow(state.flow || undefined)
  }

  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Flow Designer</h2>
          <p className="text-gray-600">
            {state.isCreating ? 'Create a new approval flow' : 'Edit approval flow'}
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="outline" onClick={handleValidateFlow} disabled={isValidating}>
            {isValidating ? 'Validating...' : 'Validate'}
          </Button>
          <Button onClick={handleSaveFlow} disabled={!state.flow?.steps.length}>
            Save Flow
          </Button>
        </div>
      </div>

      {/* Validation Errors */}
      {state.validationErrors.length > 0 && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-700">
            <div className="space-y-1">
              <strong>Validation Errors:</strong>
              {state.validationErrors.map((error, index) => (
                <div key={index} className="text-sm">
                  • {error.message}
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Flow Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>Flow Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="flow-name">Flow Name *</Label>
            <Input
              id="flow-name"
              value={flowMetadata.name}
              onChange={(e) => setFlowMetadata({ ...flowMetadata, name: e.target.value })}
              placeholder="Enter flow name"
            />
          </div>
          <div>
            <Label htmlFor="flow-description">Description</Label>
            <Textarea
              id="flow-description"
              value={flowMetadata.description}
              onChange={(e) => setFlowMetadata({ ...flowMetadata, description: e.target.value })}
              placeholder="Describe the purpose of this flow"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="flow-category">Category</Label>
              <Input
                id="flow-category"
                value={flowMetadata.category}
                onChange={(e) => setFlowMetadata({ ...flowMetadata, category: e.target.value })}
                placeholder="e.g., General, Security, Compliance"
              />
            </div>
            <div>
              <Label htmlFor="flow-priority">Priority</Label>
              <Select
                value={flowMetadata.priority}
                onValueChange={(value) => setFlowMetadata({ ...flowMetadata, priority: value as any })}
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
            <div>
              <Label htmlFor="flow-tags">Tags (comma-separated)</Label>
              <Input
                id="flow-tags"
                value={flowMetadata.tags?.join(', ') || ''}
                onChange={(e) => setFlowMetadata({
                  ...flowMetadata,
                  tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean)
                })}
                placeholder="tag1, tag2, tag3"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Step Templates */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Step Templates</CardTitle>
              <CardDescription>
                Drag templates to add steps to your flow
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {stepTemplates.map(template => (
                <StepTemplateCard
                  key={template.id}
                  template={template}
                  onAdd={handleAddStep}
                />
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Flow Steps */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Flow Steps</CardTitle>
              <CardDescription>
                Drag to reorder steps. Click to edit step details.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                {state.flow && state.flow.steps.length > 0 ? (
                  <SortableContext items={state.flow.steps.map(s => s.id || `step-${!isNaN(s.order) ? s.order : 0}`)} strategy={verticalListSortingStrategy}>
                    {state.flow.steps.map((step, index) => (
                      <SortableStep
                        key={step.id || `step-${index}`}
                        step={step}
                        roles={roles}
                        onEdit={handleEditStep}
                        onDelete={handleDeleteStep}
                        onDuplicate={handleDuplicateStep}
                      />
                    ))}
                  </SortableContext>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No steps added yet. Add steps from the templates panel.</p>
                  </div>
                )}
              </DndContext>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Step Editor Dialog */}
      <StepEditorDialog
        step={editingStep}
        roles={roles}
        open={isStepEditorOpen}
        onClose={() => setIsStepEditorOpen(false)}
        onSave={handleSaveStep}
      />
    </div>
  )
}

export default FlowDesigner