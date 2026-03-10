# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build, Lint, and Test Commands

```bash
# Install dependencies
npm ci                                   # Install all deps

# Run the bot
npx -w packages/bot tsx src/main.ts

# Verify everything (preferred over running tools individually)
./scripts/verify-ts.sh                   # Backend: lint + typecheck + tests
./scripts/verify-activity.sh             # Frontend: typecheck + build + Playwright tests

# Linting
npx eslint packages/

# Type checking
npm -w packages/shared run typecheck     # Shared package
npm -w packages/bot run typecheck        # Bot package

# Run all tests
npm -w packages/bot run test

# Frontend (activity/)
cd activity && npm ci                   # Install frontend deps
npm run dev                             # Dev server
npm run build                           # Production build
npm run typecheck                       # TypeScript check
npx playwright test                     # E2E tests
```

## Architecture Overview

This is a Discord bot for forming World of Warcraft Mythic+ groups. It has two main modes:

1. **Discord-only** (`/wheel`): Bot computes groups and posts results directly in Discord
2. **Activity mode** (`/activity`, `/wheelson`): Real-time lobby experience via Firebase, with a web frontend that computes groups client-side

### Key Components

```
packages/
├── shared/               # Platform-agnostic shared code
│   └── src/
│       ├── models.ts      # WoWPlayer, WoWGroup classes
│       ├── types.ts       # Role, Utility, SessionStatus types
│       ├── config.ts      # Role string constants
│       └── parallelGroupCreator.ts  # Group formation algorithm
├── bot/                   # Discord bot (TypeScript)
│   └── src/
│       ├── main.ts        # Entry point (Discord.js client + command routing)
│       ├── bot.ts         # Error handling class
│       ├── commands/      # Slash commands (groups, roles, general, debug)
│       ├── services/      # GroupService, SessionService
│       └── core/          # Config, Firebase, UI formatting
└── activity/              # TypeScript/Vite frontend (separate workspace)
    └── src/
        ├── services/      # Firestore + Demo session services
        ├── store/         # Zustand state management
        ├── views/         # React view components
        ├── components/    # Reusable UI components
        ├── hooks/         # Custom React hooks
        └── lib/           # Role utilities, mock data, audio
```

### Data Flow for `/activity`

1. User runs `/activity` in a voice channel
2. Bot collects players from channel via Discord roles
3. Bot creates Firestore document (status: `lobby`)
4. Bot listens to Firestore doc; frontend subscribes via `onSnapshot`
5. Voice state changes → bot updates `players` in Firestore → frontend rerenders
6. User clicks "Spin" → frontend runs `createMythicPlusGroups()` client-side
7. Frontend writes `groups` + status: `spinning` to Firestore
8. Frontend animates the wheel reveal sequence
9. Frontend sets status: `completed` → bot posts embed to Discord channel

### Domain Model

`WoWPlayer` uses a compact enum-based data model:
- `mainRole`: one of `'tank' | 'healer' | 'ranged' | 'melee'` (or `null`)
- `offspecs`: array of `Role` values
- `utilities`: array of `'brez' | 'lust'`

The class exposes computed boolean getters (`tankMain`, `healerMain`, `hasBrez`, etc.) so the group algorithm works without modification.

Create players via `WoWPlayer.create(name, role_list)` where roles match strings from `packages/shared/src/config.ts`.

### Firebase Session States

`lobby` → `spinning` → `completed`

The frontend owns the transition to `spinning` (with client-side computed groups) and `completed`. The bot listens and announces results to Discord on `completed`.

## Testing Notes

- Bot tests use `vitest` and are in `packages/bot/tests/`
- Frontend E2E tests use Playwright and are in `activity/tests/`
- Shared package test helpers: `packages/bot/tests/prebuiltClasses.ts`

## Environment Variables

Required for bot: `BOT_TOKEN`, `DISCORD_APPLICATION_ID`
Required for Firebase features: `FIREBASE_CREDENTIALS_JSON`
Optional: `DEVELOPER_ID`, `ACTIVITY_URL`, role name overrides (see `packages/bot/src/core/config.ts`)

When touching GitHub Actions workflows: read the **Secrets in workflows** section in [AGENTS.md](AGENTS.md). Never inline multi-line secrets (JSON, PEM) in heredocs; use base64 encode on the runner and decode on the remote. The workflow-lint job enforces this.

**CI job naming constraint:** Our CI is split into two workflows to meet branch protection requirements. The `.github/workflows/ci-shared.yml` file is a reusable workflow that defines three jobs: `Lint`, `Build`, and `Test`. This is called by `.github/workflows/ci.yml` (named `CI`), which is triggered on pull requests. This structure creates the required check names: `CI / Lint`, `CI / Build`, and `CI / Test`. To prevent breaking PR merges, do not add extra triggers to `ci.yml` or rename the job IDs in `ci-shared.yml`.

## Git Workflow

- **Never push directly to `main`.** Always create a feature branch and open a PR for code review.
- When asked to ship/deploy/push changes, use the `/ship-it` skill to create a PR — do not push to `main` directly.
- Branch protection rules require PRs and status checks before merging to `main`.
