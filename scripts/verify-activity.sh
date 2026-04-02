#!/bin/bash
set -euo pipefail

echo "Starting Frontend Verification..."

cd activity

echo "1. Installing Dependencies..."
if [ ! -d "node_modules" ]; then
    cd .. && npm ci && cd activity
fi

echo "2. Running Type Check..."
npm run typecheck

echo "3. Running Build..."
npm run build

echo "4. Building Storybook..."
npm run build-storybook

echo "5. Running Playwright Tests (Docker)..."
cd ..
./scripts/playwright-docker.sh "$@"

echo "✅ Frontend Verification Complete!"
