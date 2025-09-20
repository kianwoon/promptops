import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'

export function GitHubCallback() {
  const navigate = useNavigate()
  const { handleGithubCallback, error } = useAuth()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [statusMessage, setStatusMessage] = useState('')

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('GitHubCallback: Starting callback handling')
        const urlParams = new URLSearchParams(window.location.search)
        const code = urlParams.get('code')
        const error = urlParams.get('error')

        console.log('GitHubCallback: URL params:', { code: code ? 'present' : 'missing', error })

        if (error) {
          throw new Error(`GitHub OAuth error: ${error}`)
        }

        if (!code) {
          throw new Error('No authorization code received from GitHub')
        }

        console.log('GitHubCallback: Got code, calling handleGithubCallback')
        setStatusMessage('Authenticating with GitHub...')
        const result = await handleGithubCallback(code)
        console.log('GitHubCallback: handleGithubCallback result:', result)

        setStatus('success')
        setStatusMessage('Successfully authenticated!')
        console.log('GitHubCallback: Authentication successful')

        // Redirect to landing page after successful authentication to show user profile
        setTimeout(() => {
          navigate('/')
        }, 2000)
      } catch (error) {
        console.error('GitHubCallback: Authentication error:', error)
        setStatus('error')
        setStatusMessage(error instanceof Error ? error.message : 'Authentication failed')

        // Keep user on landing page after error instead of redirecting to login
        setTimeout(() => {
          navigate('/')
        }, 3000)
      }
    }

    handleCallback()
  }, [handleGithubCallback, navigate])

  const getStatusIcon = () => {
    switch (status) {
      case 'loading':
        return <Loader2 className="h-6 w-6 animate-spin" />
      case 'success':
        return <CheckCircle className="h-6 w-6 text-green-600" />
      case 'error':
        return <XCircle className="h-6 w-6 text-red-600" />
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case 'loading':
        return 'border-blue-200 bg-blue-50'
      case 'success':
        return 'border-green-200 bg-green-50'
      case 'error':
        return 'border-red-200 bg-red-50'
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
            {status === 'loading' && 'GitHub Authentication'}
            {status === 'success' && 'Authentication Successful'}
            {status === 'error' && 'Authentication Failed'}
          </CardTitle>
          <CardDescription>
            {status === 'loading' && 'Please wait while we authenticate your account...'}
            {status === 'success' && 'You have been successfully authenticated!'}
            {status === 'error' && 'There was a problem with your authentication.'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="space-y-4">
            <Alert className={getStatusColor()}>
              <AlertDescription className="text-center">
                {statusMessage}
              </AlertDescription>
            </Alert>

            {status === 'error' && (
              <div className="space-y-2">
                <Button
                  variant="outline"
                  onClick={() => navigate('/login')}
                  className="w-full"
                >
                  Back to Login
                </Button>
              </div>
            )}

            {status === 'loading' && (
              <div className="text-center text-sm text-gray-600">
                <p>This may take a few seconds...</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}