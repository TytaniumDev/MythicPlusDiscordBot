import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock config before importing issues
vi.mock('../src/core/config.js', () => ({
  GITHUB_TOKEN: undefined as string | undefined,
  GITHUB_REPO_OWNER: 'owner',
  GITHUB_REPO_NAME: 'repo',
  GIT_SHA: undefined as string | undefined,
  LOG_FILE: 'mythic_bot.log',
  BOT_TOKEN: undefined,
  FIREBASE_CREDENTIALS_JSON: undefined,
  SENTRY_DSN: undefined,
  DISCORD_APPLICATION_ID: undefined,
}));

import * as config from '../src/core/config.js';
import {
  GitHubError,
  createGithubIssue,
  submitGithubIssueModal,
  getVersionString,
  searchGithubIssues,
  createErrorIssue,
  reportBadGroup,
} from '../src/core/issues.js';

function setConfig(overrides: Partial<typeof config>) {
  Object.assign(config, overrides);
}

describe('createGithubIssue', () => {
  beforeEach(() => {
    setConfig({ GITHUB_TOKEN: undefined });
  });

  it('succeeds on 201', async () => {
    setConfig({ GITHUB_TOKEN: 'fake_token' });

    global.fetch = vi.fn().mockResolvedValue({
      status: 201,
      json: vi.fn().mockResolvedValue({ html_url: 'http://github.com/issue/1' }),
    });

    const result = await createGithubIssue('Title', 'Body', ['bug']);
    expect(result.html_url).toBe('http://github.com/issue/1');
  });

  it('throws on failure', async () => {
    setConfig({ GITHUB_TOKEN: 'fake_token' });

    global.fetch = vi.fn().mockResolvedValue({
      status: 401,
      text: vi.fn().mockResolvedValue('Unauthorized'),
    });

    await expect(createGithubIssue('Title', 'Body', ['bug'])).rejects.toThrow(
      GitHubError,
    );
  });

  it('returns typed issue data with number, html_url, and title', async () => {
    setConfig({ GITHUB_TOKEN: 'fake_token' });

    global.fetch = vi.fn().mockResolvedValue({
      status: 201,
      json: vi.fn().mockResolvedValue({
        number: 42,
        html_url: 'http://github.com/issue/42',
        title: 'Test Issue',
      }),
    });

    const result = await createGithubIssue('Test Issue', 'Body', ['bug']);
    expect(result.number).toBe(42);
    expect(result.html_url).toBe('http://github.com/issue/42');
    expect(result.title).toBe('Test Issue');
  });
});

describe('submitGithubIssueModal', () => {
  beforeEach(() => {
    setConfig({ GITHUB_TOKEN: 'fake_token', GIT_SHA: 'abc123456' });
  });

  it('submits bug report with version string', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 201,
      json: vi.fn().mockResolvedValue({ html_url: 'http://url' }),
    });

    const result = await submitGithubIssueModal({
      issueType: 'bug',
      title: 'Bug Title',
      description: 'Bug Description',
      extraInfo: 'Steps',
      includeLogs: false,
      reporterName: 'TestUser',
      reporterId: '12345',
    });

    expect(result.html_url).toBe('http://url');

    const fetchCall = vi.mocked(global.fetch).mock.calls[0];
    const body = JSON.parse(fetchCall[1]!.body as string) as {
      title: string;
      body: string;
      labels: string[];
    };
    expect(body.title).toBe('Bug Title');
    expect(body.body).toContain('Bug Description');
    expect(body.body).toContain('Steps');
    expect(body.labels).toEqual(['bug']);

    const expectedVersion =
      '[`abc1234`](https://github.com/owner/repo/commit/abc123456)';
    expect(body.body).toContain(`**Version:** ${expectedVersion}`);
  });

  it('handles failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 500,
      text: vi.fn().mockResolvedValue('Error'),
    });

    await expect(
      submitGithubIssueModal({
        issueType: 'bug',
        title: 'Bug Title',
        description: 'Bug Description',
        extraInfo: '',
        includeLogs: false,
        reporterName: 'TestUser',
        reporterId: '12345',
      }),
    ).rejects.toThrow(GitHubError);
  });
});

describe('getVersionString', () => {
  it('formats version with SHA', () => {
    setConfig({ GIT_SHA: 'abc123456' });
    expect(getVersionString()).toBe(
      '[`abc1234`](https://github.com/owner/repo/commit/abc123456)',
    );
  });

  it('returns unknown without SHA', () => {
    setConfig({ GIT_SHA: undefined });
    expect(getVersionString()).toBe('unknown');
  });
});

