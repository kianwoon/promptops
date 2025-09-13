/**
 * Jest Test Setup
 */

import { jest } from '@jest/globals';

// Mock axios for all tests
jest.mock('axios');
import axios from 'axios';
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock Redis if available
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    ttl: jest.fn(),
    keys: jest.fn(),
    flushdb: jest.fn(),
  })),
}));

// Mock fetch for telemetry
global.fetch = jest.fn();

// Setup test environment
beforeEach(() => {
  // Clear all mocks
  jest.clearAllMocks();

  // Reset mocked axios
  mockedAxios.create.mockReturnValue({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
    defaults: {
      headers: {
        common: {},
      },
    },
  } as any);

  // Mock fetch responses
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue({}),
  });
});

afterEach(() => {
  // Clean up after each test
  jest.restoreAllMocks();
});

// Global test utilities
global.createMockAxiosInstance = () => {
  const mockInstance = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
    defaults: {
      headers: {
        common: {},
      },
    },
  };

  mockedAxios.create.mockReturnValue(mockInstance as any);
  return mockInstance;
};

global.createMockPromptResponse = (overrides = {}) => ({
  id: 'test-prompt-id',
  version: '1.0.0',
  module_id: 'test-module-id',
  name: 'Test Prompt',
  description: 'A test prompt',
  content: 'Hello {{name}}!',
  model_specific_prompts: [
    {
      model_provider: 'openai',
      model_name: 'gpt-4',
      content: 'Hello {{name}}! (GPT-4 version)',
    },
  ],
  target_models: ['openai', 'claude'],
  mas_intent: 'greeting',
  mas_fairness_notes: 'Fair to all users',
  mas_risk_level: 'low' as const,
  created_by: 'test-user',
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z',
  ...overrides,
});

// Test configuration
export const TEST_CONFIG = {
  baseUrl: 'https://api.test.com/v1',
  apiKey: 'test-api-key',
  timeout: 5000,
  retries: 2,
  enableCache: true,
  enableTelemetry: false, // Disable telemetry for tests
};

// Mock console methods to reduce noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};