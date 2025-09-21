"""
Locust load testing script for PromptOps Python client
"""

import asyncio
import json
import time
from locust import HttpUser, task, between
from typing import Dict, Any
import random

from promptops import PromptOpsClient, ClientConfig, PromptVariables
from promptops.exceptions import PromptOpsError


class PromptOpsUser(HttpUser):
    """Simulated user for load testing PromptOps API"""

    wait_time = between(1, 5)  # Wait 1-5 seconds between tasks

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.client = None
        self.config = ClientConfig(
            base_url="http://localhost:8000",
            api_key=f"load-test-key-{random.randint(1, 1000)}",
            timeout=30.0,
            enable_cache=True,
            enable_telemetry=False
        )

    def on_start(self):
        """Initialize client when user starts"""
        try:
            self.client = PromptOpsClient(self.config)
            # Use asyncio.run in tests
            asyncio.run(self.client.initialize())
        except Exception as e:
            print(f"Failed to initialize client: {e}")
            self.client = None

    def on_stop(self):
        """Clean up client when user stops"""
        if self.client:
            try:
                asyncio.run(self.client.close())
            except Exception:
                pass

    @task(3)
    def get_single_prompt(self):
        """Task: Get a single prompt"""
        if not self.client:
            return

        prompt_id = f"load-test-prompt-{random.randint(1, 100)}"

        start_time = time.time()
        try:
            # Simulate API call
            response = self.client.get_prompt(prompt_id, "latest")
            total_time = (time.time() - start_time) * 1000

            self.environment.events.request.fire(
                request_type="GET",
                name="/prompts/[prompt_id]/[version]",
                response_time=total_time,
                response_length=len(str(response)),
                response_ms=total_time,
                context=None,
                exception=None
            )
        except Exception as e:
            total_time = (time.time() - start_time) * 1000
            self.environment.events.request.fire(
                request_type="GET",
                name="/prompts/[prompt_id]/[version]",
                response_time=total_time,
                response_length=0,
                response_ms=total_time,
                context=None,
                exception=e
            )

    @task(2)
    def render_prompt(self):
        """Task: Render a prompt with variables"""
        if not self.client:
            return

        prompt_id = f"render-prompt-{random.randint(1, 50)}"
        variables = PromptVariables(variables={
            "name": f"User-{random.randint(1, 1000)}",
            "framework": random.choice(["Python", "JavaScript", "TypeScript", "Java"]),
            "version": f"{random.randint(1, 5)}.{random.randint(0, 9)}.{random.randint(0, 9)}",
            "timestamp": str(int(time.time()))
        })

        start_time = time.time()
        try:
            response = self.client.render_prompt(prompt_id, variables)
            total_time = (time.time() - start_time) * 1000

            self.environment.events.request.fire(
                request_type="POST",
                name="/render",
                response_time=total_time,
                response_length=len(str(response)),
                response_ms=total_time,
                context=None,
                exception=None
            )
        except Exception as e:
            total_time = (time.time() - start_time) * 1000
            self.environment.events.request.fire(
                request_type="POST",
                name="/render",
                response_time=total_time,
                response_length=0,
                response_ms=total_time,
                context=None,
                exception=e
            )

    @task(1)
    def list_prompts(self):
        """Task: List prompts"""
        if not self.client:
            return

        module_id = f"module-{random.randint(1, 10)}"
        limit = random.choice([10, 25, 50, 100])

        start_time = time.time()
        try:
            response = self.client.list_prompts(module_id, limit)
            total_time = (time.time() - start_time) * 1000

            self.environment.events.request.fire(
                request_type="GET",
                name="/prompts",
                response_time=total_time,
                response_length=len(str(response)),
                response_ms=total_time,
                context=None,
                exception=None
            )
        except Exception as e:
            total_time = (time.time() - start_time) * 1000
            self.environment.events.request.fire(
                request_type="GET",
                name="/prompts",
                response_time=total_time,
                response_length=0,
                response_ms=total_time,
                context=None,
                exception=e
            )

    @task(1)
    def validate_prompt(self):
        """Task: Validate prompt"""
        if not self.client:
            return

        prompt_id = f"validate-prompt-{random.randint(1, 50)}"

        start_time = time.time()
        try:
            response = self.client.validate_prompt(prompt_id, "latest")
            total_time = (time.time() - start_time) * 1000

            self.environment.events.request.fire(
                request_type="GET",
                name="/prompts/[prompt_id]/validate",
                response_time=total_time,
                response_length=len(str(response)),
                response_ms=total_time,
                context=None,
                exception=None
            )
        except Exception as e:
            total_time = (time.time() - start_time) * 1000
            self.environment.events.request.fire(
                request_type="GET",
                name="/prompts/[prompt_id]/validate",
                response_time=total_time,
                response_length=0,
                response_ms=total_time,
                context=None,
                exception=e
            )

    @task(1)
    def check_compatibility(self):
        """Task: Check model compatibility"""
        if not self.client:
            return

        prompt_id = f"compat-prompt-{random.randint(1, 25)}"
        model_provider = random.choice(["openai", "anthropic", "google"])
        model_name = random.choice([
            "gpt-4", "gpt-3.5-turbo",
            "claude-3-sonnet", "claude-3-opus",
            "gemini-pro", "gemini-ultra"
        ])

        start_time = time.time()
        try:
            response = self.client.getModelCompatibility(prompt_id, model_provider, model_name)
            total_time = (time.time() - start_time) * 1000

            self.environment.events.request.fire(
                request_type="GET",
                name="/prompts/[prompt_id]/compatibility",
                response_time=total_time,
                response_length=len(str(response)),
                response_ms=total_time,
                context=None,
                exception=None
            )
        except Exception as e:
            total_time = (time.time() - start_time) * 1000
            self.environment.events.request.fire(
                request_type="GET",
                name="/prompts/[prompt_id]/compatibility",
                response_time=total_time,
                response_length=0,
                response_ms=total_time,
                context=None,
                exception=e
            )

    @task(1)
    def health_check(self):
        """Task: Health check"""
        if not self.client:
            return

        start_time = time.time()
        try:
            response = self.client.healthCheck()
            total_time = (time.time() - start_time) * 1000

            self.environment.events.request.fire(
                request_type="GET",
                name="/health",
                response_time=total_time,
                response_length=len(str(response)),
                response_ms=total_time,
                context=None,
                exception=None
            )
        except Exception as e:
            total_time = (time.time() - start_time) * 1000
            self.environment.events.request.fire(
                request_type="GET",
                name="/health",
                response_time=total_time,
                response_length=0,
                response_ms=total_time,
                context=None,
                exception=e
            )