# Contributing to MythicPlusDiscordBot

Thank you for your interest in contributing! This guide covers the technical standards and workflows for developers. **Note:** This document is the primary entry point for human developers. If you are an AI agent, please refer to **[AGENTS.md](AGENTS.md)** for your specific operational directives.

## Development Environment

This project is a monorepo that uses **npm workspaces** for package management, encompassing both a Discord bot backend and a React frontend.

1.  **Install Node.js**: Ensure you are using the Node.js version specified in the `Dockerfile` or your local development environment.
2.  **Install dependencies**:
    ```bash
    npm install
    ```
    This installs dependencies for all packages in the workspace (`packages/bot`, `packages/shared`, and `activity/`).

## Verification

Before submitting a PR, you **must** run the backend verification script. This script handles linting, formatting, type checking, and testing for the bot and shared packages.

```bash
./scripts/verify-ts.sh
```
Or use the npm script:
```bash
npm run verify
```

-   **Linting/Formatting**: Uses `eslint` (the project has no Prettier config — `eslint` is the only formatter/linter).
-   **Type Checking**: Uses `tsc --noEmit`.
-   **Tests**: Runs tests via `vitest`.

## Frontend Verification

If your changes affect the `activity/` directory (the frontend app), you **must** also run the frontend verification script:

```bash
./scripts/verify-activity.sh
```

This script handles:
-   **Dependencies**: `npm ci`
-   **Type Checking**: `npm run typecheck`
-   **Build**: `npm run build`
-   **E2E Tests**: `./scripts/playwright-docker.sh` (from the project root)

> **Playwright must run in Docker.** Snapshots are pixel-compared with a 2% tolerance and Chromium's font rendering differs by OS — running `npx playwright test` directly will produce noisy diffs. The Playwright config enforces this with a `PLAYWRIGHT_TEST` env guard. To regenerate snapshots, run `./scripts/playwright-docker.sh --update-snapshots`.

### Visual Regression Tests
The project uses Playwright for visual regression testing.
-   Snapshots are stored in `activity/tests/__screenshots__/`.
-   **Rule:** If your changes affect the UI, you must update and commit the new snapshots (regenerated via Docker — see above).
-   **CI:** Tests run automatically in CI and will fail if snapshots do not match.

## Coding Standards

- **Type Safety**: Use strict TypeScript definitions. Avoid `any` whenever possible.
- **Shared Code**: Business logic that can be reused (like group creation algorithms or shared models) should be placed in `packages/shared/`.
- **Formatting**: Adhere to the existing linting and formatting rules enforced by `eslint`.

## Security & CI Standards

This project has strict requirements to prevent secret leaks and ensure CI reliability.
- Please review **[docs/CI_STANDARDS.md](docs/CI_STANDARDS.md)** for the complete set of rules.
- The project enforces these standards automatically using the shared workflow-lint job in CI.

## Project Structure

-   `packages/bot/`: The Discord bot backend (TypeScript).
    -   `src/commands/`: Discord slash command handlers.
    -   `src/core/`: Core configuration, utilities, and integrations.
    -   `src/services/`: Services bridging commands and external systems (Firebase, state).
    -   `tests/`: Unit tests using Vitest.
-   `packages/functions/`: Firebase Cloud Functions (TypeScript). Handles background syncing, external API integrations (Raider.IO, Battle.net), and webhooks.
-   `packages/shared/`: Shared models and business logic (e.g., `parallelGroupCreator.ts`).
-   `activity/`: Frontend code for the Discord Activity (React/TypeScript/Vite).
-   `scripts/`: Utility scripts for verification and CI.

## Production vs. Development

-   **Development**: Run the bot locally using `npm -w @mythicplus/bot run dev` (uses `tsx`).
-   **Production (Docker)**: The `Dockerfile` compiles the TypeScript bot to JS and runs it natively with Node for improved startup speed and memory performance.

## Command Style

All new commands should be implemented as **Slash Commands**. Prefix commands are deprecated. Define your commands using Discord's `SlashCommandBuilder` in `packages/bot/src/main.ts` and handle them within the dedicated `src/commands/` handler classes.
