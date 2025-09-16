import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Copy, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'

interface ModelTestResult {
  provider_id: string
  provider_name: string
  provider_type: string
  response_content: string
  response_time_ms: number
  tokens_used?: number
  error?: string
  status: 'success' | 'error' | 'timeout'
}

interface ModelTestResultsProps {
  results: ModelTestResult[]
  isTesting: boolean
}

export function ModelTestResults({ results, isTesting }: ModelTestResultsProps) {
  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />
      case 'timeout':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />
      default:
        return <AlertTriangle className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-100 text-green-800">Success</Badge>
      case 'error':
        return <Badge variant="destructive">Error</Badge>
      case 'timeout':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Timeout</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  const formatResponseTime = (timeMs: number) => {
    if (timeMs < 1000) {
      return `${timeMs}ms`
    }
    return `${(timeMs / 1000).toFixed(1)}s`
  }

  if (isTesting) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-6 bg-gray-200 rounded w-16"></div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                <div className="h-4 bg-gray-200 rounded w-4/6"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertTriangle className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No test results</h3>
          <p className="text-muted-foreground text-center">
            Run a test to see how different AI providers respond to your prompt.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {results.map((result) => (
        <Card key={result.provider_id} className="h-fit">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <CardTitle className="text-lg truncate">
                  {result.provider_name}
                </CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {result.provider_type}
                  </Badge>
                  {getStatusBadge(result.status)}
                </div>
              </div>
              <div className="flex items-center text-xs text-muted-foreground">
                {getStatusIcon(result.status)}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Response Content */}
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">Response</div>
                <div className="bg-muted p-3 rounded-md text-sm max-h-60 overflow-y-auto">
                  {result.error ? (
                    <div className="text-red-600">{result.error}</div>
                  ) : result.response_content ? (
                    <div className="whitespace-pre-wrap">{result.response_content}</div>
                  ) : (
                    <div className="text-muted-foreground">No response</div>
                  )}
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{formatResponseTime(result.response_time_ms)}</span>
                </div>
                {result.tokens_used && (
                  <div className="text-muted-foreground">
                    {result.tokens_used} tokens
                  </div>
                )}
              </div>

              {/* Copy Button */}
              {result.response_content && !result.error && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => copyToClipboard(result.response_content)}
                >
                  <Copy className="w-3 h-3 mr-2" />
                  Copy Response
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}