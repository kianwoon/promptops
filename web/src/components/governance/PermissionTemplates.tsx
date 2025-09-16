import React, { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Switch,
} from '@/components/ui/switch'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Plus,
  Settings,
  Copy,
  Trash2,
  Edit3,
  Play,
  CheckCircle,
  AlertCircle,
  Info,
  Users,
  Shield,
  Key,
  FolderOpen,
  Database,
  GitBranch,
  FileText,
  Download,
  Upload,
  Search,
  Filter
} from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { governanceAPI } from '@/lib/api/governance'
import type {
  PermissionTemplate,
  PermissionTemplateCreate,
  PermissionTemplateUpdate,
  CustomRole,
  PermissionCheckResponse,
  RoleAssignment
} from '@/types/governance'
import { toast } from 'react-hot-toast'

interface TemplateFormData {
  name: string
  description: string
  category: string
  is_system: boolean
  permissions: PermissionTemplatePermission[]
}

interface PermissionTemplatePermission {
  resource: string
  action: string
  conditions?: string[]
}

export function PermissionTemplates() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<PermissionTemplate | null>(null)
  const [applyingTemplate, setApplyingTemplate] = useState<PermissionTemplate | null>(null)
  const [selectedRoleForApply, setSelectedRoleForApply] = useState<string>('')
  const [isApplyDialogOpen, setIsApplyDialogOpen] = useState(false)
  const [exportingTemplate, setExportingTemplate] = useState<PermissionTemplate | null>(null)

  const queryClient = useQueryClient()

  // Fetch permission templates
  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['permission-templates'],
    queryFn: () => governanceAPI.getPermissionTemplates()
  })

  // Fetch custom roles for template application
  const { data: roles } = useQuery({
    queryKey: ['custom-roles'],
    queryFn: () => governanceAPI.getCustomRoles()
  })

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: (template: PermissionTemplateCreate) =>
      governanceAPI.createPermissionTemplate(template),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permission-templates'] })
      toast.success('Permission template created successfully')
      setIsCreateDialogOpen(false)
      resetForm()
    },
    onError: (error) => {
      toast.error('Failed to create permission template')
      console.error('Template creation error:', error)
    }
  })

  // Update template mutation
  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: PermissionTemplateUpdate }) =>
      governanceAPI.updatePermissionTemplate(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permission-templates'] })
      toast.success('Permission template updated successfully')
      setIsCreateDialogOpen(false)
      setEditingTemplate(null)
      resetForm()
    },
    onError: (error) => {
      toast.error('Failed to update permission template')
      console.error('Template update error:', error)
    }
  })

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: (id: string) => governanceAPI.deletePermissionTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permission-templates'] })
      toast.success('Permission template deleted successfully')
    },
    onError: (error) => {
      toast.error('Failed to delete permission template')
      console.error('Template deletion error:', error)
    }
  })

  // Apply template to role mutation
  const applyTemplateMutation = useMutation({
    mutationFn: ({ templateId, roleName }: { templateId: string; roleName: string }) =>
      governanceAPI.applyTemplateToRole(templateId, roleName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-roles'] })
      toast.success('Template applied to role successfully')
      setIsApplyDialogOpen(false)
      setApplyingTemplate(null)
      setSelectedRoleForApply('')
    },
    onError: (error) => {
      toast.error('Failed to apply template to role')
      console.error('Template application error:', error)
    }
  })

  // Form state
  const [formData, setFormData] = useState<TemplateFormData>({
    name: '',
    description: '',
    category: '',
    is_system: false,
    permissions: []
  })

  // Add new permission to form
  const addPermission = () => {
    setFormData(prev => ({
      ...prev,
      permissions: [...prev.permissions, { resource: '', action: '', conditions: [] }]
    }))
  }

  // Update permission in form
  const updatePermission = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.map((perm, i) =>
        i === index ? { ...perm, [field]: value } : perm
      )
    }))
  }

  // Remove permission from form
  const removePermission = (index: number) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.filter((_, i) => i !== index)
    }))
  }

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: '',
      is_system: false,
      permissions: []
    })
  }

  // Handle form submission
  const handleSubmit = () => {
    if (!formData.name || !formData.category) {
      toast.error('Name and category are required')
      return
    }

    if (formData.permissions.length === 0) {
      toast.error('At least one permission is required')
      return
    }

    // Validate permissions
    const invalidPermissions = formData.permissions.filter(p => !p.resource || !p.action)
    if (invalidPermissions.length > 0) {
      toast.error('All permissions must have resource and action specified')
      return
    }

    const templateData = {
      name: formData.name,
      description: formData.description,
      category: formData.category,
      is_system: formData.is_system,
      permissions: formData.permissions
    }

    if (editingTemplate) {
      updateTemplateMutation.mutate({
        id: editingTemplate.id,
        data: templateData
      })
    } else {
      createTemplateMutation.mutate(templateData)
    }
  }

  // Handle template application
  const handleApplyTemplate = () => {
    if (!applyingTemplate || !selectedRoleForApply) {
      toast.error('Please select a role')
      return
    }

    applyTemplateMutation.mutate({
      templateId: applyingTemplate.id,
      roleName: selectedRoleForApply
    })
  }

  // Handle template export
  const handleExportTemplate = (template: PermissionTemplate) => {
    const exportData = {
      name: template.name,
      description: template.description,
      category: template.category,
      permissions: template.permissions
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${template.name.toLowerCase().replace(/\s+/g, '-')}-template.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success('Template exported successfully')
  }

  // Filter templates
  const filteredTemplates = templates?.data?.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory
    return matchesSearch && matchesCategory
  }) || []

  // Get unique categories
  const categories = [...new Set(templates?.data?.map(t => t.category) || [])]

  // Start editing template
  const startEditing = (template: PermissionTemplate) => {
    setEditingTemplate(template)
    setFormData({
      name: template.name,
      description: template.description,
      category: template.category,
      is_system: template.is_system,
      permissions: template.permissions
    })
    setIsCreateDialogOpen(true)
  }

  // Close dialogs and reset form
  const closeDialogs = () => {
    setIsCreateDialogOpen(false)
    setIsApplyDialogOpen(false)
    setEditingTemplate(null)
    setApplyingTemplate(null)
    resetForm()
  }

  if (templatesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading permission templates...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Permission Templates</h1>
          <p className="text-muted-foreground">
            Manage and apply permission templates for common scenarios
          </p>
        </div>
        <Button
          onClick={() => setIsCreateDialogOpen(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Create Template
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Key className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{templates?.data?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Total Templates</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Settings className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">
                  {templates?.data?.filter(t => t.is_system).length || 0}
                </p>
                <p className="text-sm text-muted-foreground">System Templates</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Users className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">
                  {templates?.data?.filter(t => !t.is_system).length || 0}
                </p>
                <p className="text-sm text-muted-foreground">Custom Templates</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Shield className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">
                  {templates?.data?.reduce((sum, t) => sum + t.permissions.length, 0) || 0}
                </p>
                <p className="text-sm text-muted-foreground">Total Permissions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((template) => (
          <Card key={template.id} className="relative">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  {template.is_system && (
                    <Badge variant="secondary" className="text-xs">
                      System
                    </Badge>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => startEditing(template)}
                      disabled={template.is_system}
                    >
                      <Edit3 className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setApplyingTemplate(template)
                        setIsApplyDialogOpen(true)
                      }}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Apply to Role
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleExportTemplate(template)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(template.permissions, null, 2))
                        toast.success('Permissions copied to clipboard')
                      }}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Permissions
                    </DropdownMenuItem>
                    {!template.is_system && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <DropdownMenuItem
                            className="text-destructive"
                            onSelect={(e) => e.preventDefault()}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Template</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete the template "{template.name}"? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteTemplateMutation.mutate(template.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <CardDescription className="line-clamp-2">
                {template.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <Badge variant="outline">{template.category}</Badge>
                  <span className="text-muted-foreground">
                    {template.permissions.length} permissions
                  </span>
                </div>

                {/* Permissions Preview */}
                <div className="space-y-2">
                  <p className="text-sm font-medium">Permissions:</p>
                  <div className="space-y-1">
                    {template.permissions.slice(0, 3).map((permission, index) => (
                      <div key={index} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-medium">{permission.resource}</span>
                        <span>→</span>
                        <span>{permission.action}</span>
                        {permission.conditions && permission.conditions.length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            +{permission.conditions.length} conditions
                          </Badge>
                        )}
                      </div>
                    ))}
                    {template.permissions.length > 3 && (
                      <p className="text-xs text-muted-foreground">
                        +{template.permissions.length - 3} more permissions...
                      </p>
                    )}
                  </div>
                </div>

                {/* Usage Count (if available) */}
                {template.usage_count !== undefined && template.usage_count > 0 && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    <span>Used by {template.usage_count} roles</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create/Edit Template Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Permission Template' : 'Create Permission Template'}
            </DialogTitle>
            <DialogDescription>
              Define a template with permissions that can be applied to roles
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Project Admin Template"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  placeholder="e.g., Project Management"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe the purpose and use case of this template"
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_system"
                checked={formData.is_system}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_system: checked }))}
                disabled={editingTemplate?.is_system}
              />
              <Label htmlFor="is_system">System Template (cannot be modified by users)</Label>
            </div>

            {/* Permissions */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-lg font-semibold">Permissions</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addPermission}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Permission
                </Button>
              </div>

              {formData.permissions.map((permission, index) => (
                <Card key={index}>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Resource *</Label>
                        <Select
                          value={permission.resource}
                          onValueChange={(value) => updatePermission(index, 'resource', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select resource" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="templates">Templates</SelectItem>
                            <SelectItem value="projects">Projects</SelectItem>
                            <SelectItem value="users">Users</SelectItem>
                            <SelectItem value="system">System</SelectItem>
                            <SelectItem value="governance">Governance</SelectItem>
                            <SelectItem value="rbac">RBAC</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Action *</Label>
                        <Select
                          value={permission.action}
                          onValueChange={(value) => updatePermission(index, 'action', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select action" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="create">Create</SelectItem>
                            <SelectItem value="read">Read</SelectItem>
                            <SelectItem value="update">Update</SelectItem>
                            <SelectItem value="delete">Delete</SelectItem>
                            <SelectItem value="manage">Manage</SelectItem>
                            <SelectItem value="execute">Execute</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removePermission(index)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {formData.permissions.length === 0 && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>No permissions added</AlertTitle>
                  <AlertDescription>
                    Add at least one permission to create this template
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialogs}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                createTemplateMutation.isPending ||
                updateTemplateMutation.isPending ||
                !formData.name ||
                !formData.category ||
                formData.permissions.length === 0
              }
            >
              {editingTemplate ? 'Update Template' : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply Template Dialog */}
      <Dialog open={isApplyDialogOpen} onOpenChange={setIsApplyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply Template to Role</DialogTitle>
            <DialogDescription>
              Apply permissions from "{applyingTemplate?.name}" to a role
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="role">Select Role *</Label>
              <Select value={selectedRoleForApply} onValueChange={setSelectedRoleForApply}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles?.data?.map((role) => (
                    <SelectItem key={role.name} value={role.name}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Template Application</AlertTitle>
              <AlertDescription>
                This will add all permissions from the template to the selected role. Existing permissions will not be removed.
              </AlertDescription>
            </Alert>

            {applyingTemplate && (
              <div className="space-y-2">
                <Label>Permissions to be applied:</Label>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {applyingTemplate.permissions.map((permission, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm p-2 bg-muted rounded">
                      <span className="font-medium">{permission.resource}</span>
                      <span>→</span>
                      <span>{permission.action}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApplyDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleApplyTemplate}
              disabled={!selectedRoleForApply || applyTemplateMutation.isPending}
            >
              Apply Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}