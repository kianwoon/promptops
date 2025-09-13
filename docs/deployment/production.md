# Production Setup Guide

This guide provides comprehensive instructions for setting up PromptOps client libraries in production environments.

## 🎯 Production Requirements

### Environment Prerequisites

- **Node.js 18+** or **Python 3.8+**
- **Redis 6+** (for distributed caching)
- **Load balancer** with health checks
- **SSL/TLS** termination
- **Secrets management** (AWS Secrets Manager, HashiCorp Vault, etc.)
- **Monitoring** infrastructure (Prometheus, Grafana, etc.)
- **Logging** aggregation (ELK stack, etc.)

### System Requirements

| Component | Minimum | Recommended | Notes |
|-----------|---------|-------------|-------|
| CPU | 2 cores | 4+ cores | More cores for concurrent processing |
| Memory | 4GB RAM | 8GB+ RAM | More memory for caching |
| Storage | 20GB SSD | 50GB+ SSD | SSD for better performance |
| Network | 1 Gbps | 10 Gbps | For high-throughput applications |

## 🏗️ Architecture Patterns

### 1. Single Region Deployment

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │    │   Application   │    │     Database    │
│                 │────│     Servers     │────│    (PostgreSQL) │
│  HTTPS/SSL      │    │   (3-5 nodes)   │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                               │
                    ┌─────────────────┐
                    │      Redis      │
                    │     Cache       │
                    └─────────────────┘
```

### 2. Multi-Region Deployment

```
Region 1 (US-East)                    Region 2 (EU-West)
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   CDN/Edge  │    │  App Cluster │    │   CDN/Edge  │    │  App Cluster │
│             │────│             │────│             │────│             │
│  Global     │    │  + Redis     │    │  Regional   │    │  + Redis     │
│  Load Bal.  │    │  + Database  │    │  Load Bal.  │    │  + Database  │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │                   │
       └───────────────────┴───────────────────┴───────────────────┘
                              │
                      ┌─────────────┐
                      │  PromptOps   │
                      │    API       │
                      └─────────────┘
```

## 📦 Installation and Setup

### 1. Production Dependencies

```bash
# Python production dependencies
pip install promptops-client[redis,otel]
pip install gunicorn uvicorn
pip install prometheus-client
pip install structlog

# JavaScript production dependencies
npm install promptops-client
npm install express helmet cors compression
npm install prom-client winston
npm install ioredis
```

### 2. Production Configuration

#### Python Application Configuration

```python
# config/production.py
import os
from typing import Optional
from promptops import ClientConfig, CacheConfig, TelemetryConfig, CacheLevel

class ProductionConfig:
    # Application settings
    ENVIRONMENT = "production"
    DEBUG = False
    LOG_LEVEL = "WARNING"

    # PromptOps settings
    PROMPTOPS_CONFIG = ClientConfig(
        base_url=os.environ.get("PROMPTOPS_BASE_URL", "https://api.promptops.com/v1"),
        api_key=os.environ["PROMPTOPS_API_KEY"],
        timeout=60.0,  # 60 seconds timeout
        cache=CacheConfig(
            level=CacheLevel.HYBRID,
            ttl=1800,  # 30 minutes
            max_size=5000,
            redis_url=os.environ.get("REDIS_URL", "redis://localhost:6379")
        ),
        telemetry=TelemetryConfig(
            enabled=True,
            sample_rate=0.1,  # 10% sampling
            batch_size=100,
            flush_interval=120.0  # 2 minutes
        )
    )

    # Redis settings
    REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")
    REDIS_MAX_CONNECTIONS = 20
    REDIS_TIMEOUT = 5.0

    # Application performance
    WORKER_COUNT = int(os.environ.get("WEB_CONCURRENCY", 4))
    MAX_REQUESTS = 1000
    MAX_REQUESTS_JITTER = 50

    # Security
    SECRET_KEY = os.environ["SECRET_KEY"]
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"

    # CORS settings
    CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "").split(",")
    CORS_METHODS = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    CORS_HEADERS = ["Content-Type", "Authorization"]

    # Rate limiting
    RATE_LIMIT_REQUESTS = 1000
    RATE_LIMIT_WINDOW = 3600  # 1 hour

    @classmethod
    def validate(cls):
        """Validate required environment variables"""
        required_vars = [
            "PROMPTOPS_API_KEY",
            "SECRET_KEY",
            "REDIS_URL"
        ]

        missing_vars = [var for var in required_vars if not os.environ.get(var)]
        if missing_vars:
            raise ValueError(f"Missing required environment variables: {missing_vars}")
