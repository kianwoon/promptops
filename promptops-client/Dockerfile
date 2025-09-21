# Python client development Dockerfile
FROM python:3.11-slim-bookworm

# Set environment variables
ENV PYTHONPATH=/app \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    jq \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt requirements-dev.txt pyproject.toml ./

# Install Python dependencies
RUN pip install --upgrade pip && \
    pip install -r requirements.txt && \
    if [ -f requirements-dev.txt ]; then pip install -r requirements-dev.txt; fi

# Copy source code
COPY . .

# Install package in development mode
RUN pip install -e .

# Create non-root user
RUN useradd --create-home --shell /bin/bash promptops && \
    chown -R promptops:promptops /app
USER promptops

# Create directories for development
RUN mkdir -p /app/logs /app/tests /app/examples

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import promptops; print('Python client healthy')"

# Default command
CMD ["python", "-m", "promptops.cli", "--help"]