/**
 * PromptOps Client - Official TypeScript/JavaScript SDK
 *
 * @module promptops-client
 */

// Main client class
export { PromptOpsClient, createClient, createClientForEnvironment } from './PromptOpsClient';

// Environment management
export {
  EnvironmentManager,
  ConnectionManager,
  EnvironmentConfigClass,
  createEnvironmentConfig,
} from './environment/EnvironmentManager';

// Managers
export { AuthenticationManager } from './auth/AuthenticationManager';
export { CacheManager } from './cache/CacheManager';
export { TelemetryManager } from './telemetry/TelemetryManager';
export { PromptManager } from './prompts/PromptManager';
export { ABTestingManager } from './ab-testing/ABTestingManager';

// Types and interfaces
export type {
  PromptOpsConfig,
  PromptRequest,
  PromptResponse,
  ModelSpecificPrompt,
  Module,
  Project,
  CacheConfig,
  TelemetryConfig,
  RetryConfig,
  VariableSubstitutionConfig,
  ModelCompatibility,
  ApprovalRequest,
  RenderResult,
  APIError,
  CacheStats,
  EnvironmentConfig,
  Environment,
  ConnectionStatus,
  HealthCheckResult,
  EnvironmentRecommendations,
} from './types';

// Error classes
export {
  PromptOpsError,
  AuthenticationError,
  AuthorizationError,
  NetworkError,
  TimeoutError,
  ValidationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ServiceUnavailableError,
  CacheError,
  TelemetryError,
  ConfigurationError,
  createErrorFromResponse,
} from './types/errors';

// Telemetry types
export type {
  TelemetryEvent,
  TelemetryBatch,
} from './telemetry/TelemetryManager';

// Client options
export type { PromptOpsClientOptions } from './PromptOpsClient';

// Version
export const version = '1.0.0';

// Default configuration
export const DEFAULT_CONFIG = {
  timeout: 30000,
  retries: 3,
  enableCache: true,
  cacheTTL: 300000, // 5 minutes
  enableTelemetry: true,
} as const;

// Environment enums and constants
export { Environment } from './types/environment';

export default PromptOpsClient;