/**
 * PromptOps Client - Official TypeScript/JavaScript SDK
 *
 * @module promptops-client
 */

// Main client class
export { PromptOpsClient } from './PromptOpsClient';

// Managers
export { AuthenticationManager } from './auth/AuthenticationManager';
export { CacheManager } from './cache/CacheManager';
export { TelemetryManager } from './telemetry/TelemetryManager';
export { PromptManager } from './prompts/PromptManager';

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

// Utility functions
export const createClient = (config: PromptOpsClientOptions): PromptOpsClient => {
  return new PromptOpsClient(config);
};

export default PromptOpsClient;