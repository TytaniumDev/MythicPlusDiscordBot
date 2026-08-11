# Agent Instructions: MythicPlusDiscordBot

This file provides the necessary context and operational standards for AI agents working on this codebase.

## Project Overview
**MythicPlusDiscordBot** is a TypeScript monorepo application designed to integrate World of Warcraft Mythic Plus data into Discord, with a web-based activity frontend. It uses npm workspaces across `@mythicplus/bot`, `@mythicplus/shared`, `@mythicplus/functions`, and `activity`.

## Mandatory Development Standards

### 1. Code Quality & Verification
To maintain consistency and prevent CI failures, you **MUST** run the appropriate verification script for your changes:

- **Backend (`packages/`):** Run the verification script:
  ```bash
  ./scripts/verify-ts.sh
  ```
  Runs ESLint, `tsc` (Type Check), and Vitest (Tests).
  For integration testing, run the emulator test script:
  ```bash
  ./scripts/emulator-test.sh
  ```
- **Frontend (`activity/`):** Run the verification script:
  ```bash
  ./scripts/verify-activity.sh
  ```
  Runs TypeScript typecheck, Vite build, and Playwright E2E Tests.
- **Verification:** Do not submit code unless the relevant script passes successfully.

### 2. TypeScript Conventions
- Use strict TypeScript typing for all function arguments, return values, and interfaces.
- Avoid `any` whenever possible.
- Ensure all new features or logic changes are accompanied by Vitest unit tests.

### 3. discord.js Implementation
- All bot commands, events, and API interactions must be implemented using `async/await` syntax.
- Extract complex UI generation logic (embeds, etc.) into dedicated UI modules (e.g., `roleUi.ts`) to decouple presentation from business logic.

### 4. CI/CD & Security Standards
Detailed guidelines for writing GitHub Actions workflows and handling secrets are available in:
- [**docs/CI_STANDARDS.md**](docs/CI_STANDARDS.md)

**Key Rule:** Never log secrets or inline multi-line secrets in workflows.

## Task Execution Workflow
1. **Analyze:** Understand the task requirements and review the relevant codebase.
2. **Environment:** Ensure the environment is set up and dependencies are installed.
   ```bash
   ./setup.sh --skip-verify
   ```
3. **Develop:** Implement the requested changes.
4. **Verify:** Execute the relevant verification script(s).
   - **Backend:**
     ```bash
     ./scripts/verify-ts.sh
     ```
     For backend integration tests against the emulator:
     ```bash
     ./scripts/emulator-test.sh
     ```
   - **Frontend:**
     ```bash
     ./scripts/verify-activity.sh
     ```
   - **Crucial:** You must use these scripts when the `pre_commit_instructions` tool asks you to "Run Relevant Tests".

## Self-Correction
If you notice a tool or command in this file is outdated, you **MUST** update this file immediately to reflect the current technical reality.
