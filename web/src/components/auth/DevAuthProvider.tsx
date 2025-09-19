import React from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { getDevelopmentUser, isDevelopmentAutoAuthEnabled, logDevConfig } from '@/lib/devConfig'

interface DevAuthProviderProps {
  children: React.ReactNode
}

/**
 * Development-only authentication provider that auto-authenticates users
 * WARNING: This is disabled by default for security reasons
 * Only activates when explicitly enabled via environment variables
 */
export function DevAuthProvider({ children }: DevAuthProviderProps) {
  const { isAuthenticated } = useAuth()

  React.useEffect(() => {
    // Check if development auto-auth is enabled
    if (!isDevelopmentAutoAuthEnabled()) {
      return
    }

    if (import.meta.env.DEV && !isAuthenticated) {
      // Security warning when auto-auth is enabled
      console.warn('⚠️  SECURITY WARNING: DevAuthProvider is auto-authenticating users')
      console.warn('⚠️  This bypasses real authentication and should only be used for testing')

      // Check if user manually logged out
      const manualLogout = localStorage.getItem('logout_manual')
      if (manualLogout === 'true') {
        localStorage.removeItem('logout_manual')
        return
      }

      // Auto-authenticate for development
      const devUser = getDevelopmentUser()

      if (devUser) {
        console.warn('⚠️  SECURITY WARNING: Auto-authenticating with development user:', devUser.email)
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
 * WARNING: This component is deprecated and should not be used
 * Use DevProtectedRoute instead with proper security considerations
 */
export function DevAuthBypass({ children }: { children: React.ReactNode }) {
  if (import.meta.env.DEV) {
    console.warn('⚠️  SECURITY WARNING: DevAuthBypass is deprecated and bypasses authentication')
    console.warn('⚠️  This should not be used in production')
    return <>{children}</>
  }

  // In production, use the normal ProtectedRoute logic
  return children
}