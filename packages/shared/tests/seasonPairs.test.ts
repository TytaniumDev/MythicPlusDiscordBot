import { describe, it, expect } from 'vitest';
import { WoWPlayer, WoWGroup } from '../src/models.js';
import { bumpPairCounts } from '../src/seasonPairs.js';

function mkGroup(names: string[]): WoWGroup {
  const players = names.map((n) => WoWPlayer.create(n, ['Ranged']));
  const g = new WoWGroup();
  g.tank = players[0] ?? null;
  g.healer = players[1] ?? null;
  g.dps = players.slice(2);
  return g;
}

describe('bumpPairCounts', () => {
  it('adds 1 to each pair in a single 5-person group', () => {
    const round = [mkGroup(['Alice', 'Bob', 'Carol', 'Dave', 'Eve'])];
    const result = bumpPairCounts({}, round);
    // 5 players → 10 unique pairs, each at count 1
    expect(Object.keys(result)).toHaveLength(10);
    expect(result['Alice|Bob']).toBe(1);
    expect(result['Bob|Carol']).toBe(1);
    expect(result['Dave|Eve']).toBe(1);
  });

  it('increments existing counts non-destructively', () => {
    const existing = { 'Alice|Bob': 2, 'Carol|Dave': 1 };
    const round = [mkGroup(['Alice', 'Bob', 'Carol', 'Dave', 'Eve'])];
    const result = bumpPairCounts(existing, round);
    expect(result['Alice|Bob']).toBe(3);
    expect(result['Carol|Dave']).toBe(2);
    // Existing input not mutated
    expect(existing['Alice|Bob']).toBe(2);
  });

  it('skips groups smaller than 2', () => {
    const round = [mkGroup(['Solo']), mkGroup(['Alice', 'Bob'])];
    const result = bumpPairCounts({}, round);
    expect(Object.keys(result)).toEqual(['Alice|Bob']);
  });

  it('handles multi-group rounds independently', () => {
    const round = [
      mkGroup(['Alice', 'Bob', 'Carol', 'Dave', 'Eve']),
      mkGroup(['Frank', 'Gina', 'Hugo', 'Ivy', 'Jack']),
    ];
    const result = bumpPairCounts({}, round);
    expect(result['Alice|Bob']).toBe(1);
    expect(result['Frank|Gina']).toBe(1);
    // No cross-group pairs
    expect(result['Alice|Frank']).toBeUndefined();
  });
});
