/**
 * Prompt Manager for PromptOps Client
 */

import axios, { AxiosInstance } from 'axios';
import { createHash } from 'crypto';
import {
  PromptRequest,
  PromptResponse,
  ModelSpecificPrompt,
  RenderResult,
  VariableSubstitutionConfig,
} from '../types';
import {
  PromptOpsError,
  ValidationError,
  NotFoundError,
  NetworkError,
  TimeoutError,
  createErrorFromResponse,
} from '../types/errors';
import { CacheManager } from '../cache/CacheManager';
import { TelemetryManager } from '../telemetry/TelemetryManager';

export class PromptManager {
  private client: AxiosInstance;
  private cache: CacheManager;
  private telemetry: TelemetryManager;
  private config: VariableSubstitutionConfig;

  constructor(
    client: AxiosInstance,
    cache: CacheManager,
    telemetry: TelemetryManager,
    config?: Partial<VariableSubstitutionConfig>
  ) {
    this.client = client;
    this.cache = cache;
    this.telemetry = telemetry;
    this.config = {
      enableStrictMode: config?.enableStrictMode ?? true,
      fallbackValue: config?.fallbackValue,
      enableRecursiveSubstitution: config?.enableRecursiveSubstitution ?? true,
      maxRecursionDepth: config?.maxRecursionDepth ?? 10,
    };
  }

  private generateCacheKey(request: PromptRequest): string {
    const keyData = {
      promptId: request.promptId,
      version: request.version || 'latest',
      variables: request.variables || {},
      modelProvider: request.modelProvider,
      modelName: request.modelName,
      tenantId: request.tenantId,
      projectId: request.projectId,
      overrides: request.overrides || {},
    };
    return createHash('sha256').update(JSON.stringify(keyData)).digest('hex');
  }

