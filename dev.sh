#!/bin/bash

# Development script for PromptOps

set -e

echo "🔧 Setting up development environment..."

# Activate virtual environment
source venv/bin/activate

# Set development environment variables
export DEBUG=true
export DATABASE_URL=postgresql://promptops@localhost:5432/promptops
export REDIS_URL=redis://localhost:6379

# Start with hot reload
echo "🚀 Starting development server with hot reload..."
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload