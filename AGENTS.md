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

## Task Execution Workflow
1. **Analyze:** Understand the task requirements and review the relevant codebase.
2. **Environment:** Ensure the environment is set up and dependencies are installed (e.g., `pip install -r requirements.txt`).
3. **Develop:** Implement the requested changes.
4. **Verify:** Execute `./scripts/verify.sh`.
   - This script runs `ruff check --fix`, `ruff format`, and `python -m unittest discover tests`.
   - **Crucial:** You must use this script when the `pre_commit_instructions` tool asks you to "Run Relevant Tests".
