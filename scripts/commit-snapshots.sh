#!/bin/bash
set -euo pipefail

git add activity/tests/__screenshots__/
if git diff --cached --quiet; then
  echo "No snapshot changes to commit."
else
  git config user.name "github-actions[bot]"
  git config user.email "github-actions[bot]@users.noreply.github.com"
  git commit -m "chore: update visual test snapshots"
  git push
  echo "pushed=true" >> "$GITHUB_OUTPUT"
fi
