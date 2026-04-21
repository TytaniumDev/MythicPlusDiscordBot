import { describe, it, expect } from 'vitest';
import {
  getPrimaryRole,
  formatRoleName,
  getRoleColor,
  ROLE_LABELS,
  hasAnyRole,
  getRoleTags,
  isPlayerReady,
  getReadyCount,
  categorizeUnreadyPlayers,
  playerRolesToStringArray,
  roleStringsToPlayerFields,
  utilityIcons,
  computeToggledRoles,
} from './roles';
import type { WoWPlayer } from '../types';

const player = (overrides: Partial<WoWPlayer> = {}): WoWPlayer => ({
  name: 'Test',
  discordId: 'd1',
  mainRole: null,
  offspecs: [],
  utilities: [],
  ...overrides,
});

describe('getPrimaryRole', () => {
  it('returns mainRole when set', () => {
    expect(getPrimaryRole(player({ mainRole: 'tank' }))).toBe('tank');
  });
  it('returns unassigned when null', () => {
    expect(getPrimaryRole(player())).toBe('unassigned');
  });
});

describe('formatRoleName', () => {
  it('capitalizes known roles', () => {
    expect(formatRoleName('tank')).toBe('Tank');
    expect(formatRoleName('melee')).toBe('Melee');
  });
  it('handles unassigned', () => {
    expect(formatRoleName('unassigned')).toBe('Unassigned');
  });
});

describe('getRoleColor', () => {
  it('returns a color var for every known role', () => {
    expect(getRoleColor('tank')).toBe('var(--color-tank)');
    expect(getRoleColor('healer')).toBe('var(--color-healer)');
    expect(getRoleColor('ranged')).toBe('var(--color-dps)');
    expect(getRoleColor('melee')).toBe('var(--color-dps)');
  });
  it('falls back to unassigned color for unknown', () => {
    expect(getRoleColor('bogus')).toBe('var(--text-secondary)');
  });
});

describe('ROLE_LABELS', () => {
  it('has entries for all primary roles', () => {
    for (const r of ['tank', 'healer', 'ranged', 'melee', 'unassigned']) {
      expect(ROLE_LABELS[r]).toBeTruthy();
    }
  });
});

describe('hasAnyRole', () => {
  it('is false for an empty player', () => {
    expect(hasAnyRole(player())).toBe(false);
  });
  it('is true with main role', () => {
    expect(hasAnyRole(player({ mainRole: 'tank' }))).toBe(true);
  });
  it('is true with only offspec', () => {
    expect(hasAnyRole(player({ offspecs: ['healer'] }))).toBe(true);
  });
});

describe('getRoleTags', () => {
  it('returns No roles tag when empty', () => {
    const tags = getRoleTags(player());
    expect(tags).toEqual([{ label: 'No roles', cssClass: 'tag-unassigned' }]);
  });
  it('omits offspec tag when it matches the main', () => {
    const tags = getRoleTags(player({ mainRole: 'tank', offspecs: ['tank'] }));
    expect(tags.find(t => t.label === 'Tank' && t.cssClass.includes('offspec'))).toBeUndefined();
  });
  it('includes utility tags', () => {
    const tags = getRoleTags(player({ mainRole: 'healer', utilities: ['brez', 'lust'] }));
    const labels = tags.map(t => t.label);
    expect(labels).toContain('Brez');
    expect(labels).toContain('Lust');
  });
});

describe('isPlayerReady', () => {
  it('needs both inGameName and mainRole', () => {
    expect(isPlayerReady(player())).toBe(false);
    expect(isPlayerReady(player({ mainRole: 'tank' }))).toBe(false);
    expect(isPlayerReady(player({ inGameName: 'Foo' }))).toBe(false);
    expect(isPlayerReady(player({ inGameName: 'Foo', mainRole: 'tank' }))).toBe(true);
  });
});

