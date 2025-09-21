/**
 * Performance monitoring types and interfaces for PromptOps Client
 */

export enum MetricType {
  REQUEST_LATENCY = 'request_latency',
  MEMORY_USAGE = 'memory_usage',
  CPU_USAGE = 'cpu_usage',
  NETWORK_LATENCY = 'network_latency',
  CACHE_HIT_RATE = 'cache_hit_rate',
  ERROR_RATE = 'error_rate',
  THROUGHPUT = 'throughput',
  CONNECTION_POOL_SIZE = 'connection_pool_size',
  RETRY_COUNT = 'retry_count',
  BATCH_SIZE = 'batch_size',
  COMPRESSION_RATIO = 'compression_ratio'
}

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export enum OptimizationStrategy {
  ADAPTIVE_RETRY = 'adaptive_retry',
  CONNECTION_POOLING = 'connection_pooling',
  SMART_CACHING = 'smart_caching',
  REQUEST_BATCHING = 'request_batching',
  COMPRESSION = 'compression',
  LOAD_BALANCING = 'load_balancing',
  CIRCUIT_BREAKER = 'circuit_breaker'
}

export interface PerformanceMetric {
  metricType: MetricType;
  value: number;
  timestamp: Date;
  tags: Record<string, string>;
  metadata?: Record<string, any>;
}

export interface RequestMetrics {
  requestId: string;
  endpoint: string;
  method: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  statusCode?: number;
  error?: string;
  cacheHit: boolean;
  retryCount: number;
  bytesSent: number;
  bytesReceived: number;
  compressionRatio: number;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  maxSize: number;
  hitRate: number;
  avgAccessTime: number;
}

export interface MemoryMetrics {
  rssBytes: number;
  heapBytes: number;
  externalBytes: number;
  arrayBuffers: number;
  usedHeapSize: number;
  totalHeapSize: number;
  heapSizeLimit: number;
}

export interface NetworkMetrics {
  connectionCount: number;
  connectionPoolSize: number;
  connectionWaitTime: number;
  dnsLookupTime: number;
  tcpConnectionTime: number;
  tlsHandshakeTime: number;
  bandwidthBytesPerSec: number;
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
}

export interface PerformanceAlert {
  id: string;
  metricType: MetricType;
  condition: string;
  threshold: number;
  severity: AlertSeverity;
  message: string;
  enabled: boolean;
  cooldownPeriod: number; // seconds
  lastTriggered?: Date;
}

export interface OptimizationRecommendation {
  strategy: OptimizationStrategy;
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  confidence: number; // 0.0 to 1.0
  currentValue?: number;
  targetValue?: number;
  estimatedImprovement?: string;
  implementationHint?: string;
}

export interface PerformanceSnapshot {
  timestamp: Date;
  requestMetrics: Record<string, RequestMetrics>;
  cacheMetrics: CacheMetrics;
  memoryMetrics: MemoryMetrics;
  networkMetrics: NetworkMetrics;
  systemMetrics: Record<string, number>;
  alerts: PerformanceAlert[];
  recommendations: OptimizationRecommendation[];
}

export interface TimeSeriesDataPoint {
  timestamp: Date;
  value: number;
  tags: Record<string, string>;
}

export interface TimeSeriesMetrics {
  metricType: MetricType;
  dataPoints: TimeSeriesDataPoint[];
  maxPoints: number;
}

export interface PerformanceConfig {
  enabled: boolean;
  sampleRate: number;
  maxMetricsRetentionHours: number;
  alertCooldownSeconds: number;
  metricsBufferSize: number;
  timeSeriesMaxPoints: number;
  enableRealTimeMonitoring: boolean;
  enableHistoricalAnalysis: boolean;
  enableAlerting: boolean;
  enableOptimizationRecommendations: boolean;
  opentelemetryEnabled: boolean;
  opentelemetryEndpoint?: string;
  customMetricsEndpoint?: string;
  dashboardRefreshInterval: number;
  optimizationAutoApply: boolean;
}

export interface PerformanceStats {
  mean: number;
  median: number;
  min: number;
  max: number;
  p95: number;
  p99: number;
  stdDev: number;
  count: number;
}

export interface AlertCallback {
  (alert: PerformanceAlert): void;
}

export interface RecommendationCallback {
  (recommendation: OptimizationRecommendation): void;
}

export interface PerformanceMonitorOptions {
  config?: Partial<PerformanceConfig>;
  serviceName?: string;
  environment?: string;
}

export interface PerformanceSummary {
  enabled: boolean;
  running: boolean;
  timestamp: Date;
  activeRequests: number;
  completedRequests: number;
  cacheHitRate: number;
  memoryUsageMB: number;
  alertCount: number;
  recommendationCount: number;
  metricsBufferSize: number;
  timeSeriesCount: number;
}

export interface ExportMetricsOptions {
  format: 'json' | 'csv' | 'prometheus';
  includeTags?: boolean;
  timeRange?: {
    start: Date;
    end: Date;
  };
  metricTypes?: MetricType[];
}