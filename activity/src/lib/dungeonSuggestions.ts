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
  /**
   * Total key levels the group would gain by timing a key at the projection
   * level — `max(0, keyLevel − playerBestLevel)` summed across all players.
   * Higher is better; the ranking sorts by this. A player with no run for
   * the dungeon contributes the full `keyLevel`.
   */
  projectedGain: number;
  /** Players whose best timed level for this dungeon is below the projection. */
  playersBelowProjection: number;
  /** Players who have at least one timed/recorded run for this dungeon. */
  playersWithRuns: number;
  /** Average key level across players who have a run, rounded to 1 decimal. */
  avgLevel: number | null;
}

/**
 * Aggregate per-character dungeon runs into a group-level ranking.
 *
 * Strategy: for each dungeon, sum the *key levels* every player would gain
 * by timing a key at `keyLevel` — `max(0, keyLevel − playerBestLevel)` per
 * player, summed across the group. The dungeon with the highest total is
 * where the most members stand to push their best.
 *
 * We compare on level rather than Raider.io score because the per-dungeon
 * `score` field bakes in cross-affix bonuses, so even modest groups hit
 * scores well above any single-run linear estimate — which used to peg
 * every gain at 0 and lock the ranking alphabetically.
 *
 * Dungeons are unioned across all characters' best/alternate runs, so the
 * ranking reflects whatever season(s) the players have data for.
 */
export function computeDungeonRanking(
  characters: readonly (CharacterDungeonScores | null)[],
  keyLevel: number,
): DungeonSuggestion[] {
  const valid = characters.filter((c): c is CharacterDungeonScores => c !== null);
  if (valid.length === 0) return [];

  const dungeonMeta: Record<number, { name: string; shortName: string; iconUrl: string | null }> = {};
  for (const char of valid) {
    for (const run of Object.values(char.byDungeon)) {
      const existing = dungeonMeta[run.challengeModeId];
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
    let projectedGain = 0;
    let playersWithRuns = 0;
    let playersBelowProjection = 0;
    let levelSum = 0;

    for (const char of valid) {
      const run: DungeonRunSummary | undefined = char.byDungeon[id];
      const currentLevel = run?.level ?? 0;
      const gain = Math.max(0, keyLevel - currentLevel);
      projectedGain += gain;
      if (gain > 0) playersBelowProjection += 1;
      if (run && run.level > 0) {
        playersWithRuns += 1;
        levelSum += run.level;
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
      projectedGain,
      playersBelowProjection,
      playersWithRuns,
      avgLevel,
    };
  });

  // Highest projected gain first — that's the dungeon with the most key
  // levels to gain at the chosen level. Tiebreak by more players who'd
  // benefit (broader upside), then by name for a stable render order.
  suggestions.sort((a, b) => {
    if (a.projectedGain !== b.projectedGain) return b.projectedGain - a.projectedGain;
    if (a.playersBelowProjection !== b.playersBelowProjection) {
      return b.playersBelowProjection - a.playersBelowProjection;
    }
    return a.shortName.localeCompare(b.shortName);
  });

  return suggestions;
}
