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
    expect(logger.error).toHaveBeenCalledWith('[debug.test] Error: Test error');
  });
});

