#!/bin/bash
set -euo pipefail

UPDATE_SNAPSHOTS=0
if [ "${1:-}" = "--update-snapshots" ] || [ "${1:-}" = "--update-snapshots=all" ]; then
    UPDATE_SNAPSHOTS=1
fi

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

cd ..

if [ "$UPDATE_SNAPSHOTS" -eq 1 ]; then
    echo "5. Updating Playwright Snapshots (Docker)..."
    ./scripts/playwright-docker.sh --update-snapshots=all
else
    echo "5. Running Playwright Tests (Docker)..."
    ./scripts/playwright-docker.sh
fi

echo "✅ Frontend Verification Complete!"
