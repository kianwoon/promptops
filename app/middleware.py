from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
import time
import structlog
from typing import Optional, Dict, Any
import json
import uuid
from datetime import datetime

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
            logger.error(f"Failed to log client API usage: {str(e)}")

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

class AuditLogMiddleware(BaseHTTPMiddleware):
    """Middleware for comprehensive audit logging of all system activities"""

    def __init__(self, app: ASGIApp, exclude_paths: list = None):
        super().__init__(app)
        self.exclude_paths = exclude_paths or [
            "/health",
            "/metrics",
            "/docs",
            "/redoc",
            "/openapi.json",
            "/static"
        ]

    async def dispatch(self, request: Request, call_next):
        start_time = time.time()

        # Skip logging for excluded paths
        if any(request.url.path.startswith(path) for path in self.exclude_paths):
            return await call_next(request)

        # Extract request information
        request_info = await self.extract_request_info(request)

        # Process the request
        response = await call_next(request)

        # Calculate processing time
        processing_time_ms = int((time.time() - start_time) * 1000)

        # Create audit log entry
        await self.create_audit_log(request, response, request_info, processing_time_ms)

        return response

    async def extract_request_info(self, request: Request) -> Dict[str, Any]:
        """Extract relevant information from the request"""
        request_info = {
            "method": request.method,
            "path": request.url.path,
            "query_params": dict(request.query_params),
            "headers": dict(request.headers),
            "client_host": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent"),
        }

        # Try to get user info from request state
        user_info = getattr(request.state, 'user', None)
        if user_info and isinstance(user_info, dict):
            request_info["user_id"] = user_info.get("user_id")
            request_info["tenant_id"] = user_info.get("tenant_id")
            request_info["roles"] = user_info.get("roles", [])

        # Try to get request ID
        request_id = getattr(request.state, 'request_id', None) or request.headers.get("X-Request-ID")
        if request_id:
            request_info["request_id"] = request_id

        # Extract session ID if available
        session_id = request.headers.get("Authorization") or request.headers.get("X-Session-ID")
        if session_id:
            request_info["session_id"] = session_id

        return request_info

    async def create_audit_log(self, request: Request, response: Response, request_info: Dict[str, Any], processing_time_ms: int):
        """Create audit log entry"""
        try:
            # Map request to audit action and subject
            audit_action, subject_type, subject_id = self.map_request_to_audit_action(request, request_info)

            # Determine result
            result = "success" if response.status_code < 400 else "failure"

            # Extract error message if any
            error_message = None
            if response.status_code >= 400:
                try:
                    if hasattr(response, 'body') and response.body:
                        response_body = json.loads(response.body.decode())
                        if isinstance(response_body, dict):
                            error_message = response_body.get("detail", str(response_body))
                except (json.JSONDecodeError, UnicodeDecodeError, AttributeError):
                    error_message = f"HTTP {response.status_code}"

            # Create audit log data
            audit_data = {
                "id": str(uuid.uuid4()),
                "actor": request_info.get("user_id", "anonymous"),
                "action": audit_action,
                "subject": f"{subject_type}:{subject_id}",
                "subject_type": subject_type,
                "subject_id": subject_id,
                "tenant_id": request_info.get("tenant_id", "default"),
                "result": result,
                "error_message": error_message,
                "ip_address": request_info.get("client_host"),
                "user_agent": request_info.get("user_agent"),
                "session_id": request_info.get("session_id"),
                "request_id": request_info.get("request_id"),
                "metadata_json": {
                    "method": request_info["method"],
                    "path": request_info["path"],
                    "query_params": request_info["query_params"],
                    "status_code": response.status_code,
                    "processing_time_ms": processing_time_ms,
                    "user_roles": request_info.get("roles", []),
                },
                "ts": datetime.utcnow()
            }

            # Extract changes for certain actions
            if request.method in ["POST", "PUT", "PATCH", "DELETE"]:
                changes = await self.extract_changes(request, response)
                if changes:
                    audit_data["changes_json"] = changes

            # Log audit entry (in production, use async logging or message queue)
            logger.info("Audit log entry created", **audit_data)

            # In a real implementation, you would save to the database here
            # For now, we'll just log it. You can extend this to save to the AuditLog model.

        except Exception as e:
            logger.error(f"Failed to create audit log entry: {str(e)}")

    def map_request_to_audit_action(self, request: Request, request_info: Dict[str, Any]) -> tuple[str, str, str]:
        """Map HTTP request to audit action and subject"""
        method = request.method
        path = request.url.path

        # Default mapping
        action = f"http_{method.lower()}"
        subject_type = "endpoint"
        subject_id = path

        # User-related actions
        if "/users" in path:
            subject_type = "user"
            if method == "POST":
                action = "create_user"
            elif method == "PUT":
                action = "update_user"
            elif method == "DELETE":
                action = "delete_user"

            # Extract user ID from path
            if "/users/" in path:
                parts = path.split("/")
                try:
                    user_index = parts.index("users") + 1
                    if user_index < len(parts):
                        subject_id = parts[user_index]
                except ValueError:
                    pass

        # Project-related actions
        elif "/projects" in path:
            subject_type = "project"
            if method == "POST":
                action = "create_project"
            elif method == "PUT":
                action = "update_project"
            elif method == "DELETE":
                action = "delete_project"

            # Extract project ID from path
            if "/projects/" in path:
                parts = path.split("/")
                try:
                    project_index = parts.index("projects") + 1
                    if project_index < len(parts):
                        subject_id = parts[project_index]
                except ValueError:
                    pass

        # Module-related actions
        elif "/modules" in path:
            subject_type = "module"
            if method == "POST":
                action = "create_module"
            elif method == "PUT":
                action = "update_module"
            elif method == "DELETE":
                action = "delete_module"

        # Prompt-related actions
        elif "/prompts" in path:
            subject_type = "prompt"
            if method == "POST":
                action = "create_prompt"
            elif method == "PUT":
                action = "update_prompt"
            elif method == "DELETE":
                action = "delete_prompt"

        # Template-related actions
        elif "/templates" in path:
            subject_type = "template"
            if method == "POST":
                action = "create_template"
            elif method == "PUT":
                action = "update_template"
            elif method == "DELETE":
                action = "delete_template"

        # Governance-related actions
        elif "/governance" in path:
            subject_type = "governance"
            if "/roles" in path:
                subject_type = "role"
                if method == "POST":
                    action = "create_role"
                elif method == "PUT":
                    action = "update_role"
                elif method == "DELETE":
                    action = "delete_role"
            elif "/permissions" in path:
                subject_type = "permission"
                if method == "POST":
                    action = "create_permission"
                elif method == "PUT":
                    action = "update_permission"
                elif method == "DELETE":
                    action = "delete_permission"

        # Authentication actions
        elif "/auth" in path:
            subject_type = "authentication"
            if "/login" in path:
                action = "login"
            elif "/logout" in path:
                action = "logout"

        # API Key actions
        elif "/api-keys" in path:
            subject_type = "api_key"
            if method == "POST":
                action = "create_api_key"
            elif method == "PUT":
                action = "update_api_key"
            elif method == "DELETE":
                action = "delete_api_key"

        return action, subject_type, subject_id

    async def extract_changes(self, request: Request, response: Response) -> Optional[Dict[str, Any]]:
        """Extract changes made by the request"""
        try:
            changes = {}

            # For PUT/PATCH requests, try to get request body
            if request.method in ["PUT", "PATCH"]:
                body = await request.body()
                if body:
                    try:
                        request_data = json.loads(body.decode())
                        changes["request_data"] = request_data
                    except (json.JSONDecodeError, UnicodeDecodeError):
                        pass

            # For responses, try to get response data
            if hasattr(response, 'body') and response.body:
                try:
                    response_data = json.loads(response.body.decode())
                    if isinstance(response_data, dict):
                        changes["response_data"] = response_data
                except (json.JSONDecodeError, UnicodeDecodeError):
                    pass

            return changes if changes else None

        except Exception:
            return None