import React, { useState, useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { useSearch } from '@/hooks/useDebounce'
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
  X,
  Circle,
  Search as SearchIcon,
  Crown,
  Building2,
  UserCheck,
  Lock,
  Unlock,
  Star,
  Activity,
  Zap,
  Layers,
  Eye,
  EyeOff,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  FileDown,
  FileUp,
  Database,
  Server,
  Globe,
  HardDrive,
  Calendar,
  Target,
  Zap as Fast,
  ShieldCheck,
  Users2,
  KeyRound,
  Layers3
} from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { formatDate, formatRelativeTime } from '@/lib/utils'
import { makeAuthenticatedRequest } from '@/lib/googleAuth'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts'
// Command components are not available, using simple divs instead
import {
  RoleManagementSkeleton,
  RoleCardSkeleton,
  PermissionListSkeleton
} from '@/components/ui/skeleton-loading'
import { ErrorBoundary } from '@/components/error-handling/ErrorBoundary'
import { APIErrorBoundary } from '@/components/error-handling/APIErrorBoundary'
import { useQueryWithError, useMutationWithError } from '@/hooks/useErrorHandling'
import { ErrorLogger } from '@/lib/errorLogger'
import { useQueryClient } from '@tanstack/react-query'
import { useDebounce } from '@/hooks/useDebounce'
import { cn } from '@/lib/utils'

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

// Statistics Types
interface RoleStatistics {
  total_roles: number
  active_roles: number
  inactive_roles: number
  system_roles: number
  custom_roles: number
  average_permissions: number
  inheritance_usage: {
    none: number
    hierarchical: number
    conditional: number
  }
  permission_distribution: Array<{
    level: string
    count: number
    color: string
  }>
  role_type_distribution: Array<{
    type: string
    count: number
    color: string
  }>
  recent_activity: Array<{
    date: string
    created: number
    modified: number
    deleted: number
  }>
  security_insights: Array<{
    type: 'warning' | 'info' | 'success' | 'error'
    title: string
    description: string
    icon: any
  }>
}

interface SystemHealth {
  status: 'healthy' | 'warning' | 'error'
  uptime: string
  response_time: number
  database_status: 'connected' | 'disconnected' | 'slow'
  memory_usage: number
  active_sessions: number
}

// Utility functions for statistics calculation
const calculateRoleStatistics = (roles: RoleResponse[]): RoleStatistics => {
  const totalRoles = roles.length
  const activeRoles = roles.filter(role => role.is_active).length
  const inactiveRoles = totalRoles - activeRoles
  const systemRoles = roles.filter(role => role.is_system).length
  const customRoles = totalRoles - systemRoles

  const totalPermissions = roles.reduce((sum, role) => sum + role.permissions.length, 0)
  const averagePermissions = totalRoles > 0 ? Math.round(totalPermissions / totalRoles) : 0

  const inheritanceUsage = {
    none: roles.filter(role => !role.inheritance_type || role.inheritance_type === 'none').length,
    hierarchical: roles.filter(role => role.inheritance_type === 'hierarchical').length,
    conditional: roles.filter(role => role.inheritance_type === 'conditional').length
  }

  const permissionDistribution = [
    { level: 'No Permissions', count: roles.filter(role => role.permissions.length === 0).length, color: '#ef4444' },
    { level: 'Limited (1-5)', count: roles.filter(role => role.permissions.length > 0 && role.permissions.length <= 5).length, color: '#06b6d4' },
    { level: 'Standard (6-15)', count: roles.filter(role => role.permissions.length > 5 && role.permissions.length <= 15).length, color: '#8b5cf6' },
    { level: 'Extensive (16+)', count: roles.filter(role => role.permissions.length > 15).length, color: '#dc2626' }
  ]

  const roleTypeDistribution = [
    { type: 'System Roles', count: systemRoles, color: '#f59e0b' },
    { type: 'Custom Roles', count: customRoles, color: '#3b82f6' }
  ]

  // Generate mock recent activity for now
  const recentActivity = [
    { date: '2024-01-15', created: 3, modified: 7, deleted: 1 },
    { date: '2024-01-14', created: 2, modified: 4, deleted: 0 },
    { date: '2024-01-13', created: 5, modified: 3, deleted: 2 },
    { date: '2024-01-12', created: 1, modified: 6, deleted: 1 },
    { date: '2024-01-11', created: 4, modified: 8, deleted: 0 }
  ]

  // Generate security insights
  const securityInsights = [
    {
      type: 'success' as const,
      title: 'Role Security Healthy',
      description: `${systemRoles} system roles are properly secured`,
      icon: ShieldCheck
    },
    {
      type: 'warning' as const,
      title: 'High Permission Roles',
      description: `${roles.filter(role => role.permissions.length > 15).length} roles have extensive permissions`,
      icon: AlertTriangle
    },
    {
      type: 'info' as const,
      title: 'Inheritance Usage',
      description: `${inheritanceUsage.hierarchical + inheritanceUsage.conditional} roles use inheritance features`,
      icon: GitBranch
    },
    {
      type: 'success' as const,
      title: 'Active Roles',
      description: `${Math.round((activeRoles / totalRoles) * 100)}% of roles are currently active`,
      icon: Activity
    }
  ]

  return {
    total_roles: totalRoles,
    active_roles: activeRoles,
    inactive_roles: inactiveRoles,
    system_roles: systemRoles,
    custom_roles: customRoles,
    average_permissions: averagePermissions,
    inheritance_usage: inheritanceUsage,
    permission_distribution: permissionDistribution,
    role_type_distribution: roleTypeDistribution,
    recent_activity: recentActivity,
    security_insights: securityInsights
  }
}

const getSystemHealth = (): SystemHealth => {
  // Mock system health data
  return {
    status: 'healthy',
    uptime: '15d 4h 32m',
    response_time: 145,
    database_status: 'connected',
    memory_usage: 67,
    active_sessions: 24
  }
}

// Enhanced badge variants for role states
const getRoleStatusBadge = (isActive: boolean, isSystem: boolean) => {
  if (isSystem) {
    return (
      <Badge
        className={cn(
          "border-0 font-medium shadow-sm",
          "bg-gradient-to-r from-amber-500 to-orange-500 text-white",
          "hover:from-amber-600 hover:to-orange-600 transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
        )}
        aria-label="System role"
      >
        <Crown className="w-3 h-3 mr-1" aria-hidden="true" />
        System
      </Badge>
    )
  }

  if (isActive) {
    return (
      <Badge
        className={cn(
          "border-0 font-medium shadow-sm",
          "bg-gradient-to-r from-emerald-500 to-green-500 text-white",
          "hover:from-emerald-600 hover:to-green-600 transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
        )}
        aria-label="Active role"
      >
        <Activity className="w-3 h-3 mr-1" aria-hidden="true" />
        Active
      </Badge>
    )
  }

  return (
    <Badge
      variant="secondary"
      className={cn(
        "border-0 font-medium shadow-sm",
        "focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
      )}
      aria-label="Inactive role"
    >
      <EyeOff className="w-3 h-3 mr-1" aria-hidden="true" />
      Inactive
    </Badge>
  )
}

