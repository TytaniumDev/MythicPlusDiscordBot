import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WoWPlayer, WoWGroup, todayPST } from '@mythicplus/shared';

const { mockFirebaseInstance } = vi.hoisted(() => {
  const mockFirebaseInstance = {
    isAvailable: vi.fn().mockReturnValue(false),
    getGroupHistory: vi.fn().mockResolvedValue(null),
    saveGroupHistory: vi.fn().mockResolvedValue(undefined),
    getSeasonConfig: vi.fn().mockResolvedValue(null),
    getSeasonPairs: vi.fn().mockResolvedValue(null),
    saveSeasonPairs: vi.fn().mockResolvedValue(undefined),
  };
  return { mockFirebaseInstance };
});

vi.mock('@mythicplus/shared', async () => {
  const actual = await vi.importActual('@mythicplus/shared');
  return {
    ...(actual as Record<string, unknown>),
    createMythicPlusGroups: vi.fn(),
    setGroupHistory: vi.fn(),
  };
});

vi.mock('../src/core/firebaseService.js', () => ({
  FirebaseService: {
    getInstance: vi.fn().mockReturnValue(mockFirebaseInstance),
  },
}));

vi.mock('../src/core/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../src/core/utils.js', () => ({
  getPlayerList: vi.fn(),
  getPlayerFromMember: vi.fn(),
  getWowName: vi.fn(),
  getMaskedName: vi.fn((n: string) => '?'.repeat(n.length)),
  showLongTyping: vi.fn().mockResolvedValue(undefined),
  showShortTyping: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/core/debugFixtures.js', () => ({
  getDebugPlayers: vi.fn(),
}));

vi.mock('../src/core/groupUi.js', () => ({
  announceGroup: vi.fn().mockResolvedValue(undefined),
  buildGroupEmbed: vi.fn(),
}));

vi.mock('../src/core/preferenceService.js', () => ({
  getPreferenceService: vi.fn().mockReturnValue({
    getPreferenceSync: vi.fn().mockReturnValue(null),
    getPreferenceByNameSync: vi.fn().mockReturnValue(null),
  }),
}));

import { GroupService, type CommandContext } from '../src/services/groupService.js';
import { getPlayerList } from '../src/core/utils.js';
import { getDebugPlayers } from '../src/core/debugFixtures.js';
import { announceGroup } from '../src/core/groupUi.js';
import { createMythicPlusGroups, setGroupHistory } from '@mythicplus/shared';

function makeCtx(overrides: {
  members?: { bot: boolean; nick?: string; id?: string; toString?: () => string }[];
  guild?: { id: string } | null;
} = {}): CommandContext {
  return {
    channel: {
      members: overrides.members ?? [],
      sendTyping: vi.fn().mockResolvedValue(undefined),
    },
    guild: overrides.guild === undefined ? { id: '1' } : overrides.guild,
    send: vi.fn().mockResolvedValue({ edit: vi.fn() }),
  } as unknown as CommandContext;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GroupService.getGroupsData', () => {
  it('returns null when no members in channel', async () => {
    const service = new GroupService();
    const ctx = makeCtx({ members: [] });

    const result = await service.getGroupsData(ctx);

    expect(result).toBeNull();
    expect(ctx.send).toHaveBeenCalledOnce();
  });

  it('uses debug players in debug mode', async () => {
    const service = new GroupService();
    const ctx = makeCtx();

    const debugPlayer = WoWPlayer.create('DebugPlayer', ['Tank']);
    vi.mocked(getDebugPlayers).mockReturnValue([debugPlayer]);
    vi.mocked(createMythicPlusGroups).mockReturnValue([
      new WoWGroup(debugPlayer, null, []),
    ]);

    const result = await service.getGroupsData(ctx, true);

    expect(result).not.toBeNull();
    expect(result!.players).toHaveLength(1);
    expect(result!.groups).toHaveLength(1);
    expect(getDebugPlayers).toHaveBeenCalledOnce();
    expect(createMythicPlusGroups).toHaveBeenCalledOnce();
  });

  it('uses player list in normal mode', async () => {
    const service = new GroupService();
    const member1 = { bot: false, nick: 'P1', id: '1', toString: () => 'P1' };
    const member2 = { bot: false, nick: 'P2', id: '2', toString: () => 'P2' };
    const ctx = makeCtx({ members: [member1, member2] });

    const players = [
      WoWPlayer.create('Player1', ['Tank']),
      WoWPlayer.create('Player2', ['Melee']),
    ];
    vi.mocked(getPlayerList).mockReturnValue(players);
    vi.mocked(createMythicPlusGroups).mockReturnValue([
      new WoWGroup(players[0], null, [players[1]]),
    ]);

    const result = await service.getGroupsData(ctx, false);

    expect(result).not.toBeNull();
    expect(result!.players).toHaveLength(2);
    expect(result!.groups).toHaveLength(1);
    expect(getPlayerList).toHaveBeenCalledWith([member1, member2]);
    expect(createMythicPlusGroups).toHaveBeenCalledOnce();
  });

  it('returns null and sends error when no players have valid roles', async () => {
    const service = new GroupService();
    const member1 = { bot: false, nick: 'P1', id: '1', toString: () => 'P1' };
    const ctx = makeCtx({ members: [member1] });

    vi.mocked(getPlayerList).mockReturnValue([WoWPlayer.create('Roleless', [])]);

    const result = await service.getGroupsData(ctx, false);

    expect(result).toBeNull();
    expect(ctx.send).toHaveBeenCalledWith('❌ No players with valid roles found.');
  });
});

