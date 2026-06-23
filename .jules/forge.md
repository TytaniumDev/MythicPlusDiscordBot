# Forge's Journal

## 2025-05-22 - [Tooling Mismatch & Missing Persona]
**Discovery:** The CI/CD pipelines (`lint.yml`, `test.yml`) were using `pip` while the local development script (`verify.sh`) and `pyproject.toml` configuration pointed to `uv` as the package manager.
**Discovery:** The Agent persona for `Architect` referenced deprecated tools (`black`, `flake8`) instead of the project standard `ruff`.
**Discovery:** The `Bolt` persona file (`.jules/personas/bolt.md`) was missing, despite a journal file existing at `.jules/bolt.md`.
**Action:** Updated CI workflows to use `astral-sh/setup-uv` for consistency. Updated `Architect` instructions to mandate `ruff`. Created `Bolt` persona with performance-focused boundaries and `uv` usage instructions.

## 2026-03-03 - [CI/AGENTS.md Calibration]
**Discovery:** The `setup.sh` script referenced deprecated `pip` install instructions instead of `uv`, causing an environment parity mismatch. Additionally, `AGENTS.md` environment setup and verification instructions were inline, not meeting the "copy-paste ready" standard.
**Action:** Updated `setup.sh` to use `uv sync` and `uv run` for executing python tests. Refactored `AGENTS.md` instructions into executable bash code blocks to ensure agent operational context matches current standards.

## 2026-03-10 - [TypeScript Migration & Tooling Synchronization]
**Discovery:** After migrating from Python to a TypeScript monorepo, `AGENTS.md`, `setup.sh`, and `.github/workflows/ci-shared.yml` retained deprecated `uv`, `ruff`, and python unittest references. `scripts/verify-ts.sh` also lacked linting execution.
**Action:** Overhauled `AGENTS.md` to reference precise `npm ci` and `./scripts/verify-ts.sh` commands. Refactored `ci-shared.yml` into a unified Verify job that identically runs `scripts/verify-ts.sh`, effectively syncing pipeline execution with the agent instructions. Modified `setup.sh` to use `npm ci` logic.

## 2026-06-23 - [Setup Script Centralization & CI Parity]
**Discovery:** CI pipelines and `AGENTS.md` were executing `npm ci` independently, diverging from the `setup.sh` kickstart script which installs critical system dependencies (`ffmpeg`, `libnacl-dev`). This discrepancy caused environment parity issues between local environments, AI agents, and CI runners.
**Action:** Updated `setup.sh` to accept a `--skip-verify` flag to avoid redundant verification checks. Replaced all instances of `npm ci` in GitHub Actions workflows (`ci-shared.yml`, `verify-activity.yml`, `deploy.yml`, `deploy-activity.yml`) and `AGENTS.md` with `./setup.sh` (or `./setup.sh --skip-verify`) to enforce `setup.sh` as the single source of truth for initialization.