describe('searchGithubIssues', () => {
  beforeEach(() => {
    setConfig({ GITHUB_TOKEN: 'fake_token', GITHUB_REPO_OWNER: 'owner', GITHUB_REPO_NAME: 'repo' });
  });

  it('returns null if missing config', async () => {
    setConfig({ GITHUB_TOKEN: undefined });
    expect(await searchGithubIssues('ErrorType')).toBeNull();
  });

  it('returns first issue if found', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: vi.fn().mockResolvedValue({
        total_count: 1,
        items: [{ id: 1, title: 'Existing Issue' }],
      }),
    });

    const result = await searchGithubIssues('ErrorType');
    expect(result).toEqual({ id: 1, title: 'Existing Issue' });
  });

  it('returns null if no issues found', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: vi.fn().mockResolvedValue({
        total_count: 0,
        items: [],
      }),
    });

    const result = await searchGithubIssues('ErrorType');
    expect(result).toBeNull();
  });

  it('returns null and catches error if fetch fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network Error'));

    const result = await searchGithubIssues('ErrorType');
    expect(result).toBeNull();
  });
});

describe('createErrorIssue', () => {
  beforeEach(() => {
    setConfig({ GITHUB_TOKEN: 'fake_token', GIT_SHA: 'abc123456' });
  });

  it('returns null if missing token', async () => {
    setConfig({ GITHUB_TOKEN: undefined });
    expect(await createErrorIssue(new Error('Test'), 'Context')).toBeNull();
  });

  it('skips creation if issue exists', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: vi.fn().mockResolvedValue({
        total_count: 1,
        items: [{ id: 1, title: 'Existing Issue' }],
      }),
    });

    const result = await createErrorIssue(new Error('TestError'), 'Context');
    expect(result).toEqual({ id: 1, title: 'Existing Issue' });
  });

  it('creates issue if no existing issue', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/search/issues')) {
        return Promise.resolve({
          status: 200,
          json: () => Promise.resolve({ total_count: 0, items: [] }),
        });
      }
      return Promise.resolve({
        status: 201,
        json: () => Promise.resolve({ html_url: 'http://new-issue' }),
      });
    });

    const error = new Error('TestErrorMsg');
    error.stack = 'ErrorTraceback';
    const result = await createErrorIssue(error, 'ContextInfo');

    expect(result).toEqual({ html_url: 'http://new-issue' });

    // Check second fetch call (create issue)
    const fetchCall = vi.mocked(global.fetch).mock.calls[1];
    const body = JSON.parse(fetchCall[1]!.body as string);
    expect(body.title).toContain('[Auto] Error: Error: TestErrorMsg');
    expect(body.body).toContain('ContextInfo');
    expect(body.body).toContain('ErrorTraceback');
    expect(body.labels).toEqual(['bug', 'auto-error']);
  });

  it('returns null on error inside creation', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Fetch Failed'));

    const result = await createErrorIssue(new Error('TestErrorMsg'), 'ContextInfo');
    expect(result).toBeNull();
  });
});

describe('reportBadGroup', () => {
  beforeEach(() => {
    setConfig({ GITHUB_TOKEN: 'fake_token', GIT_SHA: 'abc123456' });
  });

  it('formats bad group report and creates issue', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 201,
      json: vi.fn().mockResolvedValue({ html_url: 'http://bad-group-issue' }),
    });

    const mockPlayer1 = { toTestString: () => 'Player1' };
    const mockPlayer2 = { toTestString: () => 'Player2' };
    const mockGroup1 = { toTestString: () => 'Group1' };

    const result = await reportBadGroup({
      reporterName: 'ReporterName',
      reporterId: '123456',
      title: 'Bad Group Title',
      description: 'Bad Group Desc',
      players: [mockPlayer1, mockPlayer2],
      groups: [mockGroup1],
    });

    expect(result).toEqual({ html_url: 'http://bad-group-issue' });

    const fetchCall = vi.mocked(global.fetch).mock.calls[0];
    const body = JSON.parse(fetchCall[1]!.body as string);

    expect(body.title).toBe('[Bad Group] Bad Group Title');
    expect(body.body).toContain('ReporterName');
    expect(body.body).toContain('123456');
    expect(body.body).toContain('Bad Group Desc');
    expect(body.body).toContain('Player1, Player2');
    expect(body.body).toContain('Group1');
    expect(body.labels).toEqual(['bug', 'bad-group']);
  });
});
