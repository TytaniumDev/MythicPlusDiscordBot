# Contributing to MythicPlusDiscordBot

Thank you for your interest in contributing! This guide covers the technical standards and workflows for developers.

## Development Environment

This project uses **[uv](https://github.com/astral-sh/uv)** for fast Python package management and virtual environment handling.

1.  **Install uv**: Follow the [official instructions](https://github.com/astral-sh/uv).
2.  **Sync dependencies**:
    ```bash
    uv sync
    ```
    This creates a virtual environment and installs all dependencies defined in `pyproject.toml` (and `uv.lock`).

## Verification

Before submitting a PR, you **must** run the verification script. This script handles linting, formatting, type checking, and testing.

```bash
./scripts/verify.sh
```

-   **Linting/Formatting**: Uses `ruff` (automatically fixes issues).
-   **Type Checking**: Uses `pyright`.
-   **Tests**: Runs standard `unittest` discovery.

## Project Structure

-   `core/`: Core business logic (Group algorithm, models, configuration).
-   `cogs/`: Discord bot commands and event listeners.
-   `services/`: Bridges between Cogs, Core logic, and Firebase.
-   `activity/`: Frontend code for the Discord Activity (TypeScript/Vite).
-   `scripts/`: Utility scripts for verification and deployment.

## Production vs. Development

-   **Development**: Uses `uv` and `pyproject.toml`.
-   **Production (Docker)**: Uses `requirements.txt`.
    -   *Note: If you add a dependency, ensure it is reflected in `requirements.txt` for the production build.*

## AI Agents

If you are an AI agent, please refer to **[AGENTS.md](AGENTS.md)** for your specific operational directives.

## Command Style

When documenting or adding commands, prefer **Slash Commands** (e.g., `/activity`, `/wheel`) as the primary interface. Prefix commands (e.g., `!activity`) are supported for legacy compatibility but should not be the focus of documentation.
