import React from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { getDevelopmentUser, isDevelopmentAutoAuthEnabled, logDevConfig } from '@/lib/devConfig'

interface DevAuthProviderProps {
  children: React.ReactNode
}

/**
 * Development-only authentication provider that auto-authenticates users
 * This should only be used in development mode for testing purposes
 */
export function DevAuthProvider({ children }: DevAuthProviderProps) {
  const { isAuthenticated } = useAuth()

  React.useEffect(() => {
    // Check if development auto-auth is enabled
    if (!isDevelopmentAutoAuthEnabled()) {
      return
    }

    if (import.meta.env.DEV && !isAuthenticated) {
      // Check if user manually logged out
      const manualLogout = localStorage.getItem('logout_manual')
      if (manualLogout === 'true') {
        localStorage.removeItem('logout_manual')
        return
      }

      // Auto-authenticate for development
      const devUser = getDevelopmentUser()

      if (devUser) {
        // Store in localStorage to persist across refreshes
        localStorage.setItem('user', JSON.stringify(devUser))
        localStorage.setItem('isAuthenticated', 'true')

        // Reload to apply the auth state
        if (!window.location.search.includes('auth_reloaded')) {
          window.location.search = 'auth_reloaded=true'
        }
      }
    }
  }, [isAuthenticated])

  return <>{children}</>
}

/**
 * Simple development bypass component that renders children without authentication
 * This is a quick fix for development refresh issues
 */
export function DevAuthBypass({ children }: { children: React.ReactNode }) {
  if (import.meta.env.DEV) {
    return <>{children}</>
  }

  // In production, use the normal ProtectedRoute logic
  return children
}