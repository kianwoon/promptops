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
  Avatar,
  AvatarContent,
  AvatarFallback
} from '@/components/ui/avatar'
import {
  Users,
  UserPlus,
  Search,
  Shield,
  Calendar,
  Mail,
  Clock,
  Filter,
  Download,
  Upload,
  MoreVertical,
  Edit,
  Trash2,
  Copy,
  GitBranch,
  Key,
  Settings,
  Eye
} from 'lucide-react'
import {
  CustomRole,
  User,
  UserRoleAssignment,
  BulkRoleAssignmentResponse
} from '@/types/governance'
import { formatDate, formatRelativeTime } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface UserRoleAssignmentProps {
  users?: User[]
  roles?: CustomRole[]
  assignments?: UserRoleAssignment[]
  onAssignRole?: (userId: string, roleName: string, resourceType?: string, resourceId?: string, conditions?: any) => Promise<void>
  onRemoveRole?: (userId: string, roleName: string) => Promise<void>
  onBulkAssign?: (userIds: string[], roleNames: string[], resourceType?: string, resourceId?: string, conditions?: any) => Promise<BulkRoleAssignmentResponse>
  onGetUserEffectivePermissions?: (userId: string) => Promise<any>
  onGetUserRoleHistory?: (userId: string) => Promise<any>
}

interface AssignmentFormData {
  userId: string
  roleName: string
  resourceType: string
  resourceId: string
  conditions: string
  expiresAt: string
}

