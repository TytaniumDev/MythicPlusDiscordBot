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

import { topAffinityFor } from '../src/seasonPairs.js';

describe('topAffinityFor', () => {
  it('returns teammates sorted by count desc', () => {
    const counts = {
      'Alice|Bob': 5,
      'Alice|Carol': 3,
      'Alice|Dave': 7,
    };
    const result = topAffinityFor('Alice', counts);
    expect(result).toEqual([
      { teammate: 'Dave', count: 7 },
      { teammate: 'Bob', count: 5 },
      { teammate: 'Carol', count: 3 },
    ]);
  });

  it('breaks ties alphabetically', () => {
    const counts = {
      'Alice|Bob': 2,
      'Alice|Carol': 2,
      'Alice|Dave': 2,
    };
    const result = topAffinityFor('Alice', counts);
    expect(result.map((r) => r.teammate)).toEqual(['Bob', 'Carol', 'Dave']);
  });

  it('respects the limit', () => {
    const counts = {
      'Alice|Bob': 1,
      'Alice|Carol': 2,
      'Alice|Dave': 3,
      'Alice|Eve': 4,
    };
    const result = topAffinityFor('Alice', counts, 2);
    expect(result).toEqual([
      { teammate: 'Eve', count: 4 },
      { teammate: 'Dave', count: 3 },
    ]);
  });

  it('ignores entries that don\'t involve the queried player', () => {
    const counts = {
      'Alice|Bob': 3,
      'Carol|Dave': 5,
    };
    const result = topAffinityFor('Alice', counts);
    expect(result).toEqual([{ teammate: 'Bob', count: 3 }]);
  });

  it('returns empty array when player has no pairings', () => {
    const counts = { 'Bob|Carol': 1 };
    expect(topAffinityFor('Alice', counts)).toEqual([]);
  });

  it('handles names with the pipe character correctly via canonical pairKey', () => {
    // pairKey sorts lexicographically, so 'Alice' < 'alice' (uppercase first).
    // Verify the lookup tolerates case-sensitive distinct names.
    const counts = {
      'Alice|alice': 1,
    };
    expect(topAffinityFor('Alice', counts)).toEqual([{ teammate: 'alice', count: 1 }]);
    expect(topAffinityFor('alice', counts)).toEqual([{ teammate: 'Alice', count: 1 }]);
  });
});

import { shortestPath } from '../src/seasonPairs.js';

describe('shortestPath', () => {
  it('returns single-element path when from === to', () => {
    expect(shortestPath('Alice', 'Alice', { 'Alice|Bob': 1 })).toEqual(['Alice']);
  });

  it('returns direct path for adjacent players', () => {
    const counts = { 'Alice|Bob': 1 };
    expect(shortestPath('Alice', 'Bob', counts)).toEqual(['Alice', 'Bob']);
  });

  it('returns multi-hop path when no direct edge', () => {
    const counts = {
      'Alice|Bob': 1,
      'Bob|Carol': 1,
    };
    expect(shortestPath('Alice', 'Carol', counts)).toEqual(['Alice', 'Bob', 'Carol']);
  });

  it('prefers heavy-weighted (frequent-pairing) edges over light ones', () => {
    // Direct edge Alice-Carol exists but with count=1 (cost 1.0).
    // The two-hop Alice-Bob-Carol both have count=10 (cost 0.1+0.1=0.2 < 1.0).
    const counts = {
      'Alice|Carol': 1,
      'Alice|Bob': 10,
      'Bob|Carol': 10,
    };
    expect(shortestPath('Alice', 'Carol', counts)).toEqual(['Alice', 'Bob', 'Carol']);
  });

  it('returns null when no path exists', () => {
    const counts = {
      'Alice|Bob': 1,
      'Carol|Dave': 1,
    };
    expect(shortestPath('Alice', 'Carol', counts)).toBeNull();
  });

  it('returns null when from is unknown', () => {
    expect(shortestPath('Ghost', 'Alice', { 'Alice|Bob': 1 })).toBeNull();
  });

  it('returns null when to is unknown', () => {
    expect(shortestPath('Alice', 'Ghost', { 'Alice|Bob': 1 })).toBeNull();
  });

  it('ignores entries with count 0 (no real pairing)', () => {
    const counts = {
      'Alice|Bob': 0,
      'Bob|Carol': 1,
    };
    expect(shortestPath('Alice', 'Carol', counts)).toBeNull();
  });
});
