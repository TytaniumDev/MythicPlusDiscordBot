import { WoWGroup } from './models.js';

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
 * Validate an unknown value against the {@link SeasonPairs} shape. Returns the
 * narrowed object when valid (string `seasonSlug`, non-null object `counts`)
 * and `null` otherwise. The bot and frontend both run this on raw Firestore
 * values, so they must not drift on what "valid" means.
 */
export function parseSeasonPairs(raw: unknown): SeasonPairs | null {
  if (!raw || typeof raw !== 'object') return null;
  const sp = raw as { seasonSlug?: unknown; counts?: unknown };
  if (typeof sp.seasonSlug !== 'string') return null;
  if (typeof sp.counts !== 'object' || sp.counts === null) return null;
  return { seasonSlug: sp.seasonSlug, counts: sp.counts as Record<string, number> };
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
    // ⚡ Bolt Opt: Avoid allocating a new array via group.players getter on every call
    const players = [];
    if (group.tank) players.push(group.tank.name);
    if (group.healer) players.push(group.healer.name);
    for (let d = 0; d < group.dps.length; d++) players.push(group.dps[d].name);

    if (players.length < 2) continue;
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const a = players[i];
        const b = players[j];
        const key = a < b ? a + '|' + b : b + '|' + a;
        next[key] = (next[key] ?? 0) + 1;
      }
    }
  }
  return next;
}

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
    let aEdges = adj.get(a);
    if (!aEdges) {
      aEdges = new Map();
      adj.set(a, aEdges);
    }
    let bEdges = adj.get(b);
    if (!bEdges) {
      bEdges = new Map();
      adj.set(b, bEdges);
    }
    aEdges.set(b, count);
    bEdges.set(a, count);
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

    const neighbors = adj.get(current);
    if (!neighbors) continue;
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
