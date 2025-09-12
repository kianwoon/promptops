import React from 'react'
import { 
  FileText, 
  Rocket, 
  BarChart3, 
  Clock, 
  TrendingUp, 
  Users,
  Activity,
  DollarSign
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useDashboardStats, useUsageMetrics } from '@/hooks/api'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats()
  const { data: metrics, isLoading: metricsLoading } = useUsageMetrics()

  const formatChartDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    })
  }

  if (statsLoading || metricsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your PromptOps platform
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Templates</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_templates || 0}</div>
            <p className="text-xs text-muted-foreground">
              +12% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Deployments</CardTitle>
            <Rocket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_deployments || 0}</div>
            <p className="text-xs text-muted-foreground">
              +8% from last week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_requests?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">
              +23% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Running Evaluations</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.active_evaluations || 0}</div>
            <p className="text-xs text-muted-foreground">
              3 completed today
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Usage Metrics</CardTitle>
            <CardDescription>
              Request volume over the last 7 days
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={formatChartDate}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(value) => formatChartDate(value as string)}
                    formatter={(value, name) => [
                      name === 'requests' ? value.toLocaleString() : value,
                      name === 'requests' ? 'Requests' : name === 'latency_ms' ? 'Latency (ms)' : 'Cost ($)'
                    ]}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="requests" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Performance Metrics</CardTitle>
            <CardDescription>
              Latency and cost trends
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={formatChartDate}
                  />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip 
                    labelFormatter={(value) => formatChartDate(value as string)}
                  />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="latency_ms" 
                    stroke="hsl(var(--secondary))" 
                    strokeWidth={2}
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="cost_usd" 
                    stroke="hsl(var(--destructive))" 
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Latest changes in your PromptOps platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              {
                type: 'template',
                action: 'created',
                target: 'support/summary',
                user: 'John Doe',
                time: '2 hours ago'
              },
              {
                type: 'deployment',
                action: 'updated',
                target: 'customer-service:prod',
                user: 'Jane Smith',
                time: '4 hours ago'
              },
              {
                type: 'evaluation',
                action: 'completed',
                target: 'sales-assistant v2.1',
                user: 'Mike Johnson',
                time: '6 hours ago'
              },
              {
                type: 'template',
                action: 'published',
                target: 'faq-responder',
                user: 'Sarah Wilson',
                time: '1 day ago'
              }
            ].map((activity, index) => (
              <div key={index} className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  {activity.type === 'template' && <FileText className="h-5 w-5 text-blue-500" />}
                  {activity.type === 'deployment' && <Rocket className="h-5 w-5 text-green-500" />}
                  {activity.type === 'evaluation' && <BarChart3 className="h-5 w-5 text-purple-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {activity.user} {activity.action} {activity.target}
                  </p>
                  <p className="text-sm text-muted-foreground">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}