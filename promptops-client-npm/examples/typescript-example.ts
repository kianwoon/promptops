/**
 * TypeScript Usage Example with Advanced Features
 */

import {
  PromptOpsClient,
  PromptRequest,
  PromptResponse,
  RenderResult,
  PromptOpsError,
  createClient,
  DEFAULT_CONFIG,
} from '../src';

// Extended configuration with TypeScript types
interface AdvancedConfig {
  baseUrl: string;
  apiKey: string;
  environment: 'development' | 'staging' | 'production';
  enableAdvancedTelemetry: boolean;
  customRetryStrategy: {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
  };
}

class AdvancedPromptOpsClient {
  private client: PromptOpsClient;
  private config: AdvancedConfig;

  constructor(config: AdvancedConfig) {
    this.config = config;

    // Create client with custom configuration
    this.client = new PromptOpsClient({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      ...DEFAULT_CONFIG,
      retries: config.customRetryStrategy.maxRetries,
      retryConfig: {
        maxRetries: config.customRetryStrategy.maxRetries,
        baseDelay: config.customRetryStrategy.baseDelay,
        maxDelay: config.customRetryStrategy.maxDelay,
        jitter: true,
      },
    });
  }

  async initialize(): Promise<void> {
    await this.client.initialize();
    console.log(`Advanced client initialized for ${this.config.environment} environment`);
  }

  // Typed prompt request with validation
  async getPromptWithValidation(request: PromptRequest & { required?: string[] }): Promise<PromptResponse> {
    // Validate required variables
    if (request.required) {
      const missingVars = request.required.filter(
        variable => !(request.variables && variable in request.variables)
      );

      if (missingVars.length > 0) {
        throw new Error(`Missing required variables: ${missingVars.join(', ')}`);
      }
    }

    return this.client.getPrompt(request);
  }

  // Batch prompt operations
  async batchGetPrompts(requests: PromptRequest[]): Promise<PromptResponse[]> {
    const results: PromptResponse[] = [];

    for (const request of requests) {
      try {
        const prompt = await this.client.getPrompt(request);
        results.push(prompt);
      } catch (error) {
        console.error(`Failed to get prompt ${request.promptId}:`, error);
        // Continue with other prompts
      }
    }

    return results;
  }

  // Prompt template with type safety
  async getPromptTemplate<T extends Record<string, any>>(
    promptId: string,
    version?: string
  ): Promise<(variables: T) => Promise<string>> {
    return async (variables: T): Promise<string> => {
      return this.client.getPromptContent({
        promptId,
        version,
        variables,
      });
    };
  }

  // Advanced error handling with retry
  async getPromptWithRetry(
    request: PromptRequest,
    maxAttempts: number = 3
  ): Promise<PromptResponse> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.client.getPrompt(request);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt === maxAttempts) {
          break;
        }

        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  // Performance monitoring
  async getPromptWithMetrics(request: PromptRequest): Promise<{
    prompt: PromptResponse;
    metrics: {
      duration: number;
      cacheHit: boolean;
      requestSize: number;
    };
  }> {
    const startTime = Date.now();
    const cacheStatsBefore = this.client.getCacheStats();

    try {
      const prompt = await this.client.getPrompt(request);
      const duration = Date.now() - startTime;
      const cacheStatsAfter = this.client.getCacheStats();

      const cacheHit = cacheStatsAfter.hits > cacheStatsBefore.hits;
      const requestSize = JSON.stringify(request).length;

      return {
        prompt,
        metrics: {
          duration,
          cacheHit,
          requestSize,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`Failed to get prompt in ${duration}ms:`, error);
      throw error;
    }
  }

  // Custom prompt rendering with context
  async renderWithContext(
    request: PromptRequest,
    context: {
      userId?: string;
      sessionId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<RenderResult> {
    const renderRequest = {
      ...request,
      overrides: {
        ...request.overrides,
        context,
      },
    };

    return this.client.renderPrompt(renderRequest);
  }

  async shutdown(): Promise<void> {
    await this.client.shutdown();
  }
}

// Example usage
async function advancedExample() {
  const config: AdvancedConfig = {
    baseUrl: 'https://api.promptops.com/v1',
    apiKey: 'your-api-key-here',
    environment: 'development',
    enableAdvancedTelemetry: true,
    customRetryStrategy: {
      maxRetries: 5,
      baseDelay: 1000,
      maxDelay: 30000,
    },
  };

  const client = new AdvancedPromptOpsClient(config);
  await client.initialize();

  try {
    // Basic usage with type safety
    const prompt = await client.getPromptWithValidation({
      promptId: 'welcome-message',
      version: '1.0.0',
      variables: {
        name: 'TypeScript Developer',
        framework: 'TypeScript',
      },
      required: ['name'],
    });

    console.log('Prompt:', prompt.name);

    // Batch operations
    const batchResults = await client.batchGetPrompts([
      { promptId: 'greeting', variables: { name: 'User1' } },
      { promptId: 'farewell', variables: { name: 'User2' } },
    ]);

    console.log('Batch results:', batchResults.length);

    // Template function
    const welcomeTemplate = await client.getPromptTemplate<{ name: string; role: string }>('welcome-template');
    const personalizedWelcome = await welcomeTemplate({
      name: 'Developer',
      role: 'Engineer',
    });

    console.log('Personalized welcome:', personalizedWelcome);

    // Advanced metrics
    const { prompt: metricsPrompt, metrics } = await client.getPromptWithMetrics({
      promptId: 'system-prompt',
      variables: { complexity: 'high' },
    });

    console.log('Metrics:', metrics);

    // Context-aware rendering
    const contextRender = await client.renderWithContext(
      {
        promptId: 'user-message',
        variables: { content: 'Hello' },
      },
      {
        userId: 'user-123',
        sessionId: 'session-456',
        metadata: {
          source: 'web-app',
          version: '1.0.0',
        },
      }
    );

    console.log('Context render:', contextRender);

  } catch (error) {
    if (error instanceof PromptOpsError) {
      console.error('PromptOps Error:', {
        code: error.code,
        message: error.message,
        details: error.details,
      });
    } else {
      console.error('Error:', error);
    }
  } finally {
    await client.shutdown();
  }
}

// Run the example
advancedExample().catch(console.error);