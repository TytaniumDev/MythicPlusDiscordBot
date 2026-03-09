#!/bin/bash
set -e

echo "Starting Frontend Verification..."

cd activity

echo "1. Installing Dependencies..."
if [ ! -d "node_modules" ]; then
    cd .. && npm ci && cd activity
fi

if [ "$CI" = "true" ]; then
    echo "1.5. Fixing platform-specific native binaries..."
    # npm hoists lightningcss platform binary to root node_modules/ but lightningcss
    # itself stays in activity/node_modules/. Symlink so require() can find it.
    PLATFORM_PKG="lightningcss-$(node -p "process.platform")-$(node -p "process.arch")"
    if [ "$(node -p "process.platform")" = "linux" ]; then
        PLATFORM_PKG="${PLATFORM_PKG}-gnu"
    fi
    if [ -d "../node_modules/${PLATFORM_PKG}" ] && [ ! -d "node_modules/${PLATFORM_PKG}" ]; then
        ln -s "../../node_modules/${PLATFORM_PKG}" "node_modules/${PLATFORM_PKG}"
        echo "   Symlinked ${PLATFORM_PKG} from root node_modules"
    fi

    echo "1.6. Installing Playwright Browsers..."
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
