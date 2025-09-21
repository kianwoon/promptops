/**
 * Environment detection and configuration management for PromptOps JavaScript client
 */

import { Environment, EnvironmentConfig, EnvironmentRecommendations, ConnectionStatus } from '../types/environment';
import { ConfigurationError } from '../types/errors';

export class EnvironmentManager {
  private static readonly DEFAULT_URLS = {
    [Environment.DEVELOPMENT]: 'http://localhost:8000',
    [Environment.STAGING]: 'https://staging-api.promptops.ai',
    [Environment.PRODUCTION]: 'https://api.promptops.ai',
  };

  public static async detectEnvironment(baseUrl?: string): Promise<EnvironmentConfig> {
    // Check for explicit environment variable
    const envFromVar = process.env.PROMPTOPS_ENVIRONMENT?.toLowerCase();
    if (envFromVar && Object.values(Environment).includes(envFromVar as Environment)) {
      console.log(`Environment specified via environment variable: ${envFromVar}`);
      return new EnvironmentConfigClass(envFromVar as Environment, baseUrl);
    }

    // Check for explicit base URL in environment variable
    const baseUrlFromVar = process.env.PROMPTOPS_BASE_URL;
    if (baseUrlFromVar) {
      console.log(`Base URL specified via environment variable: ${baseUrlFromVar}`);
      // Infer environment from base URL
      if (baseUrlFromVar.includes('localhost') || baseUrlFromVar.includes('127.0.0.1')) {
        return new EnvironmentConfigClass(Environment.DEVELOPMENT, baseUrlFromVar);
      } else if (baseUrlFromVar.includes('staging')) {
        return new EnvironmentConfigClass(Environment.STAGING, baseUrlFromVar);
      } else {
        return new EnvironmentConfigClass(Environment.PRODUCTION, baseUrlFromVar);
      }
    }

    // If baseUrl is provided explicitly, use it
    if (baseUrl) {
      if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
        return new EnvironmentConfigClass(Environment.DEVELOPMENT, baseUrl);
      } else if (baseUrl.includes('staging')) {
        return new EnvironmentConfigClass(Environment.STAGING, baseUrl);
      } else {
        return new EnvironmentConfigClass(Environment.PRODUCTION, baseUrl);
      }
    }

    // Auto-detect: check if localhost:8000 is accessible
    if (await this.isLocalhostAccessible()) {
      console.log('Local development environment detected');
      return new EnvironmentConfigClass(Environment.DEVELOPMENT);
    }

