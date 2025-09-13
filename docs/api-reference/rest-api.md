# REST API Reference

This document provides comprehensive reference documentation for the PromptOps REST API.

## 🌐 Base URL

```
https://api.promptops.com/v1/client
```

## 🔐 Authentication

All API requests require authentication using API keys and HMAC signatures.

### Required Headers

```http
Authorization: Bearer po_abc123def456ghi789jkl012
X-PromptOps-Signature: hmac_signature_here
X-PromptOps-Timestamp: 2024-01-01T12:00:00Z
Content-Type: application/json
```

### Creating HMAC Signature

```python
import hmac
import hashlib
from datetime import datetime

def create_signature(api_key, secret_key, method, endpoint):
    timestamp = datetime.utcnow().isoformat() + 'Z'
    message = f"{api_key}:{timestamp}:{method}:{endpoint}"
    signature = hmac.new(
        secret_key.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()
    return timestamp, signature
```

```typescript
import * as crypto from 'crypto';

function createSignature(
  apiKey: string,
  secretKey: string,
  method: string,
  endpoint: string
): { timestamp: string; signature: string } {
  const timestamp = new Date().toISOString() + 'Z';
  const message = `${apiKey}:${timestamp}:${method}:${endpoint}`;
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(message)
    .digest('hex');
  return { timestamp, signature };
}
```

## 📋 Response Format

### Success Response

```json
{
  "success": true,
  "data": {
    // Response data varies by endpoint
  },
  "metadata": {
    "request_id": "req-abc123def456",
    "processing_time_ms": 45,
    "cache_hit": true,
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      // Additional error details
    }
  },
  "metadata": {
    "request_id": "req-def456ghi789",
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

## 🎯 Endpoints

### Authentication Management

#### Create API Key

**POST** `/auth/api-keys`

Create a new API key for the current user.

**Request Body:**
```json
{
  "name": "My Application",
  "description": "API key for production application",
  "rate_limit_per_minute": 100,
  "rate_limit_per_hour": 6000,
  "rate_limit_per_day": 144000,
  "allowed_projects": ["project1", "project2"],
  "allowed_scopes": ["read", "write"],
  "expires_at": "2024-12-31T23:59:59Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "api_key": "po_abc123def456ghi789jkl012",
    "secret_key": "secret123abc456def789ghi012jkl",
    "api_key_data": {
      "id": "api-key-uuid",
      "name": "My Application",
      "description": "API key for production application",
      "api_key_prefix": "po_abc123",
      "rate_limit_per_minute": 100,
      "rate_limit_per_hour": 6000,
      "rate_limit_per_day": 144000,
      "allowed_projects": ["project1", "project2"],
      "allowed_scopes": ["read", "write"],
      "status": "active",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  }
}
```

#### List API Keys

**GET** `/auth/api-keys`

List all API keys for the current user.

**Query Parameters:**
- `limit` (optional): Number of results to return (default: 50, max: 100)
- `offset` (optional): Offset for pagination (default: 0)
- `status` (optional): Filter by status ("active", "revoked")

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "api-key-uuid",
      "name": "My Application",
      "description": "API key for production application",
      "api_key_prefix": "po_abc123",
      "rate_limit_per_minute": 100,
      "rate_limit_per_hour": 6000,
      "rate_limit_per_day": 144000,
      "allowed_projects": ["project1", "project2"],
      "allowed_scopes": ["read", "write"],
      "status": "active",
      "last_used_at": "2024-01-01T12:00:00Z",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ],
  "metadata": {
    "total": 1,
    "limit": 50,
    "offset": 0,
    "has_more": false
  }
}
```

#### Revoke API Key

**DELETE** `/auth/api-keys/{api_key_id}`

