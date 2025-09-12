# Google OAuth Setup Guide

This guide explains how to set up Google OAuth authentication for the PromptOps application.

## Prerequisites

1. Google Cloud Console account
2. Google OAuth Client ID credentials
3. Local development environment running on `http://localhost:3000`

## Step 1: Create Google OAuth Credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** > **Credentials**
4. Click **Create Credentials** > **OAuth client ID**
5. Select **Web application** as the application type
6. Configure the following settings:
   - **Name**: PromptOps Web Application
   - **Authorized JavaScript origins**: `http://localhost:3000`
   - **Authorized redirect URIs**: `http://localhost:3000/auth/google/callback`

7. Click **Create** and copy your **Client ID**

## Step 2: Configure Environment Variables

1. Copy `.env.example` to `.env.local` in the root of the web directory:

```bash
cp .env.example .env.local
```

2. Update the `.env.local` file with your Google OAuth credentials:

```env
VITE_GOOGLE_CLIENT_ID=your-actual-google-client-id
VITE_GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
```

## Step 3: Backend API Setup

The frontend expects a backend API endpoint at `/api/v1/auth/google/callback` to handle the OAuth token exchange. You'll need to implement this endpoint in your backend.

### Expected API Endpoint

```
POST /api/v1/auth/google/callback
Content-Type: application/json

{
  "code": "authorization_code_from_google"
}
```

### Expected Response

```json
{
  "access_token": "jwt_access_token",
  "refresh_token": "jwt_refresh_token",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "organization": "Company Name",
    "avatar": "https://example.com/avatar.jpg",
    "provider_id": "google_user_id",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

## Step 4: Testing the Integration

1. Start your development server:

```bash
npm run dev
```

2. Navigate to `http://localhost:3000`
3. Click the "Continue with Google" button
4. You should be redirected to Google for authentication
5. After successful authentication, you'll be redirected back to the callback page
6. The application will process the callback and log you in

## Security Considerations

1. **HTTPS in Production**: Always use HTTPS in production environments
2. **Client ID Security**: Never expose your client secret in frontend code
3. **State Parameter**: Consider adding CSRF protection with state parameter
4. **Token Storage**: Use HTTP-only cookies for token storage in production
5. **Domain Whitelisting**: Restrict authorized domains to prevent misuse

## Troubleshooting

### Common Issues

1. **"Google Client ID is not configured"**
   - Check that `VITE_GOOGLE_CLIENT_ID` is properly set in your `.env.local` file
   - Restart your development server after making changes

2. **"redirect_uri_mismatch" error**
   - Ensure the redirect URI in Google Cloud Console matches exactly
   - Check for trailing slashes or protocol differences

3. **"access_denied" error**
   - Verify your OAuth consent screen is properly configured
   - Check that your Google Cloud project has the necessary APIs enabled

### Debug Mode

The application includes detailed error logging. Check the browser console for specific error messages during the OAuth flow.

## Implementation Details

### OAuth Flow

1. User clicks "Continue with Google" button
2. Application generates Google OAuth URL and redirects user
3. User authenticates with Google and grants permissions
4. Google redirects back to `/auth/google/callback` with authorization code
5. Frontend sends code to backend API endpoint
6. Backend exchanges code for Google tokens and user info
7. Backend creates/updates user and returns JWT tokens
8. Frontend stores tokens and updates authentication state

### User Session Management

- Access tokens are stored in `localStorage`
- Refresh tokens are stored for token renewal
- Sessions persist across browser restarts
- Automatic token refresh on expiration

### User Data Structure

The Google OAuth integration adds these fields to the user object:

- `provider`: Set to `"google"` for OAuth users
- `providerId`: Google's unique user ID
- `isVerified`: Always `true` for OAuth users
- `avatar`: User's Google profile picture URL

## Production Deployment

For production deployment, you'll need to:

1. Update authorized JavaScript origins and redirect URIs in Google Cloud Console
2. Configure proper domain and SSL certificates
3. Implement proper token storage (HTTP-only cookies)
4. Add CSRF protection
5. Set up proper logging and monitoring

## Support

If you encounter any issues with the Google OAuth integration, please check:

1. Browser console for error messages
2. Network tab for failed API requests
3. Google Cloud Console for credential configuration
4. Environment variable setup