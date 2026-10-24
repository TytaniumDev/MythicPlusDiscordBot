import { describe, it, expect } from 'vitest';
import {
  LOBBY_TTL_MS,
  UNKNOWN_NAME,
  lobbySyncUpdate,
  newcomers,
  parseLobbySyncRequest,
  rosterFor,
} from '../src/lobbySync';

const ay = { discordId: '1', name: 'Ay' };
const bee = { discordId: '2', name: 'Bee' };
const NOW = Date.UTC(2026, 9, 24, 12);
const FRESH = new Date(NOW + 20 * 60 * 60 * 1000);

describe('parseLobbySyncRequest', () => {
  it('accepts a channel ID and an instance ID', () => {
    expect(parseLobbySyncRequest({ channelId: '2001', instanceId: 'i-123-gc-1-2001' }))
      .toEqual({ channelId: '2001', instanceId: 'i-123-gc-1-2001' });
  });

  it('rejects missing or malformed fields', () => {
    expect(parseLobbySyncRequest(null)).toBeNull();
    expect(parseLobbySyncRequest({ channelId: 'abc', instanceId: 'i-1' })).toBeNull();
    expect(parseLobbySyncRequest({ channelId: '2001' })).toBeNull();
    expect(parseLobbySyncRequest({ channelId: '2001', instanceId: '../x' })).toBeNull();
    expect(parseLobbySyncRequest({ channelId: '2001', instanceId: 'i'.repeat(129) })).toBeNull();
  });
});

describe('rosterFor', () => {
  it('keeps members who stay in place and appends newcomers by name', () => {
    const names = new Map([['3', 'Cee']]);
    expect(rosterFor(['3', '2', '1'], [ay, bee], names))
      .toEqual([ay, bee, { discordId: '3', name: 'Cee' }]);
  });

  it('drops members who closed the activity', () => {
    expect(rosterFor(['2'], [ay, bee], new Map())).toEqual([bee]);
  });

  it('names a newcomer Discord had no name for, and ignores repeats', () => {
    expect(rosterFor(['3', '3'], [], new Map())).toEqual([{ discordId: '3', name: UNKNOWN_NAME }]);
  });
});

describe('newcomers', () => {
  it('lists the users the lobby has no member for', () => {
    expect(newcomers(['1', '3', '3', '4'], [ay, bee])).toEqual(['3', '4']);
  });
});

describe('lobbySyncUpdate', () => {
  it('writes nothing when the roster, instance and expiry are current', () => {
    const lobby = { members: [ay, bee], instanceId: 'i-1', expireAt: FRESH };
    expect(lobbySyncUpdate(lobby, 'i-1', [ay, bee], NOW)).toBeNull();
  });

  it('writes a changed roster with a new expiry', () => {
    const lobby = { members: [ay], instanceId: 'i-1', expireAt: FRESH };
    expect(lobbySyncUpdate(lobby, 'i-1', [ay, bee], NOW)).toEqual({
      members: [ay, bee],
      instanceId: 'i-1',
      expireAt: new Date(NOW + LOBBY_TTL_MS),
    });
  });

  it('pushes out an expiry that is running low', () => {
    const lobby = { members: [ay], instanceId: 'i-1', expireAt: new Date(NOW + 60 * 60 * 1000) };
    expect(lobbySyncUpdate(lobby, 'i-1', [ay], NOW)).toEqual({
      members: [ay],
      instanceId: 'i-1',
      expireAt: new Date(NOW + LOBBY_TTL_MS),
    });
  });

  it("clears the last session's round for a new activity instance", () => {
    const lobby = { members: [ay], instanceId: 'i-old', expireAt: FRESH };
    expect(lobbySyncUpdate(lobby, 'i-new', [ay], NOW)).toEqual({
      members: [ay],
      instanceId: 'i-new',
      expireAt: new Date(NOW + LOBBY_TTL_MS),
      status: 'lobby',
      groups: [],
      revealedGroups: 0,
      sittingOut: [],
      claimedPlayers: [],
    });
  });

  it('treats a lobby without an instance as a new one', () => {
    const update = lobbySyncUpdate({ members: [], instanceId: null, expireAt: null }, 'i-1', [ay], NOW);
    expect(update).toMatchObject({ members: [ay], instanceId: 'i-1', status: 'lobby' });
  });
});
