#!/bin/bash
set -e

echo "Testing SSH connection to $PI_HOST..."
ssh -v -i ~/.ssh/deploy_key -o ConnectTimeout=30 -o StrictHostKeyChecking=accept-new \
  "$PI_USER@$PI_HOST" "echo 'SSH connection successful!'"
