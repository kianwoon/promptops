# Production Deployment Guide

## Quick Start

1. **Environment Setup**
   ```bash
   cp .env.production .env
   # Fill in all required environment variables
   ```

2. **Build and Deploy**
   ```bash
   docker-compose up -d --build
   ```

3. **Health Check**
   ```bash
   curl http://localhost/health
   ```

## Google OAuth Setup

1. **Google Cloud Console**
   - Create OAuth 2.0 Client ID
   - Add authorized redirect URI: `https://yourdomain.com/api/v1/auth/google/callback`
   - Download credentials and update environment variables

2. **Environment Variables**
   ```bash
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   GOOGLE_REDIRECT_URI=https://yourdomain.com/api/v1/auth/google/callback
   ```

## Production Security

1. **Generate Strong Secret Key**
   ```bash
   openssl rand -hex 32
   ```

2. **Database Password**
   ```bash
   openssl rand -base64 16
   ```

3. **SSL/TLS Configuration**
   - Add SSL certificates to `./ssl/` directory
   - Update nginx configuration for HTTPS

## Monitoring and Logging

- **Application logs**: Check `./logs/` directory
- **Nginx logs**: `/var/log/nginx/`
- **Health checks**: `http://localhost/health`

## Backup Strategy

1. **Database Backup**
   ```bash
   docker exec postgres pg_dump -U promptops promptops > backup.sql
   ```

2. **Redis Backup**
   ```bash
   docker exec redis redis-cli SAVE
   ```

## Scaling

1. **Horizontal Scaling**
   - Add more backend instances
   - Use load balancer

2. **Vertical Scaling**
   - Increase resource limits in docker-compose.yml
   - Optimize database performance

## Troubleshooting

1. **Container Issues**
   ```bash
   docker-compose logs backend
   docker-compose logs postgres
   ```

2. **Database Connection**
   - Check DATABASE_URL
   - Verify postgres container is running

3. **Google OAuth Issues**
   - Verify redirect URIs match
   - Check Google Cloud Console settings