import React from 'react'
import { useDevAuthSetup } from '@/hooks/useDevAuthSetup'
import { isDevelopmentAutoAuthEnabled, shouldSkipAuth } from '@/lib/devConfig'

interface DevAppWrapperProps {
  children: React.ReactNode
}

/**
 * Development-only wrapper component that handles auth setup
 * WARNING: Auto-authentication is disabled by default for security
 * Only enables development features when explicitly configured
 */
export function DevAppWrapper({ children }: DevAppWrapperProps) {
  // Set up development authentication (disabled by default)
  useDevAuthSetup()

  // Show security warnings in development mode
  React.useEffect(() => {
    if (import.meta.env.DEV) {
      if (isDevelopmentAutoAuthEnabled()) {
        console.warn('⚠️  SECURITY WARNING: Development auto-authentication is enabled')
        console.warn('⚠️  This bypasses real authentication and should only be used for testing')
        console.warn('⚠️  To disable: VITE_DEV_AUTO_AUTH=false or VITE_DEV_ENABLED=false')
      }

      if (shouldSkipAuth()) {
        console.warn('⚠️  SECURITY WARNING: Authentication checks are being skipped')
        console.warn('⚠️  This disables all security and should only be used for debugging')
        console.warn('⚠️  To disable: VITE_DEV_SKIP_AUTH=false or VITE_DEV_ENABLED=false')
      }

      // Show available helpers
      console.log('🛠️  Development helpers available: window.devHelpers')
      console.log('ℹ️  Type devHelpers.showConfig() to see current settings')
    }
  }, [])

  return <>{children}</>
}