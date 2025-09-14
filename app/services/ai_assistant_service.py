import asyncio
import time
import json
import httpx
from typing import Dict, Any, List, Optional, Union
from abc import ABC, abstractmethod
import structlog
from datetime import datetime
import hashlib

logger = structlog.get_logger()

class AIAssistantProviderType:
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GEMINI = "gemini"
    QWEN = "qwen"
    OPENROUTER = "openrouter"
    OLLAMA = "ollama"

class AIAssistantProviderInterface(ABC):
    """Abstract base class for AI Assistant providers"""

    @abstractmethod
    async def test_connection(self) -> Dict[str, Any]:
        """Test connection to the provider"""
        pass

    @abstractmethod
    async def generate_prompt(self, context: Dict[str, Any], system_prompt: str) -> Dict[str, Any]:
        """Generate a prompt based on context and system prompt"""
        pass

    @abstractmethod
    async def chat(self, messages: List[Dict[str, str]], system_prompt: Optional[str] = None) -> Dict[str, Any]:
        """Have a conversation with the AI"""
        pass

    @abstractmethod
    def get_provider_name(self) -> str:
        """Get the provider name"""
        pass

class OpenAIAssistantProvider(AIAssistantProviderInterface):
    """OpenAI Assistant Provider"""

    def __init__(self, api_key: str, api_base_url: Optional[str] = None, model_name: Optional[str] = None):
        self.api_key = api_key
        self.api_base_url = api_base_url or "https://api.openai.com/v1"
        self.model_name = model_name or "gpt-4o"
        self.client = httpx.AsyncClient(timeout=30.0)

    async def test_connection(self) -> Dict[str, Any]:
        """Test connection to OpenAI"""
        start_time = time.time()
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }

            response = await self.client.post(
                f"{self.api_base_url}/chat/completions",
                headers=headers,
                json={
                    "model": self.model_name,
                    "messages": [{"role": "user", "content": "Hello"}],
                    "max_tokens": 10
                }
            )

            response_time = int((time.time() - start_time) * 1000)

            if response.status_code == 200:
                result = response.json()
                return {
                    "success": True,
                    "response_time_ms": response_time,
                    "tokens_used": result.get("usage", {}).get("total_tokens", 0),
                    "model_used": self.model_name,
                    "message": "Connection successful"
                }
            else:
                return {
                    "success": False,
                    "response_time_ms": response_time,
                    "error": f"API Error: {response.status_code}",
                    "message": response.text
                }

        except Exception as e:
            response_time = int((time.time() - start_time) * 1000)
            return {
                "success": False,
                "response_time_ms": response_time,
                "error": str(e),
                "message": "Connection failed"
            }
        finally:
            await self.client.aclose()

    async def generate_prompt(self, context: Dict[str, Any], system_prompt: str) -> Dict[str, Any]:
        """Generate a prompt using OpenAI"""
        start_time = time.time()

        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }

            messages = [
                {"role": "system", "content": system_prompt}
            ]

            # Add context information
            context_prompt = self._build_context_prompt(context)
            messages.append({"role": "user", "content": context_prompt})

            response = await self.client.post(
                f"{self.api_base_url}/chat/completions",
                headers=headers,
                json={
                    "model": self.model_name,
                    "messages": messages,
                    "temperature": 0.7,
                    "max_tokens": 2000
                }
            )

            response_time = int((time.time() - start_time) * 1000)

            if response.status_code == 200:
                result = response.json()
                return {
                    "success": True,
                    "response_time_ms": response_time,
                    "tokens_used": result.get("usage", {}).get("total_tokens", 0),
                    "model_used": self.model_name,
                    "generated_content": result["choices"][0]["message"]["content"],
                    "raw_response": result
                }
            else:
                return {
                    "success": False,
                    "response_time_ms": response_time,
                    "error": f"API Error: {response.status_code}",
                    "message": response.text
                }

        except Exception as e:
            response_time = int((time.time() - start_time) * 1000)
            return {
                "success": False,
                "response_time_ms": response_time,
                "error": str(e),
                "message": "Generation failed"
            }

    async def chat(self, messages: List[Dict[str, str]], system_prompt: Optional[str] = None) -> Dict[str, Any]:
        """Chat with OpenAI"""
        start_time = time.time()

        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }

            if system_prompt:
                messages = [{"role": "system", "content": system_prompt}] + messages

            response = await self.client.post(
                f"{self.api_base_url}/chat/completions",
                headers=headers,
                json={
                    "model": self.model_name,
                    "messages": messages,
                    "temperature": 0.7,
                    "max_tokens": 2000
                }
            )

            response_time = int((time.time() - start_time) * 1000)

            if response.status_code == 200:
                result = response.json()
                return {
                    "success": True,
                    "response_time_ms": response_time,
                    "tokens_used": result.get("usage", {}).get("total_tokens", 0),
                    "model_used": self.model_name,
                    "message": result["choices"][0]["message"]["content"],
                    "raw_response": result
                }
            else:
                return {
                    "success": False,
                    "response_time_ms": response_time,
                    "error": f"API Error: {response.status_code}",
                    "message": response.text
                }

        except Exception as e:
            response_time = int((time.time() - start_time) * 1000)
            return {
                "success": False,
                "response_time_ms": response_time,
                "error": str(e),
                "message": "Chat failed"
            }
        finally:
            await self.client.aclose()

    def get_provider_name(self) -> str:
        return AIAssistantProviderType.OPENAI

    def _build_context_prompt(self, context: Dict[str, Any]) -> str:
        """Build context prompt from context dictionary"""
        prompt_parts = []

        if context.get("description"):
            prompt_parts.append(f"Task: {context['description']}")

        if context.get("target_models"):
            prompt_parts.append(f"Target models: {', '.join(context['target_models'])}")

        if context.get("module_info"):
            prompt_parts.append(f"Module context: {context['module_info']}")

        if context.get("existing_prompt"):
            prompt_parts.append(f"Existing prompt: {context['existing_prompt']}")

        if context.get("requirements"):
            prompt_parts.append(f"Requirements: {context['requirements']}")

        if context.get("examples"):
            prompt_parts.append(f"Examples: {context['examples']}")

        return "\n".join(prompt_parts) if prompt_parts else "Please help me create a prompt."

