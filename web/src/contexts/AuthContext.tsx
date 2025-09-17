import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react'
import { generateGoogleAuthUrl, handleGoogleCallback, storeAuthTokens } from '@/lib/googleAuth'
import { useCurrentUser } from '@/hooks/useCurrentUser'

interface User {
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
  provider?: 'local' | 'google'
  providerId?: string
  isVerified?: boolean
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>
  loginWithGoogle: () => void
  handleGoogleCallback: (code: string) => Promise<void>
  register: (userData: any) => Promise<void>
  logout: () => void
  updateUser: (userData: Partial<User>) => void
  hasPermission: (permission: string) => boolean
  hasRole: (roles: string[]) => boolean
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

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
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
  const { user: dbUser, loading: dbUserLoading, refetch: refetchDbUser } = useCurrentUser()

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

    // Check for Google OAuth callback
    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')

    if (code && window.location.pathname === '/auth/google/callback') {
      // Handle Google OAuth callback
      handleGoogleAuthCallback(code)
    }
  }, [dbUser, dbUserLoading])

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

  const login = async (email: string, password: string): Promise<void> => {
    dispatch({ type: 'LOGIN_START' })

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Mock user database
      const mockUsers: User[] = [
        {
          id: '1',
          email: 'admin@company.com',
          name: 'John Admin',
          role: 'admin',
          organization: 'Acme Corp',
          phone: '+1 (555) 123-4567',
          companySize: '201-1000',
          createdAt: '2024-01-15T10:30:00Z',
          lastLogin: new Date().toISOString(),
        },
        {
          id: '2',
          email: 'user@company.com',
          name: 'Jane User',
          role: 'user',
          organization: 'Acme Corp',
          phone: '+1 (555) 234-5678',
          companySize: '201-1000',
          createdAt: '2024-02-01T14:20:00Z',
          lastLogin: new Date().toISOString(),
        },
        {
          id: '3',
          email: 'viewer@company.com',
          name: 'Bob Viewer',
          role: 'viewer',
          organization: 'Acme Corp',
          phone: '+1 (555) 345-6789',
          companySize: '201-1000',
          createdAt: '2024-02-15T09:45:00Z',
          lastLogin: new Date().toISOString(),
        },
      ]

      const user = mockUsers.find(u => u.email === email)
      
      if (!user) {
        throw new Error('User not found')
      }

      // Update last login
      const updatedUser = { ...user, lastLogin: new Date().toISOString() }
      
      // Store in localStorage
      localStorage.setItem('user', JSON.stringify(updatedUser))
      localStorage.setItem('isAuthenticated', 'true')

      dispatch({ type: 'LOGIN_SUCCESS', payload: updatedUser })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed'
      dispatch({ type: 'LOGIN_ERROR', payload: errorMessage })
      throw error
    }
  }

  const register = async (userData: any): Promise<void> => {
    dispatch({ type: 'REGISTER_START' })

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500))

      const newUser: User = {
        id: Date.now().toString(),
        email: userData.email,
        name: `${userData.firstName} ${userData.lastName}`,
        role: 'user', // Default role for new users
        organization: userData.company,
        phone: userData.phone,
        companySize: userData.companySize,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      }

      // Store in localStorage
      localStorage.setItem('user', JSON.stringify(newUser))
      localStorage.setItem('isAuthenticated', 'true')

      dispatch({ type: 'REGISTER_SUCCESS', payload: newUser })
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
    handleGoogleCallback,
    register,
    logout,
    updateUser,
    hasPermission,
    hasRole,
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