import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRoles?: string[]
}

export function ProtectedRoute({ children, requiredRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user, hasRole } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    // Redirect to login page with return URL
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (requiredRoles && !hasRole(requiredRoles)) {
    // User doesn't have required role, redirect to unauthorized page or dashboard
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}