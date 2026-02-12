# Forge's Journal

## 2025-05-22 - [Tooling Mismatch & Missing Persona]
**Discovery:** The CI/CD pipelines (`lint.yml`, `test.yml`) were using `pip` while the local development script (`verify.sh`) and `pyproject.toml` configuration pointed to `uv` as the package manager.
**Discovery:** The Agent persona for `Architect` referenced deprecated tools (`black`, `flake8`) instead of the project standard `ruff`.
**Discovery:** The `Bolt` persona file (`.jules/personas/bolt.md`) was missing, despite a journal file existing at `.jules/bolt.md`.
**Action:** Updated CI workflows to use `astral-sh/setup-uv` for consistency. Updated `Architect` instructions to mandate `ruff`. Created `Bolt` persona with performance-focused boundaries and `uv` usage instructions.

## 2025-05-23 - [CI/CD Parity & Workflow Consolidation]
**Discovery:** Backend CI workflows (`lint.yml`, `test.yml`) had inline logic duplicating `scripts/verify.sh`. Frontend CI (`verify-activity.yml`) correctly reused `scripts/verify-activity.sh`.
**Action:** Refactored `scripts/verify.sh` to support `CI=true` mode (check vs fix). Created reusable `verify-backend.yml` to replace `lint.yml` and `test.yml`. Updated `deploy.yml` and `deploy-activity.yml` to use reusable verification workflows, enforcing strict parity between local and CI execution. Removed deprecated "Visual Tests" (`main.yml`) and `pytest` dependency.
