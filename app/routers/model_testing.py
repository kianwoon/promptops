from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.model_testing_service import ModelTestingService
from app.schemas import ModelTestRequest, ModelTestResponse
from app.auth import get_current_user
from app.config import settings
from typing import List, Dict, Any
import structlog

logger = structlog.get_logger()
router = APIRouter()


@router.post("/test-prompt-across-providers", response_model=ModelTestResponse)
async def test_prompt_across_providers(
    test_request: ModelTestRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Test a prompt across multiple AI providers simultaneously"""
    try:
        service = ModelTestingService(db)
        result = await service.test_prompt_across_providers(current_user["user_id"], test_request)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Error testing prompt across providers", user_id=current_user.get("user_id"), error=str(e))
        raise HTTPException(status_code=500, detail="Failed to test prompt across providers")


@router.get("/user-providers")
async def get_user_providers(
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's available AI providers for testing"""
    try:
        service = ModelTestingService(db)
        providers = service.get_user_providers_for_testing(current_user["user_id"])
        return {"providers": providers}
    except Exception as e:
        logger.error("Error getting user providers", user_id=current_user.get("user_id"), error=str(e))
        raise HTTPException(status_code=500, detail="Failed to get user providers")