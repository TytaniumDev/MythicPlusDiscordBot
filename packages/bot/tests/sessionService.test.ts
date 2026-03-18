import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WoWGroup } from '@mythicplus/shared';

vi.mock('@mythicplus/shared', async () => {
  const actual = await vi.importActual('@mythicplus/shared');
  return {
    ...(actual as Record<string, unknown>),
    createMythicPlusGroups: vi.fn(),
  };
});

vi.mock('../src/core/firebaseService.js', () => ({
  FirebaseService: { getInstance: vi.fn() },
  ARRAY_UNION: (...elements: unknown[]) => ({ __type: 'arrayUnion', elements }),
  ARRAY_REMOVE: (...elements: unknown[]) => ({ __type: 'arrayRemove', elements }),
}));

vi.mock('../src/core/utils.js', () => ({
  getPlayerList: vi.fn(),
  getDebugPlayers: vi.fn(),
  getPlayerFromMember: vi.fn(),
  getWowName: vi.fn(),
  getMaskedName: vi.fn((n: string) => '?'.repeat(n.length)),
  showLongTyping: vi.fn().mockResolvedValue(undefined),
  showShortTyping: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/core/groupUi.js', () => ({
  buildGroupEmbed: vi.fn(),
  announceGroup: vi.fn(),
}));

vi.mock('../src/core/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../src/core/preferenceService.js', () => ({
  getPreferenceService: vi.fn().mockReturnValue({
    getPreferenceSync: vi.fn().mockReturnValue(null),
    getPreferenceByNameSync: vi.fn().mockReturnValue(null),
  }),
}));

import {
  SessionService,
  type Bot,
  type Guild,
  type VoiceChannel,
} from '../src/services/sessionService.js';
import { getPlayerList } from '../src/core/utils.js';
import { buildGroupEmbed } from '../src/core/groupUi.js';
// createMythicPlusGroups is mocked above but no longer directly referenced in tests
import {
  TankPaladin,
  HealerPriest,
  Warrior,
  Mage,
} from './prebuiltClasses.js';

// ---------- helpers ----------

interface MockFirebase {
  isAvailable: ReturnType<typeof vi.fn>;
  getOrCreateGuildDoc: ReturnType<typeof vi.fn>;
  getOrCreateChannelDoc: ReturnType<typeof vi.fn>;
  updateGuildDoc: ReturnType<typeof vi.fn>;
  updateChannelDoc: ReturnType<typeof vi.fn>;
  deleteChannelDoc: ReturnType<typeof vi.fn>;
  deleteGuildDoc: ReturnType<typeof vi.fn>;
}

function createMockFirebase(): MockFirebase {
  return {
    isAvailable: vi.fn().mockReturnValue(true),
    getOrCreateGuildDoc: vi.fn().mockResolvedValue('guild-1'),
    getOrCreateChannelDoc: vi.fn().mockResolvedValue('channel-1'),
    updateGuildDoc: vi.fn().mockResolvedValue(undefined),
    updateChannelDoc: vi.fn().mockResolvedValue(undefined),
    deleteChannelDoc: vi.fn().mockResolvedValue(undefined),
    deleteGuildDoc: vi.fn().mockResolvedValue(undefined),
  };
}

function makeMember(name: string, bot = false) {
  return { nick: name, global_name: null, id: name, bot, toString: () => name };
}

function makeVoiceChannel(
  id: string,
  name: string,
  members: ReturnType<typeof makeMember>[] = [],
): VoiceChannel {
  return {
    id,
    name,
    members,
    send: vi.fn().mockResolvedValue(undefined),
  };
}

function makeGuild(
  id: string,
  channels: VoiceChannel[] = [],
  overrides: Partial<Guild> = {},
): Guild {
  return {
    id,
    name: 'Test Guild',
    icon: { url: 'http://icon' },
    voice_channels: channels,
    get_channel: vi.fn((chId: string) => channels.find((c) => c.id === chId) ?? null),
    ...overrides,
  };
}

function makeBot(overrides: Partial<Bot> = {}): Bot {
  return {
    get_guild: vi.fn().mockReturnValue(null),
    ...overrides,
  };
}

