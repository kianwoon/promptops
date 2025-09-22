import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { getDevelopmentUser, isDevelopmentAutoAuthEnabled, logDevConfig, generateDevelopmentJWT } from '@/lib/devConfig'

// Clean up invalid tokens from localStorage
function cleanupInvalidTokens() {
  const token = localStorage.getItem('access_token')
  if (!token) return

  // Clean up old invalid development token
  if (token === 'dev-mock-token-for-development') {
    console.log('Cleaning up old invalid development token')
    localStorage.removeItem('access_token')
    return
  }

  // Clean up malformed tokens (not proper JWT format)
  if (!token.includes('ey') || token.split('.').length !== 3) {
    console.log('Cleaning up malformed JWT token')
    localStorage.removeItem('access_token')
    return
  }

  // Clean up expired tokens (check expiration in payload)
  try {
    const payload = token.split('.')[1]
    const decoded = JSON.parse(atob(payload))
    const currentTime = Math.floor(Date.now() / 1000)

    if (decoded.exp && decoded.exp < currentTime) {
      console.log('Cleaning up expired token')
      localStorage.removeItem('access_token')
    }
  } catch (error) {
    console.log('Cleaning up token with invalid payload format')
    localStorage.removeItem('access_token')
  }
}

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
      // Clean up any old invalid tokens if they exist
      cleanupInvalidTokens()
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
      const storedToken = localStorage.getItem('access_token')
      const manualLogout = localStorage.getItem('logout_manual')
      const devLogoutDisabled = localStorage.getItem('dev_logout_disabled')
      const skipDevAuth = localStorage.getItem('skip_dev_auth')
      const logoutTimestamp = localStorage.getItem('logout_timestamp')

      // Don't auto-authenticate if user manually logged out (check multiple flags)
      if (manualLogout === 'true' || devLogoutDisabled === 'true' || skipDevAuth === 'true') {
        // Only clear flags if they're old (more than 5 minutes)
        if (logoutTimestamp && Date.now() - parseInt(logoutTimestamp) > 300000) {
          localStorage.removeItem('logout_manual')
          localStorage.removeItem('dev_logout_disabled')
          localStorage.removeItem('skip_dev_auth')
          localStorage.removeItem('logout_timestamp')
        }
        return
      }

      // Check if we have a valid OAuth token (don't overwrite with dev token)
      if (storedToken && storedToken.includes('ey') && storedToken.split('.').length === 3) {
        console.log('Valid OAuth token found, skipping development auto-auth')
        return
      }

      // If we don't have stored auth data, create it
      if (!storedAuth || storedAuth !== 'true' || !storedUser) {
        const devUser = getDevelopmentUser()

        if (devUser) {
          console.warn('⚠️  SECURITY WARNING: Auto-authenticating with development user:', devUser.email)
          localStorage.setItem('user', JSON.stringify(devUser))
          localStorage.setItem('isAuthenticated', 'true')
          // Add a properly formatted JWT mock token for API calls
          const mockToken = generateDevelopmentJWT()
          localStorage.setItem('access_token', mockToken)

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
        // But only if it's not a valid OAuth token
        const existingToken = localStorage.getItem('access_token')
        if (!existingToken || (existingToken && !existingToken.includes('ey'))) {
          const mockToken = generateDevelopmentJWT()
          localStorage.setItem('access_token', mockToken)
        }
      }
    }
  }, [isAuthenticated, isLoading])
}