const getInheritanceBadge = (inheritanceType: string) => {
  const variants = {
    hierarchical: {
      icon: Layers,
      gradient: "from-blue-500 to-indigo-500",
      hover: "hover:from-blue-600 hover:to-indigo-600",
      focus: "focus:ring-blue-500"
    },
    conditional: {
      icon: Zap,
      gradient: "from-purple-500 to-pink-500",
      hover: "hover:from-purple-600 hover:to-pink-600",
      focus: "focus:ring-purple-500"
    },
    none: {
      icon: Circle,
      gradient: "from-gray-400 to-gray-500",
      hover: "hover:from-gray-500 hover:to-gray-600",
      focus: "focus:ring-gray-500"
    }
  }

  const variant = variants[inheritanceType as keyof typeof variants] || variants.none
  const Icon = variant.icon

  if (inheritanceType === "none") {
    return (
      <Badge
        variant="outline"
        className={cn(
          "border-0 font-medium shadow-sm",
          "focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
        )}
        aria-label="No inheritance"
      >
        <Icon className="w-3 h-3 mr-1" aria-hidden="true" />
        No Inheritance
      </Badge>
    )
  }

  return (
    <Badge
      className={cn(
        "border-0 font-medium shadow-sm text-white",
        `bg-gradient-to-r ${variant.gradient} ${variant.hover}`,
        "transition-all duration-200",
        "focus:outline-none focus:ring-2 focus:ring-offset-2"
      )}
      aria-label={`${inheritanceType} inheritance`}
    >
      <Icon className="w-3 h-3 mr-1" aria-hidden="true" />
      {inheritanceType}
    </Badge>
  )
}

const getPermissionLevelBadge = (permissionCount: number) => {
  if (permissionCount === 0) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "border-0 font-medium shadow-sm",
          "focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
        )}
        aria-label="No permissions"
      >
        <Lock className="w-3 h-3 mr-1" aria-hidden="true" />
        No Permissions
      </Badge>
    )
  }

  if (permissionCount <= 5) {
    return (
      <Badge
        className={cn(
          "border-0 font-medium shadow-sm",
          "bg-gradient-to-r from-cyan-500 to-teal-500 text-white",
          "hover:from-cyan-600 hover:to-teal-600 transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2"
        )}
        aria-label={`Limited permissions: ${permissionCount} permissions`}
      >
        <UserCheck className="w-3 h-3 mr-1" aria-hidden="true" />
        Limited ({permissionCount})
      </Badge>
    )
  }

  if (permissionCount <= 15) {
    return (
      <Badge
        className={cn(
          "border-0 font-medium shadow-sm",
          "bg-gradient-to-r from-violet-500 to-purple-500 text-white",
          "hover:from-violet-600 hover:to-purple-600 transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
        )}
        aria-label={`Standard permissions: ${permissionCount} permissions`}
      >
        <Star className="w-3 h-3 mr-1" aria-hidden="true" />
        Standard ({permissionCount})
      </Badge>
    )
  }

  return (
    <Badge
      className={cn(
        "border-0 font-medium shadow-sm",
        "bg-gradient-to-r from-red-500 to-rose-500 text-white",
        "hover:from-red-600 hover:to-rose-600 transition-all duration-200",
        "focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
      )}
      aria-label={`Extensive permissions: ${permissionCount} permissions`}
    >
      <Shield className="w-3 h-3 mr-1" aria-hidden="true" />
      Extensive ({permissionCount})
    </Badge>
  )
}

// Statistics Dashboard Components
const MetricCard = ({ title, value, icon: Icon, description, trend, trendValue }: {
  title: string
  value: string | number
  icon: any
  description?: string
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
}) => {
  // Determine gradient color based on title
  const getGradient = () => {
    if (title.includes("Total") || title.includes("Users")) return "from-blue-500 to-purple-500";
    if (title.includes("Active") || title.includes("Approved")) return "from-green-500 to-emerald-500";
    if (title.includes("System") || title.includes("Admin")) return "from-violet-500 to-purple-500";
    if (title.includes("Custom") || title.includes("Inactive")) return "from-amber-500 to-orange-500";
    if (title.includes("Avg") || title.includes("Permissions")) return "from-cyan-500 to-teal-500";
    return "from-blue-500 to-purple-500"; // default
  };

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border-2 hover:border-primary/20 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/60"></div>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={`p-3 rounded-lg bg-gradient-to-r ${getGradient()} text-white transition-all hover:shadow-md`}>
            <Icon className="w-6 h-6" />
          </div>
          {trend && (
            <div className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
              trend === 'up' ? "bg-green-100 text-green-700" :
              trend === 'down' ? "bg-red-100 text-red-700" :
              "bg-gray-100 text-gray-700"
            )}>
              {trend === 'up' && <TrendingUp className="h-3 w-3" />}
              {trend === 'down' && <TrendingDown className="h-3 w-3" />}
              {trendValue}
            </div>
          )}
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-semibold group-hover:text-primary transition-colors">
            {value}
          </h3>
          <p className="text-sm font-medium text-muted-foreground">
            {title}
          </p>
          {description && (
            <p className="text-xs text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

const SecurityInsightCard = ({ insight }: { insight: RoleStatistics['security_insights'][0] }) => {
  const Icon = insight.icon

  const getVariantStyles = (type: string) => {
    switch (type) {
      case 'success':
        return {
          background: 'from-green-500 to-emerald-500',
          border: 'border-green-200 dark:border-green-800',
          bg: 'bg-green-50 dark:bg-green-900/20',
          text: 'text-green-700 dark:text-green-300'
        }
      case 'warning':
        return {
          background: 'from-amber-500 to-orange-500',
          border: 'border-amber-200 dark:border-amber-800',
          bg: 'bg-amber-50 dark:bg-amber-900/20',
          text: 'text-amber-700 dark:text-amber-300'
        }
      case 'error':
        return {
          background: 'from-red-500 to-rose-500',
          border: 'border-red-200 dark:border-red-800',
          bg: 'bg-red-50 dark:bg-red-900/20',
          text: 'text-red-700 dark:text-red-300'
        }
      default:
        return {
          background: 'from-blue-500 to-indigo-500',
          border: 'border-blue-200 dark:border-blue-800',
          bg: 'bg-blue-50 dark:bg-blue-900/20',
          text: 'text-blue-700 dark:text-blue-300'
        }
    }
  }

  const styles = getVariantStyles(insight.type)

  return (
    <Card className={cn(
      "group overflow-hidden",
      "border-0 shadow-md hover:shadow-lg",
      "bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800",
      "transition-all duration-300 transform hover:-translate-y-1",
      `border ${styles.border}`
    )}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn(
            "p-2 rounded-lg flex-shrink-0",
            `bg-gradient-to-r ${styles.background} text-white`
          )}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className={cn(
              "font-semibold mb-1",
              styles.text
            )}>
              {insight.title}
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              {insight.description}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

const SystemHealthIndicator = ({ health }: { health: SystemHealth }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'from-green-500 to-emerald-500'
      case 'warning': return 'from-amber-500 to-orange-500'
      case 'error': return 'from-red-500 to-rose-500'
      default: return 'from-gray-500 to-gray-600'
    }
  }

  const getDatabaseColor = (status: string) => {
    switch (status) {
      case 'connected': return 'text-green-500'
      case 'slow': return 'text-amber-500'
      case 'disconnected': return 'text-red-500'
      default: return 'text-gray-500'
    }
  }

  return (
    <Card className={cn(
      "overflow-hidden",
      "border-0 shadow-lg",
      "bg-gradient-to-br from-white via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800"
    )}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-3 rounded-lg",
              `bg-gradient-to-r ${getStatusColor(health.status)} text-white`
            )}>
              <Server className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                System Health
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                {health.status}
              </p>
            </div>
          </div>
          <Badge variant="outline" className={cn(
            "text-xs font-medium",
            "bg-white dark:bg-gray-800",
            health.status === 'healthy' ? "border-green-200 text-green-700" :
            health.status === 'warning' ? "border-amber-200 text-amber-700" :
            "border-red-200 text-red-700"
          )}>
            <CheckCircle className="h-3 w-3 mr-1" />
            {health.status === 'healthy' ? 'All Systems Go' :
             health.status === 'warning' ? 'Minor Issues' : 'Attention Required'}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Uptime</span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {health.uptime}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Response Time</span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {health.response_time}ms
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Memory Usage</span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {health.memory_usage}%
              </span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Database</span>
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  getDatabaseColor(health.database_status)
                )} />
                <span className={cn(
                  "text-sm font-medium",
                  getDatabaseColor(health.database_status)
                )}>
                  {health.database_status}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Active Sessions</span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {health.active_sessions}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

