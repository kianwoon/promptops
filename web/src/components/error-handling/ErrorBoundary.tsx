import React, { Component, ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertTriangle,
  RefreshCw,
  Home,
  Copy,
  FileText,
  Bug,
  AlertCircle
} from 'lucide-react'
import { ErrorDisplay } from './ErrorDisplay'
import { ErrorLogger } from '@/lib/errorLogger'

interface ErrorInfo {
  componentStack: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorId: string
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  fallbackComponent?: React.ComponentType<{ error: Error; errorInfo: ErrorInfo; resetError: () => void }>
  showToast?: boolean
  logToService?: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorId: ErrorLogger.generateErrorId()
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error
    const errorDetails = {
      error,
      errorInfo,
      errorId: this.state.errorId,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      componentStack: errorInfo.componentStack
    }

    // Log to console in development
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught an error:', errorDetails)
    }

    // Log to error logging service
    if (this.props.logToService !== false) {
      ErrorLogger.logError(error, errorDetails)
    }

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    this.setState({
      error,
      errorInfo,
      errorId: ErrorLogger.generateErrorId()
    })
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    })
  }

  handleCopyError = () => {
    if (this.state.error && this.state.errorInfo) {
      const errorText = ErrorLogger.formatErrorForSupport(this.state.error, this.state.errorInfo)
      navigator.clipboard.writeText(errorText).then(() => {
        // Show success feedback
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

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      // If custom fallback component is provided, use it
      if (this.props.fallbackComponent) {
        const FallbackComponent = this.props.fallbackComponent
        return <FallbackComponent
          error={this.state.error!}
          errorInfo={this.state.errorInfo!}
          resetError={this.resetError}
        />
      }

      // If custom fallback is provided, use it
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <div className="w-full max-w-2xl space-y-6">
            {/* Error Header */}
            <Card className="border-destructive/20">
              <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                  <div className="relative">
                    <AlertTriangle className="h-12 w-12 text-destructive" />
                    <div className="absolute -top-1 -right-1 h-4 w-4 bg-destructive rounded-full flex items-center justify-center">
                      <span className="text-[10px] text-white font-bold">!</span>
                    </div>
                  </div>
                </div>
                <CardTitle className="text-xl text-destructive">
                  Something went wrong
                </CardTitle>
                <CardDescription>
                  We encountered an unexpected error. This has been logged and our team has been notified.
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Error Details */}
            <ErrorDisplay
              error={this.state.error}
              errorInfo={this.state.errorInfo}
              errorId={this.state.errorId}
            />

            {/* Action Buttons */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  What would you like to do?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <Button
                    onClick={this.resetError}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Try Again
                  </Button>

                  <Button
                    onClick={this.handleReload}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Reload Page
                  </Button>

                  <Button
                    onClick={this.handleGoHome}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Home className="h-4 w-4" />
                    Go Home
                  </Button>

                  <Button
                    onClick={this.handleCopyError}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Copy className="h-4 w-4" />
                    Copy Error
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Support Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Need Help?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Error ID:</strong> {this.state.errorId}
                    <br />
                    Please reference this ID when contacting support.
                  </AlertDescription>
                </Alert>

                <div className="text-sm text-muted-foreground">
                  <p>If this problem persists, please:</p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Take a screenshot of this error</li>
                    <li>Note the Error ID shown above</li>
                    <li>Contact our support team with these details</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Developer Information (only in development) */}
            {import.meta.env.DEV && this.state.error && (
              <Card className="border-orange-200 bg-orange-50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-orange-800">
                    <Bug className="h-5 w-5" />
                    Developer Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-medium text-orange-800">Error Message:</h4>
                      <p className="text-sm text-orange-700 font-mono bg-orange-100 p-2 rounded mt-1">
                        {this.state.error.message}
                      </p>
                    </div>

                    <div>
                      <h4 className="font-medium text-orange-800">Stack Trace:</h4>
                      <pre className="text-xs text-orange-700 bg-orange-100 p-2 rounded mt-1 overflow-x-auto">
                        {this.state.error.stack}
                      </pre>
                    </div>

                    {this.state.errorInfo && (
                      <div>
                        <h4 className="font-medium text-orange-800">Component Stack:</h4>
                        <pre className="text-xs text-orange-700 bg-orange-100 p-2 rounded mt-1 overflow-x-auto">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Default export
export default ErrorBoundary

// Functional wrapper component for easier usage
export function ErrorBoundaryWrapper({ children, ...props }: Omit<ErrorBoundaryProps, 'children'>) {
  return (
    <ErrorBoundary {...props}>
      {children}
    </ErrorBoundary>
  )
}