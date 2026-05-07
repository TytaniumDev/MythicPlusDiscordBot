// Public Raider.io endpoints — same hostname/contract used by `lookupCharacterProfile`.
// CORS is enabled, so we can call directly from the browser.

import type { CharacterDungeonScores, DungeonRunSummary } from '../lib/dungeonScoreTypes';

// Re-export the type contracts so existing consumers that import from this
// module keep working. The canonical home for the types is `lib/dungeonScoreTypes`.
export type { CharacterDungeonScores, DungeonRunSummary } from '../lib/dungeonScoreTypes';

interface RaiderioRun {
  dungeon: string;
  short_name: string;
  mythic_level: number;
  score: number;
  map_challenge_mode_id: number;
  icon_url?: string;
}

interface RaiderioSeasonScore {
  season: string;
  scores?: { all?: number };
  segments?: { all?: { score?: number; color?: string } };
}

interface RaiderioMythicPlusResponse {
  name?: string;
  realm?: string;
  class?: string;
  active_spec_name?: string;
  mythic_plus_best_runs?: RaiderioRun[];
  mythic_plus_alternate_runs?: RaiderioRun[];
  mythic_plus_scores_by_season?: RaiderioSeasonScore[];
}

// `mythic_plus_scores_by_season:current` returns the current main season's
// totals (overall + per-role + per-spec) plus their rarity color.
const RAIDERIO_FIELDS =
  'mythic_plus_best_runs,mythic_plus_alternate_runs,mythic_plus_scores_by_season:current';

export class RaiderioFetchError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'RaiderioFetchError';
  }
}

/**
 * Fetch a character's per-dungeon best Mythic+ scores from Raider.io.
 *
 * - Resolves to a `CharacterDungeonScores` on success.
 * - Resolves to `null` for the "character not found" 4xx case — that's a
 *   per-character data gap, not a service-level failure, so callers
 *   should treat it as "this player has no data" rather than an error.
 * - Throws `RaiderioFetchError` when the request can't be completed
 *   (network failure, 5xx, malformed JSON), so the hook can distinguish
 *   "Raider.io is down" from "this character isn't tracked."
 *
 * Aborts (controller.signal) propagate as the native `AbortError` so
 * callers can ignore them via `signal.aborted`.
 */
export async function fetchCharacterDungeonScores(
  name: string,
  realm: string,
  region: string,
  signal?: AbortSignal,
): Promise<CharacterDungeonScores | null> {
  const url =
    'https://raider.io/api/v1/characters/profile' +
    `?region=${encodeURIComponent(region)}` +
    `&realm=${encodeURIComponent(realm)}` +
    `&name=${encodeURIComponent(name)}` +
    `&fields=${encodeURIComponent(RAIDERIO_FIELDS)}`;

  let response: Response;
  try {
    response = await fetch(url, { signal });
  } catch (err) {
    // AbortError flows through; everything else is a network failure.
    if ((err as { name?: string })?.name === 'AbortError') throw err;
    throw new RaiderioFetchError('Raider.io request failed', err);
  }

  // 4xx is "character not found" / "bad request" — return null so callers
  // can treat individual gaps as missing data, not service failure. 5xx
  // and other non-OK responses are service failures.
  if (response.status >= 400 && response.status < 500) return null;
  if (!response.ok) {
    throw new RaiderioFetchError(`Raider.io returned status ${response.status}`);
  }

  let data: RaiderioMythicPlusResponse;
  try {
    data = (await response.json()) as RaiderioMythicPlusResponse;
  } catch (err) {
    throw new RaiderioFetchError('Raider.io returned malformed JSON', err);
  }

  const byDungeon: Record<number, DungeonRunSummary> = {};
  const allRuns = [
    ...(data.mythic_plus_best_runs ?? []),
    ...(data.mythic_plus_alternate_runs ?? []),
  ];

  for (const run of allRuns) {
    if (!run || typeof run.map_challenge_mode_id !== 'number') continue;
    const id = run.map_challenge_mode_id;
    const summary: DungeonRunSummary = {
      challengeModeId: id,
      name: run.dungeon ?? '',
      shortName: run.short_name ?? '',
      level: run.mythic_level ?? 0,
      score: run.score ?? 0,
      iconUrl: run.icon_url ?? null,
    };
    const existing = byDungeon[id];
    // Keep the highest scoring entry per dungeon (best vs. alternate-affix run).
    if (!existing || summary.score > existing.score) {
      byDungeon[id] = summary;
    }
  }

  // `:current` filter returns a single-element array (the current main season)
  // when the character has any season activity. Defensive: treat missing as null.
  const seasonEntry = data.mythic_plus_scores_by_season?.[0];
  const overallScore = seasonEntry?.scores?.all ?? null;
  const scoreColor = seasonEntry?.segments?.all?.color ?? null;

  return {
    name: data.name ?? name,
    realm: data.realm ?? realm,
    region,
    byDungeon,
    overallScore: typeof overallScore === 'number' ? overallScore : null,
    scoreColor: typeof scoreColor === 'string' ? scoreColor : null,
    className: typeof data.class === 'string' ? data.class : null,
    specName: typeof data.active_spec_name === 'string' ? data.active_spec_name : null,
  };
}