class AnthropicAssistantProvider(AIAssistantProviderInterface):
    """Anthropic Claude Assistant Provider"""

    def __init__(self, api_key: str, api_base_url: Optional[str] = None, model_name: Optional[str] = None):
        self.api_key = api_key
        self.api_base_url = api_base_url or "https://api.anthropic.com"
        self.model_name = model_name or "claude-3-sonnet-20240229"
        self.client = httpx.AsyncClient(timeout=30.0)

    async def test_connection(self) -> Dict[str, Any]:
        """Test connection to Anthropic"""
        start_time = time.time()
        try:
            headers = {
                "x-api-key": self.api_key,
                "Content-Type": "application/json",
                "anthropic-version": "2023-06-01"
            }

            response = await self.client.post(
                f"{self.api_base_url}/v1/messages",
                headers=headers,
                json={
                    "model": self.model_name,
                    "max_tokens": 10,
                    "messages": [{"role": "user", "content": "Hello"}]
                }
            )

            response_time = int((time.time() - start_time) * 1000)

            if response.status_code == 200:
                result = response.json()
                return {
                    "success": True,
                    "response_time_ms": response_time,
                    "tokens_used": result.get("usage", {}).get("input_tokens", 0) + result.get("usage", {}).get("output_tokens", 0),
                    "model_used": self.model_name,
                    "message": "Connection successful"
                }
            else:
                return {
                    "success": False,
                    "response_time_ms": response_time,
                    "error": f"API Error: {response.status_code}",
                    "message": response.text
                }

        except Exception as e:
            response_time = int((time.time() - start_time) * 1000)
            return {
                "success": False,
                "response_time_ms": response_time,
                "error": str(e),
                "message": "Connection failed"
            }
        finally:
            await self.client.aclose()

    async def generate_prompt(self, context: Dict[str, Any], system_prompt: str) -> Dict[str, Any]:
        """Generate a prompt using Anthropic"""
        start_time = time.time()

        try:
            headers = {
                "x-api-key": self.api_key,
                "Content-Type": "application/json",
                "anthropic-version": "2023-06-01"
            }

            context_prompt = self._build_context_prompt(context)

            response = await self.client.post(
                f"{self.api_base_url}/v1/messages",
                headers=headers,
                json={
                    "model": self.model_name,
                    "max_tokens": 2000,
                    "system": system_prompt,
                    "messages": [{"role": "user", "content": context_prompt}]
                }
            )

            response_time = int((time.time() - start_time) * 1000)

            if response.status_code == 200:
                result = response.json()
                return {
                    "success": True,
                    "response_time_ms": response_time,
                    "tokens_used": result.get("usage", {}).get("input_tokens", 0) + result.get("usage", {}).get("output_tokens", 0),
                    "model_used": self.model_name,
                    "generated_content": result["content"][0]["text"],
                    "raw_response": result
                }
            else:
                return {
                    "success": False,
                    "response_time_ms": response_time,
                    "error": f"API Error: {response.status_code}",
                    "message": response.text
                }

        except Exception as e:
            response_time = int((time.time() - start_time) * 1000)
            return {
                "success": False,
                "response_time_ms": response_time,
                "error": str(e),
                "message": "Generation failed"
            }

    async def chat(self, messages: List[Dict[str, str]], system_prompt: Optional[str] = None) -> Dict[str, Any]:
        """Chat with Anthropic"""
        start_time = time.time()

        try:
            headers = {
                "x-api-key": self.api_key,
                "Content-Type": "application/json",
                "anthropic-version": "2023-06-01"
            }

            if system_prompt:
                # Anthropic uses system parameter differently
                response = await self.client.post(
                    f"{self.api_base_url}/v1/messages",
                    headers=headers,
                    json={
                        "model": self.model_name,
                        "max_tokens": 2000,
                        "system": system_prompt,
                        "messages": messages
                    }
                )
            else:
                response = await self.client.post(
                    f"{self.api_base_url}/v1/messages",
                    headers=headers,
                    json={
                        "model": self.model_name,
                        "max_tokens": 2000,
                        "messages": messages
                    }
                )

            response_time = int((time.time() - start_time) * 1000)

            if response.status_code == 200:
                result = response.json()
                return {
                    "success": True,
                    "response_time_ms": response_time,
                    "tokens_used": result.get("usage", {}).get("input_tokens", 0) + result.get("usage", {}).get("output_tokens", 0),
                    "model_used": self.model_name,
                    "message": result["content"][0]["text"],
                    "raw_response": result
                }
            else:
                return {
                    "success": False,
                    "response_time_ms": response_time,
                    "error": f"API Error: {response.status_code}",
                    "message": response.text
                }

        except Exception as e:
            response_time = int((time.time() - start_time) * 1000)
            return {
                "success": False,
                "response_time_ms": response_time,
                "error": str(e),
                "message": "Chat failed"
            }
        finally:
            await self.client.aclose()

    def get_provider_name(self) -> str:
        return AIAssistantProviderType.ANTHROPIC

    def _build_context_prompt(self, context: Dict[str, Any]) -> str:
        """Build context prompt from context dictionary"""
        prompt_parts = []

        if context.get("description"):
            prompt_parts.append(f"Task: {context['description']}")

        if context.get("target_models"):
            prompt_parts.append(f"Target models: {', '.join(context['target_models'])}")

        if context.get("module_info"):
            prompt_parts.append(f"Module context: {context['module_info']}")

        if context.get("existing_prompt"):
            prompt_parts.append(f"Existing prompt: {context['existing_prompt']}")

        if context.get("requirements"):
            prompt_parts.append(f"Requirements: {context['requirements']}")

        if context.get("examples"):
            prompt_parts.append(f"Examples: {context['examples']}")

        return "\n\n".join(prompt_parts) if prompt_parts else "Please help me create a prompt."

