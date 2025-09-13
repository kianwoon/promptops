.PHONY: help install install-dev test lint format clean build upload docs

help:
	@echo "Available commands:"
	@echo "  install      Install package"
	@echo "  install-dev  Install package with development dependencies"
	@echo "  test         Run tests"
	@echo "  lint         Run linting"
	@echo "  format       Format code"
	@echo "  clean        Clean build artifacts"
	@echo "  build        Build package"
	@echo "  upload       Upload to PyPI"
	@echo "  docs         Generate documentation"

install:
	pip install -e .

install-dev:
	pip install -e ".[dev,redis,otel]"

test:
	pytest -v

test-cov:
	pytest --cov=promptops --cov-report=html --cov-report=term-missing

lint:
	flake8 promptops examples
	black --check promptops examples
	isort --check-only promptops examples
	mypy promptops

format:
	black promptops examples
	isort promptops examples

clean:
	rm -rf build/
	rm -rf dist/
	rm -rf *.egg-info/
	rm -rf htmlcov/
	rm -rf .coverage
	rm -rf .pytest_cache/
	rm -rf .mypy_cache/
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete

build: clean
	python -m build

upload: build
	twine upload dist/*

upload-test: build
	twine upload --repository testpypi dist/*

docs:
	@echo "Documentation is in README.md"
	@echo "For API documentation, use: python -m pydoc promptops"

# Development helpers
demo:
	python examples/basic_usage.py

demo-advanced:
	python examples/advanced_usage.py

check-types:
	mypy promptops --disallow-untyped-defs

security-check:
	bandit -r promptops/

pre-commit:
	pre-commit run --all-files

# Quick development cycle
dev: format lint test
	@echo "Development cycle complete!"