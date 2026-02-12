#!/bin/bash
set -e

echo "Starting verification..."

if [ "$CI" = "true" ]; then
    echo "1. Running Ruff Lint (Check)..."
    uv run ruff check .

    echo "2. Running Ruff Format (Check)..."
    uv run ruff format --check .
else
    echo "1. Running Ruff Lint (Fix)..."
    uv run ruff check . --fix

    echo "2. Running Ruff Format (Fix)..."
    uv run ruff format .
fi

echo "3. Running Pyright (type check)..."
uv run pyright .

echo "4. Running Unit Tests..."
uv run python -m unittest discover tests

echo "✅ Verification Complete!"
