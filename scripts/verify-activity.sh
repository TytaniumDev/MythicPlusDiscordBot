#!/bin/bash
set -e

echo "Starting Frontend Verification..."

cd activity

echo "1. Installing Dependencies..."
# In CI, root npm ci handles workspace deps; locally we may need it
if [ ! -d "node_modules" ]; then
    cd .. && npm ci && cd activity
fi

# Install Playwright browsers if in CI environment
if [ "$CI" = "true" ]; then
    echo "1.5. Installing Playwright Browsers..."
    npx playwright install --with-deps chromium
fi

echo "2. Running Type Check..."
npm run typecheck

echo "3. Running Build..."
# Build the project to ensure no build errors
npm run build

echo "4. Running Tests..."
# Use --update-snapshots when UPDATE_SNAPSHOTS is set (generates/refreshes baseline PNGs)
if [ "$UPDATE_SNAPSHOTS" = "true" ]; then
    echo "   (updating baseline snapshots)"
    npx playwright test --update-snapshots=all
else
    npx playwright test
fi

echo "✅ Frontend Verification Complete!"
