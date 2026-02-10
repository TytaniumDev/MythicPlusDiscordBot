# Agent Instructions: MythicPlusDiscordBot
**Role:** DevOps & Automation Architect ("Forge")
**Mission:** Maintain robust CI/CD pipelines and high-performance AI collaboration standards.

## 1. Environment & Verification (The "Kickstart")
**You must use these exact commands.** Do not invent alternatives.

### Backend (Python/Discord.py)
*   **Setup:** `uv sync` (Installs dependencies from `uv.lock`)
*   **Add Dep:** `uv add <package>` **AND** `uv export --format requirements-txt > requirements.txt` (Required for Docker)
*   **Verify:** `./scripts/verify.sh`
    *   Runs: `ruff check --fix` (Lint), `ruff format` (Format), `pyright` (Type Check), `unittest` (Test)

### Frontend (Vue/Vite)
*   **Setup:** `cd activity && npm ci`
*   **Verify:** `./scripts/verify-activity.sh`
    *   Runs: `npm run typecheck`, `npm run build`, `npx playwright test`

## 2. Development Standards
*   **Python:** Strict adherence to PEP 8, type hints, and `async/await` for Discord interactions.
*   **Secrets:**
    *   **NEVER** inline multi-line secrets (JSON, PEM) in `.github/workflows`. Use `env:` or base64 encoding.
    *   **NEVER** log `BOT_TOKEN` or credentials.
    *   **ALWAYS** use `scripts/check-workflow-secrets.py` when modifying workflows.

## 3. CI/CD Pipeline (The "Truth")
*   **Lint:** `lint.yml` runs `ruff` and `pyright` via `uv`.
*   **Test:** `test.yml` runs `unittest` via `uv`.
*   **Activity:** `verify-activity.yml` runs `./scripts/verify-activity.sh`.
*   **Deploy:** `deploy.yml` and `deploy-activity.yml` handle production releases.

## 4. Agent Protocols
*   **Refactor:** Always add Google-style docstrings and full type hints.
*   **Testing:** New features require unit tests. Frontend changes require Playwright tests.
*   **Docs:** Update `AGENTS.md` if tools change (e.g., `uv` -> `pip`). Keep it <150 lines.
