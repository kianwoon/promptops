import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { getDevelopmentUser, isDevelopmentAutoAuthEnabled, logDevConfig } from '@/lib/devConfig'

/**
 * Hook to set up development authentication automatically
 * This ensures that developers can access protected routes without manual login
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
      return
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
          localStorage.setItem('user', JSON.stringify(devUser))
          localStorage.setItem('isAuthenticated', 'true')

          // Only reload if we actually set up the auth
          if (!window.location.search.includes('dev_auth=1')) {
            // Reload to apply the new auth state
            setTimeout(() => {
              window.location.reload()
            }, 100)
          }
        }
      }
    }
  }, [isAuthenticated, isLoading])
}