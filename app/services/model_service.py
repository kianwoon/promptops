import asyncio
import time
from typing import Dict, Any, List, Optional
from abc import ABC, abstractmethod
import structlog
from enum import Enum

logger = structlog.get_logger()

class ModelProvider(Enum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    QWEN = "qwen"
    LLAMA = "llama"

class CompatibilityStatus(Enum):
    WORKS = "works"
    NEEDS_TUNING = "needs_tuning"
    NOT_SUPPORTED = "not_supported"

class ModelProviderInterface(ABC):
    """Abstract base class for model providers"""

    @abstractmethod
    async def test_prompt(self, prompt: str) -> Dict[str, Any]:
        """Test a prompt with the model provider"""
        pass

    @abstractmethod
    async def get_model_info(self) -> Dict[str, Any]:
        """Get information about available models"""
        pass

    @abstractmethod
    def get_provider_name(self) -> str:
        """Get the provider name"""
        pass

class OpenAIProvider(ModelProviderInterface):
    """OpenAI GPT model provider"""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key
        self.models = ["gpt-3.5-turbo", "gpt-4", "gpt-4-turbo", "gpt-4o"]

    async def test_prompt(self, prompt: str) -> Dict[str, Any]:
        """Test prompt with OpenAI"""
        try:
            # Simulate API call for now
            await asyncio.sleep(0.1)  # Simulate network latency

            # Mock response
            response_time = 150  # milliseconds
            quality_score = 0.85  # Simulated quality assessment

            return {
                "success": True,
                "response_time": response_time,
                "quality_score": quality_score,
                "model_used": "gpt-3.5-turbo",
                "token_count": len(prompt.split()),
                "estimated_cost": 0.002
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "response_time": 0
            }

    async def get_model_info(self) -> Dict[str, Any]:
        return {
            "provider": "openai",
            "models": self.models,
            "capabilities": ["chat", "completion", "function_calling"],
            "pricing": {
                "gpt-3.5-turbo": 0.002,
                "gpt-4": 0.03,
                "gpt-4-turbo": 0.01,
                "gpt-4o": 0.005
            }
        }

    def get_provider_name(self) -> str:
        return "openai"

class AnthropicProvider(ModelProviderInterface):
    """Anthropic Claude model provider"""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key
        self.models = [
            "claude-opus-4-1-20250805",
            "claude-opus-4-20250514",
            "claude-sonnet-4-20250514",
            "claude-3-7-sonnet-20250219",
            "claude-3-5-haiku-20241022",
            "claude-3-haiku-20240307"
        ]

    async def test_prompt(self, prompt: str) -> Dict[str, Any]:
        """Test prompt with Anthropic"""
        try:
            # Simulate API call
            await asyncio.sleep(0.12)

            response_time = 180
            quality_score = 0.88

            return {
                "success": True,
                "response_time": response_time,
                "quality_score": quality_score,
                "model_used": "claude-3-5-haiku-20241022",
                "token_count": len(prompt.split()),
                "estimated_cost": 0.003
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "response_time": 0
            }

    async def get_model_info(self) -> Dict[str, Any]:
        return {
            "provider": "anthropic",
            "models": self.models,
            "capabilities": ["chat", "completion", "multimodal"],
            "pricing": {
                "claude-3-haiku-20240307": 0.00025,
                "claude-3-5-haiku-20241022": 0.001,
                "claude-3-7-sonnet-20250219": 0.003,
                "claude-sonnet-4-20250514": 0.003,
                "claude-opus-4-20250514": 0.015,
                "claude-opus-4-1-20250805": 0.015
            }
        }

    def get_provider_name(self) -> str:
        return "anthropic"

class QwenProvider(ModelProviderInterface):
    """Qwen model provider (Alibaba Cloud)"""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key
        self.models = ["qwen-turbo", "qwen-plus", "qwen-max"]

    async def test_prompt(self, prompt: str) -> Dict[str, Any]:
        """Test prompt with Qwen"""
        try:
            # Simulate API call
            await asyncio.sleep(0.15)

            response_time = 220
            quality_score = 0.75

            return {
                "success": True,
                "response_time": response_time,
                "quality_score": quality_score,
                "model_used": "qwen-turbo",
                "token_count": len(prompt.split()),
                "estimated_cost": 0.001
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "response_time": 0
            }

    async def get_model_info(self) -> Dict[str, Any]:
        return {
            "provider": "qwen",
            "models": self.models,
            "capabilities": ["chat", "completion"],
            "pricing": {
                "qwen-turbo": 0.001,
                "qwen-plus": 0.002,
                "qwen-max": 0.004
            }
        }

    def get_provider_name(self) -> str:
        return "qwen"

class LLaMAProvider(ModelProviderInterface):
    """LLaMA model provider"""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key
        self.models = ["llama-2-7b", "llama-2-13b", "llama-2-70b"]

    async def test_prompt(self, prompt: str) -> Dict[str, Any]:
        """Test prompt with LLaMA"""
        try:
            # Simulate API call
            await asyncio.sleep(0.2)

            response_time = 300
            quality_score = 0.70

            return {
                "success": True,
                "response_time": response_time,
                "quality_score": quality_score,
                "model_used": "llama-2-7b",
                "token_count": len(prompt.split()),
                "estimated_cost": 0.0015
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "response_time": 0
            }

    async def get_model_info(self) -> Dict[str, Any]:
        return {
            "provider": "llama",
            "models": self.models,
            "capabilities": ["chat", "completion"],
            "pricing": {
                "llama-2-7b": 0.0005,
                "llama-2-13b": 0.001,
                "llama-2-70b": 0.003
            }
        }

    def get_provider_name(self) -> str:
        return "llama"

class ModelProviderService:
    """Service for managing multiple model providers"""

    def __init__(self):
        self.providers: Dict[str, ModelProviderInterface] = {
            ModelProvider.OPENAI.value: OpenAIProvider(),
            ModelProvider.ANTHROPIC.value: AnthropicProvider(),
            ModelProvider.QWEN.value: QwenProvider(),
            ModelProvider.LLAMA.value: LLaMAProvider()
        }

    async def test_prompt_compatibility(self, prompt: str, provider: str) -> Dict[str, Any]:
        """Test prompt compatibility with specific model provider"""
        if provider not in self.providers:
            return {
                "status": CompatibilityStatus.NOT_SUPPORTED.value,
                "error": f"Provider '{provider}' not supported",
                "response_time": 0,
                "quality_score": 0
            }

        try:
            result = await self.providers[provider].test_prompt(prompt)

            if result["success"]:
                # Determine compatibility status based on quality and response time
                quality_score = result.get("quality_score", 0)
                response_time = result.get("response_time", 0)

                if quality_score >= 0.8 and response_time < 200:
                    status = CompatibilityStatus.WORKS.value
                elif quality_score >= 0.6 and response_time < 500:
                    status = CompatibilityStatus.NEEDS_TUNING.value
                else:
                    status = CompatibilityStatus.NOT_SUPPORTED.value

                return {
                    "status": status,
                    "response_time": response_time,
                    "quality_score": quality_score,
                    "estimated_cost": result.get("estimated_cost", 0),
                    "model_used": result.get("model_used"),
                    "token_count": result.get("token_count", 0)
                }
            else:
                return {
                    "status": CompatibilityStatus.NOT_SUPPORTED.value,
                    "error": result.get("error", "Unknown error"),
                    "response_time": 0,
                    "quality_score": 0
                }

        except Exception as e:
            logger.error(f"Prompt compatibility test failed: {str(e)}", provider=provider)
            return {
                "status": CompatibilityStatus.NOT_SUPPORTED.value,
                "error": str(e),
                "response_time": 0,
                "quality_score": 0
            }

    async def run_compatibility_tests(self, prompt: str) -> Dict[str, Any]:
        """Run compatibility tests across all providers"""
        results = {}

        # Test all providers concurrently
        tasks = []
        for provider in self.providers.keys():
            task = self.test_prompt_compatibility(prompt, provider)
            tasks.append((provider, task))

        # Wait for all tests to complete
        completed_tasks = await asyncio.gather(*[task for _, task in tasks], return_exceptions=True)

        # Process results
        for (provider, _), result in zip(tasks, completed_tasks):
            if isinstance(result, Exception):
                results[provider] = {
                    "status": CompatibilityStatus.NOT_SUPPORTED.value,
                    "error": str(result)
                }
            else:
                results[provider] = result

        # Generate summary
        working_providers = [p for p, r in results.items() if r["status"] == CompatibilityStatus.WORKS.value]
        needs_tuning = [p for p, r in results.items() if r["status"] == CompatibilityStatus.NEEDS_TUNING.value]
        not_supported = [p for p, r in results.items() if r["status"] == CompatibilityStatus.NOT_SUPPORTED.value]

        return {
            "prompt_preview": prompt[:100] + "..." if len(prompt) > 100 else prompt,
            "results": results,
            "summary": {
                "total_providers": len(self.providers),
                "working_count": len(working_providers),
                "needs_tuning_count": len(needs_tuning),
                "not_supported_count": len(not_supported),
                "working_providers": working_providers,
                "needs_tuning": needs_tuning,
                "not_supported": not_supported
            },
            "recommendations": self._generate_recommendations(results)
        }

    def _generate_recommendations(self, results: Dict[str, Any]) -> List[str]:
        """Generate recommendations based on compatibility results"""
        recommendations = []

        working = [p for p, r in results.items() if r["status"] == CompatibilityStatus.WORKS.value]
        needs_tuning = [p for p, r in results.items() if r["status"] == CompatibilityStatus.NEEDS_TUNING.value]
        not_supported = [p for p, r in results.items() if r["status"] == CompatibilityStatus.NOT_SUPPORTED.value]

        if working:
            best_provider = max(working, key=lambda p: results[p].get("quality_score", 0))
            recommendations.append(f"Use {best_provider} for best quality (score: {results[best_provider].get('quality_score', 0):.2f})")

        if needs_tuning:
            recommendations.append(f"Consider tuning prompt for: {', '.join(needs_tuning)}")

        if not_supported:
            recommendations.append(f"These providers are not compatible: {', '.join(not_supported)}")

        return recommendations

    async def get_provider_info(self, provider: str) -> Dict[str, Any]:
        """Get information about a specific provider"""
        if provider not in self.providers:
            raise ValueError(f"Provider '{provider}' not supported")

        return await self.providers[provider].get_model_info()

    async def get_all_providers_info(self) -> Dict[str, Any]:
        """Get information about all providers"""
        info = {}
        for provider_name, provider in self.providers.items():
            info[provider_name] = await provider.get_model_info()
        return info

    def get_supported_providers(self) -> List[str]:
        """Get list of supported providers"""
        return list(self.providers.keys())

# Global service instance
model_service = ModelProviderService()