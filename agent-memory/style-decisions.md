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
