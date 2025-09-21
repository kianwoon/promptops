import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react'
import { generateGoogleAuthUrl, handleGoogleCallback, storeAuthTokens, getAccessToken, refreshToken, isAccessTokenValid } from '@/lib/googleAuth'
import { generateGithubAuthUrl, handleGithubCallback } from '@/lib/githubAuth'
import { useCurrentUser } from '@/hooks/useCurrentUser'

export interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'user' | 'viewer'
  organization: string
  avatar?: string
  phone?: string
  companySize?: string
  createdAt?: string
  lastLogin?: string
  provider?: 'local' | 'google' | 'github'
  providerId?: string
  isVerified?: boolean
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  tokenStatus: {
    isValid: boolean
    isExpired: boolean
    timeUntilExpiry: number
  }
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>
  loginWithGoogle: () => void
  loginWithGithub: () => void
  handleGoogleCallback: (code: string) => Promise<void>
  handleGithubCallback: (code: string) => Promise<void>
  register: (userData: any) => Promise<void>
  logout: () => void
  updateUser: (userData: Partial<User>) => void
  hasPermission: (permission: string) => boolean
  hasRole: (roles: string[]) => boolean
  dbUser: User | null
  dbUserLoading: boolean
  dbUserError: string | null
  refreshDbUser: () => Promise<void>
  checkAndRefreshToken: () => Promise<boolean>
}

type AuthAction =
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: User }
  | { type: 'LOGIN_ERROR'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'REGISTER_START' }
  | { type: 'REGISTER_SUCCESS'; payload: User }
  | { type: 'REGISTER_ERROR'; payload: string }
  | { type: 'UPDATE_USER'; payload: Partial<User> }
  | { type: 'CLEAR_ERROR' }
  | { type: 'TOKEN_STATUS_UPDATE'; payload: { isValid: boolean; isExpired: boolean; timeUntilExpiry: number } }

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  tokenStatus: {
    isValid: false,
    isExpired: true,
    timeUntilExpiry: 0,
  },
}

