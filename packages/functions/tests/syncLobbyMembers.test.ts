import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CallableRequest } from 'firebase-functions/v2/https';

const mockEnforceRateLimit = vi.fn();
const mockFetchActivityInstance = vi.fn();
const mockFetchGuildMemberNames = vi.fn();
const mockUpdate = vi.fn();
const docs = new Map<string, Record<string, unknown>>();

vi.mock('firebase-functions/params', () => ({
  defineSecret: (name: string) => ({ value: () => `${name}-value` }),
}));
vi.mock('firebase-functions', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));
vi.mock('firebase-admin/firestore', () => {
  const doc = (path: string) => ({ path, get: () => Promise.resolve({ data: () => docs.get(path) }) });
  return {
    FieldValue: { serverTimestamp: () => 'server-time' },
    getFirestore: () => ({
      doc,
      runTransaction: (fn: (t: unknown) => Promise<unknown>) => fn({
        get: (ref: { get: () => Promise<unknown> }) => ref.get(),
        update: (ref: { path: string }, data: unknown) => mockUpdate(ref.path, data),
      }),
    }),
  };
});
vi.mock('../src/rateLimit', () => ({
  enforceRateLimit: (...args: unknown[]) => mockEnforceRateLimit(...args),
}));
vi.mock('../src/discordApi', () => ({
  fetchActivityInstance: (...args: unknown[]) => mockFetchActivityInstance(...args),
  fetchGuildMemberNames: (...args: unknown[]) => mockFetchGuildMemberNames(...args),
}));

import { syncLobbyMembers } from '../src/syncLobbyMembers';

const REQUEST = { channelId: '2001', instanceId: 'i-1' };
const INSTANCE = { channelId: '2001', guildId: '1001', userIds: ['10', '11'] };
const FRESH = new Date(Date.now() + 20 * 60 * 60 * 1000);

function call(data: unknown = REQUEST, uid: string | null = 'anon-uid') {
  const request = {
    data,
    auth: uid ? { uid, token: { firebase: { sign_in_provider: 'anonymous' } } } : undefined,
  } as unknown as CallableRequest<unknown>;
  return syncLobbyMembers.run(request);
}

beforeEach(() => {
  docs.clear();
  mockEnforceRateLimit.mockReset().mockResolvedValue(undefined);
  mockFetchActivityInstance.mockReset().mockResolvedValue(INSTANCE);
  mockFetchGuildMemberNames.mockReset().mockImplementation((_t: string, _g: string, id: string) =>
    Promise.resolve({ nick: null, globalName: `Name.${id}`, username: `user${id}` }));
  mockUpdate.mockReset();
});

describe('syncLobbyMembers', () => {
  it("writes the instance's users as the lobby's members, naming newcomers from the server", async () => {
    docs.set('channels/2001', {
      guildId: '1001',
      instanceId: 'i-1',
      expireAt: FRESH,
      members: [{ discordId: '11', name: 'Kept' }, { discordId: '12', name: 'Gone' }],
    });

    expect(await call()).toEqual({ changed: true });

    expect(mockEnforceRateLimit).toHaveBeenCalledWith('anon-uid', 'syncLobbyMembers', 30, 60000);
    expect(mockFetchActivityInstance).toHaveBeenCalledWith('BOT_TOKEN-value', 'DISCORD_APPLICATION_ID-value', 'i-1');
    expect(mockFetchGuildMemberNames).toHaveBeenCalledOnce();
    expect(mockFetchGuildMemberNames).toHaveBeenCalledWith('BOT_TOKEN-value', '1001', '10');
    const [path, update] = mockUpdate.mock.calls[0];
    expect(path).toBe('channels/2001');
    expect(update).toMatchObject({
      members: [{ discordId: '11', name: 'Kept' }, { discordId: '10', name: 'Name10' }],
      instanceId: 'i-1',
      lastActive: 'server-time',
    });
    expect(update).not.toHaveProperty('status');
  });

  it('writes nothing when the lobby is already current', async () => {
    docs.set('channels/2001', {
      guildId: '1001',
      instanceId: 'i-1',
      expireAt: { toDate: () => FRESH },
      members: [{ discordId: '10', name: 'A' }, { discordId: '11', name: 'B' }],
    });

    expect(await call()).toEqual({ changed: false });
    expect(mockFetchGuildMemberNames).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('resets the round for a new activity instance', async () => {
    docs.set('channels/2001', { guildId: '1001', instanceId: 'i-old', status: 'completed', members: [] });

    await call();
    expect(mockUpdate.mock.calls[0][1]).toMatchObject({ instanceId: 'i-1', status: 'lobby', groups: [] });
  });

  it('refuses an instance that has ended or runs in another channel or server', async () => {
    docs.set('channels/2001', { guildId: '1001', members: [] });
    mockFetchActivityInstance.mockResolvedValueOnce(null);
    await expect(call()).rejects.toMatchObject({ code: 'permission-denied' });
    mockFetchActivityInstance.mockResolvedValueOnce({ ...INSTANCE, channelId: '2002' });
    await expect(call()).rejects.toMatchObject({ code: 'permission-denied' });
    mockFetchActivityInstance.mockResolvedValueOnce({ ...INSTANCE, guildId: '1002' });
    await expect(call()).rejects.toMatchObject({ code: 'permission-denied' });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('refuses a channel with no lobby, bad input and unsigned callers', async () => {
    await expect(call()).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(call({ channelId: 'x', instanceId: 'i-1' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(call(REQUEST, null)).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it('reports Discord failures as unavailable', async () => {
    docs.set('channels/2001', { guildId: '1001', members: [] });
    mockFetchGuildMemberNames.mockRejectedValueOnce(new Error('HTTP 500'));
    await expect(call()).rejects.toMatchObject({ code: 'unavailable' });
    mockFetchActivityInstance.mockRejectedValueOnce(new Error('HTTP 500'));
    await expect(call()).rejects.toMatchObject({ code: 'unavailable' });
  });
});
