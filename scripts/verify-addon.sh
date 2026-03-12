#!/usr/bin/env bash
set -euo pipefail

cd addon

echo "=== Addon: luacheck ==="
luacheck src/ tests/

echo ""
echo "=== Addon: busted tests ==="
busted

echo ""
echo "All addon checks passed."
