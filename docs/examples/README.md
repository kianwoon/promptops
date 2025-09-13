# Integration Examples

This section provides comprehensive examples for integrating PromptOps into various applications and frameworks.

## 📚 Example Categories

### Web Frameworks
- [React Integration](react.md) - React components, hooks, and context providers
- [Node.js Integration](nodejs.md) - Express, Fastify, and server-side examples
- [Python Web Apps](python-web.md) - FastAPI, Flask, and Django integration

### Application Types
- [Frontend Applications](frontend.md) - Browser-based applications
- [Backend Services](backend.md) - Microservices and API integrations
- [CLI Tools](cli.md) - Command-line interface tools
- [Mobile Apps](mobile.md) - React Native and mobile integration

### Advanced Patterns
- [Batch Processing](batch-processing.md) - Large-scale prompt operations
- [Real-time Applications](realtime.md) - WebSocket and streaming examples
- [Multi-tenant Applications](multitenant.md) - SaaS and multi-tenant patterns
- [Enterprise Integration](enterprise.md) - Corporate environment integration

## 🎯 Common Integration Patterns

### 1. Initialization Pattern

```python
# Python - Module-level client initialization
from promptops import PromptOpsClient
import os

# Initialize once at application startup
promptops_client = PromptOpsClient(
    api_key=os.environ.get("PROMPTOPS_API_KEY"),
    base_url="https://api.promptops.com/v1"
)

# Use throughout your application
async def get_welcome_message(name: str) -> str:
    variables = PromptVariables({"name": name})
    rendered = await promptops_client.render_prompt(
        prompt_id="welcome-message",
        variables=variables
    )
    return rendered.rendered_content
```

```typescript
// TypeScript - Singleton pattern
export class PromptOpsService {
  private static instance: PromptOpsService;
  private client: PromptOpsClient;

  private constructor(apiKey: string) {
    this.client = new PromptOpsClient({
      baseUrl: 'https://api.promptops.com/v1',
      apiKey,
      enableCache: true,
      cacheTTL: 300000 // 5 minutes
    });
  }

  static getInstance(apiKey?: string): PromptOpsService {
    if (!PromptOpsService.instance) {
      PromptOpsService.instance = new PromptOpsService(
        apiKey || process.env.PROMPTOPS_API_KEY!
      );
    }
    return PromptOpsService.instance;
  }

  async getPrompt(request: PromptRequest): Promise<string> {
    return await this.client.getPromptContent(request);
  }
}

// Use throughout your application
const promptService = PromptOpsService.getInstance();
const content = await promptService.getPrompt({
  promptId: 'welcome-message',
  variables: { name: 'User' }
});
```

### 2. Error Handling Pattern

```python
# Python - Comprehensive error handling
from promptops.exceptions import (
    PromptOpsError,
    AuthenticationError,
    PromptNotFoundError,
    RateLimitError
)
import logging

logger = logging.getLogger(__name__)

async def safe_get_prompt(prompt_id: str, variables: dict) -> Optional[str]:
    try:
        rendered = await promptops_client.render_prompt(
            prompt_id=prompt_id,
            variables=PromptVariables(variables)
        )
        return rendered.rendered_content
    except AuthenticationError:
        logger.error("Authentication failed - check API key")
        # Implement fallback or re-authentication
        return get_fallback_prompt()
    except PromptNotFoundError:
        logger.warning(f"Prompt not found: {prompt_id}")
        # Use alternative prompt or default message
        return await get_alternative_prompt(prompt_id, variables)
    except RateLimitError as e:
        logger.warning(f"Rate limit exceeded: retry after {e.retry_after}s")
        # Implement retry with exponential backoff
        await asyncio.sleep(e.retry_after)
        return await safe_get_prompt(prompt_id, variables)
    except Exception as e:
        logger.error(f"Unexpected error getting prompt {prompt_id}: {e}")
        return "I'm sorry, I'm having trouble responding right now."
```