Revoke an API key.

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "API key revoked successfully"
  }
}
```

#### Validate API Key

**POST** `/auth/validate`

Validate an API key (for testing purposes).

**Request Body:**
```json
{
  "api_key": "po_abc123def456ghi789jkl012",
  "signature": "hmac_signature_here",
  "timestamp": "2024-01-01T12:00:00Z",
  "method": "GET",
  "endpoint": "/v1/client/prompts/example-prompt"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "api_key_id": "api-key-uuid",
    "user_id": "user-uuid",
    "tenant_id": "tenant-uuid",
    "scopes": ["read", "write"],
    "allowed_projects": ["project1", "project2"],
    "rate_limits": {
      "minute": 100,
      "hour": 6000,
      "day": 144000
    }
  }
}
```

### Prompt Operations

#### Get Prompt

**GET** `/prompts/{prompt_id}`

Get the latest version of a prompt.

**Query Parameters:**
- `project_id` (optional): Filter by project ID
- `version` (optional): Get specific version
- `use_cache` (optional): Use cache (default: true)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "prompt-uuid",
    "version": "1.0.0",
    "name": "Customer Service Response",
    "description": "Template for customer service responses",
    "content": "You are a helpful customer service assistant...",
    "variables": ["customer_name", "issue_type"],
    "target_models": ["openai", "anthropic"],
    "model_specific_prompts": [
      {
        "model_provider": "openai",
        "model_name": "gpt-4",
        "content": "You are a helpful customer service assistant using GPT-4...",
        "instructions": "Be concise and professional"
      }
    ],
    "module_id": "module-uuid",
    "created_by": "user-uuid",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z",
    "tags": ["customer-service", "response"],
    "metadata": {
      "mas_intent": "customer_support",
      "mas_fairness_notes": "Tested for bias across demographics",
      "mas_testing_notes": "Validated with 1000 test cases",
      "mas_risk_level": "low"
    }
  }
}
```

#### Render Prompt

**POST** `/prompts/{prompt_id}/render`

Render a prompt with variable substitution.

**Request Body:**
```json
{
  "variables": {
    "customer_name": "John Doe",
    "issue_type": "billing",
    "priority": "high"
  },
  "version": "1.0.0",
  "model_provider": "openai",
  "model_name": "gpt-4",
  "project_id": "project-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "prompt_id": "prompt-uuid",
    "version": "1.0.0",
    "rendered_content": "You are a helpful customer service assistant... John Doe has a billing issue...",
    "messages": [
      {
        "role": "system",
        "content": "You are a helpful customer service assistant... John Doe has a billing issue..."
      }
    ],
    "variables_used": ["customer_name", "issue_type", "priority"],
    "processing_time_ms": 15,
    "cache_hit": false
  }
}
```

#### List Prompts

**GET** `/prompts`

Search and list prompts.

**Query Parameters:**
- `query` (optional): Search query string
- `project_id` (optional): Filter by project ID
- `module_id` (optional): Filter by module ID
- `limit` (default: 50): Number of results to return
- `offset` (default: 0): Offset for pagination
- `sort_by` (default: "created_at"): Field to sort by
- `sort_order` (default: "desc"): Sort direction ("asc" or "desc")
- `tags` (optional): Filter by tags (comma-separated)

**Response:**
```json
{
  "success": true,
  "data": {
    "prompts": [
      {
        "id": "prompt-uuid",
        "version": "1.0.0",
        "name": "Customer Service Response",
        "description": "Template for customer service responses",
        "module_id": "module-uuid",
        "created_by": "user-uuid",
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z"
      }
    ],
    "total": 1,
    "limit": 50,
    "offset": 0,
    "has_more": false
  }
}
```

#### Create Prompt

**POST** `/prompts`

Create a new prompt.

**Request Body:**
```json
{
  "name": "Technical Support Response",
  "description": "Response template for technical issues",
  "content": "Hello {{customer_name}}! I understand you're having {{issue_type}}...",
  "variables": ["customer_name", "issue_type", "severity"],
  "target_models": ["openai", "anthropic"],
  "tags": ["technical", "support", "response"],
  "project_id": "project-uuid",
  "module_id": "module-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "new-prompt-uuid",
    "version": "1.0.0",
    "name": "Technical Support Response",
    "description": "Response template for technical issues",
    "content": "Hello {{customer_name}}! I understand you're having {{issue_type}}...",
    "variables": ["customer_name", "issue_type", "severity"],
    "target_models": ["openai", "anthropic"],
    "created_by": "user-uuid",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

#### Update Prompt

**PUT** `/prompts/{prompt_id}`

Update an existing prompt.

**Request Body:**
```json
{
  "name": "Updated Customer Service Response",
  "description": "Updated description",
  "content": "Updated content...",
  "variables": ["customer_name", "issue_type"],
  "target_models": ["openai", "anthropic", "google"],
  "tags": ["customer-service", "response", "updated"],
  "create_new_version": true
}
```

#### Delete Prompt

**DELETE** `/prompts/{prompt_id}`

Delete a prompt.

**Query Parameters:**
- `version` (optional): Delete specific version (if omitted, deletes all versions)
- `project_id` (optional): Filter by project ID

#### Get Prompt Versions

**GET** `/prompts/{prompt_id}/versions`

List all versions of a prompt.

**Query Parameters:**
- `project_id` (optional): Filter by project ID

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "prompt-uuid",
      "version": "1.0.0",
      "name": "Customer Service Response",
      "description": "Template for customer service responses",
      "content": "You are a helpful customer service assistant...",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    },
    {
      "id": "prompt-uuid",
      "version": "1.1.0",
      "name": "Customer Service Response",
      "description": "Updated template for customer service responses",
      "content": "You are an excellent customer service assistant...",
      "created_at": "2024-01-02T00:00:00Z",
      "updated_at": "2024-01-02T00:00:00Z"
    }
  ]
}
```

