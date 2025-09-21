/**
 * K6 load testing script for PromptOps JavaScript client
 */

import { check, sleep } from 'k6';
import http from 'k6/http';

// Test configuration
export const options = {
  stages: [
    // Ramp up to 50 users over 30 seconds
    { duration: '30s', target: 50 },
    // Stay at 50 users for 1 minute
    { duration: '1m', target: 50 },
    // Ramp up to 100 users over 30 seconds
    { duration: '30s', target: 100 },
    // Stay at 100 users for 2 minutes
    { duration: '2m', target: 100 },
    // Ramp down to 0 over 30 seconds
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    http_req_failed: ['rate<0.05'], // Less than 5% error rate
  },
};

// Test data
const testPrompts = [
  'greeting-prompt',
  'code-review-prompt',
  'documentation-prompt',
  'debug-prompt',
  'optimization-prompt',
];

const modelProviders = ['openai', 'anthropic', 'google'];
const modelNames = [
  'gpt-4', 'gpt-3.5-turbo',
  'claude-3-sonnet', 'claude-3-opus',
  'gemini-pro', 'gemini-ultra'
];

const frameworks = ['Python', 'JavaScript', 'TypeScript', 'Java', 'Go', 'Rust'];
const userNames = ['Alice', 'Bob', 'Charlie', 'David', 'Eve', 'Frank', 'Grace', 'Henry'];

// Helper function to generate random variables
function generateVariables() {
  return {
    name: userNames[Math.floor(Math.random() * userNames.length)],
    framework: frameworks[Math.floor(Math.random() * frameworks.length)],
    version: `${Math.floor(Math.random() * 5)}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}`,
    timestamp: Date.now(),
    userId: `user_${Math.floor(Math.random() * 10000)}`,
    sessionId: `session_${Math.floor(Math.random() * 1000)}`,
  };
}

