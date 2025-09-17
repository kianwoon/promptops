import { useState, useEffect } from 'react'
import { makeAuthenticatedRequest } from '@/lib/googleAuth'
import { User } from '@/contexts/AuthContext'

interface UseCurrentUserResult {
  user: User | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useCurrentUser(): UseCurrentUserResult {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCurrentUser = async () => {
    try {
      setLoading(true)
      setError(null)

      const userData = await makeAuthenticatedRequest<User>('/api/v1/auth/me')

      // Transform the user data to match the User interface
      const transformedUser: User = {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        role: userData.role as 'admin' | 'user' | 'viewer',
        organization: userData.organization || '',
        avatar: userData.avatar,
        phone: undefined, // Not returned by /auth/me endpoint
        companySize: undefined, // Not returned by /auth/me endpoint
        createdAt: userData.created_at,
        lastLogin: userData.last_login,
        provider: userData.provider as 'local' | 'google' | undefined,
        providerId: userData.provider_id,
        isVerified: userData.is_verified,
      }

      setUser(transformedUser)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch user data'
      setError(errorMessage)
      console.error('Error fetching current user:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Only fetch if we have an access token (user is authenticated)
    const accessToken = localStorage.getItem('access_token')
    if (accessToken) {
      fetchCurrentUser()
    } else {
      setLoading(false)
    }
  }, [])

  return {
    user,
    loading,
    error,
    refetch: fetchCurrentUser,
  }
}