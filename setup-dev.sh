#!/bin/bash

# Developer Environment Setup Script
# This script sets up a complete development environment for PromptOps client libraries

set -e

echo "🚀 Setting up PromptOps Development Environment..."
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check system requirements
check_requirements() {
    echo "🔍 Checking system requirements..."
    echo "--------------------------------"

    # Check Python
    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
        print_status "Python $PYTHON_VERSION found"
    else
        print_error "Python 3 is required but not found"
        exit 1
    fi

    # Check Node.js
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_status "Node.js $NODE_VERSION found"
    else
        print_error "Node.js is required but not found"
        exit 1
    fi

    # Check npm
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm --version)
        print_status "npm $NPM_VERSION found"
    else
        print_error "npm is required but not found"
        exit 1
    fi

    # Check git
    if command -v git &> /dev/null; then
        GIT_VERSION=$(git --version)
        print_status "Git $GIT_VERSION found"
    else
        print_warning "Git not found - some features may not work"
    fi

    # Check Docker (optional)
    if command -v docker &> /dev/null; then
        DOCKER_VERSION=$(docker --version)
        print_status "Docker $DOCKER_VERSION found"
    else
        print_warning "Docker not found - containerized testing unavailable"
    fi

    echo ""
}

# Setup Python development environment
setup_python_dev() {
    echo "🐍 Setting up Python Development Environment..."
    echo "--------------------------------"

    cd /Users/kianwoonwong/Downloads/promptops/promptops-client

    # Create virtual environment if it doesn't exist
    if [ ! -d "venv" ]; then
        print_info "Creating Python virtual environment..."
        python3 -m venv venv
    fi

    # Activate virtual environment
    source venv/bin/activate

    # Upgrade pip
    pip install --upgrade pip setuptools wheel

    # Install package in development mode
    print_info "Installing Python package in development mode..."
    pip install -e ".[dev,redis,otel]"

    # Install pre-commit hooks
    print_info "Installing pre-commit hooks..."
    pre-commit install

    print_status "Python development environment setup complete"

    # Run basic validation
    print_info "Running basic Python validation..."
    if python -c "from promptops import PromptOpsClient; print('✓ Python client import successful')"; then
        print_status "Python package validation passed"
    else
        print_error "Python package validation failed"
        exit 1
    fi

    deactivate
    echo ""
}

# Setup JavaScript development environment
setup_js_dev() {
    echo "🟨 Setting up JavaScript Development Environment..."
    echo "--------------------------------"

    cd /Users/kianwoonwong/Downloads/promptops/promptops-client-npm

    # Install dependencies
    print_info "Installing JavaScript dependencies..."
    npm install

    # Build the package
    print_info "Building JavaScript package..."
    npm run build

    print_status "JavaScript development environment setup complete"

    # Run basic validation
    print_info "Running basic JavaScript validation..."
    if node -e "
    const { PromptOpsClient } = require('./dist/index.js');
    console.log('✓ JavaScript client import successful');
    "; then
        print_status "JavaScript package validation passed"
    else
        print_error "JavaScript package validation failed"
        exit 1
    fi

    echo ""
}

# Setup development tools
setup_dev_tools() {
    echo "🛠️ Setting up Development Tools..."
    echo "--------------------------------"

    # Install global tools
    print_info "Installing global development tools..."

    # Check if npm global directory exists
    NPM_GLOBAL_DIR=$(npm config get prefix)
    if [ -w "$NPM_GLOBAL_DIR" ]; then
        npm install -g typescript @typescript-eslint/eslint-plugin @typescript-eslint/parser
    else
        print_warning "Need sudo to install global packages. Installing locally..."
        npm install typescript @typescript-eslint/eslint-plugin @typescript-eslint/parser
    fi

    # Python development tools
    cd /Users/kianwoonwong/Downloads/promptops/promptops-client
    source venv/bin/activate

    # Install additional development tools
    pip install black isort flake8 mypy pytest-xdist

    # JavaScript linting and formatting
    cd /Users/kianwoonwong/Downloads/promptops/promptops-client-npm
    npm install --save-dev prettier eslint-config-prettier

    print_status "Development tools installation complete"
    echo ""
}

