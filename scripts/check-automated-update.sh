#!/usr/bin/env bash
set -euo pipefail

AUTHOR=$(git log -1 --format='%an')
MSG=$(git log -1 --format='%s')

if [ "$AUTHOR" = "github-actions[bot]" ] && [[ "$MSG" == "chore: update visual test snapshots"* ]]; then
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    echo "skip=true" >> "$GITHUB_OUTPUT"
  fi
  echo "Skipping — last commit was an automated snapshot update."
fi
