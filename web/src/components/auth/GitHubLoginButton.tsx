import React from 'react'
import { Github } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { generateGithubAuthUrl } from '@/lib/githubAuth'

interface GitHubLoginButtonProps {
  className?: string
  variant?: 'default' | 'outline' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

export function GitHubLoginButton({
  className,
  variant = 'outline',
  size = 'default'
}: GitHubLoginButtonProps) {
  const { loginWithGithub, isLoading, error } = useAuth()

  const handleGithubLogin = () => {
    try {
      loginWithGithub()
    } catch (error) {
      console.error('GitHub login error:', error)
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleGithubLogin}
      disabled={isLoading}
      className={className}
      style={{ cursor: 'pointer', zIndex: 100 }}
    >
      <Github className="mr-2 h-4 w-4" />
      {isLoading ? 'Connecting...' : 'Continue with GitHub'}
    </Button>
  )
}