#!/bin/bash

# PromptOps Docker Deployment Script
# This script deploys PromptOps client libraries using Docker Compose

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script configuration
ENVIRONMENT=${ENVIRONMENT:-"development"}
COMPOSE_FILE="docker-compose.yml"
CLIENTS_COMPOSE_FILE="docker-compose.clients.yml"
PROD_COMPOSE_FILE="docker-compose.prod.yml"

echo -e "${BLUE}🚀 PromptOps Docker Deployment Script${NC}"
echo -e "${YELLOW}======================================${NC}"

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        echo -e "${RED}❌ Docker is not running. Please start Docker.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Docker is running${NC}"
}

# Check if Docker Compose is available
check_compose() {
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        echo -e "${RED}❌ Docker Compose is not installed.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Docker Compose is available${NC}"
}

# Create .env file if it doesn't exist
setup_env() {
    if [ ! -f .env ]; then
        echo -e "${YELLOW}Creating .env file...${NC}"
        cat > .env << EOF
# PromptOps Environment Variables
PROMPTOPS_API_URL=http://localhost:8000
PROMPTOPS_API_KEY=your-api-key-here
REDIS_PASSWORD=redis-password-here
POSTGRES_USER=promptops
POSTGRES_PASSWORD=promptops-password-here
SECRET_KEY=your-secret-key-here
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback
GRAFANA_USER=admin
GRAFANA_PASSWORD=grafana-password-here
OPENTELEMETRY_ENDPOINT=http://localhost:4317
EOF
        echo -e "${GREEN}✅ Created .env file. Please update it with your values.${NC}"
    fi
}

# Pull latest images
pull_images() {
    echo -e "${YELLOW}Pulling latest images...${NC}"
    if command -v docker-compose &> /dev/null; then
        docker-compose -f $COMPOSE_FILE -f $CLIENTS_COMPOSE_FILE pull
    else
        docker compose -f $COMPOSE_FILE -f $CLIENTS_COMPOSE_FILE pull
    fi
    echo -e "${GREEN}✅ Images pulled successfully${NC}"
}

# Build images
build_images() {
    echo -e "${YELLOW}Building images...${NC}"
    if command -v docker-compose &> /dev/null; then
        docker-compose -f $COMPOSE_FILE -f $CLIENTS_COMPOSE_FILE build
    else
        docker compose -f $COMPOSE_FILE -f $CLIENTS_COMPOSE_FILE build
    fi
    echo -e "${GREEN}✅ Images built successfully${NC}"
}

# Start services
start_services() {
    echo -e "${YELLOW}Starting services...${NC}"

    if [ "$ENVIRONMENT" = "production" ]; then
        if command -v docker-compose &> /dev/null; then
            docker-compose -f $COMPOSE_FILE -f $PROD_COMPOSE_FILE up -d
        else
            docker compose -f $COMPOSE_FILE -f $PROD_COMPOSE_FILE up -d
        fi
    else
        if command -v docker-compose &> /dev/null; then
            docker-compose -f $COMPOSE_FILE -f $CLIENTS_COMPOSE_FILE up -d
        else
            docker compose -f $COMPOSE_FILE -f $CLIENTS_COMPOSE_FILE up -d
        fi
    fi

    echo -e "${GREEN}✅ Services started successfully${NC}"
}

# Stop services
stop_services() {
    echo -e "${YELLOW}Stopping services...${NC}"

    if [ "$ENVIRONMENT" = "production" ]; then
        if command -v docker-compose &> /dev/null; then
            docker-compose -f $COMPOSE_FILE -f $PROD_COMPOSE_FILE down
        else
            docker compose -f $COMPOSE_FILE -f $PROD_COMPOSE_FILE down
        fi
    else
        if command -v docker-compose &> /dev/null; then
            docker-compose -f $COMPOSE_FILE -f $CLIENTS_COMPOSE_FILE down
        else
            docker compose -f $COMPOSE_FILE -f $CLIENTS_COMPOSE_FILE down
        fi
    fi

    echo -e "${GREEN}✅ Services stopped successfully${NC}"
}

# Show status
show_status() {
    echo -e "${BLUE}📊 Service Status${NC}"
    echo -e "${YELLOW}================${NC}"

    if [ "$ENVIRONMENT" = "production" ]; then
        if command -v docker-compose &> /dev/null; then
            docker-compose -f $COMPOSE_FILE -f $PROD_COMPOSE_FILE ps
        else
            docker compose -f $COMPOSE_FILE -f $PROD_COMPOSE_FILE ps
        fi
    else
        if command -v docker-compose &> /dev/null; then
            docker-compose -f $COMPOSE_FILE -f $CLIENTS_COMPOSE_FILE ps
        else
            docker compose -f $COMPOSE_FILE -f $CLIENTS_COMPOSE_FILE ps
        fi
    fi
}

