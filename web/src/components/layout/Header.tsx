import React from 'react'
import { Bell, Search, User, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function Header() {
  const [searchOpen, setSearchOpen] = React.useState(false)

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
          <Button variant="ghost" size="icon">
            <User className="h-5 w-5" />
          </Button>

          {/* Mobile menu */}
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  )
}