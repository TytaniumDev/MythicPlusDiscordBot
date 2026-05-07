import { describe, it, expect } from 'vitest';
import { computeDungeonRanking } from './dungeonSuggestions';
import type { CharacterDungeonScores } from './dungeonScoreTypes';

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
  return {
    name,
    realm: 'r',
    region: 'us',
    byDungeon,
    overallScore: null,
    scoreColor: null,
    className: null,
    specName: null,
  };
}

describe('computeDungeonRanking', () => {
  const KEY_LEVEL = 12;

  it('returns empty when no characters have data', () => {
    expect(computeDungeonRanking([], KEY_LEVEL)).toEqual([]);
    expect(computeDungeonRanking([null, null], KEY_LEVEL)).toEqual([]);
  });

  it('ranks by descending key-level gain at the chosen key level', () => {
    // Both chars are below +12 on dungeon 1 (gains 4 and 3 → total 7).
    // Both are above +12 on dungeon 2 (gain 0).
    const a = makeChar('A', [
      { id: 1, name: 'Floodgate', shortName: 'FLOOD', level: 8, score: 120 },
      { id: 2, name: 'Dawnbreaker', shortName: 'DAWN', level: 14, score: 260 },
    ]);
    const b = makeChar('B', [
      { id: 1, name: 'Floodgate', shortName: 'FLOOD', level: 9, score: 140 },
      { id: 2, name: 'Dawnbreaker', shortName: 'DAWN', level: 13, score: 240 },
    ]);
    const ranked = computeDungeonRanking([a, b], KEY_LEVEL);
    expect(ranked.map(d => d.shortName)).toEqual(['FLOOD', 'DAWN']);
    expect(ranked[0].projectedGain).toBe((KEY_LEVEL - 8) + (KEY_LEVEL - 9));
    expect(ranked[1].projectedGain).toBe(0);
  });

  it('counts players with no run as a full-keyLevel gain', () => {
    const a = makeChar('A', [
      { id: 1, name: 'Floodgate', shortName: 'FLOOD', level: 9, score: 150 },
    ]);
    // B has no run for dungeon 1 → currentLevel = 0 → gain = full keyLevel.
    const b = makeChar('B', []);
    const ranked = computeDungeonRanking([a, b], KEY_LEVEL);
    expect(ranked[0].projectedGain).toBe((KEY_LEVEL - 9) + KEY_LEVEL);
    expect(ranked[0].playersBelowProjection).toBe(2);
  });

  it('changes ranking when key level changes', () => {
    // Dungeon 1: best level 12. Dungeon 2: best level 4.
    const c = makeChar('C', [
      { id: 1, name: 'Floodgate', shortName: 'FLOOD', level: 12, score: 220 },
      { id: 2, name: 'Dawnbreaker', shortName: 'DAWN', level: 4, score: 100 },
    ]);
    const at5 = computeDungeonRanking([c], 5);
    // At +5: DAWN (gap 1) outranks FLOOD (gap 0).
    expect(at5[0].shortName).toBe('DAWN');
    expect(at5.find(d => d.shortName === 'FLOOD')?.projectedGain).toBe(0);

    const at15 = computeDungeonRanking([c], 15);
    // At +15: DAWN (gap 11) still wins, FLOOD now has gain 3.
    expect(at15[0].shortName).toBe('DAWN');
    expect(at15.find(d => d.shortName === 'FLOOD')?.projectedGain).toBe(3);
    expect(at15.find(d => d.shortName === 'DAWN')?.projectedGain).toBe(11);
  });

  it('zero gain when nobody has data and projection is zero', () => {
    const a = makeChar('A', [
      { id: 1, name: 'Floodgate', shortName: 'FLOOD', level: 0, score: 0 },
    ]);
    // KeyLevel 0 → gain = max(0, 0 - 0) = 0.
    const ranked = computeDungeonRanking([a], 0);
    expect(ranked[0].projectedGain).toBe(0);
  });

  it('rounds avg level across players with runs', () => {
    const a = makeChar('A', [{ id: 1, name: 'Floodgate', shortName: 'FLOOD', level: 12, score: 200 }]);
    const b = makeChar('B', [{ id: 1, name: 'Floodgate', shortName: 'FLOOD', level: 9, score: 150 }]);
    const ranked = computeDungeonRanking([a, b], KEY_LEVEL);
    expect(ranked[0].avgLevel).toBe(10.5);
  });

  it('returns null avg level when nobody has a timed run', () => {
    const a = makeChar('A', [{ id: 1, name: 'Floodgate', shortName: 'FLOOD', level: 0, score: 0 }]);
    const ranked = computeDungeonRanking([a], KEY_LEVEL);
    expect(ranked[0].avgLevel).toBeNull();
  });

  it('propagates iconUrl from the first character that has it', () => {
    const a = makeChar('A', [
      { id: 1, name: 'Floodgate', shortName: 'FLOOD', level: 12, score: 200, iconUrl: null },
    ]);
    const b = makeChar('B', [
      { id: 1, name: 'Floodgate', shortName: 'FLOOD', level: 11, score: 180, iconUrl: 'https://cdn.example/floodgate.jpg' },
    ]);
    const ranked = computeDungeonRanking([a, b], KEY_LEVEL);
    expect(ranked[0].iconUrl).toBe('https://cdn.example/floodgate.jpg');
  });

  it('ignores nulls in the input array', () => {
    const a = makeChar('A', [{ id: 1, name: 'Floodgate', shortName: 'FLOOD', level: 9, score: 150 }]);
    const ranked = computeDungeonRanking([null, a, null], KEY_LEVEL);
    expect(ranked.length).toBe(1);
    expect(ranked[0].projectedGain).toBe(KEY_LEVEL - 9);
  });
});
