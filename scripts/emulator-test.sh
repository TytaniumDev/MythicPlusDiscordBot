#!/usr/bin/env bash
# Run integration tests against a local Firestore emulator.
# Starts the emulator (on port 8080), runs the tests, then shuts it down.
#
# Usage: ./scripts/emulator-test.sh [extra vitest args]
set -euo pipefail

cd "$(dirname "$0")/.."

export FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"
# Any non-empty projectId works for the emulator; keep it namespaced so it's
# obvious in logs.
export GCLOUD_PROJECT="demo-wheelson-emulator"

echo "=== Firestore Emulator Integration Tests ==="
echo "Using emulator at $FIRESTORE_EMULATOR_HOST"

# firebase-tools is not a direct dep — use the same version the deploy pipeline uses.
exec npx -y firebase-tools@14 emulators:exec \
  --only firestore \
  --project "$GCLOUD_PROJECT" \
  "npm -w packages/bot run test -- --run integration $*"
