import { describe, it, expect, vi, beforeEach } from 'vitest';
// WoWPlayer, WoWGroup imported by mocked modules

vi.mock('../src/core/config.js', () => ({
  DEVELOPER_ID: 999,
  LOG_FILE: '/tmp/test.log',
  BOT_TOKEN: undefined,
  FIREBASE_CREDENTIALS_JSON: undefined,
  GITHUB_TOKEN: 'fake',
  GITHUB_REPO_OWNER: 'owner',
  GITHUB_REPO_NAME: 'repo',
  GIT_SHA: 'abc123',
  DISCORD_APPLICATION_ID: '12345',
  ACTIVITY_URL: 'https://tytaniumdev.github.io/MythicPlusDiscordBot/',
  PLACEHOLDER_CHAR: '❓',
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

vi.mock('../src/core/utils.js', () => ({
  getPlayerList: vi.fn(),
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

import { GroupsHandler, type GroupsContext, type ActivityContext } from '../src/commands/groups.js';
import { GroupService } from '../src/services/groupService.js';
import type { SessionService } from '../src/services/sessionService.js';
import logger from '../src/core/logger.js';

function makeMockSessionService() {
  return {
    getOrCreateSession: vi.fn().mockResolvedValue(['123', '456']),
  } as unknown as SessionService;
}

function makeMockBot() {
  return {
    get_guild: vi.fn().mockReturnValue(null),
  };
}

function makeCtx(overrides: Partial<GroupsContext> = {}): GroupsContext {
  return {
    guild: overrides.guild === undefined ? { id: '123' } : overrides.guild,
    author: overrides.author ?? {
      id: '1',
      name: 'TestUser',
      voice: {
        channel: {
          id: '99',
          name: 'Raid',
          members: [],
          createInvite: vi.fn().mockResolvedValue({ url: 'http://discord.invite' }),
        },
      },
    },
    send: vi.fn().mockResolvedValue(undefined),
    defer: vi.fn().mockResolvedValue(undefined),
  } as unknown as GroupsContext;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GroupsHandler.activity', () => {
  it('sends activity URL with default base URL', async () => {
    const handler = new GroupsHandler(
      makeMockBot() as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      new GroupService(),
      makeMockSessionService(),
    );

    const ctx = makeCtx() as unknown as ActivityContext;
    await handler.activity(ctx);

    const calls = vi.mocked(ctx.send).mock.calls;
    const msgCall = calls.find(
      ([msg]) => typeof msg === 'string' && msg.includes('guildId=123&channelId=456'),
    );
    expect(msgCall).toBeTruthy();
    expect(msgCall![0]).toContain(
      'https://tytaniumdev.github.io/MythicPlusDiscordBot/?guildId=123&channelId=456',
    );
  });

  it('sends activity URL in debug mode', async () => {
    const handler = new GroupsHandler(
      makeMockBot() as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      new GroupService(),
      makeMockSessionService(),
    );

    const ctx = makeCtx() as unknown as ActivityContext;
    await handler.activity(ctx, true);

    const calls = vi.mocked(ctx.send).mock.calls;
    const msgCall = calls.find(
      ([msg]) => typeof msg === 'string' && msg.includes('guildId=123&channelId=456'),
    );
    expect(msgCall).toBeTruthy();
  });

  it('rejects when caller is not in a voice channel', async () => {
    const handler = new GroupsHandler(
      makeMockBot() as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      new GroupService(),
      makeMockSessionService(),
    );

    const ctx = makeCtx({
      author: { id: '1', name: 'TestUser', voice: null },
    }) as unknown as ActivityContext;
    await handler.activity(ctx);

    expect(ctx.send).toHaveBeenCalledWith(
      '❌ You must be in a voice channel to start an activity.',
    );
  });

  it('reports Firebase failure when getOrCreateSession returns null', async () => {
    const sessionService = makeMockSessionService();
    vi.mocked(sessionService.getOrCreateSession).mockResolvedValue(null);

    const handler = new GroupsHandler(
      makeMockBot() as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      new GroupService(),
      sessionService,
    );

    const ctx = makeCtx() as unknown as ActivityContext;
    await handler.activity(ctx);

    expect(ctx.send).toHaveBeenCalledWith(
      '❌ Failed to create/get session. Is Firebase configured?',
    );
  });

  it('falls back to N/A when createInvite throws', async () => {
    const handler = new GroupsHandler(
      makeMockBot() as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      new GroupService(),
      makeMockSessionService(),
    );

    const failingInvite = vi.fn().mockRejectedValue(new Error('rate-limited'));
    const ctx = makeCtx({
      author: {
        id: '1',
        name: 'TestUser',
        voice: {
          channel: {
            id: '99',
            name: 'Raid',
            members: [],
            createInvite: failingInvite,
          },
        },
      },
    }) as unknown as ActivityContext;
    await handler.activity(ctx);

    const calls = vi.mocked(ctx.send).mock.calls;
    // The activity URL message should still be sent (no rethrow), and it
    // should show the N/A fallback for the invite line.
    const msgCall = calls.find(
      ([msg]) => typeof msg === 'string' && msg.includes('Voice Channel Activity:'),
    );
    expect(msgCall).toBeTruthy();
    expect(msgCall![0]).toContain('**Voice Channel Activity:** N/A');
  });
});

describe('GroupsHandler.wheel', () => {
  function makeStubGroupService() {
    const groupService = new GroupService();
    // Stub coreWheel so we can observe forwarding without exercising the
    // (heavy) real implementation.
    groupService.coreWheel = vi.fn().mockResolvedValue(undefined);
    return groupService;
  }

  it('defers and forwards the context to groupService.coreWheel(ctx, false)', async () => {
    const groupService = makeStubGroupService();
    const handler = new GroupsHandler(
      makeMockBot() as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      groupService,
      makeMockSessionService(),
    );

    const ctx = makeCtx();
    ctx.channel = {
      members: [],
      sendTyping: vi.fn().mockResolvedValue(undefined),
    };

    await handler.wheel(ctx);

    expect(ctx.defer).toHaveBeenCalledOnce();
    expect(groupService.coreWheel).toHaveBeenCalledOnce();
    expect(groupService.coreWheel).toHaveBeenCalledWith(ctx, false);
    expect(ctx.send).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('throws when channel context is missing (caller wraps for Sentry)', async () => {
    const groupService = makeStubGroupService();
    const handler = new GroupsHandler(
      makeMockBot() as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      groupService,
      makeMockSessionService(),
    );

    // ctx.channel is omitted so the handler should throw — the outer
    // InteractionCreate wrapper in main.ts handles the user reply + Sentry.
    const ctx = makeCtx();

    await expect(handler.wheel(ctx)).rejects.toThrow(
      'Channel context is required for coreWheel',
    );
    expect(ctx.defer).toHaveBeenCalledOnce();
    expect(groupService.coreWheel).not.toHaveBeenCalled();
    expect(ctx.send).not.toHaveBeenCalled();
  });

  it('propagates errors from groupService.coreWheel to caller', async () => {
    const groupService = makeStubGroupService();
    vi.mocked(groupService.coreWheel).mockRejectedValue(new Error('boom'));

    const handler = new GroupsHandler(
      makeMockBot() as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      groupService,
      makeMockSessionService(),
    );

    const ctx = makeCtx();
    ctx.channel = {
      members: [],
      sendTyping: vi.fn().mockResolvedValue(undefined),
    };

    await expect(handler.wheel(ctx)).rejects.toThrow('boom');
    expect(ctx.defer).toHaveBeenCalledOnce();
    expect(groupService.coreWheel).toHaveBeenCalledOnce();
    expect(ctx.send).not.toHaveBeenCalled();
  });
});
