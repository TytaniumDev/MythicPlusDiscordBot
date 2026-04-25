import type { CharacterDungeonScores, DungeonRunSummary } from '../services/raiderioMythicPlus';

export type DungeonSuggestionsStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

export interface DungeonSuggestionsState {
  status: DungeonSuggestionsStatus;
  ranking: DungeonSuggestion[];
  /** Number of players we successfully fetched scores for. */
  characterCount: number;
  /** Number of players whose `inGameName` parsed to a usable lookup target. */
  lookupTargetCount: number;
}

export interface DungeonSuggestion {
  challengeModeId: number;
  name: string;
  shortName: string;
  /** Dungeon icon URL (from any character's run for this dungeon), or null. */
  iconUrl: string | null;
  /** Sum of each player's best score for this dungeon (0 when a player has no run). */
  totalScore: number;
  /** Players who have at least one timed/recorded run for this dungeon. */
  playersWithRuns: number;
  /** Average key level across players who have a run, rounded to 1 decimal. */
  avgLevel: number | null;
}

/**
 * Aggregate per-character dungeon scores into a group-level ranking.
 * Lowest total score first — that's the dungeon where the group has
 * the most room to gain Raider.io score by running it.
 *
 * Dungeons are unioned across all characters' best/alternate runs, so the
 * ranking reflects whatever season(s) the players have data for. A player
 * with no run for a dungeon contributes 0 to its total (that's the signal
 * we want — untimed dungeons drag the group total down).
 */
export function computeDungeonRanking(
  characters: readonly (CharacterDungeonScores | null)[],
): DungeonSuggestion[] {
  const valid = characters.filter((c): c is CharacterDungeonScores => c !== null);
  if (valid.length === 0) return [];

  const dungeonMeta: Record<number, { name: string; shortName: string; iconUrl: string | null }> = {};
  for (const char of valid) {
    for (const run of Object.values(char.byDungeon)) {
      const existing = dungeonMeta[run.challengeModeId];
      // Seed from the first non-empty name we see; backfill the icon if a
      // later character has it and the seed didn't (Raider.io's run records
      // include the icon, but defensively handling missing values keeps us
      // forward-compatible if the API trims fields).
      if (!existing && run.name) {
        dungeonMeta[run.challengeModeId] = {
          name: run.name,
          shortName: run.shortName,
          iconUrl: run.iconUrl,
        };
      } else if (existing && !existing.iconUrl && run.iconUrl) {
        existing.iconUrl = run.iconUrl;
      }
    }
  }

  const suggestions: DungeonSuggestion[] = Object.entries(dungeonMeta).map(([idStr, meta]) => {
    const id = Number(idStr);
    let totalScore = 0;
    let playersWithRuns = 0;
    let levelSum = 0;

    for (const char of valid) {
      const run: DungeonRunSummary | undefined = char.byDungeon[id];
      if (run) {
        totalScore += run.score;
        if (run.level > 0) {
          playersWithRuns += 1;
          levelSum += run.level;
        }
      }
    }

    const avgLevel = playersWithRuns > 0
      ? Math.round((levelSum / playersWithRuns) * 10) / 10
      : null;

    return {
      challengeModeId: id,
      name: meta.name,
      shortName: meta.shortName,
      iconUrl: meta.iconUrl,
      totalScore: Math.round(totalScore * 10) / 10,
      playersWithRuns,
      avgLevel,
    };
  });

  // Lowest total score first — that's the "most opportunity" dungeon.
  // Tiebreak by fewer players-with-runs (more upside), then by short name
  // for a stable order across renders.
  suggestions.sort((a, b) => {
    if (a.totalScore !== b.totalScore) return a.totalScore - b.totalScore;
    if (a.playersWithRuns !== b.playersWithRuns) return a.playersWithRuns - b.playersWithRuns;
    return a.shortName.localeCompare(b.shortName);
  });

  return suggestions;
}
