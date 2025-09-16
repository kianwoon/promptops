import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Save, Play, Trash2, Settings, Users, Clock, AlertTriangle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface WorkflowStep {
  id: string;
  name: string;
  description?: string;
  type: string;
  stepNumber: number;
  config: Record<string, any>;
  conditionType?: string;
  conditionConfig?: Record<string, any>;
  approvalRequired: boolean;
  approvalRoles?: string[];
  approvalUsers?: string[];
  minApprovals: number;
  autoApproveAfter?: number;
  timeoutMinutes?: number;
  isOptional: boolean;
  canSkip: boolean;
  parentStepId?: string;
  childSteps?: string[];
  outputs?: Record<string, any>;
  transitions?: Record<string, any>;
}

interface WorkflowTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  useCase: string;
  workflowDefinition: Record<string, any>;
  stepsConfig: WorkflowStep[];
  escalationRules?: Record<string, any>[];
  isSystem: boolean;
  isPublic: boolean;
  requiredRoles?: string[];
  version: string;
  status: string;
  usageCount: number;
}

interface WorkflowDesignerProps {
  onSave?: (workflow: WorkflowTemplate) => void;
  onTest?: (workflow: WorkflowTemplate) => void;
  initialWorkflow?: WorkflowTemplate;
}

const stepTypes = [
  { value: 'manual_approval', label: 'Manual Approval', description: 'Requires manual approval from users' },
  { value: 'automated_approval', label: 'Automated Approval', description: 'Automatic approval based on conditions' },
  { value: 'parallel_approval', label: 'Parallel Approval', description: 'Multiple approvals in parallel' },
  { value: 'sequential_approval', label: 'Sequential Approval', description: 'Approvals in sequence' },
  { value: 'conditional_approval', label: 'Conditional Approval', description: 'Approval based on conditions' },
  { value: 'notification', label: 'Notification', description: 'Send notifications' },
  { value: 'data_collection', label: 'Data Collection', description: 'Collect additional data' },
  { value: 'external_system', label: 'External System', description: 'Integrate with external systems' },
  { value: 'timer', label: 'Timer', description: 'Time-based triggers' },
  { value: 'escalation', label: 'Escalation', description: 'Handle escalations' },
];

const conditionTypes = [
  { value: 'role_based', label: 'Role Based' },
  { value: 'user_based', label: 'User Based' },
  { value: 'resource_based', label: 'Resource Based' },
  { value: 'time_based', label: 'Time Based' },
  { value: 'value_based', label: 'Value Based' },
  { value: 'custom', label: 'Custom' },
];

const categories = [
  { value: 'approval', label: 'Approval' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'access_control', label: 'Access Control' },
  { value: 'security', label: 'Security' },
  { value: 'data_governance', label: 'Data Governance' },
];

const useCases = [
  { value: 'prompt_approval', label: 'Prompt Approval' },
  { value: 'user_access', label: 'User Access' },
  { value: 'api_key_request', label: 'API Key Request' },
  { value: 'content_review', label: 'Content Review' },
  { value: 'change_management', label: 'Change Management' },
  { value: 'incident_response', label: 'Incident Response' },
];

