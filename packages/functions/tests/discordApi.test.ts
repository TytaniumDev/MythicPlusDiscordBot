import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendDiscordDm } from '../src/discordApi';

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
