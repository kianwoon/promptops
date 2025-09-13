# Troubleshooting Guide

This section provides comprehensive troubleshooting information, common issues, and solutions for PromptOps integration problems.

## 📚 Documentation Contents

### [Common Issues](common-issues.md) - Frequently encountered problems and solutions
### [API Errors](api-errors.md) - Detailed API error codes and troubleshooting
### [Performance Issues](performance-issues.md) - Performance bottlenecks and optimization
### [Authentication Problems](authentication.md) - Authentication and authorization issues
### [Debugging Guide](debugging.md) - Debugging techniques and tools
### [FAQ](faq.md) - Frequently asked questions and answers

## 🚨 Quick Troubleshooting Checklist

### Basic Connectivity Issues
- [ ] Check internet connection
- [ ] Verify API endpoint URL
- [ ] Confirm API key is valid
- [ ] Check firewall/network restrictions
- [ ] Verify SSL/TLS certificates

### Client Configuration Issues
- [ ] Check environment variables
- [ ] Verify configuration syntax
- [ ] Confirm timeout settings
- [ ] Check cache configuration
- [ ] Verify retry settings

### API Request Issues
- [ ] Check request format
- [ ] Verify required parameters
- [ ] Check variable names and format
- [ ] Verify prompt ID exists
- [ ] Check rate limits

## 🔍 Common Error Patterns

### 1. Authentication Errors

```json
{
  "success": false,
  "error": {
    "code": "AUTHENTICATION_ERROR",
    "message": "Invalid API key or signature"
  }
}
```

**Common Causes:**
- Invalid or expired API key
- Incorrect HMAC signature
- Missing authentication headers
- Clock synchronization issues

**Solutions:**
1. Verify API key is correct and active
2. Check HMAC signature generation
3. Ensure all required headers are present
4. Verify system clock is synchronized

### 2. Rate Limiting Errors

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_ERROR",
    "message": "Rate limit exceeded",
    "retry_after": 60
  }
}
```

**Common Causes:**
- Exceeding request limits
- Missing rate limit headers
- Improper request batching

**Solutions:**
1. Implement retry with exponential backoff
2. Use caching to reduce API calls
3. Implement request batching
4. Monitor usage and upgrade plan if needed

### 3. Network Timeout Errors

```json
{
  "success": false,
  "error": {
    "code": "TIMEOUT_ERROR",
    "message": "Request timeout after 30 seconds"
  }
}
```

**Common Causes:**
- Slow network connection
- Server overload
- Large payload size
- Firewall blocking requests

**Solutions:**
1. Increase timeout settings
2. Optimize request payloads
3. Implement connection pooling
4. Use CDN or edge caching

## 🛠️ Diagnostic Tools

### 1. Health Check Script

```python
#!/usr/bin/env python3
# health_check.py

import asyncio
import sys
from promptops import PromptOpsClient
from promptops.exceptions import PromptOpsError

async def run_health_checks():
    """Run comprehensive health checks"""
    print("🔍 Running PromptOps health checks...\n")

    results = {}

    try:
        # Initialize client
        client = PromptOpsClient(api_key="your-api-key")
        await client.initialize()
        results['initialization'] = "✅ PASS"

        # Check API connectivity
        try:
            health = await client.health_check()
            results['api_connectivity'] = f"✅ PASS - {health.status}"
        except Exception as e:
            results['api_connectivity'] = f"❌ FAIL - {e}"

        # Test basic prompt retrieval
        try:
            prompt = await client.get_prompt("hello-world")
            results['prompt_retrieval'] = "✅ PASS"
        except Exception as e:
            results['prompt_retrieval'] = f"❌ FAIL - {e}"

        # Test caching
        try:
            stats = client.get_cache_stats()
            results['caching'] = f"✅ PASS - Hit rate: {stats.get('hit_rate', 0):.2%}"
        except Exception as e:
            results['caching'] = f"❌ FAIL - {e}"

        # Test variable substitution
        try:
            rendered = await client.render_prompt(
                prompt_id="hello-world",
                variables=PromptVariables({"name": "test"})
            )
            results['variable_substitution'] = "✅ PASS"
        except Exception as e:
            results['variable_substitution'] = f"❌ FAIL - {e}"

    except Exception as e:
        results['initialization'] = f"❌ FAIL - {e}"

    # Print results
    print("Health Check Results:")
    print("=" * 40)
    for check, result in results.items():
        print(f"{check.replace('_', ' ').title()}: {result}")

    # Overall status
    failed = [r for r in results.values() if r.startswith("❌")]
    if failed:
        print(f"\n❌ {len(failed)} check(s) failed")
        return 1
    else:
        print(f"\n✅ All checks passed")
        return 0

