import { describe, it, expect } from 'vitest';
import { getDebugPlayers } from '../src/core/debugFixtures.js';

describe('getDebugPlayers', () => {
  it('returns valid list of WoWPlayers', () => {
    const players = getDebugPlayers();
    expect(players.length).toBeGreaterThan(0);
    for (const player of players) {
      expect(player.name).toBeTruthy();
      expect(player.hasRoles()).toBe(true);
    }
  });
});
