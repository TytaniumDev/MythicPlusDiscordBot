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

### Python (Backend)
-   **Type Hints:** Use Python type hints for all function arguments and return values.
-   **Docstrings:** All functions and classes must use **Google-style docstrings** (including `Args:` and `Returns:` sections).
-   **Style:** Follow PEP 8 guidelines (enforced by `ruff`).
-   **Tests:** Ensure all new features or logic changes are accompanied by basic unit tests.

## Project Structure

-   `core/`: Core business logic (Group algorithm, models, configuration).
-   `cogs/`: Discord bot commands and event listeners.
-   `services/`: Bridges between Cogs, Core logic, and Firebase.
-   `activity/`: Frontend code for the Discord Activity (TypeScript/Vite).
-   `tests/`: Unit and integration tests for backend components.
-   `scripts/`: Utility scripts for verification and deployment.

## Production vs. Development

-   **Development**: Uses `uv` and `pyproject.toml`.
-   **Production (Docker)**: Uses `requirements.txt`.
    -   *Note: If you add a dependency, ensure it is reflected in `requirements.txt` for the production build.*

## AI Agents

If you are an AI agent, please refer to **[AGENTS.md](AGENTS.md)** for your specific operational directives.

## Command Style

When documenting or adding commands, prefer **Slash Commands** (e.g., `/activity`, `/wheel`) as the primary interface. Prefix commands (e.g., `!activity`) are supported for legacy compatibility but should not be the focus of documentation.
