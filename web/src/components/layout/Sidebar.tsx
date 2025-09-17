import React, { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
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
  Bot
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
  { name: 'Projects', href: '/projects', icon: FolderOpen },
  { name: 'Templates', href: '/templates', icon: FileText, permission: 'templates:read' },
  { name: 'Deployments', href: '/deployments', icon: Rocket, permission: 'deployments:read' },
  { name: 'Evaluations', href: '/evaluations', icon: BarChart3, permission: 'evaluations:read' },
  { name: 'Compatibility Matrix', href: '/compatibility', icon: Grid3X3, permission: 'compatibility:read' },
  { name: 'Governance', href: '/governance', icon: Shield, permission: 'audits:read' },
  { name: 'AI Assistant', href: '/assistant', icon: Bot },
  { name: 'API Keys', href: '/keys', icon: Key },
  { name: 'User Management', href: '/users', icon: Users, permission: 'users:read' },
  { name: 'Settings', href: '/settings', icon: Settings },
]

interface SidebarProps {
  className?: string
}

export function Sidebar({ className }: SidebarProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(true)
  const { user, logout, hasPermission } = useAuth()

  // Debug: Log navigation items and permissions
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('🔍 Sidebar Debug:', {
        user,
        navigationItems: navigation.map(item => ({
          name: item.name,
          permission: item.permission,
          hasPermission: item.permission ? hasPermission(item.permission) : 'N/A'
        }))
      })
    }
  }, [user, hasPermission])

  const visibleNavigation = navigation.filter(item => {
    console.log('Checking navigation item:', item.name, 'permission:', item.permission);
    if (!item.permission) return true
    try {
      const hasPerm = hasPermission(item.permission)
      console.log(`${item.name} has permission ${item.permission}:`, hasPerm);
      return hasPerm
    } catch (error) {
      console.warn(`Permission check failed for ${item.name}:`, error)
      return false
    }
  })

  console.log('Visible navigation items:', visibleNavigation.map(item => item.name));

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
              <img src="/src/assets/logo-nav.svg" alt="PromptOps Logo" className="h-10 w-10" onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                target.parentElement!.insertAdjacentHTML('afterbegin', '<span class="text-xl font-bold mr-2">PO</span>');
              }} />
              <span className="ml-2 text-xl font-semibold">PromptOps</span>
            </div>
          ) : (
            <div className="flex items-center justify-center w-full">
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
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.avatar} alt={user?.name} />
              <AvatarFallback>
                {user?.name.split(' ').map(n => n[0]).join('') || 'U'}
              </AvatarFallback>
            </Avatar>
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