```typescript
// TypeScript - Error handling with retry logic
import {
  PromptOpsError,
  AuthenticationError,
  RateLimitError
} from 'promptops-client';

class PromptManager {
  constructor(private client: PromptOpsClient) {}

  async getPromptWithRetry(
    request: PromptRequest,
    maxRetries: number = 3
  ): Promise<string> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.client.getPromptContent(request);
      } catch (error) {
        lastError = error as Error;

        if (error instanceof AuthenticationError) {
          console.error('Authentication failed:', error.message);
          throw error; // Don't retry auth errors
        }

        if (error instanceof RateLimitError) {
          const delay = Math.min(
            error.retryAfter * 1000,
            Math.pow(2, attempt) * 1000
          );
          console.log(`Rate limited, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        if (attempt === maxRetries) {
          break;
        }

        // Exponential backoff for other errors
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }
}
```

### 3. Caching Strategy Pattern

```python
# Python - Multi-level caching
from promptops import CacheConfig, CacheLevel

class CachedPromptService:
    def __init__(self, api_key: str):
        self.client = PromptOpsClient(
            api_key=api_key,
            cache=CacheConfig(
                level=CacheLevel.HYBRID,
                ttl=600,  # 10 minutes
                max_size=2000,
                redis_url=os.environ.get("REDIS_URL")
            )
        )

    async def get_frequently_used_prompt(self, prompt_id: str) -> str:
        # High cache TTL for frequently used prompts
        try:
            rendered = await self.client.render_prompt(
                prompt_id=prompt_id,
                variables=PromptVariables({}),
                use_cache=True
            )
            return rendered.rendered_content
        except Exception as e:
            logger.error(f"Error getting frequent prompt {prompt_id}: {e}")
            return get_cached_fallback(prompt_id)

    async def get_dynamic_prompt(self, prompt_id: str, variables: dict) -> str:
        # Low cache TTL for dynamic prompts
        try:
            rendered = await self.client.render_prompt(
                prompt_id=prompt_id,
                variables=PromptVariables(variables),
                use_cache=True
            )
            return rendered.rendered_content
        except Exception as e:
            logger.error(f"Error getting dynamic prompt {prompt_id}: {e}")
            return await self.generate_dynamic_response(variables)
```

```typescript
// TypeScript - Intelligent caching
interface CacheStrategy {
  ttl: number;
  maxSize: number;
  useRedis: boolean;
}

class IntelligentCacheManager {
  private strategies = new Map<string, CacheStrategy>();

  constructor(private client: PromptOpsClient) {
    // Define different strategies for different prompt types
    this.strategies.set('static', { ttl: 3600000, maxSize: 1000, useRedis: true });      // 1 hour
    this.strategies.set('dynamic', { ttl: 300000, maxSize: 500, useRedis: false });      // 5 minutes
    this.strategies.set('realtime', { ttl: 0, maxSize: 100, useRedis: false });          // No caching
  }

  async getPrompt(
    promptId: string,
    variables: Record<string, any>,
    type: 'static' | 'dynamic' | 'realtime' = 'dynamic'
  ): Promise<string> {
    const strategy = this.strategies.get(type)!;

    // Temporarily adjust client cache settings
    const originalConfig = this.client.getConfig();
    this.client.updateConfig({
      enableCache: strategy.ttl > 0,
      cacheTTL: strategy.ttl
    });

    try {
      return await this.client.getPromptContent({
        promptId,
        variables
      });
    } finally {
      // Restore original config
      this.client.updateConfig(originalConfig);
    }
  }
}
```

### 4. Monitoring and Telemetry Pattern

```python
# Python - Monitoring integration
import time
from dataclasses import dataclass
from typing import Optional

@dataclass
class PromptMetrics:
    prompt_id: str
    request_count: int
    average_response_time: float
    error_rate: float
    cache_hit_rate: float

