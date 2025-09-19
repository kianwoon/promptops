import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { getDevelopmentUser, isDevelopmentAutoAuthEnabled, logDevConfig } from '@/lib/devConfig'

/**
 * Hook to set up development authentication automatically
 * WARNING: This is disabled by default for security reasons
 * Only activates when explicitly enabled via environment variables
 */
export function useDevAuthSetup() {
  const { isAuthenticated, isLoading } = useAuth()

  useEffect(() => {
    // Log development config for debugging
    if (import.meta.env.DEV) {
      logDevConfig()
    }

    // Check if development auto-auth is enabled
    if (!isDevelopmentAutoAuthEnabled()) {
      // Auto-authentication is disabled by default for security
      return
    }

    // Security warning when auto-auth is enabled
    if (import.meta.env.DEV && isDevelopmentAutoAuthEnabled()) {
      console.warn('⚠️  SECURITY WARNING: Development auto-authentication is enabled')
      console.warn('⚠️  This bypasses real authentication and should only be used for testing')
      console.warn('⚠️  To disable, set VITE_DEV_AUTO_AUTH=false or VITE_DEV_ENABLED=false')
    }

    // Wait for auth state to initialize
    if (isLoading) {
      return
    }

    // If not authenticated in development, set up default user
    if (!isAuthenticated) {
      const storedAuth = localStorage.getItem('isAuthenticated')
      const storedUser = localStorage.getItem('user')
      const manualLogout = localStorage.getItem('logout_manual')

      // Don't auto-authenticate if user manually logged out
      if (manualLogout === 'true') {
        localStorage.removeItem('logout_manual')
        return
      }

      // If we don't have stored auth data, create it
      if (!storedAuth || storedAuth !== 'true' || !storedUser) {
        const devUser = getDevelopmentUser()

        if (devUser) {
          console.warn('⚠️  SECURITY WARNING: Auto-authenticating with development user:', devUser.email)
          localStorage.setItem('user', JSON.stringify(devUser))
          localStorage.setItem('isAuthenticated', 'true')
          // Add a mock access token for API calls
          localStorage.setItem('access_token', 'dev-mock-token-for-development')

          // Only reload if we actually set up the auth
          if (!window.location.search.includes('dev_auth=1')) {
            // Reload to apply the new auth state
            setTimeout(() => {
              window.location.reload()
            }, 100)
          }
        }
      } else {
        // Ensure we have an access token even if auth was already set up
        if (!localStorage.getItem('access_token')) {
          localStorage.setItem('access_token', 'dev-mock-token-for-development')
        }
      }
    }
  }, [isAuthenticated, isLoading])
}