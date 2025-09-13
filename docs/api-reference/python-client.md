# Python Client API Reference

This document provides comprehensive reference documentation for the PromptOps Python client library.

## 📦 Installation

```bash
pip install promptops-client
```

## 🏗️ Core Classes

### PromptOpsClient

The main client class for interacting with PromptOps API.

#### Constructor

```python
class PromptOpsClient:
    def __init__(
        self,
        config: Union[ClientConfig, str, None] = None,
        base_url: Optional[str] = None,
        api_key: Optional[str] = None,
        timeout: Optional[float] = None,
        cache: Optional[CacheConfig] = None,
        telemetry: Optional[TelemetryConfig] = None
    )
```

**Parameters:**
- `config`: Client configuration object or API key string
- `base_url`: API base URL (default: `https://api.promptops.com/v1`)
- `api_key`: API key for authentication
- `timeout`: Request timeout in seconds (default: 30.0)
- `cache`: Cache configuration
- `telemetry`: Telemetry configuration

#### Context Manager

```python
async with PromptOpsClient(api_key="your-api-key") as client:
    # Client is automatically initialized and cleaned up
    prompt = await client.get_prompt("my-prompt")
```

## 🎯 Core Methods

### get_prompt

Retrieve prompt metadata and content.

```python
async def get_prompt(
    self,
    prompt_id: str,
    version: Optional[str] = None,
    use_cache: bool = True,
    project_id: Optional[str] = None
) -> PromptResponse
```

**Parameters:**
- `prompt_id`: Prompt identifier
- `version`: Prompt version (if None, gets latest)
- `use_cache`: Whether to use cache (default: True)
- `project_id`: Filter by project ID

**Returns:** `PromptResponse` object

**Example:**
```python
# Get latest version
prompt = await client.get_prompt("customer-service-greeting")

# Get specific version
prompt = await client.get_prompt("customer-service-greeting", "v1.2.0")

# Without cache
prompt = await client.get_prompt("dynamic-prompt", use_cache=False)
```

### render_prompt

Render a prompt with variable substitution.

```python
async def render_prompt(
    self,
    prompt_id: str,
    variables: Union[Dict[str, Any], PromptVariables],
    version: Optional[str] = None,
    model_provider: Optional[ModelProvider] = None,
    model_name: Optional[str] = None,
    use_cache: bool = True,
    project_id: Optional[str] = None
) -> RenderResponse
```

**Parameters:**
- `prompt_id`: Prompt identifier
- `variables`: Variables for substitution
- `version`: Prompt version
- `model_provider`: Target model provider
- `model_name`: Target model name
- `use_cache`: Whether to use cache
- `project_id`: Filter by project ID

**Returns:** `RenderResponse` object

**Example:**
```python
variables = PromptVariables({
    "customer_name": "John Doe",
    "issue_type": "billing",
    "priority": "high"
})

rendered = await client.render_prompt(
    prompt_id="customer-response",
    variables=variables,
    model_provider=ModelProvider.OPENAI,
    model_name="gpt-4"
)
```

### list_prompts

List available prompts with filtering.

```python
async def list_prompts(
    self,
    module_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    use_cache: bool = True,
    project_id: Optional[str] = None
) -> List[PromptResponse]
```

**Parameters:**
- `module_id`: Filter by module ID
- `skip`: Number of items to skip (pagination)
- `limit`: Maximum number of items to return
- `sort_by`: Field to sort by
- `sort_order`: Sort direction ("asc" or "desc")
- `use_cache`: Whether to use cache
- `project_id`: Filter by project ID

**Returns:** List of `PromptResponse` objects

**Example:**
```python
# List all prompts
prompts = await client.list_prompts()

# List by module with pagination
module_prompts = await client.list_prompts(
    module_id="customer-service",
    skip=0,
    limit=50
)

# Sort by name ascending
sorted_prompts = await client.list_prompts(
    sort_by="name",
    sort_order="asc"
)
```

### create_prompt

Create a new prompt.