const QuickActionsCard = ({ onCreateRole, onExport, onImport }: {
  onCreateRole: () => void
  onExport: () => void
  onImport: () => void
}) => {
  return (
    <Card className={cn(
      "overflow-hidden",
      "border-0 shadow-lg",
      "bg-gradient-to-br from-white via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800"
    )}>
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white">
            <Fast className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Quick Actions
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Common tasks and operations
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Button
            onClick={onCreateRole}
            className={cn(
              "flex items-center justify-center gap-2 h-12",
              "bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600",
              "text-white font-medium",
              "shadow-md hover:shadow-lg",
              "transition-all duration-200"
            )}
          >
            <Plus className="h-4 w-4" />
            Create Role
          </Button>

          <Button
            onClick={onExport}
            variant="outline"
            className={cn(
              "flex items-center justify-center gap-2 h-12",
              "border-2 border-gray-200 dark:border-gray-700",
              "hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20",
              "transition-all duration-200"
            )}
          >
            <FileDown className="h-4 w-4" />
            Export
          </Button>

          <Button
            onClick={onImport}
            variant="outline"
            className={cn(
              "flex items-center justify-center gap-2 h-12",
              "border-2 border-gray-200 dark:border-gray-700",
              "hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20",
              "transition-all duration-200"
            )}
          >
            <FileUp className="h-4 w-4" />
            Import
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function RoleManagement() {
  // Log user action for component access
  useEffect(() => {
    ErrorLogger.logUserAction('access_role_management', {
      timestamp: new Date().toISOString(),
      url: window.location.href
    })
  }, [])
  const queryClient = useQueryClient()

  // Hook for managing search state with debouncing and history
  const {
    searchQuery,
    debouncedSearchQuery,
    history: searchHistory,
    handleSearchChange,
    clearSearch,
    selectFromHistory,
    removeFromHistory,
    clearHistory,
    isDebouncing
  } = useSearch('', 'role-search', 300)

  // State for search suggestions
  const [showSuggestions, setShowSuggestions] = useState(false)
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

  // API Queries with error handling and enhanced caching
  const { data: roles = [], isLoading: rolesLoading } = useQueryWithError({
    queryKey: ['roles', debouncedSearchQuery],
    queryFn: async () => {
      const endpoint = debouncedSearchQuery.trim()
        ? `/v1/roles/?search=${encodeURIComponent(debouncedSearchQuery)}`
        : '/v1/roles/'
      return await makeAuthenticatedRequest<RoleResponse[]>(endpoint)
    },
    errorContext: { component: 'RoleManagement', action: 'fetch_roles', searchQuery: debouncedSearchQuery },
    showToast: false, // Don't show toast for loading errors, handle in UI
    retryCondition: (error, retryCount) => {
      // Retry network errors but not auth errors
      if (error.message.includes('401') || error.message.includes('unauthorized')) {
        return false
      }
      return retryCount < 3
    },
    // Enhanced caching configuration
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    keepPreviousData: true // Keep showing previous data while fetching new data
  })

  const { data: permissionTemplates = [], isLoading: templatesLoading } = useQueryWithError({
    queryKey: ['permission-templates'],
    queryFn: async () => {
      return await makeAuthenticatedRequest<PermissionTemplateResponse[]>('/v1/roles/templates/')
    },
    errorContext: { component: 'RoleManagement', action: 'fetch_permission_templates' },
    showToast: false
  })

  const { data: availablePermissions = [], isLoading: permissionsLoading } = useQueryWithError({
    queryKey: ['available-permissions'],
    queryFn: async () => {
      return await makeAuthenticatedRequest<PermissionInfo[]>('/v1/roles/available-permissions/')
    },
    errorContext: { component: 'RoleManagement', action: 'fetch_available_permissions' },
    showToast: false
  })

  // Generate search suggestions based on current input (optimized)
  const searchSuggestions = React.useMemo(() => {
    if (!searchQuery.trim()) {
      return searchHistory.slice(0, 5)
    }

    const query = searchQuery.toLowerCase()
    const suggestions: string[] = []
    const seen = new Set<string>()

    // Helper function to add unique suggestions
    const addSuggestion = (item: string, maxLimit: number) => {
      if (!seen.has(item) && suggestions.length < maxLimit) {
        suggestions.push(item)
        seen.add(item)
        return true
      }
      return false
    }

    // Add matching search history items (highest priority)
    searchHistory.forEach(item => {
      if (item.toLowerCase().includes(query)) {
        addSuggestion(item, 3)
      }
    })

    // Add matching role names
    roles.forEach(role => {
      if (role.name.toLowerCase().includes(query)) {
        addSuggestion(role.name, 5)
      }
    })

    // Add matching permission names (optimized with Set for uniqueness)
    const matchingPermissions = new Set<string>()
    roles.forEach(role => {
      role.permissions.forEach(permission => {
        if (permission.toLowerCase().includes(query)) {
          matchingPermissions.add(permission)
        }
      })
    })

    // Add unique permission suggestions
    matchingPermissions.forEach(permission => {
      addSuggestion(permission, 8)
    })

    return suggestions
  }, [searchQuery, searchHistory, roles])

  // Calculate statistics from roles data (moved after API queries)
  const roleStatistics = React.useMemo(() => calculateRoleStatistics(roles), [roles])
  const systemHealth = React.useMemo(() => getSystemHealth(), [])

  // API Mutations with error handling
  const createRoleMutation = useMutationWithError({
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
      // Log successful role creation
      ErrorLogger.logUserAction('create_role_success', {
        roleName: createFormData.name,
        timestamp: new Date().toISOString()
      })
    },
    errorContext: { component: 'RoleManagement', action: 'create_role', data: createFormData },
    successMessage: 'Role created successfully'
  })

  const updateRoleMutation = useMutationWithError({
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
      // Log successful role update
      ErrorLogger.logUserAction('update_role_success', {
        roleName: editingRole?.name,
        timestamp: new Date().toISOString()
      })
    },
    errorContext: { component: 'RoleManagement', action: 'update_role' },
    successMessage: 'Role updated successfully'
  })

  const deleteRoleMutation = useMutationWithError({
    mutationFn: async (roleName: string) => {
      return await makeAuthenticatedRequest<any>(`/v1/roles/${roleName}`, {
        method: 'DELETE'
      })
    },
    onSuccess: (_, roleName) => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      // Log successful role deletion
      ErrorLogger.logUserAction('delete_role_success', {
        roleName,
        timestamp: new Date().toISOString()
      })
    },
    errorContext: { component: 'RoleManagement', action: 'delete_role' },
    successMessage: 'Role deleted successfully'
  })

  const applyTemplateMutation = useMutationWithError({
    mutationFn: async ({ templateId, roleName }: { templateId: string; roleName: string }) => {
      return await makeAuthenticatedRequest<any>(`/v1/roles/${roleName}/templates/${templateId}`, {
        method: 'POST'
      })
    },
    onSuccess: (_, { templateId, roleName }) => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      // Log successful template application
      ErrorLogger.logUserAction('apply_template_success', {
        templateId,
        roleName,
        timestamp: new Date().toISOString()
      })
    },
    errorContext: { component: 'RoleManagement', action: 'apply_template' },
    successMessage: 'Template applied successfully'
  })

  // Optimized search filtering with improved performance
  const filteredRoles = React.useMemo(() => {
    if (!debouncedSearchQuery.trim()) return roles

    const query = debouncedSearchQuery.toLowerCase()

    // Pre-compute common search patterns for better performance
    const searchTerms = query.split(' ').filter(term => term.length > 0)

    return roles.filter(role => {
      // Check if role name matches any search term
      const nameMatch = searchTerms.some(term => role.name.toLowerCase().includes(term))

      // Check if description matches any search term
      const descriptionMatch = role.description &&
        searchTerms.some(term => role.description!.toLowerCase().includes(term))

      // Check if permissions match any search term (optimized)
      let permissionsMatch = false
      if (searchTerms.length === 1) {
        // Single term - use simple includes for better performance
        permissionsMatch = role.permissions.some(permission =>
          permission.toLowerCase().includes(query)
        )
      } else {
        // Multiple terms - check each permission against all terms
        permissionsMatch = role.permissions.some(permission =>
          searchTerms.every(term => permission.toLowerCase().includes(term))
        )
      }

      return nameMatch || descriptionMatch || permissionsMatch
    })
  }, [roles, debouncedSearchQuery])

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

  // Quick action handlers
  const handleQuickCreateRole = () => {
    setIsCreateDialogOpen(true)
  }

  const handleExportRoles = async () => {
    try {
      const exportData = {
        roles: roles,
        statistics: roleStatistics,
        exported_at: new Date().toISOString(),
        total_count: roles.length
      }

      const dataStr = JSON.stringify(exportData, null, 2)
      const dataBlob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(dataBlob)

      const link = document.createElement('a')
      link.href = url
      link.download = `roles-export-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      // Log successful export
      ErrorLogger.logUserAction('export_roles_success', {
        roleCount: roles.length,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      console.error('Error exporting roles:', error)
      ErrorLogger.logError('export_roles_failed', error)
    }
  }

  const handleImportRoles = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'

    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        const text = await file.text()
        const importData = JSON.parse(text)

        // Validate import data structure
        if (!importData.roles || !Array.isArray(importData.roles)) {
          throw new Error('Invalid import data format')
        }

        // Process imported roles
        for (const role of importData.roles) {
          try {
            await createRoleMutation.mutateAsync({
              name: role.name,
              description: role.description || '',
              permissions: role.permissions || [],
              permission_templates: role.permission_templates || [],
              inherited_roles: role.inherited_roles || [],
              inheritance_type: role.inheritance_type || 'none'
            })
          } catch (error) {
            console.error(`Error importing role ${role.name}:`, error)
          }
        }

        // Log successful import
        ErrorLogger.logUserAction('import_roles_success', {
          importedCount: importData.roles.length,
          fileName: file.name,
          timestamp: new Date().toISOString()
        })
      } catch (error) {
        console.error('Error importing roles:', error)
        ErrorLogger.logError('import_roles_failed', error)
      }
    }

    input.click()
  }

  // Loading state for the entire component
  if (rolesLoading || templatesLoading || permissionsLoading) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-end mb-6">
          <div className={cn(
            "h-12 w-40 rounded-lg animate-pulse",
            "bg-gradient-to-r from-blue-400 to-purple-400",
            "shadow-lg"
          )} />
        </div>

        {/* Search section */}
        <div className={cn(
          "border-0 shadow-lg overflow-hidden animate-pulse",
          "bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700",
          "rounded-xl p-6"
        )}>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 rounded-lg bg-gray-300 dark:bg-gray-600 animate-pulse" />
              <div className="h-7 w-32 rounded-lg bg-gray-300 dark:bg-gray-600 animate-pulse" />
            </div>
            <div className="flex gap-4">
              <div className="h-12 w-80 rounded-lg bg-gray-300 dark:bg-gray-600 animate-pulse" />
              <div className="h-8 w-24 rounded-full bg-gray-300 dark:bg-gray-600 animate-pulse" />
            </div>
          </div>
        </div>

        {/* Role cards grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(6)].map((_, index) => (
            <div
              key={index}
              className={cn(
                "border-0 shadow-lg overflow-hidden animate-pulse",
                "bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700",
                "rounded-xl h-64"
              )}
            >
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-gray-300 dark:bg-gray-600 animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-6 w-3/4 rounded-lg bg-gray-300 dark:bg-gray-600 animate-pulse" />
                    <div className="h-4 w-full rounded-lg bg-gray-300 dark:bg-gray-600 animate-pulse" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="h-6 w-16 rounded-full bg-gray-300 dark:bg-gray-600 animate-pulse" />
                  <div className="h-6 w-20 rounded-full bg-gray-300 dark:bg-gray-600 animate-pulse" />
                  <div className="h-6 w-24 rounded-full bg-gray-300 dark:bg-gray-600 animate-pulse" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-1/2 rounded-lg bg-gray-300 dark:bg-gray-600 animate-pulse" />
                  <div className="flex gap-1">
                    <div className="h-5 w-16 rounded-lg bg-gray-300 dark:bg-gray-600 animate-pulse" />
                    <div className="h-5 w-20 rounded-lg bg-gray-300 dark:bg-gray-600 animate-pulse" />
                    <div className="h-5 w-14 rounded-lg bg-gray-300 dark:bg-gray-600 animate-pulse" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 min-h-screen p-4 sm:p-6 md:p-8 lg:p-10 xl:p-12">
      {/* Accessibility: Skip to main content link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-500 focus:text-white focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        Skip to main content
      </a>

  
      <main id="main-content">
      {/* Statistics Dashboard */}
      <div className="space-y-6 mb-8" role="region" aria-label="Role Management Statistics">
        {/* Key Metrics Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <MetricCard
            title="Total Roles"
            value={roleStatistics.total_roles}
            icon={Users}
            description="All roles in system"
          />
          <MetricCard
            title="Active Roles"
            value={roleStatistics.active_roles}
            icon={Activity}
            description="Currently enabled"
            trend="up"
            trendValue="+12%"
          />
          <MetricCard
            title="System Roles"
            value={roleStatistics.system_roles}
            icon={Crown}
            description="Built-in roles"
          />
          <MetricCard
            title="Custom Roles"
            value={roleStatistics.custom_roles}
            icon={UserCheck}
            description="User-created roles"
          />
          <MetricCard
            title="Avg Permissions"
            value={roleStatistics.average_permissions}
            icon={KeyRound}
            description="Per role average"
          />
        </div>

        {/* Charts and Insights Row */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Role Distribution Chart */}
          <Card className={cn(
            "overflow-hidden lg:col-span-1",
            "border-0 shadow-lg",
            "bg-gradient-to-br from-white via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800"
          )}>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                <PieChart className="h-5 w-5" aria-hidden="true" />
                Role Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="h-64" role="img" aria-label="Role distribution pie chart">
                {roleStatistics.role_type_distribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={roleStatistics.role_type_distribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="count"
                      >
                        {roleStatistics.role_type_distribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          border: '1px solid #e5e7eb',
                          borderRadius: '0.5rem',
                          backdropFilter: 'blur(4px)'
                        }}
                      />
                      <Legend />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center">
                      <PieChart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No data available</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Permission Levels Chart */}
          <Card className={cn(
            "overflow-hidden lg:col-span-1",
            "border-0 shadow-lg",
            "bg-gradient-to-br from-white via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800"
          )}>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                <BarChart3 className="h-5 w-5" aria-hidden="true" />
                Permission Levels
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="h-64" role="img" aria-label="Permission levels bar chart">
                {roleStatistics.permission_distribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={roleStatistics.permission_distribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="level" stroke="#6b7280" />
                      <YAxis stroke="#6b7280" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          border: '1px solid #e5e7eb',
                          borderRadius: '0.5rem',
                          backdropFilter: 'blur(4px)'
                        }}
                      />
                      <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center">
                      <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No data available</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Security Insights */}
          <Card className={cn(
            "overflow-hidden lg:col-span-1",
            "border-0 shadow-lg",
            "bg-gradient-to-br from-white via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800"
          )}>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                Security Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {roleStatistics.security_insights.length > 0 ? (
                roleStatistics.security_insights.map((insight, index) => (
                  <SecurityInsightCard key={index} insight={insight} />
                ))
              ) : (
                <div className="flex items-center justify-center h-32 text-gray-500">
                  <div className="text-center">
                    <ShieldCheck className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No insights available</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Activity and System Health Row */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Recent Activity Chart */}
          <Card className={cn(
            "overflow-hidden lg:col-span-2",
            "border-0 shadow-lg",
            "bg-gradient-to-br from-white via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800"
          )}>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                <TrendingUp className="h-5 w-5" aria-hidden="true" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="h-64" role="img" aria-label="Recent activity area chart">
                {roleStatistics.recent_activity.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={roleStatistics.recent_activity}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" stroke="#6b7280" />
                      <YAxis stroke="#6b7280" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          border: '1px solid #e5e7eb',
                          borderRadius: '0.5rem',
                          backdropFilter: 'blur(4px)'
                        }}
                      />
                      <Area type="monotone" dataKey="created" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.6} />
                      <Area type="monotone" dataKey="modified" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                      <Area type="monotone" dataKey="deleted" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} />
                      <Legend />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center">
                      <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No activity data available</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* System Health and Quick Actions */}
          <div className="space-y-6">
            <SystemHealthIndicator health={systemHealth} />
            <QuickActionsCard
              onCreateRole={handleQuickCreateRole}
              onExport={handleExportRoles}
              onImport={handleImportRoles}
            />
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex justify-end mb-6">
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button
              className={cn(
                "siri-button gap-2 px-6 py-3 text-base font-semibold",
                "shadow-lg hover:shadow-xl transform hover:scale-105",
                "transition-all duration-200"
              )}
            >
              <Plus className="h-5 w-5" />
              Create New Role
            </Button>
          </DialogTrigger>
          <DialogContent className={cn(
            "max-w-4xl max-h-[90vh] overflow-y-auto",
            "border-0 shadow-2xl",
            "bg-gradient-to-br from-white via-white to-gray-50",
            "dark:from-gray-900 dark:via-gray-900 dark:to-gray-800"
          )}>
            <DialogHeader className="pb-6 border-b border-gray-200 dark:border-gray-700">
              <DialogTitle className={cn(
                "text-2xl font-bold flex items-center gap-3",
                "bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"
              )}>
                <div className="p-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                  <Plus className="h-6 w-6" />
                </div>
                Create New Role
              </DialogTitle>
              <DialogDescription className="text-base text-gray-600 dark:text-gray-300 mt-2">
                Define a new role with specific permissions and inheritance settings
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateRole} className="space-y-6 p-2">
              <div className="space-y-3">
                <Label htmlFor="name" className="text-base font-semibold text-gray-700 dark:text-gray-300">
                  Role Name *
                </Label>
                <Input
                  id="name"
                  value={createFormData.name}
                  onChange={(e) => setCreateFormData({...createFormData, name: e.target.value})}
                  placeholder="e.g., project_admin, content_manager"
                  required
                  className={cn(
                    "h-12 text-base",
                    "border-2 border-gray-200 dark:border-gray-700",
                    "focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20",
                    "hover:border-gray-300 dark:hover:border-gray-600",
                    "transition-all duration-200"
                  )}
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="description" className="text-base font-semibold text-gray-700 dark:text-gray-300">
                  Description
                </Label>
                <Textarea
                  id="description"
                  value={createFormData.description}
                  onChange={(e) => setCreateFormData({...createFormData, description: e.target.value})}
                  placeholder="Describe the purpose and responsibilities of this role"
                  className={cn(
                    "min-h-[100px] text-base",
                    "border-2 border-gray-200 dark:border-gray-700",
                    "focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20",
                    "hover:border-gray-300 dark:hover:border-gray-600",
                    "transition-all duration-200 resize-none"
                  )}
                />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold text-gray-700 dark:text-gray-300">
                    Copy from Existing Role
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTemplateRole(!showTemplateRole)}
                    className={cn(
                      "gap-2 px-4 py-2",
                      "border-2 border-gray-200 dark:border-gray-700",
                      "hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20",
                      "transition-all duration-200"
                    )}
                  >
                    <Copy className="h-4 w-4" />
                    {showTemplateRole ? 'Hide' : 'Show'} Templates
                  </Button>
                </div>
                {showTemplateRole && (
                  <div className={cn(
                    "p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600",
                    "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20"
                  )}>
                    <Select value={selectedTemplateRole} onValueChange={handleTemplateRoleChange}>
                      <SelectTrigger className={cn(
                        "h-12 border-2 border-gray-200 dark:border-gray-700",
                        "focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20",
                        "hover:border-gray-300 dark:hover:border-gray-600",
                        "transition-all duration-200"
                      )}>
                        <SelectValue placeholder="Select a role to copy permissions from" />
                      </SelectTrigger>
                      <SelectContent className={cn(
                        "border-0 shadow-xl",
                        "bg-white/95 backdrop-blur-md dark:bg-gray-900/95"
                      )}>
                        {roles.filter(role => role.is_active).map((role) => (
                          <SelectItem
                            key={role.name}
                            value={role.name}
                            className="hover:bg-gray-100 dark:hover:bg-gray-800"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-1 rounded bg-blue-100 dark:bg-blue-900/20">
                                <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div className="flex-1">
                                <div className="font-medium">{role.name}</div>
                                <div className="text-xs text-gray-500">
                                  {role.permissions.length} permissions
                                </div>
                              </div>
                              {role.is_system && (
                                <Crown className="h-4 w-4 text-amber-500" />
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedTemplateRole && (
                      <div className="mt-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
                            <Check className="h-4 w-4" />
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
                            className={cn(
                              "h-8 text-red-600 border-red-200 dark:border-red-800",
                              "hover:bg-red-50 dark:hover:bg-red-900/20",
                              "transition-all duration-200"
                            )}
                          >
                            <X className="h-3 w-3 mr-1" />
                            Clear
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <Label className="text-base font-semibold text-gray-700 dark:text-gray-300">
                      Permissions ({createFormData.permissions.length}/{availablePermissions.length} selected)
                    </Label>
                    {selectedTemplateRole && (
                      <Badge variant="secondary" className={cn(
                        "text-xs border-0",
                        "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                      )}>
                        <Copy className="h-3 w-3 mr-1" />
                        Copied from {selectedTemplateRole}
                      </Badge>
                    )}
                  </div>
                  <Input
                    placeholder="Search permissions..."
                    value={createPermissionSearchQuery}
                    onChange={(e) => setCreatePermissionSearchQuery(e.target.value)}
                    className={cn(
                      "max-w-xs h-10",
                      "border-2 border-gray-200 dark:border-gray-700",
                      "focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20",
                      "hover:border-gray-300 dark:hover:border-gray-600",
                      "transition-all duration-200"
                    )}
                  />
                </div>
                <div className={cn(
                  "border-2 border-gray-200 dark:border-gray-700 rounded-xl p-4 max-h-96 overflow-y-auto",
                  "bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900",
                  "shadow-inner"
                )}>
                  {permissionsLoading ? (
                    <PermissionListSkeleton itemCount={8} showHeader={false} />
                  ) : availablePermissions && availablePermissions.length > 0 ? (
                    <div className="space-y-2">
                      {availablePermissions
                        .filter(permission =>
                          permission.name.toLowerCase().includes(createPermissionSearchQuery.toLowerCase()) ||
                          permission.description.toLowerCase().includes(createPermissionSearchQuery.toLowerCase())
                        )
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((permission) => (
                          <div
                            key={permission.name}
                            className={cn(
                              "flex items-start space-x-4 p-4 rounded-lg",
                              "hover:bg-blue-50 dark:hover:bg-blue-900/20",
                              "transition-all duration-200 cursor-pointer",
                              createFormData.permissions.includes(permission.name)
                                ? "bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800"
                                : "border border-gray-200 dark:border-gray-700"
                            )}
                            onClick={() => {
                              const currentPermissions = createFormData.permissions;
                              const updatedPermissions = currentPermissions.includes(permission.name)
                                ? currentPermissions.filter(p => p !== permission.name)
                                : [...currentPermissions, permission.name];
                              setCreateFormData({...createFormData, permissions: updatedPermissions});
                            }}
                          >
                            <Checkbox
                              checked={createFormData.permissions.includes(permission.name)}
                              onCheckedChange={(checked) => {
                                const currentPermissions = createFormData.permissions;
                                const updatedPermissions = checked
                                  ? [...currentPermissions, permission.name]
                                  : currentPermissions.filter(p => p !== permission.name);
                                setCreateFormData({...createFormData, permissions: updatedPermissions});
                              }}
                              className={cn(
                                "mt-1 border-2",
                                createFormData.permissions.includes(permission.name)
                                  ? "border-blue-500 bg-blue-500"
                                  : "border-gray-300 dark:border-gray-600"
                              )}
                            />
                            <div className="flex-1 min-w-0">
                              <div className={cn(
                                "font-medium truncate",
                                createFormData.permissions.includes(permission.name)
                                  ? "text-blue-700 dark:text-blue-300"
                                  : "text-gray-900 dark:text-gray-100"
                              )}>
                                {permission.name}
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                                {permission.description}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <Lock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">No available permissions</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-base font-semibold text-gray-700 dark:text-gray-300">
                  Inheritance Type
                </Label>
                <Select
                  value={createFormData.inheritance_type}
                  onValueChange={(value) => setCreateFormData({...createFormData, inheritance_type: value})}
                >
                  <SelectTrigger className={cn(
                    "h-12 border-2 border-gray-200 dark:border-gray-700",
                    "focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20",
                    "hover:border-gray-300 dark:hover:border-gray-600",
                    "transition-all duration-200"
                  )}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={cn(
                    "border-0 shadow-xl",
                    "bg-white/95 backdrop-blur-md dark:bg-gray-900/95"
                  )}>
                    <SelectItem
                      value="none"
                      className="hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      <div className="flex items-center gap-3">
                        <Circle className="h-4 w-4 text-gray-500" />
                        No Inheritance
                      </div>
                    </SelectItem>
                    <SelectItem
                      value="hierarchical"
                      className="hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      <div className="flex items-center gap-3">
                        <Layers className="h-4 w-4 text-blue-500" />
                        Hierarchical Inheritance
                      </div>
                    </SelectItem>
                    <SelectItem
                      value="conditional"
                      className="hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      <div className="flex items-center gap-3">
                        <Zap className="h-4 w-4 text-purple-500" />
                        Conditional Inheritance
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter className="pt-6 border-t border-gray-200 dark:border-gray-700">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                  className={cn(
                    "px-6 py-3 text-base font-semibold",
                    "border-2 border-gray-200 dark:border-gray-700",
                    "hover:bg-gray-100 dark:hover:bg-gray-800",
                    "transition-all duration-200"
                  )}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className={cn(
                    "siri-button px-6 py-3 text-base font-semibold gap-2",
                    "shadow-lg hover:shadow-xl transform hover:scale-105",
                    "transition-all duration-200"
                  )}
                >
                  <Shield className="h-5 w-5" />
                  Create Role
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search section */}
      <Card className={cn(
        "border-0 shadow-lg overflow-hidden",
        "bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800",
        "hover:shadow-xl transition-all duration-300"
      )}>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            <div className="p-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white">
              <Search className="h-5 w-5" />
            </div>
            Search & Filter Roles
          </CardTitle>
          <CardDescription className="text-base text-gray-600 dark:text-gray-300">
            Find roles by name, description, or permissions with intelligent search
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative space-y-6 p-2">
            {/* Enhanced Search Input */}
            <div className="relative group">
              <div className="relative flex items-center">
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors">
                  <SearchIcon className="h-5 w-5" />
                </div>
                <Input
                  placeholder="Search roles by name, description, or permissions..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  className={cn(
                    "pl-12 pr-12 h-12 text-base",
                    "border-2 border-gray-200 dark:border-gray-700",
                    "focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20",
                    "hover:border-gray-300 dark:hover:border-gray-600",
                    "transition-all duration-200 bg-white/80 backdrop-blur-sm",
                    "placeholder:text-gray-400"
                  )}
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "absolute right-2 h-8 w-8",
                      "text-gray-400 hover:text-red-500",
                      "hover:bg-red-50 dark:hover:bg-red-900/20",
                      "transition-all duration-200"
                    )}
                    onClick={clearSearch}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
                {isDebouncing && (
                  <div className="absolute right-12 top-1/2 transform -translate-y-1/2">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                  </div>
                )}
              </div>

              {/* Search Suggestions Dropdown */}
              {showSuggestions && searchSuggestions.length > 0 && (
                <div className={cn(
                  "absolute top-full left-0 right-0 z-50 mt-2",
                  "rounded-xl border border-gray-200 dark:border-gray-700",
                  "bg-white/95 backdrop-blur-md shadow-2xl",
                  "animate-in fade-in-0 zoom-in-95 duration-200"
                )}>
                  <div className="max-h-80 overflow-y-auto">
                    <div className="p-2 space-y-2">
                      {searchSuggestions.length === 0 && (
                        <div className="py-4 text-center text-gray-500">
                          No suggestions found.
                        </div>
                      )}
                      {searchHistory.length > 0 && !searchQuery && (
                        <>
                          <div className="py-2">
                            <div className="text-xs font-semibold text-gray-500 mb-2 px-2">Recent Searches</div>
                            {searchHistory.slice(0, 5).map((item, index) => (
                              <div
                                key={`history-${index}`}
                                onClick={() => {
                                  selectFromHistory(item)
                                  setShowSuggestions(false)
                                }}
                                className={cn(
                                  "flex items-center justify-between px-3 py-2 rounded-lg",
                                  "hover:bg-gray-100 dark:hover:bg-gray-800",
                                  "transition-colors cursor-pointer"
                                )}
                              >
                                <div className="flex items-center gap-3">
                                  <div className="p-1 rounded bg-gray-100 dark:bg-gray-800">
                                    <Clock className="h-4 w-4 text-gray-500" />
                                  </div>
                                  <span className="font-medium">{item}</span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={cn(
                                    "h-6 w-6 text-gray-400 hover:text-red-500",
                                    "hover:bg-red-50 dark:hover:bg-red-900/20"
                                  )}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    removeFromHistory(item)
                                  }}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                          <div className="border-t border-gray-200 dark:border-gray-700 my-2" />
                        </>
                      )}
                      <div className="py-2">
                        <div className="text-xs font-semibold text-gray-500 mb-2 px-2">
                          {searchQuery ? "Suggestions" : "Quick Access"}
                        </div>
                        {searchSuggestions.slice(0, 8).map((suggestion, index) => (
                          <div
                            key={`suggestion-${index}`}
                            onClick={() => {
                              handleSearchChange(suggestion)
                              setShowSuggestions(false)
                            }}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2 rounded-lg",
                              "hover:bg-gray-100 dark:hover:bg-gray-800",
                              "transition-colors cursor-pointer"
                            )}
                          >
                            <div className="p-1 rounded bg-blue-100 dark:bg-blue-900/20">
                              <SearchIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            <span className="font-medium truncate">{suggestion}</span>
                          </div>
                        ))}
                      </div>
                      {searchHistory.length > 0 && (
                        <>
                          <div className="border-t border-gray-200 dark:border-gray-700 my-2" />
                          <div className="py-2">
                            <div
                              onClick={() => {
                                clearHistory()
                                setShowSuggestions(false)
                              }}
                              className={cn(
                                "flex items-center gap-3 px-3 py-2 rounded-lg text-gray-500",
                                "hover:bg-gray-100 dark:hover:bg-gray-800",
                                "transition-colors cursor-pointer"
                              )}
                            >
                              <div className="p-1 rounded bg-gray-100 dark:bg-gray-800">
                                <Circle className="h-4 w-4" />
                              </div>
                              Clear search history
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Search Status and Filters */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex flex-wrap items-center gap-3">
                <div className={cn(
                  "inline-flex items-center gap-2 px-4 py-2 rounded-full",
                  "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20",
                  "border border-blue-200 dark:border-blue-800",
                  "shadow-sm"
                )}>
                  <div className="p-1.5 rounded-full bg-blue-500 text-white">
                    <Users className="h-4 w-4" />
                  </div>
                  <span className="font-semibold text-blue-700 dark:text-blue-300">
                    {filteredRoles.length} {filteredRoles.length === 1 ? 'role' : 'roles'}
                  </span>
                </div>

                {searchQuery && (
                  <Badge variant="secondary" className={cn(
                    "inline-flex items-center gap-1 px-3 py-1 rounded-full",
                    "bg-purple-100 dark:bg-purple-900/20",
                    "text-purple-700 dark:text-purple-300",
                    "border border-purple-200 dark:border-purple-700"
                  )}>
                    <SearchIcon className="h-3 w-3" />
                    "{searchQuery}"
                  </Badge>
                )}

                {isDebouncing && (
                  <Badge variant="outline" className={cn(
                    "inline-flex items-center gap-1 px-3 py-1 rounded-full",
                    "animate-pulse",
                    "border-blue-300 dark:border-blue-600",
                    "text-blue-600 dark:text-blue-400"
                  )}>
                    <div className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                    Searching...
                  </Badge>
                )}
              </div>

              {searchQuery && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSearch}
                  className={cn(
                    "text-gray-600 dark:text-gray-400",
                    "hover:text-gray-900 dark:hover:text-gray-100",
                    "hover:bg-gray-100 dark:hover:bg-gray-800",
                    "transition-all duration-200"
                  )}
                >
                  Clear search
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Roles Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredRoles.map((role) => (
          <Card
            key={role.name}
            className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border-2 hover:border-primary/20 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/60"></div>
            <CardHeader className="pb-4 relative">
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-lg bg-gradient-to-r from-violet-500 to-purple-500 text-white transition-all hover:shadow-md">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-lg font-semibold truncate group-hover:text-primary">
                        {role.name}
                      </CardTitle>
                    </div>
                  </div>
                  <CardDescription className="text-sm">
                    {role.description || 'No description provided'}
                  </CardDescription>
                </div>

                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleEditRole(role)}
                      disabled={role.is_system}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDeleteRole(role.name)}
                      disabled={role.is_system}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-3">
                <Badge variant="outline" className="text-xs">
                  {role.permissions.length} permissions
                </Badge>
                {role.is_system && (
                  <Badge variant="secondary" className="text-xs">
                    System
                  </Badge>
                )}
                {!role.is_active && (
                  <Badge variant="destructive" className="text-xs">
                    Inactive
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              <div className="space-y-4">
                {/* Description */}
                {role.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {role.description}
                  </p>
                )}

                
                {/* Meta Info */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{formatDistanceToNow(new Date(role.created_at), { addSuffix: true })}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Key className="h-3 w-3" />
                    <span>{role.permissions.length} permissions</span>
                  </div>
                </div>

                {/* Action Button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => handleEditRole(role)}
                >
                  View Details
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Role Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className={cn(
          "max-w-4xl max-h-[90vh] overflow-y-auto",
          "border-0 shadow-2xl",
          "bg-gradient-to-br from-white via-white to-gray-50",
          "dark:from-gray-900 dark:via-gray-900 dark:to-gray-800"
        )}>
          <DialogHeader className="pb-6 border-b border-gray-200 dark:border-gray-700">
            <DialogTitle className={cn(
              "text-2xl font-bold flex items-center gap-3",
              "bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"
            )}>
              <div className="p-3 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 text-white">
                <Edit className="h-6 w-6" />
              </div>
              Edit Role: {editingRole?.name}
            </DialogTitle>
            <DialogDescription className="text-base text-gray-600 dark:text-gray-300 mt-2">
              Update role settings and permissions
            </DialogDescription>
          </DialogHeader>
          {editingRole && (
            <form onSubmit={handleUpdateRole} className="space-y-6 p-2">
              <div className="space-y-3">
                <Label htmlFor="edit-description" className="text-base font-semibold text-gray-700 dark:text-gray-300">
                  Description
                </Label>
                <Textarea
                  id="edit-description"
                  value={editingRole.description || ''}
                  onChange={(e) => setEditingRole({...editingRole, description: e.target.value})}
                  placeholder="Describe the purpose and responsibilities of this role"
                  className={cn(
                    "min-h-[100px] text-base",
                    "border-2 border-gray-200 dark:border-gray-700",
                    "focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20",
                    "hover:border-gray-300 dark:hover:border-gray-600",
                    "transition-all duration-200 resize-none"
                  )}
                />
              </div>

              <Tabs defaultValue="permissions" className="w-full">
                <TabsList className={cn(
                  "grid w-full grid-cols-3 h-12 p-1",
                  "bg-gray-100 dark:bg-gray-800 rounded-lg",
                  "border border-gray-200 dark:border-gray-700"
                )}>
                  <TabsTrigger
                    value="permissions"
                    className={cn(
                      "h-10 rounded-md text-sm font-semibold",
                      "data-[state=active]:bg-white dark:data-[state=active]:bg-gray-900",
                      "data-[state=active]:shadow-sm",
                      "data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400",
                      "transition-all duration-200"
                    )}
                  >
                    <Key className="h-4 w-4 mr-2" />
                    Permissions
                  </TabsTrigger>
                  <TabsTrigger
                    value="templates"
                    className={cn(
                      "h-10 rounded-md text-sm font-semibold",
                      "data-[state=active]:bg-white dark:data-[state=active]:bg-gray-900",
                      "data-[state=active]:shadow-sm",
                      "data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400",
                      "transition-all duration-200"
                    )}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Templates
                  </TabsTrigger>
                  <TabsTrigger
                    value="inheritance"
                    className={cn(
                      "h-10 rounded-md text-sm font-semibold",
                      "data-[state=active]:bg-white dark:data-[state=active]:bg-gray-900",
                      "data-[state=active]:shadow-sm",
                      "data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400",
                      "transition-all duration-200"
                    )}
                  >
                    <GitBranch className="h-4 w-4 mr-2" />
                    Inheritance
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="permissions" className="space-y-4 mt-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <Label className="text-base font-semibold text-gray-700 dark:text-gray-300">
                        Permissions ({editingRole.permissions.length}/{availablePermissions.length} selected)
                      </Label>
                      <Input
                        placeholder="Search permissions..."
                        value={permissionSearchQuery}
                        onChange={(e) => setPermissionSearchQuery(e.target.value)}
                        className={cn(
                          "max-w-xs h-10",
                          "border-2 border-gray-200 dark:border-gray-700",
                          "focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20",
                          "hover:border-gray-300 dark:hover:border-gray-600",
                          "transition-all duration-200"
                        )}
                      />
                    </div>
                    <div className={cn(
                      "border-2 border-gray-200 dark:border-gray-700 rounded-xl p-4 max-h-96 overflow-y-auto",
                      "bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900",
                      "shadow-inner"
                    )}>
                      {permissionsLoading ? (
                        <PermissionListSkeleton itemCount={8} showHeader={false} />
                      ) : availablePermissions && availablePermissions.length > 0 ? (
                        <div className="space-y-2">
                          {availablePermissions
                            .filter(permission =>
                              permission.name.toLowerCase().includes(permissionSearchQuery.toLowerCase()) ||
                              permission.description.toLowerCase().includes(permissionSearchQuery.toLowerCase())
                            )
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((permission) => (
                              <div
                                key={permission.name}
                                className={cn(
                                  "flex items-start space-x-4 p-4 rounded-lg",
                                  "hover:bg-blue-50 dark:hover:bg-blue-900/20",
                                  "transition-all duration-200 cursor-pointer",
                                  editingRole.permissions.includes(permission.name)
                                    ? "bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800"
                                    : "border border-gray-200 dark:border-gray-700"
                                )}
                                onClick={() => {
                                  const updatedPermissions = editingRole.permissions.includes(permission.name)
                                    ? editingRole.permissions.filter(p => p !== permission.name)
                                    : [...editingRole.permissions, permission.name];
                                  setEditingRole({...editingRole, permissions: updatedPermissions});
                                }}
                              >
                                <Checkbox
                                  checked={editingRole.permissions.includes(permission.name)}
                                  onCheckedChange={(checked) => {
                                    const updatedPermissions = checked
                                      ? [...editingRole.permissions, permission.name]
                                      : editingRole.permissions.filter(p => p !== permission.name);
                                    setEditingRole({...editingRole, permissions: updatedPermissions});
                                  }}
                                  className={cn(
                                    "mt-1 border-2",
                                    editingRole.permissions.includes(permission.name)
                                      ? "border-blue-500 bg-blue-500"
                                      : "border-gray-300 dark:border-gray-600"
                                  )}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className={cn(
                                    "font-medium truncate",
                                    editingRole.permissions.includes(permission.name)
                                      ? "text-blue-700 dark:text-blue-300"
                                      : "text-gray-900 dark:text-gray-100"
                                  )}>
                                    {permission.name}
                                  </div>
                                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                                    {permission.description}
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                          <Lock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                          <p className="text-sm">No available permissions</p>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="templates" className="space-y-4 mt-4">
                  <div className="space-y-3">
                    <Label className="text-base font-semibold text-gray-700 dark:text-gray-300">
                      Applied Templates
                    </Label>
                    <div className={cn(
                      "border-2 border-gray-200 dark:border-gray-700 rounded-xl p-4 max-h-48 overflow-y-auto",
                      "bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900",
                      "shadow-inner"
                    )}>
                      {editingRole.permission_templates && editingRole.permission_templates.length > 0 ? (
                        <div className="space-y-3">
                          {editingRole.permission_templates.map((templateId) => (
                            <div
                              key={templateId}
                              className={cn(
                                "flex items-center justify-between p-4 rounded-lg",
                                "bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20",
                                "border border-purple-200 dark:border-purple-800",
                                "hover:from-purple-100 hover:to-pink-100 dark:hover:from-purple-900/30 dark:hover:to-pink-900/30",
                                "transition-all duration-200"
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/20">
                                  <Settings className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                </div>
                                <div className="font-medium text-purple-700 dark:text-purple-300">
                                  {templateId}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className={cn(
                                  "h-8 text-red-600 border-red-200 dark:border-red-800",
                                  "hover:bg-red-50 dark:hover:bg-red-900/20",
                                  "transition-all duration-200"
                                )}
                              >
                                Remove
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                          <Settings className="h-12 w-12 mx-auto mb-3 opacity-50" />
                          <p className="text-sm">No templates applied</p>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="inheritance" className="space-y-4 mt-4">
                  <div className="space-y-3">
                    <Label className="text-base font-semibold text-gray-700 dark:text-gray-300">
                      Inherited Roles
                    </Label>
                    <div className={cn(
                      "border-2 border-gray-200 dark:border-gray-700 rounded-xl p-4 max-h-48 overflow-y-auto",
                      "bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900",
                      "shadow-inner"
                    )}>
                      {editingRole.inherited_roles && editingRole.inherited_roles.length > 0 ? (
                        <div className="space-y-3">
                          {editingRole.inherited_roles.map((parentRole) => (
                            <div
                              key={parentRole}
                              className={cn(
                                "flex items-center justify-between p-4 rounded-lg",
                                "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20",
                                "border border-blue-200 dark:border-blue-800",
                                "hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-900/30 dark:hover:to-indigo-900/30",
                                "transition-all duration-200"
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                                  <GitBranch className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div className="font-medium text-blue-700 dark:text-blue-300">
                                  {parentRole}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className={cn(
                                  "h-8 text-red-600 border-red-200 dark:border-red-800",
                                  "hover:bg-red-50 dark:hover:bg-red-900/20",
                                  "transition-all duration-200"
                                )}
                              >
                                Remove
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                          <GitBranch className="h-12 w-12 mx-auto mb-3 opacity-50" />
                          <p className="text-sm">No inherited roles</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-base font-semibold text-gray-700 dark:text-gray-300">
                      Inheritance Type
                    </Label>
                    <Select
                      value={editingRole.inheritance_type || 'none'}
                      onValueChange={(value) => setEditingRole({...editingRole, inheritance_type: value})}
                    >
                      <SelectTrigger className={cn(
                        "h-12 border-2 border-gray-200 dark:border-gray-700",
                        "focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20",
                        "hover:border-gray-300 dark:hover:border-gray-600",
                        "transition-all duration-200"
                      )}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className={cn(
                        "border-0 shadow-xl",
                        "bg-white/95 backdrop-blur-md dark:bg-gray-900/95"
                      )}>
                        <SelectItem
                          value="none"
                          className="hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                          <div className="flex items-center gap-3">
                            <Circle className="h-4 w-4 text-gray-500" />
                            No Inheritance
                          </div>
                        </SelectItem>
                        <SelectItem
                          value="hierarchical"
                          className="hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                          <div className="flex items-center gap-3">
                            <Layers className="h-4 w-4 text-blue-500" />
                            Hierarchical Inheritance
                          </div>
                        </SelectItem>
                        <SelectItem
                          value="conditional"
                          className="hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                          <div className="flex items-center gap-3">
                            <Zap className="h-4 w-4 text-purple-500" />
                            Conditional Inheritance
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>
              </Tabs>

              <DialogFooter className="pt-6 border-t border-gray-200 dark:border-gray-700">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                  className={cn(
                    "px-6 py-3 text-base font-semibold",
                    "border-2 border-gray-200 dark:border-gray-700",
                    "hover:bg-gray-100 dark:hover:bg-gray-800",
                    "transition-all duration-200"
                  )}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className={cn(
                    "siri-button px-6 py-3 text-base font-semibold gap-2",
                    "shadow-lg hover:shadow-xl transform hover:scale-105",
                    "transition-all duration-200"
                  )}
                >
                  <Shield className="h-5 w-5" />
                  Update Role
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      </main>
    </div>
  )
}