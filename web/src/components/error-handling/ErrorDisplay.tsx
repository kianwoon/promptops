import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertTriangle,
  Info,
  Bug,
  FileText,
  Copy,
  Eye,
  EyeOff,
  AlertCircle,
  Clock
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ErrorInfo {
  componentStack?: string
}

interface ErrorDisplayProps {
  error: Error | null
  errorInfo?: ErrorInfo | null
  errorId?: string
  className?: string
  showDetails?: boolean
  expandable?: boolean
  showTimestamp?: boolean
  context?: string
}

export function ErrorDisplay({
  error,
  errorInfo,
  errorId,
  className,
  showDetails = false,
  expandable = true,
  showTimestamp = true,
  context
}: ErrorDisplayProps) {
  const [showTechnicalDetails, setShowTechnicalDetails] = React.useState(showDetails)
  const [isCopied, setIsCopied] = React.useState(false)

  if (!error) {
    return null
  }

  const errorType = getErrorType(error)
  const errorSeverity = getErrorSeverity(error)
  const userFriendlyMessage = getUserFriendlyMessage(error)
  const timestamp = errorInfo ? new Date().toISOString() : undefined

  const handleCopyDetails = async () => {
    const details = formatErrorDetails(error, errorInfo, errorId, context)
    try {
      await navigator.clipboard.writeText(details)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy error details:', err)
    }
  }

  const getSeverityColor = (severity: 'low' | 'medium' | 'high' | 'critical') => {
    switch (severity) {
      case 'critical':
        return 'destructive'
      case 'high':
        return 'destructive'
      case 'medium':
        return 'secondary'
      case 'low':
        return 'outline'
      default:
        return 'outline'
    }
  }

  const getSeverityIcon = (severity: 'low' | 'medium' | 'high' | 'critical') => {
    switch (severity) {
      case 'critical':
      case 'high':
        return <AlertTriangle className="h-4 w-4" />
      case 'medium':
        return <AlertCircle className="h-4 w-4" />
      case 'low':
        return <Info className="h-4 w-4" />
      default:
        return <AlertCircle className="h-4 w-4" />
    }
  }

  return (
    <Card className={cn("border-destructive/20", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                {errorType}
                <Badge variant={getSeverityColor(errorSeverity)} className="text-xs">
                  {getSeverityIcon(errorSeverity)}
                  {errorSeverity.toUpperCase()}
                </Badge>
              </CardTitle>
              <CardDescription className="mt-1">
                {userFriendlyMessage}
              </CardDescription>
            </div>
          </div>

          {expandable && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
              className="h-8 w-8 p-0"
            >
              {showTechnicalDetails ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>

        {/* Additional Context */}
        {context && (
          <div className="mt-3">
            <Badge variant="outline" className="text-xs">
              <FileText className="h-3 w-3 mr-1" />
              Context: {context}
            </Badge>
          </div>
        )}

        {/* Error ID and Timestamp */}
        <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-muted-foreground">
          {errorId && (
            <div className="flex items-center gap-1">
              <Bug className="h-3 w-3" />
              <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                ID: {errorId}
              </span>
            </div>
          )}
          {showTimestamp && timestamp && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{new Date(timestamp).toLocaleString()}</span>
            </div>
          )}
        </div>
      </CardHeader>

      {(showTechnicalDetails || !expandable) && (
        <CardContent className="space-y-4">
          {/* Error Message */}
          <div>
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Error Message
            </h4>
            <div className="bg-destructive/10 border border-destructive/20 rounded p-3">
              <p className="text-sm font-mono text-destructive-foreground break-all">
                {error.message}
              </p>
            </div>
          </div>

          {/* Stack Trace */}
          {error.stack && (
            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Bug className="h-4 w-4" />
                Stack Trace
              </h4>
              <div className="bg-muted border rounded p-3 max-h-64 overflow-y-auto">
                <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                  {error.stack}
                </pre>
              </div>
            </div>
          )}

          {/* Component Stack */}
          {errorInfo?.componentStack && (
            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Component Stack
              </h4>
              <div className="bg-muted border rounded p-3 max-h-48 overflow-y-auto">
                <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                  {errorInfo.componentStack}
                </pre>
              </div>
            </div>
          )}

          {/* Error Properties */}
          {Object.keys(error).length > 0 && (
            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Info className="h-4 w-4" />
                Error Properties
              </h4>
              <div className="bg-muted border rounded p-3 max-h-48 overflow-y-auto">
                <pre className="text-xs font-mono">
                  {JSON.stringify(
                    Object.fromEntries(
                      Object.entries(error).filter(([key]) => key !== 'message' && key !== 'stack')
                    ),
                    null,
                    2
                  )}
                </pre>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              onClick={handleCopyDetails}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              {isCopied ? (
                <>
                  <Copy className="h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy Details
                </>
              )}
            </Button>

            {expandable && (
              <Button
                onClick={() => setShowTechnicalDetails(false)}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <EyeOff className="h-4 w-4" />
                Hide Details
              </Button>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

// Minimal error display for inline usage
export function MinimalErrorDisplay({
  error,
  errorId,
  className,
  showCopy = true
}: {
  error: Error | null
  errorId?: string
  className?: string
  showCopy?: boolean
}) {
  const [isCopied, setIsCopied] = React.useState(false)

  if (!error) return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(error.message)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy error message:', err)
    }
  }

  return (
    <Alert className={cn("border-destructive/20", className)}>
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <span className="break-all">{error.message}</span>
        <div className="flex items-center gap-2 ml-2 flex-shrink-0">
          {errorId && (
            <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
              {errorId}
            </span>
          )}
          {showCopy && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-6 w-6 p-0"
            >
              {isCopied ? (
                <Copy className="h-3 w-3 text-green-600" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  )
}

// Helper functions
function getErrorType(error: Error): string {
  if (error.name === 'TypeError') return 'Type Error'
  if (error.name === 'ReferenceError') return 'Reference Error'
  if (error.name === 'SyntaxError') return 'Syntax Error'
  if (error.name === 'NetworkError') return 'Network Error'
  if (error.name === 'AxiosError') return 'API Error'
  return error.name || 'Runtime Error'
}

function getErrorSeverity(error: Error): 'low' | 'medium' | 'high' | 'critical' {
  // Network errors are typically high severity
  if (error.name === 'NetworkError' || error.message.includes('fetch')) {
    return 'high'
  }

  // Authentication errors are high severity
  if (error.message.includes('401') || error.message.includes('unauthorized')) {
    return 'high'
  }

  // Permission errors are medium severity
  if (error.message.includes('403') || error.message.includes('forbidden')) {
    return 'medium'
  }

  // Type and reference errors are typically high severity
  if (error.name === 'TypeError' || error.name === 'ReferenceError') {
    return 'high'
  }

  // Default to medium severity
  return 'medium'
}

function getUserFriendlyMessage(error: Error): string {
  // Network errors
  if (error.message.includes('fetch') || error.message.includes('network')) {
    return 'Unable to connect to the server. Please check your internet connection.'
  }

  // Authentication errors
  if (error.message.includes('401') || error.message.includes('unauthorized')) {
    return 'Your session has expired. Please log in again.'
  }

  // Permission errors
  if (error.message.includes('403') || error.message.includes('forbidden')) {
    return 'You do not have permission to perform this action.'
  }

  // Not found errors
  if (error.message.includes('404') || error.message.includes('not found')) {
    return 'The requested resource was not found.'
  }

  // Type errors
  if (error.name === 'TypeError') {
    return 'A data type error occurred. Please refresh the page and try again.'
  }

  // Reference errors
  if (error.name === 'ReferenceError') {
    return 'A reference error occurred. Please refresh the page and try again.'
  }

  // Default message
  return error.message || 'An unexpected error occurred.'
}

function formatErrorDetails(
  error: Error,
  errorInfo?: ErrorInfo | null,
  errorId?: string,
  context?: string
): string {
  const details = [
    'Error Details',
    '=============',
    '',
    `Error ID: ${errorId || 'N/A'}`,
    `Timestamp: ${new Date().toISOString()}`,
    `Type: ${error.name}`,
    `Message: ${error.message}`,
    '',
  ]

  if (context) {
    details.push(`Context: ${context}`, '')
  }

  if (error.stack) {
    details.push('Stack Trace:', error.stack, '')
  }

  if (errorInfo?.componentStack) {
    details.push('Component Stack:', errorInfo.componentStack, '')
  }

  details.push('Environment:', `URL: ${window.location.href}`, `User Agent: ${navigator.userAgent}`)

  return details.join('\n')
}