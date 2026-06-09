#!/bin/bash
set -euo pipefail

DELIM=$(openssl rand -hex 16)
SECRETS=$(doppler secrets download --no-file --format json)
KEYS='["FIREBASE_CREDENTIALS_JSON","BNET_CLIENT_ID","BNET_CLIENT_SECRET"]'

echo "$SECRETS" | jq -r --argjson keys "$KEYS" '
  to_entries[] | select(.key | IN($keys[])) | .value
' | while IFS= read -r val; do
  [ -n "$val" ] && echo "::add-mask::$val"
done

echo "$SECRETS" | jq -r --argjson keys "$KEYS" --arg d "$DELIM" '
  to_entries[] | select(.key | IN($keys[])) | "\(.key)<<\($d)\n\(.value)\n\($d)"
' >> "$GITHUB_ENV"
