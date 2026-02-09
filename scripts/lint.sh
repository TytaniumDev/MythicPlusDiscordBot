#!/bin/bash
set -e

FIX_ARGS="--fix"
FORMAT_ARGS=""

if [ "$1" == "--ci" ]; then
    FIX_ARGS=""
    FORMAT_ARGS="--check"
fi

echo "Running Ruff Lint..."
uv run ruff check . $FIX_ARGS

echo "Running Ruff Format..."
uv run ruff format . $FORMAT_ARGS

echo "Running Pyright..."
uv run pyright .
