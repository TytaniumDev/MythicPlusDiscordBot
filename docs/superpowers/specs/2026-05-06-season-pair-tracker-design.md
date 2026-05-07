# Season pair tracker (#513)

Track who has run dungeons with whom over a Mythic+ season, surface that data in
the Activity UI as a per-player profile and a Connections page (top teammates,
six-degrees connector). Auto-reset between seasons via raider.io.

## Motivation

From issue #513: "It would be fun if Wheelson would track who has run dungeons
with whom over the course of a season, so we can see who Wheelson is trying to
matchmake with who. ... maybe it could do a 6 degrees of bacon thing, and show
that e.g. Temma's best connection to Gazzi is Sorovar (or whoever)."

Today, the algorithm tracks pair counts per-day (`groupHistory`), then resets at
PST midnight. The information needed for the season-long view is structurally
identical (pair counts), just persisted on a longer horizon.

## Architecture

### Data model

**Global config** — written by the existing weekly cron, read by both the bot
and the Activity frontend.

```
config/season = {
  slug: 'season-mn-1',          // raider.io slug
  blizzardSeasonId: 17,
  expansionId: 11,
  fetchedAt: Timestamp,
}
```

**Per-guild season pair counts** — bumped after every spin (when not in debug
mode) by whichever surface ran the spin (bot or Activity).

```
guilds/{guildId}.seasonPairs = {
  seasonSlug: 'season-mn-1',    // matched against config/season.slug
  counts: { 'Alice|Bob': 12, ... },
}
```

The `seasonSlug` field is the reset signal: when it differs from
`config/season.slug` (or is absent), the next bump treats `counts` as `{}` and
overwrites `seasonSlug` with the current value. No active "reset all guilds"
job is needed.

### Fetch current season

raider.io's `https://raider.io/api/v1/mythic-plus/static-data?expansion_id=N`
returns one season per expansion. For v1, `expansion_id` is hardcoded to `11`
(The War Within / "MN" — Midnight). When the next expansion ships we'll need a
manual bump of the constant; a follow-up issue can revisit auto-detection.

`fetchCurrentSeasonInfo()` makes a single HTTP request, returns the slug and
`blizzard_season_id` from the first season in the response.

Hooked into the existing `fetchAndWriteAffixes` Tuesday cron — after the
affixes write succeeds, fetch + write `config/season`. Same on-demand
`refreshAffixes` callable triggers a season refresh too.

### Pair-count bump

After every spin that persists rounds, both the bot and the Activity:

1. Read `config/season` and the guild doc.
2. Compute new counts: `bumpPairCounts(existingCounts, justFinishedRound)`,
   resetting to `{}` first if `seasonPairs.seasonSlug !== config/season.slug`.
3. Write `guilds/{guildId}.seasonPairs = { seasonSlug, counts }`.

`bumpPairCounts` reuses the same `pairKey(a, b)` canonicalization from
`parallelGroupCreator.ts`, so the season counts and the per-day pair counts use
identical keys. The Lua sibling addon doesn't need to participate (it has no
season storage of its own).

### Skip debug data

- Bot — `groupService.getGroupsData(ctx, debug=true)` skips the bump.
- Activity — `firestoreService.requestSpin` skips the bump when
  `channelData.isDebug === true`.

The demo service path doesn't write to Firestore at all, so demo sessions are
naturally excluded.

### Compute helpers (shared package)

Pure functions, all tested in isolation:

- `bumpPairCounts(counts: Record<string, number>, round: WoWGroup[]): Record<string, number>`
  — add the round's pair counts to the existing map, return a new map.
- `topAffinityFor(name: string, counts: Record<string, number>, limit = 5): { teammate: string; count: number }[]`
  — extract entries involving `name`, sort by count desc, slice.
- `shortestPath(from: string, to: string, counts: Record<string, number>): string[] | null`
  — Dijkstra over the implicit graph; edge cost `1 / count` so frequent pairings
  are "shorter". Returns the names along the path inclusive of endpoints, or
  `null` if no connection exists.

### Activity UI

**Header bar.** Reorder existing slots:

- Left: back button (or spacer) — unchanged
- Wheelson icon — unchanged
- Commit hash — *moved here, right of the icon*
- Center: title + subtitle — unchanged
- Right: existing extra slot — unchanged
- Right: **profile avatar** — new, clickable

The avatar uses `currentPlayerId` to find the current user's player record,
then renders via the existing `toAvatarUrl(mediaUrl)` + class-color ring path
that `PlayerChip` already uses. Falls back to first-initial circle when the
user isn't linked or hasn't joined the lobby.

**Profile modal.** Opened by clicking the header avatar. Small popover-style
modal (not a full page) showing identity:

- Larger avatar
- In-game name
- Discord ID
- Linked character info (name / realm / region / class) — same data the lobby
  already surfaces via `linkedCharacter` on the preference doc
- Footer link: "View Connections →" navigating to the new full-page view

This is the user's own profile. There's no profile-for-someone-else from the
header avatar; the Connections page handles drilling into other players.