#### Get Model-Specific Prompt

**GET** `/prompts/{prompt_id}/model/{provider}/{name}`

Get model-specific version of a prompt.

**Query Parameters:**
- `project_id` (optional): Filter by project ID

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "prompt-uuid",
    "version": "1.0.0",
    "name": "Customer Service Response",
    "description": "Optimized for GPT-4",
    "content": "You are a helpful customer service assistant using GPT-4...",
    "is_model_specific": true,
    "provider": "openai",
    "model": "gpt-4",
    "expected_output_format": "JSON",
    "instructions": "Be concise and professional"
  }
}
```

#### Batch Get Prompts

**POST** `/prompts/batch`

Get multiple prompts in a single request.

**Request Body:**
```json
{
  "prompt_ids": ["prompt1", "prompt2", "prompt3"],
  "project_id": "project-uuid",
  "include_versions": false,
  "include_metadata": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "prompts": {
      "prompt1": {
        "id": "prompt1",
        "version": "1.0.0",
        "name": "Prompt 1",
        "content": "Content of prompt 1..."
      },
      "prompt2": {
        "id": "prompt2",
        "version": "1.0.0",
        "name": "Prompt 2",
        "content": "Content of prompt 2..."
      }
    },
    "errors": [
      {
        "prompt_id": "prompt3",
        "error": "Prompt not found"
      }
    ],
    "total_requested": 3,
    "total_found": 2
  }
}
```

### Model Operations

#### List Models

**GET** `/models`

List available models and their capabilities.

**Query Parameters:**
- `provider` (optional): Filter by provider
- `capability` (optional): Filter by capability

**Response:**
```json
{
  "success": true,
  "data": {
    "models": [
      {
        "provider": "openai",
        "name": "gpt-4",
        "display_name": "GPT-4",
        "description": "Latest GPT-4 model",
        "capabilities": ["chat", "completion", "embedding"],
        "max_tokens": 8192,
        "supports_streaming": true,
        "supports_json": true,
        "cost_per_1k_tokens": {
          "input": 0.03,
          "output": 0.06
        }
      },
      {
        "provider": "anthropic",
        "name": "claude-3-sonnet",
        "display_name": "Claude 3 Sonnet",
        "description": "Balanced model for most tasks",
        "capabilities": ["chat", "completion"],
        "max_tokens": 200000,
        "supports_streaming": true,
        "supports_json": true,
        "cost_per_1k_tokens": {
          "input": 0.015,
          "output": 0.075
        }
      }
    ]
  }
}
```

#### Get Model Compatibility

**POST** `/models/compatibility`

Check if a prompt is compatible with specific models.

**Request Body:**
```json
{
  "prompt_id": "prompt-uuid",
  "prompt_content": "You are a helpful assistant...",
  "models": [
    {
      "provider": "openai",
      "name": "gpt-4"
    },
    {
      "provider": "anthropic",
      "name": "claude-3-sonnet"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "compatibility": [
      {
        "provider": "openai",
        "name": "gpt-4",
        "compatible": true,
        "score": 0.95,
        "issues": [],
        "recommendations": []
      },
      {
        "provider": "anthropic",
        "name": "claude-3-sonnet",
        "compatible": true,
        "score": 0.92,
        "issues": [],
        "recommendations": [
          "Consider adding more context for better results"
        ]
      }
    ]
  }
}
```

### Usage Analytics

#### Log Usage

**POST** `/usage/log`

Log usage data.

**Request Body:**
```json
{
  "endpoint": "/v1/client/prompts/example-prompt",
  "method": "GET",
  "prompt_id": "example-prompt",
  "project_id": "project-uuid",
  "tokens_requested": 100,
  "tokens_used": 95,
  "response_size": 2048,
  "processing_time_ms": 150,
  "estimated_cost_usd": "0.000285",
  "status_code": 200,
  "error_message": null,
  "user_agent": "MyApp/1.0.0",
  "ip_address": "192.168.1.1",
  "request_id": "req-123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Usage logged successfully"
  }
}
```

#### Get Usage Statistics

**GET** `/usage/stats`

Get usage statistics.

**Query Parameters:**
- `start_date` (optional): Start date for statistics (ISO format)
- `end_date` (optional): End date for statistics (ISO format)
- `prompt_id` (optional): Filter by prompt ID
- `project_id` (optional): Filter by project ID
- `granularity` (optional): "hour", "day", "week", "month" (default: "day")

**Response:**
```json
{
  "success": true,
  "data": {
    "total_requests": 1000,
    "total_tokens_requested": 50000,
    "total_tokens_used": 47500,
    "total_cost_usd": "0.142500",
    "average_response_time_ms": 125.5,
    "success_rate": 0.98,
    "requests_by_endpoint": {
      "/v1/client/prompts": 800,
      "/v1/client/prompts/batch": 200
    },
    "requests_by_hour": [
      {
        "hour": "2024-01-01 10:00",
        "count": 50
      }
    ],
    "top_prompts": [
      {
        "prompt_id": "prompt1",
        "count": 300
      }
    ],
    "period_start": "2024-01-01T00:00:00Z",
    "period_end": "2024-01-31T23:59:59Z"
  }
}
```

#### Get Usage Limits

**GET** `/usage/limits`

Get current usage and rate limits.

**Response:**
```json
{
  "success": true,
  "data": {
    "current_usage_minute": 25,
    "current_usage_hour": 500,
    "current_usage_day": 8000,
    "limits_minute": 100,
    "limits_hour": 6000,
    "limits_day": 144000,
    "remaining_minute": 75,
    "remaining_hour": 5500,
    "remaining_day": 136000,
    "reset_time_minute": "2024-01-01T12:01:00Z",
    "reset_time_hour": "2024-01-01T13:00:00Z",
    "reset_time_day": "2024-01-02T00:00:00Z"
  }
}
```

### Health Check

**GET** `/health`

Check API health status.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-01T12:00:00Z",
    "version": "1.0.0",
    "dependencies": {
      "database": "healthy",
      "cache": "healthy",
      "queue": "healthy"
    },
    "uptime_seconds": 86400,
    "requests_last_minute": 150
  }
}
```