describe('GroupService.coreWheel', () => {
  it('returns immediately when guild is null', async () => {
    const service = new GroupService();
    const ctx = makeCtx({ guild: null });

    const executeSpy = vi.spyOn(service, '_executeCoreWheel');

    await service.coreWheel(ctx);

    expect(executeSpy).not.toHaveBeenCalled();
  });

  it('executes and releases lock on success', async () => {
    const service = new GroupService();
    const ctx = makeCtx({ guild: { id: '123' } });

    const executeSpy = vi.spyOn(service, '_executeCoreWheel').mockResolvedValue(undefined);

    await service.coreWheel(ctx);

    expect(executeSpy).toHaveBeenCalledOnce();
    expect(executeSpy).toHaveBeenCalledWith(ctx, ctx.channel, '123', false);

    // Lock should be released — a second call should succeed
    await service.coreWheel(ctx);
    expect(executeSpy).toHaveBeenCalledTimes(2);
  });

  it('prevents concurrent execution for same guild', async () => {
    const service = new GroupService();
    const ctx = makeCtx({ guild: { id: '123' } });

    let resolveFirst!: () => void;
    const firstPromise = new Promise<void>((r) => {
      resolveFirst = r;
    });

    const executeSpy = vi
      .spyOn(service, '_executeCoreWheel')
      .mockReturnValue(firstPromise);

    // First call acquires the lock synchronously before await
    const call1 = service.coreWheel(ctx);
    // Second call sees lock is true and returns immediately
    const call2 = service.coreWheel(ctx);

    resolveFirst();
    await call1;
    await call2;

    expect(executeSpy).toHaveBeenCalledTimes(1);
  });

  it('releases lock when _executeCoreWheel throws', async () => {
    const service = new GroupService();
    const ctx = makeCtx({ guild: { id: '123' } });

    const executeSpy = vi
      .spyOn(service, '_executeCoreWheel')
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined);

    // First call rejects — lock must still release in `finally`
    await expect(service.coreWheel(ctx)).rejects.toThrow('boom');

    // Second call must be able to acquire the lock and run
    await service.coreWheel(ctx);

    expect(executeSpy).toHaveBeenCalledTimes(2);
  });

  it('per-guild locks are independent across guilds', async () => {
    const service = new GroupService();
    const ctxA = makeCtx({ guild: { id: 'guild-a' } });
    const ctxB = makeCtx({ guild: { id: 'guild-b' } });

    let resolveA!: () => void;
    let resolveB!: () => void;
    const promiseA = new Promise<void>((r) => {
      resolveA = r;
    });
    const promiseB = new Promise<void>((r) => {
      resolveB = r;
    });

    const executeSpy = vi
      .spyOn(service, '_executeCoreWheel')
      .mockImplementationOnce(() => promiseA)
      .mockImplementationOnce(() => promiseB);

    // Both calls in flight simultaneously — different guilds, neither blocked
    const callA = service.coreWheel(ctxA);
    const callB = service.coreWheel(ctxB);

    expect(executeSpy).toHaveBeenCalledTimes(2);
    expect(executeSpy).toHaveBeenNthCalledWith(1, ctxA, ctxA.channel, 'guild-a', false);
    expect(executeSpy).toHaveBeenNthCalledWith(2, ctxB, ctxB.channel, 'guild-b', false);

    resolveA();
    resolveB();
    await callA;
    await callB;
  });
});