**Connections view (new full page).** Reachable from the profile modal's "View
Connections →" link, and also linkable as a route. Shows three sections:

1. **Your top teammates** — affinity table for the current player (top 5 by
   count). Each row links to that teammate's mini-profile (a re-use of the
   profile modal, but populated with the teammate's identity rather than the
   current user's).
2. **Six-degrees connector** — pick another player from a dropdown → show the
   chain ("Tyt → Sorov → Gazzi") and total cost. Empty state when no path
   exists ("No shared groups yet — spin together once first").
3. **Browse players** — list every player who appears in any season pair-count
   key (i.e. has spun at least once this season), with their top-1 teammate
   summary, clickable.

Routing: add `'connections'` to `ViewName` in `store/types.ts` and wire it
through `routeToView` / `viewToRoute` in `lib/routing.ts`.

## Out of scope (v1)

- Force-directed network graph (heavy UI for a thrice-looked feature)
- Time-series ("we've grouped N times this week") — counts are a single
  cumulative number per pair this season
- Backfill of historical rounds — counts start from 0 on deploy / season change
- Cross-guild aggregation — pair counts are per-guild, never combined
- A `/wheelson stats` slash command — the avatar in the Activity is the entry
  point

## Files touched

**packages/functions/src/**
- `fetchCurrentSeason.ts` (new) — `fetchCurrentSeasonInfo()` (hardcoded
  `expansion_id=11`)
- `fetchWeeklyAffixes.ts` — extend `fetchAndWriteAffixes` to also write
  `config/season`

**packages/shared/src/**
- `seasonPairs.ts` (new) — `bumpPairCounts`, `topAffinityFor`, `shortestPath`,
  `SeasonPairs` type
- `parallelGroupCreator.ts` — export `pairKey` so `seasonPairs.ts` can reuse it
- `index.ts` — re-export the new module

**packages/bot/src/**
- `core/firebaseService.ts` — `getSeasonConfig`, `getSeasonPairs`,
  `saveSeasonPairs` methods
- `services/groupService.ts` — call new bump helper in `_saveGroupHistory` when
  `!debug`
- `commands/debug.ts` (or wherever the `/wheel` debug flag is plumbed) — make
  sure the debug parameter reaches `getGroupsData`

**activity/src/**
- `services/firestoreService.ts` — bump season pairs in `requestSpin` when not
  `isDebug`; subscribe to `config/season` for slug
- `store/types.ts` — add `seasonPairs` and `seasonConfig` to state, add
  `'connections'` to `ViewName`
- `store/store.ts` — store actions
- `lib/routing.ts` — route mapping for `'connections'`
- `components/HeaderBar.tsx` — relayout: commit hash next to icon, profile
  avatar on right; new `ProfileAvatar` button child
- `components/ProfileAvatar.tsx` (new) — small clickable avatar
- `components/ProfileModal.tsx` (new) — identity modal
- `views/ConnectionsView.tsx` (new) — full-page connections view
- `App.tsx` — render `ConnectionsView` when `currentView === 'connections'`

## Testing

**Pure helpers** (Vitest, in `packages/shared/tests/seasonPairs.test.ts`):
- `bumpPairCounts` — increments correctly across multiple groups in a round
- `topAffinityFor` — sorts by count desc, ties broken alphabetically
- `shortestPath` — single-edge path, multi-hop path, no-path returns null,
  same-name from/to returns `[name]`
- `bumpPairCounts` filters out groups smaller than 2 (degenerate / remainder)

**Bot bump flow** (Vitest, in `packages/bot/tests/groupService.test.ts`):
- Bumps season pairs on real spin, skips on debug, resets on slug mismatch

**Activity bump flow** (Vitest, in `activity/src/services/...test.ts` if a
test file is present, otherwise add one for the bump path):
- Same coverage as the bot side: real spin bumps, debug skips, mismatched
  slug resets to empty

**Cloud Function** (Vitest, in `packages/functions/`):
- `fetchCurrentSeasonInfo` parses raider.io's response and returns slug +
  `blizzard_season_id`
- Throws on empty `seasons` (signal that `EXPANSION_ID` constant needs
  bumping)

**Activity UI**:
- Storybook stories for `ProfileAvatar`, `ProfileModal`, `ConnectionsView`
- Update Playwright visual snapshots for `HeaderBar` (commit hash relocation +
  new avatar)

## Open considerations / known limitations

- **Race on bump**: if Bot and Activity both write to the same guild
  concurrently, last write wins. In practice they don't run for the same guild
  at the same time. If this becomes a real issue, switch to Firestore
  `FieldValue.increment` per-key writes — but those bypass the slug-mismatch
  reset, so we'd need a tiny transaction.
- **Cardinality of `counts`**: ~N² for N distinct names; for a 50-person guild
  over a season that's ~1250 keys. Well under Firestore's 1 MiB document limit.
- **Player identity**: `name` strings (e.g. `"Sorovar (Jeremy)"`) are the
  pairing key, not Discord IDs. Renaming a player means their pair history
  splits — acceptable for v1; the algorithm has the same property today.
