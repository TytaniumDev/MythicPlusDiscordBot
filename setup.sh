#!/bin/bash
set -e

# Install system dependencies
sudo apt-get update
sudo apt-get install -y ffmpeg libnacl-dev

# Install Python dependencies
uv sync

# Install pre-commit hook (Ruff lint + format on commit)
uv run pre-commit install

# Run tests to verify setup
uv run python -m unittest discover tests
