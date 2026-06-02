#!/bin/bash
set -euo pipefail

mkdir -p ~/.ssh
echo "$PI_SSH_KEY" > ~/.ssh/deploy_key
chmod 600 ~/.ssh/deploy_key
# Add Pi to known hosts (get the host key)
ssh-keyscan -H "$PI_HOST" >> ~/.ssh/known_hosts 2>/dev/null || true
