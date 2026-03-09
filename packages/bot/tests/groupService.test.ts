import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WoWPlayer, WoWGroup } from '@mythicplus/shared';

vi.mock('@mythicplus/shared', async () => {
  const actual = await vi.importActual('@mythicplus/shared');
  return {
    ...(actual as Record<string, unknown>),
    createMythicPlusGroups: vi.fn(),
  };
});

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
import { getPlayerList, getDebugPlayers } from '../src/core/utils.js';
import { announceGroup } from '../src/core/groupUi.js';
import { createMythicPlusGroups } from '@mythicplus/shared';

function makeCtx(overrides: {
  members?: { bot: boolean; nick?: string; id?: string; toString?: () => string }[];
  guild?: { id: number } | null;
} = {}): CommandContext {
  return {
    channel: {
      members: overrides.members ?? [],
      sendTyping: vi.fn().mockResolvedValue(undefined),
    },
    guild: overrides.guild === undefined ? { id: 1 } : overrides.guild,
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

  it('returns null when no players have valid roles', async () => {
    const service = new GroupService();
    const member1 = { bot: false, nick: 'P1', id: '1', toString: () => 'P1' };
    const ctx = makeCtx({ members: [member1] });

    vi.mocked(getPlayerList).mockReturnValue([WoWPlayer.create('Roleless', [])]);

    const result = await service.getGroupsData(ctx, false);

    expect(result).toBeNull();
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
    const ctx = makeCtx({ guild: { id: 123 } });

    const executeSpy = vi.spyOn(service, '_executeCoreWheel').mockResolvedValue(undefined);

    await service.coreWheel(ctx);

    expect(executeSpy).toHaveBeenCalledOnce();
    expect(executeSpy).toHaveBeenCalledWith(ctx, ctx.channel, 123, false);

    // Lock should be released — a second call should succeed
    await service.coreWheel(ctx);
    expect(executeSpy).toHaveBeenCalledTimes(2);
  });

  it('prevents concurrent execution for same guild', async () => {
    const service = new GroupService();
    const ctx = makeCtx({ guild: { id: 123 } });

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
});

describe('GroupService._executeCoreWheel', () => {
  it('stores results and announces groups', async () => {
    const service = new GroupService();
    const ctx = makeCtx();
    const guildId = 123;

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
    const guildId = 123;

    vi.spyOn(service, 'getGroupsData').mockResolvedValue(null);

    await service._executeCoreWheel(ctx, ctx.channel, guildId, false);

    expect(service.lastResults.has(guildId)).toBe(false);
    expect(announceGroup).not.toHaveBeenCalled();
  });
});