```python
async def create_prompt(
    self,
    prompt_data: Dict[str, Any],
    project_id: Optional[str] = None
) -> PromptResponse
```

**Parameters:**
- `prompt_data`: Prompt creation data
- `project_id`: Project ID

**Returns:** `PromptResponse` object

**Example:**
```python
prompt_data = {
    "name": "Technical Support Response",
    "description": "Response template for technical issues",
    "content": "Hello {{customer_name}}! I understand you're having {{issue_type}}...",
    "variables": ["customer_name", "issue_type", "severity"],
    "target_models": ["openai", "anthropic"],
    "tags": ["technical", "support", "response"]
}

prompt = await client.create_prompt(prompt_data)
```

### update_prompt

Update an existing prompt.

```python
async def update_prompt(
    self,
    prompt_id: str,
    prompt_data: Dict[str, Any],
    version: Optional[str] = None,
    project_id: Optional[str] = None
) -> PromptResponse
```

**Parameters:**
- `prompt_id`: Prompt identifier
- `prompt_data`: Updated prompt data
- `version`: Version to update (if None, creates new version)
- `project_id`: Project ID

**Returns:** `PromptResponse` object

### delete_prompt

Delete a prompt or specific version.

```python
async def delete_prompt(
    self,
    prompt_id: str,
    version: Optional[str] = None,
    project_id: Optional[str] = None
) -> bool
```

**Parameters:**
- `prompt_id`: Prompt identifier
- `version`: Version to delete (if None, deletes all versions)
- `project_id`: Project ID

**Returns:** `True` if successful

### validate_prompt

Check if a prompt exists and is valid.

```python
async def validate_prompt(
    self,
    prompt_id: str,
    version: Optional[str] = None,
    project_id: Optional[str] = None
) -> bool
```

**Parameters:**
- `prompt_id`: Prompt identifier
- `version`: Version to validate
- `project_id`: Project ID

**Returns:** `True` if prompt is valid

## 🔄 Model and Compatibility Methods

### get_model_compatibility

Check if a prompt is compatible with a specific model.

```python
async def get_model_compatibility(
    self,
    prompt_id: str,
    model_provider: ModelProvider,
    model_name: str,
    version: Optional[str] = None,
    project_id: Optional[str] = None
) -> bool
```

**Parameters:**
- `prompt_id`: Prompt identifier
- `model_provider`: Model provider enum
- `model_name`: Model name
- `version`: Prompt version
- `project_id`: Project ID

**Returns:** `True` if compatible

**Example:**
```python
# Check GPT-4 compatibility
is_compatible = await client.get_model_compatibility(
    prompt_id="complex-prompt",
    model_provider=ModelProvider.OPENAI,
    model_name="gpt-4"
)

# Check Claude compatibility
is_compatible = await client.get_model_compatibility(
    prompt_id="complex-prompt",
    model_provider=ModelProvider.ANTHROPIC,
    model_name="claude-3-sonnet"
)
```

### list_models

List available models and their capabilities.

```python
async def list_models(
    self,
    provider: Optional[ModelProvider] = None,
    use_cache: bool = True
) -> List[ModelInfo]
```

**Parameters:**
- `provider`: Filter by provider
- `use_cache`: Whether to use cache

**Returns:** List of `ModelInfo` objects

## 📊 Monitoring and Statistics

### get_stats

Get client usage statistics.

```python
def get_stats(self) -> ClientStats
```

**Returns:** `ClientStats` object with:
- `total_requests`: Total number of requests
- `successful_requests`: Number of successful requests
- `failed_requests`: Number of failed requests
- `success_rate`: Success rate as float (0.0-1.0)
- `avg_response_time_ms`: Average response time in milliseconds
- `cache_hits`: Number of cache hits
- `cache_misses`: Number of cache misses
- `last_request_time`: Timestamp of last request

**Example:**
```python
stats = client.get_stats()
print(f"Total requests: {stats.total_requests}")
print(f"Success rate: {stats.success_rate:.2%}")
print(f"Average response time: {stats.avg_response_time_ms:.2f}ms")
```

