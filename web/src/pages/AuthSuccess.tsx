import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'

// Simple JWT decoder function
function parseJwt(token: string) {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    }).join(''))
    return JSON.parse(jsonPayload)
  } catch (error) {
    console.error('Error parsing JWT:', error)
    return null
  }
}

export function AuthSuccess() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const handleSuccess = () => {
      try {
        const urlParams = new URLSearchParams(window.location.search)
        const accessToken = urlParams.get('access_token')
        const refreshToken = urlParams.get('refresh_token')

        console.log('AuthSuccess: Received tokens', { 
          accessToken: accessToken ? 'present' : 'missing',
          refreshToken: refreshToken ? 'present' : 'missing'
        })

        if (!accessToken || !refreshToken) {
          throw new Error('Missing authentication tokens')
        }

        // Decode JWT to get user information
        const decodedToken = parseJwt(accessToken)
        console.log('AuthSuccess: Decoded token:', decodedToken)
        
        // Create user object from token
        const user = {
          id: decodedToken.sub || decodedToken.user_id,
          email: decodedToken.email,
          name: decodedToken.name || decodedToken.email?.split('@')[0],
          role: decodedToken.role || 'user',
          organization: '',
          provider: decodedToken.provider || (decodedToken.picture ? 'google' : 'github'),
          isVerified: true,
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          avatar: decodedToken.picture || decodedToken.avatar_url || undefined
        }

        // Store tokens and user data in localStorage
        localStorage.setItem('access_token', accessToken)
        localStorage.setItem('refresh_token', refreshToken)
        localStorage.setItem('isAuthenticated', 'true')
        localStorage.setItem('user', JSON.stringify(user))

        console.log('AuthSuccess: Stored user data:', user)

        // Dispatch auth state change event
        window.dispatchEvent(new Event('authStateChange'))

        setStatus('success')
        setMessage('Successfully authenticated with Google!')

        // Redirect to landing page after 2 seconds to show authenticated state
        setTimeout(() => {
          navigate('/')
        }, 2000)

      } catch (error) {
        console.error('AuthSuccess: Error:', error)
        setStatus('error')
        setMessage(error instanceof Error ? error.message : 'Authentication failed')
        
        // Redirect to landing page after 3 seconds
        setTimeout(() => {
          navigate('/')
        }, 3000)
      }
    }

    handleSuccess()
  }, [navigate])

  const getStatusIcon = () => {
    switch (status) {
      case 'loading': return <Loader2 className="h-6 w-6 animate-spin" />
      case 'success': return <CheckCircle className="h-6 w-6 text-green-600" />
      case 'error': return <XCircle className="h-6 w-6 text-red-600" />
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case 'loading': return 'border-blue-200 bg-blue-50'
      case 'success': return 'border-green-200 bg-green-50'
      case 'error': return 'border-red-200 bg-red-50'
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {getStatusIcon()}
          </div>
          <CardTitle className="text-xl">
            {status === 'loading' && 'Processing Authentication'}
            {status === 'success' && 'Authentication Successful'}
            {status === 'error' && 'Authentication Failed'}
          </CardTitle>
          <CardDescription>
            {status === 'loading' && 'Please wait while we complete your authentication...'}
            {status === 'success' && 'You have been successfully authenticated!'}
            {status === 'error' && 'There was a problem with your authentication.'}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            <Alert className={getStatusColor()}>
              <AlertDescription className="text-center">
                {message}
              </AlertDescription>
            </Alert>

            {status === 'error' && (
              <Button 
                variant="outline" 
                onClick={() => navigate('/login')}
                className="w-full"
              >
                Back to Login
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}