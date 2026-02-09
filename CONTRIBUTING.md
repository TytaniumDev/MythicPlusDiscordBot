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

### Backend Verification (Python)
Before submitting a PR affecting `core/`, `cogs/`, or `services/`, you **must** run the backend verification script.

```bash
./scripts/verify.sh
```

-   **Linting/Formatting**: Uses `ruff` (automatically fixes issues).
-   **Type Checking**: Uses `pyright`.
-   **Tests**: Runs standard `unittest` discovery.

### Frontend Verification (TypeScript/Vite)
Before submitting a PR affecting `activity/`, you **must** run the frontend verification script.

```bash
./scripts/verify-activity.sh
```

-   **Dependencies**: Runs `npm ci` to ensure clean installs.
-   **Type Checking**: Runs `npm run typecheck` (TypeScript).
-   **Build**: Runs `npm run build` (Vite).
-   **Tests**: Runs `npx playwright test` (End-to-End & Visual Regression).

## Project Structure

-   `core/`: Core business logic (Group algorithm, models, configuration).
-   `cogs/`: Discord bot commands and event listeners.
-   `services/`: Bridges between Cogs, Core logic, and Firebase.
-   `activity/`: Frontend code for the Discord Activity (TypeScript/Vite).
-   `scripts/`: Utility scripts for verification and deployment.

## Production vs. Development

-   **Development (Local & CI)**: Uses `uv` and `pyproject.toml`. The `scripts/verify.sh` workflow relies on this.
-   **Production (Docker)**: Uses `requirements.txt`.
    -   *Crucial: If you add a dependency via `uv add`, you must manually update `requirements.txt` to ensure the Docker build works in production.*

## AI Agents

If you are an AI agent, **[AGENTS.md](AGENTS.md)** is your Single Source of Truth (SSOT). Refer to it for specific operational directives and mandatory checks.

## Command Style

When documenting or adding commands, prefer **Slash Commands** (e.g., `/activity`, `/wheel`) as the primary interface. Prefix commands (e.g., `!activity`) are supported for legacy compatibility but should not be the focus of documentation.
