import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  FileText,
  Rocket,
  BarChart3,
  Shield,
  Settings,
  Users,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  Grid3X3,
  Key,
  Bot,
  UserCog,
  FileSignature,
  User
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'

interface NavigationItem {
  name: string
  href: string
  icon: React.ComponentType<any>
  permission?: string
}

const navigation: NavigationItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Projects', href: '/projects', icon: FolderOpen },
  { name: 'Templates', href: '/templates', icon: FileText, permission: 'templates:read' },
  { name: 'Deployments', href: '/deployments', icon: Rocket, permission: 'deployments:read' },
  { name: 'Evaluations', href: '/evaluations', icon: BarChart3, permission: 'evaluations:read' },
  { name: 'Compatibility Matrix', href: '/compatibility', icon: Grid3X3, permission: 'compatibility:read' },
  { name: 'Governance', href: '/governance', icon: Shield, permission: 'audits:read' },
  { name: 'AI Assistant', href: '/assistant', icon: Bot },
  { name: 'API Keys', href: '/keys', icon: Key },
  { name: 'User Management', href: '/users', icon: Users, permission: 'users:read' },
  { name: 'Role Management', href: '/roles', icon: UserCog, permission: 'roles:read' },
  { name: 'Prompt Approval Workflow', href: '/prompt-approval', icon: FileSignature },
  { name: 'Settings', href: '/settings', icon: Settings },
]

interface SidebarProps {
  className?: string
}

export function Sidebar({ className }: SidebarProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(true)
  const navigate = useNavigate()
  const { user, hasPermission, dbUser } = useAuth()

  // Use the same avatar resolution logic as Header component
  const resolvedAvatar = React.useMemo(() => {
    // Always prioritize database avatar if available
    const databaseAvatar = typeof dbUser?.avatar === 'string' ? dbUser.avatar.trim() : ''
    if (databaseAvatar) {
      return databaseAvatar
    }

    // Only fall back to auth user avatar if no database avatar
    const authAvatar = typeof user?.avatar === 'string' ? user.avatar.trim() : ''

    // Don't use Google avatar if user is authenticated with GitHub
    if (authAvatar && authAvatar.includes('googleusercontent.com') && dbUser?.provider === 'github') {
      return undefined
    }

    return authAvatar || undefined
  }, [dbUser?.avatar, user?.avatar, dbUser?.provider])

  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Sidebar Debug:', {
        user,
        dbUser,
        userRole: user?.role,
        dbUserRole: dbUser?.role,
        navigationItems: navigation.map(item => ({
          name: item.name,
          permission: item.permission,
          hasPermission: item.permission ? hasPermission(item.permission) : 'N/A'
        }))
      })
    }
  }, [user, dbUser, hasPermission])

  const visibleNavigation = navigation.filter(item => {
    console.log('Checking navigation item:', item.name, 'permission:', item.permission)
    if (!item.permission) return true
    try {
      const hasPerm = hasPermission(item.permission)
      console.log(`${item.name} has permission ${item.permission}:`, hasPerm)
      return hasPerm
    } catch (error) {
      console.warn(`Permission check failed for ${item.name}:`, error)
      return false
    }
  })

  console.log('Visible navigation items:', visibleNavigation.map(item => item.name))

  return (
    <div className={cn(
      "bg-card border-r border-border transition-all duration-300",
      sidebarOpen ? "w-64" : "w-20",
      className
    )}>
      <div className="flex h-full flex-col">
        {/* Logo and toggle */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-border">
          {sidebarOpen ? (
            <div
              className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => navigate('/')}
              title="Go to landing page"
            >
              <img src="/src/assets/logo-nav.svg" alt="PromptOps Logo" className="h-10 w-10" onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                target.parentElement!.insertAdjacentHTML('afterbegin', '<span class="text-xl font-bold mr-2">PO</span>');
              }} />
              <span className="ml-2 text-xl font-semibold">PromptOps</span>
            </div>
          ) : (
            <div
              className="flex items-center justify-center w-full cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => navigate('/')}
              title="Go to landing page"
            >
              <img src="/src/assets/logo-nav.svg" alt="PromptOps Logo" className="h-10 w-10" onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                target.parentElement!.innerHTML = '<span class="text-xl font-bold">PO</span>';
              }} />
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="h-8 w-8"
          >
            {sidebarOpen ? (
              <ChevronLeft className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {visibleNavigation.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  cn(
                    "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    !sidebarOpen && "justify-center"
                  )
                }
              >
                <Icon className={cn("h-5 w-5", sidebarOpen && "mr-3")} />
                {sidebarOpen && item.name}
              </NavLink>
            )
          })}
        </nav>

        {/* User section */}
        <div className="border-t border-border p-4">
          <div className={cn(
            "flex items-center",
            !sidebarOpen && "justify-center"
          )}>
            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
              {resolvedAvatar ? (
                <img
                  src={resolvedAvatar}
                  alt={user?.name}
                  className="h-8 w-8 rounded-full object-cover"
                  crossOrigin="anonymous"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    console.log('Sidebar avatar error:', resolvedAvatar)
                  }}
                />
              ) : (
                <User className="h-4 w-4 text-blue-600" />
              )}
            </div>
            {sidebarOpen && (
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium truncate">{dbUser?.name || user?.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{dbUser?.role || user?.role}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
