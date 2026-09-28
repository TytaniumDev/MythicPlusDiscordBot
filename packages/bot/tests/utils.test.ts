import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getWowName,
  getMaskedName,
  toLobbyMember,
  showLongTyping,
  showShortTyping,
} from '../src/core/utils.js';
import type { DiscordMember, TypingChannel } from '../src/core/utils.js';

describe('getWowName', () => {
  it('prioritizes nick > global > str and removes dots', () => {
    // Case 1: Nickname exists
    const member1: DiscordMember = {
      nick: 'Nick.Name',
      global_name: 'Global.Name',
      id: '1',
      bot: false,
      toString: () => 'User.Name',
    };
    expect(getWowName(member1)).toBe('NickName');

    // Case 2: No nick, global name exists
    const member2: DiscordMember = {
      nick: null,
      global_name: 'Global.Name',
      id: '2',
      bot: false,
      toString: () => 'User.Name',
    };
    expect(getWowName(member2)).toBe('GlobalName');

    // Case 3: No nick, no global name
    const member3: DiscordMember = {
      nick: null,
      global_name: null,
      id: '3',
      bot: false,
      toString: () => 'User.Name',
    };
    expect(getWowName(member3)).toBe('UserName');
  });
});

describe('toLobbyMember', () => {
  it('pairs the Discord ID with the dot-stripped display name', () => {
    const member: DiscordMember = {
      nick: 'Mr.Tank',
      id: '111',
      bot: false,
      toString: () => 'Mr.Tank',
    };
    expect(toLobbyMember(member)).toEqual({ discordId: '111', name: 'MrTank' });
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
