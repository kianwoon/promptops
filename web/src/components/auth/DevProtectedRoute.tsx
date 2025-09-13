import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { getDevelopmentUser, shouldSkipAuth, logDevConfig } from '@/lib/devConfig'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRoles?: string[]
}

/**
 * Development-friendly ProtectedRoute that handles auth state gracefully
 * This version provides better support for development workflows
 */
export function DevProtectedRoute({ children, requiredRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user, hasRole, isLoading } = useAuth()
  const location = useLocation()

  // Check if we're in development mode
  const isDevelopment = import.meta.env.DEV

  // Debug logging in development
  React.useEffect(() => {
    if (isDevelopment) {
      logDevConfig()
    }
  }, [])

  // Development mode: Auto-authenticate if needed
  React.useEffect(() => {
    if (isDevelopment && !isAuthenticated && !isLoading) {
      const storedAuth = localStorage.getItem('isAuthenticated')
      const storedUser = localStorage.getItem('user')
      const manualLogout = localStorage.getItem('logout_manual')

      // Don't auto-authenticate if user manually logged out
      if (manualLogout === 'true') {
        localStorage.removeItem('logout_manual')
        return
      }

      if (!storedAuth || storedAuth !== 'true' || !storedUser) {
        // Set up a default development user
        const devUser = getDevelopmentUser()

        if (devUser) {
          localStorage.setItem('user', JSON.stringify(devUser))
          localStorage.setItem('isAuthenticated', 'true')

          // Reload the page to apply the new auth state
          window.location.reload()
        }
      }
    }
  }, [isDevelopment, isAuthenticated, isLoading])

  // Check if we should skip authentication entirely (development mode)
  if (shouldSkipAuth()) {
    return <>{children}</>
  }

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  // For development, if we have auth data, consider it valid
  if (isDevelopment) {
    const storedAuth = localStorage.getItem('isAuthenticated')
    const storedUser = localStorage.getItem('user')

    if (storedAuth === 'true' && storedUser) {
      // In development, if we have stored auth, proceed
      return <>{children}</>
    }
  }

  // Normal authentication logic for production
  if (!isAuthenticated) {
    // Check if we have stored auth data
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
    // User doesn't have required role, redirect to dashboard
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}