# Show logs
show_logs() {
    local service=$1

    if [ -z "$service" ]; then
        echo -e "${BLUE}📋 Showing logs for all services${NC}"
        service=""
    else
        echo -e "${BLUE}📋 Showing logs for $service${NC}"
    fi

    if [ "$ENVIRONMENT" = "production" ]; then
        if command -v docker-compose &> /dev/null; then
            docker-compose -f $COMPOSE_FILE -f $PROD_COMPOSE_FILE logs -f $service
        else
            docker compose -f $COMPOSE_FILE -f $PROD_COMPOSE_FILE logs -f $service
        fi
    else
        if command -v docker-compose &> /dev/null; then
            docker-compose -f $COMPOSE_FILE -f $CLIENTS_COMPOSE_FILE logs -f $service
        else
            docker compose -f $COMPOSE_FILE -f $CLIENTS_COMPOSE_FILE logs -f $service
        fi
    fi
}

# Run tests
run_tests() {
    echo -e "${YELLOW}Running tests...${NC}"

    if command -v docker-compose &> /dev/null; then
        docker-compose -f $COMPOSE_FILE -f $CLIENTS_COMPOSE_FILE --profile testing up --abort-on-container-exit
    else
        docker compose -f $COMPOSE_FILE -f $CLIENTS_COMPOSE_FILE --profile testing up --abort-on-container-exit
    fi

    echo -e "${GREEN}✅ Tests completed${NC}"
}

# Health check
health_check() {
    echo -e "${BLUE}🏥 Health Check${NC}"
    echo -e "${YELLOW}==============${NC}"

    # Check if services are running
    services=("redis" "postgres" "backend" "python-client-dev" "js-client-dev")

    for service in "${services[@]}"; do
        if docker ps --format "table {{.Names}}\t{{.Status}}" | grep -q "$service"; then
            echo -e "${GREEN}✅ $service is running${NC}"
        else
            echo -e "${RED}❌ $service is not running${NC}"
        fi
    done

    # Test API endpoints
    echo -e "${YELLOW}Testing API endpoints...${NC}"

    # Test health endpoint
    if curl -s http://localhost:8000/health > /dev/null; then
        echo -e "${GREEN}✅ Health endpoint is responding${NC}"
    else
        echo -e "${RED}❌ Health endpoint is not responding${NC}"
    fi

    # Test Redis connection
    if docker exec promptops-redis redis-cli ping > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Redis is responding${NC}"
    else
        echo -e "${RED}❌ Redis is not responding${NC}"
    fi

    # Test PostgreSQL connection
    if docker exec promptops-postgres pg_isready -U promptops > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PostgreSQL is responding${NC}"
    else
        echo -e "${RED}❌ PostgreSQL is not responding${NC}"
    fi
}

# Show help
show_help() {
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo
    echo "Commands:"
    echo "  start              Start services"
    echo "  stop               Stop services"
    echo "  restart            Restart services"
    echo "  status             Show service status"
    echo "  logs [SERVICE]     Show logs (optionally for specific service)"
    echo "  build              Build images"
    echo "  pull               Pull latest images"
    echo "  test               Run tests"
    echo "  health             Run health check"
    echo "  setup              Setup environment"
    echo "  help               Show this help message"
    echo
    echo "Options:"
    echo "  --env ENVIRONMENT  Set environment (development|production) [default: development]"
    echo
    echo "Environment Variables:"
    echo "  ENVIRONMENT        Deployment environment (development|production)"
    echo "  PROMPTOPS_API_URL  PromptOps API URL"
    echo "  PROMPTOPS_API_KEY  PromptOps API key"
    echo "  REDIS_PASSWORD     Redis password"
    echo "  POSTGRES_USER      PostgreSQL username"
    echo "  POSTGRES_PASSWORD  PostgreSQL password"
    echo "  SECRET_KEY         Secret key for the application"
}

# Parse command line arguments
COMMAND=$1
shift || true

while [[ $# -gt 0 ]]; do
    case $1 in
        --env)
            ENVIRONMENT=$2
            shift 2
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

# Main execution
main() {
    check_docker
    check_compose

    case $COMMAND in
        start)
            setup_env
            start_services
            health_check
            ;;
        stop)
            stop_services
            ;;
        restart)
            stop_services
            start_services
            health_check
            ;;
        status)
            show_status
            ;;
        logs)
            show_logs $1
            ;;
        build)
            build_images
            ;;
        pull)
            pull_images
            ;;
        test)
            run_tests
            ;;
        health)
            health_check
            ;;
        setup)
            setup_env
            ;;
        help)
            show_help
            ;;
        *)
            echo -e "${RED}Unknown command: $COMMAND${NC}"
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@"