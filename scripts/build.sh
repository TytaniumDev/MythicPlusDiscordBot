#!/bin/bash
set -euo pipefail

# Part of the TytaniumDev/.github CI template's contract (scripts/lint.sh,
# build.sh, test.sh). This repo runs its own ci-shared.yml instead, and
# deploy.yml builds what it deploys, so there is nothing to build here.
echo "No build step required (deploy.yml builds what it deploys)."
