import React, { useState } from 'react'
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  TrendingUp,
  Activity,
  Zap,
  DollarSign,
  Play,
  RefreshCw,
  Eye,
  Download
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { CompatibilityMatrixResponse, CompatibilityTrend } from '@/types/api'
import { useCompatibilityMatrix, useCompatibilityTrends, useTestPromptCompatibility } from '@/hooks/api'

interface PromptCompatibilityProfileProps {
  promptId: string
  version?: string
}

export function PromptCompatibilityProfile({ promptId, version }: PromptCompatibilityProfileProps) {
  const [isTesting, setIsTesting] = useState(false)

  const { data: matrixData, isLoading: matrixLoading, error: matrixError } = useCompatibilityMatrix(promptId, version)
  const { data: trendsData, isLoading: trendsLoading } = useCompatibilityTrends(promptId, 30)
  const testCompatibility = useTestPromptCompatibility()

  const handleRunTest = async () => {
    setIsTesting(true)
    try {
      if (version) {
        await testCompatibility.mutateAsync({ promptId, version, providers: undefined })
      }
    } finally {
      setIsTesting(false)
    }
  }

  const getCompatibilityStatus = (status: string) => {
    switch (status) {
      case 'works':
        return { color: 'text-green-600', icon: CheckCircle, label: 'Compatible' }
      case 'needs_tuning':
        return { color: 'text-yellow-600', icon: AlertTriangle, label: 'Needs Tuning' }
      case 'not_supported':
        return { color: 'text-red-600', icon: XCircle, label: 'Not Supported' }
      default:
        return { color: 'text-gray-600', icon: XCircle, label: 'Unknown' }
    }
  }

  const getQualityColor = (score: number) => {
    if (score >= 0.9) return 'text-green-600'
    if (score >= 0.7) return 'text-yellow-600'
    return 'text-red-600'
  }

  if (matrixLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (matrixError || !matrixData) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load compatibility data. Please try again later.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Prompt Compatibility Profile</h1>
          <p className="text-muted-foreground">
            {promptId} {version ? `v${version}` : ''}
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
          <Button onClick={handleRunTest} disabled={isTesting}>
            {isTesting ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Run Test
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {matrixData.summary.working_count} / {matrixData.summary.total_providers}
            </div>
            <p className="text-xs text-muted-foreground">
              Compatible providers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {Math.round((matrixData.summary.working_count / matrixData.summary.total_providers) * 100)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Overall compatibility
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Issues Found</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {matrixData.summary.needs_tuning_count}
            </div>
            <p className="text-xs text-muted-foreground">
              Need optimization
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Test</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {matrixData.cached ? 'Cached' : 'Recent'}
            </div>
            <p className="text-xs text-muted-foreground">
              Test result age
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Prompt Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Prompt Preview</CardTitle>
          <CardDescription>
            Current prompt content being tested
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm max-h-32 overflow-y-auto">
            {matrixData.prompt_preview || 'No preview available'}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Results */}
      <Tabs defaultValue="results" className="space-y-4">
        <TabsList>
          <TabsTrigger value="results">Test Results</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="results" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(matrixData.results).map(([provider, result]) => {
              const status = getCompatibilityStatus(result.status)
              const StatusIcon = status.icon

              return (
                <Card key={provider}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="capitalize">{provider}</CardTitle>
                      <Badge variant={result.status === 'works' ? 'default' : result.status === 'needs_tuning' ? 'secondary' : 'destructive'}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {status.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Quality Score</div>
                        <div className={`text-lg font-semibold ${getQualityColor(result.quality_score)}`}>
                          {(result.quality_score * 100).toFixed(0)}%
                        </div>
                        <Progress value={result.quality_score * 100} className="mt-1" />
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Response Time</div>
                        <div className="text-lg font-semibold">
                          {result.response_time.toFixed(1)}s
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {result.response_time < 1 ? 'Fast' : result.response_time < 2 ? 'Normal' : 'Slow'}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Estimated Cost</div>
                      <div className="flex items-center space-x-1">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">${result.estimated_cost.toFixed(4)}</span>
                      </div>
                    </div>

                    {result.error && (
                      <Alert>
                        <XCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          {result.error}
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        <Eye className="h-3 w-3 mr-1" />
                        View Details
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Play className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Optimization Recommendations</CardTitle>
              <CardDescription>
                AI-generated suggestions to improve prompt compatibility
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {matrixData.recommendations.map((recommendation, index) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex items-start space-x-3">
                      <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
                      <div>
                        <h4 className="font-medium mb-1">Recommendation {index + 1}</h4>
                        <p className="text-sm text-muted-foreground">{recommendation}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {matrixData.recommendations.length === 0 && (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Recommendations</h3>
                    <p className="text-muted-foreground">
                      Your prompt is performing optimally across all tested providers.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          {trendsLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : trendsData ? (
            <Card>
              <CardHeader>
                <CardTitle>Compatibility Trends (Last 30 Days)</CardTitle>
                <CardDescription>
                  Historical performance changes over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(trendsData.trends).map(([date, providers]) => (
                    <div key={date} className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-2">{date}</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {Object.entries(providers).map(([provider, data]) => {
                          const status = getCompatibilityStatus(data.status)
                          const StatusIcon = status.icon

                          return (
                            <div key={provider} className="text-center">
                              <StatusIcon className={`h-4 w-4 mx-auto mb-1 ${status.color}`} />
                              <div className="text-sm font-medium capitalize">{provider}</div>
                              <div className="text-xs text-muted-foreground">
                                Quality: {(data.quality_score * 100).toFixed(0)}%
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <div className="text-center">
                  <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Trend Data Available</h3>
                  <p className="text-muted-foreground">
                    Historical trend data will appear after running multiple tests over time.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Test Execution Details</CardTitle>
              <CardDescription>
                Detailed technical information about the compatibility tests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Test Execution Time</div>
                    <div className="text-lg">
                      {new Date().toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Test Environment</div>
                    <div className="text-lg">Production</div>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-2">Providers Tested</div>
                  <div className="flex flex-wrap gap-2">
                    {Object.keys(matrixData.results).map(provider => (
                      <Badge key={provider} variant="outline" className="capitalize">
                        {provider}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-2">Test Configuration</div>
                  <div className="bg-muted p-3 rounded-lg text-sm font-mono">
                    {JSON.stringify({
                      promptId,
                      version,
                      providers: Object.keys(matrixData.results),
                      forceRefresh: !matrixData.cached
                    }, null, 2)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}