// Role-based permissions
const rolePermissions = {
  admin: [
    'templates:create',
    'templates:read',
    'templates:update',
    'templates:delete',
    'templates:deploy',
    'deployments:create',
    'deployments:read',
    'deployments:update',
    'deployments:delete',
    'evaluations:create',
    'evaluations:read',
    'evaluations:update',
    'evaluations:delete',
    'users:create',
    'users:read',
    'users:update',
    'users:delete',
    'organizations:manage',
    'billing:manage',
    'roles:read',
    'roles:create',
    'roles:update',
    'roles:delete',
    'settings:manage',
    'analytics:read',
    'audits:read',
    'compatibility:read',
  ],
  user: [
    'templates:create',
    'templates:read',
    'templates:update',
    'templates:delete',
    'deployments:read',
    'evaluations:create',
    'evaluations:read',
    'analytics:read',
  ],
  viewer: [
    'templates:read',
    'deployments:read',
    'evaluations:read',
    'analytics:read',
  ],
}

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOGIN_START':
    case 'REGISTER_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      }
    case 'LOGIN_SUCCESS':
    case 'REGISTER_SUCCESS':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      }
    case 'LOGIN_ERROR':
    case 'REGISTER_ERROR':
      return {
        ...state,
        isLoading: false,
        error: action.payload,
        isAuthenticated: false,
        user: null,
      }
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      }
    case 'UPDATE_USER':
      return {
        ...state,
        user: state.user ? { ...state.user, ...action.payload } : null,
      }
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      }
    case 'TOKEN_STATUS_UPDATE':
      return {
        ...state,
        tokenStatus: action.payload,
      }
    default:
      return state
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, dispatch] = useReducer(authReducer, initialState)
  const {
    user: dbUser,
    loading: dbUserLoading,
    error: dbUserError,
    refetch: refetchDbUser,
  } = useCurrentUser()

  // Initialize auth state from localStorage and sync with database user
  useEffect(() => {
    const storedAuth = localStorage.getItem('isAuthenticated')
    const storedUser = localStorage.getItem('user')

    if (storedAuth === 'true' && storedUser) {
      try {
        const localStorageUser = JSON.parse(storedUser)

        // If we have a database user, use that data (it's more fresh and includes avatar)
        if (dbUser && !dbUserLoading) {
          // Merge localStorage user with database user, prioritizing database fields
          const mergedUser = {
            ...localStorageUser,
            ...dbUser,
            // Always prioritize database avatar over localStorage avatar
            avatar: dbUser.avatar || localStorageUser.avatar,
            // Preserve some fields that might not be in database response
            phone: dbUser.phone || localStorageUser.phone,
            companySize: dbUser.companySize || localStorageUser.companySize,
          }
          dispatch({ type: 'LOGIN_SUCCESS', payload: mergedUser })
          // Update localStorage with merged user data
          localStorage.setItem('user', JSON.stringify(mergedUser))
        } else {
          // No database user available, use localStorage user
          dispatch({ type: 'LOGIN_SUCCESS', payload: localStorageUser })
        }
      } catch (error) {
        console.error('Failed to parse stored user data:', error)
        localStorage.removeItem('isAuthenticated')
        localStorage.removeItem('user')
      }
    }

    // Check for OAuth callbacks
    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')

    if (code) {
      if (window.location.pathname === '/auth/google/callback') {
        // Handle Google OAuth callback
        handleGoogleAuthCallback(code)
      } else if (window.location.pathname === '/auth/github/callback') {
        // Handle GitHub OAuth callback
        handleGithubAuthCallback(code)
      }
    }
  }, [dbUser, dbUserLoading])

  // Token status monitoring
  useEffect(() => {
    const updateTokenStatus = () => {
      const token = getAccessToken()
      if (!token) {
        dispatch({
          type: 'TOKEN_STATUS_UPDATE',
          payload: { isValid: false, isExpired: true, timeUntilExpiry: 0 }
        })
        return
      }

      try {
        const payload = token.split('.')[1]
        const decoded = JSON.parse(atob(payload))
        const currentTime = Math.floor(Date.now() / 1000)
        const timeUntilExpiry = Math.max(0, decoded.exp - currentTime)
        const expirationBuffer = 5 * 60 // 5 minutes buffer

        dispatch({
          type: 'TOKEN_STATUS_UPDATE',
          payload: {
            isValid: timeUntilExpiry > expirationBuffer,
            isExpired: timeUntilExpiry <= 0,
            timeUntilExpiry
          }
        })
      } catch (error) {
        console.error('Error updating token status:', error)
        dispatch({
          type: 'TOKEN_STATUS_UPDATE',
          payload: { isValid: false, isExpired: true, timeUntilExpiry: 0 }
        })
      }
    }

    // Update token status immediately
    updateTokenStatus()

    // Update token status every minute
    const interval = setInterval(updateTokenStatus, 60000)

    // Clean up interval on unmount
    return () => clearInterval(interval)
  }, [])

  // Auto-refresh token when it's about to expire
  useEffect(() => {
    if (state.isAuthenticated && state.tokenStatus.timeUntilExpiry > 0 && state.tokenStatus.timeUntilExpiry < 300) { // 5 minutes
      const refreshTimeout = setTimeout(async () => {
        try {
          await refreshToken()
        } catch (error) {
          console.error('Auto token refresh failed:', error)
          // If refresh fails, logout the user
          logout()
        }
      }, Math.max(0, (state.tokenStatus.timeUntilExpiry - 60) * 1000)) // Refresh 1 minute before expiry

      return () => clearTimeout(refreshTimeout)
    }
  }, [state.isAuthenticated, state.tokenStatus.timeUntilExpiry])

  const checkAndRefreshToken = async (): Promise<boolean> => {
    if (!isAccessTokenValid()) {
      try {
        await refreshToken()
        return true
      } catch (error) {
        console.error('Token refresh failed:', error)
        return false
      }
    }
    return true
  }

  const handleGoogleAuthCallback = async (code: string) => {
    dispatch({ type: 'LOGIN_START' })
    
    try {
      const response = await handleGoogleCallback(code)
      const user: User = {
        id: response.user.id,
        email: response.user.email,
        name: response.user.name,
        role: response.user.role || 'user',
        organization: response.user.organization || '',
        avatar: response.user.avatar,
        provider: 'google',
        providerId: response.user.provider_id,
        isVerified: true,
        createdAt: response.user.created_at,
        lastLogin: new Date().toISOString(),
      }

      // Store auth tokens
      storeAuthTokens({
        access_token: response.access_token,
        refresh_token: response.refresh_token,
      })

      // Store user data
      localStorage.setItem('user', JSON.stringify(user))
      localStorage.setItem('isAuthenticated', 'true')

      dispatch({ type: 'LOGIN_SUCCESS', payload: user })

      // Clear URL parameters
      window.history.replaceState({}, document.title, '/dashboard')

      // Refetch fresh user data from database
      refetchDbUser()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Google authentication failed'
      dispatch({ type: 'LOGIN_ERROR', payload: errorMessage })
      throw error
    }
  }

  const loginWithGoogle = (): void => {
    try {
      const authUrl = generateGoogleAuthUrl()
      // Open in new tab to avoid redirect issues
      window.open(authUrl, '_blank')
    } catch (error) {
      console.error('AuthContext: Google login error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to initiate Google login'
      dispatch({ type: 'LOGIN_ERROR', payload: errorMessage })
    }
  }

  const loginWithGithub = (): void => {
    try {
      const authUrl = generateGithubAuthUrl()
      // Open in new tab to avoid redirect issues
      window.open(authUrl, '_blank')
    } catch (error) {
      console.error('AuthContext: GitHub login error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to initiate GitHub login'
      dispatch({ type: 'LOGIN_ERROR', payload: errorMessage })
    }
  }

  const handleGoogleCallback = async (code: string): Promise<void> => {
    dispatch({ type: 'LOGIN_START' })

    try {
      const response = await handleGoogleCallback(code)
      const user: User = {
        id: response.user.id,
        email: response.user.email,
        name: response.user.name,
        role: response.user.role || 'user',
        organization: response.user.organization || '',
        avatar: response.user.avatar,
        provider: 'google',
        providerId: response.user.provider_id,
        isVerified: true,
        createdAt: response.user.created_at,
        lastLogin: new Date().toISOString(),
      }

      // Store auth tokens
      storeAuthTokens({
        access_token: response.access_token,
        refresh_token: response.refresh_token,
      })

      // Store user data
      localStorage.setItem('user', JSON.stringify(user))
      localStorage.setItem('isAuthenticated', 'true')

      dispatch({ type: 'LOGIN_SUCCESS', payload: user })

      // Refetch fresh user data from database
      refetchDbUser()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Google authentication failed'
      dispatch({ type: 'LOGIN_ERROR', payload: errorMessage })
      throw error
    }
  }

  const handleGithubAuthCallback = async (code: string) => {
    dispatch({ type: 'LOGIN_START' })

    try {
      const response = await handleGithubCallback(code)
      const user: User = {
        id: response.user.id,
        email: response.user.email,
        name: response.user.name,
        role: response.user.role || 'user',
        organization: response.user.organization || '',
        avatar: response.user.avatar,
        provider: 'github',
        providerId: response.user.provider_id,
        isVerified: true,
        createdAt: response.user.created_at,
        lastLogin: new Date().toISOString(),
      }

      // Store auth tokens
      storeAuthTokens({
        access_token: response.access_token,
        refresh_token: response.refresh_token,
      })

      // Store user data
      localStorage.setItem('user', JSON.stringify(user))
      localStorage.setItem('isAuthenticated', 'true')

      dispatch({ type: 'LOGIN_SUCCESS', payload: user })

      // Clear URL parameters
      window.history.replaceState({}, document.title, '/dashboard')

      // Refetch fresh user data from database
      refetchDbUser()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'GitHub authentication failed'
      dispatch({ type: 'LOGIN_ERROR', payload: errorMessage })
      throw error
    }
  }

  const handleGithubCallback = async (code: string): Promise<void> => {
    dispatch({ type: 'LOGIN_START' })

    try {
      const response = await handleGithubCallback(code)
      const user: User = {
        id: response.user.id,
        email: response.user.email,
        name: response.user.name,
        role: response.user.role || 'user',
        organization: response.user.organization || '',
        avatar: response.user.avatar,
        provider: 'github',
        providerId: response.user.provider_id,
        isVerified: true,
        createdAt: response.user.created_at,
        lastLogin: new Date().toISOString(),
      }

      // Store auth tokens
      storeAuthTokens({
        access_token: response.access_token,
        refresh_token: response.refresh_token,
      })

      // Store user data
      localStorage.setItem('user', JSON.stringify(user))
      localStorage.setItem('isAuthenticated', 'true')

      dispatch({ type: 'LOGIN_SUCCESS', payload: user })

      // Refetch fresh user data from database
      refetchDbUser()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'GitHub authentication failed'
      dispatch({ type: 'LOGIN_ERROR', payload: errorMessage })
      throw error
    }
  }

  const login = async (email: string, password: string): Promise<void> => {
    dispatch({ type: 'LOGIN_START' })

    try {
      // Make API call to backend for authentication
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Login failed')
      }

      const data = await response.json()

      // Transform the user data to match the User interface
      const user: User = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        role: data.user.role as 'admin' | 'user' | 'viewer',
        organization: data.user.organization || '',
        avatar: data.user.avatar,
        phone: data.user.phone,
        companySize: data.user.company_size,
        createdAt: data.user.created_at,
        lastLogin: data.user.last_login,
        provider: 'local',
        isVerified: data.user.is_verified,
      }

      // Store auth tokens
      storeAuthTokens({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      })

      // Store user data
      localStorage.setItem('user', JSON.stringify(user))
      localStorage.setItem('isAuthenticated', 'true')

      dispatch({ type: 'LOGIN_SUCCESS', payload: user })

      // Refetch fresh user data from database
      refetchDbUser()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed'
      dispatch({ type: 'LOGIN_ERROR', payload: errorMessage })
      throw error
    }
  }

  const register = async (userData: any): Promise<void> => {
    dispatch({ type: 'REGISTER_START' })

    try {
      // Make API call to backend for registration
      const response = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userData.email,
          password: userData.password,
          first_name: userData.firstName,
          last_name: userData.lastName,
          company: userData.company,
          phone: userData.phone,
          company_size: userData.companySize,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Registration failed')
      }

      const data = await response.json()

      // Transform the user data to match the User interface
      const newUser: User = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        role: data.user.role as 'admin' | 'user' | 'viewer',
        organization: data.user.organization || '',
        avatar: data.user.avatar,
        phone: data.user.phone,
        companySize: data.user.company_size,
        createdAt: data.user.created_at,
        lastLogin: data.user.last_login,
        provider: 'local',
        isVerified: data.user.is_verified,
      }

      // Store auth tokens
      storeAuthTokens({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      })

      // Store user data
      localStorage.setItem('user', JSON.stringify(newUser))
      localStorage.setItem('isAuthenticated', 'true')

      dispatch({ type: 'REGISTER_SUCCESS', payload: newUser })

      // Refetch fresh user data from database
      refetchDbUser()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Registration failed'
      dispatch({ type: 'REGISTER_ERROR', payload: errorMessage })
      throw error
    }
  }

  const logout = (): void => {
    // Clear all auth data
    localStorage.removeItem('isAuthenticated')
    localStorage.removeItem('user')
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('dev_auth')
    localStorage.removeItem('auth_reloaded')

    // Dispatch logout action
    dispatch({ type: 'LOGOUT' })

    // In development, prevent auto-reauthentication by adding a flag
    if (import.meta.env.DEV) {
      localStorage.setItem('logout_manual', 'true')
    }

    // Redirect to login page
    window.location.href = '/login'
  }

  const updateUser = (userData: Partial<User>): void => {
    if (state.user) {
      const updatedUser = { ...state.user, ...userData }
      localStorage.setItem('user', JSON.stringify(updatedUser))
      dispatch({ type: 'UPDATE_USER', payload: userData })

      // After updating user, refetch fresh data from database
      refetchDbUser()
    }
  }

  const hasPermission = (permission: string): boolean => {
    if (!state.user) return false
    const userPermissions = rolePermissions[state.user.role] || []
    return userPermissions.includes(permission)
  }

  const hasRole = (roles: string[]): boolean => {
    if (!state.user) return false
    return roles.includes(state.user.role)
  }

  const value: AuthContextType = {
    ...state,
    login,
    loginWithGoogle,
    loginWithGithub,
    handleGoogleCallback,
    handleGithubCallback,
    register,
    logout,
    updateUser,
    hasPermission,
    hasRole,
    dbUser,
    dbUserLoading,
    dbUserError,
    refreshDbUser: refetchDbUser,
    checkAndRefreshToken,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Custom hooks for common auth checks
export function useRequireAuth(allowedRoles?: string[]): User {
  const { user, isAuthenticated, hasRole } = useAuth()

  if (!isAuthenticated || !user) {
    throw new Error('Authentication required')
  }

  if (allowedRoles && !hasRole(allowedRoles)) {
    throw new Error('Insufficient permissions')
  }

  return user
}

export function usePermission(permission: string): boolean {
  const { hasPermission } = useAuth()
  return hasPermission(permission)
}
