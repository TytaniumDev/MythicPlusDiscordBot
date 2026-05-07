# Codebase map

The agent's evolving understanding of this codebase's architecture. Updated by the historian after each /overnight run.

## High-level

Monorepo with three TypeScript workspaces:

- **`packages/bot/`** — Discord bot. Entry: `src/main.ts` (currently a ~1220-line god-file mixing client init, command routing, modal building, button handling, Firestore listener orchestration, and adapter helpers — shrunk by ~75 LoC in #537 via the discordAdapters extraction). Commands live in `src/commands/`, services in `src/services/`, shared infra in `src/core/`.
- **`packages/shared/`** — Platform-agnostic. Owns the group-creation algorithm (`parallelGroupCreator.ts`) and the `WoWPlayer` / `WoWGroup` models. **The Lua sibling in [MythicPlusWheel](https://github.com/TytaniumDev/Wheelson) reimplements the same algorithm — preserve behavior + structural similarity when changing it.**
- **`packages/functions/`** — Firebase Cloud Functions v2 (Battle.net character lookups, weekly affix sync, GitHub webhook). Imports affix metadata from `@mythicplus/shared` directly (the local `affixMetadata.ts` re-export was deleted in #538).
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

## Discord.js → handler boundary

`packages/bot/src/core/discordAdapters.ts` is the canonical Discord.js → handler shape boundary (added in #537). It exports:

- `adaptGuild(guild)` — builds the `Guild` shape consumed by handlers (id, members, voiceChannels, etc.).
- `buildVoiceChannelsSnapshot(guild)` — single-source construction of the voice-channels snapshot used by both `main.ts` (Firestore listener block) and `services/sessionService.ts`.

Both `main.ts` and `sessionService.ts` consume these helpers; do not hand-roll the snapshot or guild adaptation in either file.

The legacy `packages/bot/src/events/voiceStateUpdate.ts` was deleted in #538 as dead code; the live voiceStateUpdate handler is inlined in `main.ts` and was never wired through the events module.

## Realm slug + region helpers

`packages/shared/src/realmSlug.ts` (added in #529) exposes:

- `realmToSlug(realm)` — normalize realm names to lowercase hyphenated slugs (handles apostrophes/umlauts).
- `parseInGameName(raw)` — split `"Charname-Realm"` into `{ name, realm }`.
- `DEFAULT_REGION = 'us'` — the canonical default region constant.

Consumed by `activity/src/components/RoleEditor.tsx`, `activity/src/hooks/useDungeonSuggestions.ts`, `activity/src/lib/currentCharacter.ts`, and `packages/functions/src/refreshCharacterMedia.ts`. Do not redefine.

## Activity dungeon-score types

`activity/src/lib/dungeonScoreTypes.ts` (added in #539) is now the canonical home for `CharacterDungeonScores` + `DungeonRunSummary`. `activity/src/services/raiderioMythicPlus.ts` re-exports them for back-compat. The `lib/` layer must NOT import types from `services/`; the previous direction was inverted to enforce a clean dependency arrow.

## PreferenceService cache hydration

`packages/bot/src/core/preferenceService.ts` (#530) exposes a private `_hydrateCacheFromPrefData(discordId, data, deleteEmpty)` helper as the canonical cache-hydration path. All cache reads — `getPreferences`, `getCharacter`, `listenToPreferences` — funnel through it; do not hand-roll Map population in new methods.

## Firestore wire validators

`packages/shared/src/seasonPairs.ts` exposes `parseSeasonPairs(raw)` (added in #540) — the shared validator for the `seasonPairs` wire field. `packages/bot/src/core/firebaseService.ts` and `activity/src/services/firestoreService.ts` both consume it; do not duplicate validation logic.

The activity `GuildData.seasonPairs?` field is typed via the shared `SeasonPairs` interface (re-exported from `@mythicplus/shared`); see #525.

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
