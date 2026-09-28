#!/usr/bin/env bash
# End-to-end smoke test: builds the activity, points it at local Firestore and
# Auth emulators (Firestore loads firestore.rules), and has Playwright play a
# full lobby → spin → results → new round session, checking the groups and
# history written to Firestore. See activity/smoke/.
#
# Needs Java (for the emulators) and Playwright's Chromium:
#   npx -w activity playwright install chromium
#
# Usage: ./scripts/smoke-test.sh [extra playwright args]
set -euo pipefail

cd "$(dirname "$0")/.."

# demo- project IDs are emulator-only; nothing can reach a real project.
export GCLOUD_PROJECT="demo-wheelson-smoke"

echo "=== End-to-end smoke test (Firebase emulators) ==="

# firebase-tools is not a direct dep — use the same version the deploy pipeline uses.
exec npx -y firebase-tools@14 emulators:exec \
  --only firestore,auth \
  --project "$GCLOUD_PROJECT" \
  "npm -w activity exec -- playwright test -c playwright.smoke.config.ts $*"
