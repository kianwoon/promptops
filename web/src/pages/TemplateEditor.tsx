import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MonacoTemplateEditor } from '@/components/MonacoTemplateEditor'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Save, Play, Copy, Plus, X } from 'lucide-react'

interface Template {
  id?: string
  name: string
  description: string
  version: string
  content: string
  status: 'draft' | 'active' | 'deprecated'
  tags: string[]
  category: string
  author: string
  created?: string
  updated?: string
}

const sampleTemplate = `name: customer-support-response
version: "1.0.0"
description: "Customer support response template for handling common inquiries"

# Template configuration
template: |
  You are a helpful customer support agent for {{company}}.
  
  Customer Inquiry: {{inquiry}}
  
  Please provide a professional and helpful response that:
  - Addresses the customer's specific concern
  - Maintains a friendly and professional tone
  - Includes next steps if applicable
  
  Response:

# Variables used in the template
variables:
  company:
    type: string
    description: "Company name"
    required: true
    default: "our company"
  
  inquiry:
    type: string
    description: "Customer's inquiry or question"
    required: true

# Module composition
modules:
  - name: tone-governance
    version: "1.0.0"
    config:
      tone: "professional"
      style: "helpful"

# Validation rules
validation:
  max_tokens: 500
  required_variables: ["company", "inquiry"]
  
# Deployment settings
deployment:
  auto_deploy: false
  review_required: true
  test_suite: "customer-support-tests"`

export function TemplateEditor() {
  const { id, version } = useParams()
  const navigate = useNavigate()
  const [template, setTemplate] = useState<Template>({
    name: '',
    description: '',
    version: '1.0.0',
    content: sampleTemplate,
    status: 'draft',
    tags: [],
    category: 'general',
    author: 'current-user'
  })
  const [newTag, setNewTag] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // Load template data if editing existing template
    if (id && version) {
      // TODO: Load template from API
      console.log(`Loading template ${id} version ${version}`)
    }
  }, [id, version])

  const handleSave = async (content: string) => {
    setIsLoading(true)
    try {
      const updatedTemplate = { ...template, content }
      
      // TODO: Save template via API
      console.log('Saving template:', updatedTemplate)
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setTemplate(updatedTemplate)
      
      // Navigate back to templates list if creating new template
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
    setIsLoading(true)
    try {
      // TODO: Test template via API
      console.log('Testing template:', content)
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      alert('Template test completed successfully!')
    } catch (error) {
      console.error('Failed to test template:', error)
      alert('Template test failed. Please check the template configuration.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddTag = () => {
    if (newTag.trim() && !template.tags.includes(newTag.trim())) {
      setTemplate(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }))
      setNewTag('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTemplate(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  const handleDuplicate = () => {
    const duplicated = {
      ...template,
      name: `${template.name} (Copy)`,
      id: undefined,
      created: undefined,
      updated: undefined
    }
    setTemplate(duplicated)
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
              {version ? `Edit ${template.name}` : 'Create Template'}
            </h1>
            <p className="text-muted-foreground">
              {version ? 'Edit template configuration and YAML' : 'Create a new prompt template'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant={template.status === 'active' ? 'default' : template.status === 'deprecated' ? 'destructive' : 'secondary'}>
            {template.status}
          </Badge>
          <Button variant="outline" size="sm" onClick={handleDuplicate}>
            <Copy className="w-4 h-4 mr-2" />
            Duplicate
          </Button>
        </div>
      </div>

      {/* Template Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>Template Information</CardTitle>
          <CardDescription>
            Basic information and metadata for your template
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Template Name</Label>
              <Input
                id="name"
                value={template.name}
                onChange={(e) => setTemplate(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter template name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="version">Version</Label>
              <Input
                id="version"
                value={template.version}
                onChange={(e) => setTemplate(prev => ({ ...prev, version: e.target.value }))}
                placeholder="1.0.0"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={template.category} onValueChange={(value) => setTemplate(prev => ({ ...prev, category: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="customer-support">Customer Support</SelectItem>
                  <SelectItem value="content-creation">Content Creation</SelectItem>
                  <SelectItem value="code-generation">Code Generation</SelectItem>
                  <SelectItem value="data-analysis">Data Analysis</SelectItem>
                  <SelectItem value="documentation">Documentation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={template.status} onValueChange={(value: any) => setTemplate(prev => ({ ...prev, status: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="deprecated">Deprecated</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={template.description}
                onChange={(e) => setTemplate(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter template description"
                rows={3}
              />
            </div>
            
            <div className="md:col-span-2 space-y-2">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {template.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                    {tag}
                    <X 
                      className="w-3 h-3 cursor-pointer" 
                      onClick={() => handleRemoveTag(tag)}
                    />
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Add tag"
                  onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                />
                <Button variant="outline" size="sm" onClick={handleAddTag}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monaco Editor */}
      <MonacoTemplateEditor
        initialContent={template.content}
        onSave={handleSave}
        onTest={handleTest}
        height="800px"
      />
    </div>
  )
}