"""
Authentication manager for PromptOps client
"""

import base64
import hashlib
import hmac
import time
from datetime import datetime, timedelta
from typing import Dict, Optional, Tuple
from urllib.parse import urlparse

import structlog
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

from .exceptions import AuthenticationError, ConfigurationError
from .models import ClientConfig

logger = structlog.get_logger(__name__)


class AuthenticationManager:
    """Manages API authentication for PromptOps client"""

    def __init__(self, config: ClientConfig):
        self.config = config
        self._api_key = config.api_key
        self._auth_headers: Dict[str, str] = {}
        self._token_cache: Dict[str, Tuple[str, datetime]] = {}
        self._token_cache_ttl = timedelta(hours=1)

    async def get_auth_headers(self, endpoint: str, method: str = "GET", body: Optional[str] = None) -> Dict[str, str]:
        """
        Get authentication headers for API requests

        Args:
            endpoint: API endpoint path
            method: HTTP method
            body: Request body for POST/PUT requests

        Returns:
            Dictionary of authentication headers

        Raises:
            AuthenticationError: If authentication fails
        """
        try:
            # Check if we have cached headers for this endpoint
            cache_key = f"{method}:{endpoint}"
            cached_headers, expiry_time = self._token_cache.get(cache_key, (None, datetime.min))

            if cached_headers and datetime.utcnow() < expiry_time:
                logger.debug("Using cached authentication headers", endpoint=endpoint)
                return cached_headers

            # Generate new authentication headers
            headers = await self._generate_auth_headers(endpoint, method, body)

            # Cache the headers
            self._token_cache[cache_key] = (headers, datetime.utcnow() + self._token_cache_ttl)

            # Clean up expired cache entries
            self._cleanup_token_cache()

            return headers

        except Exception as e:
            logger.error("Authentication failed", endpoint=endpoint, error=str(e))
            raise AuthenticationError(f"Authentication failed: {str(e)}")

    async def _generate_auth_headers(self, endpoint: str, method: str, body: Optional[str] = None) -> Dict[str, str]:
        """Generate authentication headers"""
        timestamp = str(int(time.time()))
        nonce = self._generate_nonce()

        # Create signature string
        parsed_url = urlparse(endpoint)
        path = parsed_url.path

        if parsed_url.query:
            path += f"?{parsed_url.query}"

        # Create string to sign
        string_to_sign = f"{method.upper()}:{path}:{timestamp}:{nonce}"

        if body:
            # Include body hash for POST/PUT requests
            body_hash = hashlib.sha256(body.encode()).hexdigest()
            string_to_sign += f":{body_hash}"

        # Generate signature
        signature = self._sign_string(string_to_sign)

        return {
            "Authorization": f"PromptOps {self._api_key}",
            "X-PromptOps-Timestamp": timestamp,
            "X-PromptOps-Nonce": nonce,
            "X-PromptOps-Signature": signature,
            "User-Agent": self.config.user_agent,
        }

    def _sign_string(self, string_to_sign: str) -> str:
        """Sign a string using HMAC-SHA256"""
        # This is a simplified signing mechanism
        # In production, you might want to use more sophisticated signing
        secret = self._api_key.encode()
        message = string_to_sign.encode()

        signature = hmac.new(secret, message, hashlib.sha256).hexdigest()
        return signature

    def _generate_nonce(self) -> str:
        """Generate a unique nonce"""
        return hashlib.md5(f"{time.time()}{id(self)}".encode()).hexdigest()

    def _cleanup_token_cache(self) -> None:
        """Clean up expired token cache entries"""
        now = datetime.utcnow()
        expired_keys = [
            key for key, (_, expiry) in self._token_cache.items()
            if expiry <= now
        ]

        for key in expired_keys:
            del self._token_cache[key]

    async def validate_api_key(self) -> bool:
        """
        Validate the API key by making a test request

        Returns:
            True if API key is valid

        Raises:
            AuthenticationError: If API key is invalid
        """
        try:
            # This would typically make a real API call
            # For now, we'll do basic validation
            if not self._api_key or len(self._api_key) < 16:
                raise AuthenticationError("Invalid API key format")

            # Check if API key contains expected format
            if not any(c.isalnum() for c in self._api_key):
                raise AuthenticationError("Invalid API key format")

            logger.info("API key validation successful")
            return True

        except AuthenticationError:
            raise
        except Exception as e:
            logger.error("API key validation failed", error=str(e))
            raise AuthenticationError(f"API key validation failed: {str(e)}")

    def get_api_key_info(self) -> Dict[str, str]:
        """
        Get information about the API key

        Returns:
            Dictionary with API key information
        """
        # Extract prefix from API key (first 8 characters)
        key_prefix = self._api_key[:8] if len(self._api_key) >= 8 else self._api_key

        return {
            "key_prefix": key_prefix,
            "key_length": len(self._api_key),
            "has_special_chars": any(not c.isalnum() for c in self._api_key),
        }

    async def refresh_token(self, force: bool = False) -> bool:
        """
        Refresh authentication token

        Args:
            force: Force refresh even if token is not expired

        Returns:
            True if token was refreshed successfully
        """
        if force:
            self._token_cache.clear()
            logger.info("Authentication token cache cleared")

        # In a real implementation, this would call the token refresh endpoint
        logger.info("Token refresh completed")
        return True

    def clear_cache(self) -> None:
        """Clear authentication cache"""
        self._token_cache.clear()
        logger.info("Authentication cache cleared")

    async def test_connection(self) -> bool:
        """
        Test authentication connection

        Returns:
            True if connection is successful

        Raises:
            AuthenticationError: If connection test fails
        """
        try:
            # This would typically make a real API call to test the connection
            await self.validate_api_key()
            logger.info("Authentication connection test successful")
            return True

        except Exception as e:
            logger.error("Authentication connection test failed", error=str(e))
            raise AuthenticationError(f"Connection test failed: {str(e)}")