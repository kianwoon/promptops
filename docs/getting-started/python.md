# Python Client Quick Start

This guide will help you get started with the PromptOps Python client library quickly and efficiently.

## 🚀 Installation

### Basic Installation

```bash
pip install promptops-client
```

### With Optional Features

```bash
# For Redis caching support
pip install promptops-client[redis]

# For OpenTelemetry integration
pip install promptops-client[otel]

# For all optional features
pip install promptops-client[all]

# For development
pip install promptops-client[dev]
```

## 🔑 Setup

### Environment Variables

Create a `.env` file or set environment variables:

```bash
# Required
PROMPTOPS_API_KEY=po_your_api_key_here
PROMPTOPS_SECRET_KEY=your_secret_key_here
PROMPTOPS_BASE_URL=https://api.promptops.com/v1

# Optional - Redis for caching
REDIS_URL=redis://localhost:6379

# Optional - Telemetry
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

### Basic Configuration

```python
import asyncio
import os
from promptops import PromptOpsClient, PromptVariables, ModelProvider

async def main():
    # Initialize client
    async with PromptOpsClient(
        base_url="https://api.promptops.com/v1",
        api_key=os.environ.get("PROMPTOPS_API_KEY"),
        timeout=30.0
    ) as client:
        # Your code here
        pass

if __name__ == "__main__":
    asyncio.run(main())
```

## 🎯 Quick Examples

### Basic Prompt Retrieval

```python
import asyncio
from promptops import PromptOpsClient

async def basic_example():
    async with PromptOpsClient(
        api_key="your-api-key"
    ) as client:
        # Get a prompt
        prompt = await client.get_prompt("hello-world", "v1.0")
        print(f"Prompt: {prompt.name}")
        print(f"Content: {prompt.content}")
        print(f"Target models: {prompt.target_models}")

asyncio.run(basic_example())
```

### Variable Substitution

```python
from promptops import PromptVariables

async def variables_example():
    async with PromptOpsClient(api_key="your-api-key") as client:
        # Create variables
        variables = PromptVariables(variables={
            "name": "John Doe",
            "company": "Tech Corp",
            "task": "Write a summary",
            "user": {
                "role": "Developer",
                "department": "Engineering"
            }
        })

        # Render prompt with variables
        rendered = await client.render_prompt(
            prompt_id="welcome-message",
            variables=variables,
            version="v1.0"
        )

        print(f"Rendered: {rendered.rendered_content}")
        print(f"Messages: {rendered.messages}")

asyncio.run(variables_example())
```

### Model-Specific Prompts

```python
from promptops import ModelProvider

async def model_specific_example():
    async with PromptOpsClient(api_key="your-api-key") as client:
        # Get OpenAI-specific prompt
        rendered = await client.render_prompt(
            prompt_id="system-prompt",
            variables=PromptVariables({"context": "customer-service"}),
            model_provider=ModelProvider.OPENAI,
            model_name="gpt-4"
        )

        print(f"OpenAI GPT-4 prompt: {rendered.rendered_content}")

        # Get Anthropic-specific prompt
        rendered_anthropic = await client.render_prompt(
            prompt_id="system-prompt",
            variables=PromptVariables({"context": "customer-service"}),
            model_provider=ModelProvider.ANTHROPIC,
            model_name="claude-3-sonnet"
        )

        print(f"Anthropic Claude prompt: {rendered_anthropic.rendered_content}")

asyncio.run(model_specific_example())
```

### List and Search Prompts

```python
async def search_example():
    async with PromptOpsClient(api_key="your-api-key") as client:
        # List all prompts
        prompts = await client.list_prompts(limit=10)
        print(f"Found {len(prompts)} prompts")

        # List prompts by module
        module_prompts = await client.list_prompts(
            module_id="customer-service",
            limit=20
        )
        print(f"Customer service prompts: {len(module_prompts)}")

        # Get prompt with pagination
        page1 = await client.list_prompts(skip=0, limit=50)
        page2 = await client.list_prompts(skip=50, limit=50)
        print(f"Total prompts: {len(page1) + len(page2)}")

asyncio.run(search_example())
```

## 📊 Configuration Options

### Advanced Configuration

```python
from promptops import (
    PromptOpsClient,
    ClientConfig,
    CacheConfig,
    TelemetryConfig,
    CacheLevel
)