describe('GroupService._executeCoreWheel', () => {
  it('stores results and announces groups', async () => {
    const service = new GroupService();
    const ctx = makeCtx();
    const guildId = '123';

    const players = [WoWPlayer.create('P1', ['Tank'])];
    const groups = [
      new WoWGroup(players[0], null, []),
      new WoWGroup(null, null, []),
    ];

    vi.spyOn(service, 'getGroupsData').mockResolvedValue({ players, groups });

    await service._executeCoreWheel(ctx, ctx.channel, guildId, false);

    expect(service.getGroupsData).toHaveBeenCalledWith(ctx, false);
    expect(service.lastResults.get(guildId)).toEqual({ players, groups });
    expect(announceGroup).toHaveBeenCalledTimes(2);
  });

  it('does nothing when getGroupsData returns null', async () => {
    const service = new GroupService();
    const ctx = makeCtx();
    const guildId = '123';

    vi.spyOn(service, 'getGroupsData').mockResolvedValue(null);

    await service._executeCoreWheel(ctx, ctx.channel, guildId, false);

    expect(service.lastResults.has(guildId)).toBe(false);
    expect(announceGroup).not.toHaveBeenCalled();
  });
});

describe('GroupService Firebase groupHistory integration', () => {
  beforeEach(() => {
    mockFirebaseInstance.isAvailable.mockReturnValue(true);
    mockFirebaseInstance.getGroupHistory.mockResolvedValue(null);
    mockFirebaseInstance.saveGroupHistory.mockResolvedValue(undefined);
  });

  it('loads group history from Firebase and calls setGroupHistory for today', async () => {
    const service = new GroupService();
    const ctx = makeCtx({ guild: { id: '42' } });

    const tank = WoWPlayer.create('Tank1', ['Tank']);
    const round = [new WoWGroup(tank, null, []).toDict()];
    const today = todayPST();
    mockFirebaseInstance.getGroupHistory.mockResolvedValue({ date: today, rounds: [round] });

    vi.mocked(getDebugPlayers).mockReturnValue([tank]);
    vi.mocked(createMythicPlusGroups).mockReturnValue([new WoWGroup(tank, null, [])]);

    await service.getGroupsData(ctx, true);

    expect(mockFirebaseInstance.getGroupHistory).toHaveBeenCalledWith('42');
    expect(setGroupHistory).toHaveBeenCalledWith(
      expect.arrayContaining([expect.any(Array)]),
      '42',
    );
  });

  it('discards stale history from a previous day', async () => {
    const service = new GroupService();
    const ctx = makeCtx({ guild: { id: '42' } });

    const tank = WoWPlayer.create('Tank1', ['Tank']);
    mockFirebaseInstance.getGroupHistory.mockResolvedValue({
      date: '2020-01-01',
      rounds: [[ new WoWGroup(tank, null, []).toDict() ]],
    });

    vi.mocked(getDebugPlayers).mockReturnValue([tank]);
    vi.mocked(createMythicPlusGroups).mockReturnValue([new WoWGroup(tank, null, [])]);

    await service.getGroupsData(ctx, true);

    expect(setGroupHistory).toHaveBeenCalledWith([], '42');
  });

  it('saves group history with today date and appended round', async () => {
    const service = new GroupService();
    const ctx = makeCtx({ guild: { id: '42' } });

    const tank = WoWPlayer.create('Tank1', ['Tank']);
    const group = new WoWGroup(tank, null, []);
    const today = todayPST();

    mockFirebaseInstance.getGroupHistory.mockResolvedValue(null);
    vi.mocked(getDebugPlayers).mockReturnValue([tank]);
    vi.mocked(createMythicPlusGroups).mockReturnValue([group]);

    await service.getGroupsData(ctx, true);

    expect(mockFirebaseInstance.saveGroupHistory).toHaveBeenCalledWith(
      '42',
      {
        date: today,
        rounds: expect.arrayContaining([
          expect.arrayContaining([expect.objectContaining({ tank: expect.objectContaining({ name: 'Tank1' }) })]),
        ]),
      },
    );
  });

  it('appends to existing rounds when history is from today', async () => {
    const service = new GroupService();
    const ctx = makeCtx({ guild: { id: '42' } });

    const tank = WoWPlayer.create('Tank1', ['Tank']);
    const group = new WoWGroup(tank, null, []);
    const today = todayPST();

    const existingRound = [new WoWGroup(tank, null, []).toDict()];
    mockFirebaseInstance.getGroupHistory.mockResolvedValue({ date: today, rounds: [existingRound] });
    vi.mocked(getDebugPlayers).mockReturnValue([tank]);
    vi.mocked(createMythicPlusGroups).mockReturnValue([group]);

    await service.getGroupsData(ctx, true);

    expect(mockFirebaseInstance.saveGroupHistory).toHaveBeenCalledWith(
      '42',
      {
        date: today,
        rounds: expect.any(Array),
      },
    );
    const savedHistory = vi.mocked(mockFirebaseInstance.saveGroupHistory).mock.calls[0][1];
    expect(savedHistory.rounds).toHaveLength(2);
  });

  it('skips Firebase when guild is null', async () => {
    const service = new GroupService();
    const ctx = makeCtx({ guild: null });

    const tank = WoWPlayer.create('Tank1', ['Tank']);
    vi.mocked(getDebugPlayers).mockReturnValue([tank]);
    vi.mocked(createMythicPlusGroups).mockReturnValue([new WoWGroup(tank, null, [])]);

    await service.getGroupsData(ctx, true);

    expect(mockFirebaseInstance.getGroupHistory).not.toHaveBeenCalled();
    expect(mockFirebaseInstance.saveGroupHistory).not.toHaveBeenCalled();
  });

  it('skips Firebase when not available', async () => {
    const service = new GroupService();
    const ctx = makeCtx({ guild: { id: '42' } });
    mockFirebaseInstance.isAvailable.mockReturnValue(false);

    const tank = WoWPlayer.create('Tank1', ['Tank']);
    vi.mocked(getDebugPlayers).mockReturnValue([tank]);
    vi.mocked(createMythicPlusGroups).mockReturnValue([new WoWGroup(tank, null, [])]);

    await service.getGroupsData(ctx, true);

    expect(mockFirebaseInstance.getGroupHistory).not.toHaveBeenCalled();
    expect(mockFirebaseInstance.saveGroupHistory).not.toHaveBeenCalled();
  });

  it('clears in-memory history when no history exists in Firebase', async () => {
    const service = new GroupService();
    const ctx = makeCtx({ guild: { id: '42' } });
    mockFirebaseInstance.getGroupHistory.mockResolvedValue(null);

    const tank = WoWPlayer.create('Tank1', ['Tank']);
    vi.mocked(getDebugPlayers).mockReturnValue([tank]);
    vi.mocked(createMythicPlusGroups).mockReturnValue([new WoWGroup(tank, null, [])]);

    await service.getGroupsData(ctx, true);

    expect(mockFirebaseInstance.getGroupHistory).toHaveBeenCalled();
    expect(setGroupHistory).toHaveBeenCalledWith([], '42');
  });

  it('gracefully handles Firebase load errors', async () => {
    const service = new GroupService();
    const ctx = makeCtx({ guild: { id: '42' } });
    mockFirebaseInstance.getGroupHistory.mockRejectedValue(new Error('network error'));

    const tank = WoWPlayer.create('Tank1', ['Tank']);
    vi.mocked(getDebugPlayers).mockReturnValue([tank]);
    vi.mocked(createMythicPlusGroups).mockReturnValue([new WoWGroup(tank, null, [])]);

    const result = await service.getGroupsData(ctx, true);
    expect(result).not.toBeNull();
    expect(createMythicPlusGroups).toHaveBeenCalled();
  });

  it('gracefully handles Firebase save errors', async () => {
    const service = new GroupService();
    const ctx = makeCtx({ guild: { id: '42' } });
    mockFirebaseInstance.saveGroupHistory.mockRejectedValue(new Error('write error'));

    const tank = WoWPlayer.create('Tank1', ['Tank']);
    vi.mocked(getDebugPlayers).mockReturnValue([tank]);
    vi.mocked(createMythicPlusGroups).mockReturnValue([new WoWGroup(tank, null, [])]);

    const result = await service.getGroupsData(ctx, true);
    expect(result).not.toBeNull();
  });
});

