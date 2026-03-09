#!/usr/bin/env bash
set -euo pipefail

echo "=== TypeScript Verification ==="

echo ""
echo "--- Typecheck: packages/shared ---"
npx -w packages/shared tsc --noEmit

echo ""
echo "--- Typecheck: packages/bot ---"
npx -w packages/bot tsc --noEmit

echo ""
echo "--- Tests: packages/bot ---"
npm -w packages/bot run test

echo ""
echo "=== All checks passed ==="
