#!/bin/bash
set -euo pipefail

if [ "${TAILSCALE_OUTCOME:-}" != "success" ]; then
  echo "::error::============================================"
  echo "::error::TAILSCALE CONNECTION FAILED"
  echo "::error::============================================"
  echo "::error::The Tailscale OAuth credentials may be invalid!"
  echo "::error::"
  echo "::error::To fix this:"
  echo "::error::1. Go to Tailscale Admin Console → Settings → OAuth clients"
  echo "::error::2. Create/verify OAuth client with 'devices:write' scope"
  echo "::error::3. Ensure TS_OAUTH_CLIENT_ID and TS_OAUTH_SECRET are set in Doppler"
  echo "::error::4. Verify ACLs allow tag:ci-runner"
  echo "::error::============================================"
  exit 1
fi
echo "Tailscale connected successfully"
echo "Tailscale status:"
tailscale status
