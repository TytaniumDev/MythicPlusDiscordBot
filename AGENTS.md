# Agent Instructions: MythicPlusDiscordBot

This file provides the necessary context and operational standards for AI agents working on this codebase.

## Project Overview
**MythicPlusDiscordBot** is a Python-based application designed to integrate World of Warcraft Mythic Plus data into Discord. 

## Mandatory Development Standards

### 1. Code Quality & Linting
To maintain consistency and prevent CI failures, the following rules are mandatory for all code changes:

- **Verification Script:** You **MUST** run `./scripts/verify.sh` to handle all linting, formatting, and testing.
- **Linter:** The verification script uses **Ruff** for all linting and formatting tasks.
- **Auto-Fix Requirement:** The script runs `ruff check --fix` automatically.
- **Formatting:** The script runs `ruff format` automatically.
- **Verification:** Do not submit code unless `./scripts/verify.sh` passes successfully.

### 2. Python Conventions
- Use Python type hints for all function arguments and return values.
- Follow PEP 8 guidelines for naming conventions and structure.
- Ensure all new features or logic changes are accompanied by basic unit tests.

### 3. Discord.py Implementation
- All bot commands, events, and API interactions must be implemented using `async/await` syntax.
- Maintain proper error handling for Discord API interactions to ensure bot stability.

### 4. Secrets in Workflows (GitHub Actions)

When adding or modifying `.github/workflows/*.yml`, follow these rules to prevent secret leaks:

- **Never inline multi-line secrets** (e.g. JSON keys, PEM keys) in `run:` scripts or heredocs. Multi-line values break bash and can be echoed in error messages, leaking secrets in CI logs.
- **Safe pattern for multi-line secrets** passed to remote scripts (e.g. SSH heredocs): encode on the runner (e.g. base64), pass a single-line value via step output or env, decode on the remote.
- **Never echo or log** variables that may contain secrets: do not use `set -x` in steps that use secrets; do not `echo $SECRET_VAR`.
- **Prefer writing secrets to files** on the runner when possible (e.g. `echo "${{ secrets.PI_SSH_KEY }}" > file`), and only pass single-line or base64-encoded values into remote heredocs.

See `scripts/check-workflow-secrets.py` and the workflow-lint job for automated checks.

### 5. Logging and Secrets

Log output may be included in bug reports (e.g. "Recent Logs" in GitHub issues). To avoid leaking secrets:

- **Never log** `BOT_TOKEN`, `GITHUB_TOKEN`, `FIREBASE_CREDENTIALS_JSON`, or any env that could be secret.
- **When logging exceptions from external APIs** (GitHub, Firebase, etc.), log only the exception type or HTTP status, not the full message or response body.
- Assume all log output is effectively public when users attach logs to bug reports.

## Task Execution Workflow
1. **Analyze:** Understand the task requirements and review the relevant codebase.
2. **Environment:** Ensure the environment is set up and dependencies are installed (e.g., `pip install -r requirements.txt`).
3. **Develop:** Implement the requested changes.
4. **Verify:** Execute `./scripts/verify.sh`.
   - This script runs `ruff check --fix`, `ruff format`, and `python -m unittest discover tests`.
   - **Crucial:** You must use this script when the `pre_commit_instructions` tool asks you to "Run Relevant Tests".
