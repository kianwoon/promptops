/**
 * Tests for AuthenticationManager
 */

import axios from 'axios';
import { AuthenticationManager, AuthenticationError, ConfigurationError } from '../src';
import { createMockAxiosInstance } from './setup';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AuthenticationManager', () => {
  let authManager: AuthenticationManager;
  let mockAxios: any;

  beforeEach(() => {
    mockAxios = createMockAxiosInstance();
  });

  describe('Constructor', () => {
    it('should create manager with valid configuration', () => {
      authManager = new AuthenticationManager({
        baseUrl: 'https://api.test.com/v1',
        apiKey: 'test-api-key',
      });

      expect(authManager).toBeInstanceOf(AuthenticationManager);
    });

    it('should throw error without API key', () => {
      expect(() => {
        new AuthenticationManager({
          baseUrl: 'https://api.test.com/v1',
        } as any);
      }).toThrow(ConfigurationError);
    });
  });

  describe('validateApiKey', () => {
    beforeEach(() => {
      authManager = new AuthenticationManager({
        baseUrl: 'https://api.test.com/v1',
        apiKey: 'test-api-key',
      });
    });

    it('should validate successful API key', async () => {
      mockAxios.get.mockResolvedValue({ status: 200 });

      const result = await authManager.validateApiKey();

      expect(result).toBe(true);
      expect(mockAxios.get).toHaveBeenCalledWith('/auth/validate');
    });

    it('should handle invalid API key', async () => {
      mockAxios.get.mockResolvedValue({ status: 401 });

      await expect(authManager.validateApiKey()).rejects.toThrow(AuthenticationError);
    });

    it('should handle network errors', async () => {
      mockAxios.get.mockRejectedValue(new Error('Network error'));

      const result = await authManager.validateApiKey();

      expect(result).toBe(false);
    });
  });

  describe('getClient', () => {
    beforeEach(() => {
      authManager = new AuthenticationManager({
        baseUrl: 'https://api.test.com/v1',
        apiKey: 'test-api-key',
      });
    });

    it('should return axios instance', () => {
      const client = authManager.getClient();

      expect(client).toBe(mockAxios);
    });
  });

  describe('updateApiKey', () => {
    beforeEach(() => {
      authManager = new AuthenticationManager({
        baseUrl: 'https://api.test.com/v1',
        apiKey: 'test-api-key',
      });
    });

    it('should update API key', () => {
      authManager.updateApiKey('new-api-key');

      expect(mockAxios.defaults.headers.Authorization).toBe('Bearer new-api-key');
    });
  });

  describe('getApiKey', () => {
    beforeEach(() => {
      authManager = new AuthenticationManager({
        baseUrl: 'https://api.test.com/v1',
        apiKey: 'test-api-key-12345678',
      });
    });

    it('should return masked API key', () => {
      const maskedKey = authManager.getApiKey();

      expect(maskedKey).toBe('test-api...5678');
    });

    it('should throw error when no API key is set', () => {
      authManager.updateApiKey('');

      expect(() => authManager.getApiKey()).toThrow(AuthenticationError);
    });
  });

  describe('isAuthenticated', () => {
    it('should return true when API key is set', () => {
      authManager = new AuthenticationManager({
        baseUrl: 'https://api.test.com/v1',
        apiKey: 'test-api-key',
      });

      expect(authManager.isAuthenticated()).toBe(true);
    });

    it('should return false when no API key is set', () => {
      authManager = new AuthenticationManager({
        baseUrl: 'https://api.test.com/v1',
        apiKey: '',
      } as any);

      expect(authManager.isAuthenticated()).toBe(false);
    });
  });

  describe('refresh', () => {
    beforeEach(() => {
      authManager = new AuthenticationManager({
        baseUrl: 'https://api.test.com/v1',
        apiKey: 'test-api-key',
      });
    });

    it('should refresh successfully', async () => {
      mockAxios.get.mockResolvedValue({ status: 200 });

      await expect(authManager.refresh()).resolves.not.toThrow();
    });

    it('should throw error when validation fails', async () => {
      mockAxios.get.mockResolvedValue({ status: 401 });

      await expect(authManager.refresh()).rejects.toThrow(AuthenticationError);
    });
  });

  describe('Request Interceptors', () => {
    beforeEach(() => {
      authManager = new AuthenticationManager({
        baseUrl: 'https://api.test.com/v1',
        apiKey: 'test-api-key',
      });
    });

    it('should add authorization header to requests', () => {
      const requestInterceptor = mockAxios.interceptors.request.use.mock.calls[0][0];
      const config = { headers: {} };

      const result = requestInterceptor(config);

      expect(result.headers.Authorization).toBe('Bearer test-api-key');
    });

    it('should handle 401 responses', () => {
      const error = {
        response: { status: 401 },
        isAxiosError: true,
      };

      const responseInterceptor = mockAxios.interceptors.response.use.mock.calls[0][1];

      expect(() => responseInterceptor(error)).toThrow(AuthenticationError);
    });

    it('should pass through other errors', () => {
      const error = {
        response: { status: 500 },
        isAxiosError: true,
      };

      const responseInterceptor = mockAxios.interceptors.response.use.mock.calls[0][1];

      expect(() => responseInterceptor(error)).not.toThrow();
    });
  });
});