from fastapi import FastAPI, Security, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.middleware import ClientAPIMiddleware, SecurityHeadersMiddleware, RequestIDMiddleware
from app.security_middleware import SecurityMonitoringMiddleware
from app.auth import get_current_user
import structlog
from contextlib import asynccontextmanager

from app.config import settings
from app.database import engine
from app.models import Base
from app.routers import templates, render, aliases, evals, policies, auth, projects, modules, prompts, model_compatibilities, approval_requests, delivery, dashboard, users, client_api, analytics, governance, model_testing, roles, approval_flows, ab_testing

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

# Initialize database tables
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up PromptOps Registry")
    Base.metadata.create_all(bind=engine)
    yield
    logger.info("Shutting down PromptOps Registry")

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Framework-agnostic PromptOps Registry Platform",
    lifespan=lifespan
)

# Add security middleware
app.add_middleware(SecurityHeadersMiddleware)

# Add request ID middleware
app.add_middleware(RequestIDMiddleware)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add client API middleware
app.add_middleware(ClientAPIMiddleware)

# Add security monitoring middleware
app.add_middleware(SecurityMonitoringMiddleware)

# Security
security = HTTPBearer()

# Include routers
app.include_router(templates.router, prefix="/v1/templates", tags=["templates"])
app.include_router(render.router, prefix="/v1", tags=["render"])
app.include_router(aliases.router, prefix="/v1/aliases", tags=["aliases"])
app.include_router(evals.router, prefix="/v1/evaluations", tags=["evaluations"])
app.include_router(policies.router, prefix="/v1/policies", tags=["policies"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["authentication"])

# Include new PromptOps V1 routers
app.include_router(projects.router, prefix="/v1/projects", tags=["projects"])
app.include_router(modules.router, prefix="/v1/modules", tags=["modules"])
app.include_router(prompts.router, prefix="/v1/prompts", tags=["prompts"])
app.include_router(model_compatibilities.router, prefix="/v1/model-compatibilities", tags=["model-compatibilities"])
app.include_router(approval_requests.router, prefix="/v1/approval-requests", tags=["approval-requests"])
app.include_router(delivery.router, prefix="/v1", tags=["runtime-delivery"])
app.include_router(dashboard.router, prefix="/v1", tags=["dashboard"])
app.include_router(dashboard.router, prefix="/api/v1", tags=["dashboard"])
app.include_router(users.router, prefix="/v1/users", tags=["users"])
app.include_router(roles.router, prefix="/v1/roles", tags=["roles"])
app.include_router(approval_flows.router, prefix="/v1/approval-flows", tags=["approval-flows"])

# Include Client API endpoints
app.include_router(client_api.router, prefix="/v1/client", tags=["client-api"])

# Include A/B Testing endpoints
app.include_router(ab_testing.router, prefix="/v1", tags=["ab-testing"])

# Include AI Assistant endpoints with proper database storage and authentication
from app.routers.ai_assistant_final import router as ai_assistant_router
app.include_router(ai_assistant_router, prefix="/v1/ai-assistant", tags=["ai-assistant"])

# Simple user dependency for development
async def get_current_user_dev():
    return {"user_id": "demo-user", "tenant": "demo-tenant", "role": "admin"}

# Add current user dependency for authentication
# NOTE: This middleware is commented out to allow proper JWT authentication
# @app.middleware("http")
# async def auth_middleware(request: Request, call_next):
#     # Add current user to request state for routes that need it
#     # This is a simplified approach - in production you'd want proper JWT validation middleware
#     request.state.current_user = await get_current_user_dev()
#     return await call_next(request)

# Include Analytics endpoints
app.include_router(analytics.router, prefix="/v1/analytics", tags=["analytics"])

# Include Governance endpoints
app.include_router(governance.router, prefix="/v1/governance", tags=["governance"])

# Include Model Testing endpoints
app.include_router(model_testing.router, prefix="/v1/model-testing", tags=["model-testing"])

@app.get("/")
async def root():
    return {"message": "PromptOps Registry API", "version": settings.app_version}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": settings.app_version}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=settings.debug)