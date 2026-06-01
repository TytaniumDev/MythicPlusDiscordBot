import { describe, it, expect, vi } from 'vitest';
import {
  buildVoiceChannelsSnapshot,
  adaptGuild,
} from '../../src/core/discordAdapters.js';
import type { Guild as DjsGuild, VoiceChannel as DjsVoiceChannel } from 'discord.js';
import type { VoiceChannel } from '../../src/services/sessionService.js';
import type { Mock } from 'vitest';

describe('buildVoiceChannelsSnapshot', () => {
  it('builds a snapshot and excludes bots from userCount', () => {
    const channels = [
      {
        id: 'c1',
        name: 'Channel 1',
        members: [{ bot: false }, { bot: true }, { bot: false }],
      },
      {
        id: 'c2',
        name: 'Channel 2',
        members: [{ bot: true }],
      },
    ];

    const snapshot = buildVoiceChannelsSnapshot(channels);

    expect(snapshot).toEqual([
      { id: 'c1', name: 'Channel 1', userCount: 2 },
      { id: 'c2', name: 'Channel 2', userCount: 0 },
    ]);
  });

  it('sorts channels by userCount (descending) and then name (ascending) when sorted option is enabled', () => {
    const channels = [
      {
        id: 'c1',
        name: 'Zeta',
        members: [{ bot: false }, { bot: false }], // count: 2
      },
      {
        id: 'c2',
        name: 'Alpha',
        members: [{ bot: false }, { bot: false }, { bot: false }], // count: 3
      },
      {
        id: 'c3',
        name: 'Beta',
        members: [{ bot: false }, { bot: false }], // count: 2
      },
    ];

    const snapshot = buildVoiceChannelsSnapshot(channels, { sorted: true });

    expect(snapshot).toEqual([
      { id: 'c2', name: 'Alpha', userCount: 3 },
      { id: 'c3', name: 'Beta', userCount: 2 },
      { id: 'c1', name: 'Zeta', userCount: 2 },
    ]);
  });
});

describe('adaptGuild', () => {
  it('returns null if djsGuild is null', () => {
    expect(adaptGuild(null, vi.fn())).toBeNull();
  });

  it('adapts a guild properly', () => {
    // Mock discord.js guild and channels cache
    const mockIconUrl = 'https://example.com/icon.png';
    const mockChannelMap = new Map<string, { id: string; name: string; isVoiceBased: () => boolean }>([
      ['ch1', { id: 'ch1', name: 'V1', isVoiceBased: () => true }],
      ['ch2', { id: 'ch2', name: 'T1', isVoiceBased: () => false }],
      ['ch3', { id: 'ch3', name: 'V2', isVoiceBased: () => true }],
    ]);

    const mockDjsGuild = {
      id: 'g1',
      name: 'Test Guild',
      iconURL: () => mockIconUrl,
      channels: {
        cache: {
          filter: (predicate: (v: { id: string; name: string; isVoiceBased: () => boolean }) => boolean) => {
            const result = new Map();
            for (const [k, v] of mockChannelMap.entries()) {
              if (predicate(v)) result.set(k, v);
            }
            return {
              map: (mapFn: (v: { id: string; name: string; isVoiceBased: () => boolean }) => unknown) => Array.from(result.values()).map(mapFn),
            };
          },
          get: (id: string) => mockChannelMap.get(id),
        },
      },
    } as unknown as DjsGuild;

    const adaptVoiceChannelMock = vi.fn((ch: { id: string; name: string }) => ({
      id: ch.id,
      name: ch.name + '-adapted',
      members: [],
      send: vi.fn(),
    })) as unknown as Mock<(ch: DjsVoiceChannel) => VoiceChannel>;

    const guild = adaptGuild(mockDjsGuild, adaptVoiceChannelMock);

    expect(guild).not.toBeNull();
    expect(guild!.id).toBe('g1');
    expect(guild!.name).toBe('Test Guild');
    expect(guild!.icon).toEqual({ url: mockIconUrl });

    // Test voice_channels getter
    const voiceChannels = guild!.voice_channels;
    expect(voiceChannels).toHaveLength(2);
    expect(voiceChannels[0].id).toBe('ch1');
    expect(voiceChannels[0].name).toBe('V1-adapted');
    expect(voiceChannels[1].id).toBe('ch3');
    expect(voiceChannels[1].name).toBe('V2-adapted');
    expect(adaptVoiceChannelMock).toHaveBeenCalledTimes(2);

    // Test get_channel
    adaptVoiceChannelMock.mockClear();

    // Existing voice channel
    const v1 = guild!.get_channel('ch1');
    expect(v1).not.toBeNull();
    expect(v1!.id).toBe('ch1');
    expect(adaptVoiceChannelMock).toHaveBeenCalledTimes(1);

    // Existing text channel (not voice based)
    const t1 = guild!.get_channel('ch2');
    expect(t1).toBeNull();

    // Non-existing channel
    const none = guild!.get_channel('unknown');
    expect(none).toBeNull();
  });

  it('handles null iconUrl', () => {
    const mockDjsGuild = {
      id: 'g2',
      name: 'No Icon Guild',
      iconURL: () => null,
      channels: { cache: { filter: () => ({ map: () => [] }), get: () => undefined } },
    } as unknown as DjsGuild;

    const guild = adaptGuild(mockDjsGuild, vi.fn());
    expect(guild).not.toBeNull();
    expect(guild!.icon).toBeNull();
  });
});