function makeService(bot?: Bot, firebase?: MockFirebase) {
  const fb = firebase ?? createMockFirebase();
  const b = bot ?? makeBot();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = new SessionService(b, fb as any);
  return { service, bot: b, firebase: fb };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------- getOrCreateSession ----------

describe('SessionService.getOrCreateSession', () => {
  it('creates guild and channel docs and returns IDs', async () => {
    const vc = makeVoiceChannel('99', 'Raid', [makeMember('P1')]);
    const guild = makeGuild('1', [vc]);
    const firebase = createMockFirebase();
    firebase.getOrCreateGuildDoc.mockResolvedValue('1');
    firebase.getOrCreateChannelDoc.mockResolvedValue('99');

    const bot = makeBot();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new SessionService(bot, firebase as any);

    vi.mocked(getPlayerList).mockReturnValue([]);

    const ctx = {
      guild,
      author: { voice: { channel: { id: '99', name: 'Raid' } } },
    };

    const result = await service.getOrCreateSession(ctx);

    expect(result).not.toBeNull();
    const [guildDocId, channelDocId] = result!;
    expect(guildDocId).toBe('1');
    expect(channelDocId).toBe('99');
    expect(service.activeGuilds.has('1')).toBe(true);
    expect(service.activeChannels.has('99')).toBe(true);

    expect(firebase.getOrCreateGuildDoc).toHaveBeenCalledWith('1', 'Test Guild', 'http://icon');
    expect(firebase.getOrCreateChannelDoc).toHaveBeenCalledWith('99', '1', 'Raid', false);
  });

  it('returns null when firebase is unavailable', async () => {
    const firebase = createMockFirebase();
    firebase.isAvailable.mockReturnValue(false);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new SessionService(makeBot(), firebase as any);

    const ctx = {
      guild: makeGuild('1'),
      author: { voice: { channel: { id: '99', name: 'Raid' } } },
    };

    const result = await service.getOrCreateSession(ctx);
    expect(result).toBeNull();
  });

  it('returns null when guild is null', async () => {
    const { service } = makeService();
    const ctx = { guild: null, author: { voice: { channel: { id: '99', name: 'Raid' } } } };

    const result = await service.getOrCreateSession(ctx);
    expect(result).toBeNull();
  });

  it('returns null when author is not in a voice channel', async () => {
    const firebase = createMockFirebase();
    const guild = makeGuild('1');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new SessionService(makeBot(), firebase as any);

    const ctx = { guild, author: { voice: null } };
    const result = await service.getOrCreateSession(ctx);
    expect(result).toBeNull();
  });
});

// ---------- updateChannelPlayers ----------

describe('SessionService.updateChannelPlayers', () => {
  it('writes player data to channel doc', async () => {
    const firebase = createMockFirebase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new SessionService(makeBot(), firebase as any);
    service.activeChannels.set('42', { docId: '42', guildId: '1' });

    const vc = makeVoiceChannel('42', 'Raid', [makeMember('Tank1')]);
    const guild = makeGuild('1', [vc]);

    const player = TankPaladin('Tank1');
    vi.mocked(getPlayerList).mockReturnValue([player]);

    await service.updateChannelPlayers('42', guild);

    expect(firebase.updateChannelDoc).toHaveBeenCalledOnce();
    const [docId, data] = firebase.updateChannelDoc.mock.calls[0];
    expect(docId).toBe('42');
    expect(data.players).toHaveLength(1);
  });

  it('skips untracked channels', async () => {
    const firebase = createMockFirebase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new SessionService(makeBot(), firebase as any);
    // No active channels

    const guild = makeGuild('1');
    await service.updateChannelPlayers('42', guild);

    expect(firebase.updateChannelDoc).not.toHaveBeenCalled();
  });

  it('writes empty players when channel is gone', async () => {
    const firebase = createMockFirebase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new SessionService(makeBot(), firebase as any);
    service.activeChannels.set('42', { docId: '42', guildId: '1' });

    // Guild returns null for channel
    const guild = makeGuild('1');

    await service.updateChannelPlayers('42', guild);

    const data = firebase.updateChannelDoc.mock.calls[0][1];
    expect(data.players).toEqual([]);
  });
});

// ---------- refreshGuildVoiceChannels ----------

describe('SessionService.refreshGuildVoiceChannels', () => {
  it('writes voice channels to guild doc', async () => {
    const firebase = createMockFirebase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new SessionService(makeBot(), firebase as any);

    const vc1 = makeVoiceChannel('42', 'Raid', [makeMember('P1'), makeMember('P2')]);
    const vc2 = makeVoiceChannel('43', 'AFK', []);
    const guild = makeGuild('1', [vc1, vc2]);

    await service.refreshGuildVoiceChannels(guild);

    expect(firebase.updateGuildDoc).toHaveBeenCalledOnce();
    const [guildIdStr, data] = firebase.updateGuildDoc.mock.calls[0];
    expect(guildIdStr).toBe('1');

    const channels = data.voiceChannels;
    expect(channels).toHaveLength(2);
    expect(channels[0].id).toBe('42');
    expect(channels[0].userCount).toBe(2);
    expect(channels[1].id).toBe('43');
    expect(channels[1].userCount).toBe(0);
  });

  it('sorts by user count descending', async () => {
    const firebase = createMockFirebase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new SessionService(makeBot(), firebase as any);

    const vc1 = makeVoiceChannel('42', 'Small', [makeMember('P1')]);
    const vc2 = makeVoiceChannel(
      '43',
      'Big',
      Array.from({ length: 5 }, (_, i) => makeMember(`P${i}`)),
    );
    const vc3 = makeVoiceChannel(
      '44',
      'Medium',
      Array.from({ length: 3 }, (_, i) => makeMember(`Q${i}`)),
    );
    const guild = makeGuild('1', [vc1, vc2, vc3]);

    await service.refreshGuildVoiceChannels(guild);

    const channels = firebase.updateGuildDoc.mock.calls[0][1].voiceChannels;
    expect(channels).toHaveLength(3);
    expect(channels[0].name).toBe('Big');
    expect(channels[0].userCount).toBe(5);
    expect(channels[1].name).toBe('Medium');
    expect(channels[2].name).toBe('Small');
  });

  it('sorts empty channels alphabetically', async () => {
    const firebase = createMockFirebase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new SessionService(makeBot(), firebase as any);

    const vc1 = makeVoiceChannel('42', 'Zeta', []);
    const vc2 = makeVoiceChannel('43', 'Alpha', []);
    const vc3 = makeVoiceChannel('44', 'Mango', []);
    const guild = makeGuild('1', [vc1, vc2, vc3]);

    await service.refreshGuildVoiceChannels(guild);

    const channels = firebase.updateGuildDoc.mock.calls[0][1].voiceChannels;
    expect(channels[0].name).toBe('Alpha');
    expect(channels[1].name).toBe('Mango');
    expect(channels[2].name).toBe('Zeta');
  });

  it('filters bots from user count', async () => {
    const firebase = createMockFirebase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new SessionService(makeBot(), firebase as any);

    const vc = makeVoiceChannel('42', 'Raid', [
      makeMember('Human'),
      makeMember('Bot', true),
    ]);
    const guild = makeGuild('1', [vc]);

    await service.refreshGuildVoiceChannels(guild);

    const channels = firebase.updateGuildDoc.mock.calls[0][1].voiceChannels;
    expect(channels[0].userCount).toBe(1);
  });
});

// ---------- announceCompletion ----------

describe('SessionService.announceCompletion', () => {
  it('deserializes groups from Firestore data', async () => {
    const firebase = createMockFirebase();

    const tank = TankPaladin('Tank1');
    const healer = HealerPriest('Healer1');
    const group = new WoWGroup(tank, healer, [Warrior('D1')]);
    const groupDict = group.toDict();

    const vc = makeVoiceChannel('42', 'Raid');
    const bot = makeBot();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new SessionService(bot, firebase as any);

    const mockEmbed = { title: 'Group 1', color: 0, fields: [] };
    vi.mocked(buildGroupEmbed).mockReturnValue(mockEmbed);

    await service.announceCompletion(vc, { groups: [groupDict] });

    expect(buildGroupEmbed).toHaveBeenCalledOnce();
    const reconstructed = vi.mocked(buildGroupEmbed).mock.calls[0][0];
    expect(reconstructed.tank).not.toBeNull();
    expect(reconstructed.tank!.name).toBe('Tank1');
    expect(vc.send).toHaveBeenCalledOnce();
  });

  it('sends fallback message when no groups', async () => {
    const firebase = createMockFirebase();

    const vc = makeVoiceChannel('42', 'Raid');
    const bot = makeBot();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new SessionService(bot, firebase as any);

    await service.announceCompletion(vc, { groups: [] });

    expect(vc.send).toHaveBeenCalledWith('No groups were formed this round.');
  });

  it('sends one embed per group', async () => {
    const firebase = createMockFirebase();

    const group1 = new WoWGroup(TankPaladin('T1'), HealerPriest('H1'), [Warrior('D1')]);
    const group2 = new WoWGroup(TankPaladin('T2'), HealerPriest('H2'), [Mage('D2')]);

    const vc = makeVoiceChannel('42', 'Raid');
    const bot = makeBot();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new SessionService(bot, firebase as any);

    const mockEmbed = { title: '', color: 0, fields: [] };
    vi.mocked(buildGroupEmbed).mockReturnValue(mockEmbed);

    await service.announceCompletion(vc, {
      groups: [group1.toDict(), group2.toDict()],
    });

    expect(buildGroupEmbed).toHaveBeenCalledTimes(2);
    expect(vc.send).toHaveBeenCalledTimes(2);
  });
});

// ---------- cleanupChannel ----------

describe('SessionService.cleanupChannel', () => {
  it('removes tracking, deletes docs, and cleans up guild', async () => {
    const firebase = createMockFirebase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new SessionService(makeBot(), firebase as any);

    const mockWatch = { unsubscribe: vi.fn() };
    service.activeChannels.set('42', { docId: '42', guildId: '1' });
    service.activeGuilds.add('1');
    service.channelListeners.set('42', mockWatch);
    service.guildListeners.set('1', { unsubscribe: vi.fn() });

    await service.cleanupChannel('42');

    expect(service.activeChannels.has('42')).toBe(false);
    expect(service.channelListeners.has('42')).toBe(false);
    expect(mockWatch.unsubscribe).toHaveBeenCalledOnce();
    expect(firebase.deleteChannelDoc).toHaveBeenCalledWith('42');

    // Last channel for guild → guild also cleaned up
    expect(service.activeGuilds.has('1')).toBe(false);
    expect(firebase.deleteGuildDoc).toHaveBeenCalledWith('1');
  });

  it('keeps guild when other channels exist', async () => {
    const firebase = createMockFirebase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new SessionService(makeBot(), firebase as any);

    service.activeChannels.set('42', { docId: '42', guildId: '1' });
    service.activeChannels.set('43', { docId: '43', guildId: '1' });
    service.activeGuilds.add('1');
    service.channelListeners.set('42', { unsubscribe: vi.fn() });

    await service.cleanupChannel('42');

    expect(service.activeChannels.has('42')).toBe(false);
    expect(service.activeChannels.has('43')).toBe(true);
    expect(service.activeGuilds.has('1')).toBe(true);
    expect(firebase.deleteGuildDoc).not.toHaveBeenCalled();
  });

  it('is a no-op for nonexistent channels', async () => {
    const firebase = createMockFirebase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new SessionService(makeBot(), firebase as any);

    await service.cleanupChannel('999');

    expect(firebase.deleteChannelDoc).not.toHaveBeenCalled();
  });
});

// ---------- getActiveChannelIdsForGuild ----------

describe('SessionService.getActiveChannelIdsForGuild', () => {
  it('returns matching channel IDs', () => {
    const { service } = makeService();

    service.activeChannels.set('42', { docId: '42', guildId: '1' });
    service.activeChannels.set('43', { docId: '43', guildId: '1' });
    service.activeChannels.set('99', { docId: '99', guildId: '2' });

    const result = service.getActiveChannelIdsForGuild('1');
    expect(result.sort()).toEqual(['42', '43']);
  });

  it('returns empty for unknown guild', () => {
    const { service } = makeService();

    const result = service.getActiveChannelIdsForGuild('999');
    expect(result).toEqual([]);
  });
});

// ---------- handleCollectionRemoved ----------

describe('SessionService.handleCollectionRemoved', () => {
  it('cleans up tracking on removed event', () => {
    const { service } = makeService();

    const mockWatch = { unsubscribe: vi.fn() };
    service.activeChannels.set('42', { docId: '42', guildId: '1' });
    service.activeGuilds.add('1');
    service.channelListeners.set('42', mockWatch);

    service.handleCollectionRemoved({ document: { id: '42' } });

    expect(service.activeChannels.has('42')).toBe(false);
    expect(service.channelListeners.has('42')).toBe(false);
    expect(mockWatch.unsubscribe).toHaveBeenCalledOnce();
    // Guild also cleaned up (last channel)
    expect(service.activeGuilds.has('1')).toBe(false);
  });

  it('handles removed event even without channel listener', () => {
    const { service } = makeService();

    service.activeChannels.set('42', { docId: '42', guildId: '1' });
    service.activeGuilds.add('1');
    // No channel listener set

    service.handleCollectionRemoved({ document: { id: '42' } });

    expect(service.activeChannels.has('42')).toBe(false);
    expect(service.activeGuilds.has('1')).toBe(false);
  });

  it('keeps guild when other channels exist', () => {
    const { service } = makeService();

    service.activeChannels.set('42', { docId: '42', guildId: '1' });
    service.activeChannels.set('43', { docId: '43', guildId: '1' });
    service.activeGuilds.add('1');
    service.channelListeners.set('42', { unsubscribe: vi.fn() });

    service.handleCollectionRemoved({ document: { id: '42' } });

    expect(service.activeChannels.has('42')).toBe(false);
    expect(service.activeChannels.has('43')).toBe(true);
    expect(service.activeGuilds.has('1')).toBe(true);
  });

  it('ignores unknown channel IDs', () => {
    const { service } = makeService();

    service.handleCollectionRemoved({ document: { id: 'not-tracked' } });

    // Should not throw or modify state
    expect(service.activeChannels.size).toBe(0);
  });
});

// ---------- toggleSitOut ----------

describe('SessionService.toggleSitOut', () => {
  function makeFirebaseWithDb(sittingOut?: string[]) {
    const firebase = createMockFirebase();
    const mockDocSnap = {
      exists: true,
      data: () => ({ sittingOut }),
    };
    const mockDocRef = {
      get: vi.fn().mockResolvedValue(mockDocSnap),
    };
    const mockCollection = {
      doc: vi.fn().mockReturnValue(mockDocRef),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (firebase as any).db = { collection: vi.fn().mockReturnValue(mockCollection) };
    return { firebase, mockDocRef, mockDocSnap };
  }

  it('returns active: false when channel not tracked', async () => {
    const { service } = makeService();

    const result = await service.toggleSitOut('42', 'user1');
    expect(result).toEqual({ active: false, sittingOut: false });
  });

  it('adds user to sittingOut when not currently sitting out', async () => {
    const { firebase } = makeFirebaseWithDb([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new SessionService(makeBot(), firebase as any);
    service.activeChannels.set('42', { docId: '42', guildId: '1' });

    const result = await service.toggleSitOut('42', 'user1');

    expect(result).toEqual({ active: true, sittingOut: true });
    expect(firebase.updateChannelDoc).toHaveBeenCalledWith('42', {
      sittingOut: { __type: 'arrayUnion', elements: ['user1'] },
    });
  });

  it('removes user when currently sitting out', async () => {
    const { firebase } = makeFirebaseWithDb(['user1', 'user2']);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new SessionService(makeBot(), firebase as any);
    service.activeChannels.set('42', { docId: '42', guildId: '1' });

    const result = await service.toggleSitOut('42', 'user1');

    expect(result).toEqual({ active: true, sittingOut: false });
    expect(firebase.updateChannelDoc).toHaveBeenCalledWith('42', {
      sittingOut: { __type: 'arrayRemove', elements: ['user1'] },
    });
  });

  it('works with missing sittingOut field (treats as empty)', async () => {
    const { firebase } = makeFirebaseWithDb(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new SessionService(makeBot(), firebase as any);
    service.activeChannels.set('42', { docId: '42', guildId: '1' });

    const result = await service.toggleSitOut('42', 'user1');

    expect(result).toEqual({ active: true, sittingOut: true });
    expect(firebase.updateChannelDoc).toHaveBeenCalledWith('42', {
      sittingOut: { __type: 'arrayUnion', elements: ['user1'] },
    });
  });
});

// ---------- shutdown ----------

describe('SessionService.shutdown', () => {
  it('unsubscribes all listeners and clears state', () => {
    const { service } = makeService();

    const channelWatch = { unsubscribe: vi.fn() };
    const guildWatch = { unsubscribe: vi.fn() };

    service.activeChannels.set('42', { docId: '42', guildId: '1' });
    service.activeGuilds.add('1');
    service.channelListeners.set('42', channelWatch);
    service.guildListeners.set('1', guildWatch);

    service.shutdown();

    expect(channelWatch.unsubscribe).toHaveBeenCalledOnce();
    expect(guildWatch.unsubscribe).toHaveBeenCalledOnce();
    expect(service.channelListeners.size).toBe(0);
    expect(service.guildListeners.size).toBe(0);
    expect(service.activeChannels.size).toBe(0);
    expect(service.activeGuilds.size).toBe(0);
  });
});
