# JavaScript/TypeScript Client Quick Start

This guide will help you get started with the PromptOps JavaScript/TypeScript client library quickly and efficiently.

## 🚀 Installation

### npm

```bash
npm install promptops-client
```

### yarn

```bash
yarn add promptops-client
```

### Optional Dependencies

```bash
# For Redis support (if needed)
npm install ioredis

# For additional HTTP client options
npm install axios retry-axios
```

## 🔑 Setup

### Environment Variables

Create a `.env` file:

```bash
# Required
PROMPTOPS_API_KEY=po_your_api_key_here
PROMPTOPS_BASE_URL=https://api.promptops.com/v1

# Optional - Redis for caching
REDIS_URL=redis://localhost:6379

# Optional - Custom configuration
PROMPTOPS_TIMEOUT=30000
PROMPTOPS_ENABLE_CACHE=true
PROMPTOPS_CACHE_TTL=300000
```

### Basic Configuration

```typescript
// TypeScript
import { PromptOpsClient } from 'promptops-client';

const client = new PromptOpsClient({
  baseUrl: 'https://api.promptops.com/v1',
  apiKey: process.env.PROMPTOPS_API_KEY || 'your-api-key',
});

// Initialize the client
await client.initialize();
```

```javascript
// JavaScript
const { PromptOpsClient } = require('promptops-client');

const client = new PromptOpsClient({
  baseUrl: 'https://api.promptops.com/v1',
  apiKey: process.env.PROMPTOPS_API_KEY || 'your-api-key',
});

// Initialize the client
await client.initialize();
```

## 🎯 Quick Examples

### Basic Prompt Retrieval

```typescript
async function basicExample() {
  try {
    // Get prompt content with variables
    const content = await client.getPromptContent({
      promptId: 'hello-world',
      version: '1.0.0',
      variables: {
        name: 'Developer',
        framework: 'TypeScript'
      }
    });

    console.log(content);
    // Output: "Hello Developer! Welcome to TypeScript."
  } catch (error) {
    console.error('Error:', error);
  }
}

// Initialize and run
(async () => {
  await client.initialize();
  await basicExample();
})();
```

### Variable Substitution

```typescript
interface WelcomeVariables {
  name: string;
  company: string;
  user: {
    role: string;
    department: string;
  };
}

async function variablesExample() {
  const variables: WelcomeVariables = {
    name: 'John Doe',
    company: 'Tech Corp',
    user: {
      role: 'Developer',
      department: 'Engineering'
    }
  };

  try {
    const content = await client.getPromptContent({
      promptId: 'welcome-message',
      version: '1.0.0',
      variables
    });

    console.log('Rendered content:', content);
  } catch (error) {
    console.error('Error:', error);
  }
}
```

### Model-Specific Prompts

```typescript
async function modelSpecificExample() {
  try {
    // Get OpenAI GPT-4 specific prompt
    const openaiContent = await client.getPromptContent({
      promptId: 'system-prompt',
      version: '1.0.0',
      variables: { context: 'customer-service' },
      modelProvider: 'openai',
      modelName: 'gpt-4'
    });

    console.log('OpenAI GPT-4:', openaiContent);

    // Get Anthropic Claude specific prompt
    const anthropicContent = await client.getPromptContent({
      promptId: 'system-prompt',
      version: '1.0.0',
      variables: { context: 'customer-service' },
      modelProvider: 'anthropic',
      modelName: 'claude-3-sonnet'
    });

    console.log('Anthropic Claude:', anthropicContent);
  } catch (error) {
    console.error('Error:', error);
  }
}
```

### List and Search Prompts

```typescript
async function searchExample() {
  try {
    // List all prompts
    const allPrompts = await client.listPrompts();
    console.log(`Found ${allPrompts.length} prompts`);

    // List prompts by module
    const modulePrompts = await client.listPrompts('customer-service');
    console.log(`Customer service prompts: ${modulePrompts.length}`);

    // List with pagination
    const prompts = await client.listPrompts(undefined, 10);
    console.log('First 10 prompts:', prompts.map(p => p.name));

  } catch (error) {
    console.error('Error:', error);
  }
}
```

## 📊 Configuration Options

### Advanced Configuration

```typescript
import { PromptOpsClient } from 'promptops-client';

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
  telemetryEndpoint: 'https://telemetry.your-company.com/v1/events'
});

await client.initialize();
```

### Runtime Configuration Updates

```typescript
// Update configuration at runtime
client.updateConfig({
  enableCache: false,
  timeout: 60000,
  retries: 3
});

// Verify configuration change
console.log('Cache enabled:', client.getConfig().enableCache);
```

## 🔄 Error Handling

```typescript
import {
  PromptOpsError,
  AuthenticationError,
  AuthorizationError,
  NetworkError,
  TimeoutError,
  ValidationError,
  NotFoundError,
  RateLimitError
} from 'promptops-client';

async function errorHandlingExample() {
  try {
    const content = await client.getPromptContent({
      promptId: 'nonexistent-prompt'
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      console.error('Authentication failed:', error.message);
      // Check API key
    } else if (error instanceof RateLimitError) {
      console.error('Rate limit exceeded. Retry after:', error.retryAfter);
      // Implement retry logic
    } else if (error instanceof ValidationError) {
      console.error('Invalid request:', error.details);
      // Fix request parameters
    } else if (error instanceof NotFoundError) {
      console.error('Prompt not found:', error.promptId);
      // Handle missing prompt
    } else if (error instanceof NetworkError) {
      console.error('Network error:', error.message);
      // Check network connection
    } else if (error instanceof TimeoutError) {
      console.error('Request timeout:', error.timeout);
      // Increase timeout or retry
    } else {
      console.error('Unexpected error:', error);
    }
  }
}
```

