#!/bin/bash
set -e

# Install system dependencies
sudo apt-get update
sudo apt-get install -y ffmpeg libnacl-dev

# Install Python dependencies
pip install -r requirements.txt
pip install -r requirements-dev.txt

# Install pre-commit hook (Ruff lint + format on commit)
pre-commit install

# Setup assets
python setup_assets.py

# Run tests to verify setup
python -m unittest discover tests
