# Contributing to MythicPlusDiscordBot

Thank you for your interest in contributing! This guide covers the technical standards and workflows for developers. **Note:** This document is the primary entry point for human developers. If you are an AI agent, please refer to **[AGENTS.md](AGENTS.md)** for your specific operational directives.

## Development Environment

This project is a monorepo that uses **npm workspaces** for package management: Firebase Cloud Functions, shared code, and a React frontend.

1.  **Install Node.js 22**: the version in `.nvmrc`, which CI and Cloud Functions also use (`nvm use` picks it up).
2.  **Install dependencies**:
    ```bash
    npm ci
    ```
    This installs dependencies for every workspace (`packages/shared`, `packages/functions`, and `activity/`) from the lockfile.

## Verification

Before submitting a PR, you **must** run the verification script. It lints every package and the activity, type checks them, bundles the Cloud Functions, and runs the unit tests.

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
-   **Storybook**: `npm run build-storybook`
-   **E2E Tests**: `./scripts/playwright-docker.sh` (from the project root)

> **Playwright must run in Docker.** Snapshots are pixel-compared with a 2% tolerance and Chromium's font rendering differs by OS — running `npx playwright test` directly will produce noisy diffs. The Playwright config enforces this with a `PLAYWRIGHT_TEST` env guard. To regenerate snapshots, run `./scripts/playwright-docker.sh --update-snapshots`.

### Visual Regression Tests
The project uses Playwright for visual regression testing.
-   Snapshots are stored in `activity/tests/__screenshots__/`.
-   **Rule:** If your changes affect the UI, you must update and commit the new snapshots (regenerated via Docker — see above).
-   **CI:** The `Verify Activity` workflow runs them on every PR that touches the activity and fails if snapshots do not match. If you can't run Docker locally, run the **Update Snapshots** workflow on your branch.

## Coding Standards

- **Type Safety**: Use strict TypeScript definitions. Avoid `any` whenever possible.
- **Shared Code**: Business logic that can be reused (like group creation algorithms or shared models) should be placed in `packages/shared/`.
- **Formatting**: Adhere to the existing linting and formatting rules enforced by `eslint`.

## Security & CI Standards

This project has strict requirements to prevent secret leaks and ensure CI reliability.
- Please review **[docs/CI_STANDARDS.md](docs/CI_STANDARDS.md)** for the complete set of rules.
- The project enforces these standards automatically using the shared workflow-lint job in CI.

## Project Structure

-   `packages/functions/`: Firebase Cloud Functions (TypeScript). Handles the lobby roster, reports and slash commands, background syncing, external API integrations (Raider.IO, Battle.net), and webhooks.
    -   `scripts/registerCommands.ts`: registers Discord's application commands on every deploy.
-   `packages/shared/`: Shared models and business logic (e.g., `parallelGroupCreator.ts`).
-   `activity/`: Frontend code for the Discord Activity (React/TypeScript/Vite).
-   `scripts/`: Utility scripts for verification and CI.

## Command Style

Slash commands are Discord HTTP interactions answered by the `discordInteractions` Cloud Function. Define them in `packages/functions/src/applicationCommands.ts` (the deploy registers them) and handle them in `packages/functions/src/reportCommands.ts`.
