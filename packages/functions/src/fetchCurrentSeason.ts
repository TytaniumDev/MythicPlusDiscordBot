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