### get_cache_stats

Get cache performance statistics.

```python
def get_cache_stats(self) -> CacheStats
```

**Returns:** `CacheStats` object with:
- `hit_rate`: Cache hit rate as float (0.0-1.0)
- `size`: Current cache size
- `max_size`: Maximum cache size
- `memory_usage`: Memory usage in bytes
- `hits`: Number of cache hits
- `misses`: Number of cache misses

**Example:**
```python
cache_stats = client.get_cache_stats()
print(f"Cache hit rate: {cache_stats.hit_rate:.2%}")
print(f"Cache size: {cache_stats.size}/{cache_stats.max_size}")
```

### clear_cache

Clear cache entries.

```python
async def clear_cache(
    self,
    prompt_id: Optional[str] = None,
    version: Optional[str] = None
) -> None
```

**Parameters:**
- `prompt_id`: Clear cache for specific prompt
- `version`: Clear cache for specific version

**Example:**
```python
# Clear all cache
await client.clear_cache()

# Clear specific prompt cache
await client.clear_cache("my-prompt")

# Clear specific version cache
await client.clear_cache("my-prompt", "v1.0")
```

## 📈 Telemetry Methods

### get_telemetry_summary

Get telemetry event summary.

```python
def get_telemetry_summary(self) -> TelemetrySummary
```

**Returns:** `TelemetrySummary` object with:
- `pending_events`: Number of pending events
- `enabled`: Whether telemetry is enabled
- `sample_rate`: Current sample rate
- `batch_size`: Current batch size

### flush_telemetry

Manually flush pending telemetry events.

```python
async def flush_telemetry(self) -> None
```

### disable_telemetry

Disable telemetry collection.

```python
def disable_telemetry(self) -> None
```

### enable_telemetry

Enable telemetry collection.

```python
def enable_telemetry(self, sample_rate: float = 0.1) -> None
```

**Parameters:**
- `sample_rate`: Sampling rate (0.0-1.0)

## 🔧 Configuration Methods

### update_config

Update client configuration at runtime.

```python
def update_config(self, config: Partial[ClientConfig]) -> None
```

**Parameters:**
- `config`: Configuration updates

**Example:**
```python
client.update_config({
    "timeout": 60.0,
    "cache": CacheConfig(level=CacheLevel.NONE),
    "telemetry": TelemetryConfig(enabled=False)
})
```

### get_config

Get current client configuration.

```python
def get_config(self) -> ClientConfig
```

**Returns:** Current `ClientConfig` object

## 🏥 Health Check

### health_check

Check client health and dependencies.

```python
async def health_check(self) -> HealthStatus
```

**Returns:** `HealthStatus` object with:
- `status`: Health status ("healthy", "degraded", "unhealthy")
- `timestamp`: Check timestamp
- `dependencies`: Status of dependencies (API, cache, telemetry)
- `errors`: List of errors if any

**Example:**
```python
health = await client.health_check()
print(f"Status: {health.status}")
print(f"Dependencies: {health.dependencies}")
if health.errors:
    print(f"Errors: {health.errors}")
```

## 📋 Data Models

### PromptResponse

```python
class PromptResponse:
    id: str                    # Prompt UUID
    name: str                  # Prompt name
    description: str           # Prompt description
    content: str               # Prompt content template
    variables: List[str]       # Variable names
    target_models: List[str]   # Target model providers
    model_specific_prompts: List[ModelSpecificPrompt]
    version: str               # Version string
    created_at: datetime       # Creation timestamp
    updated_at: datetime       # Last update timestamp
    tags: List[str]           # Prompt tags
    metadata: Dict[str, Any]  # Additional metadata
```

### RenderResponse

```python
class RenderResponse:
    prompt_id: str                    # Original prompt ID
    version: str                      # Prompt version used
    rendered_content: str             # Rendered prompt content
    messages: List[Dict[str, Any]]    # Formatted messages
    variables_used: List[str]         # Variables that were used
    processing_time_ms: float          # Rendering time
    cache_hit: bool                   # Whether cache was used
```

