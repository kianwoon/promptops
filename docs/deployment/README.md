# Production Deployment Guide

This section provides comprehensive guides for deploying PromptOps client libraries and applications in production environments.

## 📚 Documentation Contents

### [Production Setup](production.md) - Core deployment configuration and best practices
### [Configuration Management](configuration.md) - Environment, secrets, and config management
### [Monitoring & Logging](monitoring.md) - Observability, metrics, and logging setup
### [Security Hardening](security.md) - Security best practices for production deployments
### [Scaling & Performance](scaling.md) - Horizontal scaling and performance optimization
### [Disaster Recovery](disaster-recovery.md) - Backup and recovery strategies

## 🎯 Production Considerations

### Core Requirements

1. **Security** - API key management, encryption, access controls
2. **Reliability** - High availability, fault tolerance, graceful degradation
3. **Performance** - Low latency, high throughput, efficient caching
4. **Monitoring** - Comprehensive observability and alerting
5. **Compliance** - Data privacy, audit trails, regulatory requirements

### Deployment Checklist

- [ ] Environment-specific configuration
- [ ] Secure API key management
- [ ] Proper error handling and retry logic
- [ ] Monitoring and alerting setup
- [ ] Logging and audit trails
- [ ] Backup and recovery procedures
- [ ] Security hardening
- [ ] Performance optimization
- [ ] Load testing completed
- [ ] Documentation updated

## 🚀 Deployment Patterns

### 1. Container-based Deployment

```dockerfile
# Dockerfile.example
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Change ownership
USER nextjs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Expose port
EXPOSE 3000

# Start application
CMD ["node", "server.js"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PROMPTOPS_API_KEY=${PROMPTOPS_API_KEY}
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped
    command: redis-server --appendonly yes

volumes:
  redis_data:
```

### 2. Kubernetes Deployment

```yaml
# k8s-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: promptops-app
  labels:
    app: promptops-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: promptops-app
  template:
    metadata:
      labels:
        app: promptops-app
    spec:
      containers:
      - name: app
        image: your-registry/promptops-app:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: PROMPTOPS_API_KEY
          valueFrom:
            secretKeyRef:
              name: promptops-secrets
              key: api-key
        - name: REDIS_URL
          value: "redis://redis-service:6379"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: promptops-service
spec:
  selector:
    app: promptops-app
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: LoadBalancer

---
apiVersion: v1
kind: Secret
metadata:
  name: promptops-secrets
type: Opaque
data:
  api-key: <base64-encoded-api-key>
```

### 3. Serverless Deployment (AWS Lambda)

```javascript
// lambda-handler.js
const { PromptOpsClient } = require('promptops-client');

// Initialize client outside handler for reuse
let client;

async function initializeClient() {
  if (!client) {
    client = new PromptOpsClient({
      baseUrl: process.env.PROMPTOPS_BASE_URL,
      apiKey: process.env.PROMPTOPS_API_KEY,
      enableCache: true,
      cacheTTL: 300000
    });
    await client.initialize();
  }
  return client;
}

exports.handler = async (event) => {
  try {
    const { promptId, variables } = JSON.parse(event.body);

    const client = await initializeClient();

    const content = await client.getPromptContent({
      promptId,
      variables: variables || {}
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        data: {
          content,
          promptId
        }
      })
    };
  } catch (error) {
    console.error('Lambda error:', error);

    return {
      statusCode: error.statusCode || 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
```

## 🔧 Environment Configuration

### Development Environment

```bash
# .env.development
PROMPTOPS_API_KEY=dev_api_key_here
PROMPTOPS_BASE_URL=https://dev-api.promptops.com/v1
NODE_ENV=development
LOG_LEVEL=debug
ENABLE_TELEMETRY=true
REDIS_URL=redis://localhost:6379
```

### Staging Environment

```bash
# .env.staging
PROMPTOPS_API_KEY=staging_api_key_here
PROMPTOPS_BASE_URL=https://staging-api.promptops.com/v1
NODE_ENV=staging
LOG_LEVEL=info
ENABLE_TELEMETRY=true
REDIS_URL=redis://staging-redis:6379
```

### Production Environment

```bash
# .env.production
PROMPTOPS_API_KEY=${PROD_PROMPTOPS_API_KEY}
PROMPTOPS_BASE_URL=https://api.promptops.com/v1
NODE_ENV=production
LOG_LEVEL=warn
ENABLE_TELEMETRY=true
REDIS_URL=redis://prod-redis:6379
```

## 📊 Monitoring Setup

### Prometheus Metrics

```javascript
// metrics.js
const promClient = require('prom-client');

// Create a Registry
const register = new promClient.Registry();

// Add default metrics
promClient.collectDefaultMetrics({ register });

// Custom metrics
const promptRequestCounter = new promClient.Counter({
  name: 'promptops_requests_total',
  help: 'Total number of PromptOps requests',
  labelNames: ['prompt_id', 'status', 'environment']
});

const promptRequestDuration = new promClient.Histogram({
  name: 'promptops_request_duration_seconds',
  help: 'Duration of PromptOps requests',
  labelNames: ['prompt_id', 'environment'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

const cacheHitCounter = new promClient.Counter({
  name: 'promptops_cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['prompt_id', 'cache_type']
});

// Register metrics
register.registerMetric(promptRequestCounter);
register.registerMetric(promptRequestDuration);
register.registerMetric(cacheHitCounter);

module.exports = {
  register,
  promptRequestCounter,
  promptRequestDuration,
  cacheHitCounter
};
```

