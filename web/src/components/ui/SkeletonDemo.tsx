import React, { useState } from 'react'
import { Button } from './button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card'
import {
  RoleCardSkeleton,
  PermissionListSkeleton,
  TableSkeleton,
  RoleManagementSkeleton
} from './skeleton-loading'

export function SkeletonDemo() {
  const [showLoading, setShowLoading] = useState(false)

  const toggleLoading = () => {
    setShowLoading(!showLoading)
  }

  return (
    <div className="space-y-8 p-6">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Skeleton Loading Components Demo</CardTitle>
            <CardDescription>
              This page demonstrates all the skeleton loading components created for the role management system.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={toggleLoading}>
              {showLoading ? 'Show Loaded State' : 'Show Loading State'}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        {/* Role Card Skeleton */}
        <Card>
          <CardHeader>
            <CardTitle>Role Card Skeleton</CardTitle>
            <CardDescription>
              Loading state for individual role cards in the role management grid.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {showLoading ? (
                <>
                  <RoleCardSkeleton />
                  <RoleCardSkeleton />
                  <RoleCardSkeleton showActions={false} />
                </>
              ) : (
                <>
                  <Card className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="text-lg">Admin Role</CardTitle>
                          <CardDescription>Full system access</CardDescription>
                        </div>
                        <div className="h-8 w-8 bg-gray-200 rounded"></div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <div className="h-6 w-16 bg-green-100 text-green-800 rounded-full px-2 text-xs">Active</div>
                        <div className="h-6 w-20 bg-blue-100 text-blue-800 rounded-full px-2 text-xs">System</div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm">
                          <div className="h-4 w-4 bg-gray-300 rounded"></div>
                          <span>Permissions (12)</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <div className="h-6 w-16 bg-gray-100 rounded-full px-2 text-xs">read</div>
                          <div className="h-6 w-20 bg-gray-100 rounded-full px-2 text-xs">write</div>
                          <div className="h-6 w-16 bg-gray-100 rounded-full px-2 text-xs">delete</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="text-lg">User Role</CardTitle>
                          <CardDescription>Basic user permissions</CardDescription>
                        </div>
                        <div className="h-8 w-8 bg-gray-200 rounded"></div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <div className="h-6 w-16 bg-green-100 text-green-800 rounded-full px-2 text-xs">Active</div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm">
                          <div className="h-4 w-4 bg-gray-300 rounded"></div>
                          <span>Permissions (3)</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <div className="h-6 w-16 bg-gray-100 rounded-full px-2 text-xs">read</div>
                          <div className="h-6 w-20 bg-gray-100 rounded-full px-2 text-xs">profile</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="text-lg">Viewer Role</CardTitle>
                          <CardDescription>Read-only access</CardDescription>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <div className="h-6 w-16 bg-green-100 text-green-800 rounded-full px-2 text-xs">Active</div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm">
                          <div className="h-4 w-4 bg-gray-300 rounded"></div>
                          <span>Permissions (1)</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <div className="h-6 w-16 bg-gray-100 rounded-full px-2 text-xs">read</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Permission List Skeleton */}
        <Card>
          <CardHeader>
            <CardTitle>Permission List Skeleton</CardTitle>
            <CardDescription>
              Loading state for permission selection lists in create/edit role dialogs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {showLoading ? (
              <PermissionListSkeleton itemCount={6} showSearch={true} />
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Permissions (6 selected)</h3>
                  <div className="h-10 w-48 bg-gray-100 rounded"></div>
                </div>
                <div className="border rounded-lg p-3 max-h-96 overflow-y-auto space-y-2">
                  {[
                    { name: 'read', description: 'Read access to resources' },
                    { name: 'write', description: 'Write access to resources' },
                    { name: 'delete', description: 'Delete resources' },
                    { name: 'manage_users', description: 'Manage user accounts' },
                    { name: 'manage_roles', description: 'Manage role assignments' },
                    { name: 'system_config', description: 'System configuration access' }
                  ].map((permission, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 hover:bg-muted/50 rounded">
                      <div className="h-4 w-4 bg-gray-300 rounded mt-1"></div>
                      <div className="flex-1 space-y-1">
                        <div className="font-medium">{permission.name}</div>
                        <div className="text-sm text-muted-foreground">{permission.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Table Skeleton */}
        <Card>
          <CardHeader>
            <CardTitle>Table Skeleton</CardTitle>
            <CardDescription>
              Loading state for data tables with customizable rows and columns.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {showLoading ? (
              <TableSkeleton rowCount={4} columnCount={5} />
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">User Roles Table</h3>
                  <p className="text-sm text-muted-foreground">4 users found</p>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <div className="border-b bg-muted/50">
                    <div className="grid gap-4 p-4" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                      <div className="font-medium">Name</div>
                      <div className="font-medium">Email</div>
                      <div className="font-medium">Role</div>
                      <div className="font-medium">Status</div>
                      <div className="font-medium">Last Login</div>
                    </div>
                  </div>
                  <div className="divide-y">
                    {[
                      { name: 'John Doe', email: 'john@example.com', role: 'Admin', status: 'Active', lastLogin: '2 hours ago' },
                      { name: 'Jane Smith', email: 'jane@example.com', role: 'User', status: 'Active', lastLogin: '1 day ago' },
                      { name: 'Bob Johnson', email: 'bob@example.com', role: 'Viewer', status: 'Inactive', lastLogin: '1 week ago' },
                      { name: 'Alice Brown', email: 'alice@example.com', role: 'Manager', status: 'Active', lastLogin: '3 hours ago' }
                    ].map((user, index) => (
                      <div key={index} className="hover:bg-muted/50">
                        <div className="grid gap-4 p-4" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                          <div>{user.name}</div>
                          <div>{user.email}</div>
                          <div>{user.role}</div>
                          <div>{user.status}</div>
                          <div>{user.lastLogin}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Role Management Skeleton */}
        <Card>
          <CardHeader>
            <CardTitle>Role Management Skeleton</CardTitle>
            <CardDescription>
              Complete loading state for the entire role management page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {showLoading ? (
              <RoleManagementSkeleton roleCardCount={4} />
            ) : (
              <div className="space-y-6">
                <div className="flex justify-end">
                  <div className="h-10 w-32 bg-blue-500 text-white rounded flex items-center justify-center">
                    Create Role
                  </div>
                </div>
                <div className="bg-card border rounded-lg p-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-5 bg-gray-300 rounded"></div>
                      <h3 className="text-lg font-medium">Search Roles</h3>
                    </div>
                    <div className="flex gap-4">
                      <div className="h-10 w-64 bg-gray-100 rounded"></div>
                      <div className="h-6 w-16 bg-gray-100 rounded-full px-3 text-xs">4 roles</div>
                    </div>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <Card className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="text-lg">Admin</CardTitle>
                          <CardDescription>Full system access</CardDescription>
                        </div>
                        <div className="h-8 w-8 bg-gray-200 rounded"></div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm">
                          <div className="h-4 w-4 bg-gray-300 rounded"></div>
                          <span>Permissions (12)</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="text-lg">User</CardTitle>
                          <CardDescription>Basic access</CardDescription>
                        </div>
                        <div className="h-8 w-8 bg-gray-200 rounded"></div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm">
                          <div className="h-4 w-4 bg-gray-300 rounded"></div>
                          <span>Permissions (3)</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="text-lg">Viewer</CardTitle>
                          <CardDescription>Read-only</CardDescription>
                        </div>
                        <div className="h-8 w-8 bg-gray-200 rounded"></div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm">
                          <div className="h-4 w-4 bg-gray-300 rounded"></div>
                          <span>Permissions (1)</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="text-lg">Manager</CardTitle>
                          <CardDescription>Team management</CardDescription>
                        </div>
                        <div className="h-8 w-8 bg-gray-200 rounded"></div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm">
                          <div className="h-4 w-4 bg-gray-300 rounded"></div>
                          <span>Permissions (6)</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}