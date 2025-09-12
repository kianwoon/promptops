import React from 'react'
import { NavLink } from 'react-router-dom'
import { 
  LayoutDashboard, 
  FileText, 
  Rocket, 
  BarChart3, 
  Shield, 
  Settings,
  Users,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuth, usePermission } from '@/contexts/AuthContext'

interface NavigationItem {
  name: string
  href: string
  icon: React.ComponentType<any>
  permission?: string
}

const navigation: NavigationItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Templates', href: '/templates', icon: FileText, permission: 'templates:read' },
  { name: 'Deployments', href: '/deployments', icon: Rocket, permission: 'deployments:read' },
  { name: 'Evaluations', href: '/evaluations', icon: BarChart3, permission: 'evaluations:read' },
  { name: 'Governance', href: '/governance', icon: Shield, permission: 'audits:read' },
  { name: 'User Management', href: '/users', icon: Users, permission: 'users:read' },
  { name: 'Settings', href: '/settings', icon: Settings, permission: 'settings:manage' },
]

interface SidebarProps {
  className?: string
}

export function Sidebar({ className }: SidebarProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(true)
  const { user, logout } = useAuth()

  const visibleNavigation = navigation.filter(item => {
    if (!item.permission) return true
    return usePermission(item.permission)
  })

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
            <div className="flex items-center">
              <img src="/src/assets/logo-nav.svg" alt="PromptOps Logo" className="h-10 w-10" />
              <span className="ml-2 text-xl font-semibold">PromptOps</span>
            </div>
          ) : (
            <div className="flex items-center justify-center w-full">
              <img src="/src/assets/logo-nav.svg" alt="PromptOps Logo" className="h-10 w-10" />
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
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
              <span className="text-sm font-medium">
                {user?.name.split(' ').map(n => n[0]).join('') || 'U'}
              </span>
            </div>
            {sidebarOpen && (
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}