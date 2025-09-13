# Advanced Topics

This section covers advanced concepts, optimization techniques, and best practices for experienced PromptOps users.

## 📚 Documentation Contents

### [Caching Strategies](caching.md) - Multi-level caching, optimization, and cache management
### [Performance Optimization](performance.md) - Latency reduction, throughput optimization, and scaling
### [Security Best Practices](security.md) - Authentication, encryption, and security hardening
### [Variable Substitution Patterns](variables.md) - Advanced variable handling and templating
### [Model-Specific Prompts](models.md) - AI model optimization and provider-specific features
### [Testing Strategies](testing.md) - Unit, integration, and load testing approaches
### [Monitoring & Observability](monitoring.md) - Advanced monitoring, metrics, and alerting

## 🎯 Advanced Concepts

### 1. Performance Optimization

- **Multi-level caching** - Memory, Redis, and hybrid caching strategies
- **Batch operations** - Efficient bulk request processing
- **Connection pooling** - Optimize database and API connections
- **Async processing** - Non-blocking operations for high throughput
- **Load balancing** - Distribute requests across multiple instances

### 2. Scalability Patterns

- **Horizontal scaling** - Scale out with multiple application instances
- **Vertical scaling** - Scale up individual server resources
- **Microservices** - Decompose into specialized services
- **Serverless** - Event-driven, pay-per-use architecture
- **Edge computing** - Process data closer to users

### 3. Reliability & Resilience

- **Circuit breakers** - Prevent cascading failures
- **Retry mechanisms** - Handle transient failures gracefully
- **Graceful degradation** - Maintain partial functionality during outages
- **Health checks** - Monitor system health continuously
- **Disaster recovery** - Backup and recovery procedures

### 4. Security & Compliance

- **Zero-trust architecture** - Verify every request
- **Encryption at rest** - Secure data storage
- **Audit logging** - Track all system activities
- **Access controls** - Implement least privilege
- **Compliance frameworks** - Meet regulatory requirements

## 🚀 Advanced Integration Patterns

### 1. Multi-tenant Architecture

```python
# Multi-tenant prompt service
class MultiTenantPromptService:
    def __init__(self, base_config):
        self.tenant_configs = {}
        self.base_config = base_config

    async def add_tenant(self, tenant_id: str, api_key: str, config_override: dict = None):
        """Add a new tenant with isolated configuration"""
        config = {**self.base_config, **(config_override or {})}
        config['api_key'] = api_key

        self.tenant_configs[tenant_id] = PromptOpsClient(config)
        await self.tenant_configs[tenant_id].initialize()

    async def get_tenant_prompt(self, tenant_id: str, prompt_id: str, variables: dict):
        """Get prompt for specific tenant with isolation"""
        if tenant_id not in self.tenant_configs:
            raise ValueError(f"Tenant {tenant_id} not found")

        return await self.tenant_configs[tenant_id].render_prompt(
            prompt_id=prompt_id,
            variables=PromptVariables(variables)
        )
```

### 2. Event-Driven Architecture

