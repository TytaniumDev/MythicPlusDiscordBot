import { describe, it, expect } from 'vitest';
import { parseWoWGroupDicts, parseWoWPlayerDict } from '../src/groupWire';
import type { WoWPlayerDict } from '../src/types';

function player(name: string): WoWPlayerDict {
  return {
    name,
    discordId: `${name}-id`,
    inGameName: `${name}-realm`,
    mainRole: 'healer',
    offspecs: ['ranged'],
    utilities: ['brez'],
  };
}

describe('parseWoWPlayerDict', () => {
  it('keeps a valid compact player unchanged', () => {
    expect(parseWoWPlayerDict(player('a'))).toEqual(player('a'));
  });

  it('keeps mediaUrl and characterClass', () => {
    const raw = { ...player('a'), mediaUrl: 'https://example.com/a.png', characterClass: 'Druid' };
    expect(parseWoWPlayerDict(raw)).toEqual(raw);
  });

  it('rejects values without a string name', () => {
    expect(parseWoWPlayerDict(null)).toBeNull();
    expect(parseWoWPlayerDict('a')).toBeNull();
    expect(parseWoWPlayerDict([])).toBeNull();
    expect(parseWoWPlayerDict({ discordId: 'x', mainRole: 'tank' })).toBeNull();
    expect(parseWoWPlayerDict({ name: 42, mainRole: 'tank' })).toBeNull();
    expect(parseWoWPlayerDict({ name: '', mainRole: 'tank' })).toBeNull();
  });

  it('defaults malformed fields instead of passing them through', () => {
    expect(parseWoWPlayerDict({
      name: 'a',
      discordId: 7,
      inGameName: { bad: true },
      mainRole: 'dps',
      offspecs: 'tank',
      utilities: ['lust', 'bloodlust'],
      mediaUrl: 5,
      characterClass: 'Bard',
    })).toEqual({
      name: 'a',
      discordId: '',
      inGameName: '',
      mainRole: null,
      offspecs: [],
      utilities: ['lust'],
    });
  });

  it('converts the legacy role-flag shape to the compact shape', () => {
    expect(parseWoWPlayerDict({
      name: 'a',
      discordId: 'a-id',
      roles: { tankMain: true, offhealer: true, hasLust: true },
    })).toEqual({
      name: 'a',
      discordId: 'a-id',
      inGameName: '',
      mainRole: 'tank',
      offspecs: ['healer'],
      utilities: ['lust'],
    });
  });
});

describe('parseWoWGroupDicts', () => {
  it('keeps valid groups unchanged with no issues', () => {
    const groups = [{ tank: player('t'), healer: player('h'), dps: [player('d1'), player('d2')] }];
    expect(parseWoWGroupDicts(groups)).toEqual({ value: groups, issues: [] });
  });

  it('treats a missing value as no groups', () => {
    expect(parseWoWGroupDicts(undefined)).toEqual({ value: [], issues: [] });
    expect(parseWoWGroupDicts(null)).toEqual({ value: [], issues: [] });
  });

  it('reports a non-array value', () => {
    expect(parseWoWGroupDicts({ tank: null })).toEqual({ value: [], issues: ['groups: not an array'] });
  });

  it('drops malformed groups and players and reports each one', () => {
    const { value, issues } = parseWoWGroupDicts([
      'not-a-group',
      { tank: { mainRole: 'tank' }, healer: player('h'), dps: [player('d1'), 3] },
      { tank: null, healer: null, dps: 'nope' },
    ]);
    expect(value).toEqual([
      { tank: null, healer: player('h'), dps: [player('d1')] },
      { tank: null, healer: null, dps: [] },
    ]);
    expect(issues).toEqual([
      'groups[0]: not an object',
      'groups[1] tank: invalid player',
      'groups[1] dps 1: invalid player',
      'groups[2] dps: not an array',
    ]);
  });

  it('uses the given label in issues', () => {
    expect(parseWoWGroupDicts([null], 'round').issues).toEqual(['round[0]: not an object']);
  });
});
