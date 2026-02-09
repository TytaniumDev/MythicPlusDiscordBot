# Forge's Journal

## 2025-05-22 - [Tooling Mismatch & Missing Persona]
**Discovery:** The CI/CD pipelines (`lint.yml`, `test.yml`) were using `pip` while the local development script (`verify.sh`) and `pyproject.toml` configuration pointed to `uv` as the package manager.
**Discovery:** The Agent persona for `Architect` referenced deprecated tools (`black`, `flake8`) instead of the project standard `ruff`.
**Discovery:** The `Bolt` persona file (`.jules/personas/bolt.md`) was missing, despite a journal file existing at `.jules/bolt.md`.
**Action:** Updated CI workflows to use `astral-sh/setup-uv` for consistency. Updated `Architect` instructions to mandate `ruff`. Created `Bolt` persona with performance-focused boundaries and `uv` usage instructions.

## 2025-05-23 - [CI Parity & Script Consolidation]
**Discovery:** The CI workflows (`lint.yml`, `test.yml`) were implementing custom inline scripting that duplicated the logic in `verify.sh`, leading to potential drift.
**Discovery:** The `deploy.yml` workflow contained a massive inline here-doc script for remote deployment, making it hard to test and maintain, and violating the "No Inline Scripting" rule.
**Action:** Refactored `verify.sh` into modular `scripts/lint.sh` and `scripts/test.sh`, and updated CI to call these scripts directly, ensuring absolute parity between local and CI verification.
**Action:** Extracted the remote deployment logic into `scripts/deploy-remote.sh` and updated `deploy.yml` to execute it via SSH, improving readability and testability.
