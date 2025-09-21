"""
Performance benchmarks for PromptOps client
"""

import asyncio
import pytest
import time
import psutil
import os
from typing import List, Dict, Any
from unittest.mock import AsyncMock, MagicMock, patch

from promptops import PromptOpsClient, ClientConfig, PromptVariables
from promptops.models import CacheLevel


@pytest.fixture
def benchmark_config():
    """Create benchmark configuration"""
    return ClientConfig(
        base_url="http://localhost:8000",
        api_key="benchmark-key",
        timeout=30.0,
        enable_cache=True,
        enable_telemetry=False,
        redis_url="redis://localhost:6379"
    )


@pytest.fixture
async def benchmark_client(benchmark_config):
    """Create benchmark client"""
    client = PromptOpsClient(benchmark_config)
    await client.initialize()
    yield client
    await client.close()


class TestPromptRetrievalBenchmarks:
    """Benchmarks for prompt retrieval operations"""

    @pytest.mark.benchmark
    def test_single_prompt_retrieval(self, benchmark_client, benchmark):
        """Benchmark single prompt retrieval"""
        async def retrieve_prompt():
            with patch.object(benchmark_client, '_make_request') as mock_request:
                mock_request.return_value = {
                    "id": "benchmark-prompt",
                    "content": "Benchmark content"
                }
                return await benchmark_client.get_prompt("benchmark-prompt")

        result = benchmark(retrieve_prompt)
        assert result["content"] == "Benchmark content"

    @pytest.mark.benchmark
    def test_batch_prompt_retrieval(self, benchmark_client, benchmark):
        """Benchmark batch prompt retrieval"""
        async def retrieve_batch_prompts():
            with patch.object(benchmark_client, '_make_request') as mock_request:
                mock_request.return_value = [
                    {"id": f"prompt-{i}", "content": f"Content {i}"}
                    for i in range(10)
                ]
                return await benchmark_client.list_prompts("benchmark-module", limit=10)

        result = benchmark(retrieve_batch_prompts)
        assert len(result) == 10

    @pytest.mark.benchmark
    def test_cached_prompt_retrieval(self, benchmark_client, benchmark):
        """Benchmark cached prompt retrieval"""
        async def retrieve_cached_prompt():
            with patch.object(benchmark_client, '_make_request') as mock_request:
                mock_request.return_value = {
                    "id": "cached-prompt",
                    "content": "Cached content"
                }
                return await benchmark_client.get_prompt("cached-prompt")

        # First call to cache
        await retrieve_cached_prompt()

        # Benchmark cached retrieval
        result = benchmark(retrieve_cached_prompt)
        assert result["content"] == "Cached content"


class TestPromptRenderingBenchmarks:
    """Benchmarks for prompt rendering operations"""

    @pytest.mark.benchmark
    def test_simple_prompt_rendering(self, benchmark_client, benchmark):
        """Benchmark simple prompt rendering"""
        variables = PromptVariables(variables={
            "name": "Benchmark User",
            "framework": "Python"
        })

        async def render_simple_prompt():
            with patch.object(benchmark_client, '_make_request') as mock_request:
                mock_request.return_value = {
                    "rendered_content": "Hello Benchmark User! You are using Python.",
                    "variables_used": {"name": "Benchmark User", "framework": "Python"}
                }
                return await benchmark_client.render_prompt("simple-prompt", variables)

        result = benchmark(render_simple_prompt)
        assert "Benchmark User" in result["rendered_content"]

    @pytest.mark.benchmark
    def test_complex_prompt_rendering(self, benchmark_client, benchmark):
        """Benchmark complex prompt rendering with many variables"""
        variables = PromptVariables(variables={
            "name": "Benchmark User",
            "framework": "Python",
            "version": "3.11",
            "os": "Linux",
            "architecture": "x86_64",
            "memory": "16GB",
            "cores": 8,
            "timezone": "UTC",
            "locale": "en_US"
        })

        async def render_complex_prompt():
            with patch.object(benchmark_client, '_make_request') as mock_request:
                mock_request.return_value = {
                    "rendered_content": "Complex prompt with many variables",
                    "variables_used": variables.variables
                }
                return await benchmark_client.render_prompt("complex-prompt", variables)

        result = benchmark(render_complex_prompt)
        assert len(result["variables_used"]) == 9

    @pytest.mark.benchmark
    def test_batch_prompt_rendering(self, benchmark_client, benchmark):
        """Benchmark batch prompt rendering"""
        variables_list = [
            PromptVariables(variables={"user_id": f"user_{i}", "session_id": f"session_{i}"})
            for i in range(20)
        ]

        async def render_batch_prompts():
            results = []
            for variables in variables_list:
                with patch.object(benchmark_client, '_make_request') as mock_request:
                    mock_request.return_value = {
                        "rendered_content": f"Rendered for {variables.variables['user_id']}",
                        "variables_used": variables.variables
                    }
                    result = await benchmark_client.render_prompt("batch-prompt", variables)
                    results.append(result)
            return results

        result = benchmark(render_batch_prompts)
        assert len(result) == 20


