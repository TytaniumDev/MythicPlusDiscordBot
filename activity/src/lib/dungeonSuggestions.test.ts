import { describe, it, expect } from 'vitest';
import { computeDungeonRanking } from './dungeonSuggestions';
import type { CharacterDungeonScores } from '../services/raiderioMythicPlus';

function makeChar(
  name: string,
  runs: Array<{ id: number; name: string; shortName: string; level: number; score: number; iconUrl?: string | null }>,
): CharacterDungeonScores {
  const byDungeon: CharacterDungeonScores['byDungeon'] = {};
  for (const r of runs) {
    byDungeon[r.id] = {
      challengeModeId: r.id,
      name: r.name,
      shortName: r.shortName,
      level: r.level,
      score: r.score,
      iconUrl: r.iconUrl ?? null,
    };
  }
  return { name, realm: 'r', region: 'us', byDungeon };
}

describe('computeDungeonRanking', () => {
  it('returns empty when no characters have data', () => {
    expect(computeDungeonRanking([])).toEqual([]);
    expect(computeDungeonRanking([null, null])).toEqual([]);
  });

  it('sorts dungeons by ascending total score', () => {
    const a = makeChar('A', [
      { id: 1, name: 'Floodgate', shortName: 'FLOOD', level: 12, score: 200 },
      { id: 2, name: 'Dawnbreaker', shortName: 'DAWN', level: 10, score: 150 },
    ]);
    const b = makeChar('B', [
      { id: 1, name: 'Floodgate', shortName: 'FLOOD', level: 11, score: 180 },
      { id: 2, name: 'Dawnbreaker', shortName: 'DAWN', level: 8, score: 100 },
    ]);
    const ranked = computeDungeonRanking([a, b]);
    expect(ranked.map(d => d.shortName)).toEqual(['DAWN', 'FLOOD']);
    expect(ranked[0].totalScore).toBe(250);
    expect(ranked[1].totalScore).toBe(380);
  });

  it('counts missing runs as zero score (drags total down)', () => {
    const a = makeChar('A', [
      { id: 1, name: 'Floodgate', shortName: 'FLOOD', level: 12, score: 200 },
      { id: 2, name: 'Dawnbreaker', shortName: 'DAWN', level: 10, score: 150 },
    ]);
    // B has only run dungeon 1 — dungeon 2 should rank as the lower group total.
    const b = makeChar('B', [
      { id: 1, name: 'Floodgate', shortName: 'FLOOD', level: 12, score: 220 },
    ]);
    const ranked = computeDungeonRanking([a, b]);
    expect(ranked[0].shortName).toBe('DAWN');
    expect(ranked[0].totalScore).toBe(150);
    expect(ranked[0].playersWithRuns).toBe(1);
    expect(ranked[1].shortName).toBe('FLOOD');
    expect(ranked[1].playersWithRuns).toBe(2);
  });

  it('rounds avg level across players with runs', () => {
    const a = makeChar('A', [{ id: 1, name: 'Floodgate', shortName: 'FLOOD', level: 12, score: 200 }]);
    const b = makeChar('B', [{ id: 1, name: 'Floodgate', shortName: 'FLOOD', level: 9, score: 150 }]);
    const ranked = computeDungeonRanking([a, b]);
    expect(ranked[0].avgLevel).toBe(10.5);
  });

  it('returns null avg level when nobody has a timed run', () => {
    const a = makeChar('A', [{ id: 1, name: 'Floodgate', shortName: 'FLOOD', level: 0, score: 0 }]);
    const ranked = computeDungeonRanking([a]);
    expect(ranked[0].avgLevel).toBeNull();
  });

  it('propagates iconUrl from the first character that has it', () => {
    const a = makeChar('A', [
      { id: 1, name: 'Floodgate', shortName: 'FLOOD', level: 12, score: 200, iconUrl: null },
    ]);
    const b = makeChar('B', [
      { id: 1, name: 'Floodgate', shortName: 'FLOOD', level: 11, score: 180, iconUrl: 'https://cdn.example/floodgate.jpg' },
    ]);
    const ranked = computeDungeonRanking([a, b]);
    expect(ranked[0].iconUrl).toBe('https://cdn.example/floodgate.jpg');
  });

  it('ignores nulls in the input array', () => {
    const a = makeChar('A', [{ id: 1, name: 'Floodgate', shortName: 'FLOOD', level: 12, score: 200 }]);
    const ranked = computeDungeonRanking([null, a, null]);
    expect(ranked.length).toBe(1);
    expect(ranked[0].totalScore).toBe(200);
  });
});