### Grafana Dashboard Example

```json
{
  "dashboard": {
    "title": "PromptOps Application Metrics",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(promptops_requests_total[5m])",
            "legendFormat": "{{prompt_id}} - {{status}}"
          }
        ]
      },
      {
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(promptops_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          },
          {
            "expr": "histogram_quantile(0.50, rate(promptops_request_duration_seconds_bucket[5m]))",
            "legendFormat": "50th percentile"
          }
        ]
      },
      {
        "title": "Cache Hit Rate",
        "type": "singlestat",
        "targets": [
          {
            "expr": "rate(promptops_cache_hits_total[5m]) / (rate(promptops_cache_hits_total[5m]) + rate(promptops_requests_total[5m]))",
            "legendFormat": "Hit Rate"
          }
        ]
      }
    ]
  }
}
```

## 🚨 Alerting Setup

### Prometheus Alert Rules

```yaml
# alert-rules.yml
groups:
- name: promptops-alerts
  rules:
  - alert: HighErrorRate
    expr: rate(promptops_requests_total{status="error"}[5m]) / rate(promptops_requests_total[5m]) > 0.1
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "High error rate detected"
      description: "PromptOps error rate is {{ $value | printf \"%.2f\" }} for environment {{ $labels.environment }}"

  - alert: SlowResponseTime
    expr: histogram_quantile(0.95, rate(promptops_request_duration_seconds_bucket[5m])) > 2
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Slow response times detected"
      description: "95th percentile response time is {{ $value }}s"

  - alert: LowCacheHitRate
    expr: rate(promptops_cache_hits_total[5m]) / (rate(promptops_cache_hits_total[5m]) + rate(promptops_requests_total[5m])) < 0.5
    for: 10m
    labels:
      severity: warning
    annotations:
      summary: "Low cache hit rate"
      description: "Cache hit rate is {{ $value | printf \"%.2f\" }}"
```

## 🔄 CI/CD Pipeline

### GitHub Actions Example

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'

    - name: Install dependencies
      run: npm ci

    - name: Run tests
      run: npm test

    - name: Run linting
      run: npm run lint

    - name: Security audit
      run: npm audit --audit-level=moderate

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3

    - name: Build Docker image
      run: |
        docker build -t promptops-app:${{ github.sha }} .

    - name: Login to Container Registry
      run: |
        echo ${{ secrets.REGISTRY_PASSWORD }} | docker login your-registry.com -u ${{ secrets.REGISTRY_USERNAME }} --password-stdin

    - name: Push Docker image
      run: |
        docker push your-registry.com/promptops-app:${{ github.sha }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: production
    steps:
    - name: Deploy to Kubernetes
      run: |
        kubectl set image deployment/promptops-app app=your-registry.com/promptops-app:${{ github.sha }}
        kubectl rollout status deployment/promptops-app

    - name: Run smoke tests
      run: |
        curl -f https://your-app.com/health
```

## 📋 Pre-deployment Checklist

### Security
- [ ] API keys are stored in secrets management
- [ ] Environment variables are properly secured
- [ ] SSL/TLS certificates are valid
- [ ] Network access controls are configured
- [ ] Authentication and authorization are enabled

### Performance
- [ ] Load testing has been performed
- [ ] Caching strategy is optimized
- [ ] Database connections are pooled
- [ ] Resource limits are configured
- [ ] Auto-scaling rules are set up

### Monitoring
- [ ] Logging is configured and tested
- [ ] Metrics collection is enabled
- [ ] Alerting rules are configured
- [ ] Health checks are implemented
- [ ] Dashboard is set up

### Reliability
- [ ] Backup procedures are documented
- [ ] Disaster recovery plan is tested
- [ ] Graceful degradation is implemented
- [ ] Circuit breakers are configured
- [ ] Retry logic is implemented

## 🚀 Next Steps

1. **Choose Deployment Strategy** - Select the right approach for your use case
2. **Set Up Infrastructure** - Configure your deployment environment
3. **Implement Monitoring** - Set up observability and alerting
4. **Configure Security** - Implement security best practices
5. **Test Thoroughly** - Validate deployment and rollback procedures

## 📚 Additional Resources

- [Getting Started](../getting-started/) - Quick start guides
- [API Reference](../api-reference/) - Complete API documentation
- [Examples](../examples/) - Integration examples
- [Advanced Topics](../advanced-topics/) - Performance and optimization
- [Troubleshooting](../troubleshooting/) - Common issues and solutions

---

*Need deployment support? Check our [community forum](https://community.promptops.com) or [contact enterprise support](mailto:enterprise@promptops.com)*