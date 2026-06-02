#!/bin/bash
set -euo pipefail

echo "$FIREBASE_CREDENTIALS_JSON" > "$RUNNER_TEMP/firebase-sa.json"
export GOOGLE_APPLICATION_CREDENTIALS="$RUNNER_TEMP/firebase-sa.json"

# Write Battle.net secrets as runtime env vars for Cloud Functions
printf 'BNET_CLIENT_ID=%s\nBNET_CLIENT_SECRET=%s\n' \
  "$BNET_CLIENT_ID" "$BNET_CLIENT_SECRET" \
  > packages/functions/.env

npx firebase-tools@14 deploy --only firestore:rules,functions --non-interactive --force
