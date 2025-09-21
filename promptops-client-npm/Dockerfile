# JavaScript/TypeScript client development Dockerfile
FROM node:18-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    jq \
    && rm -rf /var/lib/apt/lists/*

# Copy package files first for better caching
COPY package*.json tsconfig.json rollup.config.js jest.config.js ./

# Install npm dependencies
RUN npm ci --only=production && \
    npm ci

# Copy source code
COPY . .

# Build the package
RUN npm run build

# Create non-root user
RUN useradd --create-home --shell /bin/bash nodeuser && \
    chown -R nodeuser:nodeuser /app
USER nodeuser

# Create directories for development
RUN mkdir -p /app/logs /app/tests /app/examples

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "console.log('Node.js client healthy')" || exit 1

# Default command
CMD ["npm", "test"]