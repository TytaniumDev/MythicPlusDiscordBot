# Open backlog

Known issues found by past runs but not yet addressed. Pre-seeded into each new run as critic findings.

## High-impact, deferred from prior runs

- **Re-attempt CVE patches** for `protobufjs` (RCE, GHSA-xq3m-2v4x-88gg, CVSS 9.8), `flatted` (prototype pollution, GHSA-rf6f-7fwh-wjgh), `picomatch` (ReDoS, GHSA-c2c7-rcm5-vvqj). Top-level `overrides` broke vitest in #460. Try per-workspace overrides or wait for upstream firebase-admin/firebase-functions bumps.
- **Refactor `packages/bot/src/main.ts`** (~1220-line god-file after #537 took ~75 LoC). Remaining: 4 interaction handlers, Firebase listener block (move to `events/ready.ts`), more adapter helpers (`adaptMember`, `adaptVoiceChannel`, `createBotAdapter`). Targeted hand-driven work; too risky overnight.
- **Decouple `firestoreService.ts` from the Zustand store.** Service methods directly call `useAppStore.getState()`; tests can't run the service in isolation. Needs human design eyes — store callers must absorb the data flow.
- **Bot-wide error-reporting rollout** — partially shipped via #466 (helper) + #536 (storage / issues / debug / groupService). Remaining: ~14 `logger.warn` sites in `main.ts` still bypass `reportError()` (`consistency-bot-error-reporting-main-warnings` open). Needs focused review of each warn site.
- **Vite security CVEs (3 advisories)** + **discord.js → undici (6 advisories)** dependency bumps. Vite 7→8 has peer-dep impact across storybook/tailwind/sentry; needs version research. Deferred this run.

## Medium-impact, ready to ship next run

- **Theme 13 — `LobbyView` filter memoization.** 7 unmemoized `.filter()` passes over `activePlayers` on every render. Wrap in `useMemo` keyed on `[players, sittingOut]`. No DOM change so snapshots should be stable, but verify in Docker.
- **Theme 15 — `PreferenceService` cache consolidation.** Five parallel `Map`s keyed by `discordId`. Replace with one `Map<string, PlayerCacheEntry>` and helper methods. Medium blast radius — touches caching invariants. (Note: hydration helper extracted in #530, but the five-maps-to-one consolidation remains.)
- **Theme 16 — `catch (e) → catch (err)` rename.** Bot uses `e`, frontend uses `err`. Need a real codemod (ts-morph / eslint-plugin-rename-vars) — sed isn't safe because of bare `e` references inside catch bodies.
- **Theme 22 — a11y bundle (DOM-changing).** `PlayerChip` div→button, `ChannelCard` div→button, `GuildCard` div→button, `HeaderBar` logo as button. Each requires regenerating Playwright snapshots via Docker.
- **Theme 23 — modal focus traps.** `EditPlayerModal` and `ProfileModal` need `aria-modal=true` + focus management on open/close. Snapshot regen needed.
- **`code-smell-firestore-listener-factory`** — refactor 4 `listenFor*` methods in `firebaseService.ts` into a private `_listenToCollection` helper. High-risk-area (data persistence).
- **`code-smell-quick-issue-handler-duplication`** — extract `submitQuickIssue` helper consolidating the 5 bug/feature/badgroup branches and modal handlers in `main.ts`.
- **`code-smell-rate-limit-magic-numbers-in-listener`** — extract `BadGroupReportRateLimiter` from `main.ts` ready handler.
- **`code-smell-wheelsview-spotlight-sequence-duplication`** — extract `playSpotlightSequence` in WheelsView.tsx. UI; needs Docker Playwright snapshot regeneration.
- **`consistency-bot-error-reporting-main-warnings`** — ~14 `logger.warn` sites in `main.ts` still bypass `reportError`. Needs focused review of each warn site to pick correct tags.
- **`consistency-error-handler-tag-shape`** — bot `reportError(err, { tags, user, extra })` and activity `reportError(err, { tag })` wrapper signatures diverge. Decide on a unified shape.

## Architecture cleanups (deferred — too architectural for one overnight pass)

- **`architecture-preferenceservice-misplaced-in-core`** — `core/preferenceService.ts` is service-layer logic but lives in `core/`. Should move under `services/`.
- **`architecture-bot-utils-mixes-formatting-and-domain-construction`** — `core/utils.ts` mixes UI formatting (typing-channel helpers) with domain (`WoWPlayer` building). Split.
- **`architecture-firestoreservice-collapses-five-responsibilities`** — service handles persistence + listeners + zustand mutation + parseExisting + role coercion in one class. Break out.
- **`architecture-firebaseservice-overlong-mixed-concerns`** — bot `firebaseService.ts` mixes auth, doc CRUD, listeners, history, season config.
- **`code-smell-bot-services-import-core-groupui-from-service-layer`** — service files import from `core/groupUi`; backwards layer dependency.

## High-risk algorithm changes (require careful review)

- **`performance-skip-history-fromdict`** — skip `WoWPlayer.fromDict` reconstruction when only names are needed in pair-counter loop. Touches algorithm + Lua sibling.
- **`performance-grab-next-redundant-set-check`** — restructure `handleRemainders` to drop redundant Set lookup. Algorithm hot path.
- **`code-smell-removeplayer-role-list-table`** — data-driven role-bucket config in `parallelGroupCreator.removePlayer`. Algorithm + Lua sibling parity.
- **`perf-removefromlist-quadratic`** — `removeFromList` is O(N) inside a loop; flatten to O(1) deletions via index map. Algorithm hot path; Lua-sibling impact.
- **`perf-pairkey-string-concat-tight-loop`** — `pairKey` template-literal concatenation in inner loop is hot. Pre-allocated buffer pattern. Lua-sibling impact.

## Low-impact polish

- **Theme 12 (partial) — `WoWPlayer` offspec getter caching.** Cache booleans in constructor instead of `Array.includes` on every access. Skipped earlier because of constructor signature risk.
- **`createMythicPlusGroups._debug` parameter is a no-op** kept for Lua-sibling parity. Consider removing entirely if the Lua side doesn't actually use it.
- **`wheelsview-markedpools-double-iterate`** — WheelsView iterates pools twice per render. One-pass with structured accumulator.

## Closed (do not reopen)

- **`consistency-wow-player-construction`** — CLOSED. `WoWPlayer.create` and `WoWPlayer.fromDict` serve different shapes; unifying adds no value. (T15 verified premise wrong, run 20260507-153155.) See style-decisions 2026-05-07 entry.
