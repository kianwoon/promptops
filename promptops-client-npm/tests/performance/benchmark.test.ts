/**
 * Performance benchmarks for PromptOps JavaScript client
 */

import { PromptOpsClient } from '../src';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import nock from 'nock';
import { performance } from 'perf_hooks';

describe('Performance Benchmarks', () => {
  let client: PromptOpsClient;
  const BASE_URL = 'http://localhost:8000';
  const API_KEY = 'benchmark-key';

  beforeEach(async () => {
    client = new PromptOpsClient({
      baseUrl: BASE_URL,
      apiKey: API_KEY,
      timeout: 30000,
      enableCache: true,
      enableTelemetry: false,
    });

    await client.initialize();
  });

  afterEach(async () => {
    await client.shutdown();
    nock.cleanAll();
  });

  describe('Prompt Retrieval Performance', () => {
    it('should handle single prompt retrieval efficiently', async () => {
      const iterations = 100;
      const responseTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        nock(BASE_URL)
          .get(`/prompts/single-prompt-${i}/latest`)
          .query(true)
          .reply(200, {
            id: `single-prompt-${i}`,
            content: `Single prompt content ${i}`,
          });

        const startTime = performance.now();
        await client.getPrompt({ promptId: `single-prompt-${i}` });
        const endTime = performance.now();

        responseTimes.push(endTime - startTime);
      }

      const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxTime = Math.max(...responseTimes);

      console.log(`Single prompt retrieval - Avg: ${avgTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);

      // Average should be under 50ms
      expect(avgTime).toBeLessThan(50);
      // Max should be under 200ms
      expect(maxTime).toBeLessThan(200);
    });

    it('should handle batch prompt retrieval efficiently', async () => {
      const batchSizes = [5, 10, 20, 50];
      const results: { batchSize: number; avgTime: number; throughput: number }[] = [];

      for (const batchSize of batchSizes) {
        nock(BASE_URL)
          .get('/prompts')
          .query({ module_id: 'batch-module', limit: batchSize.toString() })
          .reply(200, Array.from({ length: batchSize }, (_, i) => ({
            id: `batch-prompt-${i}`,
            content: `Batch content ${i}`,
          })));

        const startTime = performance.now();
        await client.listPrompts('batch-module', batchSize);
        const endTime = performance.now();

        const totalTime = endTime - startTime;
        const avgTime = totalTime / batchSize;
        const throughput = batchSize / (totalTime / 1000); // requests per second

        results.push({ batchSize, avgTime, throughput });
      }

      console.table(results);

      // Throughput should improve with larger batches (after initial overhead)
      expect(results[results.length - 1].throughput).toBeGreaterThan(results[0].throughput * 0.5);
    });

    it('should leverage caching for improved performance', async () => {
      const promptData = {
        id: 'cached-performance-prompt',
        content: 'Cached performance content',
      };

      // First call (cache miss)
      nock(BASE_URL)
        .get('/prompts/cached-performance-prompt/latest')
        .query(true)
        .reply(200, promptData);

      const firstStartTime = performance.now();
      await client.getPrompt({ promptId: 'cached-performance-prompt' });
      const firstEndTime = performance.now();

      // Subsequent calls (cache hits)
      const cacheTimes: number[] = [];
      for (let i = 0; i < 50; i++) {
        const startTime = performance.now();
        await client.getPrompt({ promptId: 'cached-performance-prompt' });
        const endTime = performance.now();

        cacheTimes.push(endTime - startTime);
      }

      const cacheAvgTime = cacheTimes.reduce((a, b) => a + b, 0) / cacheTimes.length;
      const cacheTime = firstEndTime - firstStartTime;

      console.log(`Cache miss: ${cacheTime.toFixed(2)}ms`);
      console.log(`Cache hit avg: ${cacheAvgTime.toFixed(2)}ms`);
      console.log(`Cache speedup: ${(cacheTime / cacheAvgTime).toFixed(2)}x`);

      // Cache should be significantly faster
      expect(cacheAvgTime).toBeLessThan(cacheTime * 0.1); // At least 10x faster
    });
  });

  describe('Prompt Rendering Performance', () => {
    it('should handle simple prompt rendering efficiently', async () => {
      const iterations = 100;
      const renderTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        nock(BASE_URL)
          .post('/render')
          .reply(200, {
            rendered_content: `Hello User ${i}! Welcome to the application.`,
            variables_used: { userId: i.toString() },
          });

        const startTime = performance.now();
        await client.renderPrompt({
          promptId: 'simple-render-prompt',
          variables: { userId: i.toString() },
        });
        const endTime = performance.now();

        renderTimes.push(endTime - startTime);
      }

      const avgTime = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;

      console.log(`Simple rendering - Avg: ${avgTime.toFixed(2)}ms`);

      // Average rendering time should be under 100ms
      expect(avgTime).toBeLessThan(100);
    });

    it('should handle complex prompt rendering efficiently', async () => {
      const complexVariables = {
        name: 'Benchmark User',
        framework: 'TypeScript',
        version: '5.0.0',
        os: 'Linux',
        architecture: 'x86_64',
        memory: '16GB',
        cores: 8,
        timezone: 'UTC',
        locale: 'en_US',
        theme: 'dark',
        language: 'en',
        region: 'us',
        currency: 'usd',
        timezone_offset: '-0800',
        date_format: 'YYYY-MM-DD',
        time_format: 'HH:mm:ss',
      };

      nock(BASE_URL)
        .post('/render')
        .times(50)
        .reply(200, {
          rendered_content: 'Complex rendered content with many variables',
          variables_used: complexVariables,
        });

      const renderTimes: number[] = [];
      for (let i = 0; i < 50; i++) {
        const startTime = performance.now();
        await client.renderPrompt({
          promptId: 'complex-render-prompt',
          variables: complexVariables,
        });
        const endTime = performance.now();

        renderTimes.push(endTime - startTime);
      }

      const avgTime = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;

      console.log(`Complex rendering - Avg: ${avgTime.toFixed(2)}ms`);

      // Complex rendering should still be efficient
      expect(avgTime).toBeLessThan(150);
    });

    it('should handle variable substitution efficiently', async () => {
      const template = 'Hello {{name}}! You have {{count}} messages. Your balance is ${{balance}}.';
      const variables = {
        name: 'Benchmark User',
        count: 42,
        balance: 1234.56,
      };

      nock(BASE_URL)
        .get('/prompts/variable-prompt/latest')
        .query(true)
        .reply(200, {
          id: 'variable-prompt',
          content: template,
        });

      nock(BASE_URL)
        .post('/render')
        .times(100)
        .reply(200, {
          rendered_content: 'Hello Benchmark User! You have 42 messages. Your balance is $1234.56.',
          variables_used: variables,
        });

      const substitutionTimes: number[] = [];
      for (let i = 0; i < 100; i++) {
        const startTime = performance.now();
        await client.getPromptContent({
          promptId: 'variable-prompt',
          variables,
        });
        const endTime = performance.now();

        substitutionTimes.push(endTime - startTime);
      }

      const avgTime = substitutionTimes.reduce((a, b) => a + b, 0) / substitutionTimes.length;

      console.log(`Variable substitution - Avg: ${avgTime.toFixed(2)}ms`);

      // Variable substitution should be very fast
      expect(avgTime).toBeLessThan(50);
    });
  });

  describe('Concurrency Performance', () => {
    it('should handle concurrent prompt retrieval efficiently', async () => {
      const concurrentRequests = [10, 25, 50, 100];
      const results: { concurrent: number; totalTime: number; throughput: number }[] = [];

      for (const concurrent of concurrentRequests) {
        // Setup mocks for all concurrent requests
        for (let i = 0; i < concurrent; i++) {
          nock(BASE_URL)
            .get(`/prompts/concurrent-prompt-${i}/latest`)
            .query(true)
            .reply(200, {
              id: `concurrent-prompt-${i}`,
              content: `Concurrent content ${i}`,
            });
        }

        const startTime = performance.now();
        const promises = Array.from({ length: concurrent }, (_, i) =>
          client.getPrompt({ promptId: `concurrent-prompt-${i}` })
        );
        await Promise.all(promises);
        const endTime = performance.now();

        const totalTime = endTime - startTime;
        const throughput = concurrent / (totalTime / 1000);

        results.push({ concurrent, totalTime, throughput });
      }

      console.table(results);

      // Throughput should scale reasonably with concurrency
      expect(results[results.length - 1].throughput).toBeGreaterThan(results[0].throughput * 0.3);
    });

    it('should handle concurrent prompt rendering efficiently', async () => {
      const concurrent = 50;
      const variablesList = Array.from({ length: concurrent }, (_, i) => ({
        userId: `user_${i}`,
        sessionId: `session_${i}`,
        timestamp: Date.now() + i,
      }));

      // Setup mocks for all requests
      for (let i = 0; i < concurrent; i++) {
        nock(BASE_URL)
          .post('/render')
          .reply(200, {
            rendered_content: `Concurrent render for user_${i}`,
            variables_used: variablesList[i],
          });
      }

      const startTime = performance.now();
      const promises = variablesList.map((variables, i) =>
        client.renderPrompt({
          promptId: 'concurrent-render-prompt',
          variables,
        })
      );
      await Promise.all(promises);
      const endTime = performance.now();

      const totalTime = endTime - startTime;
      const throughput = concurrent / (totalTime / 1000);

      console.log(`Concurrent rendering - ${concurrent} requests in ${totalTime.toFixed(2)}ms`);
      console.log(`Throughput: ${throughput.toFixed(2)} requests/second`);

      // Should handle concurrent requests efficiently
      expect(totalTime).toBeLessThan(5000); // Under 5 seconds for 50 requests
    });
  });

  describe('Memory Usage Performance', () => {
    it('should manage memory efficiently during sustained operations', async () => {
      const iterations = 1000;
      const memorySnapshots: number[] = [];

      const getMemoryUsage = () => {
        const used = process.memoryUsage();
        return used.heapUsed / 1024 / 1024; // MB
      };

      const initialMemory = getMemoryUsage();

      for (let i = 0; i < iterations; i++) {
        nock(BASE_URL)
          .get(`/prompts/memory-prompt-${i}/latest`)
          .query(true)
          .reply(200, {
            id: `memory-prompt-${i}`,
            content: `Memory test content ${i}`.repeat(100), // Larger content
          });

        await client.getPrompt({ promptId: `memory-prompt-${i}` });

        // Capture memory usage every 100 iterations
        if (i % 100 === 0) {
          memorySnapshots.push(getMemoryUsage());
        }
      }

      const finalMemory = getMemoryUsage();
      const memoryIncrease = finalMemory - initialMemory;
      const maxMemory = Math.max(...memorySnapshots);

      console.log(`Initial memory: ${initialMemory.toFixed(2)}MB`);
      console.log(`Final memory: ${finalMemory.toFixed(2)}MB`);
      console.log(`Memory increase: ${memoryIncrease.toFixed(2)}MB`);
      console.log(`Max memory: ${maxMemory.toFixed(2)}MB`);

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50);
    });

    it('should clean up resources properly', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Create many clients and perform operations
      const clients: PromptOpsClient[] = [];
      for (let i = 0; i < 10; i++) {
        const testClient = new PromptOpsClient({
          baseUrl: BASE_URL,
          apiKey: `memory-test-key-${i}`,
          timeout: 30000,
        });

        nock(BASE_URL)
          .get('/prompts/resource-test-prompt/latest')
          .query(true)
          .reply(200, {
            id: 'resource-test-prompt',
            content: 'Resource test content',
          });

        await testClient.initialize();
        await testClient.getPrompt({ promptId: 'resource-test-prompt' });
        clients.push(testClient);
      }

      // Shutdown all clients
      await Promise.all(clients.map(client => client.shutdown()));

      // Force garbage collection
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      console.log(`Memory increase after cleanup: ${memoryIncrease / 1024 / 1024}MB`);

      // Memory should be mostly cleaned up
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB increase
    });
  });

  describe('Network Performance', () => {
    it('should handle network latency gracefully', async () => {
      const latencyLevels = [0, 50, 100, 200, 500]; // ms
      const results: { latency: number; avgTime: number; overhead: number }[] = [];

      for (const latency of latencyLevels) {
        nock(BASE_URL)
          .get('/prompts/latency-prompt/latest')
          .query(true)
          .delayConnection(latency)
          .reply(200, {
            id: 'latency-prompt',
            content: 'Latency test content',
          });

        const requestTimes: number[] = [];
        for (let i = 0; i < 10; i++) {
          const startTime = performance.now();
          await client.getPrompt({ promptId: 'latency-prompt' });
          const endTime = performance.now();

          requestTimes.push(endTime - startTime);
        }

        const avgTime = requestTimes.reduce((a, b) => a + b, 0) / requestTimes.length;
        const overhead = avgTime - latency;

        results.push({ latency, avgTime, overhead });
      }

      console.table(results);

      // Overhead should remain relatively constant regardless of latency
      const overheads = results.map(r => r.overhead);
      const overheadVariation = Math.max(...overheads) - Math.min(...overheads);

      expect(overheadVariation).toBeLessThan(50); // Overhead variation under 50ms
    });

    it('should handle retry efficiently', async () => {
      const retryConfigurations = [
        { maxRetries: 1, baseDelay: 100 },
        { maxRetries: 3, baseDelay: 100 },
        { maxRetries: 5, baseDelay: 100 },
      ];

      for (const config of retryConfigurations) {
        await client.updateConfig({ retryConfig: config });

        nock(BASE_URL)
          .get('/prompts/retry-prompt/latest')
          .query(true)
          .times(config.maxRetries)
          .reply(500, { error: 'Server error' })
          .get('/prompts/retry-prompt/latest')
          .query(true)
          .reply(200, {
            id: 'retry-prompt',
            content: 'Retry success content',
          });

        const startTime = performance.now();
        const result = await client.getPrompt({ promptId: 'retry-prompt' });
        const endTime = performance.now();

        const totalTime = endTime - startTime;
        const expectedMinTime = config.maxRetries * config.baseDelay;

        console.log(`Retry config ${config.maxRetries} retries: ${totalTime.toFixed(2)}ms`);

        expect(result.content).toBe('Retry success content');
        expect(totalTime).toBeGreaterThan(expectedMinTime * 0.8); // Allow some variance
      }
    });
  });

  describe('Scalability Performance', () => {
    it('should scale vertically with increasing load', async () => {
      const loadLevels = [10, 50, 100, 200, 500];
      const results: { load: number; totalTime: number; throughput: number; avgLatency: number }[] = [];

      for (const load of loadLevels) {
        // Setup mocks for current load level
        for (let i = 0; i < load; i++) {
          nock(BASE_URL)
            .get(`/prompts/scale-prompt-${i}/latest`)
            .query(true)
            .reply(200, {
              id: `scale-prompt-${i}`,
              content: `Scale content ${i}`,
            });
        }

        const startTime = performance.now();
        const promises = Array.from({ length: load }, (_, i) =>
          client.getPrompt({ promptId: `scale-prompt-${i}` })
        );
        await Promise.all(promises);
        const endTime = performance.now();

        const totalTime = endTime - startTime;
        const throughput = load / (totalTime / 1000);
        const avgLatency = totalTime / load;

        results.push({ load, totalTime, throughput, avgLatency });
      }

      console.table(results);

      // Throughput should generally increase with load (after initial overhead)
      const maxThroughput = Math.max(...results.map(r => r.throughput));
      const minThroughput = Math.min(...results.map(r => r.throughput));
      const throughputRatio = maxThroughput / minThroughput;

      expect(throughputRatio).toBeGreaterThan(0.5); // Should maintain reasonable scaling
    });

    it('should scale horizontally with multiple clients', async () => {
      const clientCounts = [1, 5, 10, 20];
      const requestsPerClient = 10;
      const results: { clients: number; totalTime: number; throughput: number }[] = [];

      for (const clientCount of clientCounts) {
        // Create clients
        const clients: PromptOpsClient[] = [];
        for (let i = 0; i < clientCount; i++) {
          const testClient = new PromptOpsClient({
            baseUrl: BASE_URL,
            apiKey: `scale-key-${i}`,
            timeout: 30000,
          });

          // Setup mocks for this client
          for (let j = 0; j < requestsPerClient; j++) {
            nock(BASE_URL)
              .get(`/prompts/horizontal-prompt-${i}-${j}/latest`)
              .query(true)
              .reply(200, {
                id: `horizontal-prompt-${i}-${j}`,
                content: `Horizontal content ${i}-${j}`,
              });
          }

          await testClient.initialize();
          clients.push(testClient);
        }

        const startTime = performance.now();
        const promises = clients.flatMap((client, i) =>
          Array.from({ length: requestsPerClient }, (_, j) =>
            client.getPrompt({ promptId: `horizontal-prompt-${i}-${j}` })
          )
        );
        await Promise.all(promises);
        const endTime = performance.now();

        const totalTime = endTime - startTime;
        const totalRequests = clientCount * requestsPerClient;
        const throughput = totalRequests / (totalTime / 1000);

        results.push({ clients: clientCount, totalTime, throughput });

        // Cleanup
        await Promise.all(clients.map(client => client.shutdown()));
      }

      console.table(results);

      // Should scale reasonably well horizontally
      const maxThroughput = Math.max(...results.map(r => r.throughput));
      const minThroughput = Math.min(...results.map(r => r.throughput));
      const scalingEfficiency = maxThroughput / (minThroughput * clientCounts[clientCounts.length - 1]);

      expect(scalingEfficiency).toBeGreaterThan(0.2); // At least 20% scaling efficiency
    });
  });
});