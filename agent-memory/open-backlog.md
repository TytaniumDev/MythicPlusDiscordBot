# Open backlog

Known issues found by past runs but not yet addressed. Pre-seeded into each new run as critic findings.

## High-impact, deferred from prior runs

- **Re-attempt CVE patches** for `protobufjs` (RCE, GHSA-xq3m-2v4x-88gg), `flatted` (prototype pollution, GHSA-rf6f-7fwh-wjgh), `picomatch` (ReDoS, GHSA-c2c7-rcm5-vvqj). The top-level `overrides` approach broke vitest — try per-workspace overrides or wait for upstream firebase-admin/firebase-functions bumps.
- **Refactor `packages/bot/src/main.ts`** (~1300-line god-file). Extract: 4 interaction handlers, Firebase listener block (move to `events/ready.ts`), adapter helpers (`adaptMember`, `adaptVoiceChannel`, `createBotAdapter`). Targeted hand-driven work; too risky overnight.
- **Decouple `firestoreService.ts` from the Zustand store.** Service methods directly call `useAppStore.getState()`; tests can't run the service in isolation. Needs human design eyes — store callers must absorb the data flow.
- **Bot-wide error-reporting rollout** — ~65 `logger.error('...${e}')` sites in bot src still bypass `reportError()`. The helper shipped in PR #466; a dedicated PR could mechanically rewrite the call sites, but the diff is large and warrants its own session.

## Medium-impact, ready to ship next run

- **Theme 13 — `LobbyView` filter memoization.** 7 unmemoized `.filter()` passes over `activePlayers` on every render. Wrap in `useMemo` keyed on `[players, sittingOut]`. No DOM change so snapshots should be stable, but verify in Docker.
- **Theme 15 — `PreferenceService` cache consolidation.** Five parallel `Map`s keyed by `discordId`. Replace with one `Map<string, PlayerCacheEntry>` and helper methods. Medium blast radius — touches caching invariants.
- **Theme 16 — `catch (e) → catch (err)` rename.** Bot uses `e`, frontend uses `err`. Need a real codemod (ts-morph / eslint-plugin-rename-vars) — sed isn't safe because of bare `e` references inside catch bodies.
- **Theme 22 — a11y bundle.** `PlayerChip` div→button, `HeaderBar` logo as button, `SpotlightPortrait` aria-label, `WheelsView` aria-live region for spin status. Each requires regenerating Playwright snapshots via Docker.
- **Theme 23 — `EditPlayerModal` focus trap.** Add aria-modal=true, focus-management on open/close. Snapshot regen needed.
- **code-smell-firestore-listener-factory** — refactor 4 `listenFor*` methods in `firebaseService.ts` into a private `_listenToCollection` helper. High-risk-area (data persistence).
- **code-smell-quick-issue-handler-duplication** — extract `submitQuickIssue` helper consolidating the 5 bug/feature/badgroup branches and modal handlers in `main.ts`.
- **code-smell-rate-limit-magic-numbers-in-listener** — extract `BadGroupReportRateLimiter` from `main.ts` ready handler.
- **consistency-voice-channels-builder** — extract `buildVoiceChannelsSnapshot(guild)` helper. Touches `main.ts` + `sessionService.ts`.
- **code-smell-realm-slug-duplication** — extract `realmToSlug` + `parseInGameName` from RoleEditor + useDungeonSuggestions + functions/refreshCharacterMedia.ts to shared.
- **code-smell-wheelsview-spotlight-sequence-duplication** — extract `playSpotlightSequence` in WheelsView.tsx. UI; needs Docker Playwright snapshot regeneration.

## High-risk algorithm changes (require careful review)

- **performance-skip-history-fromdict** — skip `WoWPlayer.fromDict` reconstruction when only names are needed in pair-counter loop. Touches algorithm + Lua sibling.
- **performance-grab-next-redundant-set-check** — restructure `handleRemainders` to drop redundant Set lookup. Algorithm hot path.
- **code-smell-removeplayer-role-list-table** — data-driven role-bucket config in `parallelGroupCreator.removePlayer`. Algorithm + Lua sibling parity.

## Low-impact polish

- **Theme 12 (partial) — `WoWPlayer` offspec getter caching.** Cache booleans in constructor instead of `Array.includes` on every access. Skipped earlier because of constructor signature risk.
- **`createMythicPlusGroups._debug` parameter is a no-op** kept for Lua-sibling parity. Consider removing entirely if the Lua side doesn't actually use it.
- **`consistency-wow-player-construction`:** bot still calls `WoWPlayer.create(name, roleList)` to deserialize Firestore docs in some paths where `fromDict` is more honest about the wire format. Type-safety angle was addressed via PR #492; the construction question itself remains open.