## 🎯 React Integration

### Custom Hook

```typescript
// hooks/usePrompt.ts
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

### React Component Usage

```typescript
// components/WelcomeMessage.tsx
import React from 'react';
import { usePrompt } from '../hooks/usePrompt';
import { PromptOpsClient } from 'promptops-client';

interface WelcomeMessageProps {
  client: PromptOpsClient;
  userName: string;
}

export const WelcomeMessage: React.FC<WelcomeMessageProps> = ({
  client,
  userName
}) => {
  const { prompt, loading, error, getPrompt } = usePrompt(client);

  useEffect(() => {
    getPrompt({
      promptId: 'welcome-message',
      variables: { name: userName }
    });
  }, [client, userName, getPrompt]);

  if (loading) return <div>Loading welcome message...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="welcome-message">
      {prompt}
    </div>
  );
};
```

### React Context Provider

```typescript
// context/PromptOpsContext.tsx
import React, { createContext, useContext, ReactNode } from 'react';
import { PromptOpsClient } from 'promptops-client';

interface PromptOpsContextType {
  client: PromptOpsClient;
  initialized: boolean;
}

const PromptOpsContext = createContext<PromptOpsContextType | null>(null);

export const PromptOpsProvider: React.FC<{
  children: ReactNode;
  apiKey: string;
}> = ({ children, apiKey }) => {
  const [client] = useState(() => new PromptOpsClient({ apiKey }));
  const [initialized, setInitialized] = useState(false);

  React.useEffect(() => {
    client.initialize().then(() => {
      setInitialized(true);
    });
  }, [client]);

  return (
    <PromptOpsContext.Provider value={{ client, initialized }}>
      {children}
    </PromptOpsContext.Provider>
  );
};

export const usePromptOps = () => {
  const context = useContext(PromptOpsContext);
  if (!context) {
    throw new Error('usePromptOps must be used within PromptOpsProvider');
  }
  return context;
};
```

## 🧪 Testing

### Unit Tests

```typescript
// client.test.ts
import { PromptOpsClient } from 'promptops-client';
import nock from 'nock';

describe('PromptOpsClient', () => {
  let client: PromptOpsClient;

  beforeEach(() => {
    client = new PromptOpsClient({
      baseUrl: 'https://api.promptops.com/v1',
      apiKey: 'test-key'
    });
  });

  afterEach(() => {
    nock.cleanAll();
  });

  test('should get prompt content', async () => {
    nock('https://api.promptops.com/v1')
      .get('/prompts/test-prompt')
      .reply(200, {
        content: 'Hello {{name}}!',
        variables: ['name']
      });

    await client.initialize();

    const content = await client.getPromptContent({
      promptId: 'test-prompt',
      variables: { name: 'Test' }
    });

    expect(content).toBe('Hello Test!');
  });

  test('should handle rate limit errors', async () => {
    nock('https://api.promptops.com/v1')
      .get('/prompts/test-prompt')
      .reply(429, {
        error: 'Rate limit exceeded',
        retryAfter: 60
      });

    await client.initialize();

    await expect(client.getPromptContent({
      promptId: 'test-prompt'
    })).rejects.toThrow('Rate limit exceeded');
  });
});
```

### Integration Tests

```typescript
// integration.test.ts
import { PromptOpsClient } from 'promptops-client';

describe('PromptOps Integration', () => {
  let client: PromptOpsClient;

  beforeAll(async () => {
    client = new PromptOpsClient({
      baseUrl: process.env.TEST_API_URL || 'https://api.promptops.com/v1',
      apiKey: process.env.TEST_API_KEY || 'test-key'
    });
    await client.initialize();
  });

  afterAll(async () => {
    await client.shutdown();
  });

  test('should list prompts', async () => {
    const prompts = await client.listPrompts();
    expect(Array.isArray(prompts)).toBe(true);
  });

  test('should validate prompt exists', async () => {
    const isValid = await client.validatePrompt('hello-world');
    expect(typeof isValid).toBe('boolean');
  });
});
```

## 📈 Performance Monitoring

```typescript
async function performanceExample() {
  try {
    // Get cache statistics
    const cacheStats = client.getCacheStats();
    console.log(`Cache hit rate: ${(cacheStats.hitRate * 100).toFixed(2)}%`);
    console.log(`Cache size: ${cacheStats.size}`);
    console.log(`Memory usage: ${cacheStats.memoryUsage}`);

    // Health check
    const health = await client.healthCheck();
    console.log('Health status:', health.status);
    console.log('Dependencies:', health.dependencies);

    // Clear specific cache
    await client.clearCache('specific-prompt');

    // Clear all cache
    await client.clearCache();

  } catch (error) {
    console.error('Performance monitoring error:', error);
  }
}
```

## 🚀 Next Steps

1. **Explore React Integration** - Build React applications with PromptOps
2. **Node.js Server Integration** - Add to Express or Fastify servers
3. **Performance Optimization** - Learn about caching and batching
4. **Production Deployment** - Configure for production environments
5. **Monitoring** - Set up telemetry and monitoring

## 📚 Additional Resources

- [API Reference](../api-reference/javascript-client.md) - Complete JavaScript client API
- [React Examples](../examples/react.md) - React integration examples
- [Node.js Examples](../examples/nodejs.md) - Server-side examples
- [Advanced Topics](../advanced-topics/) - Caching, performance, and security
- [Troubleshooting](../troubleshooting/) - Common issues and solutions

---

*Having trouble? Check our [troubleshooting guide](../troubleshooting/) or [ask for help](https://community.promptops.com)*