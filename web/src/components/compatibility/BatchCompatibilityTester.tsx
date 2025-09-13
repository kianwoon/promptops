import { useState } from 'react'
import {
  Play,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Download,
  Pause
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { BatchTestResult } from '@/types/api'
import { useRunBatchCompatibilityTests } from '@/hooks/api'

interface BatchCompatibilityTesterProps {
  projectId?: string
}

export function BatchCompatibilityTester({ projectId }: BatchCompatibilityTesterProps) {
  const [selectedPrompts, setSelectedPrompts] = useState<string[]>([])
  const [selectedProviders, setSelectedProviders] = useState<string[]>(['openai', 'anthropic', 'qwen', 'llama'])
  const [testResults, setTestResults] = useState<BatchTestResult | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState(0)

  const runBatchTests = useRunBatchCompatibilityTests()

  // Mock prompt data - in a real app, this would come from the API
  const availablePrompts = [
    { id: 'prompt1', name: 'Customer Support Response', module: 'Support Module' },
    { id: 'prompt2', name: 'Code Review Assistant', module: 'Development Module' },
    { id: 'prompt3', name: 'Sales Assistant', module: 'Sales Module' },
    { id: 'prompt4', name: 'Technical Documentation', module: 'Documentation Module' },
    { id: 'prompt5', name: 'User Onboarding', module: 'User Experience Module' }
  ]

  const availableProviders = [
    { id: 'openai', name: 'OpenAI GPT-4', icon: '🤖' },
    { id: 'anthropic', name: 'Anthropic Claude', icon: '🧠' },
    { id: 'qwen', name: 'Alibaba Qwen', icon: '🐉' },
    { id: 'llama', name: 'Meta LLaMA', icon: '🦙' }
  ]

  const handlePromptToggle = (promptId: string, checked: boolean) => {
    if (checked) {
      setSelectedPrompts([...selectedPrompts, promptId])
    } else {
      setSelectedPrompts(selectedPrompts.filter(id => id !== promptId))
    }
  }

  const handleProviderToggle = (providerId: string, checked: boolean) => {
    if (checked) {
      setSelectedProviders([...selectedProviders, providerId])
    } else {
      setSelectedProviders(selectedProviders.filter(id => id !== providerId))
    }
  }

  const handleSelectAllPrompts = (checked: boolean) => {
    if (checked) {
      setSelectedPrompts(availablePrompts.map(p => p.id))
    } else {
      setSelectedPrompts([])
    }
  }

  const handleSelectAllProviders = (checked: boolean) => {
    if (checked) {
      setSelectedProviders(availableProviders.map(p => p.id))
    } else {
      setSelectedProviders([])
    }
  }

  const handleRunBatchTest = async () => {
    if (selectedPrompts.length === 0) {
      alert('Please select at least one prompt to test')
      return
    }

    if (selectedProviders.length === 0) {
      alert('Please select at least one provider to test')
      return
    }

    setIsRunning(true)
    setProgress(0)

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90))
      }, 500)

      const result = await runBatchTests.mutateAsync({
        promptIds: selectedPrompts,
        providers: selectedProviders
      })

      clearInterval(progressInterval)
      setProgress(100)
      setTestResults(result)
    } catch (error) {
      console.error('Batch test failed:', error)
    } finally {
      setIsRunning(false)
    }
  }

  const exportResults = () => {
    if (!testResults) return

    const reportData = {
      timestamp: new Date().toISOString(),
      batchId: testResults.batch_id,
      totalPromptsTested: testResults.total_prompts_tested,
      providersTested: selectedProviders,
      summary: testResults.summary,
      results: testResults.results,
      errors: testResults.errors
    }

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `compatibility-test-${testResults.batch_id}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const getStatusBadge = (result: any) => {
    const summary = result.summary
    const successRate = summary.working_count / summary.total_providers

    if (successRate >= 0.8) {
      return <Badge variant="default" className="bg-green-100 text-green-800">Excellent</Badge>
    } else if (successRate >= 0.6) {
      return <Badge variant="secondary">Good</Badge>
    } else if (successRate >= 0.4) {
      return <Badge variant="outline">Fair</Badge>
    } else {
      return <Badge variant="destructive">Poor</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Batch Compatibility Testing</h1>
          <p className="text-muted-foreground">
            Test multiple prompts across different providers simultaneously
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={exportResults} disabled={!testResults}>
            <Download className="h-4 w-4 mr-2" />
            Export Results
          </Button>
          <Button
            onClick={handleRunBatchTest}
            disabled={isRunning || selectedPrompts.length === 0 || selectedProviders.length === 0}
          >
            {isRunning ? (
              <Pause className="h-4 w-4 mr-2" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            {isRunning ? 'Testing...' : 'Run Batch Test'}
          </Button>
        </div>
      </div>

      {/* Progress */}
      {isRunning && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
              Running Compatibility Tests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="w-full" />
              <p className="text-xs text-muted-foreground">
                Testing {selectedPrompts.length} prompts across {selectedProviders.length} providers...
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="selection" className="space-y-4">
        <TabsList>
          <TabsTrigger value="selection">Test Selection</TabsTrigger>
          <TabsTrigger value="results" disabled={!testResults}>Results</TabsTrigger>
          <TabsTrigger value="summary" disabled={!testResults}>Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="selection" className="space-y-6">
          {/* Prompt Selection */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Select Prompts</CardTitle>
                  <CardDescription>
                    Choose which prompts to include in the batch test
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">Select All</span>
                  <Checkbox
                    checked={selectedPrompts.length === availablePrompts.length}
                    onCheckedChange={handleSelectAllPrompts}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {availablePrompts.map((prompt) => (
                  <div key={prompt.id} className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50">
                    <Checkbox
                      id={prompt.id}
                      checked={selectedPrompts.includes(prompt.id)}
                      onCheckedChange={(checked) => handlePromptToggle(prompt.id, checked as boolean)}
                    />
                    <div className="flex-1">
                      <label htmlFor={prompt.id} className="font-medium cursor-pointer">
                        {prompt.name}
                      </label>
                      <div className="text-sm text-muted-foreground">{prompt.module}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-sm text-muted-foreground">
                {selectedPrompts.length} of {availablePrompts.length} prompts selected
              </div>
            </CardContent>
          </Card>

          {/* Provider Selection */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Select Providers</CardTitle>
                  <CardDescription>
                    Choose which model providers to test against
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">Select All</span>
                  <Checkbox
                    checked={selectedProviders.length === availableProviders.length}
                    onCheckedChange={handleSelectAllProviders}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableProviders.map((provider) => (
                  <div key={provider.id} className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50">
                    <Checkbox
                      id={provider.id}
                      checked={selectedProviders.includes(provider.id)}
                      onCheckedChange={(checked) => handleProviderToggle(provider.id, checked as boolean)}
                    />
                    <div className="flex-1">
                      <label htmlFor={provider.id} className="font-medium cursor-pointer flex items-center space-x-2">
                        <span>{provider.icon}</span>
                        <span>{provider.name}</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-sm text-muted-foreground">
                {selectedProviders.length} of {availableProviders.length} providers selected
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          {testResults && (
            <>
              {/* Results Overview */}
              <Card>
                <CardHeader>
                  <CardTitle>Test Results Overview</CardTitle>
                  <CardDescription>
                    Summary of the batch compatibility test
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{testResults.total_prompts_tested}</div>
                      <div className="text-sm text-muted-foreground">Prompts Tested</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {testResults.summary.best_overall_provider || 'N/A'}
                      </div>
                      <div className="text-sm text-muted-foreground">Best Provider</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {Object.keys(testResults.errors).length}
                      </div>
                      <div className="text-sm text-muted-foreground">Errors</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {testResults.summary.providers_tested.length}
                      </div>
                      <div className="text-sm text-muted-foreground">Providers Tested</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Individual Results */}
              <div className="space-y-4">
                {Object.entries(testResults.results).map(([promptKey, result]) => {
                  const promptName = promptKey.split('@')[0]
                  return (
                    <Card key={promptKey}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{promptName}</CardTitle>
                          {getStatusBadge(result)}
                        </div>
                        <CardDescription>
                          {result.summary.working_count}/{result.summary.total_providers} providers working
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                          {Object.entries(result.results).map(([provider, providerResult]) => {
                            const getStatusIcon = (status: string) => {
                              switch (status) {
                                case 'works':
                                  return <CheckCircle className="h-4 w-4 text-green-500" />
                                case 'needs_tuning':
                                  return <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                case 'not_supported':
                                  return <XCircle className="h-4 w-4 text-red-500" />
                                default:
                                  return <XCircle className="h-4 w-4 text-gray-500" />
                              }
                            }

                            return (
                              <div key={provider} className="text-center p-3 border rounded-lg">
                                <div className="flex items-center justify-center mb-2">
                                  {getStatusIcon(providerResult.status)}
                                </div>
                                <div className="font-medium capitalize">{provider}</div>
                                <div className="text-sm text-muted-foreground">
                                  Quality: {(providerResult.quality_score * 100).toFixed(0)}%
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {providerResult.response_time.toFixed(1)}s
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        {result.recommendations.length > 0 && (
                          <div className="mt-4">
                            <h4 className="font-medium mb-2">Recommendations</h4>
                            <div className="text-sm text-muted-foreground">
                              {result.recommendations[0]}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              {/* Errors */}
              {Object.keys(testResults.errors).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Test Errors</CardTitle>
                    <CardDescription>
                      Issues encountered during testing
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(testResults.errors).map(([prompt, error]) => (
                        <Alert key={prompt}>
                          <XCircle className="h-4 w-4" />
                          <AlertDescription>
                            <strong>{prompt}:</strong> {error}
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="summary" className="space-y-4">
          {testResults && (
            <>
              {/* Provider Performance Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Provider Performance Summary</CardTitle>
                  <CardDescription>
                    Overall success rates across all tested prompts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(testResults.summary.provider_success_rates).map(([provider, rate]) => (
                      <div key={provider} className="space-y-2">
                        <div className="flex justify-between">
                          <span className="font-medium capitalize">{provider}</span>
                          <span className="text-sm text-muted-foreground">
                            {(rate * 100).toFixed(1)}% success rate
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all duration-300"
                            style={{ width: `${rate * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Test Summary Statistics */}
              <Card>
                <CardHeader>
                  <CardTitle>Test Summary</CardTitle>
                  <CardDescription>
                    Detailed statistics about the batch test
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <h4 className="font-medium mb-2">Providers by Success Rate</h4>
                      <div className="space-y-1">
                        {Object.entries(testResults.summary.provider_success_rates)
                          .sort(([,a], [,b]) => b - a)
                          .map(([provider, rate]) => (
                            <div key={provider} className="flex justify-between text-sm">
                              <span className="capitalize">{provider}</span>
                              <span>{(rate * 100).toFixed(1)}%</span>
                            </div>
                          ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Test Configuration</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Batch ID</span>
                          <span>{testResults.batch_id}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Test Duration</span>
                          <span>~2 minutes</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Test Date</span>
                          <span>{new Date().toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}