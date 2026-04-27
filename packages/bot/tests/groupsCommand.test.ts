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
  BOT_INVITE_PERMISSIONS: 0,
}));

vi.mock('../src/core/issues.js', () => ({
  reportBadGroup: vi.fn(),
  createErrorIssue: vi.fn(),
  createGithubIssue: vi.fn(),
  searchGithubIssues: vi.fn(),
  submitGithubIssueModal: vi.fn(),
  getVersionString: vi.fn(),
  GitHubError: class extends Error {},
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

import { GroupsHandler, type GroupsContext, type ActivityContext } from '../src/commands/groups.js';
import { GroupService } from '../src/services/groupService.js';
import type { SessionService } from '../src/services/sessionService.js';
import { reportBadGroup } from '../src/core/issues.js';
import logger from '../src/core/logger.js';

function makeMockSessionService() {
  return {
    getOrCreateSession: vi.fn().mockResolvedValue(['123', '456']),
    activeChannels: new Map(),
    updateChannelPlayers: vi.fn().mockResolvedValue(undefined),
    cleanupChannel: vi.fn().mockResolvedValue(undefined),
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
    interaction: overrides.interaction === undefined ? null : overrides.interaction,
  } as unknown as GroupsContext;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GroupsHandler.badgroup', () => {
  it('opens modal when called via slash command without arguments', async () => {
    const groupService = new GroupService();
    groupService.lastResults.set('123', { players: [], groups: [] });

    const handler = new GroupsHandler(makeMockBot() as any, groupService, makeMockSessionService()); // eslint-disable-line @typescript-eslint/no-explicit-any

    const mockSendModal = vi.fn().mockResolvedValue(undefined);
    const ctx = makeCtx({
      interaction: { response: { sendModal: mockSendModal } },
    });

    await handler.badgroup(ctx, null, null);

    expect(mockSendModal).toHaveBeenCalledOnce();
    expect(mockSendModal).toHaveBeenCalledWith({ players: [], groups: [] });
  });

  it('reports directly with title and description', async () => {
    const groupService = new GroupService();
    groupService.lastResults.set('123', { players: [], groups: [] });

    const handler = new GroupsHandler(makeMockBot() as any, groupService, makeMockSessionService()); // eslint-disable-line @typescript-eslint/no-explicit-any

    vi.mocked(reportBadGroup).mockResolvedValue({ number: 1, html_url: 'http://url', title: 'Title' });

    const ctx = makeCtx();

    await handler.badgroup(ctx, 'Title', 'Desc');

    expect(reportBadGroup).toHaveBeenCalledOnce();
    expect(ctx.send).toHaveBeenCalledWith(
      '✅ Bad group reported successfully: http://url',
      { ephemeral: true },
    );
  });

  it('reports no data when no previous results', async () => {
    const groupService = new GroupService();
    // No results set

    const handler = new GroupsHandler(makeMockBot() as any, groupService, makeMockSessionService()); // eslint-disable-line @typescript-eslint/no-explicit-any
    const ctx = makeCtx();

    await handler.badgroup(ctx, null, null);

    expect(ctx.send).toHaveBeenCalledWith(
      '❌ No group creation data found for this server. Run /wheel first.',
      { ephemeral: true },
    );
  });
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

describe('GroupsHandler.onVoiceStateUpdate', () => {
  it('updates tracked channels on join', async () => {
    const sessionService = makeMockSessionService();
    sessionService.activeChannels.set('123', { docId: '123', guildId: '456' });

    const handler = new GroupsHandler(
      makeMockBot() as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      new GroupService(),
      sessionService,
    );

    const guild = { id: '456', name: 'G', voice_channels: [], get_channel: vi.fn() };
    const member = { bot: false, guild };

    // Join a tracked channel
    const before = { channel: null };
    const after = { channel: { id: '123', members: [member] } };

    await handler.onVoiceStateUpdate(member as any, before, after); // eslint-disable-line @typescript-eslint/no-explicit-any

    expect(sessionService.updateChannelPlayers).toHaveBeenCalledWith('123', guild);
  });

  it('updates tracked channels on leave with humans remaining', async () => {
    const sessionService = makeMockSessionService();
    sessionService.activeChannels.set('123', { docId: '123', guildId: '456' });

    const handler = new GroupsHandler(
      makeMockBot() as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      new GroupService(),
      sessionService,
    );

    const guild = { id: '456', name: 'G', voice_channels: [], get_channel: vi.fn() };
    const member = { bot: false, guild };
    const human = { bot: false };

    const before = { channel: { id: '123', members: [human] } };
    const after = { channel: null };

    await handler.onVoiceStateUpdate(member as any, before, after); // eslint-disable-line @typescript-eslint/no-explicit-any

    expect(sessionService.updateChannelPlayers).toHaveBeenCalledWith('123', guild);
    expect(sessionService.cleanupChannel).not.toHaveBeenCalled();
  });

  it('cleans up when last human leaves', async () => {
    const sessionService = makeMockSessionService();
    sessionService.activeChannels.set('123', { docId: '123', guildId: '456' });

    const handler = new GroupsHandler(
      makeMockBot() as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      new GroupService(),
      sessionService,
    );

    const guild = { id: '456', name: 'G', voice_channels: [], get_channel: vi.fn() };
    const member = { bot: false, guild };
    const botMember = { bot: true };

    const before = { channel: { id: '123', members: [botMember] } };
    const after = { channel: null };

    await handler.onVoiceStateUpdate(member as any, before, after); // eslint-disable-line @typescript-eslint/no-explicit-any

    expect(sessionService.cleanupChannel).toHaveBeenCalledWith('123');
  });

  it('ignores same-channel events (mute/unmute)', async () => {
    const sessionService = makeMockSessionService();
    sessionService.activeChannels.set('123', { docId: '123', guildId: '456' });

    const handler = new GroupsHandler(
      makeMockBot() as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      new GroupService(),
      sessionService,
    );

    const guild = { id: '456', name: 'G', voice_channels: [], get_channel: vi.fn() };
    const member = { bot: false, guild };
    const channel = { id: '123', members: [member] };

    const before = { channel };
    const after = { channel };

    await handler.onVoiceStateUpdate(member as any, before, after); // eslint-disable-line @typescript-eslint/no-explicit-any

    expect(sessionService.updateChannelPlayers).not.toHaveBeenCalled();
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

  it('catches missing-channel error, sends fallback, and logs', async () => {
    const groupService = makeStubGroupService();
    const handler = new GroupsHandler(
      makeMockBot() as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      groupService,
      makeMockSessionService(),
    );

    // ctx.channel is omitted so the handler should throw internally.
    const ctx = makeCtx();

    await handler.wheel(ctx);

    expect(ctx.defer).toHaveBeenCalledOnce();
    expect(groupService.coreWheel).not.toHaveBeenCalled();
    expect(ctx.send).toHaveBeenCalledWith(
      '❌ An unexpected error occurred. Please try again later.',
    );
    expect(logger.error).toHaveBeenCalledOnce();
    const errMsg = vi.mocked(logger.error).mock.calls[0][0] as unknown as string;
    expect(errMsg).toContain('Channel context is required for coreWheel');
  });

  it('catches errors thrown by groupService.coreWheel and logs them', async () => {
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

    await handler.wheel(ctx);

    expect(ctx.defer).toHaveBeenCalledOnce();
    expect(groupService.coreWheel).toHaveBeenCalledOnce();
    expect(ctx.send).toHaveBeenCalledWith(
      '❌ An unexpected error occurred. Please try again later.',
    );
    expect(logger.error).toHaveBeenCalledOnce();
    const errMsg = vi.mocked(logger.error).mock.calls[0][0] as unknown as string;
    expect(errMsg).toContain('Error in wheel command');
    expect(errMsg).toContain('boom');
  });
});
