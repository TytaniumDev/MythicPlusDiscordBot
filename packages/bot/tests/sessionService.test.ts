import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('@mythicplus/shared', async () => {
  const actual = await vi.importActual('@mythicplus/shared');
  return {
    ...(actual as Record<string, unknown>),
    createMythicPlusGroups: vi.fn(),
  };
});

vi.mock('../src/core/firebaseService.js', () => ({
  FirebaseService: { getInstance: vi.fn() },
}));

vi.mock('../src/core/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  SessionService,
  type Bot,
  type Guild,
  type VoiceChannel,
} from '../src/services/sessionService.js';
import type { ChannelListenerHandlers } from '../src/core/firebaseService.js';

// ---------- helpers ----------

interface MockFirebase {
  isAvailable: ReturnType<typeof vi.fn>;
  getOrCreateGuildDoc: ReturnType<typeof vi.fn>;
  getOrCreateChannelDoc: ReturnType<typeof vi.fn>;
  updateGuildDoc: ReturnType<typeof vi.fn>;
  setChannelMembers: ReturnType<typeof vi.fn>;
  deleteChannelDoc: ReturnType<typeof vi.fn>;
  listenForChannels: ReturnType<typeof vi.fn>;
}

function createMockFirebase(): MockFirebase {
  return {
    isAvailable: vi.fn().mockReturnValue(true),
    getOrCreateGuildDoc: vi.fn().mockResolvedValue('guild-1'),
    getOrCreateChannelDoc: vi.fn().mockResolvedValue('channel-1'),
    updateGuildDoc: vi.fn().mockResolvedValue(undefined),
    setChannelMembers: vi.fn().mockResolvedValue(undefined),
    deleteChannelDoc: vi.fn().mockResolvedValue(undefined),
    listenForChannels: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
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

    const ctx = {
      guild,
      author: { voice: { channel: { id: '99', name: 'Raid' } } },
    };

    const result = await service.getOrCreateSession(ctx);

    expect(result).not.toBeNull();
    const [guildDocId, channelDocId] = result!;
    expect(guildDocId).toBe('1');
    expect(channelDocId).toBe('99');
    expect(service.activeChannels.has('99')).toBe(true);

    expect(firebase.getOrCreateGuildDoc).toHaveBeenCalledWith('1', 'Test Guild', 'http://icon');
    expect(firebase.getOrCreateChannelDoc).toHaveBeenCalledWith('99', '1', 'Raid', false);
  });

  it('publishes the voice members to the new lobby', async () => {
    const vc = makeVoiceChannel('99', 'Raid', [makeMember('P1'), makeMember('Bot', true)]);
    const guild = makeGuild('1', [vc]);
    const firebase = createMockFirebase();
    firebase.getOrCreateChannelDoc.mockResolvedValue('99');
    const bot = makeBot({ get_guild: vi.fn().mockReturnValue(guild) });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new SessionService(bot, firebase as any);

    await service.getOrCreateSession({
      guild,
      author: { voice: { channel: { id: '99', name: 'Raid' } } },
    });

    expect(firebase.setChannelMembers).toHaveBeenCalledWith('99', [{ discordId: 'P1', name: 'P1' }]);
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

// ---------- syncMembers ----------

describe('SessionService.syncMembers', () => {
  function serviceWithGuild(guild: Guild | null) {
    const firebase = createMockFirebase();
    const bot = makeBot({ get_guild: vi.fn().mockReturnValue(guild) });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new SessionService(bot, firebase as any);
    return { service, firebase };
  }

  it('writes the human voice members, dots stripped from names', async () => {
    const vc = makeVoiceChannel('42', 'Raid', [
      makeMember('Mr.Tank'),
      makeMember('Healer'),
      makeMember('Music', true),
    ]);
    const { service, firebase } = serviceWithGuild(makeGuild('1', [vc]));
    service.activeChannels.set('42', '1');

    await service.syncMembers('42');

    expect(firebase.setChannelMembers).toHaveBeenCalledWith('42', [
      { discordId: 'Mr.Tank', name: 'MrTank' },
      { discordId: 'Healer', name: 'Healer' },
    ]);
  });

  it('skips untracked channels', async () => {
    const { service, firebase } = serviceWithGuild(makeGuild('1'));

    await service.syncMembers('42');

    expect(firebase.setChannelMembers).not.toHaveBeenCalled();
  });

  it('writes no members when the voice channel is gone', async () => {
    const { service, firebase } = serviceWithGuild(makeGuild('1'));
    service.activeChannels.set('42', '1');

    await service.syncMembers('42');

    expect(firebase.setChannelMembers).toHaveBeenCalledWith('42', []);
  });

  it('writes no members when the guild is not cached', async () => {
    const { service, firebase } = serviceWithGuild(null);
    service.activeChannels.set('42', '1');

    await service.syncMembers('42');

    expect(firebase.setChannelMembers).toHaveBeenCalledWith('42', []);
  });
});

// ---------- onVoiceStateUpdate ----------

describe('SessionService.onVoiceStateUpdate', () => {
  function trackedService() {
    const vc = makeVoiceChannel('123', 'Raid', [makeMember('P1')]);
    const guild = makeGuild('456', [vc]);
    const firebase = createMockFirebase();
    const bot = makeBot({ get_guild: vi.fn().mockReturnValue(guild) });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new SessionService(bot, firebase as any);
    service.activeChannels.set('123', '456');
    return { service, firebase };
  }

  it('syncs a tracked channel someone joined', async () => {
    const { service, firebase } = trackedService();

    await service.onVoiceStateUpdate(
      { channel: null },
      { channel: { id: '123', members: [{ bot: false }] } },
    );

    expect(firebase.setChannelMembers).toHaveBeenCalledWith('123', [{ discordId: 'P1', name: 'P1' }]);
  });

  it('syncs a tracked channel someone left while humans remain', async () => {
    const { service, firebase } = trackedService();

    await service.onVoiceStateUpdate(
      { channel: { id: '123', members: [{ bot: false }] } },
      { channel: null },
    );

    expect(firebase.setChannelMembers).toHaveBeenCalledOnce();
    expect(firebase.deleteChannelDoc).not.toHaveBeenCalled();
  });

  it('deletes the lobby when the last human leaves', async () => {
    const { service, firebase } = trackedService();

    await service.onVoiceStateUpdate(
      { channel: { id: '123', members: [{ bot: true }] } },
      { channel: null },
    );

    expect(firebase.deleteChannelDoc).toHaveBeenCalledWith('123');
    expect(firebase.setChannelMembers).not.toHaveBeenCalled();
    expect(service.activeChannels.has('123')).toBe(false);
  });

  it('ignores same-channel events (mute/unmute)', async () => {
    const { service, firebase } = trackedService();
    const channel = { id: '123', members: [{ bot: false }] };

    await service.onVoiceStateUpdate({ channel }, { channel });

    expect(firebase.setChannelMembers).not.toHaveBeenCalled();
  });

  it('ignores untracked channels', async () => {
    const { service, firebase } = trackedService();

    await service.onVoiceStateUpdate(
      { channel: null },
      { channel: { id: '999', members: [{ bot: false }] } },
    );

    expect(firebase.setChannelMembers).not.toHaveBeenCalled();
  });
});

// ---------- listen ----------

describe('SessionService.listen', () => {
  function listeningService() {
    const vc = makeVoiceChannel('42', 'Raid', [makeMember('P1')]);
    const firebase = createMockFirebase();
    const bot = makeBot({ get_guild: vi.fn().mockReturnValue(makeGuild('1', [vc])) });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new SessionService(bot, firebase as any);
    service.listen();
    const handlers = firebase.listenForChannels.mock.calls[0][0] as ChannelListenerHandlers;
    return { service, firebase, handlers };
  }

  it('tracks an added lobby and publishes its members', async () => {
    const { service, firebase, handlers } = listeningService();

    handlers.onAdded('42', { guildId: '1' });

    expect(service.activeChannels.get('42')).toBe('1');
    await vi.waitFor(() => {
      expect(firebase.setChannelMembers).toHaveBeenCalledWith('42', [{ discordId: 'P1', name: 'P1' }]);
    });
  });

  it('ignores an added lobby with no guildId', () => {
    const { service, firebase, handlers } = listeningService();

    handlers.onAdded('42', {});

    expect(service.activeChannels.size).toBe(0);
    expect(firebase.setChannelMembers).not.toHaveBeenCalled();
  });

  it('stops tracking a removed lobby', () => {
    const { service, handlers } = listeningService();
    service.activeChannels.set('42', '1');
    service.activeChannels.set('43', '1');

    handlers.onRemoved('42');

    expect(service.activeChannels.has('42')).toBe(false);
    expect(service.activeChannels.has('43')).toBe(true);
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

// ---------- cleanupChannel ----------

describe('SessionService.cleanupChannel', () => {
  it('stops tracking the channel and deletes only its channel doc', async () => {
    const firebase = createMockFirebase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new SessionService(makeBot(), firebase as any);

    service.activeChannels.set('42', '1');
    service.activeChannels.set('43', '1');

    await service.cleanupChannel('42');

    expect(service.activeChannels.has('42')).toBe(false);
    expect(service.activeChannels.has('43')).toBe(true);
    // The guild doc (group history, season pairs) must survive the lobby
    // emptying between rounds. The mock has no guild-delete method, so an
    // attempt to delete it would throw.
    expect(firebase.deleteChannelDoc).toHaveBeenCalledOnce();
    expect(firebase.deleteChannelDoc).toHaveBeenCalledWith('42');
  });

  it('is a no-op for nonexistent channels', async () => {
    const firebase = createMockFirebase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new SessionService(makeBot(), firebase as any);

    await service.cleanupChannel('999');

    expect(firebase.deleteChannelDoc).not.toHaveBeenCalled();
  });
});

// ---------- shutdown ----------

describe('SessionService.shutdown', () => {
  it('clears tracked channels', () => {
    const { service } = makeService();

    service.activeChannels.set('42', '1');

    service.shutdown();

    expect(service.activeChannels.size).toBe(0);
  });
});
