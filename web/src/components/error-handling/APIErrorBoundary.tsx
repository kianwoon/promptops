import React, { useState, useEffect, ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Wifi,
  WifiOff,
  Server,
  AlertCircle,
  RefreshCw,
  Shield,
  Clock,
  ExternalLink,
  Copy
} from 'lucide-react'
import { ErrorLogger } from '@/lib/errorLogger'

interface APIError {
  status?: number
  statusText?: string
  message?: string
  code?: string
  details?: any
  url?: string
  method?: string
  timestamp?: string
}

interface APIErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: APIError) => void
  fallbackComponent?: React.ComponentType<{ error: APIError; retry: () => void }>
  maxRetries?: number
  retryDelay?: number
  showToast?: boolean
  logToService?: boolean
  enableRetry?: boolean
  customErrorHandler?: (error: APIError) => boolean // Return true if handled
}

interface APIErrorBoundaryState {
  hasError: boolean
  error: APIError | null
  retryCount: number
  errorId: string
  isRetrying: boolean
}

export class APIErrorBoundary extends React.Component<APIErrorBoundaryProps, APIErrorBoundaryState> {
  private retryTimer: NodeJS.Timeout | null = null

  constructor(props: APIErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      retryCount: 0,
      errorId: '',
      isRetrying: false
    }
  }

  static getDerivedStateFromError(error: any): Partial<APIErrorBoundaryState> {
    // Check if it's an API error
    if (error?.isAxiosError || error?.status || error?.message?.includes('fetch')) {
      const apiError: APIError = {
        status: error.response?.status || error.status,
        statusText: error.response?.statusText || error.statusText,
        message: error.message || 'Network error occurred',
        code: error.code,
        details: error.response?.data || error.details,
        url: error.config?.url || error.url,
        method: error.config?.method || error.method,
        timestamp: new Date().toISOString()
      }

      return {
        hasError: true,
        error: apiError,
        errorId: ErrorLogger.generateErrorId()
      }
    }

    // If it's not an API error, let it bubble up
    return { hasError: false }
  }

  componentDidCatch(error: any, errorInfo: React.ErrorInfo) {
    const apiError: APIError = {
      status: error.response?.status || error.status,
      statusText: error.response?.statusText || error.statusText,
      message: error.message || 'API error occurred',
      code: error.code,
      details: error.response?.data || error.details,
      url: error.config?.url || error.url,
      method: error.config?.method || error.method,
      timestamp: new Date().toISOString()
    }

    // Log the error
    const errorDetails = {
      error: apiError,
      errorInfo,
      errorId: this.state.errorId,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    }

    // Log to console in development
    if (import.meta.env.DEV) {
      console.error('APIErrorBoundary caught an error:', errorDetails)
    }

    // Log to error logging service
    if (this.props.logToService !== false) {
      ErrorLogger.logAPIError(apiError, errorDetails)
    }

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(apiError)
    }

    // Check if custom error handler handles this error
    if (this.props.customErrorHandler?.(apiError)) {
      this.resetError()
      return
    }

    this.setState({
      error: apiError,
      errorId: ErrorLogger.generateErrorId()
    })
  }

  retry = () => {
    const { maxRetries = 3, retryDelay = 2000 } = this.props
    const { retryCount } = this.state

    if (retryCount >= maxRetries) {
      if (this.props.showToast !== false) {
        ErrorLogger.showToast('Maximum retry attempts reached', 'error')
      }
      return
    }

    this.setState({ isRetrying: true })

    // Clear any existing retry timer
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
    }

    // Set retry timer
    this.retryTimer = setTimeout(() => {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        retryCount: prevState.retryCount + 1,
        isRetrying: false
      }))
    }, retryDelay)
  }

  resetError = () => {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
    }
    this.setState({
      hasError: false,
      error: null,
      retryCount: 0,
      isRetrying: false
    })
  }

  handleCopyError = () => {
    if (this.state.error) {
      const errorText = ErrorLogger.formatAPIErrorForSupport(this.state.error)
      navigator.clipboard.writeText(errorText).then(() => {
        if (this.props.showToast !== false) {
          ErrorLogger.showToast('Error details copied to clipboard', 'success')
        }
      }).catch(() => {
        if (this.props.showToast !== false) {
          ErrorLogger.showToast('Failed to copy error details', 'error')
        }
      })
    }
  }

  getErrorType = (error: APIError): string => {
    if (error.status === 0) return 'Network Error'
    if (error.status && error.status >= 400 && error.status < 500) return 'Client Error'
    if (error.status && error.status >= 500) return 'Server Error'
    return 'API Error'
  }

  getErrorIcon = (error: APIError) => {
    if (error.status === 0) return <WifiOff className="h-5 w-5" />
    if (error.status && error.status >= 500) return <Server className="h-5 w-5" />
    return <AlertCircle className="h-5 w-5" />
  }

  getErrorMessage = (error: APIError): string => {
    if (error.status === 0) return 'Unable to connect to the server. Please check your internet connection.'
    if (error.status === 401) return 'Authentication required. Please log in again.'
    if (error.status === 403) return 'You do not have permission to access this resource.'
    if (error.status === 404) return 'The requested resource was not found.'
    if (error.status === 429) return 'Too many requests. Please wait a moment before trying again.'
    if (error.status && error.status >= 500) return 'The server encountered an error. Please try again later.'
    return error.message || 'An unexpected error occurred while communicating with the server.'
  }

  componentWillUnmount() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
    }
  }

  render() {
    const { hasError, error, isRetrying, retryCount, errorId } = this.state
    const { enableRetry = true, maxRetries = 3 } = this.props

    if (hasError && error) {
      // If custom fallback component is provided, use it
      if (this.props.fallbackComponent) {
        const FallbackComponent = this.props.fallbackComponent
        return <FallbackComponent error={error} retry={this.retry} />
      }

      // If custom fallback is provided, use it
      if (this.props.fallback) {
        return this.props.fallback
      }

      const errorType = this.getErrorType(error)
      const errorIcon = this.getErrorIcon(error)
      const errorMessage = this.getErrorMessage(error)

      return (
        <div className="w-full p-4">
          <Card className="border-destructive/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-destructive">
                    {errorIcon}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{errorType}</CardTitle>
                    <CardDescription>{errorMessage}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {error.status || 'Network'}
                  </Badge>
                  {retryCount > 0 && (
                    <Badge variant="secondary">
                      Retry {retryCount}/{maxRetries}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Error Details */}
              {error.details && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Details:</strong> {typeof error.details === 'string' ? error.details : JSON.stringify(error.details)}
                  </AlertDescription>
                </Alert>
              )}

              {/* Error Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {error.url && (
                  <div>
                    <span className="font-medium">URL:</span>
                    <div className="font-mono text-xs bg-muted p-1 rounded mt-1 break-all">
                      {error.url}
                    </div>
                  </div>
                )}
                {error.method && (
                  <div>
                    <span className="font-medium">Method:</span>
                    <div className="font-mono text-xs bg-muted p-1 rounded mt-1">
                      {error.method}
                    </div>
                  </div>
                )}
                <div>
                  <span className="font-medium">Error ID:</span>
                  <div className="font-mono text-xs bg-muted p-1 rounded mt-1">
                    {errorId}
                  </div>
                </div>
                <div>
                  <span className="font-medium">Time:</span>
                  <div className="text-xs text-muted-foreground mt-1">
                    {error.timestamp ? new Date(error.timestamp).toLocaleString() : 'Unknown'}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-3">
                {enableRetry && retryCount < maxRetries && (
                  <Button
                    onClick={this.retry}
                    disabled={isRetrying}
                    className="flex items-center gap-2"
                  >
                    {isRetrying ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Retrying...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4" />
                        Retry {retryCount > 0 ? `(${retryCount + 1}/${maxRetries})` : ''}
                      </>
                    )}
                  </Button>
                )}

                <Button
                  onClick={this.resetError}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Shield className="h-4 w-4" />
                  Dismiss
                </Button>

                <Button
                  onClick={this.handleCopyError}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Copy className="h-4 w-4" />
                  Copy Error
                </Button>

                {error.status === 401 && (
                  <Button
                    onClick={() => window.location.href = '/login'}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Log In
                  </Button>
                )}
              </div>

              {/* Retry Timer */}
              {isRetrying && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  Retrying in {this.props.retryDelay || 2000 / 1000} seconds...
                </div>
              )}

              {/* Developer Information */}
              {import.meta.env.DEV && (
                <Card className="border-orange-200 bg-orange-50">
                  <CardHeader>
                    <CardTitle className="text-sm text-orange-800">Developer Debug Info</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs text-orange-700 bg-orange-100 p-2 rounded overflow-x-auto">
                      {JSON.stringify(error, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

// Functional wrapper component
export function APIErrorBoundaryWrapper({ children, ...props }: Omit<APIErrorBoundaryProps, 'children'>) {
  return (
    <APIErrorBoundary {...props}>
      {children}
    </APIErrorBoundary>
  )
}

// Hook for handling API errors in components
export function useAPIErrorHandler() {
  const handleError = (error: any, context?: string) => {
    const apiError: APIError = {
      status: error.response?.status || error.status,
      statusText: error.response?.statusText || error.statusText,
      message: error.message || 'API error occurred',
      code: error.code,
      details: error.response?.data || error.details,
      url: error.config?.url || error.url,
      method: error.config?.method || error.method,
      timestamp: new Date().toISOString()
    }

    ErrorLogger.logAPIError(apiError, { context })

    // Show user-friendly message
    const message = getAPIErrorMessage(apiError)
    ErrorLogger.showToast(message, 'error')
  }

  return { handleError }
}

function getAPIErrorMessage(error: APIError): string {
  if (error.status === 0) return 'Unable to connect to the server. Please check your internet connection.'
  if (error.status === 401) return 'Authentication required. Please log in again.'
  if (error.status === 403) return 'You do not have permission to access this resource.'
  if (error.status === 404) return 'The requested resource was not found.'
  if (error.status === 429) return 'Too many requests. Please wait a moment before trying again.'
  if (error.status && error.status >= 500) return 'The server encountered an error. Please try again later.'
  return error.message || 'An unexpected error occurred while communicating with the server.'
}