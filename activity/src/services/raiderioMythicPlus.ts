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
  /** Dungeon icon URL from Raider.io's CDN, or null when missing. */
  iconUrl: string | null;
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
  icon_url?: string;
}

interface RaiderioMythicPlusResponse {
  name?: string;
  realm?: string;
  mythic_plus_best_runs?: RaiderioRun[];
  mythic_plus_alternate_runs?: RaiderioRun[];
}

const RAIDERIO_FIELDS = 'mythic_plus_best_runs,mythic_plus_alternate_runs';

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

  return {
    name: data.name ?? name,
    realm: data.realm ?? realm,
    region,
    byDungeon,
  };
}
