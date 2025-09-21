import React, { useState } from 'react'
import {
  FileText,
  Rocket,
  BarChart3,
  Clock,
  TrendingUp,
  Users,
  Activity,
  DollarSign,
  FolderOpen,
  Eye,
  ArrowUpRight,
  Download,
  RefreshCw,
  Calendar,
  Shield,
  Zap,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Filter,
  Settings,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  BarChart,
  PieChart,
  AreaChart
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useDashboardStats, useUsageMetrics, useProjects, useUsers } from '@/hooks/api'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart as RechartsBarChart, Bar, AreaChart as RechartsAreaChart, Area,
  PieChart as RechartsPieChart, Pie, Cell, Legend
} from 'recharts'

// Enhanced types for enterprise dashboard
interface EnhancedStatCard {
  title: string
  value: number | string
  icon: React.ReactNode
  change: number
  changeType: 'increase' | 'decrease' | 'neutral'
  status: 'healthy' | 'warning' | 'critical'
  description: string
  sparklineData?: number[]
}

interface SystemHealth {
  uptime: number
  performance: number
  errors: number
  status: 'healthy' | 'warning' | 'critical'
}

interface CostAnalysis {
  totalCost: number
  projectedCost: number
  savings: number
  optimization: number
}

interface SLAMetrics {
  uptime: number
  responseTime: number
  errorRate: number
  availability: number
}

interface Alert {
  id: string
  type: 'info' | 'warning' | 'error' | 'success'
  title: string
  message: string
  timestamp: string
  severity: 'low' | 'medium' | 'high' | 'critical'
}

interface DateRange {
  value: string
  label: string
}

const dateRanges: DateRange[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '1y', label: 'Last year' }
]

const roleViews = [
  { value: 'all', label: 'All Overview' },
  { value: 'admin', label: 'Admin View' },
  { value: 'developer', label: 'Developer View' },
  { value: 'analyst', label: 'Analyst View' }
]

