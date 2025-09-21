import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Search, User, Menu, LogOut, Settings } from 'lucide-react'
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export function Header() {
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [avatarError, setAvatarError] = React.useState(false)
  const navigate = useNavigate()
  const { user, logout, dbUser } = useAuth()

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

  // For debugging, let's try a direct img approach
  const shouldUseDirectImg = resolvedAvatar && resolvedAvatar.includes('googleusercontent.com')

  React.useEffect(() => {
    setAvatarError(false)
  }, [resolvedAvatar])

  // Debug logging for avatar investigation
  React.useEffect(() => {
    if (import.meta.env?.DEV) {
      console.log('🔍 Header Debug:', {
        user,
        dbUser,
        resolvedAvatar,
        avatarError,
        hasUser: !!user,
        hasDbUser: !!dbUser,
        userAvatar: user?.avatar,
        dbUserAvatar: dbUser?.avatar,
        shouldUseDirectImg,
        isGoogleAvatar: resolvedAvatar?.includes('googleusercontent.com'),
        avatarSource: resolvedAvatar?.includes('githubusercontent.com') ? 'github' :
                     resolvedAvatar?.includes('googleusercontent.com') ? 'google' : 'unknown'
      })
    }
  }, [user, dbUser, resolvedAvatar, avatarError, shouldUseDirectImg])

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full p-0">
                <div className="h-8 w-8 rounded-full overflow-hidden">
                {shouldUseDirectImg && !avatarError ? (
                  <img
                    src={resolvedAvatar}
                    alt={user?.name}
                    className="h-full w-full object-cover"
                    crossOrigin="anonymous"
                    referrerPolicy="no-referrer"
                    onError={() => {
                      console.log('Direct img error:', resolvedAvatar)
                      setAvatarError(true)
                    }}
                    onLoad={() => {
                      console.log('Direct img loaded successfully:', resolvedAvatar)
                    }}
                  />
                ) : (
                  <Avatar className="h-full w-full">
                    <AvatarImage
                      src={avatarError ? undefined : resolvedAvatar}
                      alt={user?.name}
                      crossOrigin="anonymous"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        console.log('Header avatar image error:', resolvedAvatar)
                        console.log('Error details:', e)
                        setAvatarError(true)
                      }}
                      onLoad={() => {
                        console.log('Header avatar loaded successfully:', resolvedAvatar)
                      }}
                    />
                    <AvatarFallback className="text-xs bg-muted">
                      {user?.name.split(' ').map(n => n[0]).join('') || 'U'}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <div className="flex items-center justify-start gap-2 p-2">
                <div className="flex flex-col space-y-1 leading-none">
                  <p className="font-medium">{user?.name}</p>
                  <p className="w-[200px] truncate text-sm text-muted-foreground">
                    {user?.email}
                  </p>
                </div>
              </div>
              <DropdownMenuSeparator />
              <div onClick={() => {
                  console.log('Profile clicked, navigating to /profile');
                  window.location.href = '/profile';
                }} className="flex items-center w-full px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded-sm">
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </div>
              <div className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50" onClick={() => window.location.href = '/settings'}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <button
                  className="flex items-center w-full"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Logout clicked');
                    logout();
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </button>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile menu */}
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  )
}