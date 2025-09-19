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
  MoreVertical,
  Plus,
  Search,
  Edit,
  Trash2,
  Users,
  Shield,
  Copy,
  Settings,
  Key,
  GitBranch,
  Clock,
  Check,
  X
} from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDate, formatRelativeTime } from '@/lib/utils'
import { makeAuthenticatedRequest } from '@/lib/googleAuth'

// API Types
interface RoleResponse {
  name: string
  description?: string
  permissions: string[]
  permission_templates?: string[]
  inherited_roles?: string[]
  inheritance_type?: string
  conditions?: Record<string, any>
  is_system: boolean
  is_active: boolean
  created_at: string
  updated_at: string
  created_by?: string
  tenant_id?: string
}

interface PermissionTemplateResponse {
  id: string
  name: string
  description?: string
  permissions: Array<{
    resource_type: string
    action: string
    conditions?: Record<string, any>
  }>
  category: string
  is_system: boolean
  is_active: boolean
  created_at: string
  updated_at: string
  created_by?: string
  tenant_id?: string
}

interface PermissionInfo {
  name: string
  description: string
}

export function RoleManagement() {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<RoleResponse | null>(null)
  const [permissionSearchQuery, setPermissionSearchQuery] = useState('')
  const [createPermissionSearchQuery, setCreatePermissionSearchQuery] = useState('')
  const [selectedTemplateRole, setSelectedTemplateRole] = useState('')
  const [showTemplateRole, setShowTemplateRole] = useState(false)
  const [createFormData, setCreateFormData] = useState({
    name: '',
    description: '',
    permissions: [] as string[],
    permission_templates: [] as string[],
    inherited_roles: [] as string[],
    inheritance_type: 'none' as 'none' | 'hierarchical' | 'conditional'
  })

  // API Queries
  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      return await makeAuthenticatedRequest<RoleResponse[]>('/v1/roles/')
    }
  })

  const { data: permissionTemplates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['permission-templates'],
    queryFn: async () => {
      return await makeAuthenticatedRequest<PermissionTemplateResponse[]>('/v1/roles/templates/')
    }
  })

  const { data: availablePermissions = [], isLoading: permissionsLoading } = useQuery({
    queryKey: ['available-permissions'],
    queryFn: async () => {
      return await makeAuthenticatedRequest<PermissionInfo[]>('/v1/roles/available-permissions/')
    }
  })

  // API Mutations
  const createRoleMutation = useMutation({
    mutationFn: async (roleData: typeof createFormData) => {
      return await makeAuthenticatedRequest<RoleResponse>('/v1/roles/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roleData)
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      setIsCreateDialogOpen(false)
      setCreateFormData({
        name: '',
        description: '',
        permissions: [],
        permission_templates: [],
        inherited_roles: [],
        inheritance_type: 'none' as 'none' | 'hierarchical' | 'conditional'
      })
      console.log('Role created successfully')
    },
    onError: (error) => {
      console.error(`Failed to create role: ${error.message}`)
    }
  })

  const updateRoleMutation = useMutation({
    mutationFn: async ({ roleName, roleData }: { roleName: string; roleData: Partial<RoleResponse> }) => {
      return await makeAuthenticatedRequest<RoleResponse>(`/v1/roles/${roleName}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roleData)
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      setIsEditDialogOpen(false)
      setEditingRole(null)
      console.log('Role updated successfully')
    },
    onError: (error) => {
      console.error(`Failed to update role: ${error.message}`)
    }
  })

  const deleteRoleMutation = useMutation({
    mutationFn: async (roleName: string) => {
      return await makeAuthenticatedRequest<any>(`/v1/roles/${roleName}`, {
        method: 'DELETE'
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      console.log('Role deleted successfully')
    },
    onError: (error) => {
      console.error(`Failed to delete role: ${error.message}`)
    }
  })

  const applyTemplateMutation = useMutation({
    mutationFn: async ({ templateId, roleName }: { templateId: string; roleName: string }) => {
      return await makeAuthenticatedRequest<any>(`/v1/roles/${roleName}/templates/${templateId}`, {
        method: 'POST'
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      console.log('Template applied successfully')
    },
    onError: (error) => {
      console.error(`Failed to apply template: ${error.message}`)
    }
  })

  // Filter roles based on search query
  const filteredRoles = roles.filter(role =>
    role.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    role.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Handle template role selection and copying
  const handleTemplateRoleChange = (roleName: string) => {
    setSelectedTemplateRole(roleName)

    if (roleName) {
      const templateRole = roles.find(role => role.name === roleName)
      if (templateRole) {
        setCreateFormData(prev => ({
          ...prev,
          permissions: [...templateRole.permissions],
          inheritance_type: templateRole.inheritance_type || 'none',
          inherited_roles: templateRole.inherited_roles || []
        }))
      }
    } else {
      // Reset to empty if no role selected
      setCreateFormData(prev => ({
        ...prev,
        permissions: [],
        inheritance_type: 'none',
        inherited_roles: []
      }))
    }
  }

  // Handle create role form submission
  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createRoleMutation.mutateAsync(createFormData)
      setCreateFormData({
        name: '',
        description: '',
        permissions: [],
        permission_templates: [],
        inherited_roles: [],
        inheritance_type: 'none' as 'none' | 'hierarchical' | 'conditional'
      })
      setSelectedTemplateRole('')
      setShowTemplateRole(false)
      setIsCreateDialogOpen(false)
    } catch (error) {
      console.error('Error creating role:', error)
    }
  }

  // Handle edit role
  const handleEditRole = (role: RoleResponse) => {
    setEditingRole(role)
    setIsEditDialogOpen(true)
  }

  // Handle update role form submission
  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingRole) return

    updateRoleMutation.mutate({
      roleName: editingRole.name,
      roleData: {
        description: editingRole.description,
        permissions: editingRole.permissions,
        permission_templates: editingRole.permission_templates,
        inherited_roles: editingRole.inherited_roles,
        inheritance_type: editingRole.inheritance_type,
        is_active: editingRole.is_active
      }
    })
  }

  // Handle delete role
  const handleDeleteRole = async (roleName: string) => {
    if (window.confirm('Are you sure you want to delete this role?')) {
      deleteRoleMutation.mutate(roleName)
    }
  }

  // Handle apply template to role
  const handleApplyTemplate = async (templateId: string, roleName: string) => {
    applyTemplateMutation.mutate({ templateId, roleName })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-end">
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Role
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Role</DialogTitle>
              <DialogDescription>
                Define a new role with specific permissions and inheritance settings
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateRole} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Role Name</Label>
                <Input
                  id="name"
                  value={createFormData.name}
                  onChange={(e) => setCreateFormData({...createFormData, name: e.target.value})}
                  placeholder="e.g., project_admin, content_manager"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={createFormData.description}
                  onChange={(e) => setCreateFormData({...createFormData, description: e.target.value})}
                  placeholder="Describe the purpose and responsibilities of this role"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Copy from Existing Role</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTemplateRole(!showTemplateRole)}
                  >
                    <Copy className="h-3 w-3 mr-2" />
                    {showTemplateRole ? 'Hide' : 'Show'} Templates
                  </Button>
                </div>
                {showTemplateRole && (
                  <div className="space-y-2">
                    <Select value={selectedTemplateRole} onValueChange={handleTemplateRoleChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role to copy permissions from" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.filter(role => role.is_active).map((role) => (
                          <SelectItem key={role.name} value={role.name}>
                            <div className="flex items-center gap-2">
                              <Shield className="h-3 w-3" />
                              {role.name}
                              <Badge variant="outline" className="text-xs">
                                {role.permissions.length} permissions
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedTemplateRole && (
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                          Selected: {selectedTemplateRole} • Permissions copied successfully
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedTemplateRole('')
                            setCreateFormData(prev => ({
                              ...prev,
                              permissions: [],
                              inheritance_type: 'none',
                              inherited_roles: []
                            }))
                          }}
                        >
                          <X className="h-3 w-3 mr-2" />
                          Clear
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Label>Permissions ({createFormData.permissions.length}/{availablePermissions.length} selected)</Label>
                    {selectedTemplateRole && (
                      <Badge variant="secondary" className="text-xs">
                        <Copy className="h-3 w-3 mr-1" />
                        Copied from {selectedTemplateRole}
                      </Badge>
                    )}
                  </div>
                  <Input
                    placeholder="Search permissions..."
                    value={createPermissionSearchQuery}
                    onChange={(e) => setCreatePermissionSearchQuery(e.target.value)}
                    className="max-w-xs"
                  />
                </div>
                <div className="border rounded-lg p-3 max-h-96 overflow-y-auto">
                  {availablePermissions && availablePermissions.length > 0 ? (
                    <div className="space-y-2">
                      {availablePermissions
                        .filter(permission =>
                          permission.name.toLowerCase().includes(createPermissionSearchQuery.toLowerCase()) ||
                          permission.description.toLowerCase().includes(createPermissionSearchQuery.toLowerCase())
                        )
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((permission) => (
                          <div key={permission.name} className="flex items-start space-x-3 p-3 hover:bg-muted/50 rounded">
                            <Checkbox
                              checked={createFormData.permissions.includes(permission.name)}
                              onCheckedChange={(checked) => {
                                const currentPermissions = createFormData.permissions;
                                const updatedPermissions = checked
                                  ? [...currentPermissions, permission.name]
                                  : currentPermissions.filter(p => p !== permission.name);
                                setCreateFormData({...createFormData, permissions: updatedPermissions});
                              }}
                            />
                            <div className="flex-1">
                              <div className="font-medium">{permission.name}</div>
                              <div className="text-sm text-muted-foreground">{permission.description}</div>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No available permissions</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Inheritance Type</Label>
                <Select value={createFormData.inheritance_type} onValueChange={(value) => setCreateFormData({...createFormData, inheritance_type: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Inheritance</SelectItem>
                    <SelectItem value="hierarchical">Hierarchical Inheritance</SelectItem>
                    <SelectItem value="conditional">Conditional Inheritance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Role</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search Roles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Input
              placeholder="Search roles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
            <Badge variant="outline" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              {filteredRoles.length} roles
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Roles Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredRoles.map((role) => (
          <Card key={role.name} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    {role.name}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {role.description || 'No description provided'}
                  </CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => handleEditRole(role)}
                      disabled={role.is_system}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Role
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      const templateId = prompt('Enter template ID to apply:')
                      if (templateId) handleApplyTemplate(templateId, role.name)
                    }}>
                      <Copy className="h-4 w-4 mr-2" />
                      Apply Template
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDeleteRole(role.name)}
                      className="text-red-600"
                      disabled={role.is_system}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Role
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex flex-wrap gap-1 mt-2">
                <Badge variant={role.is_active ? "default" : "secondary"}>
                  {role.is_active ? "Active" : "Inactive"}
                </Badge>
                {role.inheritance_type !== "none" && (
                  <Badge variant="outline">
                    <GitBranch className="h-3 w-3 mr-1" />
                    {role.inheritance_type}
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent>
              <div className="space-y-3">
                {/* Permissions */}
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium mb-1">
                    <Key className="h-4 w-4" />
                    Permissions ({role.permissions.length})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {role.permissions.slice(0, 3).map((permission, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {permission}
                      </Badge>
                    ))}
                    {role.permissions.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{role.permissions.length - 3} more
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Inheritance */}
                {role.inherited_roles && role.inherited_roles.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium mb-1">
                      <GitBranch className="h-4 w-4" />
                      Inheritance
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Inherits from: {role.inherited_roles.join(', ')}
                    </div>
                  </div>
                )}

                {/* Meta Info */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatRelativeTime(role.created_at)}
                  </div>
                  <div>
                    {role.permission_templates && role.permission_templates.length > 0
                      ? `${role.permission_templates.length} template${role.permission_templates.length !== 1 ? 's' : ''}`
                      : '0 templates'
                    }
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Role Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Role: {editingRole?.name}</DialogTitle>
            <DialogDescription>
              Update role settings and permissions
            </DialogDescription>
          </DialogHeader>
          {editingRole && (
            <form onSubmit={handleUpdateRole} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={editingRole.description || ''}
                  onChange={(e) => setEditingRole({...editingRole, description: e.target.value})}
                  placeholder="Describe the purpose and responsibilities of this role"
                />
              </div>

              <Tabs defaultValue="permissions" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="permissions">Permissions</TabsTrigger>
                  <TabsTrigger value="templates">Templates</TabsTrigger>
                  <TabsTrigger value="inheritance">Inheritance</TabsTrigger>
                </TabsList>

                <TabsContent value="permissions" className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label>Permissions ({editingRole.permissions.length}/{availablePermissions.length} selected)</Label>
                      <Input
                        placeholder="Search permissions..."
                        value={permissionSearchQuery}
                        onChange={(e) => setPermissionSearchQuery(e.target.value)}
                        className="max-w-xs"
                      />
                    </div>
                    <div className="border rounded-lg p-3 max-h-96 overflow-y-auto">
                      {availablePermissions && availablePermissions.length > 0 ? (
                        <div className="space-y-2">
                          {availablePermissions
                            .filter(permission =>
                              permission.name.toLowerCase().includes(permissionSearchQuery.toLowerCase()) ||
                              permission.description.toLowerCase().includes(permissionSearchQuery.toLowerCase())
                            )
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((permission) => (
                              <div key={permission.name} className="flex items-start space-x-3 p-3 hover:bg-muted/50 rounded">
                                <Checkbox
                                  checked={editingRole.permissions.includes(permission.name)}
                                  onCheckedChange={(checked) => {
                                    const updatedPermissions = checked
                                      ? [...editingRole.permissions, permission.name]
                                      : editingRole.permissions.filter(p => p !== permission.name);
                                    setEditingRole({...editingRole, permissions: updatedPermissions});
                                  }}
                                />
                                <div className="flex-1">
                                  <div className="font-medium">{permission.name}</div>
                                  <div className="text-sm text-muted-foreground">{permission.description}</div>
                                </div>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No available permissions</p>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="templates" className="space-y-4">
                  <div className="space-y-2">
                    <Label>Applied Templates</Label>
                    <div className="border rounded-lg p-3 max-h-48 overflow-y-auto">
                      {editingRole.permission_templates && editingRole.permission_templates.length > 0 ? (
                        <div className="space-y-2">
                          {editingRole.permission_templates.map((templateId) => (
                            <div key={templateId} className="flex items-center justify-between p-2 border rounded">
                              <div className="font-medium">{templateId}</div>
                              <Button size="sm" variant="outline">Remove</Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No templates applied</p>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="inheritance" className="space-y-4">
                  <div className="space-y-2">
                    <Label>Inherited Roles</Label>
                    <div className="border rounded-lg p-3 max-h-48 overflow-y-auto">
                      {editingRole.inherited_roles && editingRole.inherited_roles.length > 0 ? (
                        <div className="space-y-2">
                          {editingRole.inherited_roles.map((parentRole) => (
                            <div key={parentRole} className="flex items-center justify-between p-2 border rounded">
                              <div className="font-medium">{parentRole}</div>
                              <Button size="sm" variant="outline">Remove</Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No inherited roles</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Inheritance Type</Label>
                    <Select
                      value={editingRole.inheritance_type || 'none'}
                      onValueChange={(value) => setEditingRole({...editingRole, inheritance_type: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Inheritance</SelectItem>
                        <SelectItem value="hierarchical">Hierarchical Inheritance</SelectItem>
                        <SelectItem value="conditional">Conditional Inheritance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>
              </Tabs>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Update Role</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}