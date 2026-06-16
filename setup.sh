#!/bin/bash
set -e

SKIP_VERIFY=0
for arg in "$@"; do
  if [ "$arg" == "--skip-verify" ]; then
    SKIP_VERIFY=1
  fi
done

# Install system dependencies
sudo apt-get update
sudo apt-get install -y ffmpeg libnacl-dev

# Install project dependencies
npm ci

# Run verification to ensure setup
if [ "$SKIP_VERIFY" -eq 0 ]; then
  ./scripts/verify-ts.sh
fi
