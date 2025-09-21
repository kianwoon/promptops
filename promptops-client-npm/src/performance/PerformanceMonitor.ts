/**
 * Performance Monitor for PromptOps Client - TypeScript/JavaScript Implementation
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

import {
  PerformanceConfig,
  PerformanceMetric,
  RequestMetrics,
  CacheMetrics,
  MemoryMetrics,
  NetworkMetrics,
  PerformanceAlert,
  OptimizationRecommendation,
  PerformanceSnapshot,
  TimeSeriesDataPoint,
  TimeSeriesMetrics,
  MetricType,
  AlertSeverity,
  OptimizationStrategy,
  PerformanceStats,
  AlertCallback,
  RecommendationCallback,
  PerformanceSummary,
  PerformanceMonitorOptions
} from '../types/performance';

export class PerformanceMonitor extends EventEmitter {
  private config: PerformanceConfig;
  private running: boolean = false;
  private metricsBuffer: PerformanceMetric[] = [];
  private timeSeries: Map<MetricType, TimeSeriesMetrics> = new Map();
  private currentRequests: Map<string, RequestMetrics> = new Map();
  private completedRequests: RequestMetrics[] = [];
  private alerts: PerformanceAlert[] = [];
  private recommendations: OptimizationRecommendation[] = [];
  private alertCallbacks: AlertCallback[] = [];
  private recommendationCallbacks: RecommendationCallback[] = [];

  // Performance metrics
  public cacheMetrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    evictions: 0,
    size: 0,
    maxSize: 0,
    hitRate: 0,
    avgAccessTime: 0
  };

  public memoryMetrics: MemoryMetrics = {
    rssBytes: 0,
    heapBytes: 0,
    externalBytes: 0,
    arrayBuffers: 0,
    usedHeapSize: 0,
    totalHeapSize: 0,
    heapSizeLimit: 0
  };

  public networkMetrics: NetworkMetrics = {
    connectionCount: 0,
    connectionPoolSize: 0,
    connectionWaitTime: 0,
    dnsLookupTime: 0,
    tcpConnectionTime: 0,
    tlsHandshakeTime: 0,
    bandwidthBytesPerSec: 0,
    latencyP50: 0,
    latencyP95: 0,
    latencyP99: 0
  };

  private systemMetrics: Map<string, number> = new Map();
  private monitorInterval?: NodeJS.Timeout;
  private flushInterval?: NodeJS.Timeout;

  constructor(options: PerformanceMonitorOptions = {}) {
    super();

    // Default configuration
    this.config = {
      enabled: true,
      sampleRate: 1.0,
      maxMetricsRetentionHours: 24,
      alertCooldownSeconds: 300,
      metricsBufferSize: 10000,
      timeSeriesMaxPoints: 1000,
      enableRealTimeMonitoring: true,
      enableHistoricalAnalysis: true,
      enableAlerting: true,
      enableOptimizationRecommendations: true,
      opentelemetryEnabled: false,
      dashboardRefreshInterval: 30,
      optimizationAutoApply: false,
      ...options.config
    };

    this.setupDefaultAlerts();

    if (this.config.enabled) {
      this.start();
    }
  }

  private setupDefaultAlerts(): void {
    const defaultAlerts: PerformanceAlert[] = [
      {
        id: 'high_latency',
        metricType: MetricType.REQUEST_LATENCY,
        condition: '> 5.0',
        threshold: 5.0,
        severity: AlertSeverity.WARNING,
        message: 'High request latency detected',
        enabled: true,
        cooldownPeriod: 300
      },
      {
        id: 'critical_latency',
        metricType: MetricType.REQUEST_LATENCY,
        condition: '> 10.0',
        threshold: 10.0,
        severity: AlertSeverity.CRITICAL,
        message: 'Critical request latency detected',
        enabled: true,
        cooldownPeriod: 60
      },
      {
        id: 'low_cache_hit_rate',
        metricType: MetricType.CACHE_HIT_RATE,
        condition: '< 0.5',
        threshold: 0.5,
        severity: AlertSeverity.WARNING,
        message: 'Low cache hit rate detected',
        enabled: true,
        cooldownPeriod: 600
      },
      {
        id: 'high_error_rate',
        metricType: MetricType.ERROR_RATE,
        condition: '> 0.1',
        threshold: 0.1,
        severity: AlertSeverity.ERROR,
        message: 'High error rate detected',
        enabled: true,
        cooldownPeriod: 300
      },
      {
        id: 'high_memory_usage',
        metricType: MetricType.MEMORY_USAGE,
        condition: '> 500', // 500MB
        threshold: 500.0,
        severity: AlertSeverity.WARNING,
        message: 'High memory usage detected',
        enabled: true,
        cooldownPeriod: 600
      }
    ];

    this.alerts.push(...defaultAlerts);
  }

  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    console.log('Starting performance monitor');

    // Start monitoring intervals
    this.monitorInterval = setInterval(() => {
      this.updateSystemMetrics();
      this.updateMemoryMetrics();
      this.generateRecommendations();
    }, 10000); // Every 10 seconds

    this.flushInterval = setInterval(() => {
      this.flushMetrics();
    }, 60000); // Every minute

    this.emit('started');
  }

  stop(): void {
    if (!this.running) {
      return;
    }

    this.running = false;
    console.log('Stopping performance monitor');

    // Clear intervals
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    this.emit('stopped');
  }

  trackRequestStart(endpoint: string, method: string): string {
    if (!this.config.enabled) {
      return '';
    }

    const requestId = uuidv4();
    const request: RequestMetrics = {
      requestId,
      endpoint,
      method,
      startTime: new Date(),
      cacheHit: false,
      retryCount: 0,
      bytesSent: 0,
      bytesReceived: 0,
      compressionRatio: 1.0
    };

    this.currentRequests.set(requestId, request);
    return requestId;
  }

  trackRequestEnd(
    requestId: string,
    statusCode: number,
    cacheHit: boolean = false,
    retryCount: number = 0,
    bytesSent: number = 0,
    bytesReceived: number = 0,
    error?: string
  ): void {
    if (!this.config.enabled || !requestId) {
      return;
    }

    const request = this.currentRequests.get(requestId);
    if (!request) {
      return;
    }

    request.endTime = new Date();
    request.duration = (request.endTime.getTime() - request.startTime.getTime()) / 1000;
    request.statusCode = statusCode;
    request.cacheHit = cacheHit;
    request.retryCount = retryCount;
    request.bytesSent = bytesSent;
    request.bytesReceived = bytesReceived;
    request.error = error;

    this.currentRequests.delete(requestId);
    this.completedRequests.push(request);

    // Keep only recent requests
    if (this.completedRequests.length > 1000) {
      this.completedRequests = this.completedRequests.slice(-1000);
    }

    // Update cache metrics
    if (cacheHit) {
      this.updateCacheHit(request.duration);
    } else {
      this.updateCacheMiss(request.duration);
    }

    // Add to time series
    if (request.duration) {
      this.addTimeSeriesPoint(MetricType.REQUEST_LATENCY, request.duration, {
        endpoint,
        method,
        statusCode: statusCode.toString()
      });
    }

    // Check alerts
    this.checkAlerts();

    this.emit('requestCompleted', request);
  }

  trackCacheOperation(hit: boolean, accessTime: number): void {
    if (!this.config.enabled) {
      return;
    }

    if (hit) {
      this.updateCacheHit(accessTime);
    } else {
      this.updateCacheMiss(accessTime);
    }

    this.addTimeSeriesPoint(MetricType.CACHE_HIT_RATE, this.cacheMetrics.hitRate);
  }

  private updateCacheHit(accessTime: number): void {
    this.cacheMetrics.hits++;
    this.updateCacheHitRate();
    this.updateCacheAccessTime(accessTime);
  }

  private updateCacheMiss(accessTime: number): void {
    this.cacheMetrics.misses++;
    this.updateCacheHitRate();
    this.updateCacheAccessTime(accessTime);
  }

  private updateCacheHitRate(): void {
    const total = this.cacheMetrics.hits + this.cacheMetrics.misses;
    if (total > 0) {
      this.cacheMetrics.hitRate = this.cacheMetrics.hits / total;
    }
  }

  private updateCacheAccessTime(accessTime: number): void {
    // Exponential moving average with alpha = 0.1
    if (this.cacheMetrics.avgAccessTime === 0) {
      this.cacheMetrics.avgAccessTime = accessTime;
    } else {
      this.cacheMetrics.avgAccessTime = 0.9 * this.cacheMetrics.avgAccessTime + 0.1 * accessTime;
    }
  }

  updateMemoryMetrics(): void {
    if (!this.config.enabled) {
      return;
    }

    try {
      if (typeof process !== 'undefined' && process.memoryUsage) {
        const memUsage = process.memoryUsage();
        this.memoryMetrics.rssBytes = memUsage.rss;
        this.memoryMetrics.heapBytes = memUsage.heapUsed;
        this.memoryMetrics.externalBytes = memUsage.external;
        this.memoryMetrics.arrayBuffers = memUsage.arrayBuffers || 0;

        // Calculate heap usage percentage
        this.memoryMetrics.usedHeapSize = memUsage.heapUsed;
        this.memoryMetrics.totalHeapSize = memUsage.heapTotal;
        this.memoryMetrics.heapSizeLimit = memUsage.heapTotal || 0;

        this.addTimeSeriesPoint(MetricType.MEMORY_USAGE, this.memoryMetrics.rssBytes / 1024 / 1024, {
          type: 'rss'
        });
      }
    } catch (error) {
      console.warn('Failed to update memory metrics:', error);
    }
  }

  updateNetworkMetrics(
    connectionCount: number = 0,
    connectionPoolSize: number = 0,
    bandwidthBps: number = 0
  ): void {
    if (!this.config.enabled) {
      return;
    }

    this.networkMetrics.connectionCount = connectionCount;
    this.networkMetrics.connectionPoolSize = connectionPoolSize;
    this.networkMetrics.bandwidthBytesPerSec = bandwidthBps;

    this.addTimeSeriesPoint(MetricType.CONNECTION_POOL_SIZE, connectionPoolSize);
  }

  updateSystemMetrics(): void {
    if (!this.config.enabled) {
      return;
    }

    try {
      // CPU usage (Node.js specific)
      if (typeof process !== 'undefined' && process.cpuUsage) {
        const cpuUsage = process.cpuUsage();
        this.systemMetrics.set('cpu_user_time', cpuUsage.user);
        this.systemMetrics.set('cpu_system_time', cpuUsage.system);
      }

      // Uptime
      if (typeof process !== 'undefined' && process.uptime) {
        this.systemMetrics.set('uptime', process.uptime());
      }

      // Memory usage percentage
      if (this.memoryMetrics.totalHeapSize > 0) {
        const memoryPercent = (this.memoryMetrics.usedHeapSize / this.memoryMetrics.totalHeapSize) * 100;
        this.systemMetrics.set('memory_percent', memoryPercent);
      }

    } catch (error) {
      console.warn('Failed to update system metrics:', error);
    }
  }

  private addTimeSeriesPoint(metricType: MetricType, value: number, tags: Record<string, string> = {}): void {
    if (!this.timeSeries.has(metricType)) {
      this.timeSeries.set(metricType, {
        metricType,
        dataPoints: [],
        maxPoints: this.config.timeSeriesMaxPoints
      });
    }

    const series = this.timeSeries.get(metricType)!;
    series.dataPoints.push({
      timestamp: new Date(),
      value,
      tags
    });

    // Maintain max points limit
    if (series.dataPoints.length > series.maxPoints) {
      series.dataPoints = series.dataPoints.slice(-series.maxPoints);
    }
  }

  private checkAlerts(): void {
    if (!this.config.enableAlerting) {
      return;
    }

    for (const alert of this.alerts) {
      try {
        const value = this.getMetricValue(alert.metricType);
        if (value !== null && this.shouldTriggerAlert(alert, value)) {
          alert.lastTriggered = new Date();
          this.triggerAlert(alert);
        }
      } catch (error) {
        console.error(`Error checking alert ${alert.id}:`, error);
      }
    }
  }

  private shouldTriggerAlert(alert: PerformanceAlert, value: number): boolean {
    if (!alert.enabled) {
      return false;
    }

    // Check cooldown period
    if (alert.lastTriggered) {
      const timeSinceLastTrigger = (Date.now() - alert.lastTriggered.getTime()) / 1000;
      if (timeSinceLastTrigger < alert.cooldownPeriod) {
        return false;
      }
    }

    // Evaluate condition
    try {
      if (alert.condition.includes('>')) {
        const threshold = parseFloat(alert.condition.split('>')[1].trim());
        return value > threshold;
      } else if (alert.condition.includes('<')) {
        const threshold = parseFloat(alert.condition.split('<')[1].trim());
        return value < threshold;
      } else if (alert.condition.includes('>=')) {
        const threshold = parseFloat(alert.condition.split('>=')[1].trim());
        return value >= threshold;
      } else if (alert.condition.includes('<=')) {
        const threshold = parseFloat(alert.condition.split('<=')[1].trim());
        return value <= threshold;
      }
    } catch (error) {
      console.error(`Error evaluating alert condition for ${alert.id}:`, error);
    }

    return false;
  }

  private triggerAlert(alert: PerformanceAlert): void {
    console.warn('Performance alert triggered:', {
      id: alert.id,
      severity: alert.severity,
      message: alert.message
    });

    this.emit('alert', alert);

    // Call alert callbacks
    for (const callback of this.alertCallbacks) {
      try {
        callback(alert);
      } catch (error) {
        console.error('Error in alert callback:', error);
      }
    }
  }

  private getMetricValue(metricType: MetricType): number | null {
    try {
      switch (metricType) {
        case MetricType.REQUEST_LATENCY:
          const recentRequests = this.completedRequests.filter(req => {
            const timeDiff = (Date.now() - (req.endTime?.getTime() || Date.now())) / 1000;
            return timeDiff < 300; // Last 5 minutes
          });
          if (recentRequests.length > 0) {
            const durations = recentRequests.map(req => req.duration || 0).filter(d => d > 0);
            return durations.length > 0 ? durations.reduce((a, b) => a + b) / durations.length : null;
          }
          break;

        case MetricType.CACHE_HIT_RATE:
          return this.cacheMetrics.hitRate;

        case MetricType.MEMORY_USAGE:
          return this.memoryMetrics.rssBytes / 1024 / 1024; // MB

        case MetricType.ERROR_RATE:
          const recentErrorRequests = this.completedRequests.filter(req => {
            const timeDiff = (Date.now() - (req.endTime?.getTime() || Date.now())) / 1000;
            return timeDiff < 300 && (req.error || (req.statusCode && req.statusCode >= 400));
          });
          const totalRecentRequests = this.completedRequests.filter(req => {
            const timeDiff = (Date.now() - (req.endTime?.getTime() || Date.now())) / 1000;
            return timeDiff < 300;
          });
          return totalRecentRequests.length > 0 ? recentErrorRequests.length / totalRecentRequests.length : null;

        case MetricType.CONNECTION_POOL_SIZE:
          return this.networkMetrics.connectionPoolSize;
      }
    } catch (error) {
      console.error(`Error getting metric value for ${metricType}:`, error);
    }

    return null;
  }

  private generateRecommendations(): void {
    if (!this.config.enableOptimizationRecommendations) {
      return;
    }

    const recommendations: OptimizationRecommendation[] = [];

    // Check cache performance
    if (this.cacheMetrics.hitRate < 0.5) {
      recommendations.push({
        strategy: OptimizationStrategy.SMART_CACHING,
        title: 'Improve cache hit rate',
        description: `Current cache hit rate is ${(this.cacheMetrics.hitRate * 100).toFixed(1)}%. Consider increasing cache TTL or size.`,
        impact: 'medium',
        effort: 'low',
        confidence: 0.8,
        currentValue: this.cacheMetrics.hitRate,
        targetValue: 0.8,
        estimatedImprovement: '40% reduction in API calls'
      });
    }

    // Check request latency
    const recentLatencies = this.completedRequests
      .filter(req => req.duration && (Date.now() - (req.endTime?.getTime() || Date.now())) / 1000 < 300)
      .map(req => req.duration!);

    if (recentLatencies.length > 0) {
      const avgLatency = recentLatencies.reduce((a, b) => a + b) / recentLatencies.length;
      if (avgLatency > 2.0) {
        recommendations.push({
          strategy: OptimizationStrategy.CONNECTION_POOLING,
          title: 'Optimize connection pooling',
          description: `Average request latency is ${avgLatency.toFixed(2)}s. Consider optimizing connection pool settings.`,
          impact: 'high',
          effort: 'medium',
          confidence: 0.9,
          currentValue: avgLatency,
          targetValue: 1.0,
          estimatedImprovement: '50% reduction in latency'
        });
      }
    }

    // Check retry patterns
    const retryRequests = this.completedRequests.filter(req => req.retryCount > 0);
    if (retryRequests.length > this.completedRequests.length * 0.1) { // More than 10% retry rate
      recommendations.push({
        strategy: OptimizationStrategy.ADAPTIVE_RETRY,
        title: 'Implement adaptive retry strategy',
        description: `High retry rate detected (${retryRequests.length} requests). Consider implementing exponential backoff with jitter.`,
        impact: 'medium',
        effort: 'medium',
        confidence: 0.7,
        estimatedImprovement: 'Better resilience and reduced load'
      });
    }

    // Update recommendations if changed
    if (JSON.stringify(recommendations) !== JSON.stringify(this.recommendations)) {
      this.recommendations = recommendations;
      this.emit('recommendations', recommendations);

      // Call recommendation callbacks
      for (const callback of this.recommendationCallbacks) {
        try {
          recommendations.forEach(rec => callback(rec));
        } catch (error) {
          console.error('Error in recommendation callback:', error);
        }
      }
    }
  }

  private flushMetrics(): void {
    if (this.metricsBuffer.length === 0) {
      return;
    }

    try {
      // Send to custom endpoint if configured
      if (this.config.customMetricsEndpoint) {
        this.sendToCustomEndpoint();
      }

      // Send to OpenTelemetry if enabled
      if (this.config.opentelemetryEnabled) {
        this.sendToOpenTelemetry();
      }

      // Clear buffer
      this.metricsBuffer = [];
    } catch (error) {
      console.error('Error flushing metrics:', error);
    }
  }

  private sendToCustomEndpoint(): void {
    // Implementation depends on specific endpoint requirements
    // This would typically involve HTTP requests to the endpoint
  }

  private sendToOpenTelemetry(): void {
    // Implementation depends on OpenTelemetry setup
    // This would involve using the OpenTelemetry SDK
  }

  // Public API methods

  getPerformanceSnapshot(): PerformanceSnapshot {
    return {
      timestamp: new Date(),
      requestMetrics: Object.fromEntries(this.currentRequests),
      cacheMetrics: { ...this.cacheMetrics },
      memoryMetrics: { ...this.memoryMetrics },
      networkMetrics: { ...this.networkMetrics },
      systemMetrics: Object.fromEntries(this.systemMetrics),
      alerts: [...this.alerts],
      recommendations: [...this.recommendations]
    };
  }

  getTimeSeriesData(metricType: MetricType, windowHours: number = 1): TimeSeriesDataPoint[] {
    const series = this.timeSeries.get(metricType);
    if (!series) {
      return [];
    }

    const cutoffTime = new Date(Date.now() - windowHours * 60 * 60 * 1000);
    return series.dataPoints.filter(point => point.timestamp > cutoffTime);
  }

  getStatistics(metricType: MetricType, windowMinutes: number = 60): PerformanceStats | null {
    const series = this.timeSeries.get(metricType);
    if (!series || series.dataPoints.length === 0) {
      return null;
    }

    const cutoffTime = new Date(Date.now() - windowMinutes * 60 * 1000);
    const recentPoints = series.dataPoints.filter(point => point.timestamp > cutoffTime);

    if (recentPoints.length === 0) {
      return null;
    }

    const values = recentPoints.map(p => p.value).sort((a, b) => a - b);

    return {
      count: values.length,
      min: values[0],
      max: values[values.length - 1],
      mean: values.reduce((a, b) => a + b) / values.length,
      median: values[Math.floor(values.length / 2)],
      p95: values[Math.floor(values.length * 0.95)],
      p99: values[Math.floor(values.length * 0.99)],
      stdDev: this.calculateStandardDeviation(values)
    };
  }

  private calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((a, b) => a + b) / values.length;
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }

  addAlertCallback(callback: AlertCallback): void {
    this.alertCallbacks.push(callback);
  }

  addRecommendationCallback(callback: RecommendationCallback): void {
    this.recommendationCallbacks.push(callback);
  }

  addCustomAlert(alert: PerformanceAlert): void {
    this.alerts.push(alert);
  }

  clearRecommendations(): void {
    this.recommendations = [];
  }

  getSummary(): PerformanceSummary {
    return {
      enabled: this.config.enabled,
      running: this.running,
      timestamp: new Date(),
      activeRequests: this.currentRequests.size,
      completedRequests: this.completedRequests.length,
      cacheHitRate: this.cacheMetrics.hitRate,
      memoryUsageMB: this.memoryMetrics.rssBytes / 1024 / 1024,
      alertCount: this.alerts.length,
      recommendationCount: this.recommendations.length,
      metricsBufferSize: this.metricsBuffer.length,
      timeSeriesCount: this.timeSeries.size
    };
  }

  exportMetrics(options: {
    format: 'json' | 'csv' | 'prometheus';
    includeTags?: boolean;
    timeRange?: { start: Date; end: Date };
    metricTypes?: MetricType[];
  }): string {
    // Implementation for exporting metrics in different formats
    return JSON.stringify(this.getPerformanceSnapshot(), null, 2);
  }

  destroy(): void {
    this.stop();
    this.removeAllListeners();
  }
}