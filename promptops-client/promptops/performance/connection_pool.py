"""
Advanced connection pooling optimization for PromptOps client
"""

import asyncio
import time
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple, Callable
from dataclasses import dataclass, field
import logging
import weakref
import threading
from concurrent.futures import ThreadPoolExecutor

import structlog
import aiohttp

from .models import OptimizationStrategy

logger = structlog.get_logger(__name__)


class PoolStrategy(Enum):
    """Connection pool strategies"""
    FIXED_SIZE = "fixed_size"
    DYNAMIC = "dynamic"
    ADAPTIVE = "adaptive"
    LAZY = "lazy"


class ConnectionState(Enum):
    """Connection states"""
    IDLE = "idle"
    ACTIVE = "active"
    CLOSING = "closing"
    CLOSED = "closed"
    ERROR = "error"


class HealthStatus(Enum):
    """Connection health status"""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"


@dataclass
class ConnectionInfo:
    """Information about a connection"""
    id: str
    created_at: datetime
    last_used: datetime
    state: ConnectionState
    health_status: HealthStatus
    total_requests: int = 0
    total_bytes_sent: int = 0
    total_bytes_received: int = 0
    average_response_time: float = 0.0
    error_count: int = 0
    last_error: Optional[str] = None
    last_health_check: Optional[datetime] = None
    connection_time: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class PoolMetrics:
    """Connection pool metrics"""
    total_connections: int = 0
    active_connections: int = 0
    idle_connections: int = 0
    pending_requests: int = 0
    total_requests: int = 0
    failed_requests: int = 0
    average_wait_time: float = 0.0
    average_response_time: float = 0.0
    pool_utilization: float = 0.0
    connection_creation_rate: float = 0.0
    connection_close_rate: float = 0.0


@dataclass
class PoolConfig:
    """Connection pool configuration"""
    min_size: int = 1
    max_size: int = 10
    max_idle_time: float = 300.0  # 5 minutes
    max_connection_age: float = 3600.0  # 1 hour
    health_check_interval: float = 60.0  # 1 minute
    health_check_timeout: float = 5.0
    connection_timeout: float = 30.0
    acquire_timeout: float = 10.0
    strategy: PoolStrategy = PoolStrategy.ADAPTIVE
    enable_health_checks: bool = True
    enable_metrics: bool = True
    enable_adaptive_sizing: bool = True
    auto_prune: bool = True
    prune_interval: float = 30.0
    adaptive_threshold: float = 0.8  # 80% utilization


