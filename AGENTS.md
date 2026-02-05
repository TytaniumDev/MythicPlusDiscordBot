# Agent Instructions: MythicPlusDiscordBot

This file provides the necessary context and operational standards for AI agents working on this codebase.

## Project Overview
**MythicPlusDiscordBot** is a Python-based application designed to integrate World of Warcraft Mythic Plus data into Discord. 

## Mandatory Development Standards

### 1. Code Quality & Linting
To maintain consistency and prevent CI failures, the following rules are mandatory for all code changes:

- **Linter:** Use **Ruff** for all linting and formatting tasks.
- **Auto-Fix Requirement:** You **must** run `ruff check --fix` on every modified file before finalizing a task or opening a pull request.
- **Formatting:** Run `ruff format` to ensure the code adheres to the project's stylistic standards.
- **Verification:** Do not submit code that contains linting errors which can be resolved automatically. If an error cannot be fixed automatically, provide a comment explaining the issue in the PR description.

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
4. **Lint:** Execute `ruff check --fix` and `ruff format`.
5. **Test:** Run the project's test suite to verify the changes do not introduce regressions.
