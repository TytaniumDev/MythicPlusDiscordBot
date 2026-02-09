#!/bin/bash
set -e

# This script is executed on the remote server via SSH.
# It expects the following environment variables to be set:
# - GHCR_TOKEN
# - GITHUB_REPOSITORY_OWNER
# - GITHUB_REF_NAME
# - IMAGE_NAME
# - IMAGE_TAG
# - BOT_TOKEN
# - DISCORD_APPLICATION_ID
# - GITHUB_TOKEN
# - FIREBASE_B64

echo "=== Deploy started ==="

# Login to GHCR
echo "Logging into GHCR..."
echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GITHUB_REPOSITORY_OWNER" --password-stdin

# Update repo
echo "Updating repo..."
git fetch origin && git reset --hard "origin/$GITHUB_REF_NAME"

# Set environment for docker compose
export FIREBASE_CREDENTIALS_JSON="$(echo "$FIREBASE_B64" | base64 -d)"

# Deploy
echo "Pulling image..."
docker compose pull --quiet
echo "Starting containers..."
docker compose up -d --remove-orphans

# Verify container is running
echo "Verifying deployment..."
docker compose ps

# Cleanup
docker image prune -f > /dev/null
echo "=== Deploy finished ==="
