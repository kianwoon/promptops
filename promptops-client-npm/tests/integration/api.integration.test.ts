/**
 * Integration tests for PromptOps API integration
 */

import { PromptOpsClient, PromptOpsError, ConfigurationError } from '../src';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import nock from 'nock';
import Redis from 'ioredis';

describe('PromptOps API Integration', () => {
  let client: PromptOpsClient;
  let redisClient: Redis;
  const BASE_URL = 'http://localhost:8000';
  const API_KEY = 'test-integration-key';

  beforeEach(async () => {
    // Setup Redis client for testing
    redisClient = new Redis('redis://localhost:6379');
    await redisClient.flushdb();

    // Create client with test configuration
    client = new PromptOpsClient({
      baseUrl: BASE_URL,
      apiKey: API_KEY,
      timeout: 30000,
      enableCache: true,
      redisUrl: 'redis://localhost:6379',
      enableTelemetry: false,
    });

    await client.initialize();
  });

  afterEach(async () => {
    await client.shutdown();
    await redisClient.quit();
    nock.cleanAll();
  });

  describe('Prompt Lifecycle Management', () => {
    it('should handle complete prompt lifecycle', async () => {
      const promptData = {
        id: 'test-lifecycle-prompt',
        version: '1.0.0',
        module_id: 'test-module',
        name: 'Integration Test Prompt',
        description: 'A prompt for integration testing',
        content: 'Hello {{name}}! You are using {{framework}}.',
        target_models: ['openai', 'anthropic'],
        mas_intent: 'greeting',
        mas_fairness_notes: 'Fair greeting',
        mas_risk_level: 'low',
        created_by: 'test-user',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Mock API responses
      nock(BASE_URL)
        .get('/prompts/test-lifecycle-prompt/1.0.0')
        .query(true)
        .reply(200, promptData);

      nock(BASE_URL)
        .post('/render')
        .reply(200, {
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'Hello Developer! You are using TypeScript.' },
          ],
          rendered_content: 'Hello Developer! You are using TypeScript.',
          variables_used: { name: 'Developer', framework: 'TypeScript' },
        });

      // Test prompt retrieval
      const result = await client.getPrompt({
        promptId: 'test-lifecycle-prompt',
        version: '1.0.0',
      });

      expect(result).toEqual(promptData);

      // Test prompt rendering
      const rendered = await client.renderPrompt({
        promptId: 'test-lifecycle-prompt',
        variables: {
          name: 'Developer',
          framework: 'TypeScript',
        },
      });

      expect(rendered.rendered_content).toBe('Hello Developer! You are using TypeScript.');
    });

    it('should handle batch prompt operations', async () => {
      const prompts = Array.from({ length: 10 }, (_, i) => ({
        id: `batch-prompt-${i}`,
        name: `Batch Prompt ${i}`,
        content: `Batch content ${i}`,
      }));

      nock(BASE_URL)
        .get('/prompts')
        .query({ module_id: 'batch-module', limit: '10' })
        .reply(200, prompts);

      const result = await client.listPrompts('batch-module', 10);
      expect(result).toHaveLength(10);
      expect(result[0].id).toBe('batch-prompt-0');
    });

    it('should handle prompt versioning', async () => {
      const versions = ['1.0.0', '1.1.0', '2.0.0'];

      for (const version of versions) {
        nock(BASE_URL)
          .get(`/prompts/versioned-prompt/${version}`)
          .query(true)
          .reply(200, {
            id: 'versioned-prompt',
            version,
            content: `Content for version ${version}`,
          });

        const result = await client.getPrompt({
          promptId: 'versioned-prompt',
          version,
        });

        expect(result.version).toBe(version);
      }
    });
  });

  describe('Cache Integration', () => {
    it('should use Redis cache for prompt retrieval', async () => {
      const promptData = {
        id: 'cached-prompt',
        version: '1.0.0',
        content: 'Cached content',
      };

      // Set cache data directly
      await redisClient.setex(
        'prompt:cached-prompt:1.0.0',
        3600,
        JSON.stringify(promptData)
      );

      nock(BASE_URL)
        .get('/prompts/cached-prompt/1.0.0')
        .query(true)
        .reply(200, promptData);

      const result = await client.getPrompt({
        promptId: 'cached-prompt',
        version: '1.0.0',
      });

      expect(result.content).toBe('Cached content');
    });

    it('should handle cache misses', async () => {
      const promptData = {
        id: 'uncached-prompt',
        version: '1.0.0',
        content: 'Uncached content',
      };

      nock(BASE_URL)
        .get('/prompts/uncached-prompt/1.0.0')
        .query(true)
        .reply(200, promptData);

      const result = await client.getPrompt({
        promptId: 'uncached-prompt',
        version: '1.0.0',
      });

      expect(result.content).toBe('Uncached content');

      // Verify cache was populated
      const cached = await redisClient.get('prompt:uncached-prompt:1.0.0');
      expect(cached).toBeTruthy();
    });

    it('should handle cache invalidation', async () => {
      await client.clearCache('test-prompt');

      const exists = await redisClient.exists('prompt:test-prompt:latest');
      expect(exists).toBe(0);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle rate limiting with retry', async () => {
      nock(BASE_URL)
        .get('/prompts/rate-limited-prompt/latest')
        .query(true)
        .reply(429, { error: 'Rate limit exceeded' })
        .get('/prompts/rate-limited-prompt/latest')
        .query(true)
        .reply(200, {
          id: 'rate-limited-prompt',
          content: 'Success after retry',
        });

      const result = await client.getPrompt({
        promptId: 'rate-limited-prompt',
      });

      expect(result.content).toBe('Success after retry');
    });

    it('should handle network timeouts', async () => {
      nock(BASE_URL)
        .get('/prompts/timeout-prompt/latest')
        .query(true)
        .delayConnection(100) // 100ms delay
        .reply(200, {
          id: 'timeout-prompt',
          content: 'Delayed response',
        });

      // Update client timeout
      await client.updateConfig({ timeout: 50 }); // 50ms timeout

      await expect(
        client.getPrompt({ promptId: 'timeout-prompt' })
      ).rejects.toThrow('timeout');
    });

    it('should handle authentication failures', async () => {
      nock(BASE_URL)
        .get('/prompts/auth-failed-prompt/latest')
        .query(true)
        .reply(401, { error: 'Invalid API key' });

      await expect(
        client.getPrompt({ promptId: 'auth-failed-prompt' })
      ).rejects.toThrow(PromptOpsError);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent prompt requests', async () => {
      const numRequests = 20;
      const requests = Array.from({ length: numRequests }, (_, i) => ({
        promptId: `concurrent-prompt-${i}`,
        content: `Concurrent content ${i}`,
      }));

      // Setup mocks for all requests
      requests.forEach(req => {
        nock(BASE_URL)
          .get(`/prompts/${req.promptId}/latest`)
          .query(true)
          .reply(200, req);
      });

      // Make concurrent requests
      const promises = requests.map(req =>
        client.getPrompt({ promptId: req.promptId })
      );

      const results = await Promise.allSettled(promises);

      // All requests should succeed
      const successful = results.filter(r => r.status === 'fulfilled');
      expect(successful).toHaveLength(numRequests);
    });

    it('should handle connection pooling', async () => {
      const numRequests = 50;

      for (let i = 0; i < numRequests; i++) {
        nock(BASE_URL)
          .get('/prompts/pooled-prompt/latest')
          .query(true)
          .reply(200, {
            id: 'pooled-prompt',
            content: `Pooled response ${i}`,
          });
      }

      // Make many requests to test connection reuse
      const promises = Array.from({ length: numRequests }, () =>
        client.getPrompt({ promptId: 'pooled-prompt' })
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(numRequests);
    });
  });

  describe('Performance Characteristics', () => {
    it('should maintain response times under load', async () => {
      const numRequests = 100;
      const startTime = Date.now();

      for (let i = 0; i < numRequests; i++) {
        nock(BASE_URL)
          .get(`/prompts/load-test-prompt-${i}/latest`)
          .query(true)
          .reply(200, {
            id: `load-test-prompt-${i}`,
            content: `Load test content ${i}`,
          });

        await client.getPrompt({ promptId: `load-test-prompt-${i}` });
      }

      const totalTime = Date.now() - startTime;
      const avgTimePerRequest = totalTime / numRequests;

      // Average time should be reasonable (less than 100ms per request)
      expect(avgTimePerRequest).toBeLessThan(100);
    });

    it('should handle large prompt content', async () => {
      const largeContent = 'x'.repeat(100 * 1024); // 100KB

      nock(BASE_URL)
        .get('/prompts/large-prompt/latest')
        .query(true)
        .reply(200, {
          id: 'large-prompt',
          content: largeContent,
        });

      const result = await client.getPrompt({ promptId: 'large-prompt' });
      expect(result.content.length).toBe(100 * 1024);
    });
  });

  describe('Model Compatibility', () => {
    it('should check model compatibility', async () => {
      const models = [
        { provider: 'openai', name: 'gpt-4' },
        { provider: 'anthropic', name: 'claude-3-sonnet' },
        { provider: 'google', name: 'gemini-pro' },
      ];

      for (const model of models) {
        nock(BASE_URL)
          .get('/prompts/test-prompt/compatibility')
          .query({
            model_provider: model.provider,
            model_name: model.name,
          })
          .reply(200, {
            is_compatible: true,
            compatibility_score: 0.95,
            notes: 'Fully compatible',
          });

        const compatible = await client.getModelCompatibility(
          'test-prompt',
          model.provider,
          model.name
        );

        expect(compatible).toBe(true);
      }
    });

    it('should handle incompatible models', async () => {
      nock(BASE_URL)
        .get('/prompts/incompatible-prompt/compatibility')
        .query({
          model_provider: 'openai',
          model_name: 'gpt-3.5-turbo',
        })
        .reply(200, {
          is_compatible: false,
          compatibility_score: 0.3,
          notes: 'Limited compatibility',
        });

      const compatible = await client.getModelCompatibility(
        'incompatible-prompt',
        'openai',
        'gpt-3.5-turbo'
      );

      expect(compatible).toBe(false);
    });
  });

  describe('Telemetry Integration', () => {
    it('should collect telemetry data', async () => {
      await client.updateConfig({ enableTelemetry: true });

      nock(BASE_URL)
        .get('/prompts/telemetry-prompt/latest')
        .query(true)
        .reply(200, {
          id: 'telemetry-prompt',
          content: 'Telemetry test content',
        });

      await client.getPrompt({ promptId: 'telemetry-prompt' });

      // Verify telemetry was collected
      const summary = client.getTelemetrySummary();
      expect(summary.enabled).toBe(true);
      expect(summary.pendingEvents).toBeGreaterThan(0);
    });

    it('should handle telemetry flush', async () => {
      await client.updateConfig({ enableTelemetry: true });

      nock(BASE_URL)
        .post('/telemetry')
        .reply(200, { success: true });

      await client.flushTelemetry();

      const summary = client.getTelemetrySummary();
      expect(summary.pendingEvents).toBe(0);
    });
  });

  describe('Configuration Management', () => {
    it('should handle runtime configuration updates', async () => {
      await client.updateConfig({
        timeout: 60000,
        enableCache: false,
        retryConfig: {
          maxRetries: 5,
          baseDelay: 1000,
        },
      });

      // Verify configuration was updated
      const health = await client.healthCheck();
      expect(health.status).toBe('healthy');
    });

    it('should validate configuration changes', async () => {
      await expect(
        client.updateConfig({ baseUrl: '' })
      ).rejects.toThrow(ConfigurationError);

      await expect(
        client.updateConfig({ timeout: -1 })
      ).rejects.toThrow(ConfigurationError);
    });
  });

  describe('Security Features', () => {
    it('should handle input sanitization', async () => {
      const maliciousInputs = [
        { script: '<script>alert("xss")</script>' },
        { sql: 'SELECT * FROM users' },
        { command: 'rm -rf /' },
      ];

      for (const input of maliciousInputs) {
        nock(BASE_URL)
          .get('/prompts/security-prompt/latest')
          .query(true)
          .reply(200, {
            id: 'security-prompt',
            content: 'Sanitized content',
          });

        const result = await client.getPromptContent({
          promptId: 'security-prompt',
          variables: input,
        });

        expect(result).toBeTruthy();
      }
    });

    it('should handle secure data transmission', async () => {
      nock(BASE_URL)
        .get('/prompts/secure-prompt/latest')
        .query(true)
        .reply(200, {
          id: 'secure-prompt',
          content: 'Secure content',
        });

      const result = await client.getPrompt({
        promptId: 'secure-prompt',
      });

      expect(result).toBeTruthy();
    });
  });

  describe('Reliability Features', () => {
    it('should handle graceful degradation', async () => {
      // Disable cache
      await client.updateConfig({ enableCache: false });

      nock(BASE_URL)
        .get('/prompts/degraded-prompt/latest')
        .query(true)
        .reply(200, {
          id: 'degraded-prompt',
          content: 'Degraded mode content',
        });

      const result = await client.getPrompt({
        promptId: 'degraded-prompt',
      });

      expect(result.content).toBe('Degraded mode content');
    });

    it('should handle circuit breaker pattern', async () => {
      // Simulate repeated failures
      nock(BASE_URL)
        .persist()
        .get('/prompts/circuit-test-prompt/latest')
        .query(true)
        .reply(500, { error: 'Service unavailable' });

      // Should fail fast after multiple failures
      for (let i = 0; i < 5; i++) {
        await expect(
          client.getPrompt({ promptId: 'circuit-test-prompt' })
        ).rejects.toThrow(PromptOpsError);
      }
    });
  });
});