import json
import redis.asyncio as redis
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
import uuid
import structlog

from app.config import settings
from app.database import get_db
from app.models import Prompt

logger = structlog.get_logger()

class RedisPromptService:
    """Redis service for low-latency prompt delivery and caching"""

    def __init__(self):
        self.redis_client: Optional[redis.Redis] = None
        self.ttl = settings.cache_ttl  # 1 hour default

    async def initialize(self):
        """Initialize Redis connection"""
        try:
            self.redis_client = redis.from_url(
                settings.redis_url,
                encoding="utf-8",
                decode_responses=True
            )
            # Test connection
            await self.redis_client.ping()
            logger.info("Redis connection established successfully")
        except Exception as e:
            logger.error("Failed to connect to Redis", error=str(e))
            raise

    async def close(self):
        """Close Redis connection"""
        if self.redis_client:
            await self.redis_client.close()
            logger.info("Redis connection closed")

    def _get_prompt_key(self, prompt_id: str, version: str) -> str:
        """Generate Redis key for prompt"""
        return f"prompt:{prompt_id}:{version}"

    def _get_project_key(self, project_id: str) -> str:
        """Generate Redis key for project prompts"""
        return f"project:{project_id}:prompts"

    def _get_module_key(self, module_id: str) -> str:
        """Generate Redis key for module prompts"""
        return f"module:{module_id}:prompts"

    async def cache_prompt(self, prompt_id: str, version: str, prompt_data: Dict[str, Any]) -> bool:
        """Cache prompt in Redis for low-latency delivery"""
        if not self.redis_client:
            logger.warning("Redis not initialized, skipping cache")
            return False

        try:
            key = self._get_prompt_key(prompt_id, version)

            # Add metadata to cached data
            cached_data = {
                **prompt_data,
                "cached_at": datetime.utcnow().isoformat(),
                "version": version
            }

            # Cache with TTL
            await self.redis_client.setex(key, self.ttl, json.dumps(cached_data))

            # Update project/module indices
            await self._update_indices(prompt_id, version, prompt_data)

            logger.info("Prompt cached successfully", prompt_id=prompt_id, version=version)
            return True

        except Exception as e:
            logger.error("Failed to cache prompt", error=str(e), prompt_id=prompt_id, version=version)
            return False

    async def get_cached_prompt(self, prompt_id: str, version: str) -> Optional[Dict[str, Any]]:
        """Retrieve prompt from Redis cache"""
        if not self.redis_client:
            return None

        try:
            key = self._get_prompt_key(prompt_id, version)
            cached_data = await self.redis_client.get(key)

            if cached_data:
                data = json.loads(cached_data)
                logger.debug("Prompt retrieved from cache", prompt_id=prompt_id, version=version)
                return data

            return None

        except Exception as e:
            logger.error("Failed to retrieve cached prompt", error=str(e), prompt_id=prompt_id, version=version)
            return None

    async def get_latest_cached_prompt(self, prompt_id: str) -> Optional[Dict[str, Any]]:
        """Get the latest version of a prompt from cache"""
        if not self.redis_client:
            return None

        try:
            # Get all versions for this prompt
            pattern = f"prompt:{prompt_id}:*"
            keys = await self.redis_client.keys(pattern)

            if not keys:
                return None

            # Get the latest version by parsing timestamps
            latest_data = None
            latest_time = None

            for key in keys:
                cached_data = await self.redis_client.get(key)
                if cached_data:
                    data = json.loads(cached_data)
                    cached_time = data.get("cached_at")
                    if cached_time and (latest_time is None or cached_time > latest_time):
                        latest_time = cached_time
                        latest_data = data

            return latest_data

        except Exception as e:
            logger.error("Failed to get latest cached prompt", error=str(e), prompt_id=prompt_id)
            return None

    async def publish_prompt_update(self, prompt_id: str, version: str, action: str = "update"):
        """Publish prompt update via Redis pub/sub for real-time notifications"""
        if not self.redis_client:
            return

        try:
            message = {
                "prompt_id": prompt_id,
                "version": version,
                "action": action,
                "timestamp": datetime.utcnow().isoformat()
            }

            # Publish to prompt-specific channel
            await self.redis_client.publish(f"prompt_updates:{prompt_id}", json.dumps(message))

            # Publish to general updates channel
            await self.redis_client.publish("prompt_updates", json.dumps(message))

            logger.info("Prompt update published", prompt_id=prompt_id, version=version, action=action)

        except Exception as e:
            logger.error("Failed to publish prompt update", error=str(e), prompt_id=prompt_id, version=version)

    async def rollback_prompt(self, prompt_id: str, target_version: str) -> bool:
        """Rollback prompt to specific version"""
        if not self.redis_client:
            return False

        try:
            # Get prompt data from database for target version
            db = next(get_db())
            prompt = db.query(Prompt).filter(
                Prompt.id == prompt_id,
                Prompt.version == target_version
            ).first()

            if not prompt:
                logger.error("Target version not found for rollback", prompt_id=prompt_id, version=target_version)
                return False

            # Prepare prompt data for caching
            prompt_data = {
                "id": prompt.id,
                "content": prompt.content,
                "description": prompt.description,
                "mas_intent": prompt.mas_intent,
                "mas_fairness_notes": prompt.mas_fairness_notes,
                "mas_testing_notes": prompt.mas_testing_notes,
                "mas_risk_level": prompt.mas_risk_level,
                "created_by": prompt.created_by,
                "created_at": prompt.created_at.isoformat(),
                "updated_at": prompt.updated_at.isoformat()
            }

            # Cache the target version
            success = await self.cache_prompt(prompt_id, target_version, prompt_data)

            if success:
                # Publish rollback event
                await self.publish_prompt_update(prompt_id, target_version, "rollback")
                logger.info("Prompt rollback completed", prompt_id=prompt_id, target_version=target_version)

            return success

        except Exception as e:
            logger.error("Failed to rollback prompt", error=str(e), prompt_id=prompt_id, target_version=target_version)
            return False

    async def invalidate_prompt_cache(self, prompt_id: str, version: Optional[str] = None) -> bool:
        """Invalidate cached prompt(s)"""
        if not self.redis_client:
            return False

        try:
            if version:
                # Invalidate specific version
                key = self._get_prompt_key(prompt_id, version)
                await self.redis_client.delete(key)
            else:
                # Invalidate all versions
                pattern = f"prompt:{prompt_id}:*"
                keys = await self.redis_client.keys(pattern)
                if keys:
                    await self.redis_client.delete(*keys)

            logger.info("Prompt cache invalidated", prompt_id=prompt_id, version=version)
            return True

        except Exception as e:
            logger.error("Failed to invalidate prompt cache", error=str(e), prompt_id=prompt_id, version=version)
            return False

    async def get_project_prompts(self, project_id: str) -> Dict[str, Any]:
        """Get all prompts for a project from cache"""
        if not self.redis_client:
            return {}

        try:
            key = self._get_project_key(project_id)
            project_prompts = await self.redis_client.hgetall(key)

            if project_prompts:
                return {k: json.loads(v) for k, v in project_prompts.items()}

            return {}

        except Exception as e:
            logger.error("Failed to get project prompts", error=str(e), project_id=project_id)
            return {}

    async def get_module_prompts(self, module_id: str) -> Dict[str, Any]:
        """Get all prompts for a module from cache"""
        if not self.redis_client:
            return {}

        try:
            key = self._get_module_key(module_id)
            module_prompts = await self.redis_client.hgetall(key)

            if module_prompts:
                return {k: json.loads(v) for k, v in module_prompts.items()}

            return {}

        except Exception as e:
            logger.error("Failed to get module prompts", error=str(e), module_id=module_id)
            return {}

    async def _update_indices(self, prompt_id: str, version: str, prompt_data: Dict[str, Any]):
        """Update project and module indices for faster retrieval"""
        if not self.redis_client:
            return

        try:
            # Extract project_id and module_id from prompt_data
            # This would normally come from the database relationships
            # For now, we'll skip index updates as we need to query the DB for this info
            pass

        except Exception as e:
            logger.error("Failed to update indices", error=str(e), prompt_id=prompt_id)

    async def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        if not self.redis_client:
            return {"error": "Redis not initialized"}

        try:
            info = await self.redis_client.info()
            key_count = await self.redis_client.dbsize()

            return {
                "redis_connected": True,
                "key_count": key_count,
                "used_memory": info.get("used_memory_human", "N/A"),
                "connected_clients": info.get("connected_clients", 0),
                "ttl_seconds": self.ttl
            }

        except Exception as e:
            logger.error("Failed to get cache stats", error=str(e))
            return {"error": str(e)}

# Global Redis service instance
redis_service = RedisPromptService()

# Dependency for FastAPI
async def get_redis_service():
    """Dependency to get Redis service instance"""
    if not redis_service.redis_client:
        await redis_service.initialize()
    return redis_service