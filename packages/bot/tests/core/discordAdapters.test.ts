import { describe, it, expect, vi } from 'vitest';
import { adaptGuild, buildVoiceChannelsSnapshot } from '../../src/core/discordAdapters.js';
import type { Guild as DjsGuild } from 'discord.js';

describe('buildVoiceChannelsSnapshot', () => {
  it('builds an unsorted snapshot', () => {
    const channels = [
      { id: '1', name: 'Zeta', members: [{ bot: false }, { bot: false }] },
      { id: '2', name: 'Alpha', members: [{ bot: false }] },
      { id: '3', name: 'Beta', members: [{ bot: false }, { bot: false }, { bot: true }] },
    ];

    const snapshot = buildVoiceChannelsSnapshot(channels, { sorted: false });

    expect(snapshot).toEqual([
      { id: '1', name: 'Zeta', userCount: 2 },
      { id: '2', name: 'Alpha', userCount: 1 },
      { id: '3', name: 'Beta', userCount: 2 },
    ]);
  });

  it('builds a sorted snapshot', () => {
    const channels = [
      { id: '1', name: 'Zeta', members: [{ bot: false }] },
      { id: '2', name: 'Alpha', members: [{ bot: false }, { bot: false }] },
      { id: '3', name: 'Beta', members: [{ bot: false }, { bot: false }] },
    ];

    const snapshot = buildVoiceChannelsSnapshot(channels, { sorted: true });

    // Sorts by userCount DESC, then name ASC
    expect(snapshot).toEqual([
      { id: '2', name: 'Alpha', userCount: 2 },
      { id: '3', name: 'Beta', userCount: 2 },
      { id: '1', name: 'Zeta', userCount: 1 },
    ]);
  });
});

describe('adaptGuild', () => {
  it('returns null if djsGuild is null', () => {
    expect(adaptGuild(null, vi.fn())).toBeNull();
  });

  it('adapts guild icon URL', () => {
    const mockGuild = {
      id: '123',
      name: 'Test Guild',
      iconURL: () => 'http://example.com/icon.png',
      channels: { cache: { filter: vi.fn(), get: vi.fn() } }
    } as unknown as DjsGuild;

    const adapted = adaptGuild(mockGuild, vi.fn());
    expect(adapted?.icon).toEqual({ url: 'http://example.com/icon.png' });
  });

  it('adapts guild without icon URL', () => {
    const mockGuild = {
      id: '123',
      name: 'Test Guild',
      iconURL: () => null,
      channels: { cache: { filter: vi.fn(), get: vi.fn() } }
    } as unknown as DjsGuild;

    const adapted = adaptGuild(mockGuild, vi.fn());
    expect(adapted?.icon).toBeNull();
  });

  it('fetches voice channels lazily filtering isVoiceBased', () => {
    const mockVoiceChannel = { id: 'vc1', isVoiceBased: () => true };
    const mockTextChannel = { id: 'tc1', isVoiceBased: () => false };

    const channelsArray = [mockVoiceChannel, mockTextChannel];

    const mockCache = {
      filter: (predicate: (value: unknown) => unknown) => {
        return channelsArray.filter(predicate);
      }
    };

    const mockGuild = {
      id: '123',
      name: 'Test Guild',
      iconURL: () => null,
      channels: { cache: mockCache }
    } as unknown as DjsGuild;

    const adaptVoiceChannel = vi.fn().mockImplementation((ch) => ({ id: ch.id, name: 'Adapted' }));
    const adapted = adaptGuild(mockGuild, adaptVoiceChannel);

    expect(adapted?.voice_channels).toHaveLength(1);
    expect(adaptVoiceChannel).toHaveBeenCalledWith(mockVoiceChannel);
    expect(adaptVoiceChannel).not.toHaveBeenCalledWith(mockTextChannel);
  });

  it('fetches channel by id using get_channel', () => {
    const mockVoiceChannel = { id: 'vc1', isVoiceBased: () => true };
    const mockTextChannel = { id: 'tc1', isVoiceBased: () => false };

    const mockCache = new Map([
      ['vc1', mockVoiceChannel],
      ['tc1', mockTextChannel]
    ]);

    const mockGuild = {
      id: '123',
      name: 'Test Guild',
      iconURL: () => null,
      channels: { cache: mockCache }
    } as unknown as DjsGuild;

    const adaptVoiceChannel = vi.fn().mockImplementation((ch) => ({ id: ch.id, name: 'Adapted' }));
    const adapted = adaptGuild(mockGuild, adaptVoiceChannel);

    // Non-existent channel
    expect(adapted?.get_channel('unknown')).toBeNull();

    // Text channel
    expect(adapted?.get_channel('tc1')).toBeNull();

    // Voice channel
    expect(adapted?.get_channel('vc1')).toEqual({ id: 'vc1', name: 'Adapted' });
    expect(adaptVoiceChannel).toHaveBeenCalledWith(mockVoiceChannel);
  });
});
