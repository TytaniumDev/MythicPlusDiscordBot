import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { encodeGroupHistoryRounds, todayPST } from '@mythicplus/shared';
import type { WoWGroupDict, WoWPlayerDict } from '@mythicplus/shared';

const mockEnforceRateLimit = vi.fn();
const mockCreateGithubIssue = vi.fn();
const docs = new Map<string, Record<string, unknown>>();

vi.mock('firebase-functions/params', () => ({
  defineSecret: (name: string) => ({ value: () => `${name}-value` }),
}));
vi.mock('firebase-functions', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    doc: (path: string) => ({ get: () => Promise.resolve({ data: () => docs.get(path) }) }),
  }),
}));
vi.mock('../src/rateLimit', () => ({
  enforceRateLimit: (...args: unknown[]) => mockEnforceRateLimit(...args),
}));
vi.mock('../src/github', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/github')>()),
  createGithubIssue: (...args: unknown[]) => mockCreateGithubIssue(...args),
}));

import { priorRounds, reportBadGroup } from '../src/reportBadGroup';

function player(name: string, mainRole: WoWPlayerDict['mainRole']): WoWPlayerDict {
  return { name, discordId: `${name}-id`, inGameName: '', mainRole, offspecs: [], utilities: [] };
}

function group(prefix: string): WoWGroupDict {
  return {
    tank: player(`${prefix}tank`, 'tank'),
    healer: player(`${prefix}heal`, 'healer'),
    dps: [player(`${prefix}dpsa`, 'ranged'), player(`${prefix}dpsb`, 'melee'), player(`${prefix}dpsc`, 'ranged')],
  };
}

const REPORT = { channelId: '2001', title: 'Two tanks', description: 'Both in group 1', reporterName: 'Ty' };
const ISSUE = { number: 9, html_url: 'https://github.com/o/r/issues/9', title: '[Bad Group] Two tanks' };

function call(data: unknown = REPORT, uid: string | null = 'anon-uid') {
  const request = {
    data,
    auth: uid ? { uid, token: { firebase: { sign_in_provider: 'anonymous' } } } : undefined,
  } as unknown as CallableRequest<unknown>;
  return reportBadGroup.run(request);
}

beforeEach(() => {
  docs.clear();
  mockEnforceRateLimit.mockReset().mockResolvedValue(undefined);
  mockCreateGithubIssue.mockReset().mockResolvedValue(ISSUE);
});

describe('priorRounds', () => {
  it("returns today's rounds before the current one", () => {
    const history = { date: '2026-10-23', rounds: encodeGroupHistoryRounds([[group('a')], [group('b')], [group('c')]]) };
    const rounds = priorRounds(history, '2026-10-23');
    expect(rounds.map((r) => r[0].tank?.name)).toEqual(['atank', 'btank']);
  });

  it('returns nothing for an earlier day or a missing history', () => {
    const history = { date: '2026-10-22', rounds: encodeGroupHistoryRounds([[group('a')], [group('b')]]) };
    expect(priorRounds(history, '2026-10-23')).toEqual([]);
    expect(priorRounds(undefined, '2026-10-23')).toEqual([]);
  });
});

describe('reportBadGroup', () => {
  it("files an issue from the lobby's groups and the guild's earlier rounds", async () => {
    docs.set('channels/2001', { guildId: '1001', groups: [group('cur')] });
    docs.set('guilds/1001', {
      groupHistory: { date: todayPST(), rounds: encodeGroupHistoryRounds([[group('old')], [group('cur')]]) },
    });

    expect(await call()).toEqual({ issueUrl: ISSUE.html_url, issueNumber: 9 });

    expect(mockEnforceRateLimit).toHaveBeenCalledWith('anon-uid', 'reportBadGroup', 3, 600_000);
    expect(mockEnforceRateLimit).toHaveBeenCalledWith('global', 'reportBadGroup', 30, 3_600_000);
    const [token, issue] = mockCreateGithubIssue.mock.calls[0];
    expect(token).toBe('GITHUB_ISSUES_TOKEN-value');
    expect(issue.title).toBe('[Bad Group] Two tanks');
    expect(issue.body).toContain('WoWPlayer.create("curtank"');
    expect(issue.body).toContain('Round 1: [WoWGroup(Tank="oldtank');
    expect(issue.body).not.toContain('Round 2');
  });

  it('files the issue without history when the guild doc is missing', async () => {
    docs.set('channels/2001', { guildId: '1001', groups: [group('cur')] });

    await call();
    expect(mockCreateGithubIssue.mock.calls[0][1].body).not.toContain('Prior Rounds');
  });

  it('refuses a lobby with no groups and unsigned callers', async () => {
    docs.set('channels/2001', { guildId: '1001', groups: [] });
    await expect(call()).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(call({ ...REPORT, channelId: '2002' })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(call(REPORT, null)).rejects.toMatchObject({ code: 'unauthenticated' });
    expect(mockCreateGithubIssue).not.toHaveBeenCalled();
  });

  it('rejects an invalid report and reports GitHub failures as unavailable', async () => {
    await expect(call({ ...REPORT, title: '' })).rejects.toMatchObject({ code: 'invalid-argument' });
    docs.set('channels/2001', { guildId: '1001', groups: [group('cur')] });
    mockCreateGithubIssue.mockRejectedValue(new Error('HTTP 500'));
    await expect(call()).rejects.toMatchObject({ code: 'unavailable' });
  });
});