class ConnectionPool:
    """Advanced connection pool with adaptive sizing and health monitoring"""

    def __init__(self, config: PoolConfig, connection_factory: Callable):
        self.config = config
        self.connection_factory = connection_factory
        self.connections: Dict[str, Tuple[aiohttp.ClientSession, ConnectionInfo]] = {}
        self.idle_connections: Set[str] = set()
        self.active_connections: Set[str] = set()

        # Request queue
        self.request_queue: asyncio.Queue = asyncio.Queue()
        self.pending_requests: List[asyncio.Future] = []

        # Metrics
        self.metrics = PoolMetrics()
        self.connection_history: List[Dict[str, Any]] = []
        self.performance_history: List[Dict[str, Any]] = []

        # Adaptive sizing
        self.target_size = config.min_size
        self.last_resize_time = datetime.utcnow()
        self.resize_history: List[Dict[str, Any]] = []

        # Background tasks
        self.health_check_task: Optional[asyncio.Task] = None
        self.prune_task: Optional[asyncio.Task] = None
        self.metrics_task: Optional[asyncio.Task] = None
        self.adaptive_task: Optional[asyncio.Task] = None

        # Synchronization
        self._lock = asyncio.Lock()
        self._stats_lock = asyncio.Lock()
        self._running = False

    async def initialize(self) -> None:
        """Initialize the connection pool"""
        if self._running:
            return

        self._running = True
        logger.info("Initializing connection pool", min_size=self.config.min_size, max_size=self.config.max_size)

        # Create initial connections
        await self._create_initial_connections()

        # Start background tasks
        if self.config.enable_health_checks:
            self.health_check_task = asyncio.create_task(self._health_check_loop())

        if self.config.auto_prune:
            self.prune_task = asyncio.create_task(self._prune_loop())

        if self.config.enable_metrics:
            self.metrics_task = asyncio.create_task(self._metrics_loop())

        if self.config.enable_adaptive_sizing:
            self.adaptive_task = asyncio.create_task(self._adaptive_sizing_loop())

    async def _create_initial_connections(self) -> None:
        """Create initial pool connections"""
        async with self._lock:
            for i in range(self.config.min_size):
                try:
                    await self._create_connection()
                except Exception as e:
                    logger.error("Failed to create initial connection", error=str(e))

    async def acquire(self, timeout: Optional[float] = None) -> aiohttp.ClientSession:
        """
        Acquire a connection from the pool

        Args:
            timeout: Acquisition timeout in seconds

        Returns:
            Connection session

        Raises:
            asyncio.TimeoutError: If timeout is reached
            Exception: If connection acquisition fails
        """
        acquire_timeout = timeout or self.config.acquire_timeout
        start_time = time.time()

        async with self._lock:
            # Try to get an idle connection
            if self.idle_connections:
                connection_id = self.idle_connections.pop()
                self.active_connections.add(connection_id)
                session, info = self.connections[connection_id]

                # Update connection info
                info.state = ConnectionState.ACTIVE
                info.last_used = datetime.utcnow()
                info.total_requests += 1

                return session

            # Check if we can create a new connection
            if len(self.connections) < self.config.max_size:
                try:
                    session, info = await self._create_connection()
                    self.active_connections.add(info.id)
                    return session
                except Exception as e:
                    logger.error("Failed to create new connection", error=str(e))

        # If no connections available, wait for one to be released
        self.metrics.pending_requests += 1
        try:
            # Wait for connection to be released
            await asyncio.wait_for(self._wait_for_connection(), timeout=acquire_timeout)

            # Try again to get a connection
            async with self._lock:
                if self.idle_connections:
                    connection_id = self.idle_connections.pop()
                    self.active_connections.add(connection_id)
                    session, info = self.connections[connection_id]

                    info.state = ConnectionState.ACTIVE
                    info.last_used = datetime.utcnow()
                    info.total_requests += 1

                    return session

                raise Exception("No connections available after waiting")

        except asyncio.TimeoutError:
            self.metrics.failed_requests += 1
            raise asyncio.TimeoutError(f"Failed to acquire connection within {acquire_timeout}s")
        finally:
            self.metrics.pending_requests -= 1

    async def _wait_for_connection(self) -> None:
        """Wait for a connection to be released"""
        future = asyncio.Future()
        self.pending_requests.append(future)
        try:
            await future
        finally:
            if future in self.pending_requests:
                self.pending_requests.remove(future)

    async def release(self, session: aiohttp.ClientSession) -> None:
        """
        Release a connection back to the pool

        Args:
            session: Connection session to release
        """
        connection_id = self._find_connection_id(session)
        if not connection_id:
            logger.warning("Attempted to release unknown connection")
            return

        async with self._lock:
            if connection_id in self.active_connections:
                self.active_connections.remove(connection_id)

                # Check connection health before releasing
                info = self.connections[connection_id][1]
                if info.health_status == HealthStatus.HEALTHY:
                    self.idle_connections.add(connection_id)
                    info.state = ConnectionState.IDLE
                    info.last_used = datetime.utcnow()
                else:
                    # Remove unhealthy connection
                    await self._remove_connection(connection_id)

        # Signal waiting requests
        if self.pending_requests:
            future = self.pending_requests.pop(0)
            if not future.done():
                future.set_result(None)

    async def _create_connection(self) -> Tuple[aiohttp.ClientSession, ConnectionInfo]:
        """Create a new connection"""
        start_time = time.time()
        connection_id = f"conn_{len(self.connections)}_{int(time.time() * 1000)}"

        try:
            # Create connection using factory
            session = await self.connection_factory()

            connection_time = time.time() - start_time
            info = ConnectionInfo(
                id=connection_id,
                created_at=datetime.utcnow(),
                last_used=datetime.utcnow(),
                state= ConnectionState.IDLE,
                health_status=HealthStatus.HEALTHY,
                connection_time=connection_time
            )

            self.connections[connection_id] = (session, info)
            self.idle_connections.add(connection_id)

            # Update metrics
            self.metrics.total_connections = len(self.connections)
            self.metrics.connection_creation_rate = self._calculate_connection_creation_rate()

            logger.debug("Created new connection", connection_id=connection_id, time=connection_time)

            return session, info

        except Exception as e:
            logger.error("Failed to create connection", error=str(e))
            raise

    async def _remove_connection(self, connection_id: str) -> None:
        """Remove a connection from the pool"""
        if connection_id not in self.connections:
            return

        session, info = self.connections[connection_id]

        try:
            # Close the session
            await session.close()
        except Exception as e:
            logger.warning("Error closing connection", connection_id=connection_id, error=str(e))

        # Remove from tracking
        del self.connections[connection_id]
        self.idle_connections.discard(connection_id)
        self.active_connections.discard(connection_id)

        # Update metrics
        self.metrics.total_connections = len(self.connections)
        self.metrics.connection_close_rate = self._calculate_connection_close_rate()

        # Add to history
        self.connection_history.append({
            "connection_id": connection_id,
            "action": "removed",
            "timestamp": datetime.utcnow(),
            "lifetime": (datetime.utcnow() - info.created_at).total_seconds(),
            "total_requests": info.total_requests,
            "average_response_time": info.average_response_time
        })

    def _find_connection_id(self, session: aiohttp.ClientSession) -> Optional[str]:
        """Find connection ID for a session"""
        for connection_id, (conn_session, _) in self.connections.items():
            if conn_session == session:
                return connection_id
        return None

    async def _health_check_loop(self) -> None:
        """Background health check loop"""
        while self._running:
            try:
                await self._perform_health_checks()
                await asyncio.sleep(self.config.health_check_interval)
            except Exception as e:
                logger.error("Error in health check loop", error=str(e))
                await asyncio.sleep(60)  # Longer sleep on error

    async def _perform_health_checks(self) -> None:
        """Perform health checks on all connections"""
        async with self._lock:
            connection_ids = list(self.connections.keys())

        for connection_id in connection_ids:
            try:
                await self._check_connection_health(connection_id)
            except Exception as e:
                logger.error("Health check failed for connection", connection_id=connection_id, error=str(e))

    async def _check_connection_health(self, connection_id: str) -> None:
        """Check health of a specific connection"""
        if connection_id not in self.connections:
            return

        session, info = self.connections[connection_id]
        check_start = time.time()

        try:
            # Simple health check - try to make a basic request
            # This is a placeholder - actual health check would depend on the API
            # For now, we'll just check if the session is closed
            if session.closed:
                info.health_status = HealthStatus.UNHEALTHY
                info.last_error = "Connection is closed"
            else:
                info.health_status = HealthStatus.HEALTHY

            info.last_health_check = datetime.utcnow()

        except Exception as e:
            info.health_status = HealthStatus.UNHEALTHY
            info.last_error = str(e)
            info.error_count += 1

        # Remove unhealthy connections
        if info.health_status == HealthStatus.UNHEALTHY and info.error_count > 3:
            await self._remove_connection(connection_id)

    async def _prune_loop(self) -> None:
        """Background connection pruning loop"""
        while self._running:
            try:
                await self._prune_connections()
                await asyncio.sleep(self.config.prune_interval)
            except Exception as e:
                logger.error("Error in prune loop", error=str(e))
                await asyncio.sleep(120)  # Longer sleep on error

    async def _prune_connections(self) -> None:
        """Prune old or idle connections"""
        async with self._lock:
            now = datetime.utcnow()
            connections_to_remove = []

            for connection_id, (_, info) in self.connections.items():
                # Check max connection age
                if (now - info.created_at).total_seconds() > self.config.max_connection_age:
                    connections_to_remove.append(connection_id)
                    continue

                # Check max idle time (only for idle connections)
                if (connection_id in self.idle_connections and
                    (now - info.last_used).total_seconds() > self.config.max_idle_time):
                    connections_to_remove.append(connection_id)

            # Remove connections
            for connection_id in connections_to_remove:
                await self._remove_connection(connection_id)

            logger.debug("Pruned connections", count=len(connections_to_remove))

    async def _adaptive_sizing_loop(self) -> None:
        """Background adaptive sizing loop"""
        while self._running:
            try:
                await self._adjust_pool_size()
                await asyncio.sleep(60)  # Check every minute
            except Exception as e:
                logger.error("Error in adaptive sizing loop", error=str(e))
                await asyncio.sleep(120)

    async def _adjust_pool_size(self) -> None:
        """Adjust pool size based on usage patterns"""
        now = datetime.utcnow()

        # Don't resize too frequently
        if (now - self.last_resize_time).total_seconds() < 300:  # 5 minutes
            return

        current_size = len(self.connections)
        utilization = self._calculate_utilization()

        # Calculate target size based on adaptive algorithm
        if utilization > self.config.adaptive_threshold and current_size < self.config.max_size:
            # High utilization, increase pool size
            new_size = min(current_size + 1, self.config.max_size)
            if new_size > current_size:
                await self._expand_pool(new_size)
                self.last_resize_time = now

        elif utilization < 0.3 and current_size > self.config.min_size:
            # Low utilization, consider shrinking
            new_size = max(current_size - 1, self.config.min_size)
            if new_size < current_size:
                await self._shrink_pool(new_size)
                self.last_resize_time = now

    async def _expand_pool(self, target_size: int) -> None:
        """Expand pool to target size"""
        current_size = len(self.connections)
        connections_to_add = target_size - current_size

        logger.info("Expanding connection pool",
                   current_size=current_size,
                   target_size=target_size,
                   connections_to_add=connections_to_add)

        for i in range(connections_to_add):
            try:
                await self._create_connection()
            except Exception as e:
                logger.error("Failed to expand pool", error=str(e))
                break

    async def _shrink_pool(self, target_size: int) -> None:
        """Shrink pool to target size"""
        current_size = len(self.connections)
        connections_to_remove = current_size - target_size

        logger.info("Shrinking connection pool",
                   current_size=current_size,
                   target_size=target_size,
                   connections_to_remove=connections_to_remove)

        # Remove idle connections first
        removed = 0
        for connection_id in list(self.idle_connections):
            if removed >= connections_to_remove:
                break
            await self._remove_connection(connection_id)
            removed += 1

    def _calculate_utilization(self) -> float:
        """Calculate pool utilization"""
        total_connections = len(self.connections)
        if total_connections == 0:
            return 0.0

        active_connections = len(self.active_connections)
        return active_connections / total_connections

    def _calculate_connection_creation_rate(self) -> float:
        """Calculate connection creation rate"""
        now = datetime.utcnow()
        recent_creations = [
            h for h in self.connection_history[-100:]
            if h["action"] == "created" and (now - h["timestamp"]).total_seconds() < 300
        ]
        return len(recent_creations) / 300.0  # creations per second

    def _calculate_connection_close_rate(self) -> float:
        """Calculate connection close rate"""
        now = datetime.utcnow()
        recent_closures = [
            h for h in self.connection_history[-100:]
            if h["action"] == "removed" and (now - h["timestamp"]).total_seconds() < 300
        ]
        return len(recent_closures) / 300.0  # closures per second

    async def _metrics_loop(self) -> None:
        """Background metrics collection loop"""
        while self._running:
            try:
                await self._update_metrics()
                await asyncio.sleep(10)  # Update every 10 seconds
            except Exception as e:
                logger.error("Error in metrics loop", error=str(e))
                await asyncio.sleep(30)

    async def _update_metrics(self) -> None:
        """Update pool metrics"""
        async with self._stats_lock:
            self.metrics.total_connections = len(self.connections)
            self.metrics.active_connections = len(self.active_connections)
            self.metrics.idle_connections = len(self.idle_connections)
            self.metrics.pool_utilization = self._calculate_utilization()

            # Calculate average response time
            if self.connections:
                total_response_time = sum(info.average_response_time for _, info in self.connections.values())
                self.metrics.average_response_time = total_response_time / len(self.connections)

            # Add to performance history
            self.performance_history.append({
                "timestamp": datetime.utcnow(),
                "metrics": self.metrics.__dict__.copy(),
                "connections": len(self.connections),
                "active": len(self.active_connections),
                "idle": len(self.idle_connections)
            })

            # Keep only recent history
            if len(self.performance_history) > 1000:
                self.performance_history = self.performance_history[-1000:]

    def get_metrics(self) -> PoolMetrics:
        """Get current pool metrics"""
        return PoolMetrics(**self.metrics.__dict__)

    def get_connection_info(self) -> List[Dict[str, Any]]:
        """Get information about all connections"""
        return [
            {
                "id": info.id,
                "state": info.state.value,
                "health_status": info.health_status.value,
                "created_at": info.created_at.isoformat(),
                "last_used": info.last_used.isoformat(),
                "total_requests": info.total_requests,
                "average_response_time": info.average_response_time,
                "error_count": info.error_count,
                "last_error": info.last_error
            }
            for _, info in self.connections.values()
        ]

    async def close(self) -> None:
        """Close all connections and shutdown the pool"""
        self._running = False

        # Cancel background tasks
        if self.health_check_task:
            self.health_check_task.cancel()
        if self.prune_task:
            self.prune_task.cancel()
        if self.metrics_task:
            self.metrics_task.cancel()
        if self.adaptive_task:
            self.adaptive_task.cancel()

        # Close all connections
        async with self._lock:
            connection_ids = list(self.connections.keys())
            for connection_id in connection_ids:
                await self._remove_connection(connection_id)

        logger.info("Connection pool closed")

    def get_optimization_recommendations(self) -> List[Dict[str, Any]]:
        """Get optimization recommendations for the connection pool"""
        recommendations = []

        metrics = self.get_metrics()

        # Check pool utilization
        if metrics.pool_utilization > 0.9:
            recommendations.append({
                "strategy": OptimizationStrategy.CONNECTION_POOLING,
                "title": "High pool utilization",
                "description": f"Pool utilization is {metrics.pool_utilization:.1%}. Consider increasing max_size.",
                "current_value": metrics.pool_utilization,
                "target_value": 0.8,
                "priority": "high"
            })

        # Check for too many idle connections
        if metrics.idle_connections > metrics.max_size * 0.7:
            recommendations.append({
                "strategy": OptimizationStrategy.CONNECTION_POOLING,
                "title": "Too many idle connections",
                "description": f"High number of idle connections ({metrics.idle_connections}). Consider reducing min_size.",
                "current_value": metrics.idle_connections,
                "target_value": metrics.max_size * 0.3,
                "priority": "medium"
            })

        # Check connection creation rate
        if metrics.connection_creation_rate > 0.1:  # More than 1 connection every 10 seconds
            recommendations.append({
                "strategy": OptimizationStrategy.CONNECTION_POOLING,
                "title": "High connection creation rate",
                "description": f"Creating {metrics.connection_creation_rate:.2f} connections per second. Consider increasing pool size.",
                "current_value": metrics.connection_creation_rate,
                "target_value": 0.01,
                "priority": "high"
            })

        # Check average response time
        if metrics.average_response_time > 5.0:  # More than 5 seconds
            recommendations.append({
                "strategy": OptimizationStrategy.CONNECTION_POOLING,
                "title": "High average response time",
                "description": f"Average response time is {metrics.average_response_time:.2f}s. Consider connection health checks.",
                "current_value": metrics.average_response_time,
                "target_value": 2.0,
                "priority": "medium"
            })

        return recommendations