from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
import time
import structlog
from typing import Optional, Dict, Any
import json

logger = structlog.get_logger()

class ClientAPIMiddleware(BaseHTTPMiddleware):
    """Middleware for client API endpoints to handle usage logging and authentication"""

    async def dispatch(self, request: Request, call_next):
        start_time = time.time()

        # Skip logging for health check and root endpoints
        if request.url.path in ["/", "/health"]:
            return await call_next(request)

        # Process the request
        response = await call_next(request)

        # Calculate processing time
        processing_time_ms = int((time.time() - start_time) * 1000)

        # Check if this is a client API endpoint
        if request.url.path.startswith("/v1/client/"):
            await self.log_client_api_usage(request, response, processing_time_ms)

        return response

    async def log_client_api_usage(self, request: Request, response: Response, processing_time_ms: int):
        """Log client API usage"""
        try:
            # Try to get user info from request state (set by authentication)
            user_info = getattr(request.state, 'user', None)

            if user_info and isinstance(user_info, dict):
                # Extract usage data from request and response
                usage_data = await self.extract_usage_data(request, response, processing_time_ms)

                # Log usage asynchronously (in production, use a message queue)
                logger.info(
                    "Client API request processed",
                    **usage_data,
                    user_id=user_info.get("user_id"),
                    tenant_id=user_info.get("tenant_id"),
                    api_key_id=user_info.get("api_key_id")
                )

        except Exception as e:
            logger.error("Failed to log client API usage", error=str(e))

    async def extract_usage_data(self, request: Request, response: Response, processing_time_ms: int) -> Dict[str, Any]:
        """Extract usage data from request and response"""
        usage_data = {
            "endpoint": request.url.path,
            "method": request.method,
            "status_code": response.status_code,
            "processing_time_ms": processing_time_ms,
            "user_agent": request.headers.get("user-agent"),
            "ip_address": request.client.host if request.client else None,
            "request_id": request.headers.get("X-Request-ID")
        }

        # Extract prompt_id from path if available
        if "/prompts/" in request.url.path:
            path_parts = request.url.path.split("/")
            try:
                prompt_index = path_parts.index("prompts") + 1
                if prompt_index < len(path_parts):
                    usage_data["prompt_id"] = path_parts[prompt_index]
            except ValueError:
                pass

        # Extract project_id from query parameters
        project_id = request.query_params.get("project_id")
        if project_id:
            usage_data["project_id"] = project_id

        # Extract token usage from response if available
        try:
            if response.body:
                response_body = json.loads(response.body.decode())
                if isinstance(response_body, dict):
                    usage_data["tokens_used"] = response_body.get("tokens_used")
                    usage_data["tokens_requested"] = response_body.get("tokens_requested")
                    usage_data["estimated_cost_usd"] = response_body.get("estimated_cost_usd")
        except (json.JSONDecodeError, UnicodeDecodeError, AttributeError):
            pass

        # Add error message if request failed
        if response.status_code >= 400:
            try:
                if response.body:
                    response_body = json.loads(response.body.decode())
                    if isinstance(response_body, dict):
                        usage_data["error_message"] = response_body.get("detail", str(response_body))
            except (json.JSONDecodeError, UnicodeDecodeError, AttributeError):
                usage_data["error_message"] = f"HTTP {response.status_code}"

        usage_data["response_size"] = len(response.body) if hasattr(response, 'body') and response.body else 0

        return usage_data

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware to add security headers"""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        # Add security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Add API version header
        response.headers["X-API-Version"] = "v1"

        return response

class RequestIDMiddleware(BaseHTTPMiddleware):
    """Middleware to add request ID for tracing"""

    async def dispatch(self, request: Request, call_next):
        # Generate or get request ID
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())

        # Add request ID to request state for access in endpoints
        request.state.request_id = request_id

        # Process request
        response = await call_next(request)

        # Add request ID to response headers
        response.headers["X-Request-ID"] = request_id

        return response

# Import uuid at the top level
import uuid