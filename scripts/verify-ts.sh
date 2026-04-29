#!/usr/bin/env bash
set -euo pipefail

RUN_LINT=0
RUN_BUILD=0
RUN_TEST=0

if [ $# -eq 0 ]; then
  RUN_LINT=1
  RUN_BUILD=1
  RUN_TEST=1
else
  for arg in "$@"; do
    case $arg in
      --lint)
        RUN_LINT=1
        ;;
      --build)
        RUN_BUILD=1
        ;;
      --test)
        RUN_TEST=1
        ;;
      *)
        echo "Unknown argument: $arg"
        echo "Usage: $0 [--lint] [--build] [--test]"
        exit 1
        ;;
    esac
  done
fi

echo "=== TypeScript Verification ==="

if [ "$RUN_LINT" -eq 1 ]; then
  echo ""
  echo "--- Linting: Backend Packages ---"
  npm run lint
fi

if [ "$RUN_BUILD" -eq 1 ]; then
  echo ""
  echo "--- Typecheck: packages/shared ---"
  npx -w packages/shared tsc --noEmit

  echo ""
  echo "--- Typecheck: packages/bot ---"
  npx -w packages/bot tsc --noEmit

  echo ""
  echo "--- Typecheck: packages/functions ---"
  npx -w packages/functions tsc --noEmit
fi

if [ "$RUN_TEST" -eq 1 ]; then
  echo ""
  echo "--- Tests: packages/shared ---"
  npm -w packages/shared run test

  echo ""
  echo "--- Tests: packages/functions ---"
  npm -w packages/functions run test

  echo ""
  echo "--- Tests: packages/bot ---"
  npm -w packages/bot run test
fi

echo ""
echo "=== All checks passed ==="
