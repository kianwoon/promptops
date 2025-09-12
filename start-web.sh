#!/bin/bash

# Start Web Server Script
# This script starts the React development server for the frontend

echo "🚀 Starting PromptOps Web Server..."
echo "=================================="

# Change to web directory
cd web

# Check if node_modules exists, if not run npm install
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start the development server
echo "🌐 Starting development server on http://localhost:3000"
echo "Press Ctrl+C to stop the server"
echo ""

npm run dev