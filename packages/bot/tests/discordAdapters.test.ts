import { describe, it, expect, vi } from 'vitest';
import { adaptGuild, buildVoiceChannelsSnapshot } from '../src/core/discordAdapters.js';
import type { Guild as DjsGuild, VoiceChannel as DjsVoiceChannel } from 'discord.js';
import type { VoiceChannel } from '../src/services/sessionService.js';

describe('discordAdapters', () => {
  describe('buildVoiceChannelsSnapshot', () => {
    it('should build snapshots without sorting', () => {
      const channels = [
        { id: '1', name: 'Alpha', members: [{ bot: false }, { bot: true }] },
        { id: '2', name: 'Bravo', members: [{ bot: false }, { bot: false }] },
      ];
      const snapshot = buildVoiceChannelsSnapshot(channels);
      expect(snapshot).toEqual([
        { id: '1', name: 'Alpha', userCount: 1 },
        { id: '2', name: 'Bravo', userCount: 2 },
      ]);
    });

    it('should sort by userCount descending, then by name', () => {
      const channels = [
        { id: '1', name: 'Bravo', members: [{ bot: false }] },
        { id: '2', name: 'Alpha', members: [{ bot: false }] },
        { id: '3', name: 'Charlie', members: [{ bot: false }, { bot: false }] },
      ];
      const snapshot = buildVoiceChannelsSnapshot(channels, { sorted: true });
      expect(snapshot).toEqual([
        { id: '3', name: 'Charlie', userCount: 2 },
        { id: '2', name: 'Alpha', userCount: 1 },
        { id: '1', name: 'Bravo', userCount: 1 },
      ]);
    });
  });

  describe('adaptGuild', () => {
    it('returns null if djsGuild is null', () => {
      expect(adaptGuild(null, vi.fn() as unknown as (ch: DjsVoiceChannel) => VoiceChannel)).toBeNull();
    });

    it('adapts a guild properly', () => {
      const mockAdaptVoiceChannel = vi.fn((ch: DjsVoiceChannel) => ({
        id: ch.id,
        name: ch.name,
        members: [],
        send: vi.fn(),
      } as unknown as VoiceChannel));

      const mockDjsGuild = {
        id: 'g1',
        name: 'My Guild',
        iconURL: () => 'http://icon.url',
        channels: {
          cache: {
            filter: vi.fn().mockReturnValue([
              { id: 'v1', name: 'Voice 1', isVoiceBased: () => true },
            ]),
            map: vi.fn().mockImplementation(function (this: { filter: () => unknown[] }, fn: (val: unknown) => unknown) {
              return this.filter().map((x) => fn(x));
            }),
            get: vi.fn().mockImplementation((id: string) => {
              if (id === 'v1') return { id: 'v1', name: 'Voice 1', isVoiceBased: () => true };
              if (id === 't1') return { id: 't1', name: 'Text 1', isVoiceBased: () => false };
              return null;
            }),
          },
        },
      } as unknown as DjsGuild;

      const adapted = adaptGuild(mockDjsGuild, mockAdaptVoiceChannel);
      expect(adapted).not.toBeNull();
      expect(adapted?.id).toBe('g1');
      expect(adapted?.name).toBe('My Guild');
      expect(adapted?.icon).toEqual({ url: 'http://icon.url' });

      // Test lazy getter
      const vc = adapted?.voice_channels;
      expect(vc).toEqual([{ id: 'v1', name: 'Voice 1', members: [], send: expect.any(Function) }]);

      // Test get_channel
      expect(adapted?.get_channel('v1')).toEqual({ id: 'v1', name: 'Voice 1', members: [], send: expect.any(Function) });
      expect(adapted?.get_channel('t1')).toBeNull();
      expect(adapted?.get_channel('unknown')).toBeNull();
    });

    it('handles null iconURL', () => {
      const mockDjsGuild = {
        id: 'g1',
        name: 'My Guild',
        iconURL: () => null,
        channels: { cache: { filter: vi.fn(), map: vi.fn(), get: vi.fn() } },
      } as unknown as DjsGuild;
      const adapted = adaptGuild(mockDjsGuild, vi.fn() as unknown as (ch: DjsVoiceChannel) => VoiceChannel);
      expect(adapted?.icon).toBeNull();
    });
  });
});
