#!/bin/bash
set -e

ssh -i ~/.ssh/deploy_key -o ConnectTimeout=30 \
  "$PI_USER@$PI_HOST" bash << DEPLOY_SCRIPT
  set -e
  echo "=== Deploy started ==="

  # Login to GHCR
  echo "Logging into GHCR..."
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GITHUB_REPOSITORY_OWNER" --password-stdin

  # Update repo
  cd "$PI_APP_DIR"
  echo "Updating repo..."
  git gc --auto 2>/dev/null || true
  git fetch origin && git reset --hard origin/"$GITHUB_REF_NAME"

  # Set environment for docker compose (Firebase passed as base64 to avoid multiline/leak)
  export IMAGE_NAME=\$(echo ghcr.io/"$GITHUB_REPOSITORY" | tr '[:upper:]' '[:lower:]')
  export IMAGE_TAG="$GITHUB_SHA"
  export BOT_TOKEN="$BOT_TOKEN"
  export DISCORD_APPLICATION_ID="$DISCORD_APPLICATION_ID"
  export GITHUB_TOKEN="$GH_ISSUE_TOKEN"
  FIREBASE_B64='$FIREBASE_B64_OUTPUT'
  export FIREBASE_CREDENTIALS_JSON="\$(echo "\$FIREBASE_B64" | base64 -d)"

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
