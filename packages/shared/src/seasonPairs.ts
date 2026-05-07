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
