# Agent Instructions: MythicPlusDiscordBot

This file provides the necessary context and operational standards for AI agents working on this codebase.

## Project Overview
**MythicPlusDiscordBot** is a Python-based application designed to integrate World of Warcraft Mythic Plus data into Discord, with a web-based activity frontend.

## Mandatory Development Standards

### 1. Code Quality & Verification
To maintain consistency and prevent CI failures, you **MUST** run the appropriate verification script for your changes:

- **Backend (`core/`, `cogs/`):** Run the verification script:
  ```bash
  ./scripts/verify.sh
  ```
  Runs `ruff check --fix` (Lint), `ruff format` (Format), `pyright` (Type Check), and `unittest` (Tests).
- **Frontend (`activity/`):** Run the verification script:
  ```bash
  ./scripts/verify-activity.sh
  ```
  Runs `npm run typecheck` (TypeScript), `npm run build` (Build), and `npx playwright test` (E2E Tests).
- **Verification:** Do not submit code unless the relevant script passes successfully.

### 2. Python Conventions
- Use Python type hints for all function arguments and return values.
- Follow PEP 8 guidelines for naming conventions and structure.
- Ensure all new features or logic changes are accompanied by basic unit tests.

### 3. Discord.py Implementation
- All bot commands, events, and API interactions must be implemented using `async/await` syntax.
- Maintain proper error handling for Discord API interactions to ensure bot stability.

### 4. CI/CD & Security Standards
Detailed guidelines for writing GitHub Actions workflows and handling secrets are available in:
- [**docs/CI_STANDARDS.md**](docs/CI_STANDARDS.md)

**Key Rule:** Never log secrets or inline multi-line secrets in workflows.

## Task Execution Workflow
1. **Analyze:** Understand the task requirements and review the relevant codebase.
2. **Environment:** Ensure the environment is set up and dependencies are installed.
   - **Backend:**
     ```bash
     uv sync
     ```
   - **Frontend:**
     ```bash
     cd activity && npm ci
     ```
3. **Develop:** Implement the requested changes.
4. **Verify:** Execute the relevant verification script(s).
   - **Backend:**
     ```bash
     ./scripts/verify.sh
     ```
   - **Frontend:**
     ```bash
     ./scripts/verify-activity.sh
     ```
   - **Crucial:** You must use these scripts when the `pre_commit_instructions` tool asks you to "Run Relevant Tests".

## Self-Correction
If you notice a tool or command in this file is outdated (e.g., `uv` replaced `pip`), you **MUST** update this file immediately to reflect the current technical reality.
