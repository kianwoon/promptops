/**
 * Main PromptOps Client Class
 */

import {
  PromptOpsConfig,
  PromptRequest,
  PromptResponse,
  RenderResult,
  ABTestingConfig,
  EnvironmentConfig,
  HealthCheckResult
} from './types';
import { AuthenticationManager } from './auth/AuthenticationManager';
import { CacheManager } from './cache/CacheManager';
import { TelemetryManager } from './telemetry/TelemetryManager';
import { PromptManager } from './prompts/PromptManager';
import { ABTestingManager } from './ab-testing/ABTestingManager';
import { ConfigurationError, PromptOpsError } from './types/errors';
import { RetryConfig } from './types';
import {
  EnvironmentManager,
  ConnectionManager,
  EnvironmentConfigClass,
  createEnvironmentConfig
} from './environment/EnvironmentManager';

export interface PromptOpsClientOptions extends PromptOpsConfig {
  retryConfig?: Partial<RetryConfig>;
  abTestingConfig?: Partial<ABTestingConfig>;
}

export class PromptOpsClient {
  private config: Required<PromptOpsConfig>;
  private environmentConfig: EnvironmentConfig;
  private authManager: AuthenticationManager;
  private cacheManager: CacheManager;
  private telemetryManager: TelemetryManager;
  private promptManager: PromptManager;
  private abTestingManager: ABTestingManager;
  private retryConfig: Required<RetryConfig>;
  private connectionManager: ConnectionManager;
  private isInitialized: boolean = false;

  constructor(options: PromptOpsClientOptions) {
    // Resolve configuration with environment detection
    this.config = this.resolveConfig(options);

    // Set retry configuration
    this.retryConfig = {
      maxRetries: options.retryConfig?.maxRetries || 3,
      baseDelay: options.retryConfig?.baseDelay || 1000,
      maxDelay: options.retryConfig?.maxDelay || 10000,
      jitter: options.retryConfig?.jitter ?? true,
    };

    // Initialize environment and connection manager
    this.connectionManager = new ConnectionManager(
      this.environmentConfig,
      this.config.maxRetries || 3,
      this.config.retryDelay || 1
    );

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
    this.abTestingManager = new ABTestingManager(
      this.authManager.getClient(),
      this.cacheManager,
      this.telemetryManager,
      options.abTestingConfig
    );
  }

  private resolveConfig(options: PromptOpsClientOptions): Required<PromptOpsConfig> {
    const resolvedConfig: Partial<PromptOpsConfig> = { ...options };

    // Get API key from environment if not provided
    if (!resolvedConfig.apiKey) {
      const envApiKey = process.env.PROMPTOPS_API_KEY;
      if (envApiKey) {
        resolvedConfig.apiKey = envApiKey;
        console.log('Using API key from environment variable');
      } else {
        // For development, we can be more lenient
        if (this.isDevelopmentEnvironment(resolvedConfig)) {
          console.warn('No API key provided - some features may not work');
          resolvedConfig.apiKey = 'dev-api-key';
        } else {
          throw new ConfigurationError('API key is required. Set PROMPTOPS_API_KEY environment variable or provide in config.');
        }
      }
    }

    // Auto-detect environment if requested
    if (resolvedConfig.autoDetectEnvironment && !resolvedConfig.baseUrl) {
      // Note: In a real implementation, this would be async
      // For now, we'll use a simpler approach
      const envConfig = createEnvironmentConfig(resolvedConfig.environment);
      resolvedConfig.baseUrl = envConfig.baseUrl;
      console.log(`Auto-detected environment: ${envConfig.environment}, base URL: ${envConfig.baseUrl}`);
    }

    // Set defaults
    resolvedConfig.baseUrl = resolvedConfig.baseUrl || 'https://api.promptops.ai';
    resolvedConfig.timeout = resolvedConfig.timeout || 30000;
    resolvedConfig.retries = resolvedConfig.retries || 3;
    resolvedConfig.enableCache = resolvedConfig.enableCache ?? true;
    resolvedConfig.cacheTTL = resolvedConfig.cacheTTL || 300000;
    resolvedConfig.enableTelemetry = resolvedConfig.enableTelemetry ?? true;
    resolvedConfig.userAgent = resolvedConfig.userAgent || 'promptops-client/1.0.0';
    resolvedConfig.autoDetectEnvironment = resolvedConfig.autoDetectEnvironment ?? true;
    resolvedConfig.connectionTimeout = resolvedConfig.connectionTimeout || 5;
    resolvedConfig.maxRetries = resolvedConfig.maxRetries || 3;
    resolvedConfig.retryDelay = resolvedConfig.retryDelay || 1;
    resolvedConfig.enableConnectionTest = resolvedConfig.enableConnectionTest ?? true;
    resolvedConfig.healthCheckEndpoint = resolvedConfig.healthCheckEndpoint || '/health';

    // Create environment config
    this.environmentConfig = new EnvironmentConfigClass(
      resolvedConfig.environment || 'production' as any,
      resolvedConfig.baseUrl
    );

    console.log(`Configuration resolved - Environment: ${this.environmentConfig.environment}, Base URL: ${resolvedConfig.baseUrl}`);

    return resolvedConfig as Required<PromptOpsConfig>;
  }

