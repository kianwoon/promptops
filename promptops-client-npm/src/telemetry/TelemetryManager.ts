/**
 * Telemetry Manager for PromptOps Client
 */

import { TelemetryError } from '../types/errors';
import { TelemetryConfig } from '../types';

export interface TelemetryEvent {
  type: string;
  timestamp: number;
  sessionId: string;
  userId?: string;
  data: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface TelemetryBatch {
  events: TelemetryEvent[];
  timestamp: number;
}

export class TelemetryManager {
  private config: Required<TelemetryConfig>;
  private eventQueue: TelemetryEvent[] = [];
  private sessionId: string;
  private flushTimer?: NodeJS.Timeout;
  private isFlushing: boolean = false;
  private enabled: boolean = true;

  constructor(config: TelemetryConfig) {
    this.config = {
      enabled: config.enabled,
      endpoint: config.endpoint || 'https://api.promptops.com/v1/telemetry',
      batchSize: config.batchSize || 50,
      flushInterval: config.flushInterval || 30000, // 30 seconds
      sampleRate: config.sampleRate || 1.0,
    };

    this.sessionId = this.generateSessionId();
    this.setupFlushTimer();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      this.flush().catch((error) => {
        console.warn('Telemetry flush failed:', error);
      });
    }, this.config.flushInterval);
  }

  private shouldSample(): boolean {
    return Math.random() <= this.config.sampleRate;
  }

  private async sendBatch(batch: TelemetryBatch): Promise<void> {
    if (!this.config.enabled || !this.enabled) {
      return;
    }

    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'promptops-client/1.0.0',
        },
        body: JSON.stringify(batch),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      throw new TelemetryError(
        `Failed to send telemetry batch: ${error instanceof Error ? error.message : String(error)}`,
        { endpoint: this.config.endpoint, batchSize: batch.events.length }
      );
    }
  }

  async track(
    type: string,
    data: Record<string, any>,
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!this.config.enabled || !this.enabled || !this.shouldSample()) {
      return;
    }

    const event: TelemetryEvent = {
      type,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      data,
      metadata,
    };

    this.eventQueue.push(event);

    // Flush if we've reached the batch size
    if (this.eventQueue.length >= this.config.batchSize) {
      await this.flush();
    }
  }

  async trackPromptUsage(
    promptId: string,
    version: string,
    modelProvider: string,
    modelName: string,
    variables?: Record<string, any>,
    duration?: number
  ): Promise<void> {
    await this.track('prompt_usage', {
      prompt_id: promptId,
      version,
      model_provider: modelProvider,
      model_name: modelName,
      variable_count: Object.keys(variables || {}).length,
      duration,
    });
  }

  async trackCacheHit(key: string, cacheType: 'memory' | 'redis'): Promise<void> {
    await this.track('cache_hit', {
      key,
      cache_type: cacheType,
    });
  }

  async trackCacheMiss(key: string, cacheType: 'memory' | 'redis'): Promise<void> {
    await this.track('cache_miss', {
      key,
      cache_type: cacheType,
    });
  }

  async trackError(errorType: string, errorMessage: string, statusCode?: number): Promise<void> {
    await this.track('error', {
      error_type: errorType,
      error_message: errorMessage,
      status_code: statusCode,
    });
  }

  async trackApiCall(
    endpoint: string,
    method: string,
    statusCode: number,
    duration: number
  ): Promise<void> {
    await this.track('api_call', {
      endpoint,
      method,
      status_code: statusCode,
      duration,
    });
  }

  async trackPerformance(operation: string, duration: number, metadata?: Record<string, any>): Promise<void> {
    await this.track('performance', {
      operation,
      duration,
      ...metadata,
    });
  }

  async trackUserAction(action: string, userId?: string): Promise<void> {
    await this.track('user_action', {
      action,
      user_id: userId,
    });
  }

  async flush(): Promise<void> {
    if (this.isFlushing || this.eventQueue.length === 0) {
      return;
    }

    this.isFlushing = true;

    try {
      const batch: TelemetryBatch = {
        events: [...this.eventQueue],
        timestamp: Date.now(),
      };

      await this.sendBatch(batch);
      this.eventQueue = [];
    } catch (error) {
      console.warn('Telemetry flush failed, keeping events in queue:', error);
      // Don't clear the queue on failure, will retry on next flush
    } finally {
      this.isFlushing = false;
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setUserId(userId: string): void {
    // Store userId for future events
    // This will be used in subsequent track() calls
  }

  getSessionId(): string {
    return this.sessionId;
  }

  getQueueSize(): number {
    return this.eventQueue.length;
  }

  async clearQueue(): Promise<void> {
    this.eventQueue = [];
  }

  async shutdown(): Promise<void> {
    // Flush remaining events
    await this.flush();

    // Clear timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
  }

  updateConfig(config: Partial<TelemetryConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };

    // Restart flush timer if interval changed
    if (config.flushInterval !== undefined) {
      this.setupFlushTimer();
    }
  }

  getStats(): {
    queueSize: number;
    sessionId: string;
    enabled: boolean;
    config: Required<TelemetryConfig>;
  } {
    return {
      queueSize: this.eventQueue.length,
      sessionId: this.sessionId,
      enabled: this.enabled,
      config: this.config,
    };
  }
}