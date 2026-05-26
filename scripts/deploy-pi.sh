#!/bin/bash
set -euo pipefail

REPOSITORY_OWNER="$1"
REF_NAME="$2"
SHA="$3"
REPOSITORY="$4"
FIREBASE_B64="$5"

ssh -i ~/.ssh/deploy_key -o ConnectTimeout=30 \
  "$PI_USER@$PI_HOST" bash << DEPLOY_SCRIPT
  set -e
  echo "=== Deploy started ==="

  # Login to GHCR
  echo "Logging into GHCR..."
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "$REPOSITORY_OWNER" --password-stdin

  # Update repo
  cd "$PI_APP_DIR"
  echo "Updating repo..."
  git gc --auto 2>/dev/null || true
  git fetch origin && git reset --hard origin/"$REF_NAME"

  # Set environment for docker compose (Firebase passed as base64 to avoid multiline/leak)
  export IMAGE_NAME=\$(echo ghcr.io/"$REPOSITORY" | tr '[:upper:]' '[:lower:]')
  export IMAGE_TAG="$SHA"
  export BOT_TOKEN="$BOT_TOKEN"
  export DISCORD_APPLICATION_ID="$DISCORD_APPLICATION_ID"
  export GITHUB_TOKEN="$GH_ISSUE_TOKEN"
  export FIREBASE_CREDENTIALS_JSON="\$(echo "$FIREBASE_B64" | base64 -d)"

  # Free disk space before pulling new image
  echo "Cleaning up old Docker resources..."
  docker system prune -af --filter "until=1h" > /dev/null 2>&1 || true

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
DEPLOY_SCRIPT
