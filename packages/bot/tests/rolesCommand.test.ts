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
  createMainSpecView: vi.fn(),
  createOffspecView: vi.fn(),
  createUtilitiesView: vi.fn(),
  handleRoleButtonClick: vi.fn(),
  handleNoneButtonClick: vi.fn(),
  handleNextButtonClick: vi.fn(),
}));

vi.mock('../src/core/preferenceService.js', () => ({
  getPreferenceService: vi.fn(),
  PreferenceService: vi.fn(),
  _resetInstance: vi.fn(),
}));

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
import { getPlayerList } from '../src/core/utils.js';
import { createRoleBoardEmbed } from '../src/core/roleUi.js';

function makeCtx(overrides: Partial<RolesContext> = {}): RolesContext {
  return {
    guild: overrides.guild === undefined ? { id: '1' } : overrides.guild,
    author: overrides.author ?? {
      id: '111',
      nick: 'TestUser',
      toString: () => 'TestUser',
      voice: {
        channel: {
          id: '42',
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

