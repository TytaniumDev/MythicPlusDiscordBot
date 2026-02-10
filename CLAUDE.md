# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build, Lint, and Test Commands

```bash
# Install dependencies
pip install -r requirements.txt         # Runtime deps
pip install -r requirements-dev.txt     # Dev deps (includes ruff, pyright, pre-commit)

# Run the bot
python bot.py

# Linting & formatting (auto-fixes on save via pre-commit hook)
ruff check . --fix                      # Lint
ruff format .                           # Format
pyright                                 # Type checking (strict mode)

# Run all tests
python -m unittest discover tests

# Run a single test file
python -m unittest tests/test_group_creator.py

# Run a single test case
python -m unittest tests.test_group_creator.TestGroupCreator.test_basic_group_creation

# Pre-commit hooks (run once after clone)
pre-commit install
```

## Architecture Overview

This is a Discord bot for forming World of Warcraft Mythic+ groups. It has two main modes:

1. **Discord-only** (`/wheel`, `/newwheel`): Bot computes groups and posts results directly in Discord
2. **Activity mode** (`/activity`): Real-time lobby experience via Firebase, with an optional web frontend

### Key Components

```
bot.py                    # Entry point, MythicPlusBot class, error handling, startup cleanup
├── cogs/
│   ├── groups.py         # Main commands: /wheel, /newwheel, /activity, /badgroup
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
│   └── config.py                  # All env vars and role constants
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

### Activity frontend (visual tests)

Playwright visual baselines live under `activity/tests/visual-baselines/`. When you change activity UI in ways that affect visuals (layout, styles, copy), run `cd activity && npx playwright test --update-snapshots` and commit the updated baseline images so CI passes.

## Environment Variables

Required for bot: `BOT_TOKEN`, `DISCORD_APPLICATION_ID`
Required for Firebase features: `FIREBASE_CREDENTIALS_JSON`
Optional: `DEVELOPER_ID`, `ACTIVITY_URL`, role name overrides (see `core/config.py`)

When touching GitHub Actions workflows: read the **Secrets in workflows** section in [AGENTS.md](AGENTS.md). Never inline multi-line secrets (JSON, PEM) in heredocs; use base64 encode on the runner and decode on the remote. The workflow-lint job enforces this.

## Code Style

- Ruff enforces formatting and linting (see `pyproject.toml` for rules)
- Pyright in strict mode; some discord.py stubs are incomplete so certain checks are disabled
- Pre-commit hook runs `ruff check --fix` and `ruff format` automatically
