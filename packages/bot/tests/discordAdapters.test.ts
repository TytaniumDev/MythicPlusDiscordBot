import { describe, it, expect, vi } from 'vitest';
import { adaptGuild, buildVoiceChannelsSnapshot } from '../src/core/discordAdapters.js';
import type { Guild as DjsGuild } from 'discord.js';

describe('discordAdapters', () => {
  describe('buildVoiceChannelsSnapshot', () => {
    it('builds snapshot without sorting', () => {
      const channels = [
        { id: '1', name: 'Zeta', members: [{ bot: false }, { bot: false }] },
        { id: '2', name: 'Alpha', members: [{ bot: false }, { bot: true }] },
      ];

      const result = buildVoiceChannelsSnapshot(channels);
      expect(result).toEqual([
        { id: '1', name: 'Zeta', userCount: 2 },
        { id: '2', name: 'Alpha', userCount: 1 },
      ]);
    });

    it('builds snapshot with sorting (userCount desc, then name asc)', () => {
      const channels = [
        { id: '1', name: 'Zeta', members: [{ bot: false }] },
        { id: '2', name: 'Alpha', members: [{ bot: false }, { bot: false }] },
        { id: '3', name: 'Beta', members: [{ bot: false }] },
        { id: '4', name: 'Alpha-2', members: [{ bot: false }, { bot: false }] },
      ];

      const result = buildVoiceChannelsSnapshot(channels, { sorted: true });
      expect(result).toEqual([
        { id: '2', name: 'Alpha', userCount: 2 },
        { id: '4', name: 'Alpha-2', userCount: 2 },
        { id: '3', name: 'Beta', userCount: 1 },
        { id: '1', name: 'Zeta', userCount: 1 },
      ]);
    });
  });

  describe('adaptGuild', () => {
    it('returns null if djsGuild is null', () => {
      expect(adaptGuild(null, vi.fn())).toBeNull();
    });

    it('adapts a guild and lazy evaluates voice channels', () => {
      const mockChannel1 = { isVoiceBased: () => true, id: 'c1' };
      const mockChannel2 = { isVoiceBased: () => false, id: 'c2' };

      const mockChannelsArray = [mockChannel1, mockChannel2];

      const mockChannelsCache = {
        filter: vi.fn().mockImplementation((predicate) => mockChannelsArray.filter(predicate)),
        get: vi.fn((id: string) => mockChannelsArray.find(ch => ch.id === id)),
      };

      const mockDjsGuild = {
        id: 'g1',
        name: 'Test Guild',
        iconURL: vi.fn().mockReturnValue('http://icon.url'),
        channels: {
          cache: mockChannelsCache
        }
      } as unknown as DjsGuild;

      const adaptVoiceChannel = vi.fn().mockImplementation((ch) => ({ id: ch.id, adapted: true }));

      const adapted = adaptGuild(mockDjsGuild, adaptVoiceChannel);

      expect(adapted).not.toBeNull();
      expect(adapted?.id).toBe('g1');
      expect(adapted?.name).toBe('Test Guild');
      expect(adapted?.icon).toEqual({ url: 'http://icon.url' });

      // Test lazy voice_channels getter
      const vcs = adapted?.voice_channels;
      expect(vcs).toHaveLength(1);
      expect(vcs?.[0]).toEqual({ id: 'c1', adapted: true });
      expect(adaptVoiceChannel).toHaveBeenCalledWith(mockChannel1);

      // Test get_channel
      const ch1 = adapted?.get_channel('c1');
      expect(ch1).toEqual({ id: 'c1', adapted: true });

      const ch2 = adapted?.get_channel('c2'); // Not voice based
      expect(ch2).toBeNull();

      const ch3 = adapted?.get_channel('missing');
      expect(ch3).toBeNull();
    });

    it('handles null iconURL', () => {
      const mockDjsGuild = {
        id: 'g1',
        name: 'Test Guild',
        iconURL: vi.fn().mockReturnValue(null),
        channels: { cache: { filter: vi.fn().mockReturnValue([]) } }
      } as unknown as DjsGuild;

      const adapted = adaptGuild(mockDjsGuild, vi.fn());
      expect(adapted?.icon).toBeNull();
    });
  });
});
