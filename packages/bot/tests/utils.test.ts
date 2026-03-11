import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getWowName,
  getMaskedName,
  getDebugPlayers,
  getPlayerList,
  showLongTyping,
  showShortTyping,
} from '../src/core/utils.js';
import type { DiscordMember, TypingChannel } from '../src/core/utils.js';

// Mock the preference service
vi.mock('../src/core/preferenceService.js', () => {
  const mockSvc = {
    getPreferenceSync: vi.fn().mockReturnValue(null),
    getPreferenceByNameSync: vi.fn().mockReturnValue(null),
    getInGameNameSync: vi.fn().mockReturnValue(''),
  };
  return {
    getPreferenceService: vi.fn().mockReturnValue(mockSvc),
    PreferenceService: vi.fn(),
    _resetInstance: vi.fn(),
  };
});

describe('getWowName', () => {
  it('prioritizes nick > global > str and removes dots', () => {
    // Case 1: Nickname exists
    const member1: DiscordMember = {
      nick: 'Nick.Name',
      global_name: 'Global.Name',
      id: '1',
      toString: () => 'User.Name',
    };
    expect(getWowName(member1)).toBe('NickName');

    // Case 2: No nick, global name exists
    const member2: DiscordMember = {
      nick: null,
      global_name: 'Global.Name',
      id: '2',
      toString: () => 'User.Name',
    };
    expect(getWowName(member2)).toBe('GlobalName');

    // Case 3: No nick, no global name
    const member3: DiscordMember = {
      nick: null,
      global_name: null,
      id: '3',
      toString: () => 'User.Name',
    };
    expect(getWowName(member3)).toBe('UserName');
  });
});

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

describe('getPlayerList', () => {
  it('returns all members with or without roles', async () => {
    const { getPreferenceService } = await import('../src/core/preferenceService.js');
    const mockSvc = getPreferenceService();
    vi.mocked(mockSvc.getPreferenceSync).mockImplementation((discordId: string) => {
      if (discordId === '111') return ['Tank'];
      return null;
    });
    vi.mocked(mockSvc.getPreferenceByNameSync).mockReturnValue(null);

    const members: DiscordMember[] = [
      { nick: 'SavedPlayer', id: '111', toString: () => 'SavedPlayer' },
      { nick: 'NoRolesPlayer', id: '222', toString: () => 'NoRolesPlayer' },
      { nick: 'AnotherPlayer', id: '333', toString: () => 'AnotherPlayer' },
    ];

    const players = getPlayerList(members);
    expect(players.length).toBe(3);

    const p1 = players.find((p) => p.name === 'SavedPlayer');
    expect(p1).toBeTruthy();
    expect(p1!.tankMain).toBe(true);
    expect(p1!.hasRoles()).toBe(true);
    expect(p1!.discordId).toBe('111');

    const p2 = players.find((p) => p.name === 'NoRolesPlayer');
    expect(p2).toBeTruthy();
    expect(p2!.hasRoles()).toBe(false);
    expect(p2!.discordId).toBe('222');

    const p3 = players.find((p) => p.name === 'AnotherPlayer');
    expect(p3).toBeTruthy();
    expect(p3!.hasRoles()).toBe(false);
  });
});

describe('getMaskedName', () => {
  it('returns question marks equal to string length', () => {
    expect(getMaskedName('abc')).toBe('???');
    expect(getMaskedName('')).toBe('');
    expect(getMaskedName('hello world')).toBe('???????????');
  });
});

describe('Typing functions', () => {
  let channel: TypingChannel;

  beforeEach(() => {
    channel = { sendTyping: vi.fn().mockResolvedValue(undefined) };
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('showLongTyping calls sendTyping and waits 2000ms in non-debug mode', async () => {
    const promise = showLongTyping(channel, false);

    // sendTyping should be called immediately
    expect(channel.sendTyping).toHaveBeenCalled();

    // Advance timers by the expected delay
    await vi.advanceTimersByTimeAsync(2000);

    // Promise should resolve now
    await promise;
  });

  it('showLongTyping does not call sendTyping in debug mode', async () => {
    await showLongTyping(channel, true);
    expect(channel.sendTyping).not.toHaveBeenCalled();
  });

  it('showShortTyping calls sendTyping and waits 1000ms in non-debug mode', async () => {
    const promise = showShortTyping(channel, false);

    // sendTyping should be called immediately
    expect(channel.sendTyping).toHaveBeenCalled();

    // Advance timers by the expected delay
    await vi.advanceTimersByTimeAsync(1000);

    // Promise should resolve now
    await promise;
  });

  it('showShortTyping does not call sendTyping in debug mode', async () => {
    await showShortTyping(channel, true);
    expect(channel.sendTyping).not.toHaveBeenCalled();
  });
});
