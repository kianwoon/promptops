/**
 * Main PromptOps Client Class
 */

import { PromptOpsConfig, PromptRequest, PromptResponse, RenderResult } from './types';
import { AuthenticationManager } from './auth/AuthenticationManager';
import { CacheManager } from './cache/CacheManager';
import { TelemetryManager } from './telemetry/TelemetryManager';
import { PromptManager } from './prompts/PromptManager';
import { ConfigurationError, PromptOpsError } from './types/errors';
import { RetryConfig } from './types';

export interface PromptOpsClientOptions extends PromptOpsConfig {
  retryConfig?: Partial<RetryConfig>;
}

export class PromptOpsClient {
  private config: Required<PromptOpsConfig>;
  private authManager: AuthenticationManager;
  private cacheManager: CacheManager;
  private telemetryManager: TelemetryManager;
  private promptManager: PromptManager;
  private retryConfig: Required<RetryConfig>;
  private isInitialized: boolean = false;

  constructor(options: PromptOpsClientOptions) {
    // Validate required configuration
    if (!options.baseUrl) {
      throw new ConfigurationError('baseUrl is required');
    }

    // Set default values
    this.config = {
      baseUrl: options.baseUrl,
      apiKey: options.apiKey,
      timeout: options.timeout || 30000,
      retries: options.retries || 3,
      enableCache: options.enableCache ?? true,
      cacheTTL: options.cacheTTL || 300000, // 5 minutes
      enableTelemetry: options.enableTelemetry ?? true,
      redisUrl: options.redisUrl,
      telemetryEndpoint: options.telemetryEndpoint,
      userAgent: options.userAgent || 'promptops-client/1.0.0',
    };

    // Set retry configuration
    this.retryConfig = {
      maxRetries: options.retryConfig?.maxRetries || 3,
      baseDelay: options.retryConfig?.baseDelay || 1000,
      maxDelay: options.retryConfig?.maxDelay || 10000,
      jitter: options.retryConfig?.jitter ?? true,
    };

    // Initialize managers
    this.authManager = new AuthenticationManager(this.config);
    this.cacheManager = new CacheManager({
      memoryCacheSize: 1000,
      redisUrl: this.config.redisUrl,
      defaultTTL: this.config.cacheTTL,
      enableRedis: Boolean(this.config.redisUrl),
    });
    this.telemetryManager = new TelemetryManager({
      enabled: this.config.enableTelemetry,
      endpoint: this.config.telemetryEndpoint,
    });
    this.promptManager = new PromptManager(
      this.authManager.getClient(),
      this.cacheManager,
      this.telemetryManager
    );
  }

