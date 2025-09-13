"""
Telemetry manager for PromptOps client usage tracking
"""

import json
import threading
import time
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

import structlog
from tenacity import retry, stop_after_attempt, wait_exponential

from .exceptions import TelemetryError
from .models import TelemetryConfig, TelemetryEvent

logger = structlog.get_logger(__name__)


class TelemetryManager:
    """Manages telemetry and usage analytics for PromptOps client"""

    def __init__(self, config: TelemetryConfig):
        self.config = config
        self._session_id = str(uuid.uuid4())
        self._events: List[TelemetryEvent] = []
        self._lock = threading.Lock()
        self._last_flush_time = time.time()
        self._disabled = not config.enabled

        # Start background flush thread if enabled
        if not self._disabled and config.endpoint:
            self._start_flush_thread()

    def track_event(self, event_type: str, properties: Optional[Dict[str, Any]] = None, measurements: Optional[Dict[str, float]] = None) -> None:
        """
        Track a telemetry event

        Args:
            event_type: Type of event
            properties: Event properties
            measurements: Event measurements (numeric values)
        """
        if self._disabled:
            return

        # Apply sampling
        if self.config.sample_rate < 1.0 and time.random() > self.config.sample_rate:
            return

        event = TelemetryEvent(
            event_type=event_type,
            timestamp=datetime.utcnow(),
            session_id=self._session_id,
            properties=properties or {},
            measurements=measurements or {}
        )

        with self._lock:
            self._events.append(event)

        # Flush if batch size reached
        if len(self._events) >= self.config.batch_size:
            self._flush_events()

    def track_request(self, endpoint: str, method: str, duration: float, status_code: int, error: Optional[str] = None) -> None:
        """
        Track an API request

        Args:
            endpoint: API endpoint
            method: HTTP method
            duration: Request duration in seconds
            status_code: HTTP status code
            error: Error message if request failed
        """
        properties = {
            "endpoint": endpoint,
            "method": method,
            "status_code": status_code,
            "success": status_code < 400
        }

        if error:
            properties["error"] = error

        measurements = {
            "duration_ms": duration * 1000
        }

        self.track_event("api_request", properties, measurements)

    def track_prompt_usage(self, prompt_id: str, version: str, model_provider: str, model_name: str, duration: float) -> None:
        """
        Track prompt usage

        Args:
            prompt_id: Prompt ID
            version: Prompt version
            model_provider: Model provider
            model_name: Model name
            duration: Processing duration in seconds
        """
        properties = {
            "prompt_id": prompt_id,
            "version": version,
            "model_provider": model_provider,
            "model_name": model_name
        }

        measurements = {
            "duration_ms": duration * 1000
        }

        self.track_event("prompt_usage", properties, measurements)

    def track_cache_hit(self, cache_type: str, key: str) -> None:
        """
        Track cache hit

        Args:
            cache_type: Type of cache (memory, redis)
            key: Cache key
        """
        properties = {
            "cache_type": cache_type,
            "key": key
        }

        self.track_event("cache_hit", properties)

    def track_cache_miss(self, cache_type: str, key: str) -> None:
        """
        Track cache miss

        Args:
            cache_type: Type of cache (memory, redis)
            key: Cache key
        """
        properties = {
            "cache_type": cache_type,
            "key": key
        }

        self.track_event("cache_miss", properties)

    def track_error(self, error_type: str, error_message: str, context: Optional[Dict[str, Any]] = None) -> None:
        """
        Track an error

        Args:
            error_type: Type of error
            error_message: Error message
            context: Error context
        """
        properties = {
            "error_type": error_type,
            "error_message": error_message
        }

        if context:
            properties["context"] = context

        self.track_event("error", properties)

    def track_user_action(self, action: str, properties: Optional[Dict[str, Any]] = None) -> None:
        """
        Track user action

        Args:
            action: User action
            properties: Action properties
        """
        self.track_event("user_action", properties or {"action": action})

    def set_user_id(self, user_id: str) -> None:
        """Set user ID for telemetry events"""
        with self._lock:
            for event in self._events:
                if event.user_id is None:
                    event.user_id = user_id

    def _start_flush_thread(self) -> None:
        """Start background thread for periodic flushing"""
        def flush_worker():
            while not self._disabled:
                time.sleep(self.config.flush_interval)
                try:
                    self._flush_events()
                except Exception as e:
                    logger.error("Telemetry flush failed", error=str(e))

        thread = threading.Thread(target=flush_worker, daemon=True)
        thread.start()

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        reraise=True
    )
    def _flush_events(self) -> None:
        """Flush events to telemetry endpoint"""
        if self._disabled or not self.config.endpoint:
            return

        with self._lock:
            if not self._events:
                return

            events_to_flush = self._events.copy()
            self._events.clear()

        try:
            # This would typically make an HTTP request to the telemetry endpoint
            # For now, we'll just log the events
            logger.info(
                "Flushing telemetry events",
                count=len(events_to_flush),
                endpoint=self.config.endpoint
            )

            # In a real implementation, this would be:
            # async with httpx.AsyncClient() as client:
            #     response = await client.post(
            #         self.config.endpoint,
            #         json=[event.dict() for event in events_to_flush],
            #         timeout=10.0
            #     )
            #     response.raise_for_status()

            self._last_flush_time = time.time()

        except Exception as e:
            logger.error("Telemetry flush failed", error=str(e))
            # Re-queue failed events
            with self._lock:
                self._events.extend(events_to_flush)
            raise TelemetryError(f"Telemetry flush failed: {str(e)}")

    def get_session_id(self) -> str:
        """Get current session ID"""
        return self._session_id

    def get_event_count(self) -> int:
        """Get number of pending events"""
        with self._lock:
            return len(self._events)

    def flush(self) -> None:
        """Manually flush pending events"""
        self._flush_events()

    def disable(self) -> None:
        """Disable telemetry"""
        self._disabled = True
        logger.info("Telemetry disabled")

    def enable(self) -> None:
        """Enable telemetry"""
        if self.config.enabled:
            self._disabled = False
            logger.info("Telemetry enabled")

    def reset_session(self) -> None:
        """Reset session ID"""
        self._session_id = str(uuid.uuid4())
        logger.info("Telemetry session reset", new_session_id=self._session_id)

    def get_summary(self) -> Dict[str, Any]:
        """Get telemetry summary"""
        with self._lock:
            event_types = {}
            for event in self._events:
                event_types[event.event_type] = event_types.get(event.event_type, 0) + 1

        return {
            "session_id": self._session_id,
            "enabled": not self._disabled,
            "pending_events": len(self._events),
            "event_types": event_types,
            "last_flush": self._last_flush_time
        }