export const WorkflowDesigner: React.FC<WorkflowDesignerProps> = ({
  onSave,
  onTest,
  initialWorkflow,
}) => {
  const [workflow, setWorkflow] = useState<WorkflowTemplate>(initialWorkflow || {
    id: uuidv4(),
    name: '',
    description: '',
    category: 'approval',
    useCase: 'prompt_approval',
    workflowDefinition: {},
    stepsConfig: [],
    escalationRules: [],
    isSystem: false,
    isPublic: false,
    requiredRoles: [],
    version: '1.0.0',
    status: 'draft',
    usageCount: 0,
  });

  const [selectedStep, setSelectedStep] = useState<string | null>(null);
  const [showStepConfig, setShowStepConfig] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedStepData = useMemo(() => {
    return workflow.stepsConfig.find(step => step.id === selectedStep);
  }, [workflow.stepsConfig, selectedStep]);

  const addStep = useCallback((type: string) => {
    const newStep: WorkflowStep = {
      id: uuidv4(),
      name: `${type.replace('_', ' ').toUpperCase()} Step`,
      type,
      stepNumber: workflow.stepsConfig.length + 1,
      config: {},
      approvalRequired: type.includes('approval'),
      minApprovals: 1,
      isOptional: false,
      canSkip: false,
    };

    setWorkflow(prev => ({
      ...prev,
      stepsConfig: [...prev.stepsConfig, newStep],
    }));

    setSelectedStep(newStep.id);
    setShowStepConfig(true);
    setErrors({});
  }, [workflow.stepsConfig.length]);

  const updateStep = useCallback((stepId: string, updates: Partial<WorkflowStep>) => {
    setWorkflow(prev => ({
      ...prev,
      stepsConfig: prev.stepsConfig.map(step =>
        step.id === stepId ? { ...step, ...updates } : step
      ),
    }));
  }, []);

  const deleteStep = useCallback((stepId: string) => {
    setWorkflow(prev => ({
      ...prev,
      stepsConfig: prev.stepsConfig.filter(step => step.id !== stepId),
    }));

    if (selectedStep === stepId) {
      setSelectedStep(null);
      setShowStepConfig(false);
    }
  }, [selectedStep]);

  const validateWorkflow = useCallback(() => {
    const newErrors: Record<string, string> = {};

    if (!workflow.name.trim()) {
      newErrors.name = 'Workflow name is required';
    }

    if (!workflow.description?.trim()) {
      newErrors.description = 'Workflow description is required';
    }

    if (workflow.stepsConfig.length === 0) {
      newErrors.steps = 'At least one step is required';
    }

    workflow.stepsConfig.forEach((step, index) => {
      if (!step.name.trim()) {
        newErrors[`step_${step.id}_name`] = `Step ${index + 1} name is required`;
      }

      if (step.approvalRequired && (!step.approvalRoles || step.approvalRoles.length === 0) && (!step.approvalUsers || step.approvalUsers.length === 0)) {
        newErrors[`step_${step.id}_approvers`] = `Step ${index + 1} requires approvers`;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [workflow]);

  const handleSave = useCallback(() => {
    if (!validateWorkflow()) {
      return;
    }

    // Update workflow definition with current steps
    const updatedWorkflow = {
      ...workflow,
      workflowDefinition: {
        steps: workflow.stepsConfig,
        escalationRules: workflow.escalationRules,
        category: workflow.category,
        timeoutMinutes: 1440, // Default 24 hours
        requiresEvidence: workflow.stepsConfig.some(step => step.type === 'data_collection'),
        autoApproveThreshold: workflow.stepsConfig.find(step => step.autoApproveAfter)?.autoApproveAfter,
        notificationSettings: {
          email: true,
          inApp: true,
        },
      },
    };

    onSave?.(updatedWorkflow);
  }, [workflow, validateWorkflow, onSave]);

  const handleTest = useCallback(() => {
    if (!validateWorkflow()) {
      return;
    }

    onTest?.(workflow);
  }, [workflow, validateWorkflow, onTest]);

  const renderStepCard = (step: WorkflowStep) => {
    const isSelected = selectedStep === step.id;
    const stepType = stepTypes.find(t => t.value === step.type);

    return (
      <Card
        className={`cursor-pointer transition-all ${isSelected ? 'ring-2 ring-blue-500' : 'hover:shadow-md'}`}
        onClick={() => {
          setSelectedStep(step.id);
          setShowStepConfig(true);
        }}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">
              {step.name}
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="text-xs">
                {stepType?.label}
              </Badge>
              <Badge variant={step.approvalRequired ? 'default' : 'secondary'} className="text-xs">
                Step {step.stepNumber}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <CardDescription className="text-xs mb-2">
            {step.description || stepType?.description}
          </CardDescription>

          {step.approvalRequired && (
            <div className="flex items-center space-x-2 text-xs text-gray-600">
              <Users className="h-3 w-3" />
              <span>{step.minApprovals} approval{step.minApprovals > 1 ? 's' : ''} required</span>
            </div>
          )}

          {step.timeoutMinutes && (
            <div className="flex items-center space-x-2 text-xs text-gray-600">
              <Clock className="h-3 w-3" />
              <span>{step.timeoutMinutes} min timeout</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderStepConfiguration = () => {
    if (!selectedStepData) return null;

    return (
      <Card>
        <CardHeader>
          <CardTitle>Configure Step: {selectedStepData.name}</CardTitle>
          <CardDescription>
            {stepTypes.find(t => t.value === selectedStepData.type)?.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="step-name">Step Name</Label>
              <Input
                id="step-name"
                value={selectedStepData.name}
                onChange={(e) => updateStep(selectedStepData.id, { name: e.target.value })}
                className={errors[`step_${selectedStepData.id}_name`] ? 'border-red-500' : ''}
              />
              {errors[`step_${selectedStepData.id}_name`] && (
                <p className="text-sm text-red-500">{errors[`step_${selectedStepData.id}_name`]}</p>
              )}
            </div>

            <div>
              <Label htmlFor="step-description">Description</Label>
              <Textarea
                id="step-description"
                value={selectedStepData.description || ''}
                onChange={(e) => updateStep(selectedStepData.id, { description: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          {selectedStepData.type.includes('approval') && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="min-approvals">Minimum Approvals</Label>
                  <Input
                    id="min-approvals"
                    type="number"
                    min="1"
                    value={selectedStepData.minApprovals}
                    onChange={(e) => updateStep(selectedStepData.id, { minApprovals: parseInt(e.target.value) || 1 })}
                  />
                </div>

                <div>
                  <Label htmlFor="auto-approve-after">Auto-approve After (minutes)</Label>
                  <Input
                    id="auto-approve-after"
                    type="number"
                    value={selectedStepData.autoApproveAfter || ''}
                    onChange={(e) => updateStep(selectedStepData.id, { autoApproveAfter: e.target.value ? parseInt(e.target.value) : undefined })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="timeout-minutes">Timeout (minutes)</Label>
                  <Input
                    id="timeout-minutes"
                    type="number"
                    value={selectedStepData.timeoutMinutes || ''}
                    onChange={(e) => updateStep(selectedStepData.id, { timeoutMinutes: e.target.value ? parseInt(e.target.value) : undefined })}
                  />
                </div>

                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="is-optional"
                      checked={selectedStepData.isOptional}
                      onChange={(e) => updateStep(selectedStepData.id, { isOptional: e.target.checked })}
                    />
                    <Label htmlFor="is-optional">Optional</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="can-skip"
                      checked={selectedStepData.canSkip}
                      onChange={(e) => updateStep(selectedStepData.id, { canSkip: e.target.checked })}
                    />
                    <Label htmlFor="can-skip">Can Skip</Label>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => deleteStep(selectedStepData.id)}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Step
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Workflow Designer</span>
            <div className="flex space-x-2">
              <Button variant="outline" onClick={handleTest}>
                <Play className="h-4 w-4 mr-2" />
                Test Workflow
              </Button>
              <Button onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" />
                Save Workflow
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Workflow Configuration */}
            <div className="lg:col-span-1 space-y-4">
              <div>
                <Label htmlFor="workflow-name">Workflow Name *</Label>
                <Input
                  id="workflow-name"
                  value={workflow.name}
                  onChange={(e) => setWorkflow(prev => ({ ...prev, name: e.target.value }))}
                  className={errors.name ? 'border-red-500' : ''}
                />
                {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
              </div>

              <div>
                <Label htmlFor="workflow-description">Description *</Label>
                <Textarea
                  id="workflow-description"
                  value={workflow.description}
                  onChange={(e) => setWorkflow(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className={errors.description ? 'border-red-500' : ''}
                />
                {errors.description && <p className="text-sm text-red-500">{errors.description}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select value={workflow.category} onValueChange={(value) => setWorkflow(prev => ({ ...prev, category: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="use-case">Use Case</Label>
                  <Select value={workflow.useCase} onValueChange={(value) => setWorkflow(prev => ({ ...prev, useCase: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {useCases.map(useCase => (
                        <SelectItem key={useCase.value} value={useCase.value}>
                          {useCase.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is-public"
                    checked={workflow.isPublic}
                    onChange={(e) => setWorkflow(prev => ({ ...prev, isPublic: e.target.checked }))}
                  />
                  <Label htmlFor="is-public">Public Template</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is-system"
                    checked={workflow.isSystem}
                    onChange={(e) => setWorkflow(prev => ({ ...prev, isSystem: e.target.checked }))}
                    disabled={!initialWorkflow?.isSystem}
                  />
                  <Label htmlFor="is-system">System Template</Label>
                </div>
              </div>

              {errors.steps && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{errors.steps}</AlertDescription>
                </Alert>
              )}
            </div>

            {/* Step Configuration */}
            <div className="lg:col-span-2">
              <Tabs defaultValue="steps" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="steps">Workflow Steps</TabsTrigger>
                  <TabsTrigger value="config">Configuration</TabsTrigger>
                </TabsList>

                <TabsContent value="steps" className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">Workflow Steps</h3>
                    <div className="flex space-x-2">
                      <Select onValueChange={addStep}>
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Add step type" />
                        </SelectTrigger>
                        <SelectContent>
                          {stepTypes.map(type => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {workflow.stepsConfig.length === 0 ? (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <Settings className="h-12 w-12 text-gray-400 mb-4" />
                        <p className="text-gray-500 text-center">
                          No steps added yet.<br />
                          Select a step type to get started.
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {workflow.stepsConfig.map(step => renderStepCard(step))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="config">
                  {showStepConfig && selectedStepData ? (
                    renderStepConfiguration()
                  ) : (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <Settings className="h-12 w-12 text-gray-400 mb-4" />
                        <p className="text-gray-500 text-center">
                          Select a step to configure its settings.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};