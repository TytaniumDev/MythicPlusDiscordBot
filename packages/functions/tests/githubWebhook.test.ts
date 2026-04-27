import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  verifyGithubSignature,
  sendDiscordDm,
  handleIssueWebhook,
  parseWebhookPayload,
  parseIssueTrackingDoc,
} from '../src/githubWebhook';

// Mock firebase-admin/firestore
const mockDocData = vi.fn();
const mockDocDelete = vi.fn().mockResolvedValue(undefined);
const mockDocGet = vi.fn().mockResolvedValue({
  exists: true,
  data: mockDocData,
});
const mockDoc = vi.fn().mockReturnValue({
  get: mockDocGet,
  delete: mockDocDelete,
});

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({ collection: () => ({ doc: mockDoc }) }),
}));

// Mock firebase-functions (to prevent import errors)
vi.mock('firebase-functions/v2/https', () => ({
  onRequest: vi.fn(),
}));
vi.mock('firebase-functions/params', () => ({
  defineSecret: vi.fn(),
}));
vi.mock('firebase-functions', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

describe('verifyGithubSignature', () => {
  it('returns true for a valid signature', () => {
    const body = '{"action":"closed"}';
    const secret = 'test-secret';
    const expected = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');

    expect(verifyGithubSignature(body, expected, secret)).toBe(true);
  });

  it('returns false for an invalid signature', () => {
    expect(verifyGithubSignature('body', 'sha256=invalid', 'secret')).toBe(false);
  });

  it('returns false for a missing signature', () => {
    expect(verifyGithubSignature('body', '', 'secret')).toBe(false);
  });
});

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

describe('handleIssueWebhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reinstate mock implementations cleared by clearAllMocks
    mockDoc.mockReturnValue({ get: mockDocGet, delete: mockDocDelete });
    mockDocGet.mockResolvedValue({ exists: true, data: mockDocData });
    mockDocDelete.mockResolvedValue(undefined);
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'dm-ch' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'msg' }) });
  });

  it('sends DM and deletes tracking on issues.closed', async () => {
    mockDocData.mockReturnValue({
      discordUserId: '999',
      issueUrl: 'https://github.com/owner/repo/issues/42',
      issueTitle: 'Fix the thing',
    });

    const result = await handleIssueWebhook(
      { action: 'closed', issue: { number: 42 } },
      'bot-token',
    );

    expect(result).toBe('notified');
    expect(mockDoc).toHaveBeenCalledWith('42');
    expect(mockDocDelete).toHaveBeenCalled();

    const dmCall = vi.mocked(global.fetch).mock.calls[1];
    const body = JSON.parse(dmCall[1]!.body as string);
    expect(body.content).toContain('Fix the thing');
    expect(body.content).toContain('resolved');
  });

  it('returns "ignored" for non-closed actions', async () => {
    const result = await handleIssueWebhook(
      { action: 'opened', issue: { number: 1 } },
      'bot-token',
    );
    expect(result).toBe('ignored');
  });

  it('returns "no-tracking" if no Firestore doc exists', async () => {
    mockDocGet.mockResolvedValueOnce({ exists: false, data: () => null });

    const result = await handleIssueWebhook(
      { action: 'closed', issue: { number: 99 } },
      'bot-token',
    );
    expect(result).toBe('no-tracking');
  });

  it('still deletes tracking doc even when DM fails', async () => {
    mockDocData.mockReturnValue({
      discordUserId: '999',
      issueUrl: 'https://github.com/owner/repo/issues/42',
      issueTitle: 'Fix the thing',
    });
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 403 });

    const result = await handleIssueWebhook(
      { action: 'closed', issue: { number: 42 } },
      'bot-token',
    );

    expect(result).toBe('notified');
    expect(mockDocDelete).toHaveBeenCalled();
  });

  it('returns "invalid-doc" and skips DM when stored doc has wrong shape', async () => {
    mockDocData.mockReturnValue({
      // Missing discordUserId; should be rejected by parseIssueTrackingDoc
      issueUrl: 'https://github.com/owner/repo/issues/7',
      issueTitle: 'Bad doc',
    });
    const fetchMock = vi.fn();
    global.fetch = fetchMock;

    const result = await handleIssueWebhook(
      { action: 'closed', issue: { number: 7 } },
      'bot-token',
    );

    expect(result).toBe('invalid-doc');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockDocDelete).not.toHaveBeenCalled();
  });
});

describe('parseWebhookPayload', () => {
  it('returns the payload for a valid shape', () => {
    expect(parseWebhookPayload({ action: 'closed', issue: { number: 42 } })).toEqual({
      action: 'closed',
      issue: { number: 42 },
    });
  });

  it('returns null for null/undefined/non-object input', () => {
    expect(parseWebhookPayload(null)).toBeNull();
    expect(parseWebhookPayload(undefined)).toBeNull();
    expect(parseWebhookPayload('not an object')).toBeNull();
    expect(parseWebhookPayload(123)).toBeNull();
  });

  it('returns null when action is missing or wrong type', () => {
    expect(parseWebhookPayload({ issue: { number: 1 } })).toBeNull();
    expect(parseWebhookPayload({ action: 99, issue: { number: 1 } })).toBeNull();
  });

  it('returns null when issue is missing or malformed', () => {
    expect(parseWebhookPayload({ action: 'closed' })).toBeNull();
    expect(parseWebhookPayload({ action: 'closed', issue: null })).toBeNull();
    expect(parseWebhookPayload({ action: 'closed', issue: { number: 'one' } })).toBeNull();
    expect(parseWebhookPayload({ action: 'closed', issue: {} })).toBeNull();
  });
});

describe('parseIssueTrackingDoc', () => {
  it('returns the doc for a valid shape', () => {
    const input = {
      discordUserId: '999',
      issueUrl: 'https://example.com',
      issueTitle: 'Title',
    };
    expect(parseIssueTrackingDoc(input)).toEqual(input);
  });

  it('returns null for null/undefined/non-object', () => {
    expect(parseIssueTrackingDoc(null)).toBeNull();
    expect(parseIssueTrackingDoc(undefined)).toBeNull();
    expect(parseIssueTrackingDoc('s')).toBeNull();
  });

  it('returns null if any required field is missing or wrong type', () => {
    expect(
      parseIssueTrackingDoc({ issueUrl: 'u', issueTitle: 't' }),
    ).toBeNull();
    expect(
      parseIssueTrackingDoc({ discordUserId: 1, issueUrl: 'u', issueTitle: 't' }),
    ).toBeNull();
    expect(
      parseIssueTrackingDoc({ discordUserId: 'd', issueUrl: 2, issueTitle: 't' }),
    ).toBeNull();
    expect(
      parseIssueTrackingDoc({ discordUserId: 'd', issueUrl: 'u', issueTitle: 3 }),
    ).toBeNull();
  });
});
