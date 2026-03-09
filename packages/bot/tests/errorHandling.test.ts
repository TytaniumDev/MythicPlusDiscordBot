import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/core/config.js', () => ({
  DEVELOPER_ID: 999,
  LOG_FILE: '/tmp/test.log',
  BOT_TOKEN: undefined,
  FIREBASE_CREDENTIALS_JSON: undefined,
  GITHUB_TOKEN: 'fake',
  GITHUB_REPO_OWNER: 'owner',
  GITHUB_REPO_NAME: 'repo',
  GIT_SHA: 'abc123',
  DISCORD_APPLICATION_ID: undefined,
  ACTIVITY_URL: undefined,
  PLACEHOLDER_CHAR: '❓',
  BOT_INVITE_PERMISSIONS: 0,
}));

vi.mock('../src/core/issues.js', () => ({
  createErrorIssue: vi.fn(),
  createGithubIssue: vi.fn(),
  searchGithubIssues: vi.fn(),
  submitGithubIssueModal: vi.fn(),
  reportBadGroup: vi.fn(),
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

vi.mock('../src/core/preferenceService.js', () => ({
  getPreferenceService: vi.fn().mockReturnValue({
    getPreferenceSync: vi.fn().mockReturnValue(null),
    getPreferenceByNameSync: vi.fn().mockReturnValue(null),
  }),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

import { MythicPlusBot, type BotClient, type DevUser } from '../src/bot.js';
import { createErrorIssue } from '../src/core/issues.js';
import * as fs from 'fs';

function makeMockDev(): DevUser {
  return { send: vi.fn().mockResolvedValue(undefined) };
}

function makeMockClient(dev: DevUser | null = null): BotClient {
  return {
    getUser: vi.fn().mockReturnValue(dev),
    fetchUser: vi.fn().mockResolvedValue(dev),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MythicPlusBot.sendErrorToDev', () => {
  it('sends short error DM with log file attached', async () => {
    const dev = makeMockDev();
    const client = makeMockClient(dev);
    const bot = new MythicPlusBot(client);

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('mock log data'));
    vi.mocked(createErrorIssue).mockResolvedValue(null);

    const error = new Error('Test Error');
    await bot.sendErrorToDev(error, 'Test Context');

    expect(dev.send).toHaveBeenCalledOnce();
    const [message, options] = vi.mocked(dev.send).mock.calls[0];
    expect(message).toContain('Bot Error Detected');
    expect(message).toContain('Test Context');
    expect(message).toContain('Test Error');
    expect(message).toContain('Error');
    // Should have log file attached
    expect(options?.files).toHaveLength(1);
    expect(options?.files?.[0].filename).toBe('bot.log');
  });

  it('sends long traceback as file attachment', async () => {
    const dev = makeMockDev();
    const client = makeMockClient(dev);
    const bot = new MythicPlusBot(client);

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('mock log data'));
    vi.mocked(createErrorIssue).mockResolvedValue(null);

    const error = new Error('Long Error');
    error.stack = 'A'.repeat(2000);

    await bot.sendErrorToDev(error, 'Test Context');

    expect(dev.send).toHaveBeenCalledOnce();
    const [, options] = vi.mocked(dev.send).mock.calls[0];
    expect(options?.files).toHaveLength(2); // traceback.txt + log
    const filenames = options?.files?.map((f) => f.filename);
    expect(filenames).toContain('traceback.txt');
    expect(filenames).toContain('bot.log');
  });

  it('creates GitHub issue and sends follow-up DM with URL', async () => {
    const dev = makeMockDev();
    const client = makeMockClient(dev);
    const bot = new MythicPlusBot(client);

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('log'));
    vi.mocked(createErrorIssue).mockResolvedValue({ html_url: 'http://github.com/issue/1' });

    const error = new Error('Test Error');
    await bot.sendErrorToDev(error, 'Test Context');

    expect(createErrorIssue).toHaveBeenCalledWith(error, 'Test Context');
    // Two calls: error DM + issue URL follow-up
    expect(dev.send).toHaveBeenCalledTimes(2);
    const followUpMsg = vi.mocked(dev.send).mock.calls[1][0];
    expect(followUpMsg).toContain('http://github.com/issue/1');
  });

  it('does not send follow-up when no issue is created', async () => {
    const dev = makeMockDev();
    const client = makeMockClient(dev);
    const bot = new MythicPlusBot(client);

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('log'));
    vi.mocked(createErrorIssue).mockResolvedValue(null);

    await bot.sendErrorToDev(new Error('Test'), 'Test Context');

    expect(dev.send).toHaveBeenCalledOnce(); // Only error DM
  });

  it('creates issue even when developer DM fails', async () => {
    const client = makeMockClient(null); // Can't find developer
    const bot = new MythicPlusBot(client);
    vi.mocked(createErrorIssue).mockResolvedValue(null);

    await bot.sendErrorToDev(new Error('Test'), 'Test Context');

    expect(createErrorIssue).toHaveBeenCalledOnce();
  });
});

describe('MythicPlusBot.handleCommandError', () => {
  it('delegates to sendErrorToDev with command context', async () => {
    const client = makeMockClient();
    const bot = new MythicPlusBot(client);
    const sendSpy = vi.spyOn(bot, 'sendErrorToDev').mockResolvedValue(undefined);

    const ctx = {
      command: 'test_cmd',
      author: { id: 12345, toString: () => 'TestUser' },
      channel: { toString: () => 'test_channel' },
      send: vi.fn().mockResolvedValue(undefined),
    };

    const error = new Error('Unexpected Error');
    await bot.handleCommandError(ctx, error);

    expect(sendSpy).toHaveBeenCalledOnce();
    const [sentError, context] = sendSpy.mock.calls[0];
    expect(sentError).toBe(error);
    expect(context).toContain('Command: !test_cmd');
  });
});

describe('MythicPlusBot.handleAppCommandError', () => {
  it('delegates to sendErrorToDev and sends followup when response done', async () => {
    const client = makeMockClient();
    const bot = new MythicPlusBot(client);
    const sendSpy = vi.spyOn(bot, 'sendErrorToDev').mockResolvedValue(undefined);

    const interaction = {
      commandName: 'test_slash',
      user: { id: '12345', toString: () => 'TestUser' },
      channel: { toString: () => 'test_channel' },
      responseSent: true,
      reply: vi.fn().mockResolvedValue(undefined),
      followUp: vi.fn().mockResolvedValue(undefined),
    };

    const error = new Error('Slash Error');
    await bot.handleAppCommandError(interaction, error);

    expect(sendSpy).toHaveBeenCalledOnce();
    const [, context] = sendSpy.mock.calls[0];
    expect(context).toContain('App Command: /test_slash');
    expect(interaction.followUp).toHaveBeenCalledOnce();
  });
});

describe('MythicPlusBot.handleEventError', () => {
  it('delegates to sendErrorToDev with event context', async () => {
    const client = makeMockClient();
    const bot = new MythicPlusBot(client);
    const sendSpy = vi.spyOn(bot, 'sendErrorToDev').mockResolvedValue(undefined);

    const error = new Error('Event Error');
    await bot.handleEventError('on_message', error, 'arg1');

    expect(sendSpy).toHaveBeenCalledOnce();
    const [sentError, context] = sendSpy.mock.calls[0];
    expect(sentError).toBe(error);
    expect(context).toContain('Event: on_message');
  });
});
