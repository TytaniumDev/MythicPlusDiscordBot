# Season Pair Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track season-long pair counts per guild, expose them in the Activity UI as a per-player profile (header avatar) and a Connections page (top teammates + six-degrees connector). Auto-reset between seasons via raider.io.

**Architecture:**
- New shared module `seasonPairs.ts` provides pure helpers (`bumpPairCounts`, `topAffinityFor`, `shortestPath`) using the same `pairKey(a, b)` canonicalization the algorithm already uses.
- Cloud Function fetches the current raider.io season slug weekly into `config/season`. Per-guild pair counts live in `guilds/{guildId}.seasonPairs`; lazy-reset on slug mismatch at next bump.
- Bot and Activity each call `bumpPairCounts` after persisting a spin's groups (skipping debug-mode spins). Activity adds a profile avatar to the header that opens an identity modal, plus a new `ConnectionsView` route reachable from the modal.

**Tech Stack:** TypeScript, Vitest, Firebase Functions v2 + Admin SDK, Firestore client SDK (Activity), React + Zustand store, Playwright (Docker) for UI snapshots.

**Spec:** [`docs/superpowers/specs/2026-05-06-season-pair-tracker-design.md`](../specs/2026-05-06-season-pair-tracker-design.md)

---

## Task 1: Export `pairKey` from `parallelGroupCreator.ts`

The new `seasonPairs` module needs to use the exact same key format the algorithm uses. `pairKey` is currently a private helper.

**Files:**
- Modify: `packages/shared/src/parallelGroupCreator.ts:39-46`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Change `pairKey` to be exported**

In `packages/shared/src/parallelGroupCreator.ts`, change the `function pairKey` declaration:

```typescript
/**
 * Canonical key for an unordered name pair, so `pairCounts.get(pairKey(a, b))`
 * yields the same value regardless of argument order. Mirrored verbatim by
 * the Lua addon's pair-count map — keep the format byte-for-byte identical.
 */
export function pairKey(a: string, b: string): string {
  return a < b ? a + '|' + b : b + '|' + a;
}
```

(The only change is adding `export` before `function pairKey`.)

- [ ] **Step 2: Re-export from index**

In `packages/shared/src/index.ts`, find the `parallelGroupCreator` re-export block and add `pairKey`:

```typescript
export {
  createMythicPlusGroups,
  setGroupHistory,
  clear,
  pairKey,
} from './parallelGroupCreator.js';
```

(Adjust the existing block — preserve other exports already present.)

- [ ] **Step 3: Verify it compiles**

Run: `npm -w packages/shared run typecheck`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/parallelGroupCreator.ts packages/shared/src/index.ts
git commit -m "refactor(shared): export pairKey for cross-module reuse"
```

---

## Task 2: `bumpPairCounts` (TDD)

Pure function: given an existing counts map and a freshly-formed round, return a new counts map with each pair's count incremented.

**Files:**
- Create: `packages/shared/src/seasonPairs.ts`
- Create: `packages/shared/tests/seasonPairs.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/shared/tests/seasonPairs.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { WoWPlayer, WoWGroup } from '../src/models.js';
import { bumpPairCounts } from '../src/seasonPairs.js';

function mkGroup(names: string[]): WoWGroup {
  const players = names.map((n) => WoWPlayer.create(n, ['Ranged']));
  const g = new WoWGroup();
  g.tank = players[0] ?? null;
  g.healer = players[1] ?? null;
  g.dps = players.slice(2);
  return g;
}

