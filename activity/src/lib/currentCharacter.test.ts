import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadStoredCharacter,
  saveStoredCharacter,
  clearStoredCharacter,
  loadStoredDiscordId,
  saveStoredDiscordId,
  migrateLegacyDiscordId,
  realmToSlug,
  parseInGameName,
  CHARACTER_KEY,
  DISCORD_ID_KEY,
} from './currentCharacter';

beforeEach(() => {
  localStorage.clear();
});

describe('loadStoredCharacter', () => {
  it('returns null when nothing is stored', () => {
    expect(loadStoredCharacter()).toBeNull();
  });

  it('returns the parsed character when stored', () => {
    const character = {
      inGameName: 'Tytanium-Stormrage',
      region: 'us',
      mediaUrl: 'https://example.com/avatar.jpg',
      characterClass: 'Druid' as const,
      lookupStatus: 'ok' as const,
      lastUpdated: 1234567890,
    };
    localStorage.setItem(CHARACTER_KEY, JSON.stringify(character));
    expect(loadStoredCharacter()).toEqual(character);
  });

  it('returns null when the stored value is malformed JSON', () => {
    localStorage.setItem(CHARACTER_KEY, '{not json');
    expect(loadStoredCharacter()).toBeNull();
  });

  it('returns null when the stored value is missing required fields', () => {
    localStorage.setItem(CHARACTER_KEY, JSON.stringify({ inGameName: 'X' }));
    expect(loadStoredCharacter()).toBeNull();
  });
});

describe('saveStoredCharacter / clearStoredCharacter', () => {
  it('round-trips a character through localStorage', () => {
    const character = {
      inGameName: 'Foo-Bar',
      region: 'us',
      mediaUrl: null,
      characterClass: null,
      lookupStatus: 'pending' as const,
      lastUpdated: 1,
    };
    saveStoredCharacter(character);
    expect(loadStoredCharacter()).toEqual(character);
  });

  it('clearStoredCharacter removes the key', () => {
    saveStoredCharacter({
      inGameName: 'X', region: 'us', mediaUrl: null, characterClass: null,
      lookupStatus: 'ok', lastUpdated: 0,
    });
    clearStoredCharacter();
    expect(loadStoredCharacter()).toBeNull();
  });
});

describe('loadStoredDiscordId / saveStoredDiscordId', () => {
  it('returns null when nothing is stored', () => {
    expect(loadStoredDiscordId()).toBeNull();
  });

  it('round-trips a Discord ID', () => {
    saveStoredDiscordId('100000000000000007');
    expect(loadStoredDiscordId()).toBe('100000000000000007');
  });
});

describe('migrateLegacyDiscordId', () => {
  it('is a no-op when the new key is already set', () => {
    localStorage.setItem(DISCORD_ID_KEY, 'new-id');
    localStorage.setItem('wheelson-player-guild-1', 'legacy-id');
    migrateLegacyDiscordId();
    expect(localStorage.getItem(DISCORD_ID_KEY)).toBe('new-id');
  });

  it('is a no-op when no legacy keys exist', () => {
    migrateLegacyDiscordId();
    expect(localStorage.getItem(DISCORD_ID_KEY)).toBeNull();
  });

  it('copies a legacy per-guild value to the global key', () => {
    localStorage.setItem('wheelson-player-guild-1', 'legacy-id');
    migrateLegacyDiscordId();
    expect(localStorage.getItem(DISCORD_ID_KEY)).toBe('legacy-id');
  });

  it('leaves legacy keys in place after migration', () => {
    localStorage.setItem('wheelson-player-guild-1', 'legacy-id');
    migrateLegacyDiscordId();
    expect(localStorage.getItem('wheelson-player-guild-1')).toBe('legacy-id');
  });
});

describe('realmToSlug', () => {
  it('lowercases', () => {
    expect(realmToSlug('Stormrage')).toBe('stormrage');
  });
  it('strips apostrophes', () => {
    expect(realmToSlug("Kel'Thuzad")).toBe('kelthuzad');
  });
  it('replaces spaces with dashes', () => {
    expect(realmToSlug('Area 52')).toBe('area-52');
  });
  it('trims leading/trailing dashes', () => {
    expect(realmToSlug('--foo--')).toBe('foo');
  });
});

describe('parseInGameName', () => {
  it('returns null for null/undefined/empty input', () => {
    expect(parseInGameName(null)).toBeNull();
    expect(parseInGameName(undefined)).toBeNull();
    expect(parseInGameName('')).toBeNull();
  });
  it('returns null when there is no dash', () => {
    expect(parseInGameName('Tytanium')).toBeNull();
  });
  it('returns null when name or realm is empty', () => {
    expect(parseInGameName('-Stormrage')).toBeNull();
    expect(parseInGameName('Tytanium-')).toBeNull();
  });
  it('parses Name-Realm into name and realmSlug', () => {
    expect(parseInGameName('Tytanium-Stormrage')).toEqual({ name: 'Tytanium', realmSlug: 'stormrage' });
  });
  it('handles realms with spaces', () => {
    expect(parseInGameName('Foo-Area 52')).toEqual({ name: 'Foo', realmSlug: 'area-52' });
  });
});
