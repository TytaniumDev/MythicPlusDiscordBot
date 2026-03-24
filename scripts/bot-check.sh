#!/bin/bash
set -euo pipefail

AUTHOR=$(git log -1 --format='%an')
MSG=$(git log -1 --format='%s')
if [ "$AUTHOR" = "github-actions[bot]" ] && [[ "$MSG" == "chore: update visual test snapshots"* ]]; then
  echo "skip=true" >> "$GITHUB_OUTPUT"
  echo "Skipping — last commit was an automated snapshot update."
fi