  private substituteVariables(
    content: string,
    variables: Record<string, any>,
    depth: number = 0
  ): string {
    if (depth > this.config.maxRecursionDepth) {
      throw new ValidationError(`Maximum recursion depth (${this.config.maxRecursionDepth}) exceeded`);
    }

    let result = content;

    // Replace {{variable}} patterns
    result = result.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
      const trimmedVarName = varName.trim();
      const value = variables[trimmedVarName];

      if (value === undefined || value === null) {
        if (this.config.enableStrictMode) {
          throw new ValidationError(`Variable '${trimmedVarName}' not found in provided variables`);
        }
        return this.config.fallbackValue !== undefined
          ? String(this.config.fallbackValue)
          : match;
      }

      // Handle recursive substitution
      if (typeof value === 'string' && this.config.enableRecursiveSubstitution) {
        return this.substituteVariables(value, variables, depth + 1);
      }

      return String(value);
    });

    // Replace ${variable} patterns
    result = result.replace(/\$\{([^}]+)\}/g, (match, varName) => {
      const trimmedVarName = varName.trim();
      const value = variables[trimmedVarName];

      if (value === undefined || value === null) {
        if (this.config.enableStrictMode) {
          throw new ValidationError(`Variable '${trimmedVarName}' not found in provided variables`);
        }
        return this.config.fallbackValue !== undefined
          ? String(this.config.fallbackValue)
          : match;
      }

      // Handle recursive substitution
      if (typeof value === 'string' && this.config.enableRecursiveSubstitution) {
        return this.substituteVariables(value, variables, depth + 1);
      }

      return String(value);
    });

    return result;
  }

  private getModelSpecificContent(
    prompt: PromptResponse,
    modelProvider?: string,
    modelName?: string
  ): string {
    if (!modelProvider && !modelName) {
      return prompt.content;
    }

    // Find matching model-specific prompt
    const modelPrompt = prompt.model_specific_prompts.find(
      (msp) =>
        (!modelProvider || msp.model_provider === modelProvider) &&
        (!modelName || msp.model_name === modelName)
    );

    return modelPrompt?.content || prompt.content;
  }

  private async trackPerformance(
    operation: string,
    startTime: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    const duration = Date.now() - startTime;
    await this.telemetry.trackPerformance(operation, duration, metadata);
  }

  async getPrompt(request: PromptRequest): Promise<PromptResponse> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(request);

    // Try cache first
    const cached = await this.cache.get<PromptResponse>(cacheKey);
    if (cached) {
      await this.telemetry.trackCacheHit(cacheKey, 'memory');
      await this.trackPerformance('get_prompt_cache_hit', startTime, {
        promptId: request.promptId,
        version: request.version,
      });
      return cached;
    }

    await this.telemetry.trackCacheMiss(cacheKey, 'memory');

    try {
      const endpoint = `/prompts/${request.promptId}${request.version ? `/${request.version}` : ''}`;
      const response = await this.client.get(endpoint, {
        params: {
          model_provider: request.modelProvider,
          model_name: request.modelName,
          tenant_id: request.tenantId,
          project_id: request.projectId,
        },
      });

      await this.telemetry.trackApiCall(endpoint, 'GET', response.status, Date.now() - startTime);

      if (response.status !== 200) {
        throw createErrorFromResponse(response.status, response.statusText);
      }

      const prompt: PromptResponse = response.data;

      // Cache the result
      await this.cache.set(cacheKey, prompt);

      await this.trackPerformance('get_prompt', startTime, {
        promptId: request.promptId,
        version: request.version,
        cacheHit: false,
      });

      return prompt;
    } catch (error) {
      await this.trackPerformance('get_prompt_error', startTime, {
        promptId: request.promptId,
        version: request.version,
        error: error instanceof Error ? error.message : String(error),
      });

      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new TimeoutError('Request timeout');
        }
        if (!error.response) {
          throw new NetworkError('Network error occurred');
        }
        throw createErrorFromResponse(
          error.response.status,
          error.response.data?.message || error.message,
          error.response.data
        );
      }

      throw error;
    }
  }

  async getPromptContent(request: PromptRequest): Promise<string> {
    const prompt = await this.getPrompt(request);
    const content = this.getModelSpecificContent(
      prompt,
      request.modelProvider,
      request.modelName
    );

    // Apply variable substitution if variables are provided
    if (request.variables && Object.keys(request.variables).length > 0) {
      return this.substituteVariables(content, request.variables);
    }

    return content;
  }

  async listPrompts(moduleId?: string, projectId?: string, limit: number = 100): Promise<PromptResponse[]> {
    const startTime = Date.now();

    try {
      const response = await this.client.get('/prompts', {
        params: {
          module_id: moduleId,
          project_id: projectId,
          limit,
        },
      });

      await this.telemetry.trackApiCall('/prompts', 'GET', response.status, Date.now() - startTime);

      if (response.status !== 200) {
        throw createErrorFromResponse(response.status, response.statusText);
      }

      const prompts: PromptResponse[] = response.data;

      await this.trackPerformance('list_prompts', startTime, {
        moduleId,
        promptCount: prompts.length,
      });

      return prompts;
    } catch (error) {
      await this.trackPerformance('list_prompts_error', startTime, {
        moduleId,
        error: error instanceof Error ? error.message : String(error),
      });

      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new TimeoutError('Request timeout');
        }
        if (!error.response) {
          throw new NetworkError('Network error occurred');
        }
        throw createErrorFromResponse(
          error.response.status,
          error.response.data?.message || error.message,
          error.response.data
        );
      }

      throw error;
    }
  }

  async renderPrompt(request: PromptRequest): Promise<RenderResult> {
    const startTime = Date.now();

    try {
      const response = await this.client.post('/render', {
        id: request.promptId,
        alias: request.version || 'latest',
        inputs: request.variables || {},
        tenant: request.tenantId,
        overrides: request.overrides,
      });

      await this.telemetry.trackApiCall('/render', 'POST', response.status, Date.now() - startTime);

      if (response.status !== 200) {
        throw createErrorFromResponse(response.status, response.statusText);
      }

      const result: RenderResult = response.data;

      await this.trackPerformance('render_prompt', startTime, {
        promptId: request.promptId,
        version: request.version,
        variableCount: Object.keys(request.variables || {}).length,
      });

      return result;
    } catch (error) {
      await this.trackPerformance('render_prompt_error', startTime, {
        promptId: request.promptId,
        version: request.version,
        error: error instanceof Error ? error.message : String(error),
      });

      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new TimeoutError('Request timeout');
        }
        if (!error.response) {
          throw new NetworkError('Network error occurred');
        }
        throw createErrorFromResponse(
          error.response.status,
          error.response.data?.message || error.message,
          error.response.data
        );
      }

      throw error;
    }
  }

  async validatePrompt(promptId: string, version?: string): Promise<boolean> {
    try {
      const prompt = await this.getPrompt({ promptId, version });
      return Boolean(prompt && prompt.content);
    } catch (error) {
      return false;
    }
  }

  async getModelCompatibility(promptId: string, modelProvider: string, modelName: string): Promise<boolean> {
    try {
      const response = await this.client.get(`/prompts/${promptId}/compatibility/${modelProvider}/${modelName}`);
      return response.status === 200 && response.data.is_compatible;
    } catch {
      return false;
    }
  }

  async clearCache(promptId?: string): Promise<void> {
    if (promptId) {
      // Clear cache for specific prompt
      const pattern = `prompt_${promptId}_`;
      const keys = await this.cache.getKeys(pattern);
      for (const key of keys) {
        await this.cache.delete(key);
      }
    } else {
      // Clear all cache
      await this.cache.clear();
    }
  }

  getCacheStats() {
    return this.cache.getStats();
  }

  updateVariableSubstitutionConfig(config: Partial<VariableSubstitutionConfig>): void {
    this.config = { ...this.config, ...config };
  }
}