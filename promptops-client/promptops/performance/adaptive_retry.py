"""
Adaptive retry mechanisms with intelligent backoff strategies
"""

import asyncio
import random
import time
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Tuple, Union
import logging

import structlog

from .models import OptimizationStrategy

logger = structlog.get_logger(__name__)


class RetryStrategy(Enum):
    """Retry strategy types"""
    EXPONENTIAL_BACKOFF = "exponential_backoff"
    LINEAR_BACKOFF = "linear_backoff"
    FIXED_DELAY = "fixed_delay"
    FIBONACCI_BACKOFF = "fibonacci_backoff"
    ADAPTIVE_BACKOFF = "adaptive_backoff"


class RetryDecision(Enum):
    """Retry decision types"""
    RETRY = "retry"
    ABORT = "abort"
    CIRCUIT_BREAKER = "circuit_breaker"


class RetryOutcome:
    """Outcome of a retry attempt"""
    def __init__(self, success: bool, attempts: int, total_time: float,
                 last_error: Optional[Exception] = None):
        self.success = success
        self.attempts = attempts
        self.total_time = total_time
        self.last_error = last_error
        self.timestamp = datetime.utcnow()


class AdaptiveRetryConfig:
    """Configuration for adaptive retry mechanisms"""
    def __init__(self,
                 max_attempts: int = 3,
                 base_delay: float = 1.0,
                 max_delay: float = 60.0,
                 strategy: RetryStrategy = RetryStrategy.EXPONENTIAL_BACKOFF,
                 jitter: bool = True,
                 exponential_base: float = 2.0,
                 timeout_multiplier: float = 1.5,
                 enable_circuit_breaker: bool = True,
                 circuit_breaker_threshold: int = 5,
                 circuit_breaker_timeout: float = 60.0,
                 enable_rate_limit_detection: bool = True,
                 success_rate_threshold: float = 0.5,
                 error_rate_threshold: float = 0.3):
        self.max_attempts = max_attempts
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.strategy = strategy
        self.jitter = jitter
        self.exponential_base = exponential_base
        self.timeout_multiplier = timeout_multiplier
        self.enable_circuit_breaker = enable_circuit_breaker
        self.circuit_breaker_threshold = circuit_breaker_threshold
        self.circuit_breaker_timeout = circuit_breaker_timeout
        self.enable_rate_limit_detection = enable_rate_limit_detection
        self.success_rate_threshold = success_rate_threshold
        self.error_rate_threshold = error_rate_threshold


class CircuitBreaker:
    """Circuit breaker implementation for adaptive retry"""
    def __init__(self, failure_threshold: int, timeout: float):
        self.failure_threshold = failure_threshold
        self.timeout = timeout
        self.failure_count = 0
        self.last_failure_time = None
        self.state = "closed"  # closed, open, half_open

    def call_allowed(self) -> bool:
        """Check if calls are allowed based on circuit breaker state"""
        if self.state == "closed":
            return True
        elif self.state == "open":
            if (self.last_failure_time and
                (datetime.utcnow() - self.last_failure_time).total_seconds() > self.timeout):
                self.state = "half_open"
                return True
            return False
        else:  # half_open
            return True

    def record_success(self) -> None:
        """Record a successful call"""
        self.failure_count = 0
        self.state = "closed"

    def record_failure(self) -> None:
        """Record a failed call"""
        self.failure_count += 1
        self.last_failure_time = datetime.utcnow()
        if self.failure_count >= self.failure_threshold:
            self.state = "open"