export function UserRoleAssignmentComponent({
  users = [],
  roles = [],
  assignments = [],
  onAssignRole = async () => {},
  onRemoveRole = async () => {},
  onBulkAssign = async () => ({ success: true, message: 'Bulk assignment completed' }),
  onGetUserEffectivePermissions = async () => ({ effective_permissions: [], inheritance_chain: [] }),
  onGetUserRoleHistory = async () => []
}: UserRoleAssignmentProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRole, setSelectedRole] = useState<string>('')
  const [selectedResourceType, setSelectedResourceType] = useState<string>('')
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false)
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false)
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [userHistory, setUserHistory] = useState<any[]>([])
  const [effectivePermissions, setEffectivePermissions] = useState<any>(null)
  const [bulkSelectedUsers, setBulkSelectedUsers] = useState<string[]>([])
  const [bulkSelectedRoles, setBulkSelectedRoles] = useState<string[]>([])
  const [assignmentFormData, setAssignmentFormData] = useState<AssignmentFormData>({
    userId: '',
    roleName: '',
    resourceType: '',
    resourceId: '',
    conditions: '',
    expiresAt: ''
  })

  // Resource types for filtering
  const resourceTypes = [
    'template',
    'project',
    'module',
    'user',
    'role',
    'system',
    'policy',
    'workflow',
    'compliance'
  ]

  // Filter users based on search query
  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Filter assignments based on selected filters
  const filteredAssignments = assignments.filter(assignment => {
    const matchesRole = selectedRole === "all" || !selectedRole || assignment.role_name === selectedRole
    const matchesResourceType = selectedResourceType === "all" || !selectedResourceType || assignment.resource_type === selectedResourceType
    return matchesRole && matchesResourceType
  })

  // Get user roles
  const getUserRoles = (userId: string) => {
    return assignments.filter(a => a.user_id === userId)
  }

  // Get user effective permissions
  const loadUserEffectivePermissions = async (userId: string) => {
    try {
      const permissions = await onGetUserEffectivePermissions(userId)
      setEffectivePermissions(permissions)
    } catch (error) {
      console.error('Error loading effective permissions:', error)
    }
  }

  // Get user role history
  const loadUserRoleHistory = async (userId: string) => {
    try {
      const history = await onGetUserRoleHistory(userId)
      setUserHistory(history)
    } catch (error) {
      console.error('Error loading role history:', error)
    }
  }

  // Handle role assignment
  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await onAssignRole(
        assignmentFormData.userId,
        assignmentFormData.roleName,
        assignmentFormData.resourceType || undefined,
        assignmentFormData.resourceId || undefined,
        assignmentFormData.conditions ? JSON.parse(assignmentFormData.conditions) : undefined
      )
      setAssignmentFormData({
        userId: '',
        roleName: '',
        resourceType: '',
        resourceId: '',
        conditions: '',
        expiresAt: ''
      })
      setIsAssignDialogOpen(false)
    } catch (error) {
      console.error('Error assigning role:', error)
    }
  }

  // Handle role removal
  const handleRemoveRole = async (userId: string, roleName: string) => {
    if (window.confirm('Are you sure you want to remove this role assignment?')) {
      try {
        await onRemoveRole(userId, roleName)
      } catch (error) {
        console.error('Error removing role:', error)
      }
    }
  }

  // Handle bulk assignment
  const handleBulkAssign = async () => {
    if (bulkSelectedUsers.length === 0 || bulkSelectedRoles.length === 0) return

    try {
      await onBulkAssign(bulkSelectedUsers, bulkSelectedRoles)
      setBulkSelectedUsers([])
      setBulkSelectedRoles([])
      setIsBulkDialogOpen(false)
    } catch (error) {
      console.error('Error in bulk assignment:', error)
    }
  }

  // View user details
  const handleViewUserDetails = (user: User) => {
    setSelectedUser(user)
    loadUserEffectivePermissions(user.id)
    loadUserRoleHistory(user.id)
  }

  // Toggle user selection for bulk operations
  const toggleUserSelection = (userId: string) => {
    setBulkSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  // Toggle role selection for bulk operations
  const toggleRoleSelection = (roleName: string) => {
    setBulkSelectedRoles(prev =>
      prev.includes(roleName)
        ? prev.filter(name => name !== roleName)
        : [...prev, roleName]
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          {/* Header removed - already shown in parent tab */}
        </div>
        <div className="flex gap-2">
          <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Users className="h-4 w-4 mr-2" />
                Bulk Assign
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Bulk Role Assignment</DialogTitle>
                <DialogDescription>
                  Assign roles to multiple users at once
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Users ({bulkSelectedUsers.length})</Label>
                  <div className="border rounded-lg p-3 max-h-32 overflow-y-auto">
                    {filteredUsers.map((user) => (
                      <div key={user.id} className="flex items-center gap-2 p-2 hover:bg-muted rounded">
                        <input
                          type="checkbox"
                          checked={bulkSelectedUsers.includes(user.id)}
                          onChange={() => toggleUserSelection(user.id)}
                          className="rounded"
                        />
                        <Avatar className="h-6 w-6">
                          <AvatarFallback>{user.email[0].toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="font-medium text-sm">{user.name || user.email}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Select Roles ({bulkSelectedRoles.length})</Label>
                  <div className="border rounded-lg p-3 max-h-32 overflow-y-auto">
                    {roles.map((role) => (
                      <div key={role.name} className="flex items-center gap-2 p-2 hover:bg-muted rounded">
                        <input
                          type="checkbox"
                          checked={bulkSelectedRoles.includes(role.name)}
                          onChange={() => toggleRoleSelection(role.name)}
                          className="rounded"
                        />
                        <Shield className="h-4 w-4" />
                        <div className="flex-1">
                          <div className="font-medium text-sm">{role.name}</div>
                          <div className="text-xs text-muted-foreground">{role.description}</div>
                        </div>
                        <Badge variant={role.is_active ? "default" : "secondary"}>
                          {role.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsBulkDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleBulkAssign}>
                  Assign to {bulkSelectedUsers.length} users
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Assign Role
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Assign Role to User</DialogTitle>
                <DialogDescription>
                  Assign a role to a specific user with optional conditions
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAssignRole} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="user">User</Label>
                  <Select
                    value={assignmentFormData.userId}
                    onValueChange={(value) => setAssignmentFormData({...assignmentFormData, userId: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a user" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback>{user.email[0].toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div>
                              <div>{user.name || user.email}</div>
                              <div className="text-xs text-muted-foreground">{user.email}</div>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={assignmentFormData.roleName}
                    onValueChange={(value) => setAssignmentFormData({...assignmentFormData, roleName: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.filter(r => r.is_active).map((role) => (
                        <SelectItem key={role.name} value={role.name}>
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            {role.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Tabs defaultValue="basic" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="basic">Basic</TabsTrigger>
                    <TabsTrigger value="advanced">Advanced</TabsTrigger>
                  </TabsList>

                  <TabsContent value="basic" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="resourceType">Resource Type (Optional)</Label>
                      <Select
                        value={assignmentFormData.resourceType}
                        onValueChange={(value) => setAssignmentFormData({...assignmentFormData, resourceType: value})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select resource type" />
                        </SelectTrigger>
                        <SelectContent>
                          {resourceTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="resourceId">Resource ID (Optional)</Label>
                      <Input
                        id="resourceId"
                        value={assignmentFormData.resourceId}
                        onChange={(e) => setAssignmentFormData({...assignmentFormData, resourceId: e.target.value})}
                        placeholder="Specific resource identifier"
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="advanced" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="conditions">Conditions (JSON)</Label>
                      <Textarea
                        id="conditions"
                        value={assignmentFormData.conditions}
                        onChange={(e) => setAssignmentFormData({...assignmentFormData, conditions: e.target.value})}
                        placeholder='{"time": "business_hours", "location": "office"}'
                        className="font-mono text-xs"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="expiresAt">Expires At</Label>
                      <Input
                        id="expiresAt"
                        type="datetime-local"
                        value={assignmentFormData.expiresAt}
                        onChange={(e) => setAssignmentFormData({...assignmentFormData, expiresAt: e.target.value})}
                      />
                    </div>
                  </TabsContent>
                </Tabs>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Assign Role</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Search Users</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Filter by Role</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder="All roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  {roles.map((role) => (
                    <SelectItem key={role.name} value={role.name}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Filter by Resource Type</Label>
              <Select value={selectedResourceType} onValueChange={setSelectedResourceType}>
                <SelectTrigger>
                  <SelectValue placeholder="All resources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All resources</SelectItem>
                  {resourceTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assignments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Role Assignments</CardTitle>
          <CardDescription>
            View and manage user role assignments ({filteredAssignments.length} total)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Conditions</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssignments.map((assignment) => {
                  const user = users.find(u => u.id === assignment.user_id)
                  const role = roles.find(r => r.name === assignment.role_name)

                  return (
                    <TableRow key={`${assignment.user_id}-${assignment.role_name}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>{user?.email[0].toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{user?.name || user?.email}</div>
                            <div className="text-sm text-muted-foreground">{user?.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          <div>
                            <div className="font-medium">{assignment.role_name}</div>
                            <Badge variant={role?.is_active ? "default" : "secondary"} className="text-xs">
                              {role?.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {assignment.resource_type ? (
                          <div>
                            <div className="font-medium">{assignment.resource_type}</div>
                            {assignment.resource_id && (
                              <div className="text-sm text-muted-foreground">{assignment.resource_id}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Global</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {assignment.conditions ? (
                          <div className="text-xs">
                            <pre className="bg-muted p-1 rounded text-xs overflow-hidden max-w-32">
                              {JSON.stringify(assignment.conditions, null, 2)}
                            </pre>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">None</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatRelativeTime(assignment.created_at)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => user && handleViewUserDetails(user)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveRole(assignment.user_id, assignment.role_name)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* User Details Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>User Details: {selectedUser?.name || selectedUser?.email}</DialogTitle>
            <DialogDescription>
              View user roles, permissions, and assignment history
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              {/* User Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>{selectedUser.email[0].toUpperCase()}</AvatarFallback>
                    </Avatar>
                    {selectedUser.name || selectedUser.email}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      {selectedUser.email}
                    </div>
                    {selectedUser.created_at && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Created: {formatDate(selectedUser.created_at)}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Tabs defaultValue="roles" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="roles">Current Roles</TabsTrigger>
                  <TabsTrigger value="permissions">Effective Permissions</TabsTrigger>
                  <TabsTrigger value="history">Assignment History</TabsTrigger>
                </TabsList>

                <TabsContent value="roles" className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="font-medium">Assigned Roles ({getUserRoles(selectedUser.id).length})</h4>
                    <div className="space-y-2">
                      {getUserRoles(selectedUser.id).map((assignment) => {
                        const role = roles.find(r => r.name === assignment.role_name)
                        return (
                          <div key={assignment.role_name} className="flex items-center justify-between p-3 border rounded">
                            <div className="flex items-center gap-2">
                              <Shield className="h-4 w-4" />
                              <div>
                                <div className="font-medium">{assignment.role_name}</div>
                                <div className="text-sm text-muted-foreground">{role?.description}</div>
                                {assignment.resource_type && (
                                  <div className="text-xs text-muted-foreground">
                                    Resource: {assignment.resource_type}
                                    {assignment.resource_id && ` (${assignment.resource_id})`}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={role?.is_active ? "default" : "secondary"}>
                                {role?.is_active ? "Active" : "Inactive"}
                              </Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleRemoveRole(assignment.user_id, assignment.role_name)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="permissions" className="space-y-4">
                  {effectivePermissions ? (
                    <div className="space-y-2">
                      <h4 className="font-medium">Effective Permissions</h4>
                      <div className="grid gap-2">
                        {effectivePermissions.effective_permissions.map((permission: string, index: number) => (
                          <div key={index} className="flex items-center gap-2 p-2 border rounded">
                            <Key className="h-4 w-4" />
                            <span className="font-mono text-sm">{permission}</span>
                          </div>
                        ))}
                      </div>
                      {effectivePermissions.inheritance_chain.length > 0 && (
                        <div className="space-y-2">
                          <h5 className="font-medium">Inheritance Chain</h5>
                          <div className="flex flex-wrap gap-1">
                            {effectivePermissions.inheritance_chain.map((role: string, index: number) => (
                              <Badge key={role} variant="outline">
                                <GitBranch className="h-3 w-3 mr-1" />
                                {role}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Loading effective permissions...</p>
                  )}
                </TabsContent>

                <TabsContent value="history" className="space-y-4">
                  {userHistory.length > 0 ? (
                    <div className="space-y-2">
                      <h4 className="font-medium">Assignment History</h4>
                      <div className="space-y-2">
                        {userHistory.map((history, index) => (
                          <div key={index} className="flex items-center justify-between p-3 border rounded">
                            <div>
                              <div className="font-medium">{history.action}</div>
                              <div className="text-sm text-muted-foreground">
                                {history.role_name} • {formatRelativeTime(history.timestamp)}
                              </div>
                              {history.details && (
                                <div className="text-xs text-muted-foreground">
                                  {history.details}
                                </div>
                              )}
                            </div>
                            <Badge variant={history.result === 'success' ? 'default' : 'destructive'}>
                              {history.result}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No assignment history available</p>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}