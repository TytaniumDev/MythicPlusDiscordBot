# Forge's Journal

## 2025-05-22 - [Tooling Mismatch & Missing Persona]
**Discovery:** The CI/CD pipelines (`lint.yml`, `test.yml`) were using `pip` while the local development script (`verify.sh`) and `pyproject.toml` configuration pointed to `uv` as the package manager.
**Discovery:** The Agent persona for `Architect` referenced deprecated tools (`black`, `flake8`) instead of the project standard `ruff`.
**Discovery:** The `Bolt` persona file (`.jules/personas/bolt.md`) was missing, despite a journal file existing at `.jules/bolt.md`.
**Action:** Updated CI workflows to use `astral-sh/setup-uv` for consistency. Updated `Architect` instructions to mandate `ruff`. Created `Bolt` persona with performance-focused boundaries and `uv` usage instructions.

## 2025-05-23 - [Workflow Consolidation & Parity]
**Discovery:** Local verification (`verify.sh`) was applying fixes while CI (`lint.yml`) was just checking, leading to potential parity issues where code might pass locally (because it was fixed) but fail in CI if not committed. CI workflows also duplicated logic.
**Action:** Updated `scripts/verify.sh` to support `CI=true` (check-only mode). Consolidated `lint.yml` and `test.yml` into a single `verify-backend.yml` that calls the script directly, enforcing strict execution parity.
**Action:** Removed deprecated `pytest` dependency to align with `unittest` standard.

## 2025-05-24 - [Claude Action Stability]
**Discovery:** The `claude-code-action@v1` triggers an internal SDK error (`depsCount` related to schema validation) when `settings` or `claude_args` are used to configure permissions or tool usage.
**Action:** Removed the `settings` block from `.github/workflows/claude-code-review.yml` to rely on the default configuration, ensuring workflow stability.
