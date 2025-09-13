# PromptOps Client - TypeScript/JavaScript SDK

[![npm version](https://badge.fury.io/js/promptops-client.svg)](https://badge.fury.io/js/promptops-client)
[![Build Status](https://github.com/your-org/promptops-client-npm/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/promptops-client-npm/actions)
[![Coverage Status](https://coveralls.io/repos/github/your-org/promptops-client-npm/badge.svg?branch=main)](https://coveralls.io/github/your-org/promptops-client-npm?branch=main)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

The official TypeScript/JavaScript client library for the PromptOps API. This SDK provides a convenient way to interact with PromptOps for managing and retrieving prompts with caching, telemetry, and advanced features.

## Features

- 🔐 **Secure Authentication**: API key-based authentication with automatic token management
- ⚡ **Multi-level Caching**: Memory and Redis caching with configurable TTL
- 📊 **Built-in Telemetry**: Usage analytics and performance monitoring
- 🔄 **Retry Logic**: Exponential backoff with configurable retry strategies
- 🎯 **Type Safety**: Full TypeScript support with comprehensive type definitions
- 🌐 **Cross-platform**: Works in Node.js, browsers, React, Vue, and other environments
- 🔧 **Configurable**: Extensive configuration options for different use cases
- 🧪 **Well Tested**: Comprehensive test suite with high code coverage

## Installation

```bash
npm install promptops-client
```

or with yarn:

```bash
yarn add promptops-client
```

## Quick Start

### Basic Usage (ES Modules)

```typescript
import { PromptOpsClient } from 'promptops-client';

const client = new PromptOpsClient({
  baseUrl: 'https://api.promptops.com/v1',
  apiKey: 'your-api-key-here',
});

// Initialize the client
await client.initialize();

// Get a prompt with variable substitution
const content = await client.getPromptContent({
  promptId: 'hello-world',
  version: '1.0.0',
  variables: {
    name: 'Developer',
    framework: 'TypeScript',
  },
});

console.log(content);
// Output: "Hello Developer! Welcome to TypeScript."
```

### CommonJS Usage

```javascript
const { PromptOpsClient } = require('promptops-client');

const client = new PromptOpsClient({
  baseUrl: 'https://api.promptops.com/v1',
  apiKey: 'your-api-key-here',
});

async function main() {
  await client.initialize();

  const content = await client.getPromptContent({
    promptId: 'hello-world',
    variables: { name: 'User' },
  });

  console.log(content);
}

main().catch(console.error);
```

## Configuration

### Client Options

```typescript
interface PromptOpsClientOptions {
  baseUrl: string;                    // PromptOps API base URL
  apiKey?: string;                    // API key for authentication
  timeout?: number;                   // Request timeout in milliseconds (default: 30000)
  retries?: number;                   // Maximum retry attempts (default: 3)
  enableCache?: boolean;              // Enable caching (default: true)
  cacheTTL?: number;                  // Cache TTL in milliseconds (default: 300000)
  enableTelemetry?: boolean;          // Enable telemetry (default: true)
  redisUrl?: string;                  // Redis URL for distributed caching
  telemetryEndpoint?: string;        // Custom telemetry endpoint
  userAgent?: string;                 // Custom user agent
  retryConfig?: {
    maxRetries?: number;              // Maximum retries (default: 3)
    baseDelay?: number;               // Base delay for retries (default: 1000ms)
    maxDelay?: number;                // Maximum delay (default: 10000ms)
    jitter?: boolean;                 // Add jitter to retry delays (default: true)
  };
}
```

### Example with Advanced Configuration

```typescript
const client = new PromptOpsClient({
  baseUrl: 'https://api.promptops.com/v1',
  apiKey: process.env.PROMPTOPS_API_KEY,
  timeout: 45000,
  retries: 5,
  enableCache: true,
  cacheTTL: 600000, // 10 minutes
  enableTelemetry: true,
  redisUrl: process.env.REDIS_URL,
  retryConfig: {
    maxRetries: 5,
    baseDelay: 2000,
    maxDelay: 30000,
    jitter: true,
  },
});
```

## API Reference

### Core Methods

#### `initialize(): Promise<void>`
Initialize the client and validate configuration.

```typescript
await client.initialize();
```

#### `getPrompt(request: PromptRequest): Promise<PromptResponse>`
Get prompt metadata and content.

```typescript
const prompt = await client.getPrompt({
  promptId: 'my-prompt',
  version: '1.0.0',
  variables: { name: 'User' },
  modelProvider: 'openai',
  modelName: 'gpt-4',
});
```

#### `getPromptContent(request: PromptRequest): Promise<string>`
Get prompt content with variable substitution applied.

```typescript
const content = await client.getPromptContent({
  promptId: 'welcome-message',
  variables: {
    name: 'Alice',
    company: 'Acme Corp',
  },
});
```

#### `listPrompts(moduleId?: string, limit?: number): Promise<PromptResponse[]>`
List available prompts, optionally filtered by module.

```typescript
const prompts = await client.listPrompts('my-module', 50);
```

#### `renderPrompt(request: PromptRequest): Promise<RenderResult>`
Render a prompt with variable substitution and policies.

```typescript
const result = await client.renderPrompt({
  promptId: 'system-prompt',
  variables: { context: 'user-query' },
  tenantId: 'tenant-123',
});
```

#### `validatePrompt(promptId: string, version?: string): Promise<boolean>`
Check if a prompt exists and is valid.

```typescript
const isValid = await client.validatePrompt('my-prompt', '1.0.0');
```

#### `getModelCompatibility(promptId: string, modelProvider: string, modelName: string): Promise<boolean>`
Check if a prompt is compatible with a specific model.

```typescript
const isCompatible = await client.getModelCompatibility(
  'my-prompt',
  'openai',
  'gpt-4'
);
```

### Utility Methods

#### `healthCheck(): Promise<HealthStatus>`
Check the health status of the client and its dependencies.

```typescript
const health = await client.healthCheck();
console.log(health.status); // 'healthy', 'degraded', or 'unhealthy'
```

#### `clearCache(promptId?: string): Promise<void>`
Clear cache for a specific prompt or all prompts.

```typescript
await client.clearCache('my-prompt');
// or
await client.clearCache(); // Clear all cache
```

#### `getCacheStats(): CacheStats`
Get cache performance statistics.

```typescript
const stats = client.getCacheStats();
console.log(`Cache hit rate: ${(stats.hitRate * 100).toFixed(2)}%`);
```

#### `updateConfig(config: Partial<PromptOpsClientOptions>): void`
Update client configuration at runtime.

```typescript
client.updateConfig({
  enableCache: false,
  timeout: 60000,
});
```

#### `shutdown(): Promise<void>`
Gracefully shutdown the client and cleanup resources.

```typescript
await client.shutdown();
```

## Variable Substitution

The client supports flexible variable substitution in prompts:

### Supported Patterns

- `{{variable}}` - Double curly braces
- `${variable}` - Dollar sign curly braces
- `{{nested.property}}` - Nested object properties

### Example

Prompt template:
```
Hello {{name}}! Welcome to {{company}}.

Your role is: {{user.role}}
Department: {{user.department}}
```

Variables:
```typescript
const variables = {
  name: 'John Doe',
  company: 'Tech Corp',
  user: {
    role: 'Developer',
    department: 'Engineering',
  },
};
```

Result:
```
Hello John Doe! Welcome to Tech Corp.

Your role is: Developer
Department: Engineering
```

## Error Handling

The client provides comprehensive error handling with specific error types:

```typescript
import {
  PromptOpsError,
  AuthenticationError,
  AuthorizationError,
  NetworkError,
  TimeoutError,
  ValidationError,
  NotFoundError,
  RateLimitError,
} from 'promptops-client';

try {
  const content = await client.getPromptContent({
    promptId: 'my-prompt',
    variables: { name: 'User' },
  });
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Authentication failed:', error.message);
  } else if (error instanceof RateLimitError) {
    console.error('Rate limit exceeded. Retry after:', error.retryAfter);
  } else if (error instanceof ValidationError) {
    console.error('Invalid request:', error.details);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## React Integration

For React applications, you can create custom hooks:

```typescript
import { useState, useEffect } from 'react';
import { PromptOpsClient, PromptRequest } from 'promptops-client';

export function usePrompt(client: PromptOpsClient) {
  const [prompt, setPrompt] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const getPrompt = async (request: PromptRequest) => {
    setLoading(true);
    setError(null);

    try {
      const content = await client.getPromptContent(request);
      setPrompt(content);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return { prompt, loading, error, getPrompt };
}
```

## Performance Optimization

### Caching Strategy

The client implements a two-level caching strategy:

1. **Memory Cache**: Fast in-memory caching for frequently accessed prompts
2. **Redis Cache**: Distributed caching for multi-instance deployments

```typescript
// Configure Redis for distributed caching
const client = new PromptOpsClient({
  baseUrl: 'https://api.promptops.com/v1',
  apiKey: 'your-api-key',
  redisUrl: 'redis://localhost:6379',
  cacheTTL: 300000, // 5 minutes
});
```

### Batch Operations

For better performance with multiple prompts:

```typescript
// Get multiple prompts efficiently
const prompts = await Promise.all([
  client.getPromptContent({ promptId: 'greeting', variables: { name: 'User1' } }),
  client.getPromptContent({ promptId: 'farewell', variables: { name: 'User2' } }),
]);
```

## Telemetry and Monitoring

The client automatically collects usage telemetry (when enabled):

```typescript
// Telemetry is enabled by default
const client = new PromptOpsClient({
  baseUrl: 'https://api.promptops.com/v1',
  apiKey: 'your-api-key',
  enableTelemetry: true, // default
});

// Custom telemetry endpoint
const client = new PromptOpsClient({
  baseUrl: 'https://api.promptops.com/v1',
  apiKey: 'your-api-key',
  telemetryEndpoint: 'https://telemetry.your-company.com/v1/events',
});
```

## Testing

The library includes comprehensive tests:

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Examples

Check the `/examples` directory for more detailed examples:

- `basic-usage.ts` - Basic ES modules usage
- `commonjs-usage.js` - CommonJS usage
- `react-hook.tsx` - React integration example
- `node-server.ts` - Express server integration
- `typescript-example.ts` - Advanced TypeScript usage

## Development

### Building the Project

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Build in watch mode
npm run build:watch
```

### Code Quality

```bash
# Lint code
npm run lint

# Format code
npm run format

# Type checking
npx tsc --noEmit
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 📚 [Documentation](https://docs.promptops.com)
- 🐛 [Issue Tracker](https://github.com/your-org/promptops-client-npm/issues)
- 💬 [Community Forum](https://community.promptops.com)
- 📧 [Email Support](mailto:support@promptops.com)

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for details about changes in each version.