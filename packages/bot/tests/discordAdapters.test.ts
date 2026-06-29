import { describe, it, expect, vi } from 'vitest';
import { buildVoiceChannelsSnapshot, adaptGuild } from '../src/core/discordAdapters.js';
import type { Guild as DjsGuild } from 'discord.js';

describe('discordAdapters', () => {
  describe('buildVoiceChannelsSnapshot', () => {
    it('builds unsorted snapshot', () => {
      const channels = [
        { id: '1', name: 'Zeta', members: [{ bot: false }, { bot: false }] },
        { id: '2', name: 'Alpha', members: [{ bot: false }, { bot: true }] },
      ];
      const snapshot = buildVoiceChannelsSnapshot(channels);
      expect(snapshot).toEqual([
        { id: '1', name: 'Zeta', userCount: 2 },
        { id: '2', name: 'Alpha', userCount: 1 },
      ]);
    });

    it('builds sorted snapshot (by userCount desc, then name asc)', () => {
      const channels = [
        { id: '1', name: 'Zeta', members: [{ bot: false }, { bot: false }] },
        { id: '2', name: 'Alpha', members: [{ bot: false }] },
        { id: '3', name: 'Bravo', members: [{ bot: false }] },
      ];
      const snapshot = buildVoiceChannelsSnapshot(channels, { sorted: true });
      expect(snapshot).toEqual([
        { id: '1', name: 'Zeta', userCount: 2 },
        { id: '2', name: 'Alpha', userCount: 1 },
        { id: '3', name: 'Bravo', userCount: 1 },
      ]);
    });
  });

  describe('adaptGuild', () => {
    it('returns null if djsGuild is null', () => {
      expect(adaptGuild(null, vi.fn())).toBeNull();
    });

    it('adapts a guild with iconURL and processes channels correctly', () => {
      const mockVoiceChannel = { id: 'vc1', isVoiceBased: () => true };
      const mockTextChannel = { id: 'text1', isVoiceBased: () => false };

      const mockChannelsCache = {
        filter: (fn: (ch: unknown) => boolean) => [mockVoiceChannel, mockTextChannel].filter(fn),
        get: (id: string) => [mockVoiceChannel, mockTextChannel].find(c => c.id === id) || null,
      };

      const mockDjsGuild = {
        id: 'guild123',
        name: 'Test Guild',
        iconURL: vi.fn().mockReturnValue('https://example.com/icon.png'),
        channels: {
          cache: mockChannelsCache,
        },
      } as unknown as DjsGuild;

      const adaptVoiceChannel = vi.fn().mockImplementation((ch) => ({ id: ch.id, adapted: true }));

      const adapted = adaptGuild(mockDjsGuild, adaptVoiceChannel);

      expect(adapted).not.toBeNull();
      expect(adapted!.id).toBe('guild123');
      expect(adapted!.name).toBe('Test Guild');
      expect(adapted!.icon).toEqual({ url: 'https://example.com/icon.png' });

      // Test lazy voice_channels getter
      const vcs = adapted!.voice_channels;
      expect(vcs).toHaveLength(1);
      expect(vcs[0]).toEqual({ id: 'vc1', adapted: true });
      expect(adaptVoiceChannel).toHaveBeenCalledTimes(1);
      expect(adaptVoiceChannel).toHaveBeenCalledWith(mockVoiceChannel);

      // Test get_channel for voice channel
      const ch1 = adapted!.get_channel('vc1');
      expect(ch1).toEqual({ id: 'vc1', adapted: true });

      // Test get_channel for text channel
      const textCh = adapted!.get_channel('text1');
      expect(textCh).toBeNull();

      // Test get_channel for missing channel
      const missingCh = adapted!.get_channel('missing');
      expect(missingCh).toBeNull();
    });

    it('adapts a guild without iconURL', () => {
      const mockDjsGuild = {
        id: 'guild456',
        name: 'No Icon Guild',
        iconURL: vi.fn().mockReturnValue(null),
        channels: {
          cache: {
            filter: () => [],
            get: () => null,
          },
        },
      } as unknown as DjsGuild;

      const adapted = adaptGuild(mockDjsGuild, vi.fn());

      expect(adapted!.icon).toBeNull();
    });
  });
});
