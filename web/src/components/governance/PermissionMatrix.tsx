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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
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
  CheckSquare,
  Square,
  Grid3X3,
  Filter,
  Search,
  Eye,
  EyeOff,
  Copy,
  Download,
  Upload,
  Settings,
  Shield,
  Database,
  FileText,
  Users,
  Lock,
  Unlock,
  GitBranch
} from 'lucide-react'
import {
  CustomRole,
  Permission,
  PermissionMatrix as PermissionMatrixType,
  PermissionMatrixCell
} from '@/types/governance'
import { cn } from '@/lib/utils'

interface PermissionMatrixProps {
  roles?: CustomRole[]
  permissions?: Permission[]
  matrix?: PermissionMatrixType
  onTogglePermission?: (roleName: string, resource: string, action: string) => Promise<void>
  onBulkUpdatePermissions?: (roleName: string, updates: Array<{action: string, operation: 'add'|'remove'}>) => Promise<void>
  onExportMatrix?: () => Promise<string>
  onImportMatrix?: (matrixData: any) => Promise<void>
}

interface ResourceGroup {
  name: string
  icon: React.ReactNode
  resources: string[]
  actions: string[]
  color: string
}

export function PermissionMatrix({
  roles = [],
  permissions = [],
  matrix = { resources: [], actions: [], matrix: [] },
  onTogglePermission = async () => {},
  onBulkUpdatePermissions = async () => {},
  onExportMatrix = async () => '',
  onImportMatrix = async () => {}
}: PermissionMatrixProps) {
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [selectedResources, setSelectedResources] = useState<string[]>([])
  const [selectedActions, setSelectedActions] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false)
  const [selectedBulkRole, setSelectedBulkRole] = useState<string>('')
  const [importData, setImportData] = useState<string>('')

  // Resource groups for better organization
  const resourceGroups: ResourceGroup[] = [
    {
      name: 'Templates',
      icon: <FileText className="h-4 w-4" />,
      resources: ['template', 'prompt_template'],
      actions: ['create', 'read', 'update', 'delete', 'publish'],
      color: 'bg-blue-50 border-blue-200'
    },
    {
      name: 'Projects',
      icon: <Database className="h-4 w-4" />,
      resources: ['project', 'module'],
      actions: ['create', 'read', 'update', 'delete', 'manage'],
      color: 'bg-green-50 border-green-200'
    },
    {
      name: 'Users',
      icon: <Users className="h-4 w-4" />,
      resources: ['user', 'role'],
      actions: ['create', 'read', 'update', 'delete', 'assign'],
      color: 'bg-purple-50 border-purple-200'
    },
    {
      name: 'System',
      icon: <Settings className="h-4 w-4" />,
      resources: ['system', 'config', 'audit'],
      actions: ['read', 'configure', 'admin'],
      color: 'bg-orange-50 border-orange-200'
    },
    {
      name: 'Governance',
      icon: <Shield className="h-4 w-4" />,
      resources: ['policy', 'workflow', 'compliance'],
      actions: ['create', 'read', 'update', 'delete', 'execute'],
      color: 'bg-red-50 border-red-200'
    }
  ]

  // Initialize selections
  useEffect(() => {
    if (roles.length > 0 && selectedRoles.length === 0) {
      setSelectedRoles(roles.slice(0, 5).map(r => r.name))
    }
    if (matrix.resources.length > 0 && selectedResources.length === 0) {
      setSelectedResources(matrix.resources.slice(0, 5))
    }
    if (matrix.actions.length > 0 && selectedActions.length === 0) {
      setSelectedActions(matrix.actions.slice(0, 4))
    }
  }, [roles, matrix])

  // Filter roles based on search and active status
  const filteredRoles = roles.filter(role => {
    const matchesSearch = role.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         role.description?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesActive = showInactive || role.is_active
    return matchesSearch && matchesActive
  })

  // Check if a role has a specific permission
  const hasPermission = (roleName: string, resource: string, action: string): boolean => {
    return matrix.matrix.some(cell =>
      cell.role === roleName &&
      cell.resource === resource &&
      cell.action === action &&
      cell.has_permission
    )
  }

  // Get permission details for a cell
  const getPermissionCell = (roleName: string, resource: string, action: string): PermissionMatrixCell | undefined => {
    return matrix.matrix.find(cell =>
      cell.role === roleName &&
      cell.resource === resource &&
      cell.action === action
    )
  }

  // Handle permission toggle
  const handleTogglePermission = async (roleName: string, resource: string, action: string) => {
    try {
      await onTogglePermission(roleName, resource, action)
    } catch (error) {
      console.error('Error toggling permission:', error)
    }
  }

  // Handle bulk update
  const handleBulkUpdate = async () => {
    if (!selectedBulkRole) return

    const updates = matrix.actions.map(action => ({
      action,
      operation: 'add' as const
    }))

    try {
      await onBulkUpdatePermissions(selectedBulkRole, updates)
      setIsBulkDialogOpen(false)
      setSelectedBulkRole('')
    } catch (error) {
      console.error('Error updating permissions:', error)
    }
  }

  // Handle export
  const handleExport = async () => {
    try {
      const data = await onExportMatrix()
      const blob = new Blob([data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `permission-matrix-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting matrix:', error)
    }
  }

  // Handle import
  const handleImport = async () => {
    if (!importData) return

    try {
      const parsedData = JSON.parse(importData)
      await onImportMatrix(parsedData)
      setImportData('')
    } catch (error) {
      console.error('Error importing matrix:', error)
      alert('Invalid JSON data')
    }
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
                <Copy className="h-4 w-4 mr-2" />
                Bulk Update
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Bulk Permission Update</DialogTitle>
                <DialogDescription>
                  Apply multiple permissions to a role at once
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Role</Label>
                  <Select value={selectedBulkRole} onValueChange={setSelectedBulkRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.name} value={role.name}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Actions to Add</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {matrix.actions.map((action) => (
                      <Badge key={action} variant="outline">
                        {action}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsBulkDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleBulkUpdate}>Apply Permissions</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import Permission Matrix</DialogTitle>
                <DialogDescription>
                  Upload a JSON file to import permission matrix configuration
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="import-data">JSON Data</Label>
                  <textarea
                    id="import-data"
                    className="w-full h-32 p-2 border rounded-md"
                    placeholder="Paste JSON data here..."
                    value={importData}
                    onChange={(e) => setImportData(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setImportData('')}>
                  Clear
                </Button>
                <Button onClick={handleImport}>Import</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters and Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & View Options
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Search Roles</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search roles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>View Mode</Label>
              <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'grid' | 'table')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="grid">
                    <Grid3X3 className="h-4 w-4 mr-2" />
                    Grid
                  </TabsTrigger>
                  <TabsTrigger value="table">
                    <Eye className="h-4 w-4 mr-2" />
                    Table
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="space-y-2">
              <Label>Show Inactive Roles</Label>
              <Button
                variant={showInactive ? "default" : "outline"}
                size="sm"
                onClick={() => setShowInactive(!showInactive)}
                className="w-full justify-start"
              >
                {showInactive ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
                {showInactive ? 'Showing All' : 'Active Only'}
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Quick Actions</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedRoles(roles.map(r => r.name))
                  setSelectedResources(matrix.resources)
                  setSelectedActions(matrix.actions)
                }}
                className="w-full justify-start"
              >
                Select All
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resource Groups Tabs */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="all">All Resources</TabsTrigger>
          {resourceGroups.slice(0, 5).map((group) => (
            <TabsTrigger key={group.name} value={group.name.toLowerCase()}>
              {group.icon}
              {group.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {resourceGroups.map((group) => (
          <TabsContent key={group.name} value={group.name.toLowerCase()} className="space-y-4">
            {/* Group Header */}
            <Card className={group.color}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {group.icon}
                  {group.name} Permissions
                </CardTitle>
                <CardDescription>
                  Manage access permissions for {group.name.toLowerCase()} resources
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Permission Grid */}
            {viewMode === 'grid' && (
              <div className="border rounded-lg p-4">
                <div className="overflow-x-auto">
                  <div className="min-w-[800px]">
                    {/* Header Row */}
                    <div className="grid grid-cols-[200px_repeat(auto-fill,minmax(120px,1fr))] gap-1 mb-2">
                      <div className="p-2 font-medium text-sm"></div>
                      {selectedRoles.map((roleName) => (
                        <div key={roleName} className="p-2 text-center">
                          <div className="font-medium text-xs">{roleName}</div>
                          <Badge
                            variant={roles.find(r => r.name === roleName)?.is_active ? "default" : "secondary"}
                            className="text-xs mt-1"
                          >
                            {roles.find(r => r.name === roleName)?.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      ))}
                    </div>

                    {/* Action Rows */}
                    {group.actions.map((action) => (
                      <div key={action} className="contents">
                        <div className="p-2 font-medium text-sm border-t bg-muted/50">
                          {action}
                        </div>
                        {selectedRoles.map((roleName) => {
                          const hasPerm = hasPermission(roleName, group.resources[0], action)
                          const cell = getPermissionCell(roleName, group.resources[0], action)

                          return (
                            <div key={`${roleName}-${action}`} className="p-2 text-center border-t">
                              <button
                                onClick={() => handleTogglePermission(roleName, group.resources[0], action)}
                                className={cn(
                                  "w-8 h-8 rounded flex items-center justify-center mx-auto transition-colors",
                                  hasPerm
                                    ? "bg-green-100 text-green-700 hover:bg-green-200"
                                    : "bg-gray-100 text-gray-400 hover:bg-gray-200",
                                  !roles.find(r => r.name === roleName)?.is_active && "opacity-50 cursor-not-allowed"
                                )}
                                disabled={!roles.find(r => r.name === roleName)?.is_active}
                              >
                                {hasPerm ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                              </button>
                              {cell?.source === 'inherited' && (
                                <GitBranch className="h-3 w-3 mx-auto text-blue-500 mt-1" />
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Table View */}
            {viewMode === 'table' && (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Role</TableHead>
                          {group.actions.map((action) => (
                            <TableHead key={action} className="text-center">{action}</TableHead>
                          ))}
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRoles.map((role) => (
                          <TableRow key={role.name}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Shield className="h-4 w-4" />
                                <div>
                                  <div className="font-medium">{role.name}</div>
                                  <div className="text-sm text-muted-foreground">
                                    {role.description}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            {group.actions.map((action) => {
                              const hasPerm = hasPermission(role.name, group.resources[0], action)
                              return (
                                <TableCell key={action} className="text-center">
                                  <button
                                    onClick={() => handleTogglePermission(role.name, group.resources[0], action)}
                                    className={cn(
                                      "w-8 h-8 rounded flex items-center justify-center mx-auto transition-colors",
                                      hasPerm
                                        ? "bg-green-100 text-green-700 hover:bg-green-200"
                                        : "bg-gray-100 text-gray-400 hover:bg-gray-200",
                                      !role.is_active && "opacity-50 cursor-not-allowed"
                                    )}
                                    disabled={!role.is_active}
                                  >
                                    {hasPerm ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                                  </button>
                                </TableCell>
                              )
                            })}
                            <TableCell>
                              <Badge variant={role.is_active ? "default" : "secondary"}>
                                {role.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        ))}

        {/* All Resources View */}
        <TabsContent value="all" className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <Grid3X3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Resource Grouped View</h3>
                <p className="text-muted-foreground mb-4">
                  Select a specific resource group above to view and manage permissions for that category
                </p>
                <div className="flex justify-center gap-2">
                  {resourceGroups.map((group) => (
                    <Badge key={group.name} variant="outline" className="flex items-center gap-1">
                      {group.icon}
                      {group.name}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle>Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-green-700" />
              <span className="text-sm">Permission Granted</span>
            </div>
            <div className="flex items-center gap-2">
              <Square className="h-4 w-4 text-gray-400" />
              <span className="text-sm">Permission Denied</span>
            </div>
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-blue-500" />
              <span className="text-sm">Inherited Permission</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="default">Active</Badge>
              <Badge variant="secondary">Inactive</Badge>
              <span className="text-sm">Role Status</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}