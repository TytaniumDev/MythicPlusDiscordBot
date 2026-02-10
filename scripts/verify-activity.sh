#!/bin/bash
set -e

echo "Starting Frontend Verification..."

cd activity

echo "1. Installing Dependencies..."
npm ci

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
npx playwright test --update-snapshots

echo "✅ Frontend Verification Complete!"
