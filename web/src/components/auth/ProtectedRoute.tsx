import React, { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRoles?: string[]
}

export function ProtectedRoute({ children, requiredRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user, hasRole, isLoading, login } = useAuth()
  const location = useLocation()

  // Development mode: Auto-login if not authenticated
  useEffect(() => {
    if (import.meta.env.DEV && !isAuthenticated && !isLoading) {
      // Check if we should auto-login for development
      const devUser = localStorage.getItem('dev_auto_login')
      if (devUser !== 'false') {
        // Auto-login with default admin user for development
        const autoLogin = async () => {
          try {
            await login('admin@company.com', 'password')
          } catch (error) {
            console.warn('Development auto-login failed:', error)
          }
        }
        autoLogin()
      }
    }
  }, [isAuthenticated, isLoading, login])

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    // For development, if we're still not authenticated after auto-login attempt,
    // create a minimal dev user
    if (import.meta.env.DEV) {
      const devUser = {
        id: 'dev-user',
        email: 'dev@company.com',
        name: 'Dev User',
        role: 'admin' as const,
        organization: 'Dev Corp',
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      }

      // Set up dev user in localStorage for this session
      localStorage.setItem('user', JSON.stringify(devUser))
      localStorage.setItem('isAuthenticated', 'true')

      // Reload the page to apply the auth state
      window.location.reload()
      return null
    }

    // Check if we have stored auth data (for development)
    const storedAuth = localStorage.getItem('isAuthenticated')
    const storedUser = localStorage.getItem('user')

    if (storedAuth === 'true' && storedUser) {
      // If we have stored auth data, wait a moment for context to update
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
        </div>
      )
    }

    // Redirect to login page with return URL
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (requiredRoles && !hasRole(requiredRoles)) {
    // User doesn't have required role, redirect to unauthorized page or dashboard
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}