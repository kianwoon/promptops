import React, { useState } from 'react'
import {
  Users,
  Search,
  UserPlus,
  Mail,
  Building,
  Shield,
  Calendar,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  Ban,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuth } from '@/contexts/AuthContext'
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser } from '@/hooks/api'
import { getDevelopmentUser } from '@/lib/devConfig'
import { formatDate } from '@/lib/utils'
import { UserForm } from '@/components/users/UserForm'
import { UserDeleteDialog } from '@/components/users/UserDeleteDialog'
import { UserDetailsModal } from '@/components/users/UserDetailsModal'
import { UserCreate, UserUpdate } from '@/types/api'

interface UserData {
  id: string
  name: string
  email: string
  role: 'admin' | 'user' | 'viewer' | 'editor' | 'approver'
  organization: string
  status: 'active' | 'inactive' | 'pending'
  lastLogin: string | null
  createdAt: string
  avatar?: string
  is_active?: boolean
  phone?: string
  companySize?: string
}

export function UserManagement() {
  // Development fallback - if auth context has issues, provide a default user
  let currentUser = null
  let hasPermission = (permission: string) => false
  let isAuthenticated = false
  let isLoading = false

  try {
    const auth = useAuth()
    currentUser = auth.user
    hasPermission = auth.hasPermission
    isAuthenticated = auth.isAuthenticated
    isLoading = auth.isLoading
  } catch (error) {
    console.warn('Auth context not available, using development mode')
    // In development, create a mock admin user from config
    if (import.meta.env.DEV) {
      const devUser = getDevelopmentUser()
      if (devUser) {
        currentUser = devUser
        isAuthenticated = true
        hasPermission = (permission: string) => true // Admin has all permissions
      }
    }
  }

  // Fetch real users from API
  const { data: users, isLoading: usersLoading } = useUsers()

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'pending'>('all')
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user' | 'viewer' | 'editor' | 'approver'>('all')
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])

  // Form states
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false)
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isViewDetailsModalOpen, setIsViewDetailsModalOpen] = useState(false)
  const [selectedUserForAction, setSelectedUserForAction] = useState<UserData | null>(null)

  // API mutations
  const createUserMutation = useCreateUser()
  const updateUserMutation = useUpdateUser()
  const deleteUserMutation = useDeleteUser()

  // Transform API users to match UserData interface
  const apiUsers: UserData[] = users?.map(user => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    organization: user.organization || 'No Organization',
    status: user.is_active !== false ? 'active' : 'inactive',
    lastLogin: user.last_login || null,
    createdAt: user.createdAt || new Date().toISOString(),
    avatar: user.avatar,
    is_active: user.is_active !== false,
    phone: user.phone,
    companySize: user.company_size
  })) || []

  const filteredUsers = apiUsers.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.organization.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter
    const matchesRole = roleFilter === 'all' || user.role === roleFilter
    
    return matchesSearch && matchesStatus && matchesRole
  })

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive'
      case 'user': return 'default'
      case 'viewer': return 'secondary'
      default: return 'outline'
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active': return 'default'
      case 'inactive': return 'secondary'
      case 'pending': return 'outline'
      default: return 'outline'
    }
  }

  const handleUserAction = (action: string, userId: string) => {
    const user = apiUsers.find(u => u.id === userId)
    if (!user) return

    setSelectedUserForAction(user)

    switch (action) {
      case 'edit':
        setIsEditUserModalOpen(true)
        break
      case 'delete':
        setIsDeleteDialogOpen(true)
        break
      case 'activate':
      case 'deactivate':
        updateUserMutation.mutate({
          userId,
          userData: {
            is_active: action === 'activate'
          } as UserUpdate
        })
        break
      case 'view':
        setIsViewDetailsModalOpen(true)
        break
      default:
        console.log(`Unknown action: ${action} on user ${userId}`)
    }
  }

  const handleBulkAction = (action: string) => {
    console.log(`${action} users:`, selectedUsers)
    // Implement bulk actions
  }

  const handleCreateUser = (userData: UserCreate) => {
    createUserMutation.mutate(userData)
  }

  const handleUpdateUser = (userData: UserUpdate) => {
    if (selectedUserForAction) {
      updateUserMutation.mutate({
        userId: selectedUserForAction.id,
        userData
      })
    }
  }

  const handleDeleteUser = () => {
    if (selectedUserForAction) {
      deleteUserMutation.mutate(selectedUserForAction.id)
      setIsDeleteDialogOpen(false)
      setSelectedUserForAction(null)
    }
  }

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const toggleAllUsers = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([])
    } else {
      setSelectedUsers(filteredUsers.map(user => user.id))
    }
  }

  // Handle loading state
  if (isLoading || usersLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  // Check if user is authenticated and has required permissions
  const isAdmin = currentUser?.role === 'admin'
  const canViewUsers = hasPermission('users:read') || isAdmin

  // If not authenticated, show loading or redirect
  if (!isAuthenticated || !currentUser) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Authenticating...</h3>
          <p className="text-gray-600">Please wait while we verify your session.</p>
        </div>
      </div>
    )
  }

  if (!canViewUsers) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Access Denied</h3>
          <p className="text-gray-600">You don't have permission to view user management.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
            <p className="text-muted-foreground">
              Manage users, roles, and permissions for your organization
            </p>
          </div>

          {hasPermission('users:create') && (
            <Button onClick={() => setIsAddUserModalOpen(true)}>
              <UserPlus className="w-4 h-4 mr-2" />
              Add User
            </Button>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border-2 hover:border-primary/20 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/60"></div>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-primary/10">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                  <p className="text-2xl font-bold">{apiUsers.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border-2 hover:border-primary/20 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/60"></div>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-primary/10">
                  <CheckCircle className="h-6 w-6 text-primary" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Active Users</p>
                  <p className="text-2xl font-bold">
                    {apiUsers.filter(u => u.status === 'active').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border-2 hover:border-primary/20 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/60"></div>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-primary/10">
                  <XCircle className="h-6 w-6 text-primary" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Inactive Users</p>
                  <p className="text-2xl font-bold">
                    {apiUsers.filter(u => u.status === 'inactive').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border-2 hover:border-primary/20 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/60"></div>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-primary/10">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Admin Users</p>
                  <p className="text-2xl font-bold">
                    {apiUsers.filter(u => u.role === 'admin').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Users</span>
              {selectedUsers.length > 0 && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">
                    {selectedUsers.length} selected
                  </span>
                  {hasPermission('users:update') && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBulkAction('activate')}
                      >
                        Activate
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBulkAction('deactivate')}
                      >
                        Deactivate
                      </Button>
                      {hasPermission('users:delete') && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleBulkAction('delete')}
                        >
                          Delete
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search users by name, email, or organization..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                <select
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="pending">Pending</option>
                </select>

                <select
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as any)}
                >
                  <option value="all">All Roles</option>
                  <option value="admin">Admin</option>
                  <option value="user">User</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4">
                      <input
                        type="checkbox"
                        checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                        onChange={toggleAllUsers}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="text-left py-3 px-4">User</th>
                    <th className="text-left py-3 px-4">Role</th>
                    <th className="text-left py-3 px-4">Organization</th>
                    <th className="text-left py-3 px-4">Status</th>
                    <th className="text-left py-3 px-4">Last Login</th>
                    <th className="text-left py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user.id)}
                          onChange={() => toggleUserSelection(user.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center">
                          <Avatar className="h-8 w-8 mr-3">
                            <AvatarImage src={user.avatar} />
                            <AvatarFallback>
                              {user.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-gray-900">{user.name}</div>
                            <div className="text-sm text-gray-600">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={getRoleBadgeColor(user.role)}>
                          {user.role}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center text-sm text-gray-900">
                          <Building className="w-4 h-4 mr-1" />
                          {user.organization}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={getStatusBadgeColor(user.status)}>
                          {user.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-gray-600">
                          {user.lastLogin ? formatDate(user.lastLogin) : 'Never'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleUserAction('view', user.id)}>
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>

                            {hasPermission('users:update') && (
                              <>
                                <DropdownMenuItem onClick={() => handleUserAction('edit', user.id)}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  Edit User
                                </DropdownMenuItem>

                                {user.is_active !== false ? (
                                  <DropdownMenuItem onClick={() => handleUserAction('deactivate', user.id)}>
                                    <Ban className="w-4 h-4 mr-2" />
                                    Deactivate
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onClick={() => handleUserAction('activate', user.id)}>
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Activate
                                  </DropdownMenuItem>
                                )}
                              </>
                            )}

                            {hasPermission('users:delete') && user.id !== currentUser?.id && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleUserAction('delete', user.id)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete User
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredUsers.length === 0 && (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No users found</h3>
                  <p className="text-gray-600">Try adjusting your search or filters.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add User Modal */}
      <UserForm
        isOpen={isAddUserModalOpen}
        onClose={() => setIsAddUserModalOpen(false)}
        onSubmit={handleCreateUser}
        title="Add New User"
        description="Create a new user account with appropriate permissions and roles."
        submitText="Create User"
      />

      {/* Edit User Modal */}
      {selectedUserForAction && (
        <UserForm
          isOpen={isEditUserModalOpen}
          onClose={() => {
            setIsEditUserModalOpen(false)
            setSelectedUserForAction(null)
          }}
          onSubmit={handleUpdateUser}
          user={selectedUserForAction}
          title="Edit User"
          description="Update user information, roles, and permissions."
          submitText="Update User"
        />
      )}

      {/* Delete User Dialog */}
      {selectedUserForAction && (
        <UserDeleteDialog
          isOpen={isDeleteDialogOpen}
          onClose={() => {
            setIsDeleteDialogOpen(false)
            setSelectedUserForAction(null)
          }}
          onConfirm={handleDeleteUser}
          userName={selectedUserForAction.name}
          isDeleting={deleteUserMutation.isPending}
        />
      )}

      {/* View User Details Modal */}
      {selectedUserForAction && (
        <UserDetailsModal
          isOpen={isViewDetailsModalOpen}
          onClose={() => {
            setIsViewDetailsModalOpen(false)
            setSelectedUserForAction(null)
          }}
          user={selectedUserForAction}
        />
      )}
    </>
  )
}