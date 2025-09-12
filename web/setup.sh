#!/bin/bash

# PromptOps Web Platform Setup Script

set -e

echo "🚀 Setting up PromptOps Web Platform..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Navigate to web directory
cd web

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if installation was successful
if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# Run type checking
echo "🔍 Running TypeScript type checking..."
npm run type-check

if [ $? -ne 0 ]; then
    echo "❌ TypeScript type checking failed"
    exit 1
fi

echo "✅ TypeScript type checking passed"

# Run linting
echo "🔍 Running ESLint..."
npm run lint

if [ $? -ne 0 ]; then
    echo "❌ ESLint found issues"
    exit 1
fi

echo "✅ ESLint passed"

echo ""
echo "🎉 PromptOps Web Platform setup complete!"
echo ""
echo "🚀 To start the development server:"
echo "   cd web && npm run dev"
echo ""
echo "📊 To run tests:"
echo "   cd web && npm test"
echo ""
echo "🏗️ To build for production:"
echo "   cd web && npm run build"
echo ""
echo "📚 Documentation available in web/README.md"