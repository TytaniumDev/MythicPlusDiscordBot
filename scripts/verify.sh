#!/bin/bash
set -e

echo "Starting verification..."

echo "1. Running Ruff Lint (with --fix)..."
uv run ruff check . --fix

echo "2. Running Ruff Format..."
uv run ruff format .

echo "3. Running Pyright (type check)..."
uv run pyright .

echo "4. Running Unit Tests..."
uv run python -m unittest discover tests

echo "✅ Verification Complete!"