# Create configuration files
create_config_files() {
    echo "⚙️ Creating Configuration Files..."
    echo "--------------------------------"

    # Create VS Code settings
    VSCODE_DIR="$HOME/.config/Code/User"
    if [ -d "$VSCODE_DIR" ]; then
        print_info "Creating VS Code configuration..."

        mkdir -p "$VSCODE_DIR"

        cat > "$VSCODE_DIR/settings.json" << 'EOF'
{
    "python.linting.enabled": true,
    "python.linting.flake8Enabled": true,
    "python.formatting.provider": "black",
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
        "source.fixAll.eslint": true
    },
    "python.analysis.typeCheckingMode": "basic",
    "typescript.preferences.importModuleSpecifier": "relative",
    "eslint.validate": [
        "javascript",
        "typescript"
    ]
}
EOF
        print_status "VS Code configuration created"
    fi

    # Create environment template
    print_info "Creating environment template..."

    cat > /Users/kianwoonwong/Downloads/promptops/.env.template << 'EOF'
# PromptOps Development Environment Template
# Copy this file to .env and fill in your values

# API Configuration
PROMPTOPS_BASE_URL=https://api.promptops.ai
PROMPTOPS_API_KEY=your-api-key-here

# Redis Configuration (optional)
REDIS_URL=redis://localhost:6379

# Testing Configuration
TEST_API_KEY=test-api-key
TEST_BASE_URL=http://localhost:8000

# Development Flags
DEBUG=true
VERBOSE_LOGGING=false
DISABLE_TELEMETRY=false
EOF

    # Create development scripts
    print_info "Creating development scripts..."

    cat > /Users/kianwoonwong/Downloads/promptops/dev-scripts/python-test.sh << 'EOF'
#!/bin/bash
# Quick Python testing script

cd "$(dirname "$0")/../promptops-client"
source venv/bin/activate

echo "🐍 Running Python tests..."
pytest tests/ -v --cov=promptops --cov-report=term-missing

echo "🐍 Running Python linting..."
black --check promptops tests
isort --check-only promptops tests
flake8 promptops tests
mypy promptops

deactivate
EOF

    cat > /Users/kianwoonwong/Downloads/promptops/dev-scripts/js-test.sh << 'EOF'
#!/bin/bash
# Quick JavaScript testing script

cd "$(dirname "$0")/../promptops-client-npm"

echo "🟨 Running JavaScript tests..."
npm test

echo "🟨 Running JavaScript linting..."
npm run lint
npm run format:check

echo "🟨 Running type checking..."
npx tsc --noEmit
EOF

    chmod +x /Users/kianwoonwong/Downloads/promptops/dev-scripts/python-test.sh
    chmod +x /Users/kianwoonwong/Downloads/promptops/dev-scripts/js-test.sh

    print_status "Configuration files created"
    echo ""
}

# Setup documentation environment
setup_docs() {
    echo "📚 Setting up Documentation Environment..."
    echo "--------------------------------"

    # Python documentation
    cd /Users/kianwoonwong/Downloads/promptops/promptops-client

    if [ ! -d "docs" ]; then
        mkdir docs
    fi

    # Create basic docs structure
    cat > docs/development.md << 'EOF'
# Development Guide

## Setting up Development Environment

1. Run the setup script: `./setup-dev.sh`
2. Activate Python virtual environment: `source venv/bin/activate`
3. Install dependencies: `pip install -e ".[dev]"`
4. Run tests: `pytest tests/`

## Development Workflow

1. Make changes to the code
2. Run tests: `pytest tests/ -v`
3. Check formatting: `black . && isort .`
4. Commit changes
5. Push to feature branch
6. Create pull request

## Testing

- Unit tests: `pytest tests/`
- Integration tests: `pytest tests/integration/`
- Coverage: `pytest --cov=promptops`

## Building

- Build package: `python -m build`
- Check package: `twine check dist/*`
EOF

    # JavaScript documentation
    cd /Users/kianwoonwong/Downloads/promptops/promptops-client-npm

    if [ ! -d "docs" ]; then
        mkdir docs
    fi

    cat > docs/development.md << 'EOF'
# Development Guide

## Setting up Development Environment

1. Run the setup script: `./setup-dev.sh`
2. Install dependencies: `npm install`
3. Build the package: `npm run build`
4. Run tests: `npm test`

## Development Workflow

1. Make changes to the code
2. Run tests: `npm test`
3. Check formatting: `npm run format:check`
4. Commit changes
5. Push to feature branch
6. Create pull request

## Testing

- Unit tests: `npm test`
- Coverage: `npm run test:coverage`
- Type checking: `npx tsc --noEmit`

## Building

- Build package: `npm run build`
- Check build: `npm run lint && npm run type-check`
EOF

    print_status "Documentation environment setup complete"
    echo ""
}