// Enhanced stat card component
const EnhancedStatCard: React.FC<{
  data: EnhancedStatCard;
  onDrillDown?: () => void;
}> = ({ data, onDrillDown }) => {
  const StatusIcon = data.status === 'healthy' ? CheckCircle :
                    data.status === 'warning' ? AlertTriangle : XCircle;

  const ChangeIcon = data.changeType === 'increase' ? TrendingUp :
                    data.changeType === 'decrease' ? TrendingDown : Minus;

  const statusColor = data.status === 'healthy' ? 'text-green-500' :
                      data.status === 'warning' ? 'text-yellow-500' : 'text-red-500';

  const changeColor = data.changeType === 'increase' ? 'text-green-500' :
                     data.changeType === 'decrease' ? 'text-red-500' : 'text-gray-500';

  const getGradientForTitle = (title: string) => {
    switch (title.toLowerCase()) {
      case 'projects':
        return 'bg-gradient-to-r from-blue-500 to-purple-500 text-white';
      case 'templates':
      case 'total templates':
        return 'bg-gradient-to-r from-green-500 to-emerald-500 text-white';
      case 'deployments':
      case 'active deployments':
        return 'bg-gradient-to-r from-amber-500 to-orange-500 text-white';
      case 'requests':
      case 'total requests':
        return 'bg-gradient-to-r from-cyan-500 to-teal-500 text-white';
      default:
        return 'bg-gradient-to-r from-blue-500 to-purple-500 text-white';
    }
  };

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border-2 hover:border-primary/20 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/60"></div>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="space-y-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            {data.title}
            <StatusIcon className={`h-3 w-3 ${statusColor}`} />
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="text-2xl font-bold">{data.value}</div>
            {data.sparklineData && (
              <div className="flex items-center gap-1">
                <ChangeIcon className={`h-4 w-4 ${changeColor}`} />
                <span className={`text-sm ${changeColor}`}>
                  {data.change > 0 ? '+' : ''}{data.change}%
                </span>
              </div>
            )}
          </div>
        </div>
        <div className={`p-2 rounded-lg ${getGradientForTitle(data.title)}`}>
          {data.icon}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{data.description}</p>
          {data.sparklineData && (
            <div className="h-12">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.sparklineData.map((value, index) => ({ value, index }))}>
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    strokeWidth={1.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// System health component
const SystemHealthCard: React.FC<{ data: SystemHealth }> = ({ data }) => {
  const statusColors = {
    healthy: 'text-green-500 bg-green-100',
    warning: 'text-yellow-500 bg-yellow-100',
    critical: 'text-red-500 bg-red-100'
  };

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border-2 hover:border-primary/20 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/60"></div>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="p-2 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 text-white mr-2">
            <Shield className="h-5 w-5" />
          </div>
          System Health
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Uptime</span>
              <span className="font-semibold">{data.uptime}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full"
                style={{ width: `${data.uptime}%` }}
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Performance</span>
              <span className="font-semibold">{data.performance}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full"
                style={{ width: `${data.performance}%` }}
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Errors</span>
              <span className="font-semibold">{data.errors}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-red-500 h-2 rounded-full"
                style={{ width: `${Math.min(data.errors * 10, 100)}%` }}
              />
            </div>
          </div>
          <div className="flex items-center justify-center">
            <Badge className={statusColors[data.status]}>
              {data.status.toUpperCase()}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Cost analysis component
const CostAnalysisCard: React.FC<{ data: CostAnalysis }> = ({ data }) => {
  return (
    <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border-2 hover:border-primary/20 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/60"></div>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="p-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white mr-2">
            <DollarSign className="h-5 w-5" />
          </div>
          Cost Analysis
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Cost</p>
              <p className="text-2xl font-bold">${data.totalCost.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Projected</p>
              <p className="text-2xl font-bold">${data.projectedCost.toLocaleString()}</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Potential Savings</span>
              <span className="font-semibold text-green-500">${data.savings.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Optimization</span>
              <span className="font-semibold text-blue-500">{data.optimization}%</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// SLA metrics component
const SLAMetricsCard: React.FC<{ data: SLAMetrics }> = ({ data }) => {
  const slaData = [
    { name: 'Uptime', value: data.uptime, target: 99.9, color: '#10b981' },
    { name: 'Response Time', value: data.responseTime, target: 200, color: '#3b82f6' },
    { name: 'Error Rate', value: data.errorRate, target: 0.1, color: '#ef4444' },
    { name: 'Availability', value: data.availability, target: 99.5, color: '#8b5cf6' }
  ];

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border-2 hover:border-primary/20 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/60"></div>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="p-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white mr-2">
            <Zap className="h-5 w-5" />
          </div>
          Performance SLA
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {slaData.map((metric, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{metric.name}</span>
                <span className="font-semibold">{metric.value}{metric.name === 'Response Time' ? 'ms' : metric.name === 'Error Rate' ? '%' : '%'}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min((metric.value / metric.target) * 100, 100)}%`,
                    backgroundColor: metric.color
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">Target: {metric.target}{metric.name === 'Response Time' ? 'ms' : '%'}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Alerts component
const AlertsSection: React.FC<{ alerts: Alert[] }> = ({ alerts }) => {
  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
      default: return <Shield className="h-4 w-4 text-blue-500" />;
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'error': return 'border-red-200 bg-red-50';
      case 'warning': return 'border-yellow-200 bg-yellow-50';
      case 'success': return 'border-green-200 bg-green-50';
      default: return 'border-blue-200 bg-blue-50';
    }
  };

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border-2 hover:border-primary/20 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/60"></div>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="p-2 rounded-full bg-gradient-to-r from-red-500 to-rose-500 text-white mr-2">
            <AlertTriangle className="h-5 w-5" />
          </div>
          System Alerts
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div key={alert.id} className={`p-3 rounded-lg border ${getAlertColor(alert.type)}`}>
              <div className="flex items-start gap-3">
                {getAlertIcon(alert.type)}
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm">{alert.title}</h4>
                    <Badge variant="outline" className="text-xs">
                      {alert.severity}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                  <p className="text-xs text-muted-foreground mt-2">{alert.timestamp}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export function Dashboard() {
  const [dateRange, setDateRange] = useState<string>('7d');
  const [selectedRoleView, setSelectedRoleView] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(false);

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useDashboardStats();
  const { data: metrics, isLoading: metricsLoading, refetch: refetchMetrics } = useUsageMetrics(dateRange);
  const { data: projects, isLoading: projectsLoading, refetch: refetchProjects } = useProjects();
  const { data: users, isLoading: usersLoading } = useUsers();

  const formatChartDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await Promise.all([
        refetchStats(),
        refetchMetrics(),
        refetchProjects()
      ]);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (format: 'csv' | 'pdf' | 'json') => {
    // Export functionality would be implemented here
    console.log(`Exporting data as ${format}`);
  };

  // Mock data for demonstration (would come from API in production)
  const enhancedStats: EnhancedStatCard[] = [
    {
      title: 'Projects',
      value: projects?.length || 0,
      icon: <FolderOpen className="h-4 w-4 text-muted-foreground" />,
      change: 12,
      changeType: 'increase',
      status: 'healthy',
      description: 'Active projects',
      sparklineData: [5, 8, 12, 15, 18, 22, 25]
    },
    {
      title: 'Total Templates',
      value: stats?.total_templates || 0,
      icon: <FileText className="h-4 w-4 text-muted-foreground" />,
      change: 23,
      changeType: 'increase',
      status: 'healthy',
      description: '+23% from last month',
      sparklineData: [45, 52, 48, 55, 62, 58, 67]
    },
    {
      title: 'Active Deployments',
      value: stats?.total_deployments || 0,
      icon: <Rocket className="h-4 w-4 text-muted-foreground" />,
      change: 8,
      changeType: 'increase',
      status: 'warning',
      description: '+8% from last week',
      sparklineData: [12, 15, 18, 16, 20, 22, 25]
    },
    {
      title: 'Total Requests',
      value: (stats?.total_requests || 0).toLocaleString(),
      icon: <Activity className="h-4 w-4 text-muted-foreground" />,
      change: 45,
      changeType: 'increase',
      status: 'healthy',
      description: '+45% from last month',
      sparklineData: [1200, 1350, 1180, 1450, 1600, 1550, 1750]
    }
  ];

  const systemHealth: SystemHealth = {
    uptime: 99.8,
    performance: 87,
    errors: 3,
    status: 'healthy'
  };

  const costAnalysis: CostAnalysis = {
    totalCost: 15420,
    projectedCost: 18500,
    savings: 3080,
    optimization: 16.7
  };

  const slaMetrics: SLAMetrics = {
    uptime: 99.8,
    responseTime: 145,
    errorRate: 0.08,
    availability: 99.5
  };

  const alerts: Alert[] = [
    {
      id: '1',
      type: 'warning',
      title: 'High Response Time',
      message: 'Average response time increased by 15% in the last hour',
      timestamp: '2 minutes ago',
      severity: 'medium'
    },
    {
      id: '2',
      type: 'info',
      title: 'Cost Optimization Available',
      message: '16.7% cost savings identified through template optimization',
      timestamp: '1 hour ago',
      severity: 'low'
    },
    {
      id: '3',
      type: 'success',
      title: 'System Health Good',
      message: 'All systems operating within normal parameters',
      timestamp: '3 hours ago',
      severity: 'low'
    }
  ];

  // Chart data for different visualizations
  const requestVolumeData = Array.isArray(metrics) ? metrics.map(m => ({
    date: formatChartDate(m.timestamp),
    requests: m.requests,
    cost: m.cost_usd,
    latency: m.latency_ms
  })) : [];

  const costDistributionData = [
    { name: 'API Calls', value: 45, color: '#3b82f6' },
    { name: 'Storage', value: 25, color: '#10b981' },
    { name: 'Compute', value: 20, color: '#f59e0b' },
    { name: 'Other', value: 10, color: '#ef4444' }
  ];

  const performanceData = [
    { metric: 'Response Time', current: 145, target: 200, improvement: 27.5 },
    { metric: 'Error Rate', current: 0.08, target: 0.1, improvement: 20 },
    { metric: 'Throughput', current: 1250, target: 1000, improvement: 25 },
    { metric: 'Cost per Request', current: 0.85, target: 1.0, improvement: 15 }
  ];

  if (statsLoading || metricsLoading || projectsLoading || usersLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header with Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Enterprise Dashboard</h1>
          <p className="text-muted-foreground">
            Comprehensive overview of your PromptOps platform
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Select value={selectedRoleView} onValueChange={setSelectedRoleView}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Role View" />
            </SelectTrigger>
            <SelectContent>
              {roleViews.map(view => (
                <SelectItem key={view.value} value={view.value}>
                  {view.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[120px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {dateRanges.map(range => (
                <SelectItem key={range.value} value={range.value}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>

            <div className="relative">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {enhancedStats.map((stat, index) => (
          <EnhancedStatCard key={index} data={stat} />
        ))}
      </div>

      {/* Enterprise Cards Row */}
      <div className="grid gap-6 md:grid-cols-3">
        <SystemHealthCard data={systemHealth} />
        <CostAnalysisCard data={costAnalysis} />
        <SLAMetricsCard data={slaMetrics} />
      </div>

      {/* Advanced Charts Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Request Volume Chart */}
        <Card className="border-0 bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Request Volume & Cost</CardTitle>
                <CardDescription>
                  Detailed request metrics and associated costs
                </CardDescription>
              </div>
              <Button variant="outline" size="sm">
                <BarChart className="h-4 w-4 mr-2" />
                View Details
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsAreaChart data={requestVolumeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip
                    formatter={(value, name) => [
                      name === 'requests' ? value.toLocaleString() :
                      name === 'cost' ? formatCurrency(value as number) : value + 'ms',
                      name === 'requests' ? 'Requests' :
                      name === 'cost' ? 'Cost' : 'Latency'
                    ]}
                  />
                  <Area yAxisId="left" type="monotone" dataKey="requests" fill="#3b82f6" fillOpacity={0.3} stroke="#3b82f6" />
                  <Area yAxisId="right" type="monotone" dataKey="cost" fill="#10b981" fillOpacity={0.3} stroke="#10b981" />
                </RechartsAreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Cost Distribution Chart */}
        <Card className="border-0 bg-gradient-to-br from-purple-50 to-pink-50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Cost Distribution</CardTitle>
                <CardDescription>
                  Breakdown of costs by category
                </CardDescription>
              </div>
              <Button variant="outline" size="sm">
                <PieChart className="h-4 w-4 mr-2" />
                Analyze
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={costDistributionData}
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}%`}
                  >
                    {costDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value}%`, 'Percentage']} />
                  <Legend />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics */}
      <Card className="border-0 bg-gradient-to-br from-green-50 to-teal-50">
        <CardHeader>
          <CardTitle>Performance Metrics vs Targets</CardTitle>
          <CardDescription>
            Current performance compared to established targets
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsBarChart data={performanceData} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="metric" type="category" width={120} />
                <Tooltip />
                <Bar dataKey="current" fill="#3b82f6" name="Current" />
                <Bar dataKey="target" fill="#10b981" name="Target" />
              </RechartsBarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Recent Projects with Enhanced Features */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Projects</CardTitle>
              <CardDescription>
                Your most recently created projects with detailed insights
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="/projects">
                  View All
                  <ArrowUpRight className="w-4 h-4 ml-2" />
                </a>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {projects && projects.length > 0 ? (
            <div className="space-y-4">
              {projects.slice(0, 5).map((project) => (
                <div key={project.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-all duration-200">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <FolderOpen className="w-8 h-8 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium">{project.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {project.description || 'No description'}
                      </p>
                      <div className="flex items-center gap-4 mt-2">
                        <p className="text-xs text-muted-foreground">
                          Owner: {project.owner}
                        </p>
                        <Badge variant="secondary">Active</Badge>
                        <p className="text-xs text-muted-foreground">
                          Created: {new Date(project.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm">
                      <Settings className="w-4 h-4 mr-2" />
                      Configure
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                      <a href={`/projects/${project.id}`}>
                        <Eye className="w-4 h-4" />
                      </a>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <FolderOpen className="w-16 h-16 text-muted-foreground mb-6" />
              <h3 className="text-xl font-semibold mb-3">No projects yet</h3>
              <p className="text-muted-foreground mb-6 text-center max-w-md">
                Create your first project to start organizing your prompts and modules with enterprise-grade management.
              </p>
              <Button asChild>
                <a href="/projects">
                  Create Project
                </a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Alerts Section */}
      <AlertsSection alerts={alerts} />

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Latest changes and events in your PromptOps platform
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
                time: '2 hours ago',
                impact: 'medium'
              },
              {
                type: 'deployment',
                action: 'updated',
                target: 'customer-service:prod',
                user: 'Jane Smith',
                time: '4 hours ago',
                impact: 'high'
              },
              {
                type: 'evaluation',
                action: 'completed',
                target: 'sales-assistant v2.1',
                user: 'Mike Johnson',
                time: '6 hours ago',
                impact: 'low'
              },
              {
                type: 'template',
                action: 'published',
                target: 'faq-responder',
                user: 'Sarah Wilson',
                time: '1 day ago',
                impact: 'medium'
              }
            ].map((activity, index) => (
              <div key={index} className="flex items-center space-x-4 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex-shrink-0">
                  {activity.type === 'template' && <FileText className="h-5 w-5 text-blue-500" />}
                  {activity.type === 'deployment' && <Rocket className="h-5 w-5 text-green-500" />}
                  {activity.type === 'evaluation' && <BarChart3 className="h-5 w-5 text-purple-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">
                      {activity.user} {activity.action} {activity.target}
                    </p>
                    <Badge variant="outline" className="text-xs">
                      {activity.impact}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}