class MonitoredPromptService:
    def __init__(self, client: PromptOpsClient):
        self.client = client
        self.metrics = {}

    async def get_prompt_with_metrics(
        self,
        prompt_id: str,
        variables: dict
    ) -> tuple[str, PromptMetrics]:
        start_time = time.time()
        success = True

        try:
            rendered = await self.client.render_prompt(
                prompt_id=prompt_id,
                variables=PromptVariables(variables)
            )
            response_time = (time.time() - start_time) * 1000

            # Update metrics
            self._update_metrics(prompt_id, response_time, success)

            return rendered.rendered_content, self.metrics[prompt_id]

        except Exception as e:
            success = False
            response_time = (time.time() - start_time) * 1000
            self._update_metrics(prompt_id, response_time, success)
            raise

    def _update_metrics(self, prompt_id: str, response_time: float, success: bool):
        if prompt_id not in self.metrics:
            self.metrics[prompt_id] = PromptMetrics(
                prompt_id=prompt_id,
                request_count=0,
                average_response_time=0,
                error_rate=0,
                cache_hit_rate=0
            )

        metrics = self.metrics[prompt_id]
        metrics.request_count += 1

        # Update average response time
        metrics.average_response_time = (
            (metrics.average_response_time * (metrics.request_count - 1) + response_time) /
            metrics.request_count
        )

        # Update error rate
        if not success:
            metrics.error_rate = (
                (metrics.error_rate * (metrics.request_count - 1) + 1) /
                metrics.request_count
            )

        # Get cache stats
        cache_stats = self.client.get_cache_stats()
        metrics.cache_hit_rate = cache_stats.hit_rate
```

```typescript
// TypeScript - Performance monitoring
interface PromptPerformanceMetrics {
  promptId: string;
  totalRequests: number;
  averageResponseTime: number;
  errorRate: number;
  cacheHitRate: number;
  lastUsed: Date;
}

class PerformanceMonitor {
  private metrics = new Map<string, PromptPerformanceMetrics>();
  private readonly client: PromptOpsClient;

  constructor(client: PromptOpsClient) {
    this.client = client;
  }

  async getPromptWithMetrics(
    request: PromptRequest
  ): Promise<{ content: string; metrics: PromptPerformanceMetrics }> {
    const startTime = Date.now();
    let success = true;

    try {
      const content = await this.client.getPromptContent(request);
      const responseTime = Date.now() - startTime;

      const metrics = this.updateMetrics(
        request.promptId,
        responseTime,
        true
      );

      return { content, metrics };
    } catch (error) {
      success = false;
      const responseTime = Date.now() - startTime;

      this.updateMetrics(
        request.promptId,
        responseTime,
        false
      );

      throw error;
    }
  }

  private updateMetrics(
    promptId: string,
    responseTime: number,
    success: boolean
  ): PromptPerformanceMetrics {
    let metrics = this.metrics.get(promptId);

    if (!metrics) {
      metrics = {
        promptId,
        totalRequests: 0,
        averageResponseTime: 0,
        errorRate: 0,
        cacheHitRate: 0,
        lastUsed: new Date()
      };
      this.metrics.set(promptId, metrics);
    }

    metrics.totalRequests++;
    metrics.lastUsed = new Date();

    // Update average response time
    metrics.averageResponseTime = (
      (metrics.averageResponseTime * (metrics.totalRequests - 1) + responseTime) /
      metrics.totalRequests
    );

    // Update error rate
    if (!success) {
      metrics.errorRate = (
        (metrics.errorRate * (metrics.totalRequests - 1) + 1) /
        metrics.totalRequests
      );
    }

    // Update cache hit rate
    const cacheStats = this.client.getCacheStats();
    metrics.cacheHitRate = cacheStats.hitRate;

    return metrics;
  }
}
```

## 🚀 Getting Started

1. **Choose Your Framework** - Select the examples relevant to your stack
2. **Copy Examples** - Use the provided code as a starting point
3. **Customize** - Adapt the examples to your specific use case
4. **Test** - Validate the integration works correctly
5. **Deploy** - Integrate into your production environment

## 📚 Additional Resources

- [Getting Started](../getting-started/) - Quick start guides
- [API Reference](../api-reference/) - Complete API documentation
- [Advanced Topics](../advanced-topics/) - Performance and optimization
- [Troubleshooting](../troubleshooting/) - Common issues and solutions

---

*Need help with a specific integration? Check our [community forum](https://community.promptops.com) or [create an issue](https://github.com/promptops/promptops/issues)*