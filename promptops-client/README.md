# PromptOps Python Client Library

A comprehensive Python client library for interacting with the PromptOps API. This library provides async support, multi-level caching, telemetry tracking, and robust error handling.

## Features

- **Async/await support** - Full async/await support for high-performance applications
- **Multi-level caching** - Memory, Redis, and hybrid caching with TTL support
- **Telemetry & analytics** - Built-in usage tracking and performance monitoring
- **Model-specific prompts** - Support for different AI model providers and versions
- **Variable substitution** - Dynamic prompt rendering with variable substitution
- **Retry logic** - Exponential backoff retry for network operations
- **Comprehensive error handling** - Custom exceptions for all error scenarios
- **Type hints** - Full type annotation support
- **Context managers** - Proper resource management with async context managers

## Installation

```bash
pip install promptops-client
```

For optional features:

```bash
# For Redis caching
pip install promptops-client[redis]

# For OpenTelemetry integration
pip install promptops-client[otel]

# For all optional features
pip install promptops-client[all]
```

## Quick Start

```python
import asyncio
from promptops import PromptOpsClient, PromptVariables, ModelProvider

async def main():
    # Initialize client
    async with PromptOpsClient(
        base_url="https://api.promptops.ai",
        api_key="your-api-key-here"
    ) as client:
        # Get a prompt
        prompt = await client.get_prompt("my-prompt-id", "v1.0")

        # Render with variables
        variables = PromptVariables(variables={
            "user_name": "John Doe",
            "task": "Write a summary"
        })

        rendered = await client.render_prompt(
            prompt_id="my-prompt-id",
            variables=variables,
            model_provider=ModelProvider.OPENAI
        )

        print(f"Rendered: {rendered.rendered_content}")

if __name__ == "__main__":
    asyncio.run(main())
```

## Configuration

### Basic Configuration

```python
from promptops import PromptOpsClient, ClientConfig

config = ClientConfig(
    base_url="https://api.promptops.ai",
    api_key="your-api-key",
    timeout=30.0
)

client = PromptOpsClient(config)
```

### Advanced Configuration

```python
from promptops import (
    PromptOpsClient,
    ClientConfig,
    CacheConfig,
    TelemetryConfig,
    CacheLevel
)

config = ClientConfig(
    base_url="https://api.promptops.ai",
    api_key="your-api-key",
    timeout=60.0,
    cache=CacheConfig(
        level=CacheLevel.HYBRID,
        ttl=600,  # 10 minutes
        max_size=2000,
        redis_url="redis://localhost:6379"
    ),
    telemetry=TelemetryConfig(
        enabled=True,
        sample_rate=0.1,  # 10% sampling
        batch_size=50,
        flush_interval=60.0
    )
)

client = PromptOpsClient(config)
```

## API Reference

### PromptOpsClient

Main client class for interacting with PromptOps API.

#### Methods

##### `async get_prompt(prompt_id: str, version: Optional[str] = None, use_cache: bool = True) -> PromptResponse`

Get a prompt by ID and version.

**Parameters:**
- `prompt_id`: Prompt identifier
- `version`: Prompt version (if None, gets latest)
- `use_cache`: Whether to use cache

**Returns:** `PromptResponse`

##### `async render_prompt(prompt_id: str, variables: Union[Dict[str, Any], PromptVariables], version: Optional[str] = None, model_provider: Optional[ModelProvider] = None, model_name: Optional[str] = None, use_cache: bool = True) -> RenderResponse`

Render a prompt with variables.

**Parameters:**
- `prompt_id`: Prompt identifier
- `variables`: Variables for substitution
- `version`: Prompt version
- `model_provider`: Target model provider
- `model_name`: Target model name
- `use_cache`: Whether to use cache

**Returns:** `RenderResponse`

##### `async list_prompts(module_id: Optional[str] = None, skip: int = 0, limit: int = 100, use_cache: bool = True) -> List[PromptResponse]`

List prompts with optional filtering.

**Parameters:**
- `module_id`: Filter by module ID
- `skip`: Number of items to skip
- `limit`: Maximum number of items
- `use_cache`: Whether to use cache

