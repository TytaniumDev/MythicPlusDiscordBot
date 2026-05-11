import { describe, it, expect, vi } from 'vitest';
import { adaptGuild, buildVoiceChannelsSnapshot } from '../src/core/discordAdapters.js';

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
      expect(adaptGuild(null, vi.fn())).toBeNull();
    });

    it('adapts a guild properly', () => {
      const mockAdaptVoiceChannel = vi.fn((ch) => ({ id: ch.id, name: ch.name }));
      const mockDjsGuild = {
        id: 'g1',
        name: 'My Guild',
        iconURL: () => 'http://icon.url',
        channels: {
          cache: {
            filter: vi.fn().mockReturnValue([
              { id: 'v1', name: 'Voice 1', isVoiceBased: () => true },
            ]),
            map: vi.fn().mockImplementation(function (this: any, fn) {
              return this.filter().map(fn);
            }),
            get: vi.fn().mockImplementation((id) => {
              if (id === 'v1') return { id: 'v1', name: 'Voice 1', isVoiceBased: () => true };
              if (id === 't1') return { id: 't1', name: 'Text 1', isVoiceBased: () => false };
              return null;
            }),
          },
        },
      } as any;

      const adapted = adaptGuild(mockDjsGuild, mockAdaptVoiceChannel);
      expect(adapted).not.toBeNull();
      expect(adapted?.id).toBe('g1');
      expect(adapted?.name).toBe('My Guild');
      expect(adapted?.icon).toEqual({ url: 'http://icon.url' });

      // Test lazy getter
      const vc = adapted?.voice_channels;
      expect(vc).toEqual([{ id: 'v1', name: 'Voice 1' }]);

      // Test get_channel
      expect(adapted?.get_channel('v1')).toEqual({ id: 'v1', name: 'Voice 1' });
      expect(adapted?.get_channel('t1')).toBeNull();
      expect(adapted?.get_channel('unknown')).toBeNull();
    });

    it('handles null iconURL', () => {
      const mockDjsGuild = {
        id: 'g1',
        name: 'My Guild',
        iconURL: () => null,
        channels: { cache: { filter: vi.fn(), map: vi.fn(), get: vi.fn() } },
      } as any;
      const adapted = adaptGuild(mockDjsGuild, vi.fn());
      expect(adapted?.icon).toBeNull();
    });
  });
});