if __name__ == "__main__":
    exit_code = asyncio.run(run_health_checks())
    sys.exit(exit_code)
```

### 2. Network Diagnostics

```python
# network_diagnostics.py
import asyncio
import aiohttp
import time
from urllib.parse import urlparse

async def test_connectivity():
    """Test network connectivity to PromptOps endpoints"""
    endpoints = [
        "https://api.promptops.com/v1/health",
        "https://api.promptops.com/v1/client/health",
        "https://api.promptops.com/v1/client/prompts"
    ]

    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=10)) as session:
        for endpoint in endpoints:
            print(f"\n🔍 Testing {endpoint}")

            try:
                start_time = time.time()
                async with session.get(endpoint) as response:
                    duration = (time.time() - start_time) * 1000
                    print(f"  Status: {response.status}")
                    print(f"  Response time: {duration:.2f}ms")
                    print(f"  Headers: {dict(response.headers)}")

                    if response.status == 200:
                        data = await response.json()
                        print(f"  Response: {data}")
                    else:
                        print(f"  Error: {await response.text()}")

            except asyncio.TimeoutError:
                print("  ❌ Timeout after 10 seconds")
            except Exception as e:
                print(f"  ❌ Error: {e}")

async def test_dns_resolution():
    """Test DNS resolution"""
    domains = [
        "api.promptops.com",
        "cdn.promptops.com",
        "status.promptops.com"
    ]

    print("\n🌐 DNS Resolution Test:")
    for domain in domains:
        try:
            import socket
            addr = socket.gethostbyname(domain)
            print(f"  ✅ {domain} -> {addr}")
        except socket.gaierror as e:
            print(f"  ❌ {domain} - {e}")

async def test_ssl_certificates():
    """Test SSL certificates"""
    print("\n🔒 SSL Certificate Test:")
    try:
        import ssl
        import socket

        context = ssl.create_default_context()
        with socket.create_connection(("api.promptops.com", 443)) as sock:
            with context.wrap_socket(sock, server_hostname="api.promptops.com") as ssock:
                cert = ssock.getpeercert()
                print(f"  ✅ Certificate valid for {cert['subject'][0][0][1]}")
                print(f"  ✅ Issued by {cert['issuer'][0][0][1]}")
                print(f"  ✅ Expires on {cert['notAfter']}")

    except Exception as e:
        print(f"  ❌ SSL certificate error: {e}")

if __name__ == "__main__":
    print("🔍 Running network diagnostics...\n")
    asyncio.run(test_connectivity())
    asyncio.run(test_dns_resolution())
    asyncio.run(test_ssl_certificates())
```

## 📋 Performance Diagnostics

### 1. Performance Profiling

```python
# performance_profiler.py
import asyncio
import time
import statistics
from contextlib import asynccontextmanager
from typing import List, Dict
from promptops import PromptOpsClient, PromptVariables