# Run validation tests
run_validation() {
    echo "🧪 Running Validation Tests..."
    echo "--------------------------------"

    # Test Python environment
    cd /Users/kianwoonwong/Downloads/promptops/promptops-client
    source venv/bin/activate

    if python -c "from promptops import PromptOpsClient, ClientConfig; print('✓ Python client working')" && \
       pytest tests/ --tb=short --maxfail=1 -q; then
        print_status "Python environment validation passed"
    else
        print_error "Python environment validation failed"
        return 1
    fi

    deactivate

    # Test JavaScript environment
    cd /Users/kianwoonwong/Downloads/promptops/promptops-client-npm

    if npm run test -- --silent > /dev/null 2>&1 && npm run lint > /dev/null 2>&1; then
        print_status "JavaScript environment validation passed"
    else
        print_error "JavaScript environment validation failed"
        return 1
    fi

    print_status "All validation tests passed"
    echo ""
}

# Create quick start guide
create_quick_start() {
    echo "📖 Creating Quick Start Guide..."
    echo "--------------------------------"

    cat > /Users/kianwoonwong/Downloads/promptops/QUICKSTART.md << 'EOF'
# PromptOps Development Quick Start

## First Time Setup

1. **Run the setup script:**
   ```bash
   ./setup-dev.sh
   ```

2. **Configure your environment:**
   ```bash
   cp .env.template .env
   # Edit .env with your API keys
   ```

## Daily Development

### Python Development
```bash
cd promptops-client
source venv/bin/activate

# Run tests
pytest tests/

# Format code
black . && isort .

# Type checking
mypy promptops
```

### JavaScript Development
```bash
cd promptops-client-npm

# Run tests
npm test

# Format code
npm run format

# Type checking
npx tsc --noEmit
```

### Building Packages
```bash
# Python
cd promptops-client
python -m build

# JavaScript
cd promptops-client-npm
npm run build
```

### Testing Changes
```bash
# Run comprehensive test suite
./test-packages.sh

# Run individual language tests
./dev-scripts/python-test.sh
./dev-scripts/js-test.sh
```

## Common Commands

### CLI Usage
```bash
# Python CLI
promptops --help
promptops list --api-key your-key
promptops render hello-world --variables name=Developer

# JavaScript CLI
npx promptops --help
npx promptops list --api-key your-key
npx promptops render hello-world --variables '{"name": "Developer"}'
```

## Getting Help

- Documentation: Check the `docs/` directory in each package
- Issues: GitHub repository issues
- CLI help: `promptops --help` or `npx promptops --help`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `./test-packages.sh`
5. Submit a pull request

Happy coding! 🚀
EOF

    print_status "Quick start guide created"
    echo ""
}

# Main setup function
main() {
    echo "🎯 Starting PromptOps Development Environment Setup"
    echo "================================================"

    # Run all setup steps
    check_requirements
    setup_python_dev
    setup_js_dev
    setup_dev_tools
    create_config_files
    setup_docs
    run_validation
    create_quick_start

    echo "🎉 Development Environment Setup Complete!"
    echo "================================================"

    echo ""
    echo "📋 What's been set up:"
    echo "✓ Python development environment with virtual environment"
    echo "✓ JavaScript development environment with npm dependencies"
    echo "✓ Development tools and linters"
    echo "✓ VS Code configuration (if applicable)"
    echo "✅ Environment templates and configuration files"
    echo "✓ Development scripts and documentation"
    echo "✅ Quick start guide"

    echo ""
    echo "🚀 Next Steps:"
    echo "1. Copy environment template: cp .env.template .env"
    echo "2. Edit .env with your API keys and configuration"
    echo "3. Read the quick start guide: cat QUICKSTART.md"
    echo "4. Start developing! Check docs/ for detailed guides"

    echo ""
    echo "💡 Quick Commands:"
    echo "  Run all tests: ./test-packages.sh"
    echo "  Python tests: ./dev-scripts/python-test.sh"
    echo "  JavaScript tests: ./dev-scripts/js-test.sh"
    echo "  Python CLI: promptops --help"
    echo "  JavaScript CLI: npx promptops --help"

    echo ""
    print_status "Happy coding! 🎉"
}

# Execute main function
main "$@"