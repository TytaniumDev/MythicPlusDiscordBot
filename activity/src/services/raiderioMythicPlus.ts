// Public Raider.io endpoints — same hostname/contract used by `lookupCharacterProfile`.
// CORS is enabled, so we can call directly from the browser.

export interface DungeonRunSummary {
  /** Stable identifier (challenge_mode_id) for matching across runs and seasons. */
  challengeModeId: number;
  /** Display name (e.g. "Operation: Floodgate"). */
  name: string;
  /** Short tag (e.g. "FLOOD"). */
  shortName: string;
  /** Best key level the character has timed/run for this dungeon, or 0. */
  level: number;
  /** Raider.io score for the best run, or 0. */
  score: number;
}

export interface CharacterDungeonScores {
  name: string;
  realm: string;
  region: string;
  /** Best run per dungeon, keyed by challenge_mode_id. */
  byDungeon: Record<number, DungeonRunSummary>;
}

interface RaiderioRun {
  dungeon: string;
  short_name: string;
  mythic_level: number;
  score: number;
  map_challenge_mode_id: number;
}

interface RaiderioMythicPlusResponse {
  name?: string;
  realm?: string;
  mythic_plus_best_runs?: RaiderioRun[];
  mythic_plus_alternate_runs?: RaiderioRun[];
}

const RAIDERIO_FIELDS = 'mythic_plus_best_runs,mythic_plus_alternate_runs';

/**
 * Fetch a character's per-dungeon best Mythic+ scores from Raider.io.
 * Returns null if the character is unknown or the request failed.
 */
export async function fetchCharacterDungeonScores(
  name: string,
  realm: string,
  region: string,
  signal?: AbortSignal,
): Promise<CharacterDungeonScores | null> {
  try {
    const url =
      'https://raider.io/api/v1/characters/profile' +
      `?region=${encodeURIComponent(region)}` +
      `&realm=${encodeURIComponent(realm)}` +
      `&name=${encodeURIComponent(name)}` +
      `&fields=${encodeURIComponent(RAIDERIO_FIELDS)}`;

    const response = await fetch(url, { signal });
    if (!response.ok) return null;

    const data = (await response.json()) as RaiderioMythicPlusResponse;
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
      };
      const existing = byDungeon[id];
      // Keep the highest scoring entry per dungeon (best vs. alternate-affix run).
      if (!existing || summary.score > existing.score) {
        byDungeon[id] = summary;
      }
    }

    return {
      name: data.name ?? name,
      realm: data.realm ?? realm,
      region,
      byDungeon,
    };
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') return null;
    console.warn('[Wheelson] Raider.io M+ scores lookup failed:', err);
    return null;
  }
}
