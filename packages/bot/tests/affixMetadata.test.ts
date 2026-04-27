import { describe, it, expect } from 'vitest';
import { resolveAffixDisplay, STATIC_AFFIXES, BARGAIN_AFFIXES } from '@mythicplus/shared';

describe('resolveAffixDisplay', () => {
  it('returns the static affix entry for a known static ID', () => {
    const lindormi = resolveAffixDisplay(165);
    expect(lindormi).not.toBeNull();
    expect(lindormi?.id).toBe(165);
    expect(STATIC_AFFIXES.some((a) => a.id === 165)).toBe(true);
  });

  it('returns the static affix entry for the level-12 affix', () => {
    const guile = resolveAffixDisplay(147);
    expect(guile).not.toBeNull();
    expect(guile?.id).toBe(147);
  });

  it('returns the bargain affix entry for a known bargain ID', () => {
    for (const id of [148, 158, 162, 160]) {
      const found = resolveAffixDisplay(id);
      expect(found, `missing bargain id ${id}`).not.toBeNull();
      expect(found?.id).toBe(id);
      expect(BARGAIN_AFFIXES[id]).toBeDefined();
    }
  });

  it('returns the fort/tyran entries for IDs 9 and 10', () => {
    expect(resolveAffixDisplay(10)?.name).toBe('Fortified');
    expect(resolveAffixDisplay(9)?.name).toBe('Tyrannical');
  });

  it('returns null for unknown IDs', () => {
    expect(resolveAffixDisplay(0)).toBeNull();
    expect(resolveAffixDisplay(9999)).toBeNull();
    expect(resolveAffixDisplay(-1)).toBeNull();
  });
});