class PerformanceProfiler:
    def __init__(self, client: PromptOpsClient):
        self.client = client
        self.metrics = []

    @asynccontextmanager
    async def profile_operation(self, operation_name: str, **metadata):
        """Profile an operation and collect metrics"""
        start_time = time.time()
        start_memory = self._get_memory_usage()

        try:
            yield
            success = True
            error = None
        except Exception as e:
            success = False
            error = str(e)
            raise
        finally:
            end_time = time.time()
            end_memory = self._get_memory_usage()

            metrics = {
                'operation': operation_name,
                'duration_ms': (end_time - start_time) * 1000,
                'memory_used_mb': end_memory - start_memory,
                'success': success,
                'error': error,
                'timestamp': time.time(),
                **metadata
            }

            self.metrics.append(metrics)

    def _get_memory_usage(self) -> float:
        """Get current memory usage in MB"""
        import psutil
        return psutil.Process().memory_info().rss / 1024 / 1024

    def get_summary(self) -> Dict:
        """Get performance summary"""
        if not self.metrics:
            return {}

        durations = [m['duration_ms'] for m in self.metrics]
        success_rate = sum(1 for m in self.metrics if m['success']) / len(self.metrics)

        return {
            'total_operations': len(self.metrics),
            'success_rate': success_rate,
            'avg_duration_ms': statistics.mean(durations),
            'p95_duration_ms': statistics.quantiles(durations, n=20)[18] if len(durations) > 1 else 0,
            'p99_duration_ms': statistics.quantiles(durations, n=100)[98] if len(durations) > 1 else 0,
            'total_memory_used_mb': sum(m['memory_used_mb'] for m in self.metrics),
            'operations_by_type': self._group_by_operation()
        }

    def _group_by_operation(self) -> Dict:
        """Group metrics by operation type"""
        grouped = {}
        for metric in self.metrics:
            op = metric['operation']
            if op not in grouped:
                grouped[op] = []
            grouped[op].append(metric)

        return {
            op: {
                'count': len(metrics),
                'avg_duration': statistics.mean([m['duration_ms'] for m in metrics]),
                'success_rate': sum(1 for m in metrics if m['success']) / len(metrics)
            }
            for op, metrics in grouped.items()
        }

async def performance_test():
    """Run performance tests"""
    client = PromptOpsClient(api_key="your-api-key")
    await client.initialize()

    profiler = PerformanceProfiler(client)

    # Test various operations
    test_prompts = ["hello-world", "welcome-message", "customer-service"]
    variables = {"name": "test_user", "company": "Test Corp"}

    for i in range(10):  # Run 10 iterations
        for prompt_id in test_prompts:
            async with profiler.profile_operation("get_prompt", prompt_id=prompt_id):
                await client.get_prompt(prompt_id)

            async with profiler.profile_operation("render_prompt", prompt_id=prompt_id):
                await client.render_prompt(
                    prompt_id=prompt_id,
                    variables=PromptVariables(variables)
                )

    # Print results
    summary = profiler.get_summary()
    print("\n📊 Performance Test Results:")
    print("=" * 40)
    print(f"Total Operations: {summary['total_operations']}")
    print(f"Success Rate: {summary['success_rate']:.2%}")
    print(f"Average Duration: {summary['avg_duration_ms']:.2f}ms")
    print(f"95th Percentile: {summary['p95_duration_ms']:.2f}ms")
    print(f"99th Percentile: {summary['p99_duration_ms']:.2f}ms")
    print(f"Total Memory Used: {summary['total_memory_used_mb']:.2f}MB")

    print("\n📈 Breakdown by Operation:")
    for op, stats in summary['operations_by_type'].items():
        print(f"  {op}: {stats['count']} ops, {stats['avg_duration_ms']:.2f}ms avg, {stats['success_rate']:.2%} success")
```

## 🚨 Error Resolution Matrix

| Error Code | Common Cause | Solution | Prevention |
|------------|---------------|-----------|------------|
| `AUTHENTICATION_ERROR` | Invalid API key | Verify API key in dashboard | Store keys securely, rotate regularly |
| `RATE_LIMIT_ERROR` | Too many requests | Implement retry logic | Use caching, batch requests |
| `TIMEOUT_ERROR` | Slow network/server | Increase timeout | Optimize payloads, use CDN |
| `PROMPT_NOT_FOUND` | Invalid prompt ID | Check prompt ID exists | Validate prompt IDs before use |
| `VALIDATION_ERROR` | Invalid request data | Check request format | Validate input data |
| `NETWORK_ERROR` | Connection issues | Check network connectivity | Implement circuit breakers |
| `SERVER_ERROR` | API server issues | Retry with backoff | Monitor API status page |

## 🔧 Debug Configuration

### 1. Debug Logging Configuration

```python
# debug_config.py
import logging
import sys
from typing import Dict, Any