async def advanced_config_example():
    config = ClientConfig(
        base_url="https://api.promptops.com/v1",
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

    async with PromptOpsClient(config) as client:
        # Use client with advanced configuration
        prompt = await client.get_prompt("advanced-prompt")
        print(f"Advanced prompt: {prompt.name}")

asyncio.run(advanced_config_example())
```

### Error Handling

```python
from promptops.exceptions import (
    AuthenticationError,
    PromptNotFoundError,
    ValidationError,
    NetworkError,
    ServerError,
    RateLimitError
)

async def error_handling_example():
    async with PromptOpsClient(api_key="your-api-key") as client:
        try:
            prompt = await client.get_prompt("nonexistent-prompt")
        except PromptNotFoundError:
            print("Prompt not found")
        except AuthenticationError:
            print("Authentication failed - check API key")
        except ValidationError as e:
            print(f"Validation error: {e.details}")
        except RateLimitError:
            print("Rate limit exceeded")
        except NetworkError:
            print("Network error occurred")
        except ServerError:
            print("Server error occurred")
        except Exception as e:
            print(f"Unexpected error: {e}")

asyncio.run(error_handling_example())
```

## 🔄 Context Manager Usage

```python
async def context_manager_example():
    """Proper resource management with async context manager"""
    async with PromptOpsClient(api_key="your-api-key") as client:
        # Client is automatically initialized and cleaned up
        prompts = await client.list_prompts()

        for prompt in prompts[:5]:  # First 5 prompts
            try:
                rendered = await client.render_prompt(
                    prompt_id=prompt.id,
                    variables=PromptVariables({"test": "value"})
                )
                print(f"✓ {prompt.name}: {len(rendered.rendered_content)} chars")
            except Exception as e:
                print(f"✗ {prompt.name}: {e}")

    # Client is automatically closed and resources cleaned up
    print("Client closed successfully")

asyncio.run(context_manager_example())
```

## 📈 Monitoring and Analytics

```python
async def monitoring_example():
    async with PromptOpsClient(api_key="your-api-key") as client:
        # Get cache statistics
        cache_stats = client.get_cache_stats()
        print(f"Cache hit rate: {cache_stats['hit_rate']:.2%}")
        print(f"Cache size: {cache_stats['size']}")
        print(f"Memory usage: {cache_stats['memory_usage']}")

        # Get client statistics
        stats = client.get_stats()
        print(f"Total requests: {stats.total_requests}")
        print(f"Success rate: {stats.success_rate:.2%}")
        print(f"Average response time: {stats.avg_response_time_ms:.2f}ms")

        # Get telemetry summary
        telemetry = client.get_telemetry_summary()
        print(f"Pending events: {telemetry['pending_events']}")
        print(f"Telemetry enabled: {telemetry['enabled']}")

        # Manually flush telemetry
        await client.flush_telemetry()
        print("Telemetry flushed")

asyncio.run(monitoring_example())
```

## 🧪 Testing Your Setup

```python
import pytest
from unittest.mock import AsyncMock, patch
from promptops import PromptOpsClient

@pytest.mark.asyncio
async def test_prompt_retrieval():
    """Test basic prompt retrieval"""
    async with PromptOpsClient(api_key="test-key") as client:
        # Mock the API call
        with patch.object(client, 'get_prompt', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = type('Prompt', (), {
                'id': 'test-prompt',
                'name': 'Test Prompt',
                'content': 'Hello {{name}}!'
            })()

            prompt = await client.get_prompt("test-prompt")
            assert prompt.name == "Test Prompt"
            assert "Hello" in prompt.content

# Run tests: pytest test_your_file.py -v
```

## 🚀 Next Steps

1. **Explore Caching** - Learn about memory, Redis, and hybrid caching strategies
2. **Integrate with Your App** - Add PromptOps to your Flask, FastAPI, or Django app
3. **Monitor Performance** - Set up telemetry and monitoring
4. **Optimize Usage** - Learn about batching, retries, and performance optimization
5. **Production Deployment** - Configure for production environments

## 📚 Additional Resources

- [API Reference](../api-reference/python-client.md) - Complete Python client API
- [Examples](../examples/python.md) - More Python integration examples
- [Advanced Topics](../advanced-topics/) - Caching, performance, and security
- [Troubleshooting](../troubleshooting/) - Common issues and solutions

---

*Having trouble? Check our [troubleshooting guide](../troubleshooting/) or [ask for help](https://community.promptops.com)*