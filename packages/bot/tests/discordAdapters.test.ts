import { describe, it, expect, vi } from 'vitest';
import type { Guild as DjsGuild, VoiceChannel as DjsVoiceChannel } from 'discord.js';
import { adaptGuild, buildVoiceChannelsSnapshot } from '../src/core/discordAdapters.js';
import type { VoiceChannel } from '../src/services/sessionService.js';

describe('discordAdapters', () => {
  describe('buildVoiceChannelsSnapshot', () => {
    it('should calculate userCount excluding bots and map to snapshot', () => {
      const channels = [
        {
          id: 'c1',
          name: 'Channel 1',
          members: [{ bot: false }, { bot: true }, { bot: false }] as unknown as ReadonlyArray<{ bot: boolean }>,
        }
      ];
      const result = buildVoiceChannelsSnapshot(channels);
      expect(result).toEqual([
        { id: 'c1', name: 'Channel 1', userCount: 2 }
      ]);
    });

    it('should sort correctly by userCount desc then name asc when sorted is true', () => {
      const channels = [
        { id: 'c1', name: 'Zeta', members: [{ bot: false }] as unknown as ReadonlyArray<{ bot: boolean }> },
        { id: 'c2', name: 'Alpha', members: [{ bot: false }] as unknown as ReadonlyArray<{ bot: boolean }> },
        { id: 'c3', name: 'Beta', members: [{ bot: false }, { bot: false }] as unknown as ReadonlyArray<{ bot: boolean }> },
      ];
      const result = buildVoiceChannelsSnapshot(channels, { sorted: true });
      expect(result).toEqual([
        { id: 'c3', name: 'Beta', userCount: 2 },
        { id: 'c2', name: 'Alpha', userCount: 1 },
        { id: 'c1', name: 'Zeta', userCount: 1 },
      ]);
    });
  });

  describe('adaptGuild', () => {
    it('should return null if djsGuild is null', () => {
      expect(adaptGuild(null, vi.fn())).toBeNull();
    });

    it('should adapt basic guild properties', () => {
      const mockDjsGuild = {
        id: 'g1',
        name: 'Guild 1',
        iconURL: () => 'http://icon.url',
        channels: { cache: new Map() },
      } as unknown as DjsGuild;
      const result = adaptGuild(mockDjsGuild, vi.fn() as unknown as (ch: DjsVoiceChannel) => VoiceChannel);
      expect(result).toEqual(expect.objectContaining({
        id: 'g1',
        name: 'Guild 1',
        icon: { url: 'http://icon.url' }
      }));
    });

    it('should handle missing icon URL', () => {
      const mockDjsGuild = {
        id: 'g1',
        name: 'Guild 1',
        iconURL: () => null,
        channels: { cache: new Map() },
      } as unknown as DjsGuild;
      const result = adaptGuild(mockDjsGuild, vi.fn() as unknown as (ch: DjsVoiceChannel) => VoiceChannel);
      expect(result?.icon).toBeNull();
    });

    it('should filter and map voice channels lazily', () => {
      const v1 = { id: 'v1', isVoiceBased: () => true };
      const t1 = { id: 't1', isVoiceBased: () => false };
      const cache = new Map([['v1', v1], ['t1', t1]]);
      const mockDjsGuild = {
        id: 'g1',
        name: 'Guild 1',
        iconURL: () => null,
        channels: {
          cache: {
            filter: (predicate: (v: unknown) => boolean) => Array.from(cache.values()).filter(predicate),
            get: (id: string) => cache.get(id),
          }
        },
      } as unknown as DjsGuild;

      const mockAdaptVoiceChannel = vi.fn((ch) => ({ id: ch.id, adapted: true }));
      const result = adaptGuild(mockDjsGuild, mockAdaptVoiceChannel as unknown as (ch: DjsVoiceChannel) => VoiceChannel);

      const channels = result?.voice_channels;
      expect(channels).toEqual([{ id: 'v1', adapted: true }]);
      expect(mockAdaptVoiceChannel).toHaveBeenCalledWith(v1);
      expect(mockAdaptVoiceChannel).not.toHaveBeenCalledWith(t1);
    });

    it('should get a specific voice channel', () => {
      const v1 = { id: 'v1', isVoiceBased: () => true };
      const t1 = { id: 't1', isVoiceBased: () => false };
      const cache = new Map([['v1', v1], ['t1', t1]]);
      const mockDjsGuild = {
        id: 'g1',
        name: 'Guild 1',
        iconURL: () => null,
        channels: {
          cache,
        },
      } as unknown as DjsGuild;

      const mockAdaptVoiceChannel = vi.fn((ch) => ({ id: ch.id, adapted: true }));
      const result = adaptGuild(mockDjsGuild, mockAdaptVoiceChannel as unknown as (ch: DjsVoiceChannel) => VoiceChannel);

      expect(result?.get_channel('v1')).toEqual({ id: 'v1', adapted: true });
      expect(result?.get_channel('t1')).toBeNull(); // not voice based
      expect(result?.get_channel('x1')).toBeNull(); // does not exist
    });
  });
});
