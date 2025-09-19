import React, { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { getAccessToken, isAccessTokenValid } from '@/lib/googleAuth'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRoles?: string[]
}

export function ProtectedRoute({ children, requiredRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user, hasRole, isLoading, error } = useAuth()
  const location = useLocation()
  const [isValidatingToken, setIsValidatingToken] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  // Token validation effect
  useEffect(() => {
    const validateToken = async () => {
      if (!isAuthenticated && !isLoading) {
        const accessToken = getAccessToken()
        const hasValidToken = accessToken && isAccessTokenValid()

        if (hasValidToken) {
          setIsValidatingToken(true)
          try {
            const response = await fetch('/api/v1/auth/validate', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
            })

            if (!response.ok) {
              // Token is invalid, clear it
              localStorage.removeItem('access_token')
              localStorage.removeItem('refresh_token')
              localStorage.removeItem('isAuthenticated')
              localStorage.removeItem('user')
              setAuthError('Your session has expired. Please login again.')
            }
          } catch (error) {
            console.warn('Token validation failed:', error)
            // Clear invalid tokens
            localStorage.removeItem('access_token')
            localStorage.removeItem('refresh_token')
            localStorage.removeItem('isAuthenticated')
            localStorage.removeItem('user')
            setAuthError('Authentication failed. Please login again.')
          } finally {
            setIsValidatingToken(false)
          }
        }
      }
    }

    validateToken()
  }, [isAuthenticated, isLoading])

  // Clear auth error when authentication succeeds
  useEffect(() => {
    if (isAuthenticated && authError) {
      setAuthError(null)
    }
  }, [isAuthenticated, authError])

  if (isLoading || isValidatingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    // If there's an authentication error, show it or redirect to login
    if (authError || error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-medium text-gray-900">Authentication Error</h3>
              <div className="mt-2 text-sm text-gray-500">
                <p>{authError || (error ? 'Authentication failed. Please try again.' : 'Please login to access this page.')}</p>
              </div>
              <div className="mt-6">
                <button
                  onClick={() => window.location.href = '/login'}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Go to Login
                </button>
              </div>
            </div>
          </div>
        </div>
      )
    }

    // Clear any inconsistent auth state
    const accessToken = getAccessToken()
    if (!accessToken) {
      localStorage.removeItem('isAuthenticated')
      localStorage.removeItem('user')
    }

    // Redirect to login page with return URL
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (requiredRoles && !hasRole(requiredRoles)) {
    // User doesn't have required role, redirect to unauthorized page or dashboard
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}