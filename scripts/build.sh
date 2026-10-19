#!/bin/bash
set -euo pipefail

# Part of the TytaniumDev/.github CI template's contract (scripts/lint.sh,
# build.sh, test.sh). This repo runs its own ci-shared.yml instead, and the
# Docker image is built in deploy.yml, so there is nothing to build here.
echo "No build step required (Docker build happens during deploy)."
