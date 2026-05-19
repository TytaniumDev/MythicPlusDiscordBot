#!/bin/bash
set -e

DELIM=$(openssl rand -hex 16)
SECRETS=$(doppler secrets download --no-file --format json)

# Mask each secret value so it cannot appear in workflow logs
echo "$SECRETS" | jq -r --argjson keys "$KEYS" '
  to_entries[] | select(.key | IN($keys[])) | .value
' | while IFS= read -r val; do
  [ -n "$val" ] && echo "::add-mask::$val"
done

# Export only the secrets needed
echo "$SECRETS" | jq -r --argjson keys "$KEYS" --arg d "$DELIM" '
  to_entries[] | select(.key | IN($keys[])) | "\(.key)<<\($d)\n\(.value)\n\($d)"
' >> "$GITHUB_ENV"
