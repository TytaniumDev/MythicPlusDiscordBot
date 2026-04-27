# Open backlog

Known issues found by past runs but not yet addressed. Pre-seeded into each new run as critic findings.

## High-impact, deferred from 2026-04-27 run

- **Re-attempt CVE patches** for `protobufjs` (RCE, GHSA-xq3m-2v4x-88gg), `flatted` (prototype pollution, GHSA-rf6f-7fwh-wjgh), `picomatch` (ReDoS, GHSA-c2c7-rcm5-vvqj). The top-level `overrides` approach broke vitest — try per-workspace overrides or wait for upstream firebase-admin/firebase-functions bumps.
- **Refactor `packages/bot/src/main.ts`** (1296-line god-file). Extract: 4 interaction handlers, Firebase listener block (move to `events/ready.ts`), adapter helpers (`adaptMember`, `adaptVoiceChannel`, `createBotAdapter`). Targeted hand-driven work; too risky overnight.
- **Decouple `firestoreService.ts` from the Zustand store.** Service methods directly call `useAppStore.getState()`; tests can't run the service in isolation. Needs human design eyes — store callers must absorb the data flow.

## Medium-impact, ready to ship next run

- **Theme 9 — extract shared `groupHistory` module.** Wire-round encode/decode is duplicated between `packages/bot/src/core/firebaseService.ts` and `activity/src/services/firestoreService.ts` (`parseExistingRounds`). Touches data persistence so worth careful review.
- **Theme 13 — `LobbyView` filter memoization.** 7 unmemoized `.filter()` passes over `activePlayers` on every render. Wrap in `useMemo` keyed on `[players, sittingOut]`. No DOM change so snapshots should be stable, but verify in Docker.
- **Theme 15 — `PreferenceService` cache consolidation.** Five parallel `Map`s keyed by `discordId`. Replace with one `Map<string, PlayerCacheEntry>` and helper methods. Medium blast radius — touches caching invariants.
- **Theme 16 — `catch (e) → catch (err)` rename.** Bot uses `e`, frontend uses `err`. Need a real codemod (ts-morph / eslint-plugin-rename-vars) — sed isn't safe because of bare `e` references inside catch bodies.
- **Theme 22 — a11y bundle.** `PlayerChip` div→button, `HeaderBar` logo as button, `SpotlightPortrait` aria-label, `WheelsView` aria-live region for spin status. Each requires regenerating Playwright snapshots via Docker.
- **Theme 23 — `EditPlayerModal` focus trap.** Add aria-modal=true, focus-management on open/close. Snapshot regen needed.

## Low-impact polish

- **Theme 12 (partial) — `WoWPlayer` offspec getter caching.** Cache booleans in constructor instead of `Array.includes` on every access. Skipped this run because of constructor signature risk.
- **`createMythicPlusGroups._debug` parameter is a no-op** kept for Lua-sibling parity. Consider removing entirely if the Lua side doesn't actually use it.
- **`consistency-wow-player-construction`:** bot still calls `WoWPlayer.create(name, roleList)` to deserialize Firestore docs in some paths where `fromDict` is more honest about the wire format.
