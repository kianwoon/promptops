import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { shouldSkipAuth, logDevConfig, isDevelopmentAutoAuthEnabled } from '@/lib/devConfig'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRoles?: string[]
}

/**
 * Development-aware ProtectedRoute that respects security settings
 * Auto-authentication is disabled by default for security
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
      // Security warning if auto-auth is enabled
      if (isDevelopmentAutoAuthEnabled()) {
        console.warn('⚠️  SECURITY WARNING: Auto-authentication is enabled in development mode')
        console.warn('⚠️  This bypasses real authentication and should only be used for testing')
      }
    }
  }, [])

  // Check if we should skip authentication entirely (development mode with explicit setting)
  if (shouldSkipAuth()) {
    console.warn('⚠️  SECURITY WARNING: Authentication checks are being skipped')
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

  // Normal authentication logic for both development and production
  if (!isAuthenticated) {
    // Check if we have stored auth data that might need context sync
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