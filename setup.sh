#!/bin/bash
set -e

# Install system dependencies
sudo apt-get update
sudo apt-get install -y ffmpeg libnacl-dev

# Install Python dependencies
pip install -r requirements.txt

# Setup assets
python setup_assets.py

# Run tests to verify setup
python -m unittest discover tests
