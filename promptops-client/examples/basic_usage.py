"""
Basic usage example for PromptOps client library
"""

import asyncio
import os
from promptops import PromptOpsClient, PromptVariables, ModelProvider

async def basic_usage_example():
    """Basic usage example"""
    # Initialize client
    async with PromptOpsClient(
        base_url="https://api.promptops.ai",
        api_key=os.environ.get("PROMPTOPS_API_KEY", "your-api-key-here"),
        timeout=30.0
    ) as client:
        try:
            # Get a prompt
            prompt = await client.get_prompt("my-prompt-id", "v1.0")
            print(f"Retrieved prompt: {prompt.name}")

            # Render prompt with variables
            variables = PromptVariables(variables={
                "user_name": "John Doe",
                "task": "Write a summary"
            })

            rendered = await client.render_prompt(
                prompt_id="my-prompt-id",
                variables=variables,
                version="v1.0",
                model_provider=ModelProvider.OPENAI
            )

            print(f"Rendered content: {rendered.rendered_content}")
            print(f"Messages: {rendered.messages}")

            # List all prompts
            prompts = await client.list_prompts(limit=10)
            print(f"Found {len(prompts)} prompts")

            # Get cache statistics
            cache_stats = client.get_cache_stats()
            print(f"Cache stats: {cache_stats}")

            # Get client statistics
            stats = client.get_stats()
            print(f"Total requests: {stats.total_requests}")
            print(f"Success rate: {stats.success_rate:.2%}")

        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(basic_usage_example())