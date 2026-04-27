# Codebase map

The agent's evolving understanding of this codebase's architecture. Updated by the historian after each /overnight run.

## High-level

Monorepo with three TypeScript workspaces:

- **`packages/bot/`** — Discord bot. Entry: `src/main.ts` (currently a 1296-line god-file mixing client init, command routing, modal building, button handling, Firestore listener orchestration, and adapter helpers). Commands live in `src/commands/`, services in `src/services/`, shared infra in `src/core/`.
- **`packages/shared/`** — Platform-agnostic. Owns the group-creation algorithm (`parallelGroupCreator.ts`) and the `WoWPlayer` / `WoWGroup` models. **The Lua sibling in [MythicPlusWheel](https://github.com/TytaniumDev/Wheelson) reimplements the same algorithm — preserve behavior + structural similarity when changing it.**
- **`packages/functions/`** — Firebase Cloud Functions v2 (Battle.net character lookups, weekly affix sync, GitHub webhook). Re-exports affix metadata from `@mythicplus/shared`.
- **`activity/`** — Vite 7 + React 19 frontend for the Discord Activity. State in Zustand (`src/store/store.ts`), services in `src/services/`, views in `src/views/`, components in `src/components/`. Backed by the Firebase JS SDK.

## Two operational modes

- **Discord-only** (`/wheel`): Bot computes groups and posts results directly in Discord. No frontend involved.
- **Activity** (`/activity`, `/wheelson`): Real-time lobby in Firestore.
  - Bot creates `guilds/{guildId}` and `channels/{channelId}` docs (status `lobby`).
  - Frontend subscribes via `onSnapshot` and renders the lobby.
  - User clicks Spin → **frontend** runs `createMythicPlusGroups` client-side and writes `groups` + `status: spinning` directly. The bot does **not** compute groups in Activity mode.
  - Frontend animates wheel reveal, writes `status: completed`.
  - Bot listens for `completed` and posts the result embed in Discord.

## Shared error reporting pattern

Both surfaces now route errors through a `reportError(err, context)` helper:
- Activity: `activity/src/lib/sentry.ts::reportError(err, { tag })`.
- Bot: `packages/bot/src/core/sentry.ts::reportError(err, { tags, user, extra })`.

These wrap Sentry capture + structured logging. New code should use them rather than calling `Sentry.captureException` directly or `.catch(console.error)`.

## Date helpers

`todayPST()` from `@mythicplus/shared/dateHelpers` is the canonical "today" key for daily group history. Used by both `groupService.ts` and `firestoreService.ts`. Pinned to PST/PDT — group history rolls over at midnight Pacific, not UTC.

## Spin-eligibility

`activity/src/lib/spinEligibility.ts::eligibleSpinPlayers(players, sittingOut)` is the canonical filter shared between `firestoreService.requestSpin` and `demoService.requestSpin`. Demo and prod cannot diverge on what "eligible" means.

## Firestore wire format gotcha

Group history rounds are stored as `{ groups: [...] }`-wrapped per round (Firestore rejects nested arrays). The canonical codec lives in `packages/shared/src/groupHistoryWire.ts` (`encodeGroupHistoryRounds` / `decodeGroupHistoryRounds`); both `packages/bot/src/core/firebaseService.ts` and `activity/src/services/firestoreService.ts` import it so the two packages can't drift on legacy-shape tolerance. `GuildData.groupHistory.rounds` is typed as `unknown[]` to make this contract honest.

## Firestore input validation

`packages/shared/src/types.ts` exposes `toRole(raw)` / `toUtility(raw)` validators alongside the existing `toCharacterClass`. `WoWPlayer.fromDict` uses them to defensively coerce Firestore data — Firestore is an external boundary, not typed-code-internal, so blind casts are forbidden there. The `/affixes` handler in `packages/bot/src/main.ts` similarly validates Firestore-derived data through `parseAffixDisplays` before rendering.

## main.ts adapter helpers

`packages/bot/src/main.ts` has a `getReporterName(interaction)` helper near `adaptMember` (used in 6 sites previously hand-rolled). Discord member iteration in this file uses `adaptMember(m).bot`, never raw `m.user.bot`. Fixture data lives in `packages/bot/src/core/debugFixtures.ts` (`getDebugPlayers`) — `core/utils.ts` is for runtime helpers only, not fixtures.

## Tests

- Backend (`packages/bot/tests/`): vitest unit tests + Firestore-emulator integration tests in `tests/integration/`. Run via `./scripts/verify-ts.sh`.
- Frontend (`activity/tests/`): Playwright. **MUST run in Docker** (`./scripts/playwright-docker.sh`) — snapshots are pixel-compared with 2% tolerance and Chromium font rendering differs by OS.

## CI

`.github/workflows/ci-shared.yml` defines reusable `Lint`, `Build`, `Test`, `Integration` jobs. `ci.yml` calls them via a `CI` job ID — branch protection requires `CI / Lint`, `CI / Build`, `CI / Test`. Don't rename those job IDs.

## Production

Bot runs on a Raspberry Pi at `100.92.156.29` (Tailscale) as a Docker container. Image from `ghcr.io/tytaniumdev/mythicplusdiscordbot:<sha>`. Secrets in Doppler.

## Persistent state for /overnight runs

- `agent-memory/` — checked in. README, codebase-map, style-decisions, avoid-list, open-backlog, summaries/.
- `/tmp/overnight-<RUN_ID>/` — runtime working dir (deadline, pr_count, backlog, proposals.json). Wiped at end of each run.
