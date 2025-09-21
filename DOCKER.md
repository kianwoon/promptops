# PromptOps Docker Containerization

This document provides comprehensive information about Docker containerization for the PromptOps client libraries, including both Python and JavaScript/TypeScript implementations.

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Development Setup](#development-setup)
- [Production Deployment](#production-deployment)
- [Available Images](#available-images)
- [Environment Variables](#environment-variables)
- [Docker Compose Profiles](#docker-compose-profiles)
- [Build Scripts](#build-scripts)
- [Monitoring and Health Checks](#monitoring-and-health-checks)
- [Security Considerations](#security-considerations)
- [Troubleshooting](#troubleshooting)

## 🚀 Quick Start

### Prerequisites

- Docker (version 20.10 or higher)
- Docker Compose (version 1.29 or higher)
- Git

### Basic Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/promptops/promptops.git
   cd promptops
   ```

2. **Setup environment:**
   ```bash
   ./scripts/docker-deploy.sh setup
   ```

3. **Start development environment:**
   ```bash
   ./scripts/docker-deploy.sh start
   ```

4. **Check service status:**
   ```bash
   ./scripts/docker-deploy.sh status
   ```

## 🔧 Development Setup

### Python Client Development

```bash
# Start Python development container
docker-compose -f docker-compose.clients.yml up python-client-dev

# Access the container
docker-compose -f docker-compose.clients.yml exec python-client-dev bash

# Run tests
docker-compose -f docker-compose.clients.yml --profile testing up python-client-test
```

### JavaScript/TypeScript Client Development

```bash
# Start JS development container
docker-compose -f docker-compose.clients.yml up js-client-dev

# Access the container
docker-compose -f docker-compose.clients.yml exec js-client-dev bash

# Run tests
docker-compose -f docker-compose.clients.yml --profile testing up js-client-test
```

### Development Features

- **Hot Reload**: Code changes are immediately available in containers
- **Volume Mounting**: Local files are mounted into containers
- **Interactive Mode**: Containers can be accessed via bash shell
- **Development Dependencies**: All dev tools and dependencies are included

## 🏭 Production Deployment

### Production Setup

1. **Create production environment file:**
   ```bash
   cp .env .env.prod
   # Edit .env.prod with production values
   ```

2. **Start production services:**
   ```bash
   ENVIRONMENT=production ./scripts/docker-deploy.sh start
   ```

3. **Build and push production images:**
   ```bash
   ./scripts/docker-build.sh --push --multiarch
   ```

### Production Features

- **Multi-stage Builds**: Optimized image sizes
- **Security Hardening**: Non-root users, minimal attack surface
- **Resource Limits**: Memory and CPU constraints
- **Health Checks**: Automated health monitoring
- **Replication**: High availability with multiple replicas
- **Monitoring**: Prometheus and Grafana integration

## 📦 Available Images

### Python Client Images

| Image | Description | Size | Use Case |
|-------|-------------|------|----------|
| `promptops/python-client:latest` | Latest production image | ~150MB | Production deployment |
| `promptops/python-client:1.0.0` | Versioned production image | ~150MB | Specific version deployment |
| `promptops/python-client:dev` | Development image | ~300MB | Development and testing |

### JavaScript Client Images

| Image | Description | Size | Use Case |
|-------|-------------|------|----------|
| `promptops/js-client:latest` | Latest production image | ~120MB | Production deployment |
| `promptops/js-client:1.0.0` | Versioned production image | ~120MB | Specific version deployment |
| `promptops/js-client:dev` | Development image | ~250MB | Development and testing |

### Infrastructure Images

| Image | Description | Purpose |
|-------|-------------|---------|
| `redis:7-alpine` | Redis cache | Caching layer |
| `postgres:15-alpine` | PostgreSQL database | Data persistence |
| `nginx:alpine` | Nginx reverse proxy | Load balancing and SSL |
| `prometheus:latest` | Prometheus metrics | Monitoring |
| `grafana:latest` | Grafana dashboard | Metrics visualization |

## 🔧 Environment Variables

### Required Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PROMPTOPS_API_URL` | PromptOps API URL | `http://localhost:8000` | Yes |
| `PROMPTOPS_API_KEY` | PromptOps API key | - | Yes |
| `REDIS_PASSWORD` | Redis password | - | Yes (production) |
| `POSTGRES_USER` | PostgreSQL username | `promptops` | Yes (production) |
| `POSTGRES_PASSWORD` | PostgreSQL password | - | Yes (production) |
| `SECRET_KEY` | Application secret key | - | Yes (production) |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LOG_LEVEL` | Logging level | `INFO` |
| `REDIS_URL` | Redis connection URL | `redis://redis:6379` |
| `NODE_ENV` | Node.js environment | `development` |
| `OPENTELEMETRY_ENABLED` | Enable OpenTelemetry | `false` |
| `OPENTELEMETRY_ENDPOINT` | OpenTelemetry endpoint | `http://localhost:4317` |
| `GRAFANA_USER` | Grafana username | `admin` |
| `GRAFANA_PASSWORD` | Grafana password | - |

### Google OAuth (Optional)

| Variable | Description | Required |
|----------|-------------|----------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | No |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | No |
| `GOOGLE_REDIRECT_URI` | Google OAuth redirect URI | No |

## 🎯 Docker Compose Profiles

### Development Profile

```bash
docker-compose -f docker-compose.clients.yml up
```

Services:
- `python-client-dev` - Python development environment
- `js-client-dev` - JavaScript development environment
- `redis` - Redis cache
- `postgres` - PostgreSQL database

### Testing Profile

```bash
docker-compose -f docker-compose.clients.yml --profile testing up
```

Services:
- `python-client-test` - Python test environment
- `js-client-test` - JavaScript test environment
- `redis` - Redis cache
- `postgres` - PostgreSQL database

### Production Profile

```bash
docker-compose -f docker-compose.prod.yml up
```

Services:
- `python-client-prod` - Python production environment
- `js-client-prod` - JavaScript production environment
- `redis` - Redis cache (secured)
- `postgres` - PostgreSQL database (secured)
- `nginx` - Reverse proxy
- `prometheus` - Metrics collection
- `grafana` - Metrics visualization

### Monitoring Profile

```bash
docker-compose -f docker-compose.prod.yml --profile monitoring up
```

Services:
- `prometheus` - Metrics collection
- `grafana` - Metrics visualization

## 🛠️ Build Scripts

### Build Images

```bash
# Build all images
./scripts/docker-build.sh

# Build only Python images
./scripts/docker-build.sh --python-only

# Build only JavaScript images
./scripts/docker-build.sh --js-only

# Build and push images
./scripts/docker-build.sh --push

# Build multi-architecture images
./scripts/docker-build.sh --multiarch

# Build with custom version
VERSION=1.0.0 ./scripts/docker-build.sh

# Build with custom registry
DOCKER_REGISTRY=my-registry ./scripts/docker-build.sh
```

### Deploy Services

```bash
# Start services
./scripts/docker-deploy.sh start

# Stop services
./scripts/docker-deploy.sh stop

# Restart services
./scripts/docker-deploy.sh restart

# Show status
./scripts/docker-deploy.sh status

# Show logs
./scripts/docker-deploy.sh logs

# Show logs for specific service
./scripts/docker-deploy.sh logs python-client-dev

# Run tests
./scripts/docker-deploy.sh test

# Run health check
./scripts/docker-deploy.sh health

# Start production environment
ENVIRONMENT=production ./scripts/docker-deploy.sh start
```

## 🏥 Monitoring and Health Checks

### Health Check Endpoints

| Service | Endpoint | Description |
|---------|----------|-------------|
| Redis | `redis-cli ping` | Redis connectivity |
| PostgreSQL | `pg_isready` | PostgreSQL connectivity |
| Python Client | Python import test | Python client health |
| JavaScript Client | Node.js process check | JavaScript client health |
| Nginx | `/health` | HTTP health check |

### Metrics Collection

The production setup includes:

- **Prometheus**: Metrics collection and storage
- **Grafana**: Metrics visualization and dashboards
- **Node Exporter**: System metrics
- **Redis Exporter**: Redis metrics
- **PostgreSQL Exporter**: Database metrics

### Available Metrics

- **Application Metrics**: Request count, response time, error rates
- **System Metrics**: CPU, memory, disk usage
- **Database Metrics**: Connection count, query performance
- **Cache Metrics**: Hit rate, memory usage, key operations

## 🔒 Security Considerations

### Container Security

- **Non-root Users**: All containers run as non-root users
- **Multi-stage Builds**: Minimal attack surface in production images
- **Security Scans**: Images are built with security best practices
- **Base Images**: Use official, minimal base images

### Network Security

- **Isolated Networks**: Services run in isolated Docker networks
- **Port Mapping**: Only necessary ports are exposed
- **Firewall Rules**: Nginx provides additional security layer
- **SSL/TLS**: HTTPS support with certificate management

### Data Security

- **Environment Variables**: Sensitive data stored in environment variables
- **Volume Permissions**: Proper file permissions on mounted volumes
- **Database Security**: PostgreSQL authentication and encryption
- **Cache Security**: Redis authentication and access control

### Best Practices

1. **Never commit secrets to version control**
2. **Use environment variables for configuration**
3. **Regular security scanning of images**
4. **Keep base images updated**
5. **Monitor for vulnerabilities**
6. **Implement proper logging and auditing**

## 🔧 Troubleshooting

### Common Issues

#### Container Won't Start

```bash
# Check container logs
docker logs <container_name>

# Check service status
docker-compose ps

# Check resource usage
docker stats
```

#### Permission Issues

```bash
# Check file permissions
ls -la

# Fix ownership issues
sudo chown -R $USER:$USER .
```

#### Port Conflicts

```bash
# Check used ports
netstat -tulpn | grep LISTEN

# Change ports in docker-compose.yml
ports:
  - "8001:8000"  # Use different host port
```

#### Memory Issues

```bash
# Check memory usage
docker stats --no-stream

# Increase memory limits in docker-compose.yml
deploy:
  resources:
    limits:
      memory: 1G
```

### Debug Commands

```bash
# Access container shell
docker-compose exec <service> bash

# Check container health
docker inspect --format='{{json .State.Health}}' <container_name>

# View network configuration
docker network ls
docker network inspect <network_name>

# Check volume mounts
docker inspect --format='{{json .Mounts}}' <container_name>

# Clean up unused resources
docker system prune -a
```

### Performance Issues

```bash
# Monitor performance
docker stats

# Check logs for errors
docker-compose logs --tail=100 <service>

# Restart services
docker-compose restart <service>

# Rebuild images
docker-compose build --no-cache <service>
```

### Network Issues

```bash
# Test connectivity
docker-compose exec <service> ping <other_service>

# Check DNS resolution
docker-compose exec <service> nslookup <service>

# View network configuration
docker network inspect <network_name>

# Test port accessibility
docker-compose exec <service> nc -zv <host> <port>
```

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [PostgreSQL Docker Documentation](https://hub.docker.com/_/postgres)
- [Redis Docker Documentation](https://hub.docker.com/_/redis)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test your changes with Docker
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.