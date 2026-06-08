import { describe, it, expect } from 'vitest';
import { realmToSlug, parseInGameName } from '../src/realmSlug';

describe('realmSlug', () => {
  describe('realmToSlug', () => {
    it('converts basic realms correctly', () => {
      expect(realmToSlug('Illidan')).toBe('illidan');
      expect(realmToSlug('Tichondrius')).toBe('tichondrius');
    });

    it('handles spaces', () => {
      expect(realmToSlug('Area 52')).toBe('area-52');
      expect(realmToSlug('Bleeding Hollow')).toBe('bleeding-hollow');
    });

    it('strips apostrophes', () => {
      expect(realmToSlug("Kel'Thuzad")).toBe('kelthuzad');
      expect(realmToSlug("Garr'osh")).toBe('garrosh');
    });

    it('collapses multiple non-alphanumeric characters into a single hyphen', () => {
      expect(realmToSlug('Azjol - Nerub')).toBe('azjol-nerub');
      expect(realmToSlug(' Azjol  -  Nerub ')).toBe('azjol-nerub');
    });
  });

  describe('parseInGameName', () => {
    it('returns null for missing or empty input', () => {
      expect(parseInGameName(undefined)).toBeNull();
      expect(parseInGameName(null)).toBeNull();
      expect(parseInGameName('')).toBeNull();
      expect(parseInGameName('   ')).toBeNull();
    });

    it('returns null if there is no dash', () => {
      expect(parseInGameName('CharacterName')).toBeNull();
      expect(parseInGameName('CharacterName Realm')).toBeNull();
    });

    it('returns null if name or realm is missing after trim', () => {
      expect(parseInGameName('-Realm')).toBeNull();
      expect(parseInGameName('CharacterName-')).toBeNull();
      expect(parseInGameName(' - ')).toBeNull();
    });

    it('parses correctly with a valid dash format', () => {
      expect(parseInGameName('Player-Illidan')).toEqual({
        name: 'Player',
        realmSlug: 'illidan',
      });
    });

    it('parses correctly with spaces around the dash', () => {
      expect(parseInGameName(' Player - Area 52 ')).toEqual({
        name: 'Player',
        realmSlug: 'area-52',
      });
    });

    it('handles realms with apostrophes', () => {
      expect(parseInGameName("Bob-Kel'Thuzad")).toEqual({
        name: 'Bob',
        realmSlug: 'kelthuzad',
      });
    });
  });
});
