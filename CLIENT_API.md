# PromptOps Client API Documentation

The PromptOps Client API provides endpoints for client libraries to interact with the PromptOps registry. This API is designed for programmatic access to prompts, usage analytics, and authentication management.

## Base URL

```
https://your-promptops-instance.com/v1/client
```

## Authentication

The Client API uses API key authentication with HMAC-SHA256 signatures for security.

### API Key Format

API keys follow this format:
```
po_24characteralphanumericstring
```

### Authentication Headers

All requests to the Client API must include these headers:

- `Authorization: Bearer {api_key}`
- `X-PromptOps-Signature: {hmac_signature}`
- `X-PromptOps-Timestamp: {iso_timestamp}`

### Creating HMAC Signature

To create the HMAC signature:

1. Create a message string: `{api_key}:{timestamp}:{method}:{endpoint}`
2. Generate HMAC-SHA256 signature using your secret key
3. Include the signature in the `X-PromptOps-Signature` header

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

## Endpoints

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
```

#### List API Keys

**GET** `/auth/api-keys`

List all API keys for the current user.

**Response:**
```json
[
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
]
```

#### Revoke API Key

**DELETE** `/auth/api-keys/{api_key_id}`

Revoke an API key.

**Response:**
```json
{
  "message": "API key revoked successfully"
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
```

### Prompt Retrieval

#### Get Prompt

**GET** `/prompts/{prompt_id}`

Get the latest version of a prompt.

**Query Parameters:**
- `project_id` (optional): Filter by project ID

**Response:**
```json
{
  "id": "prompt-uuid",
  "version": "1.0.0",
  "name": "Customer Service Response",
  "description": "Template for customer service responses",
  "content": "You are a helpful customer service assistant...",
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
  "mas_intent": "customer_support",
  "mas_fairness_notes": "Tested for bias across demographics",
  "mas_testing_notes": "Validated with 1000 test cases",
  "mas_risk_level": "low"
}
```

#### Get Prompt Versions

**GET** `/prompts/{prompt_id}/versions`

List all versions of a prompt.

**Query Parameters:**
- `project_id` (optional): Filter by project ID

**Response:**
```json
[
  {
    "id": "prompt-uuid",
    "version": "1.0.0",
    "name": "Customer Service Response",
    "description": "Template for customer service responses",
    "content": "You are a helpful customer service assistant...",
    "target_models": ["openai", "anthropic"],
    "model_specific_prompts": [...],
    "module_id": "module-uuid",
    "created_by": "user-uuid",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
]
```

#### Get Specific Version

**GET** `/prompts/{prompt_id}/versions/{version}`

Get a specific version of a prompt.

**Query Parameters:**
- `project_id` (optional): Filter by project ID

#### Search Prompts

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

**Response:**
```json
{
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
```

#### Get Model-Specific Prompt

**GET** `/prompts/{prompt_id}/model/{provider}/{name}`

Get model-specific version of a prompt.

**Query Parameters:**
- `project_id` (optional): Filter by project ID

**Response:**
```json
{
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
  "message": "Usage logged successfully"
}
```

#### Get Usage Statistics

**GET** `/usage/stats`

Get usage statistics.

**Query Parameters:**
- `start_date` (optional): Start date for statistics
- `end_date` (optional): End date for statistics
- `prompt_id` (optional): Filter by prompt ID
- `project_id` (optional): Filter by project ID

**Response:**
```json
{
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
```

#### Get Usage Limits

**GET** `/usage/limits`

Get current usage and rate limits.

**Response:**
```json
{
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
```

## Error Handling

The API uses standard HTTP status codes and returns error information in the response body.

### Error Response Format

```json
{
  "success": false,
  "error": "Error message",
  "status_code": 400,
  "timestamp": "2024-01-01T12:00:00Z",
  "details": {
    "field": "value"
  }
}
```

### Common Error Codes

- **400 Bad Request**: Invalid request parameters
- **401 Unauthorized**: Invalid or expired API key
- **403 Forbidden**: Insufficient permissions or rate limit exceeded
- **404 Not Found**: Resource not found
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server error

## Rate Limiting

API requests are rate limited based on the API key configuration:

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

## SDKs

Client libraries are available for:

- **Python**: `promptops-client-python`
- **JavaScript/TypeScript**: `promptops-client-npm`
- **Java**: `promptops-client-java`
- **Go**: `promptops-client-go`

See the respective SDK documentation for usage examples.

## Security Best Practices

1. **Keep API keys secret**: Never expose API keys in client-side code
2. **Use HTTPS**: Always use HTTPS for API requests
3. **Validate signatures**: Always verify HMAC signatures
4. **Rotate keys**: Regularly rotate API keys
5. **Use minimal scopes**: Request only the permissions you need
6. **Monitor usage**: Monitor API usage for unusual activity
7. **Use environment variables**: Store API keys in environment variables

## Support

For API support:

- Documentation: [PromptOps Docs](https://docs.promptops.com)
- API Reference: [API Reference](https://docs.promptops.com/api)
- Support: support@promptops.com
- Status: [Status Page](https://status.promptops.com)