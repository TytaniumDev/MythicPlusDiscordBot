#!/bin/bash
set -e

echo "Running Unit Tests..."
uv run python -m unittest discover tests