  private isDevelopmentEnvironment(config: Partial<PromptOpsConfig>): boolean {
    // Check environment variable
    const env = process.env.PROMPTOPS_ENVIRONMENT?.toLowerCase();
    if (env === 'development') {
      return true;
    }

    // Check if base URL suggests development
    if (config.baseUrl && (config.baseUrl.includes('localhost') || config.baseUrl.includes('127.0.0.1'))) {
      return true;
    }

    // Check common development indicators
    if (process.env.DEBUG?.toLowerCase() === 'true') {
      return true;
    }

    return false;
  }

  /**
   * Initialize the client and validate configuration
   */
  async initialize(): Promise<void> {
    try {
      // Validate configuration
      this.validateConfig();

      // Test connection if enabled
      if (this.config.enableConnectionTest) {
        console.log(`Testing connection to PromptOps API: ${this.config.baseUrl}`);
        const connectionOk = await this.connectionManager.testConnectionWithRetry();
        if (!connectionOk) {
          if (this.environmentConfig.environment === 'development') {
            console.warn('Connection test failed, but continuing in development mode');
          } else {
            throw new PromptOpsError(`Failed to connect to ${this.config.baseUrl}`);
          }
        }
      }

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
      console.log(`PromptOps client initialized successfully - Environment: ${this.environmentConfig.environment}, Base URL: ${this.config.baseUrl}`);
    } catch (error) {
      await this.telemetryManager.trackError(
        'initialization_failed',
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  private validateConfig(): void {
    if (!this.config.baseUrl) {
      throw new ConfigurationError('Base URL is required');
    }

    // Allow development environment to work without API key for certain operations
    if (!this.config.apiKey && this.environmentConfig.environment !== 'development') {
      throw new ConfigurationError('API key is required');
    }

    if (this.config.timeout <= 0) {
      throw new ConfigurationError('Timeout must be positive');
    }

    // Validate environment configuration
    const [isValid, errorMessage] = this.environmentConfig.validate();
    if (!isValid) {
      throw new ConfigurationError(`Environment configuration invalid: ${errorMessage}`);
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

  // ========== A/B Testing Methods ==========

  /**
   * Get prompt with A/B testing variant support
   */
  async getPromptWithVariant(request: any) {
    this.ensureInitialized();
    return this.withRetry(
      async () => {
        return this.abTestingManager.getPromptWithVariant(request, (req) => this.getPrompt(req));
      },
      'getPromptWithVariant',
      { promptId: request.promptId }
    );
  }

  /**
   * Track an A/B testing event
   */
  async trackABTestEvent(event: any) {
    this.ensureInitialized();
    return this.withRetry(
      async () => {
        const result = await this.abTestingManager.trackEvent(event);
        await this.telemetryManager.trackUserAction('ab_test_event_tracked', {
          experiment_id: event.experiment_id,
          event_type: event.event_type
        });
        return result;
      },
      'trackABTestEvent',
      { experiment_id: event.experiment_id }
    );
  }

  /**
   * Track a conversion event for A/B testing
   */
  async trackConversion(experimentId: string, assignmentId: string, conversionValue?: number, context?: any) {
    this.ensureInitialized();
    return this.withRetry(
      async () => {
        const result = await this.abTestingManager.trackConversion(experimentId, assignmentId, conversionValue, context);
        await this.telemetryManager.trackUserAction('conversion_tracked', {
          experiment_id: experimentId,
          conversion_value: conversionValue
        });
        return result;
      },
      'trackConversion',
      { experiment_id: experimentId }
    );
  }

  /**
   * Create an A/B testing experiment
   */
  async createExperiment(experiment: any) {
    this.ensureInitialized();
    return this.withRetry(
      async () => {
        const result = await this.abTestingManager.createExperiment(experiment);
        await this.telemetryManager.trackUserAction('experiment_created', {
          experiment_id: result.id,
          prompt_id: experiment.prompt_id
        });
        return result;
      },
      'createExperiment'
    );
  }

  /**
   * Get A/B testing experiment details
   */
  async getExperiment(experimentId: string) {
    this.ensureInitialized();
    return this.withRetry(
      async () => this.abTestingManager.getExperiment(experimentId),
      'getExperiment',
      { experiment_id: experimentId }
    );
  }

  /**
   * Update an A/B testing experiment
   */
  async updateExperiment(experimentId: string, update: any) {
    this.ensureInitialized();
    return this.withRetry(
      async () => {
        const result = await this.abTestingManager.updateExperiment(experimentId, update);
        await this.telemetryManager.trackUserAction('experiment_updated', {
          experiment_id: experimentId
        });
        return result;
      },
      'updateExperiment',
      { experiment_id: experimentId }
    );
  }

  /**
   * Start an A/B testing experiment
   */
  async startExperiment(experimentId: string) {
    this.ensureInitialized();
    return this.withRetry(
      async () => {
        const result = await this.abTestingManager.startExperiment(experimentId);
        await this.telemetryManager.trackUserAction('experiment_started', {
          experiment_id: experimentId
        });
        return result;
      },
      'startExperiment',
      { experiment_id: experimentId }
    );
  }

  /**
   * Pause an A/B testing experiment
   */
  async pauseExperiment(experimentId: string) {
    this.ensureInitialized();
    return this.withRetry(
      async () => {
        const result = await this.abTestingManager.pauseExperiment(experimentId);
        await this.telemetryManager.trackUserAction('experiment_paused', {
          experiment_id: experimentId
        });
        return result;
      },
      'pauseExperiment',
      { experiment_id: experimentId }
    );
  }

  /**
   * Complete an A/B testing experiment
   */
  async completeExperiment(experimentId: string) {
    this.ensureInitialized();
    return this.withRetry(
      async () => {
        const result = await this.abTestingManager.completeExperiment(experimentId);
        await this.telemetryManager.trackUserAction('experiment_completed', {
          experiment_id: experimentId
        });
        return result;
      },
      'completeExperiment',
      { experiment_id: experimentId }
    );
  }

  /**
   * Get experiment results
   */
  async getExperimentResults(experimentId: string) {
    this.ensureInitialized();
    return this.withRetry(
      async () => this.abTestingManager.getExperimentResults(experimentId),
      'getExperimentResults',
      { experiment_id: experimentId }
    );
  }

  /**
   * Get variant performance metrics
   */
  async getVariantPerformance(experimentId: string) {
    this.ensureInitialized();
    return this.withRetry(
      async () => this.abTestingManager.getVariantPerformance(experimentId),
      'getVariantPerformance',
      { experiment_id: experimentId }
    );
  }

  /**
   * Get A/B testing statistics
   */
  async getABTestStats(projectId?: string) {
    this.ensureInitialized();
    return this.withRetry(
      async () => this.abTestingManager.getStats(projectId),
      'getABTestStats',
      { project_id: projectId }
    );
  }

  /**
   * Create a feature flag
   */
  async createFeatureFlag(featureFlag: any) {
    this.ensureInitialized();
    return this.withRetry(
      async () => {
        const result = await this.abTestingManager.createFeatureFlag(featureFlag);
        await this.telemetryManager.trackUserAction('feature_flag_created', {
          feature_flag_id: result.id,
          name: featureFlag.name
        });
        return result;
      },
      'createFeatureFlag'
    );
  }

  /**
   * Get feature flags
   */
  async getFeatureFlags(projectId?: string, enabled?: boolean) {
    this.ensureInitialized();
    return this.withRetry(
      async () => this.abTestingManager.getFeatureFlags(projectId, enabled),
      'getFeatureFlags',
      { project_id: projectId }
    );
  }

  /**
   * Check if a feature is enabled
   */
  async isFeatureEnabled(featureFlagName: string, context?: any) {
    this.ensureInitialized();
    return this.withRetry(
      async () => this.abTestingManager.isFeatureEnabled(featureFlagName, context),
      'isFeatureEnabled',
      { feature_flag_name: featureFlagName }
    );
  }

  /**
   * Clear session assignments (useful for logout)
   */
  clearSessionAssignments(sessionId: string): void {
    this.abTestingManager.clearSessionAssignments(sessionId);
  }

  /**
   * Update A/B testing configuration
   */
  updateABTestingConfig(config: any): void {
    this.abTestingManager.updateConfig(config);
  }

  /**
   * Get A/B testing configuration
   */
  getABTestingConfig() {
    return this.abTestingManager.getConfig();
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

  /**
   * Get information about the current environment
   */
  getEnvironmentInfo(): any {
    return {
      environment: this.environmentConfig.environment,
      baseUrl: this.config.baseUrl,
      autoDetected: this.config.autoDetectEnvironment,
      connectionTestEnabled: this.config.enableConnectionTest,
      connectionStatus: this.connectionManager.getConnectionStatus(),
      recommendations: this.environmentConfig.getRecommendations()
    };
  }

  /**
   * Test connection with retry logic
   */
  async testConnectionWithRetry(): Promise<boolean> {
    return await this.connectionManager.testConnectionWithRetry();
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): any {
    return this.connectionManager.getConnectionStatus();
  }

  /**
   * Perform comprehensive health check
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const results: HealthCheckResult = {
      timestamp: new Date().toISOString(),
      environment: this.environmentConfig.environment,
      baseUrl: this.config.baseUrl,
      clientInitialized: this.isInitialized,
      connection: {
        healthy: false,
      },
      authentication: false,
      cache: {
        enabled: false,
      },
      overall: false,
    };

    // Test connection
    try {
      const connectionOk = await this.connectionManager.testConnectionWithRetry();
      results.connection = {
        healthy: connectionOk,
        details: this.connectionManager.getConnectionStatus(),
      };
    } catch (error) {
      results.connection = {
        healthy: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    // Test authentication
    try {
      const authOk = await this.authManager.validateApiKey();
      results.authentication = authOk;
    } catch (error) {
      results.authentication = false;
    }

    // Test cache
    try {
      if (this.config.enableCache) {
        const cacheHealth = await this.cacheManager.healthCheck();
        results.cache = {
          enabled: true,
          healthy: cacheHealth,
          stats: this.cacheManager.getStats(),
        };
      }
    } catch (error) {
      results.cache = {
        enabled: true,
        healthy: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    // Overall health
    results.overall = (
      results.connection.healthy &&
      results.authentication &&
      (!results.cache.enabled || results.cache.healthy)
    );

    return results;
  }
}

/**
 * Create and initialize a PromptOps client with auto-detection
 */
export async function createClient(
  options?: PromptOpsClientOptions
): Promise<PromptOpsClient> {
  const client = new PromptOpsClient(options || {});
  await client.initialize();
  return client;
}

/**
 * Create a client configured for a specific environment
 */
export async function createClientForEnvironment(
  environment: string = 'development',
  apiKey?: string,
  options?: Partial<PromptOpsClientOptions>
): Promise<PromptOpsClient> {
  const envOptions: Partial<PromptOpsClientOptions> = {
    ...options,
    autoDetectEnvironment: false,
  };

  // Set defaults based on environment
  switch (environment) {
    case 'development':
      envOptions.baseUrl = envOptions.baseUrl || 'http://localhost:8000';
      envOptions.timeout = envOptions.timeout || 30000;
      envOptions.enableTelemetry = envOptions.enableTelemetry ?? false;
      break;
    case 'staging':
      envOptions.baseUrl = envOptions.baseUrl || 'https://staging-api.promptops.ai';
      envOptions.timeout = envOptions.timeout || 45000;
      envOptions.enableTelemetry = envOptions.enableTelemetry ?? true;
      break;
    default: // production
      envOptions.baseUrl = envOptions.baseUrl || 'https://api.promptops.ai';
      envOptions.timeout = envOptions.timeout || 60000;
      envOptions.enableTelemetry = envOptions.enableTelemetry ?? true;
  }

  if (apiKey) {
    envOptions.apiKey = apiKey;
  }

  return await createClient(envOptions);
}