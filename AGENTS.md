# Agent Instructions: MythicPlusDiscordBot

This file provides the necessary context and operational standards for AI agents working on this codebase.

## Project Overview
**MythicPlusDiscordBot** is a Python-based application designed to integrate World of Warcraft Mythic Plus data into Discord, with a web-based activity frontend.

## Mandatory Development Standards

### 1. Code Quality & Verification
To maintain consistency and prevent CI failures, you **MUST** run the appropriate verification script for your changes:

- **Backend (`core/`, `cogs/`):** Run `./scripts/verify.sh`.
  - Runs linting (Ruff), formatting (Ruff), type checking (Pyright), and unit tests.
- **Frontend (`activity/`):** Run `./scripts/verify-activity.sh`.
  - Runs TypeScript checks, builds the project, and executes Playwright E2E tests.
- **Verification:** Do not submit code unless the relevant script passes successfully.

### 2. Python Conventions
- Use Python type hints for all function arguments and return values.
- Follow PEP 8 guidelines for naming conventions and structure.
- Ensure all new features or logic changes are accompanied by basic unit tests.

### 3. Discord.py Implementation
- All bot commands, events, and API interactions must be implemented using `async/await` syntax.
- Maintain proper error handling for Discord API interactions to ensure bot stability.

### 4. Secrets in Workflows (GitHub Actions)
When adding or modifying `.github/workflows/*.yml`, follow these rules to prevent secret leaks:
- **Never inline multi-line secrets** in `run:` scripts or heredocs.
- **Safe pattern:** Encode on runner (base64), pass single-line via env/output, decode on remote.
- **Never echo or log** variables that may contain secrets.
- **Prefer writing secrets to files** on the runner when possible.
See `scripts/check-workflow-secrets.py` for automated checks.

### 5. Logging and Secrets
Log output may be included in public bug reports. To avoid leaking secrets:
- **Never log** `BOT_TOKEN`, `GITHUB_TOKEN`, `FIREBASE_CREDENTIALS_JSON`, or any sensitive env vars.
- **When logging exceptions from external APIs**, log only the exception type or HTTP status, not the full message/body.

## Task Execution Workflow
1. **Analyze:** Understand the task requirements and review the relevant codebase.
2. **Environment:** Ensure the environment is set up and dependencies are installed (`uv sync` for backend, `npm ci` for frontend).
3. **Develop:** Implement the requested changes.
4. **Verify:** Execute the relevant verification script(s).
   - **Backend:** `./scripts/verify.sh`
   - **Frontend:** `./scripts/verify-activity.sh`
   - **Crucial:** You must use these scripts when the `pre_commit_instructions` tool asks you to "Run Relevant Tests".
