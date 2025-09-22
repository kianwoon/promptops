import React from 'react'
import { Bell, Search, User, Menu, LogOut, Settings, Chrome, Github, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function Header() {
  const [searchOpen, setSearchOpen] = React.useState(false)
  const { user, logout, dbUser } = useAuth()

  // Get provider info with fallback to dbUser
  const getProviderInfo = () => {
    const provider = dbUser?.provider || user?.provider || 'local'
    const providerId = dbUser?.providerId || user?.providerId

    switch (provider) {
      case 'google':
        return {
          icon: <Chrome className="h-4 w-4" />,
          name: 'Google',
          email: providerId ? `${providerId.substring(0, 3)}***@gmail.com` : user?.email
        }
      case 'github':
        return {
          icon: <Github className="h-4 w-4" />,
          name: 'GitHub',
          email: providerId ? `@${providerId.substring(0, 3)}***` : user?.email
        }
      default:
        return {
          icon: <Mail className="h-4 w-4" />,
          name: 'Email',
          email: user?.email
        }
    }
  }

  const providerInfo = getProviderInfo()

  // Use the same avatar resolution logic as PublicLayout component
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

  
  return (
    <header className="bg-background border-b border-border h-16 flex items-center px-6">
      <div className="flex items-center justify-between w-full">
        {/* Search */}
        <div className={cn(
          "flex-1 max-w-md transition-all duration-300",
          searchOpen ? "opacity-100" : "opacity-0 hidden md:block md:opacity-100"
        )}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search templates, deployments..."
              className="pl-10"
            />
          </div>
        </div>

        {/* Mobile search toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setSearchOpen(!searchOpen)}
        >
          <Search className="h-5 w-5" />
        </Button>

        {/* Actions */}
        <div className="flex items-center space-x-4 ml-4">
          
          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 h-4 w-4 bg-destructive rounded-full text-xs text-destructive-foreground flex items-center justify-center">
              3
            </span>
          </Button>

          {/* User menu */}
          <div className="relative">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center space-x-2">
                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                    {resolvedAvatar ? (
                      <img
                        src={resolvedAvatar}
                        alt={user?.name}
                        className="h-8 w-8 rounded-full object-cover"
                        crossOrigin="anonymous"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          console.log('Header avatar error:', resolvedAvatar)
                        }}
                      />
                    ) : (
                      <User className="h-4 w-4 text-blue-600" />
                    )}
                  </div>
                  <div className="hidden md:block text-left">
                    <div className="text-sm font-medium">{user?.name}</div>
                    <div className="flex items-center space-x-1 text-xs text-gray-500">
                      {providerInfo.icon}
                      <span>{providerInfo.name}</span>
                    </div>
                  </div>
                </Button>
              </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5 text-sm text-gray-700">
                <div className="font-medium">{user?.name}</div>
                <div className="text-gray-500">{user?.email}</div>
                <div className="flex items-center space-x-2 mt-1 text-xs text-gray-400">
                  {providerInfo.icon}
                  <span>Signed in with {providerInfo.name}</span>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => window.location.href = '/profile'}>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.location.href = '/settings'}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>

          {/* Mobile menu */}
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  )
}