```python
# Event-driven prompt processing
import asyncio
from dataclasses import dataclass
from typing import Callable, Awaitable

@dataclass
class PromptEvent:
    event_type: str
    prompt_id: str
    tenant_id: str
    variables: dict
    timestamp: datetime
    correlation_id: str

class EventDrivenPromptService:
    def __init__(self, client: PromptOpsClient):
        self.client = client
        self.subscribers: dict[str, list[Callable[[PromptEvent], Awaitable[None]]]] = {}
        self.event_queue = asyncio.Queue()

    async def publish_event(self, event: PromptEvent):
        """Publish event to subscribers"""
        self.event_queue.put_nowait(event)

    async def subscribe(self, event_type: str, handler: Callable):
        """Subscribe to specific event types"""
        if event_type not in self.subscribers:
            self.subscribers[event_type] = []
        self.subscribers[event_type].append(handler)

    async def process_events(self):
        """Process events from queue"""
        while True:
            event = await self.event_queue.get()

            if event.event_type in self.subscribers:
                await asyncio.gather(*[
                    handler(event)
                    for handler in self.subscribers[event.event_type]
                ], return_exceptions=True)

    async def process_prompt_with_events(self, prompt_id: str, variables: dict, tenant_id: str):
        """Process prompt and publish events"""
        start_time = datetime.utcnow()
        correlation_id = str(uuid.uuid4())

        # Publish before event
        await self.publish_event(PromptEvent(
            event_type="prompt.requested",
            prompt_id=prompt_id,
            tenant_id=tenant_id,
            variables=variables,
            timestamp=start_time,
            correlation_id=correlation_id
        ))

        try:
            result = await self.client.render_prompt(
                prompt_id=prompt_id,
                variables=PromptVariables(variables)
            )

            # Publish success event
            await self.publish_event(PromptEvent(
                event_type="prompt.completed",
                prompt_id=prompt_id,
                tenant_id=tenant_id,
                variables=variables,
                timestamp=datetime.utcnow(),
                correlation_id=correlation_id
            ))

            return result

        except Exception as error:
            # Publish error event
            await self.publish_event(PromptEvent(
                event_type="prompt.failed",
                prompt_id=prompt_id,
                tenant_id=tenant_id,
                variables=variables,
                timestamp=datetime.utcnow(),
                correlation_id=correlation_id
            ))
            raise
```

### 3. Prompt Versioning and Rollback

```python
# Version management system
from typing import Optional, List
from dataclasses import dataclass
from enum import Enum

class VersionStatus(Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    DEPRECATED = "deprecated"
    ARCHIVED = "archived"

@dataclass
class PromptVersion:
    version: str
    content: str
    variables: List[str]
    status: VersionStatus
    created_at: datetime
    created_by: str
    metadata: dict

class VersionedPromptService:
    def __init__(self, client: PromptOpsClient):
        self.client = client
        self.version_cache = {}  # Cache version metadata

    async def create_version(self, prompt_id: str, content: str, variables: List[str], author: str) -> PromptVersion:
        """Create new version of prompt"""
        # Generate version number
        versions = await self.list_versions(prompt_id)
        new_version = self._increment_version(versions)

        version = PromptVersion(
            version=new_version,
            content=content,
            variables=variables,
            status=VersionStatus.DRAFT,
            created_at=datetime.utcnow(),
            created_by=author,
            metadata={}
        )

        # Store version (this would integrate with your storage system)
        await self._store_version(prompt_id, version)

        return version

    async def activate_version(self, prompt_id: str, version: str) -> None:
        """Activate specific version"""
        # Deactivate current active version
        versions = await self.list_versions(prompt_id)
        for v in versions:
            if v.status == VersionStatus.ACTIVE:
                v.status = VersionStatus.DEPRECATED
                await self._update_version_status(prompt_id, v.version, VersionStatus.DEPRECATED)

        # Activate new version
        await self._update_version_status(prompt_id, version, VersionStatus.ACTIVE)

    async def rollback_to_version(self, prompt_id: str, version: str) -> None:
        """Rollback to previous version"""
        await self.activate_version(prompt_id, version)

    async def get_active_version(self, prompt_id: str) -> Optional[PromptVersion]:
        """Get currently active version"""
        versions = await self.list_versions(prompt_id)
        active_versions = [v for v in versions if v.status == VersionStatus.ACTIVE]
        return active_versions[0] if active_versions else None

    async def compare_versions(self, prompt_id: str, version1: str, version2: str) -> dict:
        """Compare two versions"""
        v1 = await self._get_version(prompt_id, version1)
        v2 = await self._get_version(prompt_id, version2)

        return {
            "version1": v1.version,
            "version2": v2.version,
            "content_changes": self._calculate_diff(v1.content, v2.content),
            "variable_changes": self._calculate_list_diff(v1.variables, v2.variables),
            "metadata_changes": self._calculate_dict_diff(v1.metadata, v2.metadata)
        }
```