// Test scenarios
export default function () {
  const baseUrl = 'http://localhost:8000';
  const apiKey = `k6-test-key-${__VU}`; // Unique key per virtual user

  // Test 1: Health Check (10% of requests)
  if (Math.random() < 0.1) {
    const healthResponse = http.get(`${baseUrl}/health`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    check(healthResponse, {
      'health check status is 200': (r) => r.status === 200,
      'health check response time is acceptable': (r) => r.timings.duration < 1000,
    });

    sleep(1);
  }

  // Test 2: Get Single Prompt (30% of requests)
  if (Math.random() < 0.3) {
    const promptId = testPrompts[Math.floor(Math.random() * testPrompts.length)];
    const version = Math.random() < 0.8 ? 'latest' : `${Math.floor(Math.random() * 5)}.${Math.floor(Math.random() * 10)}.0`;

    const getResponse = http.get(`${baseUrl}/prompts/${promptId}/${version}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    check(getResponse, {
      'get prompt status is 200': (r) => r.status === 200,
      'get prompt response has content': (r) => r.json().content !== undefined,
      'get prompt response time is acceptable': (r) => r.timings.duration < 500,
    });

    sleep(Math.random() * 2 + 1); // 1-3 seconds
  }

  // Test 3: Render Prompt (25% of requests)
  if (Math.random() < 0.25) {
    const promptId = testPrompts[Math.floor(Math.random() * testPrompts.length)];
    const variables = generateVariables();

    const renderResponse = http.post(`${baseUrl}/render`, JSON.stringify({
      id: promptId,
      alias: 'latest',
      inputs: variables,
      tenant: undefined,
      overrides: undefined,
    }), {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    check(renderResponse, {
      'render prompt status is 200': (r) => r.status === 200,
      'render prompt has messages': (r) => r.json().messages !== undefined,
      'render prompt response time is acceptable': (r) => r.timings.duration < 1000,
    });

    sleep(Math.random() * 3 + 1); // 1-4 seconds
  }

  // Test 4: List Prompts (15% of requests)
  if (Math.random() < 0.15) {
    const moduleId = `module_${Math.floor(Math.random() * 10)}`;
    const limit = Math.floor(Math.random() * 4) * 25 + 25; // 25, 50, 75, 100

    const listResponse = http.get(`${baseUrl}/prompts?module_id=${moduleId}&limit=${limit}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    check(listResponse, {
      'list prompts status is 200': (r) => r.status === 200,
      'list prompts returns array': (r) => Array.isArray(r.json()),
      'list prompts response time is acceptable': (r) => r.timings.duration < 750,
    });

    sleep(Math.random() * 2 + 1); // 1-3 seconds
  }

  // Test 5: Validate Prompt (10% of requests)
  if (Math.random() < 0.1) {
    const promptId = testPrompts[Math.floor(Math.random() * testPrompts.length)];
    const version = Math.random() < 0.8 ? 'latest' : `${Math.floor(Math.random() * 5)}.${Math.floor(Math.random() * 10)}.0`;

    const validateResponse = http.get(`${baseUrl}/prompts/${promptId}/${version}/validate`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    check(validateResponse, {
      'validate prompt status is 200': (r) => r.status === 200,
      'validate prompt returns boolean': (r) => typeof r.json().valid === 'boolean',
      'validate prompt response time is acceptable': (r) => r.timings.duration < 500,
    });

    sleep(Math.random() * 1 + 0.5); // 0.5-1.5 seconds
  }

  // Test 6: Check Model Compatibility (10% of requests)
  if (Math.random() < 0.1) {
    const promptId = testPrompts[Math.floor(Math.random() * testPrompts.length)];
    const modelProvider = modelProviders[Math.floor(Math.random() * modelProviders.length)];
    const modelName = modelNames[Math.floor(Math.random() * modelNames.length)];

    const compatResponse = http.get(`${baseUrl}/prompts/${promptId}/compatibility?model_provider=${modelProvider}&model_name=${modelName}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    check(compatResponse, {
      'compatibility check status is 200': (r) => r.status === 200,
      'compatibility check returns is_compatible': (r) => r.json().hasOwnProperty('is_compatible'),
      'compatibility check response time is acceptable': (r) => r.timings.duration < 300,
    });

    sleep(Math.random() * 1 + 0.5); // 0.5-1.5 seconds
  }
}

// Export additional test functions for specific scenarios
export function stressTest() {
  // High-intensity stress test
  const baseUrl = 'http://localhost:8000';
  const apiKey = `stress-test-key-${__VU}`;

  for (let i = 0; i < 10; i++) {
    const promptId = testPrompts[Math.floor(Math.random() * testPrompts.length)];
    const variables = generateVariables();

    const response = http.post(`${baseUrl}/render`, JSON.stringify({
      id: promptId,
      alias: 'latest',
      inputs: variables,
    }), {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    check(response, {
      'stress test request successful': (r) => r.status === 200,
      'stress test response time acceptable': (r) => r.timings.duration < 2000,
    });
  }

  sleep(0.1); // Minimal delay for stress test
}

export function enduranceTest() {
  // Long-running endurance test
  const startTime = Date.now();
  const duration = 300000; // 5 minutes
  const requestCount = 0;

  while (Date.now() - startTime < duration) {
    const baseUrl = 'http://localhost:8000';
    const apiKey = `endurance-test-key-${__VU}`;

    // Rotate through different endpoints
    const endpointChoice = Math.floor(Math.random() * 3);

    switch (endpointChoice) {
      case 0: // Health check
        http.get(`${baseUrl}/health`, {
          headers: { 'Authorization': `Bearer ${apiKey}` },
        });
        break;
      case 1: // Get prompt
        const promptId = testPrompts[Math.floor(Math.random() * testPrompts.length)];
        http.get(`${baseUrl}/prompts/${promptId}/latest`, {
          headers: { 'Authorization': `Bearer ${apiKey}` },
        });
        break;
      case 2: // Render prompt
        const variables = generateVariables();
        http.post(`${baseUrl}/render`, JSON.stringify({
          id: testPrompts[Math.floor(Math.random() * testPrompts.length)],
          alias: 'latest',
          inputs: variables,
        }), {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        });
        break;
    }

    requestCount++;
    sleep(1); // 1 second between requests
  }

  console.log(`Endurance test completed: ${requestCount} requests in 5 minutes`);
}