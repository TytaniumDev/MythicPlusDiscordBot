#!/bin/bash
set -euo pipefail

if ! command -v docker &>/dev/null; then
  echo "Error: Docker is required. Install it from https://docs.docker.com/get-docker/"
  exit 1
fi

# --update-and-verify: run --update-snapshots=all then a clean verify pass,
# all inside a single Docker container (one npm ci instead of two).
UPDATE_AND_VERIFY=false
ARGS=()
for arg in "$@"; do
  if [[ "$arg" == "--update-and-verify" ]]; then
    UPDATE_AND_VERIFY=true
  else
    ARGS+=("$arg")
  fi
done

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

PW_VERSION=$(node -p "require('$PROJECT_ROOT/activity/package.json').devDependencies['@playwright/test'].replace(/[^0-9.]/g,'')")
IMAGE="mcr.microsoft.com/playwright:v${PW_VERSION}-noble"

echo "Running Playwright tests in Docker ($IMAGE)..."

if [[ "$UPDATE_AND_VERIFY" == true ]]; then
  docker run --rm --ipc=host \
    -v "$PROJECT_ROOT:/work" \
    -v /work/node_modules \
    -v /work/activity/node_modules \
    -w /work \
    -e CI="${CI:-}" \
    -e PLAYWRIGHT_TEST=1 \
    "$IMAGE" \
    bash -c '
      npm ci --ignore-scripts
      npm rebuild
      cd activity
      for pkg in lightningcss @tailwindcss/oxide; do
        VER=$(node -p "require(\"./node_modules/$pkg/package.json\").version" 2>/dev/null) || continue
        rm -rf "node_modules/$pkg"
        npm install --no-save --install-strategy=nested "$pkg@$VER"
      done
      echo "==> Updating snapshots..."
      npx playwright test --update-snapshots=all "$@"
      echo "==> Verifying snapshots are stable..."
      npx playwright test "$@"
    ' bash "${ARGS[@]}"
else
  docker run --rm --ipc=host \
    -v "$PROJECT_ROOT:/work" \
    -v /work/node_modules \
    -v /work/activity/node_modules \
    -w /work \
    -e CI="${CI:-}" \
    -e PLAYWRIGHT_TEST=1 \
    "$IMAGE" \
    bash -c '
      npm ci --ignore-scripts
      npm rebuild
      cd activity
      for pkg in lightningcss @tailwindcss/oxide; do
        VER=$(node -p "require(\"./node_modules/$pkg/package.json\").version" 2>/dev/null) || continue
        rm -rf "node_modules/$pkg"
        npm install --no-save --install-strategy=nested "$pkg@$VER"
      done
      npx playwright test "$@"
    ' bash "$@"
fi
