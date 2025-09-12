from fastapi import FastAPI, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import structlog
from contextlib import asynccontextmanager

from app.config import settings
from app.database import engine
from app.models import Base
from app.routers import templates, render, aliases, evals, policies, auth

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

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)):
    # TODO: Implement proper JWT validation
    # For now, just return a mock user
    return {"user_id": "demo-user", "tenant": "demo-tenant"}

# Include routers
app.include_router(templates.router, prefix="/v1/templates", tags=["templates"])
app.include_router(render.router, prefix="/v1", tags=["render"])
app.include_router(aliases.router, prefix="/v1/aliases", tags=["aliases"])
app.include_router(evals.router, prefix="/v1/evals", tags=["evaluations"])
app.include_router(policies.router, prefix="/v1/policies", tags=["policies"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["authentication"])

@app.get("/")
async def root():
    return {"message": "PromptOps Registry API", "version": settings.app_version}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": settings.app_version}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=settings.debug)