#!/usr/bin/env python3
"""
Mock OAuth backend for testing Google OAuth flow
This simulates the backend API endpoint that would handle Google OAuth callback
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import urllib.parse
import urllib.request
import base64
import json
from datetime import datetime, timedelta

# Google OAuth configuration
GOOGLE_CLIENT_ID = "692359932420-0m9r64bum3hffp4l5uqh05slvsl57pgs.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET = "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"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"

class MockOAuthHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/api/v1/auth/google/callback':
            self.handle_google_callback()
        else:
            self.send_response(404)
            self.end_headers()
    
    def handle_google_callback(self):
        """Handle Google OAuth callback"""
        try:
            # Read the request body
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            code = data.get('code')
            
            if not code:
                self.send_error_response("No authorization code provided")
                return
            
            # For testing, we'll simulate a successful OAuth response
            # In a real implementation, you would exchange the code with Google
            user_data = {
                "id": "google_user_123",
                "email": "user@gmail.com",
                "name": "Google User",
                "picture": "https://via.placeholder.com/150",
                "verified_email": True
            }
            
            # Create mock JWT tokens
            access_token = self.create_mock_jwt(user_data, "access")
            refresh_token = self.create_mock_jwt(user_data, "refresh")
            
            # Return success response
            response_data = {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "user": {
                    "id": user_data["id"],
                    "email": user_data["email"],
                    "name": user_data["name"],
                    "role": "user",
                    "organization": "Google User Organization",
                    "avatar": user_data["picture"],
                    "provider_id": user_data["id"],
                    "created_at": datetime.now().isoformat()
                }
            }
            
            self.send_json_response(200, response_data)
            
        except Exception as e:
            print(f"Error handling Google callback: {e}")
            self.send_error_response(f"Authentication failed: {str(e)}")
    
    def create_mock_jwt(self, user_data, token_type):
        """Create a mock JWT token for testing"""
        import time
        
        # JWT header (mock)
        header = {
            "alg": "HS256",
            "typ": "JWT"
        }
        
        # JWT payload (mock)
        exp_time = int(time.time()) + (3600 if token_type == "access" else 604800)
        payload = {
            "sub": user_data["id"],
            "email": user_data["email"],
            "name": user_data["name"],
            "exp": exp_time,
            "iat": int(time.time()),
            "type": token_type
        }
        
        # Create a simple mock token (not a real JWT, just for testing)
        token_data = f"{json.dumps(header)}.{json.dumps(payload)}.mock_signature"
        return base64.b64encode(token_data.encode()).decode()
    
    def send_json_response(self, status_code, data):
        """Send JSON response"""
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
    
    def send_error_response(self, message):
        """Send error response"""
        self.send_json_response(400, {"message": message})
    
    def do_OPTIONS(self):
        """Handle CORS preflight requests"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

def run_server():
    """Run the mock OAuth server"""
    server_address = ('', 8000)
    httpd = HTTPServer(server_address, MockOAuthHandler)
    print("Mock OAuth server running on http://localhost:8000")
    print("Available endpoints:")
    print("  POST /api/v1/auth/google/callback - Handle Google OAuth callback")
    print("\nPress Ctrl+C to stop the server")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        httpd.shutdown()

if __name__ == '__main__':
    run_server()