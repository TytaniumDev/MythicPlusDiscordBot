import { describe, it, expect, vi, beforeEach } from 'vitest';
import { githubWebhook } from '../src/githubWebhook.js';

// Mock firebase-admin/firestore
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockBatchCommit = vi.fn();
const mockBatchSet = vi.fn();

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    collection: (_name: string) => ({
      doc: (_id: string) => ({
        get: mockGet,
        doc: () => ({ set: mockSet }), // for nested collections
      }),
    }),
    batch: () => ({
      set: mockBatchSet,
      commit: mockBatchCommit,
    }),
  }),
  FieldValue: {
    serverTimestamp: () => 'SERVER_TIMESTAMP',
  },
}));

vi.mock('firebase-functions/logger', () => ({
  info: vi.fn(),
  error: vi.fn(),
}));

describe('githubWebhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ignores non-POST requests', async () => {
    const req = { method: 'GET' } as unknown as Parameters<typeof githubWebhook>[0];
    const res = { status: vi.fn().mockReturnThis(), send: vi.fn() } as unknown as Parameters<typeof githubWebhook>[1];

    await githubWebhook(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('processes issue creation and queues notifications', async () => {
    const req = {
      method: 'POST',
      headers: { 'x-github-event': 'issues' },
      body: {
        action: 'opened',
        issue: { number: 123, html_url: 'http://github.com/issue/123' },
        sender: { login: 'tester' },
      },
    } as unknown as Parameters<typeof githubWebhook>[0];
    const res = { status: vi.fn().mockReturnThis(), send: vi.fn() } as unknown as Parameters<typeof githubWebhook>[1];

    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ userIds: ['user_1', 'user_2'] }),
    });

    await githubWebhook(req, res);

    expect(mockBatchSet).toHaveBeenCalledTimes(2);
    expect(mockBatchCommit).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('processes issue comment and queues notifications', async () => {
    const req = {
      method: 'POST',
      headers: { 'x-github-event': 'issue_comment' },
      body: {
        action: 'created',
        issue: { number: 123, html_url: 'http://github.com/issue/123' },
        comment: { html_url: 'http://github.com/issue/123#comment' },
        sender: { login: 'tester' },
      },
    } as unknown as Parameters<typeof githubWebhook>[0];
    const res = { status: vi.fn().mockReturnThis(), send: vi.fn() } as unknown as Parameters<typeof githubWebhook>[1];

    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ userIds: ['user_1'] }),
    });

    await githubWebhook(req, res);

    expect(mockBatchSet).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      userId: 'user_1',
      issueNumber: 123,
      message: 'tester **commented** on issue #123.',
    }));
    expect(mockBatchCommit).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('ignores non-created comment actions', async () => {
    const req = {
      method: 'POST',
      headers: { 'x-github-event': 'issue_comment' },
      body: {
        action: 'edited',
        issue: { number: 123 },
      },
    } as unknown as Parameters<typeof githubWebhook>[0];
    const res = { status: vi.fn().mockReturnThis(), send: vi.fn() } as unknown as Parameters<typeof githubWebhook>[1];

    await githubWebhook(req, res);

    expect(mockBatchCommit).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith('Ignored');
  });
});
