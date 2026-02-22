#!/bin/bash
set -euo pipefail

# No standalone build step — the Docker image is built in the deploy workflow.
# This script exists to satisfy the shared CI contract.
echo "No build step required (Docker build happens during deploy)."