describe('bumpPairCounts', () => {
  it('adds 1 to each pair in a single 5-person group', () => {
    const round = [mkGroup(['Alice', 'Bob', 'Carol', 'Dave', 'Eve'])];
    const result = bumpPairCounts({}, round);
    // 5 players → 10 unique pairs, each at count 1
    expect(Object.keys(result)).toHaveLength(10);
    expect(result['Alice|Bob']).toBe(1);
    expect(result['Bob|Carol']).toBe(1);
    expect(result['Dave|Eve']).toBe(1);
  });

  it('increments existing counts non-destructively', () => {
    const existing = { 'Alice|Bob': 2, 'Carol|Dave': 1 };
    const round = [mkGroup(['Alice', 'Bob', 'Carol', 'Dave', 'Eve'])];
    const result = bumpPairCounts(existing, round);
    expect(result['Alice|Bob']).toBe(3);
    expect(result['Carol|Dave']).toBe(2);
    // Existing input not mutated
    expect(existing['Alice|Bob']).toBe(2);
  });

  it('skips groups smaller than 2', () => {
    const round = [mkGroup(['Solo']), mkGroup(['Alice', 'Bob'])];
    const result = bumpPairCounts({}, round);
    expect(Object.keys(result)).toEqual(['Alice|Bob']);
  });

  it('handles multi-group rounds independently', () => {
    const round = [
      mkGroup(['Alice', 'Bob', 'Carol', 'Dave', 'Eve']),
      mkGroup(['Frank', 'Gina', 'Hugo', 'Ivy', 'Jack']),
    ];
    const result = bumpPairCounts({}, round);
    expect(result['Alice|Bob']).toBe(1);
    expect(result['Frank|Gina']).toBe(1);
    // No cross-group pairs
    expect(result['Alice|Frank']).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm -w packages/shared run test -- seasonPairs`
Expected: FAIL — `Cannot find module '../src/seasonPairs.js'`.

- [ ] **Step 3: Implement `bumpPairCounts`**

Create `packages/shared/src/seasonPairs.ts`:

```typescript
import { WoWGroup } from './models.js';
import { pairKey } from './parallelGroupCreator.js';

/**
 * Per-guild season-long pair counts. The `seasonSlug` field tags which raider.io
 * season the counts belong to; on next bump the consumer compares this against
 * `config/season.slug` and resets `counts` to {} when it differs.
 */
export interface SeasonPairs {
  seasonSlug: string;
  counts: Record<string, number>;
}

/**
 * Increment season pair counts by every pair in `round`. Returns a NEW map;
 * does not mutate `current`. Groups with fewer than 2 players are skipped
 * (degenerate remainders).
 */
export function bumpPairCounts(
  current: Record<string, number>,
  round: readonly WoWGroup[],
): Record<string, number> {
  const next: Record<string, number> = { ...current };
  for (const group of round) {
    const players = group.players;
    if (players.length < 2) continue;
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const key = pairKey(players[i].name, players[j].name);
        next[key] = (next[key] ?? 0) + 1;
      }
    }
  }
  return next;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm -w packages/shared run test -- seasonPairs`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/seasonPairs.ts packages/shared/tests/seasonPairs.test.ts
git commit -m "feat(shared): bumpPairCounts for season pair tracking"
```

---

## Task 3: `topAffinityFor` (TDD)

Given a player name and a counts map, return their top-N teammates sorted by count desc, ties broken alphabetically.

**Files:**
- Modify: `packages/shared/src/seasonPairs.ts`
- Modify: `packages/shared/tests/seasonPairs.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/shared/tests/seasonPairs.test.ts`:

```typescript
import { topAffinityFor } from '../src/seasonPairs.js';

describe('topAffinityFor', () => {
  it('returns teammates sorted by count desc', () => {
    const counts = {
      'Alice|Bob': 5,
      'Alice|Carol': 3,
      'Alice|Dave': 7,
    };
    const result = topAffinityFor('Alice', counts);
    expect(result).toEqual([
      { teammate: 'Dave', count: 7 },
      { teammate: 'Bob', count: 5 },
      { teammate: 'Carol', count: 3 },
    ]);
  });

  it('breaks ties alphabetically', () => {
    const counts = {
      'Alice|Bob': 2,
      'Alice|Carol': 2,
      'Alice|Dave': 2,
    };
    const result = topAffinityFor('Alice', counts);
    expect(result.map((r) => r.teammate)).toEqual(['Bob', 'Carol', 'Dave']);
  });

  it('respects the limit', () => {
    const counts = {
      'Alice|Bob': 1,
      'Alice|Carol': 2,
      'Alice|Dave': 3,
      'Alice|Eve': 4,
    };
    const result = topAffinityFor('Alice', counts, 2);
    expect(result).toEqual([
      { teammate: 'Eve', count: 4 },
      { teammate: 'Dave', count: 3 },
    ]);
  });

  it('ignores entries that don\'t involve the queried player', () => {
    const counts = {
      'Alice|Bob': 3,
      'Carol|Dave': 5,
    };
    const result = topAffinityFor('Alice', counts);
    expect(result).toEqual([{ teammate: 'Bob', count: 3 }]);
  });

  it('returns empty array when player has no pairings', () => {
    const counts = { 'Bob|Carol': 1 };
    expect(topAffinityFor('Alice', counts)).toEqual([]);
  });

  it('handles names with the pipe character correctly via canonical pairKey', () => {
    // pairKey sorts lexicographically, so 'Alice' < 'alice' (uppercase first).
    // Verify the lookup tolerates case-sensitive distinct names.
    const counts = {
      'Alice|alice': 1,
    };
    expect(topAffinityFor('Alice', counts)).toEqual([{ teammate: 'alice', count: 1 }]);
    expect(topAffinityFor('alice', counts)).toEqual([{ teammate: 'Alice', count: 1 }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm -w packages/shared run test -- seasonPairs`
Expected: FAIL — `topAffinityFor` not exported.

- [ ] **Step 3: Implement `topAffinityFor`**

Append to `packages/shared/src/seasonPairs.ts`:

```typescript
/**
 * Return the top `limit` teammates of `name` sorted by pair count descending,
 * with ties broken alphabetically. Empty array when `name` has no pairings.
 */
export function topAffinityFor(
  name: string,
  counts: Record<string, number>,
  limit = 5,
): { teammate: string; count: number }[] {
  const matches: { teammate: string; count: number }[] = [];
  for (const [key, count] of Object.entries(counts)) {
    const sep = key.indexOf('|');
    if (sep === -1) continue;
    const a = key.slice(0, sep);
    const b = key.slice(sep + 1);
    if (a === name) matches.push({ teammate: b, count });
    else if (b === name) matches.push({ teammate: a, count });
  }
  matches.sort((x, y) => {
    if (x.count !== y.count) return y.count - x.count;
    return x.teammate < y.teammate ? -1 : x.teammate > y.teammate ? 1 : 0;
  });
  return matches.slice(0, limit);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm -w packages/shared run test -- seasonPairs`
Expected: PASS — 10 tests total (4 from Task 2, 6 new).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/seasonPairs.ts packages/shared/tests/seasonPairs.test.ts
git commit -m "feat(shared): topAffinityFor for affinity table"
```

---

## Task 4: `shortestPath` (TDD)

Dijkstra-like BFS over the implicit graph; edge cost = `1 / count` so frequent pairings are "shorter". Returns the names along the path inclusive, or `null` if no connection exists.

**Files:**
- Modify: `packages/shared/src/seasonPairs.ts`
- Modify: `packages/shared/tests/seasonPairs.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/shared/tests/seasonPairs.test.ts`:

```typescript
import { shortestPath } from '../src/seasonPairs.js';

describe('shortestPath', () => {
  it('returns single-element path when from === to', () => {
    expect(shortestPath('Alice', 'Alice', { 'Alice|Bob': 1 })).toEqual(['Alice']);
  });

  it('returns direct path for adjacent players', () => {
    const counts = { 'Alice|Bob': 1 };
    expect(shortestPath('Alice', 'Bob', counts)).toEqual(['Alice', 'Bob']);
  });

  it('returns multi-hop path when no direct edge', () => {
    const counts = {
      'Alice|Bob': 1,
      'Bob|Carol': 1,
    };
    expect(shortestPath('Alice', 'Carol', counts)).toEqual(['Alice', 'Bob', 'Carol']);
  });

  it('prefers heavy-weighted (frequent-pairing) edges over light ones', () => {
    // Direct edge Alice-Carol exists but with count=1 (cost 1.0).
    // The two-hop Alice-Bob-Carol both have count=10 (cost 0.1+0.1=0.2 < 1.0).
    const counts = {
      'Alice|Carol': 1,
      'Alice|Bob': 10,
      'Bob|Carol': 10,
    };
    expect(shortestPath('Alice', 'Carol', counts)).toEqual(['Alice', 'Bob', 'Carol']);
  });

  it('returns null when no path exists', () => {
    const counts = {
      'Alice|Bob': 1,
      'Carol|Dave': 1,
    };
    expect(shortestPath('Alice', 'Carol', counts)).toBeNull();
  });

  it('returns null when from is unknown', () => {
    expect(shortestPath('Ghost', 'Alice', { 'Alice|Bob': 1 })).toBeNull();
  });

  it('returns null when to is unknown', () => {
    expect(shortestPath('Alice', 'Ghost', { 'Alice|Bob': 1 })).toBeNull();
  });

  it('ignores entries with count 0 (no real pairing)', () => {
    const counts = {
      'Alice|Bob': 0,
      'Bob|Carol': 1,
    };
    expect(shortestPath('Alice', 'Carol', counts)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm -w packages/shared run test -- seasonPairs`
Expected: FAIL — `shortestPath` not exported.

- [ ] **Step 3: Implement `shortestPath`**

Append to `packages/shared/src/seasonPairs.ts`:

```typescript
/**
 * Adjacency-list view of `counts`. Each name maps to its neighbors and the
 * pair count (used as `1 / count` for path cost). Names with no edges are
 * absent from the map.
 */
function buildAdjacency(counts: Record<string, number>): Map<string, Map<string, number>> {
  const adj = new Map<string, Map<string, number>>();
  for (const [key, count] of Object.entries(counts)) {
    if (count <= 0) continue;
    const sep = key.indexOf('|');
    if (sep === -1) continue;
    const a = key.slice(0, sep);
    const b = key.slice(sep + 1);
    if (!adj.has(a)) adj.set(a, new Map());
    if (!adj.has(b)) adj.set(b, new Map());
    adj.get(a)!.set(b, count);
    adj.get(b)!.set(a, count);
  }
  return adj;
}

/**
 * Shortest pair-history path between two players. Edge cost is `1 / count`
 * so frequent pairings shorten the path (a common direct teammate beats a
 * rarely-paired one). Returns the names along the path inclusive of both
 * endpoints, or `null` when no connection exists. `from === to` returns
 * `[from]`.
 */
export function shortestPath(
  from: string,
  to: string,
  counts: Record<string, number>,
): string[] | null {
  if (from === to) return [from];
  const adj = buildAdjacency(counts);
  if (!adj.has(from) || !adj.has(to)) return null;

  // Dijkstra with a linear-scan frontier (small graphs — guild-scale players
  // never exceed a few hundred names).
  const dist = new Map<string, number>();
  const prev = new Map<string, string>();
  const visited = new Set<string>();
  dist.set(from, 0);

  while (visited.size < adj.size) {
    let current: string | null = null;
    let currentDist = Infinity;
    for (const [name, d] of dist) {
      if (!visited.has(name) && d < currentDist) {
        current = name;
        currentDist = d;
      }
    }
    if (current === null) break;
    if (current === to) break;
    visited.add(current);

    const neighbors = adj.get(current)!;
    for (const [neighbor, count] of neighbors) {
      if (visited.has(neighbor)) continue;
      const candidate = currentDist + 1 / count;
      const known = dist.get(neighbor) ?? Infinity;
      if (candidate < known) {
        dist.set(neighbor, candidate);
        prev.set(neighbor, current);
      }
    }
  }

  if (!prev.has(to)) return null;

  const path: string[] = [to];
  let cursor: string | undefined = to;
  while (cursor && cursor !== from) {
    cursor = prev.get(cursor);
    if (cursor) path.unshift(cursor);
  }
  return path[0] === from ? path : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm -w packages/shared run test -- seasonPairs`
Expected: PASS — 18 tests total.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/seasonPairs.ts packages/shared/tests/seasonPairs.test.ts
git commit -m "feat(shared): shortestPath for six-degrees connector"
```

---

## Task 5: Re-export `seasonPairs` module from index

**Files:**
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Add export**

In `packages/shared/src/index.ts`, append a new export block (after the existing `parallelGroupCreator` block):

```typescript
export {
  bumpPairCounts,
  topAffinityFor,
  shortestPath,
  type SeasonPairs,
} from './seasonPairs.js';
```

- [ ] **Step 2: Verify whole package builds**

Run: `npm -w packages/shared run typecheck`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/index.ts
git commit -m "feat(shared): re-export seasonPairs"
```

---

## Task 6: `fetchCurrentSeasonInfo` Cloud Function helper (TDD)

Hardcoded `expansion_id=11` (TWW / Midnight). Calls raider.io static-data endpoint, parses the first season, returns slug + blizzard_season_id + expansionId. Throws on empty response (signal that the constant needs bumping).

**Files:**
- Create: `packages/functions/src/fetchCurrentSeason.ts`
- Create: `packages/functions/tests/fetchCurrentSeason.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/functions/tests/fetchCurrentSeason.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchCurrentSeasonInfo } from '../src/fetchCurrentSeason.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('fetchCurrentSeasonInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns slug, blizzardSeasonId, expansionId from raider.io', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        seasons: [
          {
            slug: 'season-mn-1',
            blizzard_season_id: 17,
            is_main_season: true,
          },
        ],
      }),
    });

    const result = await fetchCurrentSeasonInfo();

    expect(result).toEqual({
      slug: 'season-mn-1',
      blizzardSeasonId: 17,
      expansionId: 11,
    });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://raider.io/api/v1/mythic-plus/static-data?expansion_id=11',
    );
  });

  it('throws when the request fails', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });
    await expect(fetchCurrentSeasonInfo()).rejects.toThrow(/Raider\.IO.*503/);
  });

  it('throws when the response has empty seasons array', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ seasons: [] }),
    });
    await expect(fetchCurrentSeasonInfo()).rejects.toThrow(/expansion_id needs to be bumped/);
  });

  it('throws when the response is missing seasons', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });
    await expect(fetchCurrentSeasonInfo()).rejects.toThrow(/seasons/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm -w packages/functions run test -- fetchCurrentSeason`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement helper**

Create `packages/functions/src/fetchCurrentSeason.ts`:

```typescript
// Hardcoded for v1 — bump when the next expansion ships and the weekly cron
// starts logging "expansion_id needs to be bumped" errors. A follow-up issue
// can revisit auto-detection.
const EXPANSION_ID = 11;
const RAIDERIO_STATIC_DATA_URL =
  `https://raider.io/api/v1/mythic-plus/static-data?expansion_id=${EXPANSION_ID}`;

export interface SeasonInfo {
  slug: string;
  blizzardSeasonId: number;
  expansionId: number;
}

/**
 * Fetch the current Mythic+ season slug from raider.io for the configured
 * expansion. Used by the weekly affixes cron to populate `config/season`.
 */
export async function fetchCurrentSeasonInfo(): Promise<SeasonInfo> {
  const response = await fetch(RAIDERIO_STATIC_DATA_URL);
  if (!response.ok) {
    throw new Error(`Raider.IO season request failed: ${response.status}`);
  }
  const data = await response.json() as { seasons?: { slug: string; blizzard_season_id: number }[] };
  if (!Array.isArray(data.seasons)) {
    throw new Error('Raider.IO response missing seasons array');
  }
  if (data.seasons.length === 0) {
    throw new Error(
      `Raider.IO returned no seasons for expansion_id=${EXPANSION_ID} — `
      + 'expansion_id needs to be bumped in fetchCurrentSeason.ts',
    );
  }
  const season = data.seasons[0];
  return {
    slug: season.slug,
    blizzardSeasonId: season.blizzard_season_id,
    expansionId: EXPANSION_ID,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm -w packages/functions run test -- fetchCurrentSeason`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/functions/src/fetchCurrentSeason.ts packages/functions/tests/fetchCurrentSeason.test.ts
git commit -m "feat(functions): fetchCurrentSeasonInfo from raider.io"
```

---

## Task 7: Wire `fetchCurrentSeasonInfo` into the weekly affixes cron

`fetchAndWriteAffixes` already runs Tuesdays at 16:00 PT. Extend it to also write `config/season`. Failure to write season info should not break the affixes write.

**Files:**
- Modify: `packages/functions/src/fetchWeeklyAffixes.ts`
- Modify: `packages/functions/tests/fetchWeeklyAffixes.test.ts`

- [ ] **Step 1: Write the failing test**

Open `packages/functions/tests/fetchWeeklyAffixes.test.ts` and append:

```typescript
import { writeSeasonConfig } from '../src/fetchWeeklyAffixes.js';

describe('writeSeasonConfig', () => {
  it('writes slug, blizzardSeasonId, expansionId to config/season', async () => {
    const docMock = vi.fn();
    const setMock = vi.fn().mockResolvedValue(undefined);
    const dbMock = {
      doc: (path: string) => {
        docMock(path);
        return { set: setMock };
      },
    };
    const seasonInfo = { slug: 'season-mn-1', blizzardSeasonId: 17, expansionId: 11 };

    await writeSeasonConfig(dbMock as never, seasonInfo, () => 'TS');

    expect(docMock).toHaveBeenCalledWith('config/season');
    expect(setMock).toHaveBeenCalledWith({
      slug: 'season-mn-1',
      blizzardSeasonId: 17,
      expansionId: 11,
      fetchedAt: 'TS',
    });
  });
});
```

(`vi` is already imported in that file from existing tests; if not, ensure `import { describe, it, expect, vi } from 'vitest'` is present.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm -w packages/functions run test -- fetchWeeklyAffixes`
Expected: FAIL — `writeSeasonConfig` not exported.

- [ ] **Step 3: Implement `writeSeasonConfig` and wire it into `fetchAndWriteAffixes`**

In `packages/functions/src/fetchWeeklyAffixes.ts`, add the new helper and the call site. Replace `fetchAndWriteAffixes`:

```typescript
import { fetchCurrentSeasonInfo, type SeasonInfo } from './fetchCurrentSeason.js';

// ... existing code ...

type SeasonDocFields = SeasonInfo & { fetchedAt: unknown };

/**
 * Persist `config/season` so consumers (bot, Activity) can detect season
 * changes and lazy-reset per-guild pair counts. Written from the weekly
 * affixes cron right after the affixes themselves are persisted.
 */
export async function writeSeasonConfig(
  db: { doc: (path: string) => { set: (data: SeasonDocFields) => Promise<void> } },
  info: SeasonInfo,
  serverTimestamp: () => unknown,
): Promise<void> {
  await db.doc('config/season').set({
    ...info,
    fetchedAt: serverTimestamp(),
  });
}

// Shared logic: fetch current affixes from Raider.IO and write to Firestore
export async function fetchAndWriteAffixes(): Promise<Omit<AffixDocument, 'lastUpdated'> & { lastUpdated: Date }> {
  const response = await fetch(RAIDERIO_AFFIXES_URL);
  if (!response.ok) throw new Error(`Raider.IO request failed: ${response.status}`);

  const data = await response.json();
  if (!Array.isArray(data.affix_details) || data.affix_details.length === 0) {
    throw new Error('Raider.IO response missing affix_details');
  }
  const affixIds: number[] = data.affix_details.map((a: { id: number }) => a.id);

  const doc = buildAffixDocument(affixIds, 'us');

  const db = getFirestore();
  await db.doc('config/affixes').set({
    ...doc,
    lastUpdated: FieldValue.serverTimestamp(),
  });

  // Best-effort: surface a season change to consumers. Failure here must NOT
  // fail the affixes write — the cron is the only writer for both.
  try {
    const seasonInfo = await fetchCurrentSeasonInfo();
    await writeSeasonConfig(db as never, seasonInfo, () => FieldValue.serverTimestamp());
  } catch (err) {
    console.error('[fetchAndWriteAffixes] season config write failed:', err);
  }

  return doc;
}
```

- [ ] **Step 4: Run all functions tests**

Run: `npm -w packages/functions run test`
Expected: PASS — existing tests + new `writeSeasonConfig` test.

- [ ] **Step 5: Typecheck**

Run: `npm -w packages/functions run typecheck`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add packages/functions/src/fetchWeeklyAffixes.ts packages/functions/tests/fetchWeeklyAffixes.test.ts
git commit -m "feat(functions): write config/season from weekly cron"
```

---

## Task 8: Bot Firebase service methods

Add `getSeasonConfig`, `getSeasonPairs`, `saveSeasonPairs` to `IFirebaseService` and `FirebaseService`. Tested via existing `firebaseService.test.ts` patterns.

**Files:**
- Modify: `packages/bot/src/core/firebaseService.ts`
- Modify: `packages/bot/tests/firebaseService.test.ts`

- [ ] **Step 1: Read the existing test file**

Read `packages/bot/tests/firebaseService.test.ts` and find the existing `getGroupHistory`/`saveGroupHistory` tests (around line 360). Use them as the pattern: same mock setup, same shape.

- [ ] **Step 2: Write the failing tests**

Append to `packages/bot/tests/firebaseService.test.ts` inside the existing `describe('FirebaseService.getGroupHistory'...)` outer block (or in a new top-level describe). Use the same mock factory the existing tests use:

```typescript
describe('FirebaseService.getSeasonConfig', () => {
  it('returns null when config/season does not exist', async () => {
    const docMock = createDocMock({ exists: false });
    const dbMock = { doc: () => docMock } as unknown as Parameters<FirebaseService['_setDb']>[0];
    const svc = new FirebaseService();
    svc._setDb(dbMock);

    expect(await svc.getSeasonConfig()).toBeNull();
  });

  it('returns the slug and blizzardSeasonId', async () => {
    const docMock = createDocMock({
      exists: true,
      data: () => ({
        slug: 'season-mn-1',
        blizzardSeasonId: 17,
        expansionId: 11,
      }),
    });
    const dbMock = { doc: () => docMock } as unknown as Parameters<FirebaseService['_setDb']>[0];
    const svc = new FirebaseService();
    svc._setDb(dbMock);

    expect(await svc.getSeasonConfig()).toEqual({
      slug: 'season-mn-1',
      blizzardSeasonId: 17,
      expansionId: 11,
    });
  });
});

describe('FirebaseService.getSeasonPairs', () => {
  it('returns null when guild has no seasonPairs field', async () => {
    const docMock = createDocMock({
      exists: true,
      data: () => ({ guildId: '123' }),
    });
    const dbMock = { doc: () => docMock } as unknown as Parameters<FirebaseService['_setDb']>[0];
    const svc = new FirebaseService();
    svc._setDb(dbMock);

    expect(await svc.getSeasonPairs('123')).toBeNull();
  });

  it('returns seasonSlug and counts', async () => {
    const docMock = createDocMock({
      exists: true,
      data: () => ({
        seasonPairs: {
          seasonSlug: 'season-mn-1',
          counts: { 'Alice|Bob': 3 },
        },
      }),
    });
    const dbMock = { doc: () => docMock } as unknown as Parameters<FirebaseService['_setDb']>[0];
    const svc = new FirebaseService();
    svc._setDb(dbMock);

    expect(await svc.getSeasonPairs('123')).toEqual({
      seasonSlug: 'season-mn-1',
      counts: { 'Alice|Bob': 3 },
    });
  });
});

describe('FirebaseService.saveSeasonPairs', () => {
  it('upserts seasonPairs onto the guild doc with merge', async () => {
    const setMock = vi.fn().mockResolvedValue(undefined);
    const docMock = createDocMock({}, { set: setMock });
    const dbMock = { doc: () => docMock } as unknown as Parameters<FirebaseService['_setDb']>[0];
    const svc = new FirebaseService();
    svc._setDb(dbMock);

    await svc.saveSeasonPairs('123', { seasonSlug: 'season-mn-1', counts: { 'A|B': 2 } });

    expect(setMock).toHaveBeenCalledWith(
      { seasonPairs: { seasonSlug: 'season-mn-1', counts: { 'A|B': 2 } } },
      { merge: true },
    );
  });
});
```

> If the existing test file uses different mock helpers, mirror them rather than `createDocMock`. The point is one test per public method, asserting Firestore reads/writes hit the right paths.

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm -w packages/bot run test -- firebaseService`
Expected: FAIL — `getSeasonConfig`/`getSeasonPairs`/`saveSeasonPairs` not defined.

- [ ] **Step 4: Add to interface**

In `packages/bot/src/core/firebaseService.ts`, find the `IFirebaseService` interface and add the three method signatures alongside `getGroupHistory`/`saveGroupHistory`:

```typescript
  getSeasonConfig(): Promise<{ slug: string; blizzardSeasonId: number; expansionId: number } | null>;
  getSeasonPairs(guildId: string): Promise<{ seasonSlug: string; counts: Record<string, number> } | null>;
  saveSeasonPairs(guildId: string, pairs: { seasonSlug: string; counts: Record<string, number> }): Promise<void>;
```

- [ ] **Step 5: Implement on the class**

In the `FirebaseService` class in the same file, add:

```typescript
async getSeasonConfig(): Promise<{ slug: string; blizzardSeasonId: number; expansionId: number } | null> {
  if (!this.db) return null;
  const snap = await this.db.collection('config').doc('season').get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  if (typeof data.slug !== 'string' || typeof data.blizzardSeasonId !== 'number' || typeof data.expansionId !== 'number') {
    return null;
  }
  return {
    slug: data.slug as string,
    blizzardSeasonId: data.blizzardSeasonId as number,
    expansionId: data.expansionId as number,
  };
}

async getSeasonPairs(guildId: string): Promise<{ seasonSlug: string; counts: Record<string, number> } | null> {
  if (!this.db) return null;
  const snap = await this.db.collection('guilds').doc(guildId).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  const sp = data.seasonPairs as { seasonSlug?: unknown; counts?: unknown } | undefined;
  if (!sp || typeof sp.seasonSlug !== 'string' || typeof sp.counts !== 'object' || sp.counts === null) {
    return null;
  }
  return {
    seasonSlug: sp.seasonSlug as string,
    counts: sp.counts as Record<string, number>,
  };
}

async saveSeasonPairs(
  guildId: string,
  pairs: { seasonSlug: string; counts: Record<string, number> },
): Promise<void> {
  if (!this.db) return;
  await this.db.collection('guilds').doc(guildId).set({ seasonPairs: pairs }, { merge: true });
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm -w packages/bot run test -- firebaseService`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/bot/src/core/firebaseService.ts packages/bot/tests/firebaseService.test.ts
git commit -m "feat(bot): firebase methods for seasonConfig and seasonPairs"
```

---

## Task 9: Bot — bump season pairs after spin (skip debug)

Hook into `_saveGroupHistory` so season pairs get bumped right after rounds are persisted. Skip when the spin was a `/wheel debug:true` spin.

**Files:**
- Modify: `packages/bot/src/services/groupService.ts`
- Modify: `packages/bot/tests/groupService.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/bot/tests/groupService.test.ts`:

```typescript
import { bumpPairCounts } from '@mythicplus/shared';

describe('GroupService season pair bumping', () => {
  it('bumps season pairs on real spin', async () => {
    // Set up a FirebaseService mock with getSeasonConfig + getSeasonPairs +
    // saveSeasonPairs. Use the existing test pattern.
    const config = { slug: 'season-mn-1', blizzardSeasonId: 17, expansionId: 11 };
    const existingPairs = { seasonSlug: 'season-mn-1', counts: { 'Alice|Bob': 1 } };
    const saveSeasonPairs = vi.fn().mockResolvedValue(undefined);
    const firebase = makeFirebaseMock({
      getSeasonConfig: async () => config,
      getSeasonPairs: async () => existingPairs,
      saveSeasonPairs,
      // ... include groupHistory mocks the existing tests already use
    });

    const svc = new GroupService();
    const ctx = makeCtx(/* 5 players that form one group */);
    await svc.getGroupsData(ctx, /* debug */ false);

    expect(saveSeasonPairs).toHaveBeenCalled();
    const [, savedPairs] = saveSeasonPairs.mock.calls[0];
    expect(savedPairs.seasonSlug).toBe('season-mn-1');
    // Existing Alice|Bob bumped from 1 → 2 (assuming both in the new group).
    // Adjust assertions to match the players in your makeCtx fixture.
  });

  it('skips bump when spin is debug=true', async () => {
    const saveSeasonPairs = vi.fn().mockResolvedValue(undefined);
    const firebase = makeFirebaseMock({
      getSeasonConfig: async () => ({ slug: 'season-mn-1', blizzardSeasonId: 17, expansionId: 11 }),
      getSeasonPairs: async () => null,
      saveSeasonPairs,
    });

    const svc = new GroupService();
    const ctx = makeCtx();
    await svc.getGroupsData(ctx, /* debug */ true);

    expect(saveSeasonPairs).not.toHaveBeenCalled();
  });

  it('resets counts when seasonSlug differs from current config slug', async () => {
    const saveSeasonPairs = vi.fn().mockResolvedValue(undefined);
    const firebase = makeFirebaseMock({
      getSeasonConfig: async () => ({ slug: 'season-mn-2', blizzardSeasonId: 18, expansionId: 11 }),
      getSeasonPairs: async () => ({ seasonSlug: 'season-mn-1', counts: { 'Old|Pair': 99 } }),
      saveSeasonPairs,
    });

    const svc = new GroupService();
    const ctx = makeCtx();
    await svc.getGroupsData(ctx, false);

    const [, savedPairs] = saveSeasonPairs.mock.calls[0];
    expect(savedPairs.seasonSlug).toBe('season-mn-2');
    // 'Old|Pair' is gone — counts started fresh and were bumped only by the new round.
    expect(savedPairs.counts['Old|Pair']).toBeUndefined();
  });
});
```

> Use the existing `groupService.test.ts` mocks/fixtures rather than inventing new ones. Adapt assertions to fit those fixtures.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm -w packages/bot run test -- groupService`
Expected: FAIL.

- [ ] **Step 3: Implement bump in `_saveGroupHistory`**

In `packages/bot/src/services/groupService.ts`, change the import line at the top:

```typescript
import {
  WoWGroup,
  WoWPlayer,
  createMythicPlusGroups,
  setGroupHistory,
  todayPST,
  bumpPairCounts,
} from '@mythicplus/shared';
```

Then in `_saveGroupHistory`, after the existing `saveGroupHistory` call, add the season-pair logic. The full updated function:

```typescript
private async _saveGroupHistory(
  firebase: FirebaseService,
  guildId: string,
  groups: WoWGroup[],
  debug: boolean,
): Promise<void> {
  if (!firebase.isAvailable()) return;

  try {
    const existingRounds = this.loadedRounds.get(guildId) ?? [];
    const newRound = groups.map((g) => g.toDict() as Record<string, unknown>);
    const today = todayPST();
    await firebase.saveGroupHistory(guildId, {
      date: today,
      rounds: [...existingRounds, newRound],
    });

    if (!debug) {
      await this._bumpSeasonPairs(firebase, guildId, groups);
    }
  } catch (err) {
    logger.warn(`Failed to save group history for guild ${guildId}: ${err}`);
  } finally {
    this.loadedRounds.delete(guildId);
  }
}

/** Increment season pair counts; lazy-reset on slug change. */
private async _bumpSeasonPairs(
  firebase: FirebaseService,
  guildId: string,
  groups: WoWGroup[],
): Promise<void> {
  const config = await firebase.getSeasonConfig();
  if (!config) return;  // No season config yet — wait for the weekly cron.
  const existing = await firebase.getSeasonPairs(guildId);
  const baseCounts = (existing && existing.seasonSlug === config.slug)
    ? existing.counts
    : {};
  const counts = bumpPairCounts(baseCounts, groups);
  await firebase.saveSeasonPairs(guildId, { seasonSlug: config.slug, counts });
}
```

- [ ] **Step 4: Update the `_saveGroupHistory` caller**

Find the caller of `_saveGroupHistory` in `getGroupsData` (or wherever) and pass the `debug` flag through. Search for `_saveGroupHistory(` to find call sites.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm -w packages/bot run test -- groupService`
Expected: PASS.

- [ ] **Step 6: Run full bot test suite**

Run: `./scripts/verify-ts.sh`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add packages/bot/src/services/groupService.ts packages/bot/tests/groupService.test.ts
git commit -m "feat(bot): bump seasonPairs after spin, skip on debug"
```

---

## Task 10: Activity store — add `seasonConfig` and `seasonPairs`

**Files:**
- Modify: `activity/src/store/types.ts`
- Modify: `activity/src/store/store.ts`
- Modify: `activity/src/types.ts`

- [ ] **Step 1: Add types to `activity/src/types.ts`**

Append to `activity/src/types.ts` (use existing types as templates):

```typescript
export interface SeasonConfig {
  slug: string;
  blizzardSeasonId: number;
  expansionId: number;
}

export interface SeasonPairs {
  seasonSlug: string;
  counts: Record<string, number>;
}
```

- [ ] **Step 2: Add to AppState**

In `activity/src/store/types.ts`, change the `ViewName` union to include `'connections'`:

```typescript
export type ViewName = 'home' | 'channels' | 'identity' | 'setup' | 'lobby' | 'wheels' | 'results' | 'connections';
```

Add the imports and state slots. Inside `AppState`, after the existing session block:

```typescript
// Imports at top of file:
import { WoWGroup, WheelEntry, GuildData, ChannelData, WoWPlayer, SeasonConfig, SeasonPairs } from '../types';

// In AppState interface, after `guildDocCreationInFlight`:
seasonConfig: SeasonConfig | null;
seasonPairs: SeasonPairs | null;

// In actions section:
setSeasonConfig: (config: SeasonConfig | null) => void;
setSeasonPairs: (pairs: SeasonPairs | null) => void;
```

- [ ] **Step 3: Implement actions in `activity/src/store/store.ts`**

In `activity/src/store/store.ts`:

```typescript
// In the initial state object, after `guildDocCreationInFlight: false,`:
seasonConfig: null,
seasonPairs: null,

// In the actions returned by the create() factory, alongside other setters:
setSeasonConfig: (config) => set({ seasonConfig: config }),
setSeasonPairs: (pairs) => set({ seasonPairs: pairs }),

// In resetSession:
seasonConfig: null,
seasonPairs: null,
```

- [ ] **Step 4: Typecheck**

Run: `cd activity && npm run typecheck`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add activity/src/types.ts activity/src/store/types.ts activity/src/store/store.ts
git commit -m "feat(activity): seasonConfig + seasonPairs in store"
```

---

## Task 11: Activity firestore service — bump season pairs in requestSpin

Mirror the bot logic: read `config/season`, read guild's `seasonPairs`, bump (with reset on slug mismatch), write back. Skip when `channelData.isDebug`.

**Files:**
- Modify: `activity/src/services/firestoreService.ts`
- Modify: `activity/src/services/types.ts` (interface — if applicable)

- [ ] **Step 1: Locate `requestSpin`**

Search `activity/src/services/firestoreService.ts` for `async requestSpin(` (around line 200).

- [ ] **Step 2: Add subscription helper for season config**

At an appropriate location in `firestoreService.ts` (alongside the other subscribe methods), add:

```typescript
subscribeToSeasonConfig(): () => void {
  const ref = doc(db, 'config', 'season');
  const unsub = onSnapshot(ref, (snap) => {
    if (!snap.exists()) {
      useAppStore.getState().setSeasonConfig(null);
      return;
    }
    const data = snap.data() as Record<string, unknown>;
    if (typeof data.slug === 'string' && typeof data.blizzardSeasonId === 'number' && typeof data.expansionId === 'number') {
      useAppStore.getState().setSeasonConfig({
        slug: data.slug,
        blizzardSeasonId: data.blizzardSeasonId,
        expansionId: data.expansionId,
      });
    }
  }, (err) => reportError(err, { tag: 'firestoreService.seasonConfig' }));
  return () => unsub();
}
```

(Adjust the `doc`/`onSnapshot` import names to match what the file already imports from `firebase/firestore`.)

- [ ] **Step 3: Wire `seasonPairs` subscription on the guild doc**

The existing `subscribeToGuild` already mirrors `guildData` to the store. Update its `setGuildData` callback so it also extracts `seasonPairs`:

```typescript
// In subscribeToGuild's onSnapshot callback, where it calls setGuildData:
r.setGuildData(a.data());
const sp = (a.data() as Record<string, unknown>).seasonPairs as
  | { seasonSlug?: unknown; counts?: unknown }
  | undefined;
if (sp && typeof sp.seasonSlug === 'string' && typeof sp.counts === 'object' && sp.counts !== null) {
  r.setSeasonPairs({ seasonSlug: sp.seasonSlug, counts: sp.counts as Record<string, number> });
} else {
  r.setSeasonPairs(null);
}
```

- [ ] **Step 4: Bump in `requestSpin`**

In `requestSpin`, after the existing `setDoc(guildDocRef, { groupHistory: ... })` block, add the season-pair bump:

```typescript
import { bumpPairCounts } from '@mythicplus/shared';

// Inside requestSpin, after the existing groupHistory persistence:
if (guildId && !(channelData.isDebug ?? false)) {
  const cfg = useAppStore.getState().seasonConfig;
  if (cfg) {
    const existing = useAppStore.getState().seasonPairs;
    const baseCounts = (existing && existing.seasonSlug === cfg.slug)
      ? existing.counts
      : {};
    const newCounts = bumpPairCounts(baseCounts, groups);
    setDoc(guildDocRef, {
      seasonPairs: { seasonSlug: cfg.slug, counts: newCounts },
    }, { merge: true }).catch((err) =>
      reportError(err, { tag: 'firestoreService.saveSeasonPairs' })
    );
  }
}
```

- [ ] **Step 5: Subscribe to season config on app boot**

Find where `subscribeToGuild` is called (likely in App.tsx or a top-level hook). Add a sibling call to `subscribeToSeasonConfig()` so the store stays current.

- [ ] **Step 6: Typecheck and build**

Run: `cd activity && npm run typecheck && npm run build`
Expected: exits 0 for both.

- [ ] **Step 7: Commit**

```bash
git add activity/src/services/firestoreService.ts
git commit -m "feat(activity): bump seasonPairs in requestSpin, skip isDebug"
```

---

## Task 12: Add `'connections'` to routing

**Files:**
- Modify: `activity/src/lib/routing.ts`

- [ ] **Step 1: Read current routing file**

Read `activity/src/lib/routing.ts`. The mapping logic should be one switch each in `routeToView` and `viewToRoute`.

- [ ] **Step 2: Add the new view**

Add `connections` to both maps. For the URL hash, use `#connections` (or follow the existing pattern, e.g., `#g/<guildId>/connections`).

```typescript
// In viewToRoute, add a case:
case 'connections': return guildId ? `#g/${guildId}/connections` : '#connections';

// In routeToView, add a parsing branch matching the same shape.
```

- [ ] **Step 3: Typecheck**

Run: `cd activity && npm run typecheck`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add activity/src/lib/routing.ts
git commit -m "feat(activity): route mapping for ConnectionsView"
```

---

## Task 13: Relayout HeaderBar — commit hash next to icon, slot for avatar

Move the commit hash from the right side to right of the wheelson icon. Add a new `<div className="header-bar__avatar-slot">` on the right side that the avatar component will render into.

**Files:**
- Modify: `activity/src/components/HeaderBar.tsx`
- Modify: `activity/src/index.css` (header-bar styles)

- [ ] **Step 1: Update HeaderBar.tsx**

Replace the `header-bar` JSX in `activity/src/components/HeaderBar.tsx`:

```tsx
import type { ReactNode } from 'react';
import { IconButton } from './ui';
import { AffixBar } from './AffixBar';
import wheelsonIcon from '../img/wheelson.png';

const BackArrow = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
  </svg>
);

interface HeaderBarProps {
  title: string;
  subtitle?: string;
  subtitleId?: string;
  onBack?: () => void;
  onTitleClick?: () => void;
  titleColor?: string;
  /** Extra content rendered after the title area */
  extra?: ReactNode;
  /** Right-anchored avatar / profile button */
  avatar?: ReactNode;
  className?: string;
}

export function HeaderBar({
  title,
  subtitle,
  subtitleId,
  onBack,
  onTitleClick,
  titleColor,
  extra,
  avatar,
  className = '',
}: HeaderBarProps) {
  return (<>
    <header className={`header-bar ${className}`}>
      {onBack ? (
        <IconButton
          icon={<BackArrow />}
          label="Go back"
          className="header-bar__back"
          onClick={onBack}
        />
      ) : (
        <div className="header-bar__back-spacer" />
      )}

      <img
        src={wheelsonIcon}
        alt="Wheelson logo"
        className="header-bar__icon"
        onClick={onTitleClick}
        style={{ cursor: onTitleClick ? 'pointer' : undefined }}
      />

      <a
        className="header-bar__hash"
        target="_blank"
        rel="noopener noreferrer"
        href={`https://github.com/TytaniumDev/MythicPlusDiscordBot/commit/${__COMMIT_HASH__}`}
        aria-label={`View commit ${__COMMIT_HASH__} on GitHub`}
      >
        {__COMMIT_HASH__}
      </a>

      <div className="header-bar__center">
        <div
          className="header-bar__title"
          style={titleColor ? { color: titleColor } : undefined}
        >
          {title}
        </div>
        {subtitle && (
          <div id={subtitleId} className="header-bar__subtitle">{subtitle}</div>
        )}
      </div>

      <div className="header-bar__right">
        {extra}
        {avatar}
      </div>
    </header>
    <AffixBar />
  </>
  );
}
```

- [ ] **Step 2: Adjust CSS as needed**

Open `activity/src/index.css`, search for `.header-bar__hash`. The selector probably has `margin-left: auto` or right-anchor positioning that needs to be removed since the hash is no longer on the right edge. Adjust spacing so the hash sits next to the icon visually.

> Concrete change depends on what's in the existing CSS. After the edit, the hash should be left-of-center and not crowd the icon.

- [ ] **Step 3: Build to confirm**

Run: `cd activity && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add activity/src/components/HeaderBar.tsx activity/src/index.css
git commit -m "feat(activity): relayout header — commit hash next to icon, avatar slot on right"
```

---

## Task 14: `ProfileAvatar` component

Small clickable button rendering the current user's character avatar (via `mediaUrl` from their player record). Falls back to a first-letter circle when there's no linked character or no current player.

**Files:**
- Create: `activity/src/components/ProfileAvatar.tsx`
- Create: `activity/src/components/ProfileAvatar.stories.tsx`

- [ ] **Step 1: Implement the component**

Create `activity/src/components/ProfileAvatar.tsx`:

```tsx
import { toAvatarUrl } from '../lib/characterMedia';
import { remapImageUrl } from '../discordSdk';
import { getClassColor } from '../lib/classColors';
import { useAppStore } from '../store/store';

interface ProfileAvatarProps {
  onClick: () => void;
}

export function ProfileAvatar({ onClick }: ProfileAvatarProps) {
  const currentPlayerId = useAppStore((s) => s.currentPlayerId);
  const currentPlayerName = useAppStore((s) => s.currentPlayerName);
  const channelData = useAppStore((s) => s.channelData);

  const player = currentPlayerId && channelData
    ? channelData.players.find((p) => p.discordId === currentPlayerId)
    : null;

  const avatarUrl = toAvatarUrl(player?.mediaUrl ?? null);
  const proxied = remapImageUrl(avatarUrl ?? undefined);
  const ringColor = getClassColor(player?.characterClass) ?? '#888';
  const initial = (currentPlayerName ?? '?').charAt(0).toUpperCase();

  const disabled = !currentPlayerId;

  return (
    <button
      type="button"
      className="profile-avatar"
      onClick={onClick}
      disabled={disabled}
      aria-label={disabled ? 'Profile (sign in to view)' : `Profile of ${currentPlayerName}`}
      style={{ '--avatar-ring': ringColor } as React.CSSProperties}
    >
      {proxied ? (
        <img src={proxied} alt="" className="profile-avatar__img" />
      ) : (
        <span className="profile-avatar__initial">{initial}</span>
      )}
    </button>
  );
}
```

- [ ] **Step 2: Create the Storybook story**

Create `activity/src/components/ProfileAvatar.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { ProfileAvatar } from './ProfileAvatar';
import { useAppStore } from '../store/store';

const meta: Meta<typeof ProfileAvatar> = {
  component: ProfileAvatar,
  parameters: { layout: 'centered' },
};
export default meta;
type Story = StoryObj<typeof ProfileAvatar>;

export const Disabled: Story = {
  decorators: [(Story) => {
    useAppStore.getState().setIdentity(null, null);
    return <Story />;
  }],
  args: { onClick: () => {} },
};

export const WithLinkedCharacter: Story = {
  decorators: [(Story) => {
    useAppStore.getState().setIdentity('discord-123', 'Tytaniormu (Tyler)');
    useAppStore.getState().setChannelData({
      // Minimal mock; reuse an existing helper if available.
      ...(useAppStore.getState().channelData ?? {} as never),
      players: [{
        name: 'Tytaniormu (Tyler)',
        discordId: 'discord-123',
        mainRole: 'ranged',
        offspecs: [],
        utilities: ['lust'],
        mediaUrl: null,
        characterClass: 'mage',
      }],
    } as never);
    return <Story />;
  }],
  args: { onClick: () => {} },
};
```

- [ ] **Step 3: Add CSS for `.profile-avatar`**

Append to `activity/src/index.css`:

```css
.profile-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid var(--avatar-ring, #888);
  background: rgba(0, 0, 0, 0.4);
  cursor: pointer;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  font-weight: 700;
  color: #fff;
}

.profile-avatar:disabled { opacity: 0.5; cursor: not-allowed; }

.profile-avatar__img { width: 100%; height: 100%; object-fit: cover; }
```

- [ ] **Step 4: Verify Storybook builds**

Run: `cd activity && npm run build-storybook`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add activity/src/components/ProfileAvatar.tsx activity/src/components/ProfileAvatar.stories.tsx activity/src/index.css
git commit -m "feat(activity): ProfileAvatar component"
```

---

## Task 15: `ProfileModal` component

Identity-only modal: avatar, in-game name, Discord ID, linked character info, plus a "View Connections →" link that navigates to the new view.

**Files:**
- Create: `activity/src/components/ProfileModal.tsx`
- Create: `activity/src/components/ProfileModal.stories.tsx`

- [ ] **Step 1: Implement the component**

Create `activity/src/components/ProfileModal.tsx`:

```tsx
import { useAppStore } from '../store/store';
import { toAvatarUrl } from '../lib/characterMedia';
import { remapImageUrl } from '../discordSdk';
import { getClassColor } from '../lib/classColors';

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
  onOpenConnections: () => void;
}

export function ProfileModal({ open, onClose, onOpenConnections }: ProfileModalProps) {
  const currentPlayerId = useAppStore((s) => s.currentPlayerId);
  const currentPlayerName = useAppStore((s) => s.currentPlayerName);
  const channelData = useAppStore((s) => s.channelData);

  if (!open) return null;

  const player = currentPlayerId && channelData
    ? channelData.players.find((p) => p.discordId === currentPlayerId)
    : null;

  const avatarUrl = toAvatarUrl(player?.mediaUrl ?? null);
  const proxied = remapImageUrl(avatarUrl ?? undefined);
  const ring = getClassColor(player?.characterClass) ?? '#888';

  return (
    <div className="profile-modal__backdrop" onClick={onClose}>
      <div
        className="profile-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Profile"
      >
        <div className="profile-modal__avatar" style={{ borderColor: ring }}>
          {proxied
            ? <img src={proxied} alt="" />
            : <span>{(currentPlayerName ?? '?').charAt(0).toUpperCase()}</span>}
        </div>
        <div className="profile-modal__name">{currentPlayerName ?? '—'}</div>
        <div className="profile-modal__field">
          <span className="profile-modal__label">Discord ID</span>
          <span className="profile-modal__value">{currentPlayerId ?? '—'}</span>
        </div>
        {player?.inGameName && (
          <div className="profile-modal__field">
            <span className="profile-modal__label">In-game name</span>
            <span className="profile-modal__value">{player.inGameName}</span>
          </div>
        )}
        {player?.characterClass && (
          <div className="profile-modal__field">
            <span className="profile-modal__label">Class</span>
            <span className="profile-modal__value">{player.characterClass}</span>
          </div>
        )}
        <button
          type="button"
          className="profile-modal__connections-link"
          onClick={onOpenConnections}
        >
          View Connections →
        </button>
        <button type="button" className="profile-modal__close" onClick={onClose} aria-label="Close">×</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create stories**

Create `activity/src/components/ProfileModal.stories.tsx` mirroring `ProfileAvatar.stories.tsx` — with mocked store state for "no identity" / "linked character" / "no character class".

- [ ] **Step 3: Append CSS**

Append to `activity/src/index.css`:

```css
.profile-modal__backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center; z-index: 50;
}
.profile-modal {
  background: #1a1a1f; color: #eee; border-radius: 12px;
  padding: 24px; min-width: 280px; max-width: 360px; position: relative;
}
.profile-modal__avatar {
  width: 80px; height: 80px; border-radius: 50%; border: 3px solid;
  margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;
  overflow: hidden; font-size: 28px; font-weight: 700;
}
.profile-modal__avatar img { width: 100%; height: 100%; object-fit: cover; }
.profile-modal__name { text-align: center; font-size: 18px; font-weight: 600; margin-bottom: 12px; }
.profile-modal__field { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
.profile-modal__label { color: #888; }
.profile-modal__value { font-family: monospace; }
.profile-modal__connections-link {
  display: block; width: 100%; margin-top: 16px;
  padding: 10px; border-radius: 6px; background: #3a4a8a; color: #fff; border: 0; cursor: pointer;
}
.profile-modal__close {
  position: absolute; top: 8px; right: 8px;
  width: 28px; height: 28px; border-radius: 50%; background: transparent;
  color: #aaa; border: 0; cursor: pointer; font-size: 20px;
}
```

- [ ] **Step 4: Verify Storybook builds**

Run: `cd activity && npm run build-storybook`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add activity/src/components/ProfileModal.tsx activity/src/components/ProfileModal.stories.tsx activity/src/index.css
git commit -m "feat(activity): ProfileModal component"
```

---

## Task 16: Wire `ProfileAvatar` + `ProfileModal` into HeaderBar consumers

The HeaderBar component takes an `avatar` prop (Task 13). The avatar + modal together form a "header profile slot" that needs local open/close state. Add a small wrapper component and wire it everywhere HeaderBar is used.

**Files:**
- Create: `activity/src/components/HeaderProfileSlot.tsx`
- Modify: every view that renders `<HeaderBar ... />` (search for `<HeaderBar`)

- [ ] **Step 1: Create the wrapper**

Create `activity/src/components/HeaderProfileSlot.tsx`:

```tsx
import { useState } from 'react';
import { ProfileAvatar } from './ProfileAvatar';
import { ProfileModal } from './ProfileModal';
import { useAppStore } from '../store/store';

export function HeaderProfileSlot() {
  const [open, setOpen] = useState(false);
  const setView = useAppStore((s) => s.setView);

  return (
    <>
      <ProfileAvatar onClick={() => setOpen(true)} />
      <ProfileModal
        open={open}
        onClose={() => setOpen(false)}
        onOpenConnections={() => {
          setOpen(false);
          setView('connections');
        }}
      />
    </>
  );
}
```

- [ ] **Step 2: Inject into every HeaderBar usage**

Search for `<HeaderBar` across `activity/src/views/` and `activity/src/components/`. Add `avatar={<HeaderProfileSlot />}` to each one.

```bash
grep -l "<HeaderBar" activity/src/views/*.tsx activity/src/components/*.tsx
```

For each match, add the prop in the JSX.

- [ ] **Step 3: Build to verify**

Run: `cd activity && npm run build`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add activity/src/components/HeaderProfileSlot.tsx activity/src/views/ activity/src/components/
git commit -m "feat(activity): wire ProfileAvatar + ProfileModal into header"
```

---

## Task 17: `ConnectionsView` — affinity table

First section: top-5 teammates for the current player. If no current player or no season counts, render an empty-state.

**Files:**
- Create: `activity/src/views/ConnectionsView.tsx`
- Create: `activity/src/views/ConnectionsView.stories.tsx`

- [ ] **Step 1: Implement the affinity section**

Create `activity/src/views/ConnectionsView.tsx`:

```tsx
import { useAppStore } from '../store/store';
import { topAffinityFor } from '@mythicplus/shared';
import { HeaderBar } from '../components/HeaderBar';
import { HeaderProfileSlot } from '../components/HeaderProfileSlot';

export function ConnectionsView() {
  const currentPlayerName = useAppStore((s) => s.currentPlayerName);
  const seasonPairs = useAppStore((s) => s.seasonPairs);
  const setView = useAppStore((s) => s.setView);

  const counts = seasonPairs?.counts ?? {};
  const topTeammates = currentPlayerName
    ? topAffinityFor(currentPlayerName, counts, 5)
    : [];

  return (
    <div className="connections-view">
      <HeaderBar
        title="Connections"
        onBack={() => setView('lobby')}
        avatar={<HeaderProfileSlot />}
      />
      <main className="connections-view__body">
        <section>
          <h2 className="connections-view__heading">
            {currentPlayerName ? `Your top teammates` : 'Top teammates'}
          </h2>
          {topTeammates.length === 0 ? (
            <div className="connections-view__empty">
              {currentPlayerName
                ? 'No shared groups yet — spin together once first.'
                : 'Sign in to see your teammates.'}
            </div>
          ) : (
            <ol className="connections-view__list">
              {topTeammates.map((row) => (
                <li key={row.teammate}>
                  <span className="connections-view__name">{row.teammate}</span>
                  <span className="connections-view__count">{row.count}×</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Append CSS**

Append minimal styles to `activity/src/index.css`:

```css
.connections-view__body { padding: 16px; max-width: 640px; margin: 0 auto; }
.connections-view__heading { font-size: 18px; margin-bottom: 12px; }
.connections-view__empty { color: #888; font-style: italic; }
.connections-view__list { list-style: none; padding: 0; }
.connections-view__list li {
  display: flex; justify-content: space-between;
  padding: 8px 0; border-bottom: 1px solid #333;
}
.connections-view__count { font-family: monospace; color: #888; }
```

- [ ] **Step 3: Story**

Create `activity/src/views/ConnectionsView.stories.tsx` with a few states: empty, populated, no current player.

- [ ] **Step 4: Build**

Run: `cd activity && npm run build && npm run build-storybook`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add activity/src/views/ConnectionsView.tsx activity/src/views/ConnectionsView.stories.tsx activity/src/index.css
git commit -m "feat(activity): ConnectionsView affinity table"
```

---

## Task 18: `ConnectionsView` — six-degrees connector

Second section. Dropdown picks a target player; on submit, run `shortestPath` and render the chain.

**Files:**
- Modify: `activity/src/views/ConnectionsView.tsx`

- [ ] **Step 1: Add target-picker state and renderer**

In `ConnectionsView.tsx`, add an internal section. Replace the function body:

```tsx
import { useState, useMemo } from 'react';
import { useAppStore } from '../store/store';
import { topAffinityFor, shortestPath } from '@mythicplus/shared';
// ... existing imports

export function ConnectionsView() {
  const currentPlayerName = useAppStore((s) => s.currentPlayerName);
  const seasonPairs = useAppStore((s) => s.seasonPairs);
  const setView = useAppStore((s) => s.setView);

  const counts = seasonPairs?.counts ?? {};
  const topTeammates = currentPlayerName
    ? topAffinityFor(currentPlayerName, counts, 5)
    : [];

  const allNames = useMemo(() => {
    const set = new Set<string>();
    for (const key of Object.keys(counts)) {
      const sep = key.indexOf('|');
      if (sep === -1) continue;
      set.add(key.slice(0, sep));
      set.add(key.slice(sep + 1));
    }
    return [...set].sort();
  }, [counts]);

  const [target, setTarget] = useState<string>('');
  const path = useMemo(() => {
    if (!currentPlayerName || !target) return null;
    return shortestPath(currentPlayerName, target, counts);
  }, [currentPlayerName, target, counts]);

  return (
    <div className="connections-view">
      <HeaderBar
        title="Connections"
        onBack={() => setView('lobby')}
        avatar={<HeaderProfileSlot />}
      />
      <main className="connections-view__body">
        {/* Affinity table from Task 17 */}
        <section>{/* existing block, unchanged */}</section>

        <section className="connections-view__six-degrees">
          <h2 className="connections-view__heading">Six degrees</h2>
          <p className="connections-view__sub">
            Find the shortest pair-history chain to any teammate.
          </p>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="connections-view__select"
          >
            <option value="">Pick a player…</option>
            {allNames.filter((n) => n !== currentPlayerName).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          {target && (
            path
              ? (
                <div className="connections-view__path">
                  {path.map((name, i) => (
                    <span key={i} className="connections-view__node">
                      {name}
                      {i < path.length - 1 && <span className="connections-view__arrow"> → </span>}
                    </span>
                  ))}
                </div>
              )
              : <div className="connections-view__empty">No shared groups yet — spin together once first.</div>
          )}
        </section>
      </main>
    </div>
  );
}
```

(Splice the affinity-table block back where indicated — it should stay above the six-degrees block.)

- [ ] **Step 2: Append minimal CSS**

```css
.connections-view__select {
  display: block; width: 100%; padding: 8px;
  background: #1a1a1f; color: #eee; border: 1px solid #333; border-radius: 6px;
  margin-bottom: 12px;
}
.connections-view__path { padding: 8px 0; }
.connections-view__arrow { color: #888; }
.connections-view__sub { color: #aaa; font-size: 14px; margin-bottom: 8px; }
```

- [ ] **Step 3: Build + storybook**

Run: `cd activity && npm run build && npm run build-storybook`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add activity/src/views/ConnectionsView.tsx activity/src/index.css
git commit -m "feat(activity): six-degrees connector in ConnectionsView"
```

---

## Task 19: `ConnectionsView` — browse players

Third section: list every player that has appeared in any pair-count key, with their top-1 teammate. Clicking a player rebases the affinity table to them (keeps the user on the same view, just with a different "subject").

**Files:**
- Modify: `activity/src/views/ConnectionsView.tsx`

- [ ] **Step 1: Add subject-player state**

Promote the affinity table's "subject player" from `currentPlayerName` to a state variable that defaults to `currentPlayerName` and can be changed by clicking a row.

```tsx
const [subject, setSubject] = useState<string | null>(currentPlayerName);
useEffect(() => {
  setSubject(currentPlayerName);
}, [currentPlayerName]);

const topTeammates = subject
  ? topAffinityFor(subject, counts, 5)
  : [];
```

Replace `currentPlayerName` with `subject` in the affinity-table heading and the `topAffinityFor` call.

- [ ] **Step 2: Render the browse section**

Below six-degrees:

```tsx
<section>
  <h2 className="connections-view__heading">All players</h2>
  <ul className="connections-view__list">
    {allNames.map((name) => {
      const top1 = topAffinityFor(name, counts, 1)[0];
      return (
        <li key={name}>
          <button
            type="button"
            className="connections-view__player-button"
            onClick={() => setSubject(name)}
          >
            <span className="connections-view__name">{name}</span>
            {top1 && <span className="connections-view__count">{top1.teammate} ×{top1.count}</span>}
          </button>
        </li>
      );
    })}
  </ul>
</section>
```

- [ ] **Step 3: Append CSS**

```css
.connections-view__player-button {
  display: flex; justify-content: space-between; align-items: center;
  width: 100%; padding: 8px 0; background: transparent; border: 0;
  color: inherit; cursor: pointer; text-align: left;
}
```

- [ ] **Step 4: Build**

Run: `cd activity && npm run build && npm run build-storybook`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add activity/src/views/ConnectionsView.tsx activity/src/index.css
git commit -m "feat(activity): browse-players section in ConnectionsView"
```

---

## Task 20: Render `ConnectionsView` from App

**Files:**
- Modify: `activity/src/App.tsx`

- [ ] **Step 1: Add the view to App.tsx**

Open `activity/src/App.tsx`. Find the existing view-switching block (`if (currentView === 'home') return <HomeView />;` style or a switch). Add:

```tsx
import { ConnectionsView } from './views/ConnectionsView';

// In the rendering switch:
if (currentView === 'connections') return <ConnectionsView />;
```

- [ ] **Step 2: Build**

Run: `cd activity && npm run build`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add activity/src/App.tsx
git commit -m "feat(activity): render ConnectionsView when currentView === 'connections'"
```

---

## Task 21: Update visual snapshots in Docker

Header layout changed — the existing `visual.spec.ts` snapshot will no longer match. Regenerate from inside Docker.

**Files:**
- Modify: `activity/tests/__screenshots__/` (auto-regenerated)

- [ ] **Step 1: Regenerate snapshots**

Run: `./scripts/playwright-docker.sh --update-snapshots`
Expected: exits 0; updated PNGs in `activity/tests/__screenshots__/`.

- [ ] **Step 2: Confirm the diffs are intentional**

Run: `git status activity/tests/__screenshots__/`
Visually inspect a couple of changed files to confirm the new header layout is what you expect (commit hash next to icon, avatar on right).

- [ ] **Step 3: Commit**

```bash
git add activity/tests/__screenshots__/
git commit -m "test(activity): update snapshots for header layout change"
```

---

## Task 22: Final verification + open PR

**Files:** None (verification only)

- [ ] **Step 1: Run full backend verify**

Run: `./scripts/verify-ts.sh`
Expected: "All checks passed".

- [ ] **Step 2: Run full activity verify**

Run: `./scripts/verify-activity.sh`
Expected: typecheck + build + Storybook + Playwright all green.

- [ ] **Step 3: Push branch**

```bash
git push -u origin feat/issue-513-season-pair-tracker
```

- [ ] **Step 4: Open PR**

Use `gh pr create` with a thorough description that:
- Summarizes the data model + cron + UI changes
- Calls out the `expansion_id=11` constant as a known follow-up
- Lists the test plan (unit, Storybook, Playwright snapshots)
- Notes the Lua sibling does NOT need any change for this PR (it doesn't track season data)

```bash
gh pr create --title "feat: season pair tracker (#513)" --body "$(cat <<'EOF'
## Summary
- Track per-guild season pair counts in Firestore (`guilds/{guildId}.seasonPairs`).
- Auto-detect season change via raider.io static-data, written to `config/season` by the existing weekly affixes cron. Hardcoded `expansion_id=11` for v1.
- Skip bumps from debug/test data (bot `debug=true` and Activity `isDebug` channels).
- Activity gains a profile avatar in the header (commit hash moved next to the wheelson icon to make room) that opens a small identity modal, plus a new `ConnectionsView` reachable from the modal.
- Three sections in `ConnectionsView`: top-5 teammates affinity table, six-degrees connector, all-players browse list.

Closes #513.

## Known follow-up
- `EXPANSION_ID = 11` is hardcoded in `packages/functions/src/fetchCurrentSeason.ts`. When the next expansion ships, bump it. The cron logs a clear error message when it returns no seasons.

## Test plan
- [x] `./scripts/verify-ts.sh` — lint + typecheck + 290+ tests
- [x] `./scripts/verify-activity.sh` — typecheck + Vite build + Storybook + Playwright (Docker)
- [x] Snapshots updated in `activity/tests/__screenshots__/` to reflect the header layout change
- [ ] Manually verify after deploy: trigger `refreshAffixes` to populate `config/season`, then run a `/wheel` and confirm the guild's `seasonPairs` document is written

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: Verify PR URL is reachable**

The command's output will be the new PR URL. Open it (or paste it into the chat) so the user can review.

---

## Self-Review Notes

The plan above covers every spec section:
- **Auto-detect expansion** → Tasks 6, 7
- **Per-guild seasonPairs** → Tasks 8, 9, 11
- **Skip debug data** → Tasks 9 (bot debug=true) + 11 (Activity isDebug)
- **Compute helpers** → Tasks 2, 3, 4
- **Header bar relayout** → Task 13
- **Profile avatar + modal** → Tasks 14, 15, 16
- **Connections view (3 sections)** → Tasks 17, 18, 19
- **Routing** → Tasks 12, 20
- **Snapshot maintenance** → Task 21

Tests cover the testable surfaces: pure helpers (Tasks 2–4), Cloud Function helpers (Tasks 6–7), Firebase service methods (Task 8), bot bump flow (Task 9). UI components rely on Storybook + Playwright visual snapshots rather than DOM-shape tests, which matches the existing `activity/` test posture.

No "TBD" / "see later" placeholders. Type/method names are consistent: `bumpPairCounts`, `topAffinityFor`, `shortestPath`, `getSeasonConfig`, `getSeasonPairs`, `saveSeasonPairs`, `seasonPairs`, `seasonConfig`, `'connections'` view name, `HeaderProfileSlot`, `ProfileAvatar`, `ProfileModal`, `ConnectionsView`. The `pairKey` export wired in Task 1 is the import target for `seasonPairs.ts` in Task 2.
