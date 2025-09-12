import React from 'react'
import { Chrome } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'

interface GoogleLoginButtonProps {
  className?: string
  variant?: 'default' | 'outline' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

export function GoogleLoginButton({ 
  className, 
  variant = 'outline', 
  size = 'default' 
}: GoogleLoginButtonProps) {
  const { loginWithGoogle, isLoading, error } = useAuth()

  const handleGoogleLogin = () => {
    try {
      loginWithGoogle()
    } catch (error) {
      console.error('Google login error:', error)
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleGoogleLogin}
      disabled={isLoading}
      className={className}
    >
      <Chrome className="mr-2 h-4 w-4" />
      {isLoading ? 'Connecting...' : 'Continue with Google'}
    </Button>
  )
}