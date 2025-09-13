/**
 * Custom error classes for PromptOps Client
 */

import { APIError } from './index';

export class PromptOpsError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, any>;

  constructor(message: string, code: string, details?: Record<string, any>) {
    super(message);
    this.name = 'PromptOpsError';
    this.code = code;
    this.details = details;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PromptOpsError);
    }
  }

  toJSON(): APIError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      stack: this.stack,
    };
  }
}

export class AuthenticationError extends PromptOpsError {
  constructor(message: string = 'Authentication failed', details?: Record<string, any>) {
    super(message, 'AUTHENTICATION_ERROR', details);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends PromptOpsError {
  constructor(message: string = 'Authorization failed', details?: Record<string, any>) {
    super(message, 'AUTHORIZATION_ERROR', details);
    this.name = 'AuthorizationError';
  }
}

export class NetworkError extends PromptOpsError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'NETWORK_ERROR', details);
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends PromptOpsError {
  constructor(message: string = 'Request timeout', details?: Record<string, any>) {
    super(message, 'TIMEOUT_ERROR', details);
    this.name = 'TimeoutError';
  }
}

export class ValidationError extends PromptOpsError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends PromptOpsError {
  constructor(message: string = 'Resource not found', details?: Record<string, any>) {
    super(message, 'NOT_FOUND_ERROR', details);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends PromptOpsError {
  constructor(message: string = 'Resource conflict', details?: Record<string, any>) {
    super(message, 'CONFLICT_ERROR', details);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends PromptOpsError {
  constructor(
    message: string = 'Rate limit exceeded',
    public readonly retryAfter?: number,
    details?: Record<string, any>
  ) {
    super(message, 'RATE_LIMIT_ERROR', details);
    this.name = 'RateLimitError';
  }
}

export class ServiceUnavailableError extends PromptOpsError {
  constructor(
    message: string = 'Service unavailable',
    public readonly retryAfter?: number,
    details?: Record<string, any>
  ) {
    super(message, 'SERVICE_UNAVAILABLE_ERROR', details);
    this.name = 'ServiceUnavailableError';
  }
}

export class CacheError extends PromptOpsError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'CACHE_ERROR', details);
    this.name = 'CacheError';
  }
}

export class TelemetryError extends PromptOpsError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'TELEMETRY_ERROR', details);
    this.name = 'TelemetryError';
  }
}

export class ConfigurationError extends PromptOpsError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'CONFIGURATION_ERROR', details);
    this.name = 'ConfigurationError';
  }
}

/**
 * Factory function to create appropriate error instances from HTTP responses
 */
export function createErrorFromResponse(
  status: number,
  message: string,
  details?: Record<string, any>
): PromptOpsError {
  switch (status) {
    case 400:
      return new ValidationError(message, details);
    case 401:
      return new AuthenticationError(message, details);
    case 403:
      return new AuthorizationError(message, details);
    case 404:
      return new NotFoundError(message, details);
    case 409:
      return new ConflictError(message, details);
    case 429:
      const retryAfter = details?.retry_after;
      return new RateLimitError(message, retryAfter, details);
    case 503:
      const serviceRetryAfter = details?.retry_after;
      return new ServiceUnavailableError(message, serviceRetryAfter, details);
    case 504:
      return new TimeoutError(message, details);
    default:
      return new PromptOpsError(message, 'UNKNOWN_ERROR', details);
  }
}