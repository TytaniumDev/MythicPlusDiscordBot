import { describe, it, expect } from 'vitest';
import {
  encodeGroupHistoryRounds,
  decodeGroupHistoryRounds,
} from '../src/groupHistoryWire';
import type { WoWGroupDict, WoWPlayerDict } from '../src/types';

function player(name: string): WoWPlayerDict {
  return {
    name,
    discordId: `${name}-id`,
    inGameName: '',
    mainRole: 'tank',
    offspecs: [],
    utilities: [],
  };
}

function group(name: string): WoWGroupDict {
  return {
    tank: player(`${name}-t`),
    healer: player(`${name}-h`),
    dps: [player(`${name}-d1`), player(`${name}-d2`), player(`${name}-d3`)],
  };
}

describe('encodeGroupHistoryRounds', () => {
  it('wraps each round in a { groups } object', () => {
    const round1 = [group('a'), group('b')];
    const round2 = [group('c')];
    const encoded = encodeGroupHistoryRounds([round1, round2]);
    expect(encoded).toEqual([
      { groups: round1 },
      { groups: round2 },
    ]);
  });

  it('encodes an empty rounds array as empty', () => {
    expect(encodeGroupHistoryRounds([])).toEqual([]);
  });

  it('round-trips a populated rounds array unchanged', () => {
    const rounds: WoWGroupDict[][] = [
      [group('a'), group('b')],
      [group('c')],
      [],
    ];
    const decoded = decodeGroupHistoryRounds(encodeGroupHistoryRounds(rounds));
    expect(decoded).toEqual(rounds);
  });
});

describe('decodeGroupHistoryRounds', () => {
  it('decodes the wrapped shape (current)', () => {
    const round = [group('a')];
    const decoded = decodeGroupHistoryRounds([{ groups: round }]);
    expect(decoded).toEqual([round]);
  });

  it('decodes the legacy flat-array shape', () => {
    const round = [group('a'), group('b')];
    const decoded = decodeGroupHistoryRounds([round]);
    expect(decoded).toEqual([round]);
  });

  it('handles a mix of wrapped and legacy entries', () => {
    const r1 = [group('a')];
    const r2 = [group('b')];
    const decoded = decodeGroupHistoryRounds([r1, { groups: r2 }]);
    expect(decoded).toEqual([r1, r2]);
  });

  it('skips garbage entries (null, missing groups, non-array groups)', () => {
    const valid = [group('a')];
    const decoded = decodeGroupHistoryRounds([
      null,
      undefined,
      'not-a-round',
      42,
      {},
      { groups: 'not-an-array' },
      { groups: null },
      { notGroups: [] },
      { groups: valid },
    ]);
    expect(decoded).toEqual([valid]);
  });

  it('returns an empty array for an empty input', () => {
    expect(decodeGroupHistoryRounds([])).toEqual([]);
  });
});
