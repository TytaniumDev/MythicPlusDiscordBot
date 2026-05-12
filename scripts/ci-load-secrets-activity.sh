#!/bin/bash
set -e

DELIM=$(openssl rand -hex 16)
SECRETS=$(doppler secrets download --no-file --format json)
# Mask each secret value so it cannot appear in workflow logs
echo "$SECRETS" | jq -r '
  to_entries[]
  | select(.key == "DISCORD_APPLICATION_ID" or .key == "VITE_SENTRY_DSN" or .key == "SENTRY_AUTH_TOKEN" or (.key | startswith("VITE_FIREBASE_")))
  | .value
' | while IFS= read -r val; do
  [ -n "$val" ] && echo "::add-mask::$val"
done
# Export filtered secrets
echo "$SECRETS" | jq -r --arg d "$DELIM" '
  to_entries[]
  | select(.key == "DISCORD_APPLICATION_ID" or .key == "VITE_SENTRY_DSN" or .key == "SENTRY_AUTH_TOKEN" or (.key | startswith("VITE_FIREBASE_")))
  | "\(.key)<<\($d)\n\(.value)\n\($d)"
' >> "$GITHUB_ENV"
