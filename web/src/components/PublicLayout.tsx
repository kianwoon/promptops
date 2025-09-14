import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Chrome, User, LogOut, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface PublicLayoutProps {
  children: React.ReactNode
  onSignInClick?: () => void
  onRegisterClick?: () => void
}

export function PublicLayout({ children, onSignInClick, onRegisterClick }: PublicLayoutProps) {
  const location = useLocation()
  const { user, isAuthenticated, logout } = useAuth()

  const navigation = [
    { name: 'Features', href: '/#features' },
    { name: 'Developer', href: '/developer' },
    { name: 'Use Cases', href: '/#use-cases' },
    { name: 'Pricing', href: '/#pricing' },
    { name: 'About', href: '/#about' },
  ]

  const isAuthPage = location.pathname === '/login' || location.pathname === '/register'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200">
        <div className="flex items-center justify-between p-6 max-w-7xl mx-auto">
          <div className="flex items-center space-x-2">
            <Link to="/" className="flex items-center space-x-2">
              <img src="/src/assets/logo-nav.svg" alt="PromptOps Logo" className="h-12 w-12" />
              <span className="text-2xl font-bold text-gray-900">PromptOps</span>
            </Link>
          </div>
          
          <div className="hidden md:flex items-center space-x-8">
            {navigation.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className="text-gray-600 hover:text-gray-900 transition-colors font-medium"
              >
                {item.name}
              </a>
            ))}
          </div>
          
          <div className="flex items-center space-x-4">
            {isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-2">
                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                      {user.avatar ? (
                        <img 
                          src={user.avatar} 
                          alt={user.name}
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <User className="h-4 w-4 text-blue-600" />
                      )}
                    </div>
                    <span className="hidden md:block">{user.name}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5 text-sm text-gray-700">
                    <div className="font-medium">{user.name}</div>
                    <div className="text-gray-500">{user.email}</div>
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
                  <DropdownMenuItem onClick={logout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : isAuthPage ? (
              <Button 
                variant="ghost"
                onClick={location.pathname === '/login' ? onRegisterClick : onSignInClick}
              >
                {location.pathname === '/login' ? 'Sign Up' : 'Sign In'}
              </Button>
            ) : (
              <>
                <Button variant="ghost" onClick={onSignInClick}>
                  Sign In
                </Button>
                <Button onClick={onRegisterClick}>
                  Get Started
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Enterprise Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="px-6 max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <img src="/src/assets/logo-nav.svg" alt="PromptOps Logo" className="h-12 w-12" />
                <span className="text-2xl font-bold text-white">PromptOps</span>
              </div>
              <p className="text-gray-400">
                Enterprise platform for treating prompts as source code — built with Git-level discipline for professional prompt engineering teams.
              </p>
              <div className="flex items-center space-x-4 mt-4">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  SOC 2 Compliant
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Enterprise Ready
                </span>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <div className="space-y-2 text-gray-400">
                <a href="/#features" className="block hover:text-white transition-colors">Features</a>
                <a href="/#pricing" className="block hover:text-white transition-colors">Pricing</a>
                <a href="#" className="block hover:text-white transition-colors">Documentation</a>
                <a href="#" className="block hover:text-white transition-colors">API Reference</a>
                <a href="#" className="block hover:text-white transition-colors">Changelog</a>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <div className="space-y-2 text-gray-400">
                <a href="/#about" className="block hover:text-white transition-colors">About Us</a>
                <a href="#" className="block hover:text-white transition-colors">Blog</a>
                <a href="#" className="block hover:text-white transition-colors">Careers</a>
                <a href="#" className="block hover:text-white transition-colors">Contact</a>
                <a href="#" className="block hover:text-white transition-colors">Partners</a>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Resources</h4>
              <div className="space-y-2 text-gray-400">
                <a href="#" className="block hover:text-white transition-colors">Help Center</a>
                <a href="#" className="block hover:text-white transition-colors">Community</a>
                <a href="#" className="block hover:text-white transition-colors">Status</a>
                <a href="#" className="block hover:text-white transition-colors">Security</a>
                <a href="#" className="block hover:text-white transition-colors">Compliance</a>
              </div>
            </div>
          </div>
          
          <div className="border-t border-gray-800 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div className="text-gray-400 text-sm mb-4 md:mb-0">
                &copy; 2024 PromptOps, Inc. All rights reserved.
              </div>
              <div className="flex items-center space-x-6 text-sm text-gray-400">
                <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
                <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
                <a href="#" className="hover:text-white transition-colors">Cookie Policy</a>
                <a href="#" className="hover:text-white transition-colors">GDPR</a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}