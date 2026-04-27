# Style decisions

Consistency and pattern choices the agent has standardized on. These are LAW — never re-litigate.

Format: `- <YYYY-MM-DD>: <decision>. Rationale: <one line>. PR: #<N>.`

- 2026-04-27: Cloud Functions log via `firebase-functions/logger`, not raw `console.*`. Rationale: Cloud Logging keeps structured metadata only when going through `logger`. PR: #464.
- 2026-04-27: Activity error handling routes through `reportError(err, { tag })` from `lib/sentry.ts`, not `.catch(console.error)`. Rationale: tagged Sentry context is required for triage; bare console.error is invisible in prod. PR: #465.
- 2026-04-27: Bot error handling routes through `reportError(err, { tags, user, extra })` from `core/sentry.ts`, not raw `Sentry.captureException`. Rationale: mirrors the activity wrapper, also logs to winston. PR: #466.
- 2026-04-27: "Today" for group history is `todayPST()` from `@mythicplus/shared/dateHelpers`, not inline `new Date().toLocaleDateString(...)`. Rationale: rotation key must agree across bot and frontend; pinned to PST/PDT. PR: #468.
- 2026-04-27: Active-channel registration in SessionService goes through `registerChannel(channelId, guildId, docId)`, not direct `activeChannels.set` + `activeGuilds.add`. Rationale: idempotency + invariant that activeGuilds covers any channel's guild. PR: #469.
- 2026-04-27: Spin eligibility (has-role + not-sitting-out) goes through `activity/src/lib/spinEligibility.ts::eligibleSpinPlayers`, not inline filter. Rationale: demo and prod must never diverge on what "eligible" means. PR: #472.
- 2026-04-27: `WoWGroup.{hasBrez,hasLust,hasRanged,size}` use direct tank/healer/dps checks, NOT `this.players.some(...)`. Rationale: `players` getter allocates per call — these getters are in the algorithm hot path. PR: #471.
- 2026-04-27: `FORT_TYRAN_AFFIXES` is intentionally module-private inside `packages/shared/src/affixMetadata.ts`. Rationale: only `resolveAffixDisplay` consumes it; exporting just leaks API surface. PR: #459.
- 2026-04-27: `DiscordMember` interface includes `bot: boolean` directly, not via cast. Rationale: every adapter populates it; casting hides type holes. PR: #458.
- 2026-04-27: `GuildData.groupHistory.rounds` is typed `unknown[]`, not `Record<string, unknown>[][]`. Rationale: legacy flat and current wrapped shapes coexist; type must be honest about variance and force callers through `parseExistingRounds`. PR: #458.
- 2026-04-27: Top-level npm `overrides` block in root package.json is forbidden. Rationale: caused vitest's `obug` and `strip-literal` to silently disappear from the install tree (#460 reverted #456). Use per-workspace overrides or wait for upstream bumps.
- 2026-04-27: Firestore groupHistory wire-format encode/decode goes through `encodeGroupHistoryRounds` / `decodeGroupHistoryRounds` from `@mythicplus/shared`, not inline `{ groups: [...] }` mapping. Rationale: bot and frontend must not drift on legacy-shape tolerance — both packages now share one codec. PR: #494.
- 2026-04-27: `WoWPlayer.fromDict` validates `mainRole`/`offspecs`/`utilities` via `toRole` / `toUtility` rather than blind casts; legacy `roles` map values are coerced via `Boolean(...)`. Rationale: Firestore is an external boundary — defensive runtime validation prevents garbage from crossing into typed code. PR: #492.
- 2026-04-27: `getDebugPlayers` lives in `packages/bot/src/core/debugFixtures.ts`, not `core/utils.ts`. Rationale: utils.ts is for runtime helpers, not fixture data. PR: #491.
- 2026-04-27: Activity error sites use `reportError(err, { tag: 'module.context' })` exclusively — no remaining `console.error('[Wheelson] ...', err)` in error-handling paths. Operational `console.info` logs (Sentry-disabled, retry progress) intentionally remain. Rationale: completes the consistency rule from PR #465 across the activity. PR: #489.
- 2026-04-27: Discord member iteration in `packages/bot/src/main.ts` uses `adaptMember(m).bot`, never raw `m.user.bot`. Rationale: completes the consistency rule from PR #458 — adapter pattern is the single authority for member shape. PR: #493.
- 2026-04-27: GitHub webhook payloads are validated via `parseWebhookPayload(body)` before use; the issue-tracking Firestore doc is validated via `parseIssueTrackingDoc(data)` before downstream calls. Rationale: HTTP-facing endpoint with Firestore-derived intermediate state needs defensive parsing on both boundaries. PR: #488.
