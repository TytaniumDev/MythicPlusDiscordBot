import { describe, expect, it, vi } from 'vitest';
import { adaptGuild, buildVoiceChannelsSnapshot } from '../src/core/discordAdapters.js';
import type { Guild as DjsGuild } from 'discord.js';

describe('discordAdapters', () => {
  describe('buildVoiceChannelsSnapshot', () => {
    it('calculates userCount excluding bots', () => {
      const channels = [
        {
          id: '1',
          name: 'General',
          members: [
            { bot: false },
            { bot: true },
            { bot: false },
          ],
        },
        {
          id: '2',
          name: 'Empty',
          members: [
            { bot: true },
          ],
        },
      ];

      const snapshot = buildVoiceChannelsSnapshot(channels);

      expect(snapshot).toHaveLength(2);
      expect(snapshot[0]).toEqual({ id: '1', name: 'General', userCount: 2 });
      expect(snapshot[1]).toEqual({ id: '2', name: 'Empty', userCount: 0 });
    });

    it('sorts channels by userCount (desc) then name (asc) when sorted option is true', () => {
      const channels = [
        { id: '1', name: 'Zeta', members: [{ bot: false }] }, // count: 1
        { id: '2', name: 'Alpha', members: [{ bot: false }] }, // count: 1
        { id: '3', name: 'Beta', members: [{ bot: false }, { bot: false }] }, // count: 2
        { id: '4', name: 'Gamma', members: [] }, // count: 0
      ];

      const snapshot = buildVoiceChannelsSnapshot(channels, { sorted: true });

      expect(snapshot.map((s) => s.name)).toEqual(['Beta', 'Alpha', 'Zeta', 'Gamma']);
    });

    it('returns empty array when given empty iterable', () => {
      const snapshot = buildVoiceChannelsSnapshot([]);
      expect(snapshot).toEqual([]);
    });
  });

  describe('adaptGuild', () => {
    it('returns null if djsGuild is null', () => {
      expect(adaptGuild(null, vi.fn())).toBeNull();
    });

    it('maps standard properties correctly', () => {
      const mockDjsGuild = {
        id: 'guild123',
        name: 'My Guild',
        iconURL: vi.fn().mockReturnValue('https://example.com/icon.png'),
        channels: {
          cache: {
            filter: vi.fn().mockReturnValue({ map: vi.fn() }),
            get: vi.fn(),
          },
        },
      } as unknown as DjsGuild;

      const adapted = adaptGuild(mockDjsGuild, vi.fn());

      expect(adapted).toBeDefined();
      expect(adapted?.id).toBe('guild123');
      expect(adapted?.name).toBe('My Guild');
      expect(adapted?.icon).toEqual({ url: 'https://example.com/icon.png' });
    });

    it('maps icon correctly when iconURL is null', () => {
      const mockDjsGuild = {
        id: 'guild123',
        name: 'My Guild',
        iconURL: vi.fn().mockReturnValue(null),
        channels: {
          cache: {
            filter: vi.fn().mockReturnValue({ map: vi.fn() }),
            get: vi.fn(),
          },
        },
      } as unknown as DjsGuild;

      const adapted = adaptGuild(mockDjsGuild, vi.fn());

      expect(adapted?.icon).toBeNull();
    });

    it('lazily evaluates voice_channels via getter', () => {
      const mockCh1 = { isVoiceBased: () => true, id: 'ch1' };
      const mockCh2 = { isVoiceBased: () => false, id: 'ch2' };
      const mockCh3 = { isVoiceBased: () => true, id: 'ch3' };

      const channelsCacheArray = [mockCh1, mockCh2, mockCh3];

      const mockDjsGuild = {
        id: 'guild123',
        name: 'My Guild',
        iconURL: vi.fn().mockReturnValue(null),
        channels: {
          cache: {
            filter: vi.fn().mockImplementation((predicate: any) => {
              const filtered = channelsCacheArray.filter(predicate);
              return {
                map: vi.fn().mockImplementation((mapper: any) => filtered.map(mapper))
              };
            }),
            get: vi.fn(),
          },
        },
      } as unknown as DjsGuild;

      const adaptVoiceChannel = vi.fn().mockImplementation((ch) => ({ id: `adapted-${ch.id}` }));

      const adapted = adaptGuild(mockDjsGuild, adaptVoiceChannel);

      // Before accessing voice_channels getter, filter/map shouldn't be called.
      expect(mockDjsGuild.channels.cache.filter).not.toHaveBeenCalled();

      const channels = adapted?.voice_channels;

      expect(channels).toHaveLength(2);
      expect(channels).toEqual([{ id: 'adapted-ch1' }, { id: 'adapted-ch3' }]);

      expect(mockDjsGuild.channels.cache.filter).toHaveBeenCalled();
      expect(adaptVoiceChannel).toHaveBeenCalledTimes(2);
    });

    it('get_channel returns adapted channel if it exists and is voice based', () => {
      const mockCh1 = { isVoiceBased: () => true, id: 'ch1' };
      const mockDjsGuild = {
        id: 'guild123',
        name: 'My Guild',
        iconURL: vi.fn().mockReturnValue(null),
        channels: {
          cache: {
            get: vi.fn().mockImplementation((id: string) => id === 'ch1' ? mockCh1 : undefined),
          },
        },
      } as unknown as DjsGuild;

      const adaptVoiceChannel = vi.fn().mockImplementation((ch) => ({ id: `adapted-${ch.id}` }));

      const adapted = adaptGuild(mockDjsGuild, adaptVoiceChannel);

      const ch = adapted?.get_channel('ch1');

      expect(ch).toEqual({ id: 'adapted-ch1' });
      expect(adaptVoiceChannel).toHaveBeenCalledTimes(1);
    });

    it('get_channel returns null if channel does not exist', () => {
      const mockDjsGuild = {
        id: 'guild123',
        name: 'My Guild',
        iconURL: vi.fn().mockReturnValue(null),
        channels: {
          cache: {
            get: vi.fn().mockReturnValue(undefined),
          },
        },
      } as unknown as DjsGuild;

      const adapted = adaptGuild(mockDjsGuild, vi.fn());

      const ch = adapted?.get_channel('ch1');

      expect(ch).toBeNull();
    });

    it('get_channel returns null if channel is not voice based', () => {
      const mockCh1 = { isVoiceBased: () => false, id: 'ch1' };
      const mockDjsGuild = {
        id: 'guild123',
        name: 'My Guild',
        iconURL: vi.fn().mockReturnValue(null),
        channels: {
          cache: {
            get: vi.fn().mockImplementation((id: string) => id === 'ch1' ? mockCh1 : undefined),
          },
        },
      } as unknown as DjsGuild;

      const adaptVoiceChannel = vi.fn();
      const adapted = adaptGuild(mockDjsGuild, adaptVoiceChannel);

      const ch = adapted?.get_channel('ch1');

      expect(ch).toBeNull();
      expect(adaptVoiceChannel).not.toHaveBeenCalled();
    });
  });
});
