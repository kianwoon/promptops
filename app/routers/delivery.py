from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
import structlog

from app.database import get_db
from app.models import Prompt
from app.services.redis_service import get_redis_service
from app.auth import get_current_user

logger = structlog.get_logger()
router = APIRouter()

@router.get("/runtime/{prompt_id}/{version}")
async def get_prompt_runtime(
    prompt_id: str,
    version: str,
    redis_service = Depends(get_redis_service),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Low-latency prompt delivery for runtime use

    Returns prompt content from cache if available, falls back to database
    """
    try:
        # Try cache first for low-latency delivery
        cached_prompt = await redis_service.get_cached_prompt(prompt_id, version)

        if cached_prompt:
            logger.info("Prompt served from cache", prompt_id=prompt_id, version=version)
            return {
                "source": "cache",
                "prompt": cached_prompt,
                "latency": "low"
            }

        # Fallback to database
        prompt = db.query(Prompt).filter(
            Prompt.id == prompt_id,
            Prompt.version == version
        ).first()

        if not prompt:
            raise HTTPException(status_code=404, detail="Prompt not found")

        # Prepare prompt data
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

        # Cache for future requests
        await redis_service.cache_prompt(prompt_id, version, prompt_data)

        logger.info("Prompt served from database", prompt_id=prompt_id, version=version)
        return {
            "source": "database",
            "prompt": prompt_data,
            "latency": "medium"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get prompt runtime", error=str(e), prompt_id=prompt_id, version=version)
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/runtime/{prompt_id}/latest")
async def get_latest_prompt_runtime(
    prompt_id: str,
    redis_service = Depends(get_redis_service),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Get the latest version of a prompt for runtime use

    Returns the most recent version from cache or database
    """
    try:
        # Try cache first
        cached_prompt = await redis_service.get_latest_cached_prompt(prompt_id)

        if cached_prompt:
            logger.info("Latest prompt served from cache", prompt_id=prompt_id)
            return {
                "source": "cache",
                "prompt": cached_prompt,
                "latency": "low"
            }

        # Fallback to database - get latest version
        latest_prompt = db.query(Prompt).filter(
            Prompt.id == prompt_id
        ).order_by(Prompt.updated_at.desc()).first()

        if not latest_prompt:
            raise HTTPException(status_code=404, detail="Prompt not found")

        # Prepare prompt data
        prompt_data = {
            "id": latest_prompt.id,
            "content": latest_prompt.content,
            "description": latest_prompt.description,
            "mas_intent": latest_prompt.mas_intent,
            "mas_fairness_notes": latest_prompt.mas_fairness_notes,
            "mas_testing_notes": latest_prompt.mas_testing_notes,
            "mas_risk_level": latest_prompt.mas_risk_level,
            "version": latest_prompt.version,
            "created_by": latest_prompt.created_by,
            "created_at": latest_prompt.created_at.isoformat(),
            "updated_at": latest_prompt.updated_at.isoformat()
        }

        # Cache for future requests
        await redis_service.cache_prompt(prompt_id, latest_prompt.version, prompt_data)

        logger.info("Latest prompt served from database", prompt_id=prompt_id, version=latest_prompt.version)
        return {
            "source": "database",
            "prompt": prompt_data,
            "latency": "medium"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get latest prompt runtime", error=str(e), prompt_id=prompt_id)
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/runtime/{prompt_id}/{version}/rollback")
async def rollback_prompt_runtime(
    prompt_id: str,
    version: str,
    redis_service = Depends(get_redis_service),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Rollback prompt to a specific version

    This updates the cache to serve the specified version
    """
    try:
        # Verify the target version exists
        target_prompt = db.query(Prompt).filter(
            Prompt.id == prompt_id,
            Prompt.version == version
        ).first()

        if not target_prompt:
            raise HTTPException(status_code=404, detail="Target version not found")

        # Perform rollback
        success = await redis_service.rollback_prompt(prompt_id, version)

        if success:
            return {
                "message": "Prompt rollback completed successfully",
                "prompt_id": prompt_id,
                "rolled_back_to_version": version
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to rollback prompt")

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to rollback prompt runtime", error=str(e), prompt_id=prompt_id, version=version)
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/runtime/{prompt_id}/cache/invalidate")
async def invalidate_prompt_cache(
    prompt_id: str,
    version: Optional[str] = Query(None, description="Specific version to invalidate, or all versions if not provided"),
    redis_service = Depends(get_redis_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Invalidate cached prompt(s)

    Useful for forcing cache refresh after updates
    """
    try:
        success = await redis_service.invalidate_prompt_cache(prompt_id, version)

        if success:
            message = f"Cache invalidated for prompt {prompt_id}"
            if version:
                message += f" version {version}"
            else:
                message += " all versions"

            return {"message": message}
        else:
            raise HTTPException(status_code=500, detail="Failed to invalidate cache")

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to invalidate prompt cache", error=str(e), prompt_id=prompt_id, version=version)
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/runtime/cache/stats")
async def get_cache_stats(
    redis_service = Depends(get_redis_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Get cache statistics and performance metrics
    """
    try:
        stats = await redis_service.get_cache_stats()
        return stats

    except Exception as e:
        logger.error("Failed to get cache stats", error=str(e))
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/runtime/health")
async def runtime_health_check(
    redis_service = Depends(get_redis_service)
):
    """
    Health check for runtime delivery system
    """
    try:
        # Check Redis connection
        redis_healthy = False
        if redis_service.redis_client:
            try:
                await redis_service.redis_client.ping()
                redis_healthy = True
            except:
                pass

        return {
            "status": "healthy" if redis_healthy else "degraded",
            "redis_connected": redis_healthy,
            "message": "Runtime delivery system operational" if redis_healthy else "Redis not available"
        }

    except Exception as e:
        logger.error("Runtime health check failed", error=str(e))
        return {
            "status": "unhealthy",
            "redis_connected": False,
            "message": str(e)
        }