/**
 * Tests for PromptOpsClient
 */

import { PromptOpsClient, PromptOpsError, ConfigurationError } from '../src';
import { TEST_CONFIG, createMockAxiosInstance, createMockPromptResponse } from './setup';

describe('PromptOpsClient', () => {
  let client: PromptOpsClient;
  let mockAxios: any;

  beforeEach(() => {
    mockAxios = createMockAxiosInstance();
    client = new PromptOpsClient(TEST_CONFIG);
  });

  describe('Constructor', () => {
    it('should create client with valid configuration', () => {
      expect(client).toBeInstanceOf(PromptOpsClient);
    });

    it('should throw error without baseUrl', () => {
      expect(() => {
        new PromptOpsClient({ baseUrl: '', apiKey: 'test' });
      }).toThrow(ConfigurationError);
    });

    it('should use default values when not provided', () => {
      const client = new PromptOpsClient({
        baseUrl: 'https://api.test.com/v1',
        apiKey: 'test',
      });

      expect(client).toBeInstanceOf(PromptOpsClient);
    });
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      // Mock auth validation
      mockAxios.get.mockResolvedValue({ status: 200 });

      await client.initialize();

      expect(client.isClientInitialized()).toBe(true);
    });

    it('should throw error when API key is invalid', async () => {
      mockAxios.get.mockResolvedValue({ status: 401 });

      await expect(client.initialize()).rejects.toThrow(ConfigurationError);
    });

    it('should handle network errors', async () => {
      mockAxios.get.mockRejectedValue(new Error('Network error'));

      await expect(client.initialize()).rejects.toThrow();
    });
  });

  describe('getPrompt', () => {
    beforeEach(async () => {
      mockAxios.get.mockResolvedValue({ status: 200 });
      await client.initialize();
    });

    it('should get prompt successfully', async () => {
      const mockResponse = createMockPromptResponse();
      mockAxios.get.mockResolvedValue({ status: 200, data: mockResponse });

      const result = await client.getPrompt({
        promptId: 'test-prompt',
        version: '1.0.0',
        variables: { name: 'Test' },
      });

      expect(result).toEqual(mockResponse);
      expect(mockAxios.get).toHaveBeenCalledWith(
        '/prompts/test-prompt/1.0.0',
        expect.objectContaining({
          params: expect.objectContaining({
            model_provider: undefined,
            model_name: undefined,
            tenant_id: undefined,
          }),
        })
      );
    });

    it('should handle API errors', async () => {
      mockAxios.get.mockResolvedValue({
        status: 404,
        data: { message: 'Prompt not found' },
      });

      await expect(
        client.getPrompt({ promptId: 'nonexistent' })
      ).rejects.toThrow(PromptOpsError);
    });

    it('should retry on network errors', async () => {
      mockAxios.get
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue({
          status: 200,
          data: createMockPromptResponse(),
        });

      const result = await client.getPrompt({ promptId: 'test-prompt' });

      expect(result).toBeDefined();
      expect(mockAxios.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('getPromptContent', () => {
    beforeEach(async () => {
      mockAxios.get.mockResolvedValue({ status: 200 });
      await client.initialize();
    });

    it('should return content with variable substitution', async () => {
      const mockResponse = createMockPromptResponse({
        content: 'Hello {{name}}! Welcome to {{framework}}.',
      });
      mockAxios.get.mockResolvedValue({ status: 200, data: mockResponse });

      const result = await client.getPromptContent({
        promptId: 'test-prompt',
        variables: {
          name: 'Developer',
          framework: 'TypeScript',
        },
      });

      expect(result).toBe('Hello Developer! Welcome to TypeScript.');
    });

    it('should handle missing variables in strict mode', async () => {
      const mockResponse = createMockPromptResponse({
        content: 'Hello {{name}}!',
      });
      mockAxios.get.mockResolvedValue({ status: 200, data: mockResponse });

      await expect(
        client.getPromptContent({
          promptId: 'test-prompt',
          variables: {}, // Missing 'name'
        })
      ).rejects.toThrow('Variable \'name\' not found');
    });
  });

  describe('listPrompts', () => {
    beforeEach(async () => {
      mockAxios.get.mockResolvedValue({ status: 200 });
      await client.initialize();
    });

    it('should list prompts successfully', async () => {
      const mockPrompts = [
        createMockPromptResponse({ id: 'prompt1', name: 'Prompt 1' }),
        createMockPromptResponse({ id: 'prompt2', name: 'Prompt 2' }),
      ];
      mockAxios.get.mockResolvedValue({ status: 200, data: mockPrompts });

      const result = await client.listPrompts('test-module', 10);

      expect(result).toEqual(mockPrompts);
      expect(mockAxios.get).toHaveBeenCalledWith('/prompts', {
        params: { module_id: 'test-module', limit: 10 },
      });
    });
  });

  describe('renderPrompt', () => {
    beforeEach(async () => {
      mockAxios.get.mockResolvedValue({ status: 200 });
      await client.initialize();
    });

    it('should render prompt successfully', async () => {
      const mockRenderResult = {
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello!' },
        ],
        hash: 'abc123',
        template_id: 'test-prompt',
        version: '1.0.0',
        inputs_used: { name: 'Test' },
        applied_policies: ['content-filter'],
      };

      mockAxios.post.mockResolvedValue({ status: 200, data: mockRenderResult });

      const result = await client.renderPrompt({
        promptId: 'test-prompt',
        variables: { name: 'Test' },
      });

      expect(result).toEqual(mockRenderResult);
      expect(mockAxios.post).toHaveBeenCalledWith('/render', {
        id: 'test-prompt',
        alias: 'latest',
        inputs: { name: 'Test' },
        tenant: undefined,
        overrides: undefined,
      });
    });
  });

  describe('validatePrompt', () => {
    beforeEach(async () => {
      mockAxios.get.mockResolvedValue({ status: 200 });
      await client.initialize();
    });

    it('should validate existing prompt', async () => {
      mockAxios.get.mockResolvedValue({
        status: 200,
        data: createMockPromptResponse(),
      });

      const result = await client.validatePrompt('test-prompt', '1.0.0');

      expect(result).toBe(true);
    });

    it('should return false for non-existent prompt', async () => {
      mockAxios.get.mockRejectedValue({ response: { status: 404 } });

      const result = await client.validatePrompt('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('getModelCompatibility', () => {
    beforeEach(async () => {
      mockAxios.get.mockResolvedValue({ status: 200 });
      await client.initialize();
    });

    it('should return true for compatible model', async () => {
      mockAxios.get.mockResolvedValue({
        status: 200,
        data: { is_compatible: true },
      });

      const result = await client.getModelCompatibility('test-prompt', 'openai', 'gpt-4');

      expect(result).toBe(true);
    });

    it('should return false for incompatible model', async () => {
      mockAxios.get.mockResolvedValue({
        status: 200,
        data: { is_compatible: false },
      });

      const result = await client.getModelCompatibility('test-prompt', 'openai', 'gpt-4');

      expect(result).toBe(false);
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when all services are up', async () => {
      mockAxios.get.mockResolvedValue({ status: 200 });
      await client.initialize();

      const health = await client.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.details.auth).toBe(true);
      expect(health.details.cache).toBe(true);
    });

    it('should return unhealthy status when services are down', async () => {
      mockAxios.get.mockRejectedValue(new Error('Service unavailable'));

      const health = await client.healthCheck();

      expect(health.status).toBe('unhealthy');
    });
  });

  describe('clearCache', () => {
    it('should clear cache without errors', async () => {
      mockAxios.get.mockResolvedValue({ status: 200 });
      await client.initialize();

      await expect(client.clearCache('test-prompt')).resolves.not.toThrow();
    });

    it('should clear all cache when no promptId provided', async () => {
      mockAxios.get.mockResolvedValue({ status: 200 });
      await client.initialize();

      await expect(client.clearCache()).resolves.not.toThrow();
    });
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', async () => {
      mockAxios.get.mockResolvedValue({ status: 200 });
      await client.initialize();

      await expect(client.shutdown()).resolves.not.toThrow();
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', async () => {
      mockAxios.get.mockResolvedValue({ status: 200 });
      await client.initialize();

      const stats = client.getCacheStats();

      expect(stats).toBeDefined();
      expect(typeof stats.hits).toBe('number');
      expect(typeof stats.misses).toBe('number');
    });
  });

  describe('updateConfig', () => {
    beforeEach(async () => {
      mockAxios.get.mockResolvedValue({ status: 200 });
      await client.initialize();
    });

    it('should update API key', async () => {
      await expect(
        client.updateConfig({ apiKey: 'new-api-key' })
      ).resolves.not.toThrow();
    });

    it('should update baseUrl', async () => {
      await expect(
        client.updateConfig({ baseUrl: 'https://new-api.test.com/v1' })
      ).resolves.not.toThrow();
    });

    it('should update telemetry settings', async () => {
      await expect(
        client.updateConfig({ enableTelemetry: false })
      ).resolves.not.toThrow();
    });
  });
});