def setup_debug_logging(level: str = "DEBUG") -> logging.Logger:
    """Set up detailed logging for debugging"""
    logging.basicConfig(
        level=getattr(logging, level),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler('debug.log')
        ]
    )

    # Enable HTTP request logging
    import http.client
    http.client.HTTPConnection.debuglevel = 1

    return logging.getLogger(__name__)

class DebugPromptOpsClient:
    """Wrapper for debugging PromptOps client operations"""

    def __init__(self, base_client, logger: logging.Logger):
        self.client = base_client
        self.logger = logger

    async def debug_request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Log detailed request/response information"""
        self.logger.info(f"🔍 {method} {endpoint}")
        self.logger.debug(f"Request kwargs: {kwargs}")

        start_time = time.time()

        try:
            if method == "GET":
                response = await self.client.get(endpoint, **kwargs)
            elif method == "POST":
                response = await self.client.post(endpoint, **kwargs)
            else:
                raise ValueError(f"Unsupported method: {method}")

            duration = time.time() - start_time
            self.logger.info(f"✅ Response received in {duration:.3f}s")
            self.logger.debug(f"Response: {response}")

            return response

        except Exception as e:
            duration = time.time() - start_time
            self.logger.error(f"❌ Request failed after {duration:.3f}s: {e}")
            self.logger.debug(f"Exception details: {e}", exc_info=True)
            raise
```

### 2. Request/Response Logging

```python
# request_logger.py
import json
from datetime import datetime
from typing import Dict, Any

class RequestLogger:
    def __init__(self, log_file: str = "requests.log"):
        self.log_file = log_file

    def log_request(self, request_data: Dict[str, Any]):
        """Log outgoing request"""
        log_entry = {
            "type": "request",
            "timestamp": datetime.utcnow().isoformat(),
            "data": request_data
        }
        self._write_log(log_entry)

    def log_response(self, response_data: Dict[str, Any]):
        """Log incoming response"""
        log_entry = {
            "type": "response",
            "timestamp": datetime.utcnow().isoformat(),
            "data": response_data
        }
        self._write_log(log_entry)

    def log_error(self, error_data: Dict[str, Any]):
        """Log error information"""
        log_entry = {
            "type": "error",
            "timestamp": datetime.utcnow().isoformat(),
            "data": error_data
        }
        self._write_log(log_entry)

    def _write_log(self, log_entry: Dict[str, Any]):
        """Write log entry to file"""
        with open(self.log_file, "a") as f:
            f.write(json.dumps(log_entry) + "\n")
```

## 📞 Support Resources

### Getting Help

1. **Documentation** - Check this documentation first
2. **Community Forum** - [community.promptops.com](https://community.promptops.com)
3. **Status Page** - [status.promptops.com](https://status.promptops.com)
4. **GitHub Issues** - Report bugs or request features
5. **Email Support** - [support@promptops.com](mailto:support@promptops.com)

### Reporting Issues

When reporting issues, please include:

- **Error messages** - Full error text and stack traces
- **Request details** - API endpoint, headers, payload
- **Environment** - OS, Python/Node.js version, client library version
- **Steps to reproduce** - Clear reproduction steps
- **Expected vs actual behavior** - What you expected vs what happened

### Enterprise Support

For enterprise customers:

- **24/7 Support** - Priority support channels
- **Dedicated Slack** - Direct communication with engineering team
- **On-site Support** - Available for critical issues
- **Custom Integrations** - Assistance with complex implementations

---

*Still having issues? Check our [FAQ](faq.md) or [contact support](mailto:support@promptops.com) for personalized assistance.*