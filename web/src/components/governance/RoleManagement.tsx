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
  Clock
} from 'lucide-react'
import {
  CustomRole,
  CustomRoleCreate,
  CustomRoleUpdate,
  PermissionTemplate,
  Permission,
  RolePermission,
  RoleInheritance
} from '@/types/governance'
import { formatDate, formatRelativeTime } from '@/lib/utils'

interface RoleManagementProps {
  roles: CustomRole[]
  permissionTemplates: PermissionTemplate[]
  permissions: Permission[]
  rolePermissions: RolePermission[]
  inheritances: RoleInheritance[]
  onCreateRole: (role: CustomRoleCreate) => Promise<CustomRole>
  onUpdateRole: (roleName: string, role: CustomRoleUpdate) => Promise<CustomRole>
  onDeleteRole: (roleName: string) => Promise<void>
  onApplyTemplate: (templateId: string, roleName: string) => Promise<void>
  onCreateInheritance: (parentRole: string, childRole: string, inheritanceType: string) => Promise<void>
  onDeleteInheritance: (parentRole: string, childRole: string) => Promise<void>
}

export function RoleManagement({
  roles = [],
  permissionTemplates = [],
  permissions = [],
  rolePermissions = [],
  inheritances = [],
  onCreateRole = async () => {},
  onUpdateRole = async () => {},
  onDeleteRole = async () => {},
  onApplyTemplate = async () => {},
  onCreateInheritance = async () => {},
  onDeleteInheritance = async () => {}
}: RoleManagementProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null)
  const [createFormData, setCreateFormData] = useState<CustomRoleCreate>({
    name: '',
    description: '',
    permissions: [],
    permission_templates: [],
    inherited_roles: [],
    inheritance_type: 'none'
  })

  // Filter roles based on search query
  const filteredRoles = roles.filter(role =>
    role.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    role.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Get role permissions
  const getRolePermissions = (roleName: string) => {
    return rolePermissions.filter(rp => rp.role_name === roleName)
  }

  // Get inherited roles
  const getInheritedRoles = (roleName: string) => {
    return inheritances.filter(i => i.child_role === roleName)
  }

  // Get child roles
  const getChildRoles = (roleName: string) => {
    return inheritances.filter(i => i.parent_role === roleName)
  }

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
        inheritance_type: 'none'
      })
      setIsCreateDialogOpen(false)
    } catch (error) {
      console.error('Error creating role:', error)
    }
  }

  // Handle edit role
  const handleEditRole = (role: CustomRole) => {
    setEditingRole(role)
    setIsEditDialogOpen(true)
  }

  // Handle update role form submission
  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingRole) return

    try {
      await onUpdateRole(editingRole.name, {
        description: editingRole.description,
        permissions: editingRole.permissions,
        permission_templates: editingRole.permission_templates,
        inherited_roles: editingRole.inherited_roles,
        inheritance_type: editingRole.inheritance_type,
        is_active: editingRole.is_active
      })
      setIsEditDialogOpen(false)
      setEditingRole(null)
    } catch (error) {
      console.error('Error updating role:', error)
    }
  }

  // Handle delete role
  const handleDeleteRole = async (roleName: string) => {
    if (window.confirm('Are you sure you want to delete this role?')) {
      try {
        await onDeleteRole(roleName)
      } catch (error) {
        console.error('Error deleting role:', error)
      }
    }
  }

  // Handle apply template to role
  const handleApplyTemplate = async (templateId: string, roleName: string) => {
    try {
      await onApplyTemplate(templateId, roleName)
    } catch (error) {
      console.error('Error applying template:', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Role Management</h2>
          <p className="text-muted-foreground">
            Create and manage custom roles with granular permissions
          </p>
        </div>
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
                <Label>Inheritance Type</Label>
                <Select value={createFormData.inheritance_type} onValueChange={(value) => setCreateFormData({...createFormData, inheritance_type: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Inheritance</SelectItem>
                    <SelectItem value="direct">Direct Inheritance</SelectItem>
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
                    <DropdownMenuItem onClick={() => handleEditRole(role)}>
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
                    Permissions ({getRolePermissions(role.name).length})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {getRolePermissions(role.name).slice(0, 3).map((permission) => (
                      <Badge key={permission.id} variant="secondary" className="text-xs">
                        {permission.action}
                      </Badge>
                    ))}
                    {getRolePermissions(role.name).length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{getRolePermissions(role.name).length - 3} more
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Inheritance */}
                {(role.inherited_roles.length > 0 || getInheritedRoles(role.name).length > 0) && (
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium mb-1">
                      <GitBranch className="h-4 w-4" />
                      Inheritance
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      {role.inherited_roles.length > 0 && (
                        <div>Inherits from: {role.inherited_roles.join(', ')}</div>
                      )}
                      {getInheritedRoles(role.name).length > 0 && (
                        <div>Inherited by: {getInheritedRoles(role.name).map(i => i.parent_role).join(', ')}</div>
                      )}
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
                    {role.permission_templates.length} template{role.permission_templates.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Role Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
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
                      {getRolePermissions(editingRole.name).length > 0 ? (
                        <div className="space-y-2">
                          {getRolePermissions(editingRole.name).map((permission) => (
                            <div key={permission.id} className="flex items-center justify-between p-2 border rounded">
                              <div>
                                <div className="font-medium">{permission.action}</div>
                                <div className="text-sm text-muted-foreground">{permission.resource_type}</div>
                              </div>
                              <Badge variant={permission.is_active ? "default" : "secondary"}>
                                {permission.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No permissions assigned</p>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="templates" className="space-y-4">
                  <div className="space-y-2">
                    <Label>Applied Templates</Label>
                    <div className="border rounded-lg p-3 max-h-48 overflow-y-auto">
                      {editingRole.permission_templates.length > 0 ? (
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
                      {editingRole.inherited_roles.length > 0 ? (
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
                      value={editingRole.inheritance_type}
                      onValueChange={(value) => setEditingRole({...editingRole, inheritance_type: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Inheritance</SelectItem>
                        <SelectItem value="direct">Direct Inheritance</SelectItem>
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