  /**
   * Initialize the client and validate configuration
   */
  async initialize(): Promise<void> {
    try {
      // Validate API key
      if (this.config.apiKey) {
        const isValid = await this.authManager.validateApiKey();
        if (!isValid) {
          throw new ConfigurationError('Invalid API key');
        }
      }

      // Check cache health
      await this.cacheManager.healthCheck();

      this.isInitialized = true;

      await this.telemetryManager.trackUserAction('client_initialized');
    } catch (error) {
      await this.telemetryManager.trackError(
        'initialization_failed',
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  /**
   * Check if client is initialized
   */
  isClientInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Get a prompt with optional variables
   */
  async getPrompt(request: PromptRequest): Promise<PromptResponse> {
    this.ensureInitialized();
    return this.withRetry(
      async () => {
        const result = await this.promptManager.getPrompt(request);
        await this.telemetryManager.trackPromptUsage(
          request.promptId,
          request.version || 'latest',
          request.modelProvider || 'unknown',
          request.modelName || 'unknown',
          request.variables
        );
        return result;
      },
      'getPrompt',
      { promptId: request.promptId }
    );
  }

  /**
   * Get prompt content with variable substitution
   */
  async getPromptContent(request: PromptRequest): Promise<string> {
    this.ensureInitialized();
    return this.withRetry(
      async () => {
        const result = await this.promptManager.getPromptContent(request);
        await this.telemetryManager.trackPromptUsage(
          request.promptId,
          request.version || 'latest',
          request.modelProvider || 'unknown',
          request.modelName || 'unknown',
          request.variables
        );
        return result;
      },
      'getPromptContent',
      { promptId: request.promptId }
    );
  }

  /**
   * List all prompts, optionally filtered by module and project
   */
  async listPrompts(moduleId?: string, projectId?: string, limit: number = 100): Promise<PromptResponse[]> {
    this.ensureInitialized();
    return this.withRetry(
      async () => {
        const result = await this.promptManager.listPrompts(moduleId, projectId, limit);
        await this.telemetryManager.trackUserAction('list_prompts', {
          moduleId,
          projectId
        });
        return result;
      },
      'listPrompts',
      { moduleId, projectId }
    );
  }

  /**
   * Render a prompt with variables
   */
  async renderPrompt(request: PromptRequest): Promise<RenderResult> {
    this.ensureInitialized();
    return this.withRetry(
      async () => {
        const result = await this.promptManager.renderPrompt(request);
        await this.telemetryManager.trackPromptUsage(
          request.promptId,
          request.version || 'latest',
          request.modelProvider || 'unknown',
          request.modelName || 'unknown',
          request.variables,
          request.projectId
        );
        return result;
      },
      'renderPrompt',
      { promptId: request.promptId, projectId: request.projectId }
    );
  }

  /**
   * Validate if a prompt exists
   */
  async validatePrompt(promptId: string, version?: string): Promise<boolean> {
    this.ensureInitialized();
    return this.withRetry(
      async () => {
        const result = await this.promptManager.validatePrompt(promptId, version);
        await this.telemetryManager.trackUserAction('validate_prompt');
        return result;
      },
      'validatePrompt',
      { promptId }
    );
  }

  /**
   * Check model compatibility for a prompt
   */
  async getModelCompatibility(
    promptId: string,
    modelProvider: string,
    modelName: string
  ): Promise<boolean> {
    this.ensureInitialized();
    return this.withRetry(
      async () => {
        const result = await this.promptManager.getModelCompatibility(promptId, modelProvider, modelName);
        await this.telemetryManager.trackUserAction('check_model_compatibility');
        return result;
      },
      'getModelCompatibility',
      { promptId, modelProvider, modelName }
    );
  }

  /**
   * Clear cache for specific prompt or all prompts
   */
  async clearCache(promptId?: string): Promise<void> {
    this.ensureInitialized();
    await this.promptManager.clearCache(promptId);
    await this.telemetryManager.trackUserAction('clear_cache');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.promptManager.getCacheStats();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PromptOpsClientOptions>): void {
    // Update base config
    if (config.apiKey !== undefined) {
      this.config.apiKey = config.apiKey;
      this.authManager.updateApiKey(config.apiKey);
    }
    if (config.baseUrl !== undefined) {
      this.config.baseUrl = config.baseUrl;
    }
    if (config.timeout !== undefined) {
      this.config.timeout = config.timeout;
    }
    if (config.enableCache !== undefined) {
      this.config.enableCache = config.enableCache;
    }
    if (config.enableTelemetry !== undefined) {
      this.config.enableTelemetry = config.enableTelemetry;
      this.telemetryManager.setEnabled(config.enableTelemetry);
    }

    // Update retry config
    if (config.retryConfig) {
      this.retryConfig = {
        ...this.retryConfig,
        ...config.retryConfig,
      };
    }
  }

  /**
   * Get client health status
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      auth: boolean;
      cache: boolean;
      telemetry: boolean;
    };
  }> {
    try {
      const authHealthy = await this.authManager.validateApiKey();
      const cacheHealthy = await this.cacheManager.healthCheck();

      const telemetryHealthy = this.config.enableTelemetry
        ? this.telemetryManager.getStats().enabled
        : true;

      const allHealthy = authHealthy && cacheHealthy && telemetryHealthy;

      return {
        status: allHealthy ? 'healthy' : 'degraded',
        details: {
          auth: authHealthy,
          cache: cacheHealthy,
          telemetry: telemetryHealthy,
        },
      };
    } catch {
      return {
        status: 'unhealthy',
        details: {
          auth: false,
          cache: false,
          telemetry: false,
        },
      };
    }
  }

  /**
   * Shutdown the client and cleanup resources
   */
  async shutdown(): Promise<void> {
    try {
      await this.telemetryManager.flush();
      await this.telemetryManager.shutdown();
      this.isInitialized = false;
    } catch (error) {
      console.warn('Error during shutdown:', error);
    }
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new ConfigurationError('Client not initialized. Call initialize() first.');
    }
  }

  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    context?: Record<string, any>
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        const startTime = Date.now();
        const result = await operation();

        await this.telemetryManager.trackPerformance(
          operationName,
          Date.now() - startTime,
          { attempt, ...context }
        );

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on certain errors
        if (
          error instanceof PromptOpsError &&
          (error.code === 'AUTHENTICATION_ERROR' ||
            error.code === 'AUTHORIZATION_ERROR' ||
            error.code === 'VALIDATION_ERROR')
        ) {
          throw error;
        }

        // Log retry attempt
        await this.telemetryManager.trackError(
          'retry_attempt',
          lastError.message,
          undefined,
          { operationName, attempt, maxRetries: this.retryConfig.maxRetries }
        );

        if (attempt < this.retryConfig.maxRetries) {
          const delay = this.calculateRetryDelay(attempt);
          await this.sleep(delay);
        }
      }
    }

    // Log final error
    await this.telemetryManager.trackError(
      'max_retries_exceeded',
      lastError?.message || 'Unknown error',
      undefined,
      { operationName, maxRetries: this.retryConfig.maxRetries }
    );

    throw lastError;
  }

  private calculateRetryDelay(attempt: number): number {
    const delay = Math.min(
      this.retryConfig.baseDelay * Math.pow(2, attempt - 1),
      this.retryConfig.maxDelay
    );

    if (this.retryConfig.jitter) {
      return delay * (0.5 + Math.random() * 0.5);
    }

    return delay;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}