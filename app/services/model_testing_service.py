import asyncio
import time
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.models import AIAssistantProvider, AIAssistantProviderStatus
from app.services.ai_assistant_service_proper import AIAssistantService
from app.schemas import ModelTestRequest, ModelTestResult, ModelTestResponse
import structlog

logger = structlog.get_logger()


class ModelTestingService:
    def __init__(self, db: Session):
        self.db = db
        self.ai_service = AIAssistantService(db)

    async def test_prompt_across_providers(self, user_id: str, test_request: ModelTestRequest) -> ModelTestResponse:
        """Test a prompt across multiple AI providers simultaneously"""
        start_time = time.time()

        # Get user's active AI providers
        providers = self._get_user_providers(user_id, test_request.providers)

        if not providers:
            raise ValueError("No active AI providers found for user")

        # Execute tests in parallel
        test_results = await self._execute_parallel_tests(providers, test_request)

        # Calculate summary statistics
        total_providers = len(providers)
        successful_tests = len([r for r in test_results if r.status == "success"])
        failed_tests = total_providers - successful_tests
        execution_time = int((time.time() - start_time) * 1000)

        return ModelTestResponse(
            results=test_results,
            total_providers=total_providers,
            successful_tests=successful_tests,
            failed_tests=failed_tests,
            test_execution_time_ms=execution_time
        )

    def _get_user_providers(self, user_id: str, selected_providers: List[str]) -> List[AIAssistantProvider]:
        """Get user's active AI providers"""
        query = self.db.query(AIAssistantProvider).filter(
            AIAssistantProvider.user_id == user_id,
            AIAssistantProvider.status == AIAssistantProviderStatus.active
        )

        # Filter by selected providers if specified
        if selected_providers:
            query = query.filter(AIAssistantProvider.id.in_(selected_providers))

        return query.all()

    async def _execute_parallel_tests(self, providers: List[AIAssistantProvider], test_request: ModelTestRequest) -> List[ModelTestResult]:
        """Execute test requests to all providers in parallel"""
        tasks = []

        for provider in providers:
            task = self._test_single_provider(provider, test_request)
            tasks.append(task)

        # Execute all tasks concurrently with timeout
        try:
            results = await asyncio.wait_for(
                asyncio.gather(*tasks, return_exceptions=True),
                timeout=30.0  # 30 second timeout for all providers
            )
        except asyncio.TimeoutError:
            logger.warning("Model testing timed out", timeout_seconds=30)
            # Create timeout results for remaining providers
            results = []
            for provider in providers:
                if len(results) < len(providers):
                    results.append(ModelTestResult(
                        provider_id=provider.id,
                        provider_name=provider.name,
                        provider_type=provider.provider_type.value,
                        response_content="",
                        response_time_ms=30000,
                        error="Request timeout",
                        status="timeout"
                    ))

        # Process results
        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                # Error occurred
                provider = providers[i]
                processed_results.append(ModelTestResult(
                    provider_id=provider.id,
                    provider_name=provider.name,
                    provider_type=provider.provider_type.value,
                    response_content="",
                    response_time_ms=0,
                    error=str(result),
                    status="error"
                ))
            elif isinstance(result, ModelTestResult):
                processed_results.append(result)
            else:
                # Unexpected result type
                provider = providers[i]
                processed_results.append(ModelTestResult(
                    provider_id=provider.id,
                    provider_name=provider.name,
                    provider_type=provider.provider_type.value,
                    response_content="",
                    response_time_ms=0,
                    error="Unexpected result type",
                    status="error"
                ))

        return processed_results

    async def _test_single_provider(self, provider: AIAssistantProvider, test_request: ModelTestRequest) -> ModelTestResult:
        """Test a single provider with the given prompt"""
        start_time = time.time()

        try:
            # Create test request for AI service
            from app.schemas import AIAssistantProviderTestRequest
            test_req = AIAssistantProviderTestRequest(
                test_message=f"System: {test_request.system_prompt}\n\nUser: {test_request.user_message}"
            )

            # Execute test using existing AI service
            test_result = self.ai_service.test_provider(provider.id, provider.user_id, test_req)

            if test_result and test_result.success:
                response_time = int((time.time() - start_time) * 1000)
                # Extract response from response_data
                response_content = ""
                if test_result.response_data:
                    # Try to extract content from different possible structures
                    if "response" in test_result.response_data:
                        response_content = test_result.response_data["response"]
                    elif "content" in test_result.response_data:
                        response_content = test_result.response_data["content"]
                    elif "choices" in test_result.response_data:
                        # OpenAI format
                        choices = test_result.response_data["choices"]
                        if choices and len(choices) > 0:
                            response_content = choices[0]["message"]["content"]

                return ModelTestResult(
                    provider_id=provider.id,
                    provider_name=provider.name,
                    provider_type=provider.provider_type.value,
                    response_content=response_content,
                    response_time_ms=response_time,
                    tokens_used=None,  # Not available in current response structure
                    error=None,
                    status="success"
                )
            else:
                response_time = int((time.time() - start_time) * 1000)
                return ModelTestResult(
                    provider_id=provider.id,
                    provider_name=provider.name,
                    provider_type=provider.provider_type.value,
                    response_content="",
                    response_time_ms=response_time,
                    error=test_result.error if test_result else "Unknown error",
                    status="error"
                )

        except Exception as e:
            response_time = int((time.time() - start_time) * 1000)
            logger.error(f"Error testing provider: {str(e)}", provider_id=provider.id)
            return ModelTestResult(
                provider_id=provider.id,
                provider_name=provider.name,
                provider_type=provider.provider_type.value,
                response_content="",
                response_time_ms=response_time,
                error=str(e),
                status="error"
            )

    def get_user_providers_for_testing(self, user_id: str) -> List[Dict[str, Any]]:
        """Get user's providers formatted for testing interface"""
        providers = self._get_user_providers(user_id, [])
        return [
            {
                "id": provider.id,
                "name": provider.name,
                "type": provider.provider_type.value,
                "model_name": provider.model_name,
                "status": provider.status.value
            }
            for provider in providers
        ]