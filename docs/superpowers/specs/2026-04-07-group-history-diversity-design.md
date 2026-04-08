# Group History Diversity

**Date:** 2026-04-07
**Status:** Approved

## Problem

The group formation algorithm currently only remembers the last round of groups. After one new spin, all prior history is lost. With 15-20 players forming 3-4 groups, this means players frequently end up with the same teammates across a session night.

## Goal

Maximize teammate diversity across an entire session night so that every player plays with every other player as much as possible.

## Design

### Data Model

**Firestore field on `guilds/{guildId}`:**

```
// Old (deprecated)
previousGroups: WoWGroupDict[]

// New
groupHistory: {
  date: string,              // PST date string, e.g. "2026-04-07"
  rounds: WoWGroupDict[][]   // array of rounds, each round is an array of groups
}
```

- On load: if `date` is today (America/Los_Angeles), use the rounds. If it's a previous day, treat as empty history.
- On save: append the new round to `rounds` and set `date` to today (PST).
- The old `previousGroups` field is no longer read or written. It can be left in place for existing docs — no migration needed since history resets daily.

### Algorithm Changes (parallelGroupCreator.ts)

**Module-level state:**

```ts
// Old
const lastGroups = new Map<string | number | null, WoWGroup[]>();

// New
const groupHistory = new Map<string | number | null, WoWGroup[][]>();
```

**Pair-count matrix:** At the start of `createMythicPlusGroups`, build a pair-count map from all stored rounds:

```ts
// pairCounts.get("Alice|Bob") → 3 means they've been grouped 3 times tonight
const pairCounts = new Map<string, number>();
```

Keys are the two player names sorted alphabetically and joined with `|`.

**Player selection:** `grabNextAvailablePlayer` changes from a two-pass binary check (ineligible/fallback) to a single-pass scoring approach:

```
score(candidate, group) = sum of pairCounts[candidate, teammate]
                          for each teammate already in the group
```

Pick the candidate with the lowest score (0 = never grouped with anyone in this group). Ties broken by list order (already shuffled).

This replaces both the "ineligible" first pass and the fallback pass with a single unified selection.

**What stays the same:**
- `createMythicPlusGroups` public signature (players, debug, guildId)
- WoWGroup / WoWPlayer models
- Fill order: tanks, lust, brez, healers, ranged, remaining DPS, remainders
- Role-based selection logic — pair-count scoring only affects *which* player is picked from the eligible pool, not the fill priority

### Exported API Changes (parallelGroupCreator.ts)

- `setLastGroups(groups, guildId)` → `setGroupHistory(rounds: WoWGroup[][], guildId)`
- `clear()` — unchanged
- `createMythicPlusGroups` — signature unchanged, internally appends new round to history

### Integration Points

**Bot (`firebaseService.ts`):**
- `getPreviousGroups(guildId)` → `getGroupHistory(guildId)`: returns `{ date: string, rounds: WoWGroupDict[][] }` or null
- `savePreviousGroups(guildId, groups)` → `saveGroupHistory(guildId, history)`: writes the full `groupHistory` object

**Bot (`groupService.ts`):**
- `_loadPreviousGroups` → `_loadGroupHistory`: reads from Firebase, checks date freshness, calls `setGroupHistory`
- `_savePreviousGroups` → `_saveGroupHistory`: reads existing history, appends new round, writes back

**Frontend (`firestoreService.ts`):**
- Same pattern: read `groupHistory` from guild doc, check date, call `setGroupHistory`
- On spin: append new round and write back with today's PST date

**Demo service (`demoService.ts`):**
- No change needed — uses `guildId: null`, history accumulates in memory across demo spins

**Lua addon (Wheelson):**
- Separate repo. Will need a matching algorithm update eventually, but not part of this work.

### Date Handling

PST date string is computed using `America/Los_Angeles` timezone. The date check is a simple string comparison — if the stored date doesn't match today's date, history is treated as empty.

No cron job or scheduled task is needed. The date check is a lazy reset: stale history is discarded on next load and overwritten on next save.

## Testing

**Unit tests (`parallelGroupCreator.test.ts`):**
- After multiple spins, players who have been grouped together are avoided in favor of new pairings
- Setting history with yesterday's date is treated as empty (daily reset)
- When all pairs have history, algorithm produces valid groups and picks least-repeated pairings
- Pair-count scoring doesn't break role/utility constraints (tank/healer/brez/lust still filled correctly)

**Integration tests (`groupService.test.ts`):**
- `getGroupHistory` / `saveGroupHistory` Firebase read/write
- Rounds accumulate: spin 1 saves 1 round, spin 2 saves 2 rounds
- Stale date clears history on load

**Existing tests:**
- All existing tests continue to pass — the algorithm produces the same type of output with smarter selection

No frontend E2E changes needed — the UI is unchanged.
