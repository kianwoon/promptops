"""
Example showing proper context manager usage
"""

import asyncio
import os
from promptops import PromptOpsClient, PromptVariables, ModelProvider

async def context_manager_example():
    """Example using async context manager"""
    # Using async context manager (recommended)
    async with PromptOpsClient(
        base_url="https://api.promptops.ai",
        api_key=os.environ.get("PROMPTOPS_API_KEY", "your-api-key-here")
    ) as client:
        try:
            # Client is automatically initialized and will be closed
            prompt = await client.get_prompt("example-prompt")
            print(f"Got prompt: {prompt.name}")

            variables = PromptVariables(variables={"topic": "artificial intelligence"})
            rendered = await client.render_prompt("example-prompt", variables)
            print(f"Rendered: {rendered.rendered_content}")

        except Exception as e:
            print(f"Error: {e}")

async def manual_lifecycle_example():
    """Example showing manual lifecycle management"""
    client = PromptOpsClient(
        base_url="https://api.promptops.ai",
        api_key=os.environ.get("PROMPTOPS_API_KEY", "your-api-key-here")
    )

    try:
        # Initialize manually
        await client.initialize()

        # Use the client
        prompt = await client.get_prompt("example-prompt")
        print(f"Got prompt: {prompt.name}")

        # Get statistics
        stats = client.get_stats()
        print(f"Stats: {stats}")

    finally:
        # Always close the client
        await client.close()

async def batch_processing_example():
    """Example showing batch processing"""
    async with PromptOpsClient(
        base_url="https://api.promptops.ai",
        api_key=os.environ.get("PROMPTOPS_API_KEY", "your-api-key-here")
    ) as client:
        # List of prompts to process
        prompt_ids = ["prompt1", "prompt2", "prompt3"]
        results = []

        for prompt_id in prompt_ids:
            try:
                prompt = await client.get_prompt(prompt_id)
                results.append(prompt)
                print(f"Processed: {prompt.name}")
            except Exception as e:
                print(f"Failed to process {prompt_id}: {e}")

        print(f"Successfully processed {len(results)} prompts")

if __name__ == "__main__":
    print("=== Context Manager Example ===")
    asyncio.run(context_manager_example())

    print("\n=== Manual Lifecycle Example ===")
    asyncio.run(manual_lifecycle_example())

    print("\n=== Batch Processing Example ===")
    asyncio.run(batch_processing_example())