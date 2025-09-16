import { useState } from 'react'
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Play,
  RefreshCw,
  Download,
  TrendingUp,
  BarChart3,
  Eye,
  Search
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { ProjectCompatibilitySummary } from '@/types/api'
import { useProjectCompatibilitySummary, useRunBatchCompatibilityTests } from '@/hooks/api'
import { BatchCompatibilityTester } from './BatchCompatibilityTester'

interface CompatibilityMatrixDashboardProps {
  projectId?: string
}

export function CompatibilityMatrixDashboard({ projectId }: CompatibilityMatrixDashboardProps) {
  const [selectedPrompt, setSelectedPrompt] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterProvider, setFilterProvider] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [isTesting, setIsTesting] = useState(false)

  const { data: projectSummary, isLoading: summaryLoading } = useProjectCompatibilitySummary(projectId || '')
  const runBatchTests = useRunBatchCompatibilityTests()

  const handleRunBatchTests = async (promptIds: string[]) => {
    setIsTesting(true)
    try {
      await runBatchTests.mutateAsync({ promptIds })
    } finally {
      setIsTesting(false)
    }
  }

  const exportCompatibilityReport = () => {
    // This would generate and download a comprehensive compatibility report
    console.log('Exporting compatibility report...')
  }

  if (summaryLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Compatibility Matrix</h1>
          <p className="text-muted-foreground">
            Manage and analyze model compatibility across your prompts
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={exportCompatibilityReport}>
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
          <Button onClick={() => handleRunBatchTests([])} disabled={isTesting}>
            {isTesting ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Run Tests
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      {projectSummary && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tests</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{projectSummary.total_tests}</div>
              <p className="text-xs text-muted-foreground">
                Compatibility tests run
              </p>
            </CardContent>
          </Card>

          {Object.entries(projectSummary.provider_summary).map(([provider, summary]) => (
            <Card key={provider}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{provider}</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {summary.compatible}
                </div>
                <p className="text-xs text-muted-foreground">
                  Compatible prompts ({Math.round((summary.compatible / (summary.compatible + summary.incompatible)) * 100)}%)
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Filters & Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Search Prompts</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Provider</label>
              <Select value={filterProvider} onValueChange={setFilterProvider}>
                <SelectTrigger>
                  <SelectValue placeholder="All providers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Providers</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="qwen">Qwen</SelectItem>
                  <SelectItem value="llama">LLaMA</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="works">Works</SelectItem>
                  <SelectItem value="needs_tuning">Needs Tuning</SelectItem>
                  <SelectItem value="not_supported">Not Supported</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Prompt Selection</label>
              <Select value={selectedPrompt} onValueChange={setSelectedPrompt}>
                <SelectTrigger>
                  <SelectValue placeholder="Select prompt" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Prompts</SelectItem>
                  {/* This would be populated with actual prompts */}
                  <SelectItem value="prompt1">Customer Support Prompt</SelectItem>
                  <SelectItem value="prompt2">Code Review Prompt</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs defaultValue="matrix" className="space-y-4">
        <TabsList>
          <TabsTrigger value="matrix">Compatibility Matrix</TabsTrigger>
          <TabsTrigger value="batch">Batch Testing</TabsTrigger>
          <TabsTrigger value="summary">Summary Overview</TabsTrigger>
          <TabsTrigger value="trends">Trends Analysis</TabsTrigger>
          <TabsTrigger value="details">Test Details</TabsTrigger>
        </TabsList>

        <TabsContent value="matrix" className="space-y-4">
          <CompatibilityMatrix />
        </TabsContent>

        <TabsContent value="batch" className="space-y-4">
          <BatchCompatibilityTester projectId={projectId} />
        </TabsContent>

        <TabsContent value="summary" className="space-y-4">
          <CompatibilitySummary />
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <CompatibilityTrendsAnalysis />
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          <CompatibilityTestDetails />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Sub-components for different views
function CompatibilityMatrix() {
  // Mock data for demonstration
  const matrixData = [
    {
      promptId: 'prompt1',
      promptName: 'Customer Support Response',
      providers: {
        openai: { status: 'works', quality: 0.95, responseTime: 1.2 },
        anthropic: { status: 'needs_tuning', quality: 0.82, responseTime: 2.1 },
        qwen: { status: 'works', quality: 0.88, responseTime: 0.8 },
        llama: { status: 'not_supported', quality: 0, responseTime: 0 }
      }
    },
    {
      promptId: 'prompt2',
      promptName: 'Code Review Assistant',
      providers: {
        openai: { status: 'works', quality: 0.91, responseTime: 1.5 },
        anthropic: { status: 'works', quality: 0.89, responseTime: 2.3 },
        qwen: { status: 'needs_tuning', quality: 0.76, responseTime: 1.1 },
        llama: { status: 'needs_tuning', quality: 0.71, responseTime: 0.9 }
      }
    }
  ]

  const providers = ['openai', 'anthropic', 'qwen', 'llama']

  const getCellContent = (status: string, quality: number, responseTime: number) => {
    const getCompatibilityColor = (status: string) => {
      switch (status) {
        case 'works':
          return 'bg-green-100 text-green-800 border-green-200'
        case 'needs_tuning':
          return 'bg-yellow-100 text-yellow-800 border-yellow-200'
        case 'not_supported':
          return 'bg-red-100 text-red-800 border-red-200'
        default:
          return 'bg-gray-100 text-gray-800 border-gray-200'
      }
    }

    if (status === 'not_supported') {
      return (
        <Badge variant="outline" className={getCompatibilityColor(status)}>
          <XCircle className="h-3 w-3 mr-1" />
          Not Supported
        </Badge>
      )
    }

    return (
      <div className="text-center space-y-1">
        <Badge variant="outline" className={getCompatibilityColor(status)}>
          {status === 'works' ? (
            <CheckCircle className="h-3 w-3 mr-1" />
          ) : (
            <AlertTriangle className="h-3 w-3 mr-1" />
          )}
          {status === 'works' ? 'Works' : 'Tuning'}
        </Badge>
        <div className="text-xs text-muted-foreground">
          <div>Quality: {(quality * 100).toFixed(0)}%</div>
          <div>{responseTime}s</div>
        </div>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prompt Compatibility Matrix</CardTitle>
        <CardDescription>
          Visual overview of prompt compatibility across different model providers
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-4 font-medium">Prompt</th>
                {providers.map(provider => (
                  <th key={provider} className="text-center p-4 font-medium capitalize">
                    {provider}
                  </th>
                ))}
                <th className="text-center p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {matrixData.map((row) => (
                <tr key={row.promptId} className="border-b hover:bg-muted/50">
                  <td className="p-4">
                    <div>
                      <div className="font-medium">{row.promptName}</div>
                      <div className="text-sm text-muted-foreground">{row.promptId}</div>
                    </div>
                  </td>
                  {providers.map(provider => {
                    const result = row.providers[provider as keyof typeof row.providers]
                    return (
                      <td key={provider} className="p-4 text-center">
                        {getCellContent(result.status, result.quality, result.responseTime)}
                      </td>
                    )
                  })}
                  <td className="p-4 text-center">
                    <div className="flex justify-center space-x-1">
                      <Button variant="ghost" size="sm">
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Play className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function CompatibilitySummary() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Provider Performance</CardTitle>
          <CardDescription>
            Overall compatibility rates by provider
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { provider: 'OpenAI', compatible: 85, total: 100, rate: 85 },
              { provider: 'Anthropic', compatible: 78, total: 100, rate: 78 },
              { provider: 'Qwen', compatible: 72, total: 100, rate: 72 },
              { provider: 'LLaMA', compatible: 65, total: 100, rate: 65 }
            ].map((stat) => (
              <div key={stat.provider} className="space-y-2">
                <div className="flex justify-between">
                  <span className="font-medium">{stat.provider}</span>
                  <span className="text-sm text-muted-foreground">
                    {stat.compatible}/{stat.total} ({stat.rate}%)
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${stat.rate}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Test Results</CardTitle>
          <CardDescription>
            Latest compatibility test outcomes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { prompt: 'Customer Support', provider: 'OpenAI', status: 'success', time: '2 min ago' },
              { prompt: 'Code Review', provider: 'Anthropic', status: 'warning', time: '5 min ago' },
              { prompt: 'Sales Assistant', provider: 'Qwen', status: 'success', time: '10 min ago' },
              { prompt: 'Technical Support', provider: 'LLaMA', status: 'error', time: '15 min ago' }
            ].map((result) => (
              <div key={`${result.prompt}-${result.provider}`} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium">{result.prompt}</div>
                  <div className="text-sm text-muted-foreground">{result.provider}</div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant={
                    result.status === 'success' ? 'default' :
                    result.status === 'warning' ? 'secondary' : 'destructive'
                  }>
                    {result.status === 'success' ? 'Success' :
                     result.status === 'warning' ? 'Warning' : 'Error'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{result.time}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function CompatibilityTrendsAnalysis() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Compatibility Trends</CardTitle>
        <CardDescription>
          Track compatibility changes over time
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-96 flex items-center justify-center bg-muted/20 rounded-lg">
          <div className="text-center">
            <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Trend Analysis Coming Soon</h3>
            <p className="text-muted-foreground">
              Historical compatibility trends will be displayed here
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function CompatibilityTestDetails() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Test Execution Details</CardTitle>
        <CardDescription>
          Detailed test results and execution logs
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-96 flex items-center justify-center bg-muted/20 rounded-lg">
          <div className="text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Test Details Coming Soon</h3>
            <p className="text-muted-foreground">
              Detailed test execution results will be displayed here
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}