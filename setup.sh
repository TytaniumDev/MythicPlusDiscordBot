#!/bin/bash
set -e

# Install system dependencies
sudo apt-get update
sudo apt-get install -y ffmpeg libnacl-dev

# Install project dependencies
npm ci

# Run verification to ensure setup
if [ "$1" != "--skip-verify" ]; then
  ./scripts/verify-ts.sh
fi