**Returns:** List of `PromptResponse`

##### `async create_prompt(prompt_data: Dict[str, Any]) -> PromptResponse`

Create a new prompt.

**Parameters:**
- `prompt_data`: Prompt creation data

**Returns:** `PromptResponse`

##### `async delete_prompt(prompt_id: str, version: str) -> bool`

Delete a prompt version.

**Parameters:**
- `prompt_id`: Prompt identifier
- `version`: Prompt version

**Returns:** `True` if successful

### Data Models

#### `PromptVariables`

Container for prompt variables.

```python
variables = PromptVariables(variables={
    "name": "John",
    "task": "Write code"
})
```

#### `ModelProvider`

Supported model providers:

- `ModelProvider.OPENAI`
- `ModelProvider.ANTHROPIC`
- `ModelProvider.GOOGLE`
- `ModelProvider.COHERE`
- `ModelProvider.HUGGINGFACE`
- `ModelProvider.LOCAL`

#### `CacheLevel`

Cache levels:

- `CacheLevel.NONE` - No caching
- `CacheLevel.MEMORY` - In-memory caching
- `CacheLevel.REDIS` - Redis caching
- `CacheLevel.HYBRID` - Hybrid memory + Redis caching

### Error Handling

The library provides specific exceptions for different error scenarios:

```python
from promptops.exceptions import (
    AuthenticationError,
    PromptNotFoundError,
    ValidationError,
    NetworkError,
    ServerError
)

try:
    prompt = await client.get_prompt("nonexistent-prompt")
except PromptNotFoundError:
    print("Prompt not found")
except AuthenticationError:
    print("Authentication failed")
except NetworkError:
    print("Network error occurred")
```

## Caching

The client supports multi-level caching for improved performance:

### Memory Caching

```python
from promptops import CacheConfig, CacheLevel

config = ClientConfig(
    base_url="https://api.promptops.ai",
    api_key="your-api-key",
    cache=CacheConfig(
        level=CacheLevel.MEMORY,
        ttl=300,  # 5 minutes
        max_size=1000
    )
)
```

### Redis Caching

```python
config = ClientConfig(
    base_url="https://api.promptops.ai",
    api_key="your-api-key",
    cache=CacheConfig(
        level=CacheLevel.REDIS,
        ttl=600,  # 10 minutes
        redis_url="redis://localhost:6379"
    )
)
```

### Cache Statistics

```python
# Get cache statistics
stats = client.get_cache_stats()
print(f"Cache hit rate: {stats['hit_rate']:.2%}")
print(f"Cache size: {stats['size']}")

# Clear cache
client.clear_cache()
```

## Telemetry

The client includes built-in telemetry for usage tracking:

```python
# Get telemetry summary
summary = client.get_telemetry_summary()
print(f"Pending events: {summary['pending_events']}")

# Flush telemetry events
client.flush_telemetry()

# Disable telemetry
client.disable_telemetry()
```

## Examples

See the `examples/` directory for comprehensive usage examples:

- `basic_usage.py` - Basic prompt operations
- `advanced_usage.py` - Advanced features and configuration
- `context_manager.py` - Proper resource management

## Testing

Run tests with pytest:

```bash
# Install test dependencies
pip install promptops-client[dev]

# Run tests
pytest

# Run with coverage
pytest --cov=promptops

# Run specific test file
pytest promptops/tests/test_client.py
```

## Development

### Setting up development environment

```bash
# Clone repository
git clone https://github.com/promptops/promptops-client.git
cd promptops-client

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install in development mode
pip install -e ".[dev]"

# Install pre-commit hooks
pre-commit install
```

### Running tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=promptops --cov-report=html

# Run linting
black .
isort .
flake8 .
mypy promptops
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- Documentation: [https://promptops-client.readthedocs.io/](https://promptops-client.readthedocs.io/)
- Issues: [https://github.com/promptops/promptops-client/issues](https://github.com/promptops/promptops-client/issues)
- Email: support@promptops.ai

## Changelog

### v1.0.0 (2024-01-01)

- Initial release
- Async/await support
- Multi-level caching
- Telemetry tracking
- Comprehensive error handling
- Full test coverage