describe('getReadyCount', () => {
  it('excludes sitting-out players from total', () => {
    const players = [
      player({ discordId: '1', inGameName: 'A', mainRole: 'tank' }),
      player({ discordId: '2', inGameName: 'B', mainRole: 'healer' }),
      player({ discordId: '3', mainRole: null }),
    ];
    expect(getReadyCount(players, ['3'])).toEqual({ ready: 2, total: 2 });
    expect(getReadyCount(players, [])).toEqual({ ready: 2, total: 3 });
  });
});

describe('categorizeUnreadyPlayers', () => {
  it('separates missing-role from missing-name', () => {
    const players = [
      player({ discordId: '1', inGameName: 'A', mainRole: 'tank' }),
      player({ discordId: '2', mainRole: 'healer' }),
      player({ discordId: '3', mainRole: null }),
    ];
    const result = categorizeUnreadyPlayers(players, []);
    expect(result.missingRole.map(p => p.discordId)).toEqual(['3']);
    expect(result.missingNameOnly.map(p => p.discordId)).toEqual(['2']);
  });
  it('ignores sitting-out players', () => {
    const players = [player({ discordId: '3', mainRole: null })];
    const result = categorizeUnreadyPlayers(players, ['3']);
    expect(result.missingRole).toEqual([]);
  });
});

describe('playerRolesToStringArray / roleStringsToPlayerFields', () => {
  it('round-trips a tank with offspecs and utilities', () => {
    const p = player({ mainRole: 'tank', offspecs: ['healer', 'melee'], utilities: ['brez'] });
    const strings = playerRolesToStringArray(p);
    const fields = roleStringsToPlayerFields(strings);
    expect(fields.mainRole).toBe('tank');
    expect(fields.offspecs.sort()).toEqual(['healer', 'melee']);
    expect(fields.utilities).toEqual(['brez']);
  });
  it('handles unassigned player', () => {
    const fields = roleStringsToPlayerFields([]);
    expect(fields.mainRole).toBeNull();
    expect(fields.offspecs).toEqual([]);
    expect(fields.utilities).toEqual([]);
  });
});

describe('computeToggledRoles', () => {
  it('removes a role that is already active', () => {
    const next = computeToggledRoles(new Set(['Tank', 'Brez']), 'Tank', true);
    expect(next.has('Tank')).toBe(false);
    expect(next.has('Brez')).toBe(true);
  });

  it('switching main spec: swaps old main into offspec when new main was an offspec', () => {
    // Current: main=Tank, offspec=Healer. Toggle Healer as main.
    const next = computeToggledRoles(new Set(['Tank', 'Healer Offspec']), 'Healer', true);
    expect(next.has('Healer')).toBe(true);
    expect(next.has('Tank')).toBe(false);
    expect(next.has('Healer Offspec')).toBe(false);
    expect(next.has('Tank Offspec')).toBe(true);
  });

  it('switching main spec without matching offspec: just replaces', () => {
    const next = computeToggledRoles(new Set(['Tank']), 'Healer', true);
    expect(next.has('Healer')).toBe(true);
    expect(next.has('Tank')).toBe(false);
    expect(next.has('Tank Offspec')).toBe(false);
  });

  it('adding an offspec matching current main is a no-op', () => {
    const prev = new Set(['Tank']);
    const next = computeToggledRoles(prev, 'Tank Offspec', false);
    expect(Array.from(next).sort()).toEqual(['Tank']);
  });

  it('adds offspec when it does not match current main', () => {
    const next = computeToggledRoles(new Set(['Tank']), 'Healer Offspec', false);
    expect(next.has('Tank')).toBe(true);
    expect(next.has('Healer Offspec')).toBe(true);
  });
});

describe('utilityIcons', () => {
  it('returns empty when no player', () => {
    expect(utilityIcons(null)).toBe('');
    expect(utilityIcons(undefined)).toBe('');
  });
  it('includes brez and lust glyphs', () => {
    const icons = utilityIcons(player({ utilities: ['brez', 'lust'] }));
    expect(icons).toMatch(/⚰/);
    expect(icons).toMatch(/🎺/);
  });
});