class AIAssistantService:
    """Main AI Assistant service that manages multiple providers"""

    def __init__(self):
        self.providers: Dict[str, AIAssistantProviderInterface] = {}
        self.logger = logger

    def register_provider(self, provider_id: str, provider: AIAssistantProviderInterface):
        """Register an AI provider"""
        self.providers[provider_id] = provider
        self.logger.info("Provider registered", provider_id=provider_id, provider_name=provider.get_provider_name())

    def get_provider(self, provider_id: str) -> Optional[AIAssistantProviderInterface]:
        """Get a provider by ID"""
        return self.providers.get(provider_id)

    async def test_provider(self, provider_id: str) -> Dict[str, Any]:
        """Test a provider connection"""
        provider = self.get_provider(provider_id)
        if not provider:
            return {
                "success": False,
                "error": "Provider not found",
                "message": "The specified provider does not exist"
            }

        return await provider.test_connection()

    async def generate_prompt(self, provider_id: str, context: Dict[str, Any], system_prompt: str) -> Dict[str, Any]:
        """Generate a prompt using the specified provider"""
        provider = self.get_provider(provider_id)
        if not provider:
            return {
                "success": False,
                "error": "Provider not found",
                "message": "The specified provider does not exist"
            }

        return await provider.generate_prompt(context, system_prompt)

    async def chat(self, provider_id: str, messages: List[Dict[str, str]], system_prompt: Optional[str] = None) -> Dict[str, Any]:
        """Chat with the specified provider"""
        provider = self.get_provider(provider_id)
        if not provider:
            return {
                "success": False,
                "error": "Provider not found",
                "message": "The specified provider does not exist"
            }

        return await provider.chat(messages, system_prompt)

    def create_provider_from_config(self, config: Dict[str, Any]) -> AIAssistantProviderInterface:
        """Create a provider instance from configuration"""
        provider_type = config.get("provider_type")
        api_key = config.get("api_key")

        if not provider_type or not api_key:
            raise ValueError("Provider type and API key are required")

        if provider_type == AIAssistantProviderType.OPENAI:
            return OpenAIAssistantProvider(
                api_key=api_key,
                api_base_url=config.get("api_base_url"),
                model_name=config.get("model_name")
            )
        elif provider_type == AIAssistantProviderType.ANTHROPIC:
            return AnthropicAssistantProvider(
                api_key=api_key,
                api_base_url=config.get("api_base_url"),
                model_name=config.get("model_name")
            )
        else:
            raise ValueError(f"Unsupported provider type: {provider_type}")

# Global service instance
ai_assistant_service = AIAssistantService()