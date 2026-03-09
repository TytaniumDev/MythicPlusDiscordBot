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
}));

import * as config from '../src/core/config.js';
import {
  GitHubError,
  createGithubIssue,
  submitGithubIssueModal,
  getVersionString,
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
      reporterId: 12345,
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
    expect(body.labels).toEqual(['bug', 'jules']);

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
        reporterId: 12345,
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
