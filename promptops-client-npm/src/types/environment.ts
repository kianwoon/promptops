/**
 * Environment detection and configuration types for PromptOps JavaScript client
 */

export enum Environment {
  DEVELOPMENT = 'development',
  STAGING = 'staging',
  PRODUCTION = 'production',
}

export interface EnvironmentConfig {
  environment: Environment;
  baseUrl: string;
  autoDetect: boolean;
  connectionTimeout: number;
  maxRetries: number;
  retryDelay: number;
  enableConnectionTest: boolean;
  healthCheckEndpoint: string;
}

export interface ConnectionStatus {
  tested: boolean;
  healthy: boolean;
  baseUrl: string;
  environment: string;
  maxRetries: number;
}

export interface HealthCheckResult {
  timestamp: string;
  environment: string;
  baseUrl: string;
  clientInitialized: boolean;
  connection: {
    healthy: boolean;
    details?: ConnectionStatus;
    error?: string;
  };
  authentication: boolean;
  cache: {
    enabled: boolean;
    healthy?: boolean;
    stats?: any;
    error?: string;
  };
  overall: boolean;
}

export interface EnvironmentRecommendations {
  environment: string;
  baseUrl: string;
  enableDebugLogging: boolean;
  enableCache: boolean;
  cacheTTL: number;
  enableTelemetry: boolean;
  retryAttempts: number;
  timeout: number;
}