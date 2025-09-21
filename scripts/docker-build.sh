#!/bin/bash

# PromptOps Docker Build Script
# This script builds Docker images for both Python and JavaScript client libraries

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script configuration
PYTHON_CLIENT_DIR="promptops-client"
JS_CLIENT_DIR="promptops-client-npm"
REGISTRY=${DOCKER_REGISTRY:-"promptops"}
VERSION=${VERSION:-"latest"}

echo -e "${BLUE}🐳 PromptOps Docker Build Script${NC}"
echo -e "${YELLOW}======================================${NC}"

# Build Python client images
build_python_client() {
    echo -e "${GREEN}Building Python client images...${NC}"

    # Development image
    echo -e "${YELLOW}Building Python development image...${NC}"
    docker build -t ${REGISTRY}/python-client:${VERSION}-dev \
        -f ${PYTHON_CLIENT_DIR}/Dockerfile \
        ${PYTHON_CLIENT_DIR}

    # Production image
    echo -e "${YELLOW}Building Python production image...${NC}"
    docker build -t ${REGISTRY}/python-client:${VERSION} \
        -f ${PYTHON_CLIENT_DIR}/Dockerfile.prod \
        ${PYTHON_CLIENT_DIR}

    echo -e "${GREEN}✅ Python client images built successfully${NC}"
}

# Build JavaScript client images
build_js_client() {
    echo -e "${GREEN}Building JavaScript client images...${NC}"

    # Development image
    echo -e "${YELLOW}Building JavaScript development image...${NC}"
    docker build -t ${REGISTRY}/js-client:${VERSION}-dev \
        -f ${JS_CLIENT_DIR}/Dockerfile \
        ${JS_CLIENT_DIR}

    # Production image
    echo -e "${YELLOW}Building JavaScript production image...${NC}"
    docker build -t ${REGISTRY}/js-client:${VERSION} \
        -f ${JS_CLIENT_DIR}/Dockerfile.prod \
        ${JS_CLIENT_DIR}

    echo -e "${GREEN}✅ JavaScript client images built successfully${NC}"
}

# Tag images with latest version
tag_latest() {
    echo -e "${YELLOW}Tagging images as latest...${NC}"

    docker tag ${REGISTRY}/python-client:${VERSION} ${REGISTRY}/python-client:latest
    docker tag ${REGISTRY}/js-client:${VERSION} ${REGISTRY}/js-client:latest

    echo -e "${GREEN}✅ Images tagged as latest${NC}"
}

# Push images to registry
push_images() {
    if [ -z "${DOCKER_USERNAME}" ] || [ -z "${DOCKER_PASSWORD}" ]; then
        echo -e "${YELLOW}Skipping push - no Docker credentials provided${NC}"
        return
    fi

    echo -e "${GREEN}Logging into Docker registry...${NC}"
    echo "${DOCKER_PASSWORD}" | docker login -u "${DOCKER_USERNAME}" --password-stdin

    echo -e "${YELLOW}Pushing images to registry...${NC}"

    # Push Python images
    docker push ${REGISTRY}/python-client:${VERSION}
    docker push ${REGISTRY}/python-client:${VERSION}-dev
    docker push ${REGISTRY}/python-client:latest

    # Push JavaScript images
    docker push ${REGISTRY}/js-client:${VERSION}
    docker push ${REGISTRY}/js-client:${VERSION}-dev
    docker push ${REGISTRY}/js-client:latest

    echo -e "${GREEN}✅ Images pushed to registry successfully${NC}"
}

# Build multi-architecture images
build_multiarch() {
    if ! command -v docker buildx &> /dev/null; then
        echo -e "${RED}Docker Buildx not available. Skipping multi-architecture build.${NC}"
        return
    fi

    echo -e "${GREEN}Building multi-architecture images...${NC}"

    # Create builder if it doesn't exist
    docker buildx create --use --name multi-arch-builder 2>/dev/null || true

    # Build Python client
    docker buildx build --platform linux/amd64,linux/arm64 \
        -t ${REGISTRY}/python-client:${VERSION} \
        -f ${PYTHON_CLIENT_DIR}/Dockerfile.prod \
        ${PYTHON_CLIENT_DIR} --push

    # Build JavaScript client
    docker buildx build --platform linux/amd64,linux/arm64 \
        -t ${REGISTRY}/js-client:${VERSION} \
        -f ${JS_CLIENT_DIR}/Dockerfile.prod \
        ${JS_CLIENT_DIR} --push

    echo -e "${GREEN}✅ Multi-architecture images built successfully${NC}"
}

# Clean up unused images
cleanup() {
    echo -e "${YELLOW}Cleaning up unused images...${NC}"
    docker image prune -f
    echo -e "${GREEN}✅ Cleanup completed${NC}"
}

# Show help
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo
    echo "Options:"
    echo "  --python-only      Build only Python client images"
    echo "  --js-only          Build only JavaScript client images"
    echo "  --push             Push images to registry"
    echo "  --multiarch        Build multi-architecture images"
    echo "  --cleanup          Clean up unused images"
    echo "  --help             Show this help message"
    echo
    echo "Environment Variables:"
    echo "  DOCKER_REGISTRY    Docker registry name (default: promptops)"
    echo "  VERSION           Image version (default: latest)"
    echo "  DOCKER_USERNAME   Docker registry username"
    echo "  DOCKER_PASSWORD   Docker registry password"
}

# Parse command line arguments
PYTHON_ONLY=false
JS_ONLY=false
PUSH=false
MULTIARCH=false
CLEANUP=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --python-only)
            PYTHON_ONLY=true
            shift
            ;;
        --js-only)
            JS_ONLY=true
            shift
            ;;
        --push)
            PUSH=true
            shift
            ;;
        --multiarch)
            MULTIARCH=true
            shift
            ;;
        --cleanup)
            CLEANUP=true
            shift
            ;;
        --help)
            show_help
            exit 0
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
    if [ "$PYTHON_ONLY" = true ]; then
        build_python_client
    elif [ "$JS_ONLY" = true ]; then
        build_js_client
    else
        build_python_client
        build_js_client
        tag_latest
    fi

    if [ "$PUSH" = true ]; then
        push_images
    fi

    if [ "$MULTIARCH" = true ]; then
        build_multiarch
    fi

    if [ "$CLEANUP" = true ]; then
        cleanup
    fi

    echo -e "${BLUE}🎉 Build completed successfully!${NC}"
}

# Run main function
main "$@"