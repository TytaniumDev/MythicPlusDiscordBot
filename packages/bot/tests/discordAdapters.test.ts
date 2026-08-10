import { describe, it, expect, vi } from 'vitest';
import {
  buildVoiceChannelsSnapshot,
  adaptGuild,
} from '../src/core/discordAdapters.js';
import type { Guild as DjsGuild, VoiceChannel as DjsVoiceChannel } from 'discord.js';

describe('discordAdapters', () => {
  describe('buildVoiceChannelsSnapshot', () => {
    it('builds a snapshot and filters out bots from userCount', () => {
      const channels = [
        {
          id: 'ch1',
          name: 'General',
          members: [
            { bot: false },
            { bot: false },
            { bot: true },
          ],
        },
      ];

      const snapshot = buildVoiceChannelsSnapshot(channels);
      expect(snapshot).toHaveLength(1);
      expect(snapshot[0]).toEqual({
        id: 'ch1',
        name: 'General',
        userCount: 2,
      });
    });

    it('sorts channels by userCount desc then alphabetically by name when options.sorted is true', () => {
      const channels = [
        { id: 'ch1', name: 'Zebra', members: [{ bot: false }] }, // 1 user
        { id: 'ch2', name: 'Apple', members: [{ bot: false }, { bot: false }] }, // 2 users
        { id: 'ch3', name: 'Alpha', members: [{ bot: false }] }, // 1 user
      ];

      const snapshot = buildVoiceChannelsSnapshot(channels, { sorted: true });
      expect(snapshot).toHaveLength(3);
      // Apple (2) > Alpha (1) > Zebra (1)
      expect(snapshot[0]?.id).toBe('ch2');
      expect(snapshot[1]?.id).toBe('ch3');
      expect(snapshot[2]?.id).toBe('ch1');
    });
  });

  describe('adaptGuild', () => {
    it('returns null if djsGuild is null', () => {
      expect(adaptGuild(null, vi.fn())).toBeNull();
    });

    it('adapts a guild, maps properties, and accesses voice channels via lazy getter', () => {
      const mockIconUrl = 'https://example.com/icon.png';

      const mockCh1 = { id: 'c1', isVoiceBased: () => true } as unknown as DjsVoiceChannel;
      const mockCh2 = { id: 'c2', isVoiceBased: () => false } as unknown as DjsVoiceChannel;
      const mockCh3 = { id: 'c3', isVoiceBased: () => true } as unknown as DjsVoiceChannel;

      // Mock Discord Collection using an array and filter/map
      const mockChannelsCache = {
        filter: vi.fn((predicate) => {
           const arr = [mockCh1, mockCh2, mockCh3].filter(predicate);
           return {
             map: (mapFn: (value: DjsVoiceChannel) => unknown) => arr.map(mapFn)
           };
        }),
        get: vi.fn((id) => [mockCh1, mockCh2, mockCh3].find(c => c.id === id)),
      };

      const mockDjsGuild = {
        id: 'g1',
        name: 'My Guild',
        iconURL: () => mockIconUrl,
        channels: {
          cache: mockChannelsCache,
        },
      } as unknown as DjsGuild;

      const adaptVoiceChannel = vi.fn((ch: DjsVoiceChannel) => ({
        id: ch.id,
        name: `Adapted-${ch.id}`,
        members: [],
        send: vi.fn()
      }));

      const guild = adaptGuild(mockDjsGuild, adaptVoiceChannel);
      expect(guild).not.toBeNull();
      expect(guild?.id).toBe('g1');
      expect(guild?.name).toBe('My Guild');
      expect(guild?.icon?.url).toBe(mockIconUrl);

      // Trigger lazy getter
      const voiceChannels = guild?.voice_channels;
      expect(voiceChannels).toHaveLength(2); // c1 and c3 are voice based
      expect(voiceChannels?.[0]?.id).toBe('c1');
      expect(voiceChannels?.[1]?.id).toBe('c3');

      expect(adaptVoiceChannel).toHaveBeenCalledTimes(2);
      expect(adaptVoiceChannel).toHaveBeenCalledWith(mockCh1);
      expect(adaptVoiceChannel).toHaveBeenCalledWith(mockCh3);
    });

    it('returns null icon if djsGuild iconURL returns null', () => {
      const mockDjsGuild = {
        id: 'g2',
        name: 'No Icon Guild',
        iconURL: () => null,
        channels: { cache: { filter: vi.fn(), get: vi.fn() } },
      } as unknown as DjsGuild;

      const guild = adaptGuild(mockDjsGuild, vi.fn());
      expect(guild?.icon).toBeNull();
    });

    it('get_channel returns specific adapted channel or null if not found/not voice based', () => {
       const mockCh1 = { id: 'c1', isVoiceBased: () => true } as unknown as DjsVoiceChannel;
       const mockCh2 = { id: 'c2', isVoiceBased: () => false } as unknown as DjsVoiceChannel;

       const mockChannelsCache = {
          get: vi.fn((id) => [mockCh1, mockCh2].find(c => c.id === id)),
       };

       const mockDjsGuild = {
         id: 'g1',
         name: 'Test Guild',
         iconURL: () => null,
         channels: { cache: mockChannelsCache }
       } as unknown as DjsGuild;

       const adaptVoiceChannel = vi.fn((ch: DjsVoiceChannel) => ({
        id: ch.id,
        name: `Adapted-${ch.id}`,
        members: [],
        send: vi.fn()
      }));

      const guild = adaptGuild(mockDjsGuild, adaptVoiceChannel);

      const c1 = guild?.get_channel('c1');
      expect(c1?.id).toBe('c1');
      expect(adaptVoiceChannel).toHaveBeenCalledWith(mockCh1);

      // Not voice based
      const c2 = guild?.get_channel('c2');
      expect(c2).toBeNull();

      // Not found
      const c3 = guild?.get_channel('c3');
      expect(c3).toBeNull();
    });
  });
});