## 🔧 Advanced Configuration

### 1. Dynamic Configuration Loading

```python
# Dynamic configuration management
import yaml
import json
from pathlib import Path
from typing import Dict, Any
import asyncio

class ConfigLoader:
    def __init__(self, config_path: str):
        self.config_path = Path(config_path)
        self.config = {}
        self.watchers = {}
        self.reload_callbacks = []

    async def load_config(self) -> Dict[str, Any]:
        """Load configuration from file"""
        if self.config_path.suffix.lower() in ['.yaml', '.yml']:
            with open(self.config_path) as f:
                self.config = yaml.safe_load(f)
        elif self.config_path.suffix.lower() == '.json':
            with open(self.config_path) as f:
                self.config = json.load(f)
        else:
            raise ValueError(f"Unsupported config format: {self.config_path.suffix}")

        return self.config

    async def watch_config(self):
        """Watch configuration file for changes"""
        last_modified = self.config_path.stat().st_mtime

        while True:
            await asyncio.sleep(5)  # Check every 5 seconds

            try:
                current_modified = self.config_path.stat().st_mtime
                if current_modified != last_modified:
                    last_modified = current_modified
                    await self.load_config()

                    # Trigger reload callbacks
                    for callback in self.reload_callbacks:
                        await callback(self.config)
            except FileNotFoundError:
                # File was deleted
                await asyncio.sleep(30)  # Wait longer before retrying

    def on_reload(self, callback):
        """Add callback for configuration reload"""
        self.reload_callbacks.append(callback)

# Usage with PromptOps
class DynamicPromptOpsService:
    def __init__(self, config_path: str):
        self.config_loader = ConfigLoader(config_path)
        self.client = None

    async def initialize(self):
        """Initialize with dynamic configuration"""
        config = await self.config_loader.load_config()
        await self._create_client(config)

        # Set up config reloading
        self.config_loader.on_reload(self._handle_config_reload)
        asyncio.create_task(self.config_loader.watch_config())

    async def _create_client(self, config: Dict[str, Any]):
        """Create PromptOps client with current config"""
        if self.client:
            await self.client.shutdown()

        promptops_config = ClientConfig(
            base_url=config['promptops']['base_url'],
            api_key=config['promptops']['api_key'],
            timeout=config['promptops'].get('timeout', 30.0),
            cache=CacheConfig(**config.get('cache', {})),
            telemetry=TelemetryConfig(**config.get('telemetry', {}))
        )

        self.client = PromptOpsClient(promptops_config)
        await self.client.initialize()

    async def _handle_config_reload(self, new_config: Dict[str, Any]):
        """Handle configuration reload"""
        print("Configuration reloaded, updating client...")
        await self._create_client(new_config)
```

### 2. Circuit Breaker Pattern

