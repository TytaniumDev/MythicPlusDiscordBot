#!/bin/bash
set -euo pipefail

# Encode as single-line base64 so multiline JSON is not inlined in the deploy script
# (inlining would break bash and can leak secrets in error messages)
# We use an environment variable to avoid shell interpolation of the JSON content.
firebase_b64=$(echo "$FIREBASE_CREDENTIALS_JSON" | base64 -w0)
echo "firebase_b64<<OUTPUT_EOF" >> "$GITHUB_OUTPUT"
echo "$firebase_b64" >> "$GITHUB_OUTPUT"
echo "OUTPUT_EOF" >> "$GITHUB_OUTPUT"
