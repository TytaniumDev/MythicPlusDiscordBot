#!/bin/bash
set -euo pipefail

rm -f "$RUNNER_TEMP/firebase-sa.json"
rm -f packages/functions/.env