class AdaptiveRetryManager:
    """Adaptive retry manager with intelligent backoff strategies"""

    def __init__(self, config: AdaptiveRetryConfig):
        self.config = config
        self.circuit_breaker = CircuitBreaker(
            config.circuit_breaker_threshold,
            config.circuit_breaker_timeout
        )

        # Performance tracking
        self.request_history: List[Dict[str, Any]] = []
        self.error_patterns: Dict[str, List[float]] = {}
        self.success_rates: Dict[str, float] = {}
        self.adaptive_params: Dict[str, Dict[str, float]] = {}

        # Rate limit detection
        self.rate_limit_windows: Dict[str, List[datetime]] = {}
        self.rate_limit_detected: Dict[str, bool] = {}

        self._history_max_size = 1000

    async def execute_with_retry(self,
                               func: Callable,
                               operation_name: str,
                               *args,
                               **kwargs) -> RetryOutcome:
        """
        Execute a function with adaptive retry logic

        Args:
            func: Function to execute
            operation_name: Name of the operation for tracking
            *args: Function arguments
            **kwargs: Function keyword arguments

        Returns:
            RetryOutcome with execution results
        """
        start_time = time.time()
        attempts = 0
        last_error = None

        # Check circuit breaker
        if not self.circuit_breaker.call_allowed():
            return RetryOutcome(
                success=False,
                attempts=0,
                total_time=0.0,
                last_error=Exception("Circuit breaker is open")
            )

        for attempt in range(self.config.max_attempts):
            attempts += 1
            attempt_start = time.time()

            try:
                # Calculate delay for this attempt (except first)
                if attempt > 0:
                    delay = self._calculate_delay(operation_name, attempt, last_error)
                    await asyncio.sleep(delay)

                # Execute the function
                result = await func(*args, **kwargs)

                # Record success
                execution_time = time.time() - attempt_start
                self._record_success(operation_name, execution_time, attempt)
                self.circuit_breaker.record_success()

                return RetryOutcome(
                    success=True,
                    attempts=attempts,
                    total_time=time.time() - start_time,
                    last_error=None
                )

            except Exception as e:
                execution_time = time.time() - attempt_start
                last_error = e

                # Record failure
                self._record_failure(operation_name, execution_time, attempt, e)

                # Check if we should retry
                retry_decision = self._should_retry(operation_name, attempt, e)
                if retry_decision == RetryDecision.ABORT:
                    break
                elif retry_decision == RetryDecision.CIRCUIT_BREAKER:
                    self.circuit_breaker.record_failure()
                    break

        # All attempts failed
        self.circuit_breaker.record_failure()
        return RetryOutcome(
            success=False,
            attempts=attempts,
            total_time=time.time() - start_time,
            last_error=last_error
        )

    def _calculate_delay(self, operation_name: str, attempt: int, error: Optional[Exception]) -> float:
        """Calculate delay for next retry attempt"""
        base_delay = self.config.base_delay

        if self.config.strategy == RetryStrategy.EXPONENTIAL_BACKOFF:
            delay = base_delay * (self.config.exponential_base ** (attempt - 1))
        elif self.config.strategy == RetryStrategy.LINEAR_BACKOFF:
            delay = base_delay * attempt
        elif self.config.strategy == RetryStrategy.FIXED_DELAY:
            delay = base_delay
        elif self.config.strategy == RetryStrategy.FIBONACCI_BACKOFF:
            delay = base_delay * self._fibonacci(attempt)
        elif self.config.strategy == RetryStrategy.ADAPTIVE_BACKOFF:
            delay = self._calculate_adaptive_delay(operation_name, attempt, error)
        else:
            delay = base_delay

        # Apply jitter
        if self.config.jitter:
            delay = delay * (0.5 + random.random() * 0.5)

        # Cap at max delay
        delay = min(delay, self.config.max_delay)

        return delay

    def _calculate_adaptive_delay(self, operation_name: str, attempt: int, error: Optional[Exception]) -> float:
        """Calculate adaptive delay based on historical performance"""
        # Get adaptive parameters for this operation
        if operation_name not in self.adaptive_params:
            self.adaptive_params[operation_name] = {
                "success_rate": 1.0,
                "avg_latency": 1.0,
                "error_rate": 0.0,
                "last_adaptation": time.time()
            }

        params = self.adaptive_params[operation_name]

        # Base delay with adaptation
        base_delay = self.config.base_delay

        # Increase delay based on error rate
        error_multiplier = 1.0 + params["error_rate"] * 2

        # Increase delay based on recent failures
        recent_failures = len([
            r for r in self.request_history[-10:]
            if r["operation"] == operation_name and not r["success"]
        ])
        failure_multiplier = 1.0 + (recent_failures * 0.2)

        # Adjust based on rate limit detection
        if self._is_rate_limited(operation_name):
            rate_limit_multiplier = 2.0
        else:
            rate_limit_multiplier = 1.0

        # Calculate final delay
        delay = base_delay * error_multiplier * failure_multiplier * rate_limit_multiplier

        # Apply exponential component
        delay *= (self.config.exponential_base ** (attempt - 1))

        return delay

    def _should_retry(self, operation_name: str, attempt: int, error: Exception) -> RetryDecision:
        """Determine if we should retry based on error and conditions"""
        # Don't retry on max attempts
        if attempt >= self.config.max_attempts:
            return RetryDecision.ABORT

        # Check for non-retryable errors
        error_str = str(error).lower()
        non_retryable_errors = [
            "authentication failed",
            "authorization failed",
            "invalid api key",
            "not found",
            "permission denied"
        ]

        if any(err in error_str for err in non_retryable_errors):
            return RetryDecision.ABORT

        # Check for rate limiting
        if self.config.enable_rate_limit_detection:
            if self._is_rate_limited(operation_name):
                # For rate limits, we might want to wait longer
                return RetryDecision.RETRY

        # Check error patterns
        if self._has_persistent_errors(operation_name):
            return RetryDecision.CIRCUIT_BREAKER

        # Default: retry
        return RetryDecision.RETRY

    def _record_success(self, operation_name: str, execution_time: float, attempt: int) -> None:
        """Record a successful operation"""
        record = {
            "operation": operation_name,
            "success": True,
            "execution_time": execution_time,
            "attempt": attempt,
            "timestamp": datetime.utcnow()
        }

        self._add_to_history(record)
        self._update_performance_metrics(operation_name)

    def _record_failure(self, operation_name: str, execution_time: float, attempt: int, error: Exception) -> None:
        """Record a failed operation"""
        record = {
            "operation": operation_name,
            "success": False,
            "execution_time": execution_time,
            "attempt": attempt,
            "error": str(error),
            "error_type": type(error).__name__,
            "timestamp": datetime.utcnow()
        }

        self._add_to_history(record)
        self._update_performance_metrics(operation_name)

        # Update rate limit detection
        if self.config.enable_rate_limit_detection:
            self._update_rate_limit_detection(operation_name, error)

    def _add_to_history(self, record: Dict[str, Any]) -> None:
        """Add record to request history"""
        self.request_history.append(record)

        # Maintain history size
        if len(self.request_history) > self._history_max_size:
            self.request_history = self.request_history[-self._history_max_size:]

    def _update_performance_metrics(self, operation_name: str) -> None:
        """Update performance metrics for an operation"""
        # Get recent history for this operation
        recent_records = [
            r for r in self.request_history[-100:]
            if r["operation"] == operation_name
        ]

        if len(recent_records) < 5:  # Not enough data
            return

        # Calculate success rate
        success_count = sum(1 for r in recent_records if r["success"])
        success_rate = success_count / len(recent_records)

        # Calculate error rate
        error_rate = 1.0 - success_rate

        # Calculate average latency for successful operations
        successful_records = [r for r in recent_records if r["success"]]
        if successful_records:
            avg_latency = sum(r["execution_time"] for r in successful_records) / len(successful_records)
        else:
            avg_latency = 0

        # Update adaptive parameters
        if operation_name not in self.adaptive_params:
            self.adaptive_params[operation_name] = {}

        self.adaptive_params[operation_name].update({
            "success_rate": success_rate,
            "avg_latency": avg_latency,
            "error_rate": error_rate,
            "last_adaptation": time.time()
        })

    def _update_rate_limit_detection(self, operation_name: str, error: Exception) -> None:
        """Update rate limit detection based on errors"""
        error_str = str(error).lower()

        # Check if error indicates rate limiting
        rate_limit_indicators = [
            "rate limit",
            "too many requests",
            "quota exceeded",
            "429",
            "throttled"
        ]

        is_rate_limit = any(indicator in error_str for indicator in rate_limit_indicators)

        if is_rate_limit:
            if operation_name not in self.rate_limit_windows:
                self.rate_limit_windows[operation_name] = []

            self.rate_limit_windows[operation_name].append(datetime.utcnow())

            # Keep only recent rate limit events (within 1 minute)
            cutoff = datetime.utcnow() - timedelta(minutes=1)
            self.rate_limit_windows[operation_name] = [
                t for t in self.rate_limit_windows[operation_name] if t > cutoff
            ]

            # Mark as rate limited if we have multiple events in a short time
            if len(self.rate_limit_windows[operation_name]) >= 3:
                self.rate_limit_detected[operation_name] = True

    def _is_rate_limited(self, operation_name: str) -> bool:
        """Check if operation is currently rate limited"""
        return self.rate_limit_detected.get(operation_name, False)

    def _has_persistent_errors(self, operation_name: str) -> bool:
        """Check if operation has persistent errors"""
        recent_records = [
            r for r in self.request_history[-20:]
            if r["operation"] == operation_name
        ]

        if len(recent_records) < 10:
            return False

        # Check if success rate is below threshold
        success_count = sum(1 for r in recent_records if r["success"])
        success_rate = success_count / len(recent_records)

        return success_rate < self.config.success_rate_threshold

    def _fibonacci(self, n: int) -> int:
        """Calculate nth Fibonacci number"""
        if n <= 1:
            return n

        a, b = 0, 1
        for _ in range(2, n + 1):
            a, b = b, a + b

        return b

    def get_performance_summary(self, operation_name: Optional[str] = None) -> Dict[str, Any]:
        """Get performance summary for operations"""
        if operation_name:
            return self._get_operation_summary(operation_name)
        else:
            return self._get_global_summary()

    def _get_operation_summary(self, operation_name: str) -> Dict[str, Any]:
        """Get summary for specific operation"""
        records = [r for r in self.request_history if r["operation"] == operation_name]

        if not records:
            return {"operation": operation_name, "message": "No data available"}

        success_count = sum(1 for r in records if r["success"])
        total_requests = len(records)

        return {
            "operation": operation_name,
            "total_requests": total_requests,
            "successful_requests": success_count,
            "success_rate": success_count / total_requests,
            "avg_attempts": sum(r["attempt"] for r in records) / total_requests,
            "avg_execution_time": sum(r["execution_time"] for r in records) / total_requests,
            "circuit_breaker_state": self.circuit_breaker.state,
            "adaptive_params": self.adaptive_params.get(operation_name, {}),
            "rate_limited": self._is_rate_limited(operation_name)
        }

    def _get_global_summary(self) -> Dict[str, Any]:
        """Get global performance summary"""
        total_requests = len(self.request_history)
        if total_requests == 0:
            return {"message": "No data available"}

        success_count = sum(1 for r in self.request_history if r["success"])

        return {
            "total_requests": total_requests,
            "successful_requests": success_count,
            "overall_success_rate": success_count / total_requests,
            "operations_tracked": len(set(r["operation"] for r in self.request_history)),
            "circuit_breaker_state": self.circuit_breaker.state,
            "rate_limit_detected": len(self.rate_limit_detected),
            "adaptive_params": self.adaptive_params
        }

    def reset_operation(self, operation_name: str) -> None:
        """Reset tracking for a specific operation"""
        # Remove from history
        self.request_history = [r for r in self.request_history if r["operation"] != operation_name]

        # Reset adaptive parameters
        if operation_name in self.adaptive_params:
            del self.adaptive_params[operation_name]

        # Reset rate limit detection
        if operation_name in self.rate_limit_detected:
            del self.rate_limit_detected[operation_name]

        if operation_name in self.rate_limit_windows:
            del self.rate_limit_windows[operation_name]

    def get_optimization_recommendations(self) -> List[Dict[str, Any]]:
        """Get optimization recommendations based on performance data"""
        recommendations = []

        # Check overall success rate
        if self.request_history:
            success_count = sum(1 for r in self.request_history if r["success"])
            overall_success_rate = success_count / len(self.request_history)

            if overall_success_rate < self.config.success_rate_threshold:
                recommendations.append({
                    "strategy": OptimizationStrategy.ADAPTIVE_RETRY,
                    "title": "Low overall success rate",
                    "description": f"Overall success rate is {overall_success_rate:.1%}. Consider adjusting retry parameters.",
                    "current_value": overall_success_rate,
                    "target_value": self.config.success_rate_threshold,
                    "priority": "high"
                })

        # Check individual operations
        for operation_name, params in self.adaptive_params.items():
            if params["error_rate"] > self.config.error_rate_threshold:
                recommendations.append({
                    "strategy": OptimizationStrategy.ADAPTIVE_RETRY,
                    "title": f"High error rate for {operation_name}",
                    "description": f"Error rate of {params['error_rate']:.1%} detected. Consider circuit breaker or longer delays.",
                    "current_value": params["error_rate"],
                    "target_value": self.config.error_rate_threshold,
                    "priority": "medium"
                })

        # Check rate limited operations
        rate_limited_ops = [op for op, limited in self.rate_limit_detected.items() if limited]
        if rate_limited_ops:
            recommendations.append({
                "strategy": OptimizationStrategy.ADAPTIVE_RETRY,
                "title": "Rate limiting detected",
                "description": f"Rate limiting detected for {len(rate_limited_ops)} operations. Consider implementing backoff strategies.",
                "affected_operations": rate_limited_ops,
                "priority": "high"
            })

        return recommendations