```

#### JavaScript Application Configuration

```javascript
// config/production.js
module.exports = {
  // Application settings
  environment: 'production',
  debug: false,
  logLevel: 'warn',

  // PromptOps settings
  promptOps: {
    baseUrl: process.env.PROMPTOPS_BASE_URL || 'https://api.promptops.com/v1',
    apiKey: process.env.PROMPTOPS_API_KEY,
    timeout: 60000, // 60 seconds
    enableCache: true,
    cacheTTL: 1800000, // 30 minutes
    enableTelemetry: true,
    telemetrySampleRate: 0.1, // 10% sampling
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    retryConfig: {
      maxRetries: 5,
      baseDelay: 2000,
      maxDelay: 30000,
      jitter: true
    }
  },

  // Server settings
  port: process.env.PORT || 3000,
  host: '0.0.0.0',
  trustProxy: true,

  // Security settings
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"]
      }
    }
  },

  // CORS settings
  cors: {
    origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  },

  // Rate limiting
  rateLimit: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 1000, // limit each IP to 1000 requests per windowMs
    message: 'Too many requests from this IP'
  },

  // Logging
  logging: {
    level: 'warn',
    format: 'json',
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d'
  },

  // Health check
  healthCheck: {
    timeout: 5000,
    interval: 30000 // 30 seconds
  },

  // Validate configuration
  validate() {
    const required = [
      'PROMPTOPS_API_KEY',
      'REDIS_URL'
    ];

    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }
};
```

### 3. Production Server Setup

#### Python Production Server (Gunicorn)

```python
# wsgi.py
from app import create_app
import os

app = create_app(os.getenv('FLASK_ENV', 'production'))

if __name__ == '__main__':
    app.run()
```

```bash
# gunicorn.conf.py
bind = "0.0.0.0:8000"
workers = 4
worker_class = "uvicorn.workers.UvicornWorker"
worker_connections = 1000
max_requests = 1000
max_requests_jitter = 50
preload_app = True
keepalive = 2
timeout = 30
graceful_timeout = 30

# Logging
accesslog = "-"
errorlog = "-"
loglevel = "warning"

# Security
limit_request_line = 4096
limit_request_fields = 100
limit_request_field_size = 8190
```

#### JavaScript Production Server

```javascript
// server.js
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { createLogger, format, transports } = require('winston');
const { PromptOpsClient } = require('promptops-client');
const config = require('./config/production');

// Validate configuration
config.validate();

// Initialize logger
const logger = createLogger({
  level: config.logging.level,
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'logs/error.log', level: 'error' }),
    new transports.File({ filename: 'logs/combined.log' })
  ]
});

// Initialize Express app
const app = express();

// Security middleware
app.use(helmet(config.helmet));
app.use(cors(config.cors));
app.use(compression());

// Rate limiting
const limiter = rateLimit(config.rateLimit);
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize PromptOps client
const promptOpsClient = new PromptOpsClient(config.promptOps);

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP Request', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });
  });

  next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const health = await promptOpsClient.healthCheck();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      promptOps: {
        status: health.status,
        dependencies: health.dependencies
      }
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Ready check endpoint
app.get('/ready', (req, res) => {
  res.json({
    status: 'ready',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    requestId: req.id
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found'
  });
});