```python
# Circuit breaker for external API calls
import asyncio
import time
from enum import Enum
from typing import Callable, Any, Optional
from dataclasses import dataclass

class CircuitState(Enum):
    CLOSED = "closed"      # Normal operation
    OPEN = "open"          # Circuit is open, fail fast
    HALF_OPEN = "half_open"  # Testing if service has recovered

@dataclass
class CircuitBreakerConfig:
    failure_threshold: int = 5          # Number of failures before opening
    recovery_timeout: int = 60         # Seconds to wait before trying again
    expected_exception: tuple = (Exception,)  # Exceptions that count as failures
    timeout: Optional[int] = None      # Request timeout

class CircuitBreaker:
    def __init__(self, config: CircuitBreakerConfig):
        self.config = config
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.last_failure_time = None
        self.success_count = 0

    async def call(self, func: Callable, *args, **kwargs) -> Any:
        """Execute function with circuit breaker protection"""

        if self.state == CircuitState.OPEN:
            if self._should_attempt_reset():
                self.state = CircuitState.HALF_OPEN
                self.success_count = 0
            else:
                raise CircuitBreakerOpenError("Circuit breaker is open")

        try:
            if self.config.timeout:
                result = await asyncio.wait_for(
                    func(*args, **kwargs),
                    timeout=self.config.timeout
                )
            else:
                result = await func(*args, **kwargs)

            self._on_success()
            return result

        except self.config.expected_exception as e:
            self._on_failure()
            raise e

    def _should_attempt_reset(self) -> bool:
        """Check if enough time has passed to attempt reset"""
        if self.last_failure_time is None:
            return False

        return (time.time() - self.last_failure_time) >= self.config.recovery_timeout

    def _on_success(self):
        """Handle successful call"""
        self.failure_count = 0

        if self.state == CircuitState.HALF_OPEN:
            self.success_count += 1
            if self.success_count >= 3:  # Need 3 consecutive successes
                self.state = CircuitState.CLOSED

    def _on_failure(self):
        """Handle failed call"""
        self.failure_count += 1
        self.last_failure_time = time.time()

        if self.failure_count >= self.config.failure_threshold:
            self.state = CircuitState.OPEN

# Usage with PromptOps
class ResilientPromptService:
    def __init__(self, base_config):
        self.circuit_breaker = CircuitBreaker(CircuitBreakerConfig(
            failure_threshold=5,
            recovery_timeout=60,
            timeout=30.0
        ))

        # Initialize with retry
        self.client = PromptOpsClient(base_config)

    async def get_prompt_with_circuit_breaker(self, prompt_id: str, variables: dict):
        """Get prompt with circuit breaker protection"""
        try:
            return await self.circuit_breaker.call(
                self.client.render_prompt,
                prompt_id=prompt_id,
                variables=PromptVariables(variables)
            )
        except CircuitBreakerOpenError:
            # Return fallback content
            return await self.get_fallback_prompt(prompt_id, variables)
```

## 📊 Advanced Monitoring

### 1. Distributed Tracing

```python
# OpenTelemetry integration
from opentelemetry import trace, metrics
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.exporter.jaeger.thrift import JaegerExporter
from opentelemetry.exporter.prometheus import PrometheusMetricReader
import asyncio

class PromptOpsTracer:
    def __init__(self, service_name: str):
        # Set up tracing
        tracer_provider = TracerProvider()
        trace.set_tracer_provider(tracer_provider)

        # Set up metrics
        meter_provider = MeterProvider()
        metrics.set_meter_provider(meter_provider)

        # Configure exporters
        jaeger_exporter = JaegerExporter(
            agent_host_name="localhost",
            agent_port=6831,
        )

        self.tracer = trace.get_tracer(service_name)
        self.meter = metrics.get_meter(service_name)

        # Create custom metrics
        self.prompt_counter = self.meter.create_counter(
            "promptops.prompts.processed",
            description="Number of prompts processed"
        )
        self.prompt_duration = self.meter.create_histogram(
            "promptops.prompt.duration",
            description="Duration of prompt processing",
            unit="ms"
        )

    async def trace_prompt_operation(self, prompt_id: str, operation: str, func: Callable):
        """Trace a prompt operation with OpenTelemetry"""
        with self.tracer.start_as_current_span(f"promptops.{operation}") as span:
            span.set_attribute("prompt.id", prompt_id)
            span.set_attribute("operation.type", operation)

            start_time = asyncio.get_event_loop().time()
            try:
                result = await func()

                # Record metrics
                duration = (asyncio.get_event_loop().time() - start_time) * 1000
                self.prompt_counter.add(1, {"prompt_id": prompt_id, "operation": operation})
                self.prompt_duration.record(duration, {"prompt_id": prompt_id})

                span.set_attribute("success", True)
                return result

            except Exception as e:
                span.set_attribute("success", False)
                span.set_attribute("error.message", str(e))
                span.set_status(trace.Status(trace.StatusCode.ERROR, str(e)))
                raise
```

