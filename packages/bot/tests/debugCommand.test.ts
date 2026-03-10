import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/core/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { DebugHandler, type DebugContext } from '../src/commands/debug.js';
import type { GroupService } from '../src/services/groupService.js';
import logger from '../src/core/logger.js';

function makeMockGroupService() {
  return {
    coreWheel: vi.fn().mockResolvedValue(undefined),
    lastResults: new Map(),
  } as unknown as GroupService;
}

function makeCtx(overrides: Partial<DebugContext> = {}): DebugContext {
  return {
    guild: overrides.guild === undefined ? { id: '123' } : overrides.guild,
    channel: overrides.channel ?? {
      send: vi.fn().mockResolvedValue(undefined),
      members: [],
      sendTyping: vi.fn().mockResolvedValue(undefined),
    },
    send: overrides.send ?? vi.fn().mockResolvedValue(undefined),
  } as unknown as DebugContext;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DebugHandler.test', () => {
  it('calls coreWheel on groupService with ctx and true', async () => {
    const groupService = makeMockGroupService();
    const handler = new DebugHandler(groupService);
    const ctx = makeCtx();

    await handler.test(ctx);

    expect(groupService.coreWheel).toHaveBeenCalledOnce();
    expect(groupService.coreWheel).toHaveBeenCalledWith(ctx, true);
  });

  it('handles errors gracefully and logs them', async () => {
    const groupService = makeMockGroupService();
    vi.mocked(groupService.coreWheel).mockRejectedValue(new Error('Test error'));

    const handler = new DebugHandler(groupService);
    const ctx = makeCtx();

    await handler.test(ctx);

    expect(ctx.send).toHaveBeenCalledWith('❌ An unexpected error occurred. Please try again later.');
    expect(logger.error).toHaveBeenCalledWith('Error in test command: Error: Test error');
  });
});

describe('DebugHandler.testcase', () => {
  it('rejects when used outside a guild', async () => {
    const groupService = makeMockGroupService();
    const handler = new DebugHandler(groupService);
    const ctx = makeCtx({ guild: null });

    await handler.testcase(ctx);

    expect(ctx.send).toHaveBeenCalledWith('❌ This command can only be used in a server.');
  });

  it('rejects when no previous results are found', async () => {
    const groupService = makeMockGroupService();
    // lastResults map is empty by default
    const handler = new DebugHandler(groupService);
    const ctx = makeCtx({ guild: { id: '123' } });

    await handler.testcase(ctx);

    expect(ctx.send).toHaveBeenCalledWith('❌ No previous results found for this server. Run `!wheel` first.');
  });

  it('sends player and group test strings when results are found', async () => {
    const groupService = makeMockGroupService();

    const mockPlayer1 = { toTestString: vi.fn().mockReturnValue('Player1') };
    const mockPlayer2 = { toTestString: vi.fn().mockReturnValue('Player2') };
    const mockGroup1 = { toTestString: vi.fn().mockReturnValue('Group1') };

    groupService.lastResults.set('123', {
      players: [mockPlayer1, mockPlayer2],
      groups: [mockGroup1],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const handler = new DebugHandler(groupService);
    const ctx = makeCtx({ guild: { id: '123' } });

    await handler.testcase(ctx);

    expect(ctx.channel.send).toHaveBeenCalledTimes(2);
    expect(ctx.channel.send).toHaveBeenNthCalledWith(1, 'players = [Player1, Player2]');
    expect(ctx.channel.send).toHaveBeenNthCalledWith(2, 'Groups:\n\nGroup1');
  });

  it('handles unexpected errors', async () => {
    const groupService = makeMockGroupService();
    // Setting up the context such that ctx.channel.send throws
    const ctx = makeCtx({
      guild: { id: '123' },
      channel: {
        send: vi.fn().mockRejectedValue(new Error('Send error')),
        members: [],
        sendTyping: vi.fn().mockResolvedValue(undefined),
      } as unknown as DebugContext['channel']
    });

    groupService.lastResults.set('123', {
      players: [],
      groups: [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const handler = new DebugHandler(groupService);

    await handler.testcase(ctx);

    expect(ctx.send).toHaveBeenCalledWith('❌ An unexpected error occurred. Please try again later.');
    expect(logger.error).toHaveBeenCalledWith('Error in testcase command: Error: Send error');
  });
});