// Graceful shutdown
let server;
const shutdown = async (signal) => {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start server
const startServer = async () => {
  try {
    await promptOpsClient.initialize();
    logger.info('PromptOps client initialized');

    server = app.listen(config.port, config.host, () => {
      logger.info(`Server running on ${config.host}:${config.port}`);
    });

    // Set up periodic health checks
    setInterval(async () => {
      try {
        await promptOpsClient.healthCheck();
      } catch (error) {
        logger.error('Periodic health check failed:', error);
      }
    }, config.healthCheck.interval);

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
```

## 🔧 Environment Setup Scripts

### 1. Environment Setup Script

```bash
#!/bin/bash
# scripts/setup-production.sh

set -e

echo "🚀 Setting up PromptOps production environment..."

# Check required environment variables
required_vars=(
    "PROMPTOPS_API_KEY"
    "SECRET_KEY"
    "REDIS_URL"
    "DATABASE_URL"
)

missing_vars=()
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -gt 0 ]; then
    echo "❌ Missing required environment variables:"
    printf ' - %s\n' "${missing_vars[@]}"
    exit 1
fi

echo "✅ All required environment variables are set"

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p logs
mkdir -p temp
mkdir -p data/cache

# Set proper permissions
echo "🔐 Setting permissions..."
chmod 750 logs
chmod 750 temp
chmod 750 data/cache

# Install dependencies
echo "📦 Installing dependencies..."
if [ -f "package.json" ]; then
    npm ci --production --prefer-offline
fi

if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
fi

# Run database migrations (if applicable)
if command -v alembic &> /dev/null; then
    echo "🗄️ Running database migrations..."
    alembic upgrade head
fi

# Build assets (if applicable)
if [ -f "package.json" ] && grep -q "build" package.json; then
    echo "🏗️ Building assets..."
    npm run build
fi

echo "✅ Production environment setup complete!"
echo "🎯 You can now start the application"
```

### 2. Deployment Script

```bash
#!/bin/bash
# scripts/deploy.sh

set -e

ENVIRONMENT=${1:-production}
VERSION=${2:-latest}

echo "🚀 Deploying PromptOps application to $ENVIRONMENT environment..."

# Pull latest changes
echo "📥 Pulling latest changes..."
git pull origin main

# Switch to correct version if specified
if [ "$VERSION" != "latest" ]; then
    echo "🏷️  Switching to version $VERSION..."
    git checkout "$VERSION"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --production

# Run tests
echo "🧪 Running tests..."
npm test

# Build application
echo "🏗️ Building application..."
npm run build

# Run pre-deployment checks
echo "🔍 Running pre-deployment checks..."
npm run health-check

# Backup current deployment
echo "💾 Creating backup..."
if [ -d "current" ]; then
    cp -r current "backup-$(date +%Y%m%d-%H%M%S)"
fi

# Deploy new version
echo "📦 Deploying new version..."
rm -f current
ln -s "$(pwd)/dist" current

# Restart services
echo "🔄 Restarting services..."
if command -v systemctl &> /dev/null; then
    sudo systemctl restart promptops-app
    sudo systemctl status promptops-app
elif command -v pm2 &> /dev/null; then
    pm2 reload promptops-app
    pm2 status
fi

# Run post-deployment checks
echo "🔍 Running post-deployment checks..."
sleep 10
curl -f http://localhost:3000/health || {
    echo "❌ Health check failed!"
    exit 1
}

echo "✅ Deployment completed successfully!"
echo "🎉 Application is running on $ENVIRONMENT environment"
```

## 📊 Monitoring and Observability

### 1. Metrics Collection

```python
# metrics.py (Python)
from prometheus_client import Counter, Histogram, Gauge, generate_latest, REGISTRY
import time

# Define metrics
REQUEST_COUNT = Counter(
    'promptops_requests_total',
    'Total number of PromptOps requests',
    ['method', 'endpoint', 'status_code']
)

REQUEST_DURATION = Histogram(
    'promptops_request_duration_seconds',
    'Request duration in seconds',
    ['method', 'endpoint']
)

CACHE_HITS = Counter(
    'promptops_cache_hits_total',
    'Total number of cache hits',
    ['cache_type', 'prompt_id']
)

ACTIVE_CONNECTIONS = Gauge(
    'promptops_active_connections',
    'Number of active connections'
)

ERROR_COUNT = Counter(
    'promptops_errors_total',
    'Total number of errors',
    ['error_type', 'endpoint']
)

class MetricsMiddleware:
    def __init__(self, app):
        self.app = app

    def __call__(self, environ, start_response):
        start_time = time.time()

        def custom_start_response(status, headers, exc_info=None):
            status_code = int(status.split(' ')[0])

            # Record metrics
            REQUEST_COUNT.labels(
                method=environ['REQUEST_METHOD'],
                endpoint=environ['PATH_INFO'],
                status_code=status_code
            ).inc()

            REQUEST_DURATION.labels(
                method=environ['REQUEST_METHOD'],
                endpoint=environ['PATH_INFO']
            ).observe(time.time() - start_time)

            return start_response(status, headers, exc_info)

        return self.app(environ, custom_start_response)
```

### 2. Structured Logging

```python
# logging_config.py
import logging
import logging.config
import structlog
from typing import Dict, Any

def setup_logging(environment: str = "production") -> None:
    """Configure structured logging for production"""

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

    # Configure standard logging
    logging_config = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "json": {
                "()": "pythonjsonlogger.jsonlogger.JsonFormatter",
                "fmt": "%(asctime)s %(name)s %(levelname)s %(message)s"
            }
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "formatter": "json",
                "stream": "ext://sys.stdout"
            },
            "file": {
                "class": "logging.handlers.RotatingFileHandler",
                "formatter": "json",
                "filename": "logs/app.log",
                "maxBytes": 10485760,  # 10MB
                "backupCount": 5
            },
            "error_file": {
                "class": "logging.handlers.RotatingFileHandler",
                "formatter": "json",
                "filename": "logs/error.log",
                "maxBytes": 10485760,  # 10MB
                "backupCount": 10
            }
        },
        "loggers": {
            "": {
                "handlers": ["console", "file"],
                "level": "INFO" if environment == "production" else "DEBUG"
            },
            "promptops": {
                "handlers": ["console", "file", "error_file"],
                "level": "INFO",
                "propagate": False
            }
        }
    }

    logging.config.dictConfig(logging_config)
