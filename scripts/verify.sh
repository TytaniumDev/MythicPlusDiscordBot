#!/bin/bash
set -e

echo "Starting verification..."

echo "1. Running Ruff Lint (with --fix)..."
ruff check . --fix

echo "2. Running Ruff Format..."
ruff format .

echo "3. Running Unit Tests..."
python -m unittest discover tests

echo "✅ Verification Complete!"
