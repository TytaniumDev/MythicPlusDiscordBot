#!/bin/bash
set -euo pipefail

# Setup Python + uv
curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"
uv sync --frozen

# Run tests
uv run python -m unittest discover tests