## 🚨 Error Codes

### Authentication Errors
- `401` - Invalid or expired API key
- `403` - Insufficient permissions

### Client Errors
- `400` - Bad request (invalid parameters)
- `404` - Resource not found
- `422` - Validation error

### Rate Limiting
- `429` - Rate limit exceeded

### Server Errors
- `500` - Internal server error
- `502` - Bad gateway
- `503` - Service unavailable
- `504` - Gateway timeout

## 📊 Rate Limiting

API requests are rate limited based on your API key configuration:

- **Per-minute limit**: Configurable per API key (default: 60)
- **Per-hour limit**: Configurable per API key (default: 3600)
- **Per-day limit**: Configurable per API key (default: 86400)

Rate limit headers are included in responses:

- `X-RateLimit-Limit-Minute`: Requests allowed per minute
- `X-RateLimit-Remaining-Minute`: Remaining requests this minute
- `X-RateLimit-Reset-Minute`: Time when minute limit resets
- `X-RateLimit-Limit-Hour`: Requests allowed per hour
- `X-RateLimit-Remaining-Hour`: Remaining requests this hour
- `X-RateLimit-Reset-Hour`: Time when hour limit resets
- `X-RateLimit-Limit-Day`: Requests allowed per day
- `X-RateLimit-Remaining-Day`: Remaining requests this day
- `X-RateLimit-Reset-Day`: Time when day limit resets

---

*For SDK-specific implementations, see the [Python Client](python-client.md) and [JavaScript Client](javascript-client.md) documentation.*