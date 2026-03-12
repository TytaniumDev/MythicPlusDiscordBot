#!/usr/bin/env bash
set -euo pipefail

echo "=== Addon: luacheck ==="
luacheck addon/src/ addon/tests/ --config addon/.luacheckrc

echo ""
echo "=== Addon: busted tests ==="
cd addon && busted tests/ && cd ..

echo ""
echo "All addon checks passed."
