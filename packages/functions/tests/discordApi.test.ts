import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchActivityInstance, fetchGuildMemberNames, fetchVerifyKey, sendDiscordDm } from '../src/discordApi';

describe('sendDiscordDm', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('opens a DM channel and sends a message', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'dm-channel-123' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'msg-1' }),
      });

    await sendDiscordDm('bot-token', '123456789', 'Hello!');

    const calls = vi.mocked(global.fetch).mock.calls;
    // First call: open DM channel
    expect(calls[0][0]).toBe('https://discord.com/api/v10/users/@me/channels');
    expect(JSON.parse(calls[0][1]!.body as string)).toEqual({ recipient_id: '123456789' });
    // Second call: send message
    expect(calls[1][0]).toBe('https://discord.com/api/v10/channels/dm-channel-123/messages');
    expect(JSON.parse(calls[1][1]!.body as string)).toEqual({ content: 'Hello!' });
  });

  it('throws if DM channel creation fails', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ message: 'Cannot send messages to this user' }),
    });

    await expect(sendDiscordDm('bot-token', '123456789', 'Hello!')).rejects.toThrow(
      'Failed to open DM channel: 403',
    );
  });
});

describe('fetchVerifyKey', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("reads the application's public key with the bot token", async () => {
    const key = 'a'.repeat(64);
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: '1', verify_key: key }) });

    expect(await fetchVerifyKey('bot-token')).toBe(key);
    const [url, init] = vi.mocked(global.fetch).mock.calls[0];
    expect(url).toBe('https://discord.com/api/v10/applications/@me');
    expect(init?.headers).toEqual({ Authorization: 'Bot bot-token' });
  });

  it('throws when Discord refuses or has no key', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    await expect(fetchVerifyKey('bad')).rejects.toThrow('401');

    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: '1' }) });
    await expect(fetchVerifyKey('bot-token')).rejects.toThrow('no verify key');
  });
});

function respond(status: number, body: unknown = {}) {
  return vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });
}

describe('fetchActivityInstance', () => {
  it("reads the instance's channel, guild and users with the bot token", async () => {
    global.fetch = respond(200, {
      instance_id: 'i-1',
      location: { id: 'gc-1-2', kind: 'gc', channel_id: '2', guild_id: '1' },
      users: ['10', '11', 12],
    });

    await expect(fetchActivityInstance('bot-token', 'app', 'i-1')).resolves.toEqual({
      channelId: '2',
      guildId: '1',
      userIds: ['10', '11'],
    });
    const [url, init] = vi.mocked(global.fetch).mock.calls[0];
    expect(url).toBe('https://discord.com/api/v10/applications/app/activity-instances/i-1');
    expect(init?.headers).toEqual({ Authorization: 'Bot bot-token' });
  });

  it('returns null for an instance Discord no longer has', async () => {
    global.fetch = respond(404);
    await expect(fetchActivityInstance('bot-token', 'app', 'gone')).resolves.toBeNull();
  });

  it('throws on other failures and unexpected shapes', async () => {
    global.fetch = respond(500);
    await expect(fetchActivityInstance('bot-token', 'app', 'i-1')).rejects.toThrow('500');
    global.fetch = respond(200, { location: {}, users: [] });
    await expect(fetchActivityInstance('bot-token', 'app', 'i-1')).rejects.toThrow('unexpected');
  });
});

describe('fetchGuildMemberNames', () => {
  it("reads the member's nickname, display name and username", async () => {
    global.fetch = respond(200, { nick: 'Nick', user: { username: 'user', global_name: 'Global' } });

    await expect(fetchGuildMemberNames('bot-token', '1', '10')).resolves.toEqual({
      nick: 'Nick',
      globalName: 'Global',
      username: 'user',
    });
    expect(vi.mocked(global.fetch).mock.calls[0][0]).toBe('https://discord.com/api/v10/guilds/1/members/10');
  });

  it('returns null for someone not in the server', async () => {
    global.fetch = respond(404);
    await expect(fetchGuildMemberNames('bot-token', '1', '10')).resolves.toBeNull();
  });

  it('throws on other failures', async () => {
    global.fetch = respond(429);
    await expect(fetchGuildMemberNames('bot-token', '1', '10')).rejects.toThrow('429');
  });
});
