#!/bin/bash
set -euo pipefail

# Setup Python + uv
curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"
uv sync --frozen

# Lint
uv run ruff check .
uv run ruff format --check .
uv run pyright .