    // Default to production
    console.log('Defaulting to production environment');
    return new EnvironmentConfigClass(Environment.PRODUCTION);
  }

  private static async isLocalhostAccessible(): Promise<boolean> {
    try {
      const response = await fetch('http://localhost:8000/health', {
        method: 'HEAD',
        timeout: 2000,
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  public static async testConnection(baseUrl: string, timeout: number = 5000): Promise<[boolean, string]> {
    try {
      const healthUrl = `${baseUrl.replace(/\/$/, '')}/health`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(healthUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'promptops-client/1.0.0',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return [true, 'Connection successful'];
      } else {
        return [false, `HTTP ${response.status}: ${response.statusText}`];
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        return [false, 'Connection timeout'];
      } else if (error.code === 'ECONNREFUSED') {
        return [false, 'Connection refused'];
      } else {
        return [false, `Connection failed: ${error.message}`];
      }
    }
  }

  public static getRecommendations(environment: Environment, baseUrl: string): EnvironmentRecommendations {
    const isDevelopment = environment === Environment.DEVELOPMENT;

    return {
      environment,
      baseUrl,
      enableDebugLogging: isDevelopment,
      enableCache: true,
      cacheTTL: isDevelopment ? 300 : 600,
      enableTelemetry: !isDevelopment,
      retryAttempts: isDevelopment ? 3 : 5,
      timeout: isDevelopment ? 30 : 60,
    };
  }

  public static validate(config: EnvironmentConfig): [boolean, string | null] {
    if (!config.baseUrl) {
      return [false, 'Base URL is required'];
    }

    try {
      const url = new URL(config.baseUrl);
      if (!['http:', 'https:'].includes(url.protocol)) {
        return [false, 'Base URL must use HTTP or HTTPS'];
      }
    } catch (error) {
      return [false, `Invalid base URL: ${error.message}`];
    }

    return [true, null];
  }
}

export class EnvironmentConfigClass implements EnvironmentConfig {
  public environment: Environment;
  public baseUrl: string;
  public autoDetect: boolean = true;
  public connectionTimeout: number = 5;
  public maxRetries: number = 3;
  public retryDelay: number = 1;
  public enableConnectionTest: boolean = true;
  public healthCheckEndpoint: string = '/health';

  constructor(environment: Environment, baseUrl?: string) {
    this.environment = environment;
    this.baseUrl = baseUrl || EnvironmentManager.DEFAULT_URLS[environment];
  }

  public getRecommendations(): EnvironmentRecommendations {
    return EnvironmentManager.getRecommendations(this.environment, this.baseUrl);
  }

  public validate(): [boolean, string | null] {
    return EnvironmentManager.validate(this);
  }
}

export class ConnectionManager {
  private config: EnvironmentConfig;
  private maxRetries: number;
  private baseDelay: number;
  private connectionTested: boolean = false;
  private connectionHealthy: boolean = false;

  constructor(config: EnvironmentConfig, maxRetries: number = 3, baseDelay: number = 1) {
    this.config = config;
    this.maxRetries = maxRetries;
    this.baseDelay = baseDelay;
  }

  public async testConnectionWithRetry(): Promise<boolean> {
    if (this.connectionTested) {
      return this.connectionHealthy;
    }

    console.log(`Testing connection to ${this.config.baseUrl}`);

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const [success, message] = await EnvironmentManager.testConnection(
          this.config.baseUrl,
          this.config.connectionTimeout * 1000
        );

        if (success) {
          this.connectionTested = true;
          this.connectionHealthy = true;
          console.log(`Connection test successful: ${this.config.baseUrl}`);
          return true;
        } else {
          console.warn(`Connection test failed (attempt ${attempt + 1}/${this.maxRetries}): ${message}`);

          if (attempt < this.maxRetries - 1) {
            const delay = this.baseDelay * Math.pow(2, attempt); // Exponential backoff
            console.log(`Retrying connection in ${delay} seconds`);
            await this.sleep(delay * 1000);
          }
        }
      } catch (error) {
        console.error(`Connection test error (attempt ${attempt + 1}/${this.maxRetries}):`, error);

        if (attempt < this.maxRetries - 1) {
          const delay = this.baseDelay * Math.pow(2, attempt);
          await this.sleep(delay * 1000);
        }
      }
    }

    this.connectionTested = true;
    this.connectionHealthy = false;
    console.error(`All connection attempts failed: ${this.config.baseUrl}`);
    return false;
  }

  public getConnectionStatus(): ConnectionStatus {
    return {
      tested: this.connectionTested,
      healthy: this.connectionHealthy,
      baseUrl: this.config.baseUrl,
      environment: this.config.environment,
      maxRetries: this.maxRetries,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export function createEnvironmentConfig(
  environment?: string,
  baseUrl?: string,
  forceEnvironment?: string
): EnvironmentConfig {
  if (forceEnvironment) {
    if (Object.values(Environment).includes(forceEnvironment as Environment)) {
      console.log(`Environment forced: ${forceEnvironment}`);
      return new EnvironmentConfigClass(forceEnvironment as Environment, baseUrl);
    } else {
      throw new ConfigurationError(`Invalid environment: ${forceEnvironment}`);
    }
  }

  if (environment) {
    if (Object.values(Environment).includes(environment as Environment)) {
      return new EnvironmentConfigClass(environment as Environment, baseUrl);
    } else {
      throw new ConfigurationError(`Invalid environment: ${environment}`);
    }
  }

  // For now, return a default config
  // In a real implementation, this would be async
  return new EnvironmentConfigClass(Environment.PRODUCTION, baseUrl);
}