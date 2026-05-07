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
