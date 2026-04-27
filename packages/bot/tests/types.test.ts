import { describe, it, expect } from 'vitest';
import { toCharacterClass, CHARACTER_CLASSES } from '@mythicplus/shared';

describe('toCharacterClass', () => {
  it('returns the input verbatim for every valid class name', () => {
    for (const cls of CHARACTER_CLASSES) {
      expect(toCharacterClass(cls)).toBe(cls);
    }
  });

  it('returns null for an unknown class name', () => {
    expect(toCharacterClass('FakeClass')).toBeNull();
    expect(toCharacterClass('druid')).toBeNull(); // case-sensitive
    expect(toCharacterClass('')).toBeNull();
  });

  it('returns null for non-string inputs', () => {
    expect(toCharacterClass(undefined)).toBeNull();
    expect(toCharacterClass(null)).toBeNull();
    expect(toCharacterClass(42)).toBeNull();
    expect(toCharacterClass({})).toBeNull();
    expect(toCharacterClass(['Druid'])).toBeNull();
    expect(toCharacterClass(true)).toBeNull();
  });
});
