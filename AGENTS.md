# AGENTS.md

Guidance for AI coding agents working in this repository. `CLAUDE.md` imports this file, so it is the single source of truth — edit here.

## Build, Lint, and Test Commands

```bash
# Install dependencies (root npm workspaces: packages/* and activity/)
npm ci

# Run the bot
npx -w packages/bot tsx src/main.ts

# Verify everything (preferred over running tools individually)
./scripts/verify-ts.sh                   # Backend: lint + typecheck + tests (flags: --lint --build --test)
./scripts/verify-activity.sh             # Frontend: typecheck + build + Storybook + Playwright (Docker)
./scripts/emulator-test.sh               # Backend integration tests against the Firestore emulator

# Individual backend steps
npm run lint                             # ESLint over packages/
npm run typecheck                        # shared + bot + functions
npm run test                             # shared + functions + bot (vitest)

# Frontend (activity/)
npm -w activity run dev                  # Dev server
npm -w activity run build                # Production build
npm -w activity run typecheck            # TypeScript check
./scripts/playwright-docker.sh                     # E2E tests (Docker, from project root)
./scripts/playwright-docker.sh --update-snapshots  # Regenerate screenshots
```

Run the relevant verify script before committing; don't submit code that fails it.

**Playwright tests MUST run in Docker** (`./scripts/playwright-docker.sh`).
Never run `npx playwright test` directly — screenshots are pixel-compared with
a 2% tolerance (`maxDiffPixelRatio: 0.02`) to absorb Chromium's sub-pixel
rendering noise across Docker runs, but will still differ significantly outside
the Docker container due to OS-level font rendering differences. The config
enforces Docker usage with a `PLAYWRIGHT_TEST` env guard.

## Related Repositories

The WoW addon (Wheelson) lives in a separate repo: https://github.com/TytaniumDev/Wheelson
It reimplements the group formation algorithm from `packages/shared/src/parallelGroupCreator.ts` in Lua — preserve behavior and structural similarity when changing it.

## Architecture Overview

This is a Discord bot for forming World of Warcraft Mythic+ groups. It has two main modes:

1. **Discord-only** (`/wheel`): Bot computes groups and posts results directly in Discord
2. **Activity mode** (`/activity`, `/wheelson`): Real-time lobby experience via Firebase, with a web frontend that computes groups client-side

See `ARCHITECTURE.md` for the deep dive.

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
│       └── core/          # Config, Firebase, UI formatting, Discord adapters
└── functions/             # Firebase Cloud Functions: affix sync, character lookup, GitHub webhook
activity/                  # React/Vite frontend (npm workspace)
└── src/
    ├── services/          # Firestore + Demo session services
    ├── store/             # Zustand state management
    ├── views/             # React view components
    ├── components/        # Reusable UI components
    ├── hooks/             # Custom React hooks
    └── lib/               # Role utilities, mock data, audio
```

### Data Flow for `/activity`

1. User runs `/activity` in a voice channel
2. Bot collects players from voice channel members and resolves their roles from the preferences collection (with Discord role fallback)
3. Bot creates Firestore documents in `guilds/{guildId}` and `channels/{channelId}` (status: `lobby`)
4. Bot listens to Firestore; frontend subscribes via `onSnapshot`
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

- `WoWPlayer.create(name, role_list)` builds from Discord role-name strings (from `packages/shared/src/config.ts`); unknown strings are dropped.
- `WoWPlayer.fromDict(dict)` builds from the Firestore wire format and validates via `toRole` / `toUtility`.

These serve different input shapes — don't unify them.

### Firebase Session States

`lobby` → `spinning` → `completed`

The frontend owns the transition to `spinning` (with client-side computed groups) and `completed`. The bot listens and announces results to Discord on `completed`.

## Conventions

- Strict TypeScript: type all arguments, return values, and interfaces; avoid `any`.
- New features and logic changes come with Vitest tests.
- Keep Discord embed/component building in dedicated UI modules (e.g. `packages/bot/src/core/roleUi.ts`, `groupUi.ts`), not in command handlers.
- Adapt discord.js objects through the adapter helpers (`adaptGuild` / `buildVoiceChannelsSnapshot` in `packages/bot/src/core/discordAdapters.ts`, `adaptMember` in `main.ts`) rather than reading raw discord.js fields.
- Error reporting:
  - Bot: `reportError(err, { tags, user, extra })` from `packages/bot/src/core/sentry.ts`.
  - Activity: `reportError(err, { tag })` from `activity/src/lib/sentry.ts`.
  - Cloud Functions: `firebase-functions/logger`, not `console.*`.
- Firestore data shared by bot and activity (group history, season pairs, etc.) is encoded/validated with the codecs in `@mythicplus/shared` — don't hand-roll the wire format on either side.
- "Today" for group history is `todayPST()` from `@mythicplus/shared` (tests too).
- Don't add a top-level `overrides` block to the root `package.json` — it previously broke the vitest install tree. Use per-workspace overrides.

## Testing Notes

- Bot tests use `vitest` and are in `packages/bot/tests/`
- Shared package tests live in `packages/shared/tests/`
- Frontend E2E tests use Playwright and are in `activity/tests/`
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

Production secrets live in Doppler. For production host access and logs, see the `pi-ops` skill.

## CI

When touching GitHub Actions workflows: read the **Secrets in Workflows** section in [docs/CI_STANDARDS.md](docs/CI_STANDARDS.md). Never log secrets, and never inline multi-line secrets (JSON, PEM) in heredocs; use base64 encode on the runner and decode on the remote. The workflow-lint job enforces this.

**CI job naming constraint:** `.github/workflows/ci-shared.yml` is a reusable workflow (`workflow_call` only) that defines the jobs `Lint`, `Build`, `Test`, and `Integration` (Firestore emulator tests). It is called by `.github/workflows/ci.yml` (trigger: `pull_request` only) via a calling job with ID `CI`. GitHub Actions names reusable workflow checks as `<calling_job_id> / <reusable_job_id>`, producing `CI / Lint`, `CI / Build`, `CI / Test` — which branch protection and `auto-approve.yml` require — plus `CI / Integration`. `deploy.yml` also calls `ci-shared.yml`. Do not rename the calling job ID in `ci.yml` or the job IDs in `ci-shared.yml`, and do not add extra triggers to `ci.yml`.

## Git Workflow

- **Never push directly to `main`.** Always work on a feature branch and open a PR for review.
- There is no code review step. Once `CI / Lint`, `CI / Build`, and `CI / Test` pass on a PR by the repo owner, `auto-approve.yml` approves it to satisfy branch protection. Green CI is the merge gate, so run the verify scripts before pushing.
- Merging to `main` deploys (`deploy.yml`, `deploy-activity.yml`).
