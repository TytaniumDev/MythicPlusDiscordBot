#!/bin/bash
set -e

echo "Starting verification..."

echo "1. Running Lint & Format (Fix enabled)..."
./scripts/lint.sh

echo "2. Running Unit Tests..."
./scripts/test.sh

echo "✅ Verification Complete!"
