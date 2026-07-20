import { describe, it, expect, vi } from 'vitest';
import { buildVoiceChannelsSnapshot, adaptGuild } from '../src/core/discordAdapters.js';
import type { Guild as DjsGuild } from 'discord.js';

describe('discordAdapters', () => {
  describe('buildVoiceChannelsSnapshot', () => {
    it('computes correct user count, ignoring bots', () => {
      const channels = [
        {
          id: '1',
          name: 'Channel 1',
          members: [{ bot: false }, { bot: true }, { bot: false }]
        }
      ];

      const result = buildVoiceChannelsSnapshot(channels);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: '1',
        name: 'Channel 1',
        userCount: 2
      });
    });

    it('sorts channels correctly when options.sorted is true', () => {
      const channels = [
        {
          id: '1',
          name: 'Z Channel',
          members: [{ bot: false }] // 1 user
        },
        {
          id: '2',
          name: 'A Channel',
          members: [{ bot: false }, { bot: false }] // 2 users
        },
        {
          id: '3',
          name: 'B Channel',
          members: [{ bot: false }] // 1 user
        }
      ];

      const result = buildVoiceChannelsSnapshot(channels, { sorted: true });

      expect(result).toEqual([
        { id: '2', name: 'A Channel', userCount: 2 },
        { id: '3', name: 'B Channel', userCount: 1 },
        { id: '1', name: 'Z Channel', userCount: 1 },
      ]);
    });
  });

  describe('adaptGuild', () => {
    it('returns null if djsGuild is null', () => {
      expect(adaptGuild(null, vi.fn())).toBeNull();
    });

    it('adapts a guild with primitive properties correctly', () => {
      const mockDjsGuild = {
        id: '123',
        name: 'Test Guild',
        iconURL: vi.fn().mockReturnValue('https://example.com/icon.png'),
        channels: { cache: new Map() }
      } as unknown as DjsGuild;

      const adapted = adaptGuild(mockDjsGuild, vi.fn());

      expect(adapted).not.toBeNull();
      expect(adapted?.id).toBe('123');
      expect(adapted?.name).toBe('Test Guild');
      expect(adapted?.icon).toEqual({ url: 'https://example.com/icon.png' });
    });

    it('adapts a guild without an icon correctly', () => {
      const mockDjsGuild = {
        id: '123',
        name: 'Test Guild',
        iconURL: vi.fn().mockReturnValue(null),
        channels: { cache: new Map() }
      } as unknown as DjsGuild;

      const adapted = adaptGuild(mockDjsGuild, vi.fn());

      expect(adapted).not.toBeNull();
      expect(adapted?.icon).toBeNull();
    });

    it('lazily evaluates voice_channels getter', () => {
      const adaptMock = vi.fn().mockImplementation((ch) => ({ id: ch.id }));

      const channelCache = new Map<string, unknown>();
      channelCache.set('c1', { id: 'c1', isVoiceBased: () => true });
      channelCache.set('c2', { id: 'c2', isVoiceBased: () => false });
      channelCache.set('c3', { id: 'c3', isVoiceBased: () => true });

      const mockDjsGuild = {
        id: '123',
        name: 'Test Guild',
        iconURL: vi.fn().mockReturnValue(null),
        channels: {
          cache: {
            filter: (predicate: (v: unknown) => boolean) => {
              const res = new Map();
              for (const [k, v] of channelCache.entries()) {
                if (predicate(v)) res.set(k, v);
              }
              return res;
            },
            get: (id: string) => channelCache.get(id)
          }
        }
      } as unknown as DjsGuild;

      // Ensure cache logic behaves somewhat like Discord Collection
      const mockCache: unknown = {
        filter: function(predicate: (v: unknown) => boolean) {
          const res = new Map();
          for (const [k, v] of channelCache.entries()) {
            if (predicate(v)) res.set(k, v);
          }
          return {
            map: function(mapper: (v: unknown) => unknown) {
              const out = [];
              for (const v of res.values()) {
                out.push(mapper(v));
              }
              return out;
            }
          };
        },
        get: (id: string) => channelCache.get(id)
      };

      (mockDjsGuild as { channels: { cache: unknown } }).channels.cache = mockCache;

      const adapted = adaptGuild(mockDjsGuild, adaptMock);

      expect(adaptMock).not.toHaveBeenCalled(); // Lazy evaluation

      const voiceChannels = adapted?.voice_channels;

      expect(voiceChannels).toHaveLength(2);
      expect(voiceChannels).toEqual([{ id: 'c1' }, { id: 'c3' }]);
      expect(adaptMock).toHaveBeenCalledTimes(2);
    });

    it('retrieves and adapts a specific voice channel by id', () => {
      const adaptMock = vi.fn().mockImplementation((ch) => ({ id: ch.id }));

      const channelCache = new Map<string, unknown>();
      channelCache.set('c1', { id: 'c1', isVoiceBased: () => true });
      channelCache.set('c2', { id: 'c2', isVoiceBased: () => false });

      const mockDjsGuild = {
        id: '123',
        name: 'Test Guild',
        iconURL: vi.fn().mockReturnValue(null),
        channels: {
          cache: channelCache
        }
      } as unknown as DjsGuild;

      const adapted = adaptGuild(mockDjsGuild, adaptMock);

      const vc = adapted?.get_channel('c1');
      expect(vc).toEqual({ id: 'c1' });
      expect(adaptMock).toHaveBeenCalledTimes(1);

      const textChannel = adapted?.get_channel('c2');
      expect(textChannel).toBeNull();

      const nonExistent = adapted?.get_channel('c99');
      expect(nonExistent).toBeNull();
    });
  });
});
