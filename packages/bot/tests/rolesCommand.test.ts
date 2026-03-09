import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/core/utils.js', () => ({
  getPlayerList: vi.fn(),
  getWowName: vi.fn(),
  getDebugPlayers: vi.fn(),
  getPlayerFromMember: vi.fn(),
  getMaskedName: vi.fn(),
  showLongTyping: vi.fn().mockResolvedValue(undefined),
  showShortTyping: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/core/roleUi.js', () => ({
  createRoleBoardEmbed: vi.fn().mockReturnValue({ title: 'Test Board', fields: [] }),
  createRoleCheckEmbed: vi.fn(),
  createMainSpecView: vi.fn(),
  createOffspecView: vi.fn(),
  createUtilitiesView: vi.fn(),
  handleRoleButtonClick: vi.fn(),
  handleNoneButtonClick: vi.fn(),
  handleNextButtonClick: vi.fn(),
}));

vi.mock('../src/core/preferenceService.js', () => {
  const mockSvc = {
    getPreferenceSync: vi.fn().mockReturnValue(null),
    getPreferenceByNameSync: vi.fn().mockReturnValue(null),
    clearPreference: vi.fn().mockResolvedValue(undefined),
    resolveDiscordId: vi.fn().mockReturnValue(null),
  };
  return {
    getPreferenceService: vi.fn().mockReturnValue(mockSvc),
    PreferenceService: vi.fn(),
    _resetInstance: vi.fn(),
  };
});

vi.mock('../src/core/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../src/core/firebaseService.js', () => ({
  FirebaseService: { getInstance: vi.fn() },
}));

import { RolesHandler, type RolesContext } from '../src/commands/roles.js';
import { getPlayerList, getWowName } from '../src/core/utils.js';
import { createRoleBoardEmbed, createRoleCheckEmbed } from '../src/core/roleUi.js';
import { getPreferenceService } from '../src/core/preferenceService.js';