describe('GroupService season pair bumping', () => {
  beforeEach(() => {
    mockFirebaseInstance.isAvailable.mockReturnValue(true);
    mockFirebaseInstance.getGroupHistory.mockResolvedValue(null);
    mockFirebaseInstance.saveGroupHistory.mockResolvedValue(undefined);
    mockFirebaseInstance.getSeasonConfig.mockResolvedValue(null);
    mockFirebaseInstance.getSeasonPairs.mockResolvedValue(null);
    mockFirebaseInstance.saveSeasonPairs.mockResolvedValue(undefined);
  });

  function fivePlayerGroup(): WoWGroup {
    const tank = WoWPlayer.create('Alice', ['Tank']);
    const healer = WoWPlayer.create('Bob', ['Healer']);
    const dps1 = WoWPlayer.create('Carol', ['Ranged']);
    const dps2 = WoWPlayer.create('Dave', ['Melee']);
    const dps3 = WoWPlayer.create('Eve', ['Ranged']);
    return new WoWGroup(tank, healer, [dps1, dps2, dps3]);
  }

  it('bumps season pairs on real spin and merges with existing counts', async () => {
    const service = new GroupService();
    const member = { bot: false, nick: 'Alice', id: '1', toString: () => 'Alice' };
    const ctx = makeCtx({ guild: { id: '42' }, members: [member] });

    mockFirebaseInstance.getSeasonConfig.mockResolvedValue({
      slug: 'season-mn-1',
      blizzardSeasonId: 17,
      expansionId: 11,
    });
    mockFirebaseInstance.getSeasonPairs.mockResolvedValue({
      seasonSlug: 'season-mn-1',
      counts: { 'Alice|Bob': 1 },
    });

    const group = fivePlayerGroup();
    vi.mocked(getPlayerList).mockReturnValue(group.players);
    vi.mocked(createMythicPlusGroups).mockReturnValue([group]);

    await service.getGroupsData(ctx, false);

    expect(mockFirebaseInstance.saveSeasonPairs).toHaveBeenCalledOnce();
    const [savedGuildId, savedPairs] = mockFirebaseInstance.saveSeasonPairs.mock.calls[0];
    expect(savedGuildId).toBe('42');
    expect(savedPairs.seasonSlug).toBe('season-mn-1');
    // Pre-existing Alice|Bob (1) + new pairing in this round (1) = 2
    expect(savedPairs.counts['Alice|Bob']).toBe(2);
    // 5 players → C(5,2) = 10 unique pairs total
    expect(Object.keys(savedPairs.counts)).toHaveLength(10);
    // A previously-unseen pair from this round
    expect(savedPairs.counts['Carol|Dave']).toBe(1);
  });

  it('skips bump when spin is debug=true', async () => {
    const service = new GroupService();
    const ctx = makeCtx({ guild: { id: '42' } });

    mockFirebaseInstance.getSeasonConfig.mockResolvedValue({
      slug: 'season-mn-1',
      blizzardSeasonId: 17,
      expansionId: 11,
    });

    const group = fivePlayerGroup();
    vi.mocked(getDebugPlayers).mockReturnValue(group.players);
    vi.mocked(createMythicPlusGroups).mockReturnValue([group]);

    await service.getGroupsData(ctx, true);

    expect(mockFirebaseInstance.saveSeasonPairs).not.toHaveBeenCalled();
    expect(mockFirebaseInstance.getSeasonConfig).not.toHaveBeenCalled();
  });

  it('resets counts when seasonSlug differs from current config slug', async () => {
    const service = new GroupService();
    const member = { bot: false, nick: 'Alice', id: '1', toString: () => 'Alice' };
    const ctx = makeCtx({ guild: { id: '42' }, members: [member] });

    mockFirebaseInstance.getSeasonConfig.mockResolvedValue({
      slug: 'season-mn-2',
      blizzardSeasonId: 18,
      expansionId: 11,
    });
    mockFirebaseInstance.getSeasonPairs.mockResolvedValue({
      seasonSlug: 'season-mn-1',
      counts: { 'Old|Pair': 99 },
    });

    const group = fivePlayerGroup();
    vi.mocked(getPlayerList).mockReturnValue(group.players);
    vi.mocked(createMythicPlusGroups).mockReturnValue([group]);

    await service.getGroupsData(ctx, false);

    expect(mockFirebaseInstance.saveSeasonPairs).toHaveBeenCalledOnce();
    const [, savedPairs] = mockFirebaseInstance.saveSeasonPairs.mock.calls[0];
    expect(savedPairs.seasonSlug).toBe('season-mn-2');
    // Stale Old|Pair must NOT carry over — counts reset to {} before bumping.
    expect(savedPairs.counts['Old|Pair']).toBeUndefined();
    expect(savedPairs.counts['Alice|Bob']).toBe(1);
    expect(Object.keys(savedPairs.counts)).toHaveLength(10);
  });

  it('skips bump when no season config exists yet', async () => {
    const service = new GroupService();
    const member = { bot: false, nick: 'Alice', id: '1', toString: () => 'Alice' };
    const ctx = makeCtx({ guild: { id: '42' }, members: [member] });

    mockFirebaseInstance.getSeasonConfig.mockResolvedValue(null);

    const group = fivePlayerGroup();
    vi.mocked(getPlayerList).mockReturnValue(group.players);
    vi.mocked(createMythicPlusGroups).mockReturnValue([group]);

    await service.getGroupsData(ctx, false);

    expect(mockFirebaseInstance.getSeasonConfig).toHaveBeenCalled();
    expect(mockFirebaseInstance.saveSeasonPairs).not.toHaveBeenCalled();
  });
});
