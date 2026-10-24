import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateKeyPairSync, sign } from 'node:crypto';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const VERIFY_KEY = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex');

const mockFetchVerifyKey = vi.fn();

vi.mock('firebase-functions/params', () => ({
  defineSecret: (name: string) => ({ value: () => `${name}-value` }),
}));
vi.mock('firebase-functions', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));
vi.mock('firebase-functions/v2/https', () => ({
  onRequest: (_opts: unknown, handler: unknown) => handler,
}));
vi.mock('../src/discordApi', () => ({
  fetchVerifyKey: (...args: unknown[]) => mockFetchVerifyKey(...args),
}));
vi.mock('../src/issueTracking', () => ({ trackIssue: vi.fn() }));
vi.mock('../src/rateLimit', () => ({ enforceRateLimit: vi.fn() }));

import { discordInteractions } from '../src/discordInteractions';

type Handler = (req: unknown, res: unknown) => Promise<void>;

function request(body: unknown, signer = privateKey, method = 'POST') {
  const raw = JSON.stringify(body);
  const timestamp = '1700000000';
  const signature = sign(null, Buffer.from(timestamp + raw), signer).toString('hex');
  const headers: Record<string, string> = { 'x-signature-ed25519': signature, 'x-signature-timestamp': timestamp };
  return { method, body, rawBody: Buffer.from(raw), get: (name: string) => headers[name] };
}

function response() {
  const res = { statusCode: 0, sent: undefined as unknown };
  return Object.assign(res, {
    status: (code: number) => { res.statusCode = code; return res; },
    json: (body: unknown) => { res.sent = body; return res; },
    send: (body: unknown) => { res.sent = body; return res; },
  });
}

beforeEach(() => {
  mockFetchVerifyKey.mockReset().mockResolvedValue(VERIFY_KEY);
});

describe('discordInteractions', () => {
  it('answers a signed ping, reading the verify key with the bot token', async () => {
    const res = response();
    await (discordInteractions as unknown as Handler)(request({ type: 1 }), res);

    expect(res.statusCode).toBe(200);
    expect(res.sent).toEqual({ type: 1 });
    expect(mockFetchVerifyKey).toHaveBeenCalledWith('BOT_TOKEN-value');
  });

  it('refuses a request signed with another key', async () => {
    const other = generateKeyPairSync('ed25519').privateKey;
    const res = response();
    await (discordInteractions as unknown as Handler)(request({ type: 1 }, other), res);

    expect(res.statusCode).toBe(401);
  });

  it('refuses other methods', async () => {
    const res = response();
    await (discordInteractions as unknown as Handler)(request({ type: 1 }, privateKey, 'GET'), res);

    expect(res.statusCode).toBe(405);
  });
});
