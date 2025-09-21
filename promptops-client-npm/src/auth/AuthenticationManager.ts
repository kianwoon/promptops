/**
 * Authentication Manager for PromptOps Client
 */

import axios, { AxiosInstance } from 'axios';
import { AuthenticationError, ConfigurationError } from '../types/errors';
import { PromptOpsConfig } from '../types';

export class AuthenticationManager {
  private apiKey?: string;
  private baseUrl: string;
  private client: AxiosInstance;

  constructor(config: PromptOpsConfig) {
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;

    // Allow development environment to work without API key for certain operations
    if (!this.apiKey && config.environment !== 'development') {
      throw new ConfigurationError('API key is required for authentication');
    }

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: config.timeout || 30000,
      headers: this.getHeaders(),
    });

    this.setupInterceptors();
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'promptops-client/1.0.0',
    };

    // Only add Authorization header if we have an API key
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    return headers;
  }

  private setupInterceptors(): void {
    // Request interceptor for adding authentication
    this.client.interceptors.request.use(
      (config) => {
        if (this.apiKey) {
          config.headers.Authorization = `Bearer ${this.apiKey}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for handling authentication errors
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          throw new AuthenticationError(
            'Invalid or expired API key',
            { statusCode: error.response.status }
          );
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Validate API key by making a test request
   */
  async validateApiKey(): Promise<boolean> {
    try {
      const response = await this.client.get('/auth/validate');
      return response.status === 200;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        throw new AuthenticationError('Invalid API key');
      }
      return false;
    }
  }

  /**
   * Get authenticated Axios instance
   */
  getClient(): AxiosInstance {
    return this.client;
  }

  /**
   * Update API key
   */
  updateApiKey(apiKey: string): void {
    this.apiKey = apiKey;
    this.client.defaults.headers.Authorization = `Bearer ${apiKey}`;
  }

  /**
   * Get current API key (masked for security)
   */
  getApiKey(): string {
    if (!this.apiKey) {
      throw new AuthenticationError('No API key configured');
    }

    // Return masked key for security
    return `${this.apiKey.substring(0, 8)}...${this.apiKey.substring(this.apiKey.length - 4)}`;
  }

  /**
   * Check if authentication is configured
   */
  isAuthenticated(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * Refresh authentication (for cases where token might be expired)
   */
  async refresh(): Promise<void> {
    // For API key authentication, we just validate the key
    const isValid = await this.validateApiKey();
    if (!isValid) {
      throw new AuthenticationError('API key validation failed');
    }
  }
}