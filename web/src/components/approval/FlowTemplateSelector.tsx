import React, { useState } from 'react'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  CheckCircle,
  Layers,
  Clock,
  Users,
  Settings,
  Play,
  Zap,
  Shield,
  AlertCircle
} from 'lucide-react'

import type { FlowTemplate, CustomRole } from '@/types/approval-flows'
import { useFlowTemplates, useAvailableRoles, useCreateFlowFromTemplate } from '@/hooks/useApprovalFlows'

interface FlowTemplateSelectorProps {
  onSelect?: (template: FlowTemplate) => void
  onCreate?: (template: FlowTemplate, customName?: string, customRoles?: Record<string, string[]>) => void
  onClose?: () => void
}

const TemplateCard: React.FC<{
  template: FlowTemplate;
  onSelect: () => void;
  selectedRoles: Record<string, string[]>;
  onRoleChange: (stepType: string, roles: string[]) => void;
}> = ({ template, onSelect, selectedRoles, onRoleChange }) => {
  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'simple': return 'bg-green-100 text-green-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'complex': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getComplexityIcon = (complexity: string) => {
    switch (complexity) {
      case 'simple': return <Zap className="h-4 w-4" />
      case 'medium': return <Settings className="h-4 w-4" />
      case 'complex': return <Shield className="h-4 w-4" />
      default: return <AlertCircle className="h-4 w-4" />
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'basic': return <CheckCircle className="h-4 w-4" />
      case 'advanced': return <Layers className="h-4 w-4" />
      case 'compliance': return <Shield className="h-4 w-4" />
      default: return <Settings className="h-4 w-4" />
    }
  }

  return (
    <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 border-2 hover:border-blue-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2">
            {getCategoryIcon(template.category)}
            <div>
              <CardTitle className="text-lg">{template.name}</CardTitle>
              <CardDescription className="text-sm">{template.description}</CardDescription>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className={getComplexityColor(template.complexity)}>
              {getComplexityIcon(template.complexity)}
              <span className="ml-1">{template.complexity}</span>
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* Template Info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center space-x-2 text-gray-600">
            <Clock className="h-4 w-4" />
            <span>{template.estimated_duration_hours}h</span>
          </div>
          <div className="flex items-center space-x-2 text-gray-600">
            <Layers className="h-4 w-4" />
            <span>{template.steps.length} steps</span>
          </div>
        </div>

        {/* Steps Overview */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Steps:</h4>
          <div className="space-y-1">
            {template.steps.map((step, index) => (
              <div key={index} className="flex items-center justify-between text-xs bg-gray-50 rounded p-2">
                <span className="font-medium">{step.name}</span>
                <div className="flex items-center space-x-1">
                  <Badge variant="outline" className="text-xs">
                    {step.step_type}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {step.timeout_hours}h
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Role Assignment */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Assign Roles:</h4>
          <div className="space-y-2">
            {template.steps.map((step, index) => (
              <div key={index} className="flex items-center space-x-2">
                <Label className="text-xs w-20">{step.name}:</Label>
                <Select
                  value={selectedRoles[step.step_type]?.[0] || ''}
                  onValueChange={(value) => onRoleChange(step.step_type, value ? [value] : [])}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="approver">Approver</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1">
          {template.tags.map(tag => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>

        <Button
          onClick={onSelect}
          className="w-full"
          disabled={template.steps.some(step => !selectedRoles[step.step_type]?.length)}
        >
          <Play className="h-4 w-4 mr-2" />
          Use This Template
        </Button>
      </CardContent>
    </Card>
  )
}

export const FlowTemplateSelector: React.FC<FlowTemplateSelectorProps> = ({
  onSelect,
  onCreate,
  onClose
}) => {
  const { data: templates = [] } = useFlowTemplates()
  const { data: roles = [] } = useAvailableRoles()
  const createFlowFromTemplate = useCreateFlowFromTemplate()

  const [selectedTemplate, setSelectedTemplate] = useState<FlowTemplate | null>(null)
  const [customName, setCustomName] = useState('')
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string[]>>({})
  const [activeCategory, setActiveCategory] = useState<'all' | 'basic' | 'advanced'>('all')

  const filteredTemplates = templates.filter(template =>
    activeCategory === 'all' || template.category === activeCategory
  )

  const handleRoleChange = (stepType: string, roles: string[]) => {
    setSelectedRoles(prev => ({
      ...prev,
      [stepType]: roles
    }))
  }

  const handleTemplateSelect = (template: FlowTemplate) => {
    setSelectedTemplate(template)
    setCustomName(template.name)

    // Initialize role assignments
    const initialRoles: Record<string, string[]> = {}
    template.steps.forEach(step => {
      initialRoles[step.step_type] = step.assigned_roles
    })
    setSelectedRoles(initialRoles)
  }

  const handleCreateFromTemplate = async () => {
    if (!selectedTemplate) return

    try {
      await createFlowFromTemplate.mutateAsync({
        template: selectedTemplate,
        customName: customName || undefined,
        customRoles: selectedRoles
      })

      if (onCreate) {
        onCreate(selectedTemplate, customName, selectedRoles)
      }
      if (onClose) {
        onClose()
      }
    } catch (error) {
      console.error('Failed to create flow from template:', error)
    }
  }

  const handleClose = () => {
    setSelectedTemplate(null)
    setCustomName('')
    setSelectedRoles({})
    if (onClose) {
      onClose()
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold">Choose a Flow Template</h2>
        <p className="text-gray-600 mt-2">
          Select a template to quickly create an approval flow with pre-configured steps
        </p>
      </div>

      {/* Category Filter */}
      <Tabs value={activeCategory} onValueChange={(value) => setActiveCategory(value as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">All Templates</TabsTrigger>
          <TabsTrigger value="basic">Basic</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value={activeCategory} className="space-y-6">
          {/* Templates Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredTemplates.map(template => (
              <TemplateCard
                key={template.id}
                template={template}
                onSelect={() => handleTemplateSelect(template)}
                selectedRoles={selectedRoles}
                onRoleChange={handleRoleChange}
              />
            ))}
          </div>

          {/* No Templates */}
          {filteredTemplates.length === 0 && (
            <div className="text-center py-12">
              <Settings className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No templates found</h3>
              <p className="text-gray-600">Try selecting a different category or contact your administrator.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Template Selection Dialog */}
      {selectedTemplate && (
        <Dialog open={!!selectedTemplate} onOpenChange={(open) => !open && handleClose()}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Flow from Template</DialogTitle>
              <DialogDescription>
                Customize the "{selectedTemplate.name}" template before creating your flow
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Flow Name */}
              <div>
                <Label htmlFor="flow-name">Flow Name</Label>
                <Input
                  id="flow-name"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Enter flow name"
                />
              </div>

              {/* Template Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Template Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Category:</span>
                      <Badge variant="outline" className="ml-2">{selectedTemplate.category}</Badge>
                    </div>
                    <div>
                      <span className="font-medium">Complexity:</span>
                      <Badge variant="outline" className="ml-2">{selectedTemplate.complexity}</Badge>
                    </div>
                    <div>
                      <span className="font-medium">Duration:</span>
                      <span className="ml-2">{selectedTemplate.estimated_duration_hours} hours</span>
                    </div>
                    <div>
                      <span className="font-medium">Steps:</span>
                      <span className="ml-2">{selectedTemplate.steps.length}</span>
                    </div>
                  </div>

                  <div>
                    <span className="font-medium">Description:</span>
                    <p className="text-gray-600 mt-1">{selectedTemplate.description}</p>
                  </div>

                  <div>
                    <span className="font-medium">Tags:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedTemplate.tags.map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Role Assignments */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Role Assignments</CardTitle>
                  <CardDescription>
                    Assign roles to each step in the flow
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedTemplate.steps.map((step, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">{step.name}</div>
                        <div className="text-sm text-gray-600">{step.description}</div>
                        <Badge variant="outline" className="text-xs mt-1">
                          {step.step_type} • {step.timeout_hours}h timeout
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Label className="text-sm">Assign to:</Label>
                        <Select
                          value={selectedRoles[step.step_type]?.[0] || ''}
                          onValueChange={(value) => handleRoleChange(step.step_type, value ? [value] : [])}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            {roles.map(role => (
                              <SelectItem key={role.name} value={role.name}>
                                {role.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateFromTemplate}
                disabled={createFlowFromTemplate.isPending || selectedTemplate.steps.some(step => !selectedRoles[step.step_type]?.length)}
              >
                {createFlowFromTemplate.isPending ? 'Creating...' : 'Create Flow'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

export default FlowTemplateSelector