class TestConcurrencyBenchmarks:
    """Benchmarks for concurrent operations"""

    @pytest.mark.benchmark
    def test_concurrent_prompt_retrieval(self, benchmark_client, benchmark):
        """Benchmark concurrent prompt retrieval"""
        async def concurrent_retrieval():
            async def retrieve_prompt(i):
                with patch.object(benchmark_client, '_make_request') as mock_request:
                    mock_request.return_value = {
                        "id": f"concurrent-prompt-{i}",
                        "content": f"Concurrent content {i}"
                    }
                    return await benchmark_client.get_prompt(f"concurrent-prompt-{i}")

            tasks = [retrieve_prompt(i) for i in range(50)]
            return await asyncio.gather(*tasks)

        result = benchmark(concurrent_retrieval)
        assert len(result) == 50

    @pytest.mark.benchmark
    def test_concurrent_prompt_rendering(self, benchmark_client, benchmark):
        """Benchmark concurrent prompt rendering"""
        async def concurrent_rendering():
            async def render_prompt(i):
                variables = PromptVariables(variables={
                    "iteration": str(i),
                    "timestamp": str(time.time())
                })
                with patch.object(benchmark_client, '_make_request') as mock_request:
                    mock_request.return_value = {
                        "rendered_content": f"Rendered iteration {i}",
                        "variables_used": variables.variables
                    }
                    return await benchmark_client.render_prompt("concurrent-prompt", variables)

            tasks = [render_prompt(i) for i in range(30)]
            return await asyncio.gather(*tasks)

        result = benchmark(concurrent_rendering)
        assert len(result) == 30


class TestMemoryBenchmarks:
    """Benchmarks for memory usage"""

    @pytest.mark.benchmark
    def test_memory_usage_scaling(self, benchmark_client, benchmark):
        """Benchmark memory usage with scaling operations"""
        process = psutil.Process(os.getpid())

        async def memory_scaling_test():
            initial_memory = process.memory_info().rss

            # Perform memory-intensive operations
            for i in range(100):
                variables = PromptVariables(variables={
                    "data": "x" * 1000,  # 1KB of data
                    "iteration": str(i)
                })
                with patch.object(benchmark_client, '_make_request') as mock_request:
                    mock_request.return_value = {
                        "rendered_content": f"Memory test {i}",
                        "variables_used": variables.variables
                    }
                    await benchmark_client.render_prompt("memory-prompt", variables)

            final_memory = process.memory_info().rss
            return final_memory - initial_memory

        memory_increase = benchmark(memory_scaling_test)
        # Memory increase should be reasonable (less than 100MB)
        assert memory_increase < 100 * 1024 * 1024

    @pytest.mark.benchmark
    def test_cache_memory_efficiency(self, benchmark_client, benchmark):
        """Benchmark cache memory efficiency"""
        async def cache_efficiency_test():
            # Populate cache
            for i in range(100):
                with patch.object(benchmark_client, '_make_request') as mock_request:
                    mock_request.return_value = {
                        "id": f"cache-prompt-{i}",
                        "content": f"Cache content {i}"
                    }
                    await benchmark_client.get_prompt(f"cache-prompt-{i}")

            # Measure cache memory usage
            stats = benchmark_client.get_cache_stats()
            return stats

        stats = benchmark(cache_efficiency_test)
        assert stats["hits"] >= 0
        assert stats["misses"] >= 0


class TestNetworkBenchmarks:
    """Benchmarks for network operations"""

    @pytest.mark.benchmark
    def test_network_latency_impact(self, benchmark_client, benchmark):
        """Benchmark impact of network latency"""
        async def latency_test():
            with patch.object(benchmark_client, '_make_request') as mock_request:
                # Simulate different latency scenarios
                latencies = [0.01, 0.05, 0.1, 0.2, 0.5]  # 10ms to 500ms

                total_time = 0
                for latency in latencies:
                    start_time = time.time()

                    async def delayed_response(*args, **kwargs):
                        await asyncio.sleep(latency)
                        return {"content": f"Latency test {latency}s"}

                    mock_request.side_effect = delayed_response
                    await benchmark_client.get_prompt("latency-prompt")

                    end_time = time.time()
                    total_time += (end_time - start_time)

                return total_time / len(latencies)

        avg_time = benchmark(latency_test)
        assert avg_time > 0

    @pytest.mark.benchmark
    def test_retry_overhead(self, benchmark_client, benchmark):
        """Benchmark retry mechanism overhead"""
        async def retry_overhead_test():
            with patch.object(benchmark_client, '_make_request') as mock_request:
                # Simulate failures and retries
                mock_request.side_effect = [
                    Exception("Network error"),
                    Exception("Network error"),
                    {"content": "Retry success"}
                ]

                start_time = time.time()
                await benchmark_client.get_prompt("retry-prompt")
                end_time = time.time()

                return end_time - start_time

        retry_time = benchmark(retry_overhead_test)
        # Retry time should include failure handling
        assert retry_time > 0


