# API Reference

This section provides comprehensive documentation for the PromptOps API and client libraries.

## 📚 Documentation Contents

### Client Libraries
- [Python Client Reference](python-client.md) - Complete Python SDK documentation
- [JavaScript Client Reference](javascript-client.md) - Complete JavaScript/TypeScript SDK documentation

### REST API
- [REST API Reference](rest-api.md) - Complete REST API endpoint documentation
- [Authentication Guide](authentication.md) - Security setup and HMAC signatures
- [Error Handling](error-handling.md) - Error codes and exception handling
- [Rate Limiting](rate-limiting.md) - Rate limits and quota management

### Integration Guides
- [Webhooks Guide](webhooks.md) - Webhook setup and event handling
- [Batch Operations](batch-operations.md) - Batch request optimization
- [Streaming API](streaming.md) - Real-time prompt streaming
- [GraphQL API](graphql.md) - GraphQL alternative to REST

## 🎯 Key Concepts

### API Structure

The PromptOps API is organized into several main sections:

- **Authentication** - API key management and validation
- **Prompts** - Prompt CRUD operations and retrieval
- **Variables** - Dynamic content substitution
- **Models** - AI model-specific prompt optimization
- **Analytics** - Usage tracking and performance metrics
- **Webhooks** - Event-driven notifications

### Authentication

All API requests require authentication using:
- **API Key** - Your unique identifier
- **HMAC Signature** - Request integrity verification
- **Timestamp** - Replay attack prevention

```python
# Python authentication example
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
// TypeScript authentication example
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

### Request Format

#### REST API Requests

```http
GET /v1/client/prompts/{prompt_id} HTTP/1.1
Host: api.promptops.com
Authorization: Bearer po_abc123def456ghi789jkl012
X-PromptOps-Signature: hmac_signature_here
X-PromptOps-Timestamp: 2024-01-01T12:00:00Z
Content-Type: application/json
```

#### Client Library Requests

```python
# Python client
async with PromptOpsClient(api_key="your-api-key") as client:
    prompt = await client.get_prompt("my-prompt", "v1.0")
```

```typescript
// TypeScript client
const content = await client.getPromptContent({
  promptId: 'my-prompt',
  version: '1.0.0',
  variables: { name: 'User' }
});
```

### Response Format

#### Success Response

```json
{
  "success": true,
  "data": {
    "id": "prompt-uuid",
    "name": "Customer Service Response",
    "content": "You are a helpful customer service assistant...",
    "variables": ["customer_name", "issue_type"],
    "target_models": ["openai", "anthropic"],
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  },
  "metadata": {
    "request_id": "req-abc123",
    "processing_time_ms": 45,
    "cache_hit": true
  }
}
```

#### Error Response

```json
{
  "success": false,
  "error": {
    "code": "PROMPT_NOT_FOUND",
    "message": "Prompt not found: my-prompt",
    "details": {
      "prompt_id": "my-prompt",
      "suggested_prompts": ["similar-prompt-1", "similar-prompt-2"]
    }
  },
  "metadata": {
    "request_id": "req-def456",
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

## 🔧 Common Use Cases

### 1. Basic Prompt Retrieval

```python
# Python
prompt = await client.get_prompt("customer-service-greeting")
```

```typescript
// TypeScript
const prompt = await client.getPrompt({
  promptId: 'customer-service-greeting'
});
```

### 2. Variable Substitution

```python
# Python
variables = PromptVariables({
    "customer_name": "John Doe",
    "issue_type": "billing"
})
rendered = await client.render_prompt(
    prompt_id="customer-response",
    variables=variables
)
```

```typescript
// TypeScript
const content = await client.getPromptContent({
  promptId: 'customer-response',
  variables: {
    customer_name: 'John Doe',
    issue_type: 'billing'
  }
});
```

### 3. Model-Specific Prompts

```python
# Python
rendered = await client.render_prompt(
    prompt_id="system-prompt",
    variables={"context": "customer-service"},
    model_provider=ModelProvider.OPENAI,
    model_name="gpt-4"
)
```

```typescript
// TypeScript
const content = await client.getPromptContent({
  promptId: 'system-prompt',
  variables: { context: 'customer-service' },
  modelProvider: 'openai',
  modelName: 'gpt-4'
});
```

### 4. Batch Operations

```python
# Python
prompts = await Promise.all([
    client.get_prompt("greeting"),
    client.get_prompt("farewell"),
    client.get_prompt("help-message")
])
```

```typescript
// TypeScript
const prompts = await Promise.all([
  client.getPrompt({ promptId: 'greeting' }),
  client.getPrompt({ promptId: 'farewell' }),
  client.getPrompt({ promptId: 'help-message' })
]);
```

## 📊 Versioning

### API Versioning

The PromptOps API uses URL versioning:

```
https://api.promptops.com/v1/  # Current version
https://api.promptops.com/v2/  # Future version
```

### Client Library Versioning

Client libraries follow semantic versioning:

- **Major versions** - Breaking changes
- **Minor versions** - New features, backward compatible
- **Patch versions** - Bug fixes, backward compatible

```bash
# Python
pip install promptops-client==1.2.3

# npm
npm install promptops-client@1.2.3
```

## 🔄 Migration Guide

### v1 to v2 Migration

When upgrading between major versions:

1. **Review Breaking Changes** - Check the changelog
2. **Update Dependencies** - Upgrade client libraries
3. **Test Thoroughly** - Validate all functionality
4. **Monitor Performance** - Check for performance impacts
5. **Rollback Plan** - Prepare for potential rollback

## 🚀 Next Steps

1. **Choose Your Client** - Select Python or JavaScript based on your stack
2. **Review API Reference** - Explore available endpoints and methods
3. **Check Authentication** - Set up proper authentication
4. **Try Examples** - Test with the provided examples
5. **Integrate** - Add PromptOps to your application

## 📚 Additional Resources

- [Getting Started](../getting-started/) - Quick start guides
- [Examples](../examples/) - Integration examples
- [Advanced Topics](../advanced-topics/) - Performance and security
- [Troubleshooting](../troubleshooting/) - Common issues and solutions

---

*Need API support? Check our [API status page](https://status.promptops.com) or [contact support](mailto:support@promptops.com)*