function makeCtx(overrides: Partial<RolesContext> = {}): RolesContext {
  return {
    guild: overrides.guild === undefined ? { id: 1 } : overrides.guild,
    author: overrides.author ?? {
      id: '111',
      nick: 'TestUser',
      toString: () => 'TestUser',
      voice: {
        channel: {
          id: 42,
          members: [],
        },
      },
    },
    channel: overrides.channel ?? { members: [] },
    send: vi.fn().mockResolvedValue(undefined),
    interaction: overrides.interaction,
  } as unknown as RolesContext;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('RolesHandler.launchRoleBoard', () => {
  it('sends role board embed for voice channel', async () => {
    const handler = new RolesHandler();

    const member = { bot: false, nick: 'P1', id: '1', toString: () => 'P1' };
    const ctx = makeCtx({
      author: {
        id: '111',
        nick: 'TestUser',
        toString: () => 'TestUser',
        voice: { channel: { id: 42, members: [member] } },
      } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    });

    vi.mocked(getPlayerList).mockReturnValue([]);

    await handler.launchRoleBoard(ctx);

    expect(getPlayerList).toHaveBeenCalledOnce();
    expect(createRoleBoardEmbed).toHaveBeenCalledOnce();
    expect(ctx.send).toHaveBeenCalledOnce();
    const callArgs = vi.mocked(ctx.send).mock.calls[0];
    expect(callArgs[1]).toHaveProperty('embed');
  });

  it('rejects when used outside a guild', async () => {
    const handler = new RolesHandler();
    const ctx = makeCtx({ guild: null });

    await handler.launchRoleBoard(ctx);

    expect(ctx.send).toHaveBeenCalledWith('❌ This command can only be used in a server.');
  });
});

describe('RolesHandler.rolecheck', () => {
  it('shows saved roles for members', async () => {
    const handler = new RolesHandler();

    const member = { bot: false, nick: 'TestPlayer', id: 111, toString: () => 'TestPlayer' };
    const ctx = makeCtx({
      author: {
        id: '111',
        nick: 'TestUser',
        toString: () => 'TestUser',
        voice: { channel: { id: 42, members: [member] } },
      } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    });

    vi.mocked(getWowName).mockReturnValue('TestPlayer');

    const mockSvc = getPreferenceService();
    vi.mocked(mockSvc.getPreferenceSync).mockReturnValue(['Tank', 'Healer']);

    const mockEmbed = {
      title: 'Saved Roles Check',
      fields: [{ name: 'TestPlayer', value: 'Tank, Healer' }],
    };
    vi.mocked(createRoleCheckEmbed).mockReturnValue(mockEmbed as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    await handler.rolecheck(ctx);

    expect(ctx.send).toHaveBeenCalledOnce();
    const callArgs = vi.mocked(ctx.send).mock.calls[0];
    expect(callArgs[1]).toHaveProperty('embed');
    expect((callArgs[1] as any).embed.fields[0].name).toBe('TestPlayer'); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect((callArgs[1] as any).embed.fields[0].value).toBe('Tank, Healer'); // eslint-disable-line @typescript-eslint/no-explicit-any
  });

  it('shows "No roles set" for unsaved members', async () => {
    const handler = new RolesHandler();

    const member = { bot: false, nick: 'NewUser', id: 222, toString: () => 'NewUser' };
    const ctx = makeCtx({
      author: {
        id: '222',
        nick: 'NewUser',
        toString: () => 'NewUser',
        voice: { channel: { id: 42, members: [member] } },
      } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    });

    vi.mocked(getWowName).mockReturnValue('NewUser');

    const mockSvc = getPreferenceService();
    vi.mocked(mockSvc.getPreferenceSync).mockReturnValue(null);
    vi.mocked(mockSvc.getPreferenceByNameSync).mockReturnValue(null);

    const mockEmbed = {
      title: 'Saved Roles Check',
      fields: [{ name: 'NewUser', value: 'No roles set' }],
    };
    vi.mocked(createRoleCheckEmbed).mockReturnValue(mockEmbed as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    await handler.rolecheck(ctx);

    expect(ctx.send).toHaveBeenCalledOnce();
    // Verify createRoleCheckEmbed was called with "No roles set"
    const callArg = vi.mocked(createRoleCheckEmbed).mock.calls[0][0];
    expect(callArg[0].roles).toEqual(['No roles set']);
  });

  it('handles empty channel', async () => {
    const handler = new RolesHandler();

    const ctx = makeCtx({
      author: {
        id: '111',
        nick: 'TestUser',
        toString: () => 'TestUser',
        voice: { channel: { id: 42, members: [] } },
      } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    });

    await handler.rolecheck(ctx);

    expect(ctx.send).toHaveBeenCalledWith('No members found in the channel.');
  });
});

describe('RolesHandler.clearrole', () => {
  it('clears own roles', async () => {
    const handler = new RolesHandler();
    const ctx = makeCtx({
      author: {
        id: 123,
        nick: 'MyName',
        toString: () => 'MyName',
      } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    });

    vi.mocked(getWowName).mockReturnValue('MyName');

    const mockSvc = getPreferenceService();
    vi.mocked(mockSvc.getPreferenceSync).mockReturnValue(['Tank']);

    await handler.clearrole(ctx, null);

    expect(mockSvc.clearPreference).toHaveBeenCalledWith('123');
    expect(ctx.send).toHaveBeenCalledWith('✅ Cleared your saved roles, **MyName**.');
  });

  it('clears another player roles', async () => {
    const handler = new RolesHandler();
    const ctx = makeCtx();

    const mockSvc = getPreferenceService();
    vi.mocked(mockSvc.resolveDiscordId).mockReturnValue('456');

    await handler.clearrole(ctx, 'OtherPlayer');

    expect(mockSvc.clearPreference).toHaveBeenCalledWith('456');
    expect(ctx.send).toHaveBeenCalledWith('✅ Cleared saved roles for **OtherPlayer**.');
  });

  it('reports failure when player not found', async () => {
    const handler = new RolesHandler();
    const ctx = makeCtx();

    const mockSvc = getPreferenceService();
    vi.mocked(mockSvc.resolveDiscordId).mockReturnValue(null);

    await handler.clearrole(ctx, 'Unknown');

    expect(ctx.send).toHaveBeenCalledWith('❌ No saved roles found for **Unknown**.');
  });
});
