"""
Advanced usage example for PromptOps client library
"""

import asyncio
import os
from promptops import (
    PromptOpsClient,
    ClientConfig,
    CacheConfig,
    TelemetryConfig,
    PromptVariables,
    ModelProvider,
    CacheLevel
)

async def advanced_usage_example():
    """Advanced usage example with custom configuration"""
    # Create custom configuration
    config = ClientConfig(
        base_url="https://api.promptops.ai",
        api_key=os.environ.get("PROMPTOPS_API_KEY", "your-api-key-here"),
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
        try:
            # Test connection
            is_connected = await client.test_connection()
            print(f"Connected to PromptOps API: {is_connected}")

            # Create a new prompt
            prompt_data = {
                "id": "advanced-example-prompt",
                "version": "v1.0",
                "module_id": "example-module",
                "name": "Advanced Example Prompt",
                "description": "A prompt demonstrating advanced features",
                "target_models": ["openai", "anthropic"],
                "model_specific_prompts": [
                    {
                        "model_provider": "openai",
                        "model_name": "gpt-4",
                        "content": "Hello {user_name}, please {task} for me.",
                        "instructions": "Be helpful and concise"
                    },
                    {
                        "model_provider": "anthropic",
                        "model_name": "claude-3-opus",
                        "content": "Hello {user_name}, I'd like you to {task}.",
                        "instructions": "Provide detailed responses"
                    }
                ],
                "mas_intent": "User assistance",
                "mas_fairness_notes": "Treat all users equally",
                "mas_risk_level": "low"
            }

            created_prompt = await client.create_prompt(prompt_data)
            print(f"Created prompt: {created_prompt.name}")

            # Render with different model providers
            variables = PromptVariables(variables={
                "user_name": "Alice Johnson",
                "task": "analyze this code"
            })

            # Render for OpenAI
            openai_rendered = await client.render_prompt(
                prompt_id="advanced-example-prompt",
                variables=variables,
                version="v1.0",
                model_provider=ModelProvider.OPENAI,
                model_name="gpt-4"
            )
            print(f"OpenAI rendered: {openai_rendered.rendered_content[:100]}...")

            # Render for Anthropic
            anthropic_rendered = await client.render_prompt(
                prompt_id="advanced-example-prompt",
                variables=variables,
                version="v1.0",
                model_provider=ModelProvider.ANTHROPIC,
                model_name="claude-3-opus"
            )
            print(f"Anthropic rendered: {anthropic_rendered.rendered_content[:100]}...")

            # Monitor performance
            stats = client.get_stats()
            print(f"Total requests: {stats.total_requests}")
            print(f"Average response time: {stats.average_response_time:.3f}s")
            print(f"Cache hit rate: {stats.cache_stats.hit_rate:.2%}")

            # Get telemetry summary
            telemetry_summary = client.get_telemetry_summary()
            print(f"Telemetry events: {telemetry_summary['pending_events']}")

            # Clean up - delete the test prompt
            await client.delete_prompt("advanced-example-prompt", "v1.0")
            print("Test prompt deleted")

        except Exception as e:
            print(f"Error: {e}")

async def caching_example():
    """Example demonstrating caching behavior"""
    config = ClientConfig(
        base_url="https://api.promptops.ai",
        api_key=os.environ.get("PROMPTOPS_API_KEY", "your-api-key-here"),
        cache=CacheConfig(
            level=CacheLevel.MEMORY,
            ttl=300,  # 5 minutes
            max_size=100
        )
    )

    async with PromptOpsClient(config) as client:
        # First call - should be a cache miss
        print("First call (cache miss):")
        prompt1 = await client.get_prompt("example-prompt", "v1.0")
        cache_stats = client.get_cache_stats()
        print(f"Cache stats: {cache_stats}")

        # Second call - should be a cache hit
        print("\nSecond call (cache hit):")
        prompt2 = await client.get_prompt("example-prompt", "v1.0")
        cache_stats = client.get_cache_stats()
        print(f"Cache stats: {cache_stats}")

        # Clear cache
        print("\nClearing cache:")
        client.clear_cache()
        cache_stats = client.get_cache_stats()
        print(f"Cache stats: {cache_stats}")

async def error_handling_example():
    """Example demonstrating error handling"""
    async with PromptOpsClient(
        base_url="https://api.promptops.ai",
        api_key="invalid-api-key"
    ) as client:
        try:
            # This should fail with authentication error
            await client.get_prompt("nonexistent-prompt")
        except Exception as e:
            print(f"Expected error: {type(e).__name__}: {e}")

if __name__ == "__main__":
    print("=== Advanced Usage Example ===")
    asyncio.run(advanced_usage_example())

    print("\n=== Caching Example ===")
    asyncio.run(caching_example())

    print("\n=== Error Handling Example ===")
    asyncio.run(error_handling_example())