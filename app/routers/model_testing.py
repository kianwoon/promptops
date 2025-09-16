from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.model_testing_service import ModelTestingService
from app.schemas import ModelTestRequest, ModelTestResponse
from typing import List, Dict, Any
import structlog

logger = structlog.get_logger()
router = APIRouter()

# Mock user dependency for development (same as dashboard router)
async def get_mock_user():
    """Mock user for development purposes"""
    return {
        "user_id": "demo-user",
        "email": "demo@example.com",
        "roles": ["admin"],
        "tenant": "demo-tenant"
    }


@router.post("/test-prompt-across-providers", response_model=ModelTestResponse)
async def test_prompt_across_providers(
    test_request: ModelTestRequest,
    current_user: dict = Depends(get_mock_user),
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
    current_user: dict = Depends(get_mock_user),
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