import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadStoredDiscordId,
  saveStoredDiscordId,
  migrateLegacyStorage,
  DISCORD_ID_KEY,
} from './storedDiscordId';

beforeEach(() => {
  localStorage.clear();
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

describe('migrateLegacyStorage', () => {
  it('keeps an existing Discord ID', () => {
    localStorage.setItem(DISCORD_ID_KEY, 'new-id');
    localStorage.setItem('wheelson-player-guild-1', 'legacy-id');
    migrateLegacyStorage();
    expect(localStorage.getItem(DISCORD_ID_KEY)).toBe('new-id');
  });

  it('is a no-op when no legacy keys exist', () => {
    migrateLegacyStorage();
    expect(localStorage.getItem(DISCORD_ID_KEY)).toBeNull();
  });

  it('copies a legacy per-guild value to the global key', () => {
    localStorage.setItem('wheelson-player-guild-1', 'legacy-id');
    migrateLegacyStorage();
    expect(localStorage.getItem(DISCORD_ID_KEY)).toBe('legacy-id');
  });

  it('removes the retired local profile copy', () => {
    localStorage.setItem('wheelson-character', '{"inGameName":"X"}');
    migrateLegacyStorage();
    expect(localStorage.getItem('wheelson-character')).toBeNull();
  });
});
