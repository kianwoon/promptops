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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDate, formatRelativeTime } from '@/lib/utils'

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
      const response = await fetch('/v1/roles/')
      if (!response.ok) throw new Error('Failed to fetch roles')
      return response.json() as Promise<RoleResponse[]>
    }
  })

  const { data: permissionTemplates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['permission-templates'],
    queryFn: async () => {
      const response = await fetch('/v1/roles/templates/')
      if (!response.ok) throw new Error('Failed to fetch permission templates')
      return response.json() as Promise<PermissionTemplateResponse[]>
    }
  })

  const { data: availablePermissions = [], isLoading: permissionsLoading } = useQuery({
    queryKey: ['available-permissions'],
    queryFn: async () => {
      const response = await fetch('/v1/roles/available-permissions/')
      if (!response.ok) throw new Error('Failed to fetch available permissions')
      return response.json() as Promise<PermissionInfo[]>
    }
  })

  // API Mutations
  const createRoleMutation = useMutation({
    mutationFn: async (roleData: typeof createFormData) => {
      const response = await fetch('/v1/roles/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roleData)
      })
      if (!response.ok) throw new Error('Failed to create role')
      return response.json() as Promise<RoleResponse>
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
      const response = await fetch(`/v1/roles/${roleName}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roleData)
      })
      if (!response.ok) throw new Error('Failed to update role')
      return response.json() as Promise<RoleResponse>
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
      const response = await fetch(`/v1/roles/${roleName}`, {
        method: 'DELETE'
      })
      if (!response.ok) throw new Error('Failed to delete role')
      return response.json()
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
      const response = await fetch(`/v1/roles/${roleName}/templates/${templateId}`, {
        method: 'POST'
      })
      if (!response.ok) throw new Error('Failed to apply template')
      return response.json()
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

  // Handle create role form submission
  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await onCreateRole(createFormData)
      setCreateFormData({
        name: '',
        description: '',
        permissions: [],
        permission_templates: [],
        inherited_roles: [],
        inheritance_type: 'none' as 'none' | 'hierarchical' | 'conditional'
      })
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
                <Label>Permissions</Label>
                <div className="border rounded-lg p-3 max-h-48 overflow-y-auto">
                  {availablePermissions && availablePermissions.length > 0 ? (
                    <div className="space-y-2">
                      {availablePermissions.map((permission) => (
                        <div key={permission.name} className="flex items-center justify-between p-2 border rounded">
                          <div>
                            <div className="font-medium">{permission.name}</div>
                            <div className="text-sm text-muted-foreground">{permission.description}</div>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant={createFormData.permissions.includes(permission.name) ? "default" : "outline"}
                            onClick={() => {
                              const currentPermissions = createFormData.permissions;
                              const updatedPermissions = currentPermissions.includes(permission.name)
                                ? currentPermissions.filter(p => p !== permission.name)
                                : [...currentPermissions, permission.name];
                              setCreateFormData({...createFormData, permissions: updatedPermissions});
                            }}
                          >
                            {createFormData.permissions.includes(permission.name) ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <Plus className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No available permissions</p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {createFormData.permissions.length} permission{createFormData.permissions.length !== 1 ? 's' : ''} selected
                </p>
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
                    <Label>Current Permissions</Label>
                    <div className="border rounded-lg p-3 max-h-48 overflow-y-auto">
                      {editingRole.permissions && editingRole.permissions.length > 0 ? (
                        <div className="space-y-2">
                          {editingRole.permissions.map((permission, index) => (
                            <div key={index} className="flex items-center justify-between p-2 border rounded">
                              <div>
                                <div className="font-medium">{permission}</div>
                                <div className="text-sm text-muted-foreground">System Permission</div>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const updatedPermissions = editingRole.permissions.filter((_, i) => i !== index);
                                  setEditingRole({...editingRole, permissions: updatedPermissions});
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No permissions assigned</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Add Permissions</Label>
                    <div className="border rounded-lg p-3 max-h-48 overflow-y-auto">
                      {availablePermissions && availablePermissions.length > 0 ? (
                        <div className="space-y-2">
                          {availablePermissions
                            .filter(perm => !editingRole.permissions?.includes(perm.name))
                            .map((permission) => (
                              <div key={permission.name} className="flex items-center justify-between p-2 border rounded">
                                <div>
                                  <div className="font-medium">{permission.name}</div>
                                  <div className="text-sm text-muted-foreground">{permission.description}</div>
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    const updatedPermissions = [...(editingRole.permissions || []), permission.name];
                                    setEditingRole({...editingRole, permissions: updatedPermissions});
                                  }}
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
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