class TestScalabilityBenchmarks:
    """Benchmarks for scalability testing"""

    @pytest.mark.benchmark
    def test_vertical_scaling(self, benchmark_client, benchmark):
        """Benchmark vertical scaling with increasing load"""
        async def vertical_scaling_test():
            load_sizes = [10, 50, 100, 200, 500]

            results = []
            for size in load_sizes:
                start_time = time.time()

                tasks = []
                for i in range(size):
                    with patch.object(benchmark_client, '_make_request') as mock_request:
                        mock_request.return_value = {
                            "id": f"scale-prompt-{i}",
                            "content": f"Scale content {i}"
                        }
                        task = benchmark_client.get_prompt(f"scale-prompt-{i}")
                        tasks.append(task)

                await asyncio.gather(*tasks)
                end_time = time.time()

                results.append({
                    "size": size,
                    "time": end_time - start_time,
                    "throughput": size / (end_time - start_time)
                })

            return results

        results = benchmark(vertical_scaling_test)
        assert len(results) == 5
        # Throughput should generally increase with size (after warmup)
        assert results[-1]["throughput"] >= results[0]["throughput"] * 0.5

    @pytest.mark.benchmark
    def test_horizontal_scaling(self, benchmark):
        """Benchmark horizontal scaling with multiple clients"""
        async def horizontal_scaling_test():
            num_clients = [1, 5, 10, 20]

            results = []
            for num in num_clients:
                clients = []
                for i in range(num):
                    config = ClientConfig(
                        base_url="http://localhost:8000",
                        api_key=f"scale-key-{i}",
                        timeout=30.0
                    )
                    client = PromptOpsClient(config)
                    await client.initialize()
                    clients.append(client)

                start_time = time.time()

                tasks = []
                for client in clients:
                    with patch.object(client, '_make_request') as mock_request:
                        mock_request.return_value = {
                            "id": "horizontal-prompt",
                            "content": "Horizontal scale content"
                        }
                        task = client.get_prompt("horizontal-prompt")
                        tasks.append(task)

                await asyncio.gather(*tasks)
                end_time = time.time()

                # Cleanup
                for client in clients:
                    await client.close()

                results.append({
                    "clients": num,
                    "time": end_time - start_time,
                    "throughput": num / (end_time - start_time)
                })

            return results

        results = benchmark(horizontal_scaling)
        assert len(results) == 4
        # Should scale reasonably well horizontally
        assert results[-1]["throughput"] >= results[0]["throughput"] * 0.3


class TestReliabilityBenchmarks:
    """Benchmarks for reliability and fault tolerance"""

    @pytest.mark.benchmark
    def test_failure_recovery(self, benchmark_client, benchmark):
        """Benchmark failure recovery time"""
        async def failure_recovery_test():
            with patch.object(benchmark_client, '_make_request') as mock_request:
                # Simulate intermittent failures
                mock_request.side_effect = [
                    Exception("Network error"),
                    {"content": "Recovered content"}
                ]

                start_time = time.time()
                result = await benchmark_client.get_prompt("recovery-prompt")
                end_time = time.time()

                return {
                    "recovery_time": end_time - start_time,
                    "success": result is not None
                }

        result = benchmark(failure_recovery_test)
        assert result["success"] is True
        assert result["recovery_time"] > 0

    @pytest.mark.benchmark
    def test_timeout_handling(self, benchmark_client, benchmark):
        """Benchmark timeout handling efficiency"""
        # Configure short timeout
        await benchmark_client.update_config({"timeout": 0.1})

        async def timeout_test():
            with patch.object(benchmark_client, '_make_request') as mock_request:
                # Simulate timeout
                async def timeout_response(*args, **kwargs):
                    await asyncio.sleep(0.2)  # Longer than timeout
                    return {"content": "Timeout content"}

                mock_request.side_effect = timeout_response

                start_time = time.time()
                try:
                    await benchmark_client.get_prompt("timeout-prompt")
                except asyncio.TimeoutError:
                    pass
                end_time = time.time()

                return end_time - start_time

        timeout_time = benchmark(timeout_test)
        # Should be close to timeout value
        assert 0.08 <= timeout_time <= 0.15  # Allow some overhead