```

## 🛡️ Security Hardening

### 1. Security Headers Middleware

```python
# security.py
from typing import Dict, Any
from flask import Flask

class SecurityHeaders:
    """Security headers middleware for Flask applications"""

    DEFAULT_HEADERS = {
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
        'Content-Security-Policy': (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self' data:; "
            "connect-src 'self' https://api.promptops.com; "
            "frame-ancestors 'none'; "
            "form-action 'self';"
        )
    }

    def __init__(self, app: Flask = None, headers: Dict[str, str] = None):
        self.headers = {**self.DEFAULT_HEADERS, **(headers or {})}
        self.app = app

        if app is not None:
            self.init_app(app)

    def init_app(self, app: Flask) -> None:
        """Initialize security headers for Flask app"""
        @app.after_request
        def add_security_headers(response):
            for header, value in self.headers.items():
                response.headers[header] = value
            return response
```

### 2. Rate Limiting

```python
# rate_limiter.py
from typing import Optional, Dict, Any
import time
from collections import defaultdict, deque
from dataclasses import dataclass

@dataclass
class RateLimitInfo:
    requests: int
    window_start: float
    window_size: float

class RateLimiter:
    """Sliding window rate limiter"""

    def __init__(self, max_requests: int, window_size: float):
        self.max_requests = max_requests
        self.window_size = window_size
        self.clients: Dict[str, deque] = defaultdict(deque)

    def is_allowed(self, client_id: str) -> tuple[bool, Dict[str, Any]]:
        """Check if request is allowed for client"""
        now = time.time()
        client_requests = self.clients[client_id]

        # Remove expired requests
        while client_requests and client_requests[0] <= now - self.window_size:
            client_requests.popleft()

        # Check if limit exceeded
        if len(client_requests) >= self.max_requests:
            return False, {
                'limit': self.max_requests,
                'remaining': 0,
                'reset_time': client_requests[0] + self.window_size if client_requests else now + self.window_size,
                'window_size': self.window_size
            }

        # Add current request
        client_requests.append(now)

        return True, {
            'limit': self.max_requests,
            'remaining': self.max_requests - len(client_requests),
            'reset_time': now + self.window_size,
            'window_size': self.window_size
        }

# Flask middleware
from functools import wraps
from flask import request, jsonify

rate_limiter = RateLimiter(max_requests=1000, window_size=3600)  # 1000 requests per hour

def rate_limit(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        client_id = request.remote_addr

        allowed, info = rate_limiter.is_allowed(client_id)

        # Add rate limit headers
        response = None

        if not allowed:
            response = jsonify({
                'error': 'Rate limit exceeded',
                'limit': info['limit'],
                'window_size': info['window_size']
            })
            response.status_code = 429
        else:
            response = f(*args, **kwargs)

        # Add rate limit headers
        if hasattr(response, 'headers'):
            response.headers['X-RateLimit-Limit'] = str(info['limit'])
            response.headers['X-RateLimit-Remaining'] = str(info['remaining'])
            response.headers['X-RateLimit-Reset'] = str(info['reset_time'])
            response.headers['X-RateLimit-Window'] = str(info['window_size'])

        return response

    return decorated_function
```

---

*For more deployment examples and configuration templates, see the [complete deployment guide](README.md).*