import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGithubIssue } from '../src/github';

function response(status: number, body: unknown) {
  return { status, json: () => Promise.resolve(body) };
}

const ISSUE = { title: 'Wheel stuck', body: 'It stopped.', labels: ['bug'] };

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('createGithubIssue', () => {
  it('posts the issue to the repo with the token', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      response(201, { number: 7, html_url: 'https://github.com/o/r/issues/7', title: 'Wheel stuck', extra: 1 }),
    );

    const issue = await createGithubIssue('gh-token', ISSUE);

    expect(issue).toEqual({ number: 7, html_url: 'https://github.com/o/r/issues/7', title: 'Wheel stuck' });
    const [url, init] = vi.mocked(global.fetch).mock.calls[0];
    expect(url).toBe('https://api.github.com/repos/TytaniumDev/MythicPlusDiscordBot/issues');
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer gh-token');
    expect(JSON.parse(init?.body as string)).toEqual(ISSUE);
  });

  it('throws when GitHub refuses', async () => {
    global.fetch = vi.fn().mockResolvedValue(response(403, { message: 'Bad credentials' }));

    await expect(createGithubIssue('bad', ISSUE)).rejects.toThrow('HTTP 403');
  });

  it('throws on an unexpected response shape', async () => {
    global.fetch = vi.fn().mockResolvedValue(response(201, { number: '7' }));

    await expect(createGithubIssue('gh-token', ISSUE)).rejects.toThrow('unexpected issue shape');
  });
});