### PromptVariables

```python
class PromptVariables:
    def __init__(self, variables: Dict[str, Any])

    def add_variable(self, name: str, value: Any) -> None
    def get_variable(self, name: str) -> Any
    def has_variable(self, name: str) -> bool
    def to_dict(self) -> Dict[str, Any]
```

### ModelProvider

```python
class ModelProvider(Enum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GOOGLE = "google"
    COHERE = "cohere"
    HUGGINGFACE = "huggingface"
    LOCAL = "local"
```

### CacheLevel

```python
class CacheLevel(Enum):
    NONE = "none"
    MEMORY = "memory"
    REDIS = "redis"
    HYBRID = "hybrid"
```

## ⚠️ Exception Classes

### Base Exception

```python
class PromptOpsError(Exception):
    """Base exception for all PromptOps errors"""
    error_code: str
    message: str
    details: Dict[str, Any]
    retryable: bool
```

### Specific Exceptions

```python
class AuthenticationError(PromptOpsError):
    """Authentication failed"""
    pass

class AuthorizationError(PromptOpsError):
    """Insufficient permissions"""
    pass

class PromptNotFoundError(PromptOpsError):
    """Prompt not found"""
    prompt_id: str
    suggested_prompts: List[str]

class ValidationError(PromptOpsError):
    """Request validation failed"""
    validation_errors: List[Dict[str, Any]]

class NetworkError(PromptOpsError):
    """Network connectivity error"""
    original_error: Exception

class TimeoutError(PromptOpsError):
    """Request timeout"""
    timeout_duration: float

class RateLimitError(PromptOpsError):
    """Rate limit exceeded"""
    retry_after: int  # seconds

class ServerError(PromptOpsError):
    """Server-side error"""
    status_code: int

class CacheError(PromptOpsError):
    """Cache operation failed"""
    cache_type: str

class TelemetryError(PromptOpsError):
    """Telemetry operation failed"""
    pass
```

## 🔄 Context Manager

The client supports async context manager usage for proper resource management:

```python
async with PromptOpsClient(api_key="your-api-key") as client:
    # Client is automatically initialized
    try:
        prompt = await client.get_prompt("my-prompt")
        # Use prompt...
    finally:
        # Client is automatically cleaned up
        pass
```

## 📝 Best Practices

### 1. Use Context Managers

```python
# Good - automatic cleanup
async with PromptOpsClient(api_key="key") as client:
    prompts = await client.list_prompts()

# Bad - manual cleanup needed
client = PromptOpsClient(api_key="key")
await client.initialize()
try:
    prompts = await client.list_prompts()
finally:
    await client.shutdown()
```

### 2. Handle Errors Gracefully

```python
try:
    prompt = await client.get_prompt("my-prompt")
except PromptNotFoundError:
    # Handle missing prompt
    prompt = await get_fallback_prompt()
except AuthenticationError:
    # Re-authenticate
    await refresh_api_key()
except RateLimitError as e:
    # Wait and retry
    await asyncio.sleep(e.retry_after)
except Exception as e:
    # Log and handle unexpected errors
    logger.error(f"Unexpected error: {e}")
```

### 3. Use Caching Wisely

```python
# Enable caching for frequently accessed prompts
cache_config = CacheConfig(
    level=CacheLevel.MEMORY,
    ttl=300,  # 5 minutes
    max_size=1000
)

# Disable caching for dynamic prompts
dynamic_prompt = await client.get_prompt(
    "dynamic-prompt",
    use_cache=False
)
```

### 4. Monitor Performance

```python
# Regularly check performance metrics
stats = client.get_stats()
if stats.success_rate < 0.95:
    logger.warning(f"Low success rate: {stats.success_rate:.2%}")

cache_stats = client.get_cache_stats()
if cache_stats.hit_rate < 0.8:
    logger.info(f"Consider adjusting cache strategy")
```

---

*For more examples, see the [Python examples](../examples/python.md) section.*