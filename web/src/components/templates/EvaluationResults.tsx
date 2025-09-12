import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { 
  BarChart3, 
  CheckCircle, 
  XCircle, 
  Clock, 
  TrendingUp,
  TrendingDown,
  Zap,
  DollarSign,
  Target
} from 'lucide-react'
import { EvaluationRun, EvaluationMetrics } from '@/types/api'
import { cn } from '@/lib/utils'

interface EvaluationResultsProps {
  templateId: string
  evaluations: EvaluationRun[]
  onRunEvaluation: (suiteId: string) => void
  onViewDetails: (evaluationId: string) => void
}

interface MetricCardProps {
  title: string
  value: string | number
  unit?: string
  trend?: 'up' | 'down' | 'stable'
  icon: React.ReactNode
  description?: string
}

function MetricCard({ title, value, unit, trend, icon, description }: MetricCardProps) {
  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-500" />
      case 'down': return <TrendingDown className="h-4 w-4 text-red-500" />
      default: return null
    }
  }

  const getTrendColor = () => {
    switch (trend) {
      case 'up': return 'text-green-600'
      case 'down': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold">
                {value}
                {unit && <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>}
              </p>
              {getTrendIcon()}
            </div>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          <div className="p-2 bg-muted rounded-lg">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function EvaluationResults({
  templateId,
  evaluations,
  onRunEvaluation,
  onViewDetails
}: EvaluationResultsProps) {
  const latestEvaluation = evaluations[0]
  const avgAccuracy = evaluations.length > 0 
    ? evaluations.reduce((sum, evaluation) => sum + (evaluation.metrics.accuracy || 0), 0) / evaluations.length
    : 0
  
  const avgLatency = evaluations.length > 0
    ? evaluations.reduce((sum, evaluation) => sum + (evaluation.metrics.latency_ms || 0), 0) / evaluations.length
    : 0

  const avgCost = evaluations.length > 0
    ? evaluations.reduce((sum, evaluation) => sum + (evaluation.metrics.cost_usd || 0), 0) / evaluations.length
    : 0

  const passRate = evaluations.length > 0
    ? (evaluations.filter(evaluation => evaluation.passed).length / evaluations.length) * 100
    : 0

  const metricCards = [
    {
      title: 'Average Accuracy',
      value: (avgAccuracy * 100).toFixed(1),
      unit: '%',
      trend: avgAccuracy > 0.8 ? 'up' : 'down',
      icon: <Target className="h-5 w-5 text-blue-500" />,
      description: 'Average accuracy across all evaluations'
    },
    {
      title: 'Average Latency',
      value: avgLatency.toFixed(0),
      unit: 'ms',
      trend: avgLatency < 1000 ? 'up' : 'down',
      icon: <Clock className="h-5 w-5 text-orange-500" />,
      description: 'Average response time'
    },
    {
      title: 'Average Cost',
      value: avgCost.toFixed(4),
      unit: 'USD',
      trend: avgCost < 0.01 ? 'up' : 'down',
      icon: <DollarSign className="h-5 w-5 text-green-500" />,
      description: 'Average cost per evaluation'
    },
    {
      title: 'Pass Rate',
      value: passRate.toFixed(1),
      unit: '%',
      trend: passRate > 80 ? 'up' : 'down',
      icon: <CheckCircle className="h-5 w-5 text-purple-500" />,
      description: 'Percentage of evaluations that passed'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Evaluation Results</h3>
          <p className="text-sm text-muted-foreground">
            Performance metrics and test results for this template
          </p>
        </div>
        <Button onClick={() => onRunEvaluation('default')}>
          <Zap className="h-4 w-4 mr-2" />
          Run Evaluation
        </Button>
      </div>

      {/* Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((metric, index) => (
          <MetricCard key={index} {...metric} />
        ))}
      </div>

      {/* Recent Evaluations */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Evaluations</CardTitle>
          <CardDescription>
            Latest test runs and their results
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {evaluations.slice(0, 5).map((evaluation) => (
              <div key={evaluation.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "p-2 rounded-full",
                    evaluation.passed ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                  )}>
                    {evaluation.passed ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Suite: {evaluation.suite_id}</span>
                      <Badge variant={evaluation.passed ? "default" : "destructive"}>
                        {evaluation.passed ? "Passed" : "Failed"}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Version {evaluation.version} • {new Date(evaluation.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right text-sm">
                    <div className="text-muted-foreground">Accuracy</div>
                    <div className="font-medium">
                      {((evaluation.metrics.accuracy || 0) * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="text-muted-foreground">Latency</div>
                    <div className="font-medium">
                      {evaluation.metrics.latency_ms || 0}ms
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="text-muted-foreground">Cost</div>
                    <div className="font-medium">
                      ${(evaluation.metrics.cost_usd || 0).toFixed(4)}
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => onViewDetails(evaluation.id)}
                  >
                    View Details
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {evaluations.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No evaluations found</h3>
            <p className="text-muted-foreground mb-4">
              Run your first evaluation to see performance metrics
            </p>
            <Button onClick={() => onRunEvaluation('default')}>
              <Zap className="h-4 w-4 mr-2" />
              Run Evaluation
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}