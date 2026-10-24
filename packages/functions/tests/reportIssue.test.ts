import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CallableRequest } from 'firebase-functions/v2/https';

const mockEnforceRateLimit = vi.fn();
const mockCreateGithubIssue = vi.fn();
const mockSendDiscordDm = vi.fn();
const mockTrackingSet = vi.fn();
const mockTrackingDoc = vi.fn();

vi.mock('firebase-functions/params', () => ({
  defineSecret: (name: string) => ({ value: () => `${name}-value\n` }),
}));
vi.mock('firebase-functions', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({ collection: () => ({ doc: mockTrackingDoc }) }),
  FieldValue: { serverTimestamp: () => 'SERVER_TIME' },
}));
vi.mock('../src/rateLimit', () => ({
  enforceRateLimit: (...args: unknown[]) => mockEnforceRateLimit(...args),
}));
vi.mock('../src/github', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/github')>()),
  createGithubIssue: (...args: unknown[]) => mockCreateGithubIssue(...args),
}));
vi.mock('../src/discordApi', () => ({
  sendDiscordDm: (...args: unknown[]) => mockSendDiscordDm(...args),
}));

import { reportIssue } from '../src/reportIssue';

const DISCORD_ID = '123456789012345678';
const REPORT = { kind: 'bug', title: 'Wheel stuck', description: 'It stopped.' };
const ISSUE = { number: 42, html_url: 'https://github.com/o/r/issues/42', title: 'Wheel stuck' };

function callAs(provider: string | null, data: unknown = REPORT, uid = DISCORD_ID) {
  const request = {
    data,
    auth: provider ? { uid, token: { firebase: { sign_in_provider: provider } } } : undefined,
  } as unknown as CallableRequest<unknown>;
  return reportIssue.run(request);
}

beforeEach(() => {
  mockEnforceRateLimit.mockReset().mockResolvedValue(undefined);
  mockCreateGithubIssue.mockReset().mockResolvedValue(ISSUE);
  mockSendDiscordDm.mockReset().mockResolvedValue(undefined);
  mockTrackingSet.mockReset().mockResolvedValue(undefined);
  mockTrackingDoc.mockReset().mockReturnValue({ set: mockTrackingSet });
});

describe('reportIssue', () => {
  it('files the issue, tracks it for the close DM, and DMs the link', async () => {
    const result = await callAs('custom');

    expect(result).toEqual({ issueUrl: ISSUE.html_url, issueNumber: 42 });
    expect(mockEnforceRateLimit).toHaveBeenCalledWith(DISCORD_ID, 'reportIssue', 5, 3_600_000);
    const [token, issue] = mockCreateGithubIssue.mock.calls[0];
    expect(token).toBe('GITHUB_ISSUES_TOKEN-value');
    expect(issue).toMatchObject({ title: 'Wheel stuck', labels: ['bug'] });
    expect(mockTrackingDoc).toHaveBeenCalledWith('42');
    expect(mockTrackingSet).toHaveBeenCalledWith({
      discordUserId: DISCORD_ID,
      issueUrl: ISSUE.html_url,
      issueTitle: 'Wheel stuck',
      createdAt: 'SERVER_TIME',
    });
    const [botToken, userId, content] = mockSendDiscordDm.mock.calls[0];
    expect(botToken).toBe('BOT_TOKEN-value');
    expect(userId).toBe(DISCORD_ID);
    expect(content).toContain(ISSUE.html_url);
    expect(content).toContain("I'll DM you when it's resolved.");
  });

  it('refuses anonymous callers', async () => {
    await expect(callAs('anonymous')).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(callAs(null)).rejects.toMatchObject({ code: 'permission-denied' });
    expect(mockCreateGithubIssue).not.toHaveBeenCalled();
  });

  it('rejects an invalid report', async () => {
    await expect(callAs('custom', { kind: 'bug', title: '' })).rejects.toMatchObject({ code: 'invalid-argument' });
    expect(mockCreateGithubIssue).not.toHaveBeenCalled();
  });

  it('reports GitHub failures as unavailable', async () => {
    mockCreateGithubIssue.mockRejectedValue(new Error('HTTP 500'));

    await expect(callAs('custom')).rejects.toMatchObject({ code: 'unavailable' });
    expect(mockTrackingSet).not.toHaveBeenCalled();
  });

  it('still succeeds when tracking and the DM fail, without promising a close DM', async () => {
    mockTrackingSet.mockRejectedValue(new Error('firestore down'));
    mockSendDiscordDm.mockRejectedValue(new Error('DMs closed'));

    expect(await callAs('custom')).toEqual({ issueUrl: ISSUE.html_url, issueNumber: 42 });
    expect(mockSendDiscordDm.mock.calls[0][2]).not.toContain("I'll DM you");
  });
});
