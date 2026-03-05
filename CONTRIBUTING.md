# Contributing to MythicPlusDiscordBot

Thank you for your interest in contributing! This guide covers the technical standards and workflows for developers. **Note:** This document is the primary entry point for human developers. If you are an AI agent, please refer to **[AGENTS.md](AGENTS.md)** for your specific operational directives.

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

## Frontend Verification

If your changes affect the `activity/` directory (the frontend app), you **must** also run the frontend verification script:

```bash
./scripts/verify-activity.sh
```

This script handles:
-   **Dependencies**: `npm ci`
-   **Type Checking**: `npm run typecheck`
-   **Build**: `npm run build`
-   **E2E Tests**: `npx playwright test`

### Visual Regression Tests
The project uses Playwright for visual regression testing.
-   Snapshots are stored in `activity/tests/visual.spec.ts-snapshots`.
-   **Rule:** If your changes affect the UI, you must update and commit the new snapshots.
-   **CI:** Tests run automatically in CI and will fail if snapshots do not match.

## Coding Standards

- **Docstrings**: All Python backend code must use **Google-style docstrings**, including explicit `Args:` and `Returns:` sections for functions and methods.
- **Type Hints**: Full type hints are mandatory for all Python code. This ensures strict validation by `pyright` during verification.

## Security & CI Standards

This project has strict requirements to prevent secret leaks and ensure CI reliability.
- Please review **[docs/CI_STANDARDS.md](docs/CI_STANDARDS.md)** for the complete set of rules.
- The project enforces these standards automatically using the `scripts/check-workflow-secrets.py` tool in CI.

## Project Structure

-   `core/`: Core business logic (Group algorithm, models, configuration).
-   `cogs/`: Discord bot commands and event listeners.
-   `services/`: Bridges between Cogs, Core logic, and Firebase.
-   `activity/`: Frontend code for the Discord Activity (TypeScript/Vite).
-   `tests/`: Unit tests and mock classes for the Python backend.
-   `scripts/`: Utility scripts for verification and deployment.

## Production vs. Development

-   **Development**: Uses `uv` and `pyproject.toml`.
-   **Production (Docker)**: Uses `requirements.txt`.
    -   *Note: If you add a dependency, ensure it is reflected in `requirements.txt` for the production build.*

## Command Style

When documenting or adding commands, prefer **Slash Commands** (e.g., `/activity`, `/wheel`) as the primary interface. Prefix commands (e.g., `!activity`) are supported for legacy compatibility but should not be the focus of documentation.
