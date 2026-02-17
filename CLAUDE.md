# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build, Lint, and Test Commands

```bash
# Install dependencies
uv sync                                 # Install all deps (runtime + dev)

# Run the bot
uv run python bot.py

# Verify everything (preferred over running tools individually)
./scripts/verify.sh                     # Backend: lint + format + typecheck + tests
./scripts/verify-activity.sh            # Frontend: typecheck + build + Playwright tests

# Linting & formatting (auto-fixes on save via pre-commit hook)
uv run ruff check . --fix               # Lint
uv run ruff format .                    # Format
uv run pyright                          # Type checking (strict mode)

# Run all tests
uv run python -m unittest discover tests

# Run a single test file
uv run python -m unittest tests/test_group_creator.py

# Run a single test case
uv run python -m unittest tests.test_group_creator.TestGroupCreator.test_basic_group_creation

# Frontend (activity/)
cd activity && npm ci                   # Install frontend deps
npm run dev                             # Dev server
npm run build                           # Production build
npm run typecheck                       # TypeScript check
npx playwright test                     # E2E tests

# Pre-commit hooks (run once after clone)
pre-commit install
```

## Architecture Overview

This is a Discord bot for forming World of Warcraft Mythic+ groups. It has two main modes:

1. **Discord-only** (`/wheel`): Bot computes groups and posts results directly in Discord
2. **Activity mode** (`/activity`, `/wheelson`): Real-time lobby experience via Firebase, with an optional web frontend

### Key Components

```
bot.py                    # Entry point, MythicPlusBot class, error handling, startup cleanup
├── cogs/
│   ├── groups.py         # Main commands: /wheel, /activity, /wheelson, /badgroup
│   │                     # Also handles on_voice_state_update for lobby sync
│   ├── roles.py          # Role management commands
│   ├── general.py        # General utility commands
│   └── debug.py          # Debug/admin commands
├── services/
│   ├── group_service.py  # Gets players from voice channels, calls group algorithm
│   └── session_service.py # Firebase session lifecycle, spin handling, Discord announcements
├── core/
│   ├── parallel_group_creator.py  # Group formation algorithm (Tank/Healer/DPS balancing)
│   ├── firebase_service.py        # Firestore CRUD, singleton pattern
│   ├── models.py                  # WoWPlayer (frozen dataclass), WoWGroup
│   ├── config.py                  # All env vars and role constants
│   ├── group_ui.py                # Group display/embed formatting
│   ├── role_ui.py                 # Role management UI components
│   ├── issues.py                  # GitHub issue modals (bug reports, bad group reports)
│   ├── storage.py                 # Persistent player role preferences (JSON, thread-safe)
│   └── utils.py                   # Player list building, typing indicators, name masking
└── activity/             # TypeScript/Vite frontend (separate from bot)
```

### Data Flow for `/activity`

1. User runs `/activity` in a voice channel
2. `GroupService` collects players from channel via Discord roles
3. `SessionService` creates Firestore document (status: `lobby`)
4. Bot listens to Firestore doc; frontend subscribes via `onSnapshot`
5. Voice state changes → bot updates `players` in Firestore → frontend rerenders
6. User clicks "Spin" → frontend sets status: `request_spin`
7. Bot detects change, runs `create_mythic_plus_groups()`, writes `groups` + status: `spinning`
8. Frontend animates, then sets status: `completed`
9. Bot posts embed to Discord channel

### Domain Model

`WoWPlayer` is a frozen dataclass with boolean flags for roles:
- Main roles: `tankMain`, `healerMain`, `dpsMain`
- Offspecs: `offtank`, `offhealer`, `offdps`
- DPS types: `ranged`, `melee`
- Utilities: `hasBrez`, `hasLust`

Create players via `WoWPlayer.create(name, role_list)` where roles match strings from `core/config.py`.

### Firebase Session States

`lobby` → `request_spin` → `spinning` → `completed`

The bot owns transitions to `spinning` (with computed groups). The frontend owns `request_spin` and `completed`.

## Testing Notes

- Tests use `unittest` and are in `tests/`
- `tests/prebuilt_classes.py` has helper player classes (e.g., `TankPaladin`, `Mage`) for test fixtures
- Call `clear()` from `parallel_group_creator` in test `setUp()` to reset state between tests
- Mock Discord interactions using standard `unittest.mock` patterns

## Environment Variables

Required for bot: `BOT_TOKEN`, `DISCORD_APPLICATION_ID`
Required for Firebase features: `FIREBASE_CREDENTIALS_JSON`
Optional: `DEVELOPER_ID`, `ACTIVITY_URL`, role name overrides (see `core/config.py`)

When touching GitHub Actions workflows: read the **Secrets in workflows** section in [AGENTS.md](AGENTS.md). Never inline multi-line secrets (JSON, PEM) in heredocs; use base64 encode on the runner and decode on the remote. The workflow-lint job enforces this.

## Code Style

- Ruff enforces formatting and linting (see `pyproject.toml` for rules)
- Pyright in strict mode; some discord.py stubs are incomplete so certain checks are disabled
- Pre-commit hook runs `ruff check --fix` and `ruff format` automatically