### 2. Custom Metrics and Alerting

```python
# Advanced metrics collection
from dataclasses import dataclass
from typing import Dict, List
import statistics
from datetime import datetime, timedelta

@dataclass
class PromptMetrics:
    prompt_id: str
    total_requests: int
    successful_requests: int
    failed_requests: int
    average_response_time: float
    p95_response_time: float
    p99_response_time: float
    cache_hit_rate: float
    error_rate: float
    last_updated: datetime

class AdvancedMetricsCollector:
    def __init__(self, client: PromptOpsClient):
        self.client = client
        self.metrics_history: Dict[str, List[dict]] = {}
        self.alert_thresholds = {
            'error_rate': 0.1,      # 10%
            'response_time_p95': 2000,  # 2 seconds
            'cache_hit_rate': 0.5,   # 50%
        }

    async def collect_metrics(self) -> Dict[str, PromptMetrics]:
        """Collect comprehensive metrics for all prompts"""
        prompt_stats = self.client.get_stats()
        cache_stats = self.client.get_cache_stats()

        # Get list of prompts being used
        prompt_ids = self._get_active_prompt_ids()

        metrics = {}
        for prompt_id in prompt_ids:
            metrics[prompt_id] = await self._collect_prompt_metrics(prompt_id)

        return metrics

    async def _collect_prompt_metrics(self, prompt_id: str) -> PromptMetrics:
        """Collect metrics for specific prompt"""
        # This would be implemented with your metrics collection system
        # For now, we'll use placeholder data

        return PromptMetrics(
            prompt_id=prompt_id,
            total_requests=1000,
            successful_requests=950,
            failed_requests=50,
            average_response_time=150.5,
            p95_response_time=500.0,
            p99_response_time=1200.0,
            cache_hit_rate=0.85,
            error_rate=0.05,
            last_updated=datetime.utcnow()
        )

    def check_alerts(self, metrics: Dict[str, PromptMetrics]) -> List[dict]:
        """Check for alert conditions"""
        alerts = []

        for prompt_id, metric in metrics.items():
            # Check error rate
            if metric.error_rate > self.alert_thresholds['error_rate']:
                alerts.append({
                    'type': 'high_error_rate',
                    'prompt_id': prompt_id,
                    'current_value': metric.error_rate,
                    'threshold': self.alert_thresholds['error_rate'],
                    'severity': 'critical'
                })

            # Check response time
            if metric.p95_response_time > self.alert_thresholds['response_time_p95']:
                alerts.append({
                    'type': 'slow_response',
                    'prompt_id': prompt_id,
                    'current_value': metric.p95_response_time,
                    'threshold': self.alert_thresholds['response_time_p95'],
                    'severity': 'warning'
                })

            # Check cache hit rate
            if metric.cache_hit_rate < self.alert_thresholds['cache_hit_rate']:
                alerts.append({
                    'type': 'low_cache_hit_rate',
                    'prompt_id': prompt_id,
                    'current_value': metric.cache_hit_rate,
                    'threshold': self.alert_thresholds['cache_hit_rate'],
                    'severity': 'warning'
                })

        return alerts
```

## 🚀 Next Steps

1. **Explore Specific Topics** - Dive into detailed guides for your use case
2. **Implement Patterns** - Apply advanced patterns to your application
3. **Optimize Performance** - Use performance optimization techniques
4. **Enhance Security** - Implement security best practices
5. **Set Up Monitoring** - Deploy comprehensive monitoring solutions

## 📚 Additional Resources

- [Getting Started](../getting-started/) - Quick start guides
- [API Reference](../api-reference/) - Complete API documentation
- [Examples](../examples/) - Integration examples
- [Deployment](../deployment/) - Production deployment guides
- [Troubleshooting](../troubleshooting/) - Common issues and solutions

---

*Looking for advanced implementation help? Check our [enterprise documentation](https://docs.promptops.com/enterprise) or [contact support](mailto:enterprise@promptops.com)*