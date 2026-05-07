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
./scripts/playwright-docker.sh                     # E2E tests (Docker, from project root)
./scripts/playwright-docker.sh --update-snapshots  # Regenerate screenshots
```

**Playwright tests MUST run in Docker** (`./scripts/playwright-docker.sh`).
Never run `npx playwright test` directly — screenshots are pixel-compared with
a 2% tolerance (`maxDiffPixelRatio: 0.02`) to absorb Chromium's sub-pixel
rendering noise across Docker runs, but will still differ significantly outside
the Docker container due to OS-level font rendering differences. The config
enforces Docker usage with a `PLAYWRIGHT_TEST` env guard.

## Related Repositories

The WoW addon (MythicPlusWheel) lives in a separate repo: https://github.com/TytaniumDev/Wheelson
It reimplements the group formation algorithm from `packages/shared/src/parallelGroupCreator.ts` in Lua.

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
│       ├── commands/      # Slash commands (groups, roles, general, debug)
│       ├── services/      # GroupService, SessionService
│       └── core/          # Config, Firebase, UI formatting
├── functions/             # Firebase Cloud Functions: affix sync, character lookup, GitHub webhook
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
2. Bot collects players from voice channel members and resolves their roles from the preferences collection (with Discord role fallback)
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
- Shared package tests live in `packages/shared/tests/`
- Bot-test helpers (prebuilt WoWPlayer fixtures): `packages/bot/tests/prebuiltClasses.ts`

### Visual Snapshot Tests

**If you modify any UI code** (`activity/src/`), you MUST update visual test snapshots before committing:

```bash
./scripts/playwright-docker.sh --update-snapshots
```

Then commit the updated screenshots in `activity/tests/__screenshots__/` alongside your code changes. CI will fail if committed snapshots don't match what the Docker Playwright run produces. Never commit snapshots generated outside Docker.

## Environment Variables

Required for bot: `BOT_TOKEN`, `DISCORD_APPLICATION_ID`
Required for Firebase features: `FIREBASE_CREDENTIALS_JSON`
Optional: `DEVELOPER_ID`, `ACTIVITY_URL`, `GITHUB_TOKEN`, `GITHUB_REPO_OWNER`, `GITHUB_REPO_NAME`, `BOT_INVITE_PERMISSIONS`, `GIT_SHA`, `SENTRY_DSN` (see `packages/bot/src/core/config.ts`)

When touching GitHub Actions workflows: read the **Secrets in Workflows** section in [docs/CI_STANDARDS.md](docs/CI_STANDARDS.md). Never inline multi-line secrets (JSON, PEM) in heredocs; use base64 encode on the runner and decode on the remote. The workflow-lint job enforces this.

**CI job naming constraint:** `.github/workflows/ci-shared.yml` is a reusable workflow (`workflow_call` only) that defines three jobs: `Lint`, `Build`, `Test`. It is called by `.github/workflows/ci.yml` (trigger: `pull_request` only) via a calling job with ID `CI`. GitHub Actions names reusable workflow checks as `<calling_job_id> / <reusable_job_id>`, producing `CI / Lint`, `CI / Build`, `CI / Test` — which branch protection requires. `deploy.yml` also calls `ci-shared.yml`. Do not rename the calling job ID in `ci.yml` or the job IDs in `ci-shared.yml`, and do not add extra triggers to `ci.yml`.

## Production Host (Raspberry Pi)

The bot runs on a Raspberry Pi. Connection details are stored in Doppler:

- **PI_HOST** – `100.92.156.29` (Tailscale IP)
- **PI_USER** – `deploy`
- **PI_APP_DIR** – `/home/deploy/mythic-plus-bot`
- **PI_SSH_KEY** – SSH private key (in Doppler)

```bash
# SSH into the Pi (requires PI_SSH_KEY written to a temp file or ssh-agent)
ssh deploy@100.92.156.29

# Check bot logs on the Pi (runs in Docker)
docker logs mythic-plus-bot --since 30m

# App directory
cd /home/deploy/mythic-plus-bot
```

## Git Workflow

- **Never push directly to `main`.** Always create a feature branch and open a PR for code review.
- When asked to ship/deploy/push changes, use the `/ship-it` skill to create a PR — do not push to `main` directly.
- Branch protection rules require PRs and status checks before merging to `main`.
