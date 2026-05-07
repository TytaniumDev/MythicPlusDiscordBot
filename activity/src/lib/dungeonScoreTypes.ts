// Type contracts for Raider.io per-character dungeon score data.
//
// Lives in `lib/` so both the I/O boundary (`services/raiderioMythicPlus.ts`)
// and pure consumers (`lib/dungeonSuggestions.ts`, components, hooks) can
// import the shapes without `lib/` depending on `services/`.

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
  /** Overall Raider.io M+ score for the current season ("all" segment), or null. */
  overallScore: number | null;
  /** Raider.io rarity color for the overall score (e.g. "#f06862"), or null. */
  scoreColor: string | null;
  /** Character's class name from Raider.io (e.g. "Mage"), or null. */
  className: string | null;
  /** Active spec name (e.g. "Frost"), or null. */
  specName: string | null;
}
