#!/bin/bash

# PromptOps Startup Script

set -e

echo "🚀 Starting PromptOps Registry Platform..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found. Creating one..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "📦 Activating virtual environment..."
source venv/bin/activate

# Install dependencies if needed
if [ -f "requirements.txt" ]; then
    echo "📥 Installing dependencies..."
    pip install -r requirements.txt
fi

# Check if environment file exists
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found. Creating from template..."
    cp .env.example .env
    echo "🔧 Please edit .env file with your configuration before running the application."
fi

# Start the application
echo "🌟 Starting FastAPI application..."
python -m app.main