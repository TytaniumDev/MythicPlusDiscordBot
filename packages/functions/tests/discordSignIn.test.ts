import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CallableRequest } from 'firebase-functions/v2/https';

const mockCreateCustomToken = vi.fn();
const mockEnforceRateLimit = vi.fn();

vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({ createCustomToken: mockCreateCustomToken }),
}));
vi.mock('firebase-functions/params', () => ({
  defineSecret: (name: string) => ({ value: () => `${name}-value\n` }),
}));
vi.mock('../src/rateLimit', () => ({
  enforceRateLimit: (...args: unknown[]) => mockEnforceRateLimit(...args),
}));

// Import after mocks so the module under test sees them.
import { discordSignIn, exchangeDiscordCode, fetchDiscordUserId } from '../src/discordSignIn';

function jsonResponse(ok: boolean, body: unknown) {
  return { ok, json: () => Promise.resolve(body) };
}

function callWith(data: unknown, uid: string | null = 'anon-uid') {
  const request = {
    data,
    auth: uid ? { uid, token: {} } : undefined,
  } as unknown as CallableRequest<unknown>;
  return discordSignIn.run(request);
}

beforeEach(() => {
  vi.restoreAllMocks();
  mockCreateCustomToken.mockReset().mockResolvedValue('custom-token');
  mockEnforceRateLimit.mockReset().mockResolvedValue(undefined);
});

describe('exchangeDiscordCode', () => {
  it('posts the code with the client credentials and returns the access token', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(true, { access_token: 'token-1' }));

    const token = await exchangeDiscordCode('code-1', 'client-id', 'client-secret');

    expect(token).toBe('token-1');
    const [url, init] = vi.mocked(global.fetch).mock.calls[0];
    expect(url).toBe('https://discord.com/api/v10/oauth2/token');
    expect(init?.method).toBe('POST');
    const body = new URLSearchParams(init?.body as URLSearchParams);
    expect(Object.fromEntries(body)).toEqual({
      client_id: 'client-id',
      client_secret: 'client-secret',
      grant_type: 'authorization_code',
      code: 'code-1',
    });
  });

  it('returns null when Discord rejects the code', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(false, { error: 'invalid_grant' }));

    expect(await exchangeDiscordCode('bad', 'id', 'secret')).toBeNull();
  });

  it('returns null when the response has no access token', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(true, { token_type: 'Bearer' }));

    expect(await exchangeDiscordCode('code', 'id', 'secret')).toBeNull();
  });
});

describe('fetchDiscordUserId', () => {
  it('reads the user ID with the bearer token', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(true, { id: '123456789012345678', username: 'ty' }));

    expect(await fetchDiscordUserId('token-1')).toBe('123456789012345678');
    const [url, init] = vi.mocked(global.fetch).mock.calls[0];
    expect(url).toBe('https://discord.com/api/v10/users/@me');
    expect(init?.headers).toEqual({ Authorization: 'Bearer token-1' });
  });

  it('returns null for a non-numeric ID', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(true, { id: '../admin' }));

    expect(await fetchDiscordUserId('token-1')).toBeNull();
  });

  it('returns null when the request fails', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(false, {}));

    expect(await fetchDiscordUserId('token-1')).toBeNull();
  });
});

describe('discordSignIn', () => {
  it('returns a custom token whose uid is the Discord user ID', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse(true, { access_token: 'token-1' }))
      .mockResolvedValueOnce(jsonResponse(true, { id: '123456789012345678' }));

    const result = await callWith({ code: 'code-1' });

    expect(result).toEqual({ customToken: 'custom-token' });
    expect(mockCreateCustomToken).toHaveBeenCalledWith('123456789012345678');
    expect(mockEnforceRateLimit).toHaveBeenCalledWith('anon-uid', 'discordSignIn', 10, 60000);
    // Secrets are trimmed before use.
    const body = new URLSearchParams(vi.mocked(global.fetch).mock.calls[0][1]?.body as URLSearchParams);
    expect(body.get('client_id')).toBe('DISCORD_APPLICATION_ID-value');
    expect(body.get('client_secret')).toBe('DISCORD_CLIENT_SECRET-value');
  });

  it('requires a signed-in caller', async () => {
    await expect(callWith({ code: 'code-1' }, null)).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it.each([undefined, '', 42, 'x'.repeat(201)])('rejects code %j', async (code) => {
    await expect(callWith({ code })).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('rejects a code Discord does not accept', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(false, { error: 'invalid_grant' }));

    await expect(callWith({ code: 'stale' })).rejects.toMatchObject({ code: 'permission-denied' });
    expect(mockCreateCustomToken).not.toHaveBeenCalled();
  });

  it('fails when the Discord user cannot be read', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse(true, { access_token: 'token-1' }))
      .mockResolvedValueOnce(jsonResponse(false, {}));

    await expect(callWith({ code: 'code-1' })).rejects.toMatchObject({ code: 'unavailable' });
    expect(mockCreateCustomToken).not.toHaveBeenCalled();
  });
});
