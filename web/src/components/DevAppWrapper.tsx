import React from 'react'
import { useDevAuthSetup } from '@/hooks/useDevAuthSetup'

interface DevAppWrapperProps {
  children: React.ReactNode
}

/**
 * Development-only wrapper component that handles auth setup
 * This ensures smooth development experience without manual authentication
 */
export function DevAppWrapper({ children }: DevAppWrapperProps) {
  // Set up development authentication
  useDevAuthSetup()

  return <>{children}</>
}