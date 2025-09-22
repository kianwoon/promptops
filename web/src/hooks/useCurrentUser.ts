import { useState, useEffect } from 'react'
import { makeAuthenticatedRequest } from '@/lib/googleAuth'
import { User } from '@/contexts/AuthContext'

interface AuthMeResponse {
  id: string
  email: string
  name: string
  role: string
  organization?: string | null
  avatar?: string | null
  provider?: string | null
  provider_id?: string | null
  is_verified: boolean
  created_at: string
  last_login?: string | null
}

interface DbUserResponse {
  id: string
  email: string
  name: string
  role: string
  organization?: string | null
  phone?: string | null
  company_size?: string | null
  avatar?: string | null
  provider?: string | null
  provider_id?: string | null
  is_verified: boolean
  is_active: boolean
  created_at: string
  updated_at: string
  last_login?: string | null
}

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

      const authUser = await makeAuthenticatedRequest<AuthMeResponse>('/api/v1/auth/me')

      let dbUser: DbUserResponse | null = null
      try {
        dbUser = await makeAuthenticatedRequest<DbUserResponse>(`/v1/users/${authUser.id}`)
      } catch (dbError) {
        console.warn('useCurrentUser: failed to fetch database user profile', dbError)
      }

      const normalizedRole = (dbUser?.role || authUser.role || 'viewer').toLowerCase()
      const role = ['admin', 'user', 'viewer', 'editor', 'approver'].includes(normalizedRole)
        ? (normalizedRole as 'admin' | 'user' | 'viewer' | 'editor' | 'approver')
        : 'viewer'

      const avatarFromDb = dbUser?.avatar ?? undefined
      const avatarFromAuth = authUser.avatar ?? undefined
      const resolvedAvatar = [avatarFromDb, avatarFromAuth]
        .map(value => (typeof value === 'string' ? value.trim() : ''))
        .find(value => value.length > 0)

      const resolvedProvider = (dbUser?.provider ?? authUser.provider ?? undefined)
      const normalizedProvider = resolvedProvider
        ? (resolvedProvider.toLowerCase() as 'local' | 'google')
        : undefined

      const resolvedProviderId = dbUser?.provider_id ?? authUser.provider_id ?? undefined
      const resolvedCreatedAt = dbUser?.created_at ?? authUser.created_at
      const resolvedLastLogin = dbUser?.last_login ?? authUser.last_login ?? undefined
      const resolvedPhone = dbUser?.phone ?? undefined
      const resolvedCompanySize = dbUser?.company_size ?? undefined
      const resolvedOrganization = dbUser?.organization ?? authUser.organization ?? ''

      const transformedUser: User = {
        id: authUser.id,
        email: authUser.email,
        name: dbUser?.name || authUser.name,
        role,
        organization: resolvedOrganization,
        avatar: resolvedAvatar,
        phone: resolvedPhone ?? undefined,
        companySize: resolvedCompanySize ?? undefined,
        createdAt: resolvedCreatedAt,
        lastLogin: resolvedLastLogin ?? undefined,
        provider: normalizedProvider,
        providerId: resolvedProviderId ?? undefined,
        isVerified: dbUser?.is_verified ?? authUser.is_verified,
      }

      // Debug logging for avatar investigation
      console.log('🔍 useCurrentUser Debug:', {
        authUser,
        dbUser,
        avatarFromDb,
        avatarFromAuth,
        resolvedAvatar,
        transformedUserAvatar: transformedUser.avatar,
        hasAvatar: !!transformedUser.avatar
      })

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
