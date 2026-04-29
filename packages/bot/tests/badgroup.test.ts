import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WoWPlayer, WoWGroup } from '@mythicplus/shared';

// Mock config
vi.mock('../src/core/config.js', () => ({
  GITHUB_TOKEN: 'fake_token',
  GITHUB_REPO_OWNER: 'owner',
  GITHUB_REPO_NAME: 'repo',
  GIT_SHA: 'abc123456',
  LOG_FILE: 'nonexistent_log.log',
  BOT_TOKEN: undefined,
  FIREBASE_CREDENTIALS_JSON: undefined,
  SENTRY_DSN: undefined,
  DISCORD_APPLICATION_ID: undefined,
}));

import { reportBadGroup } from '../src/core/issues.js';

describe('reportBadGroup', () => {
  const p1 = WoWPlayer.create('Player1', ['Tank']);
  const p2 = WoWPlayer.create('Player2', ['Healer']);
  const p3 = WoWPlayer.create('Player3', ['Melee']);
  const p4 = WoWPlayer.create('Player4', ['Ranged']);
  const p5 = WoWPlayer.create('Player5', ['Melee']);

  const players = [p1, p2, p3, p4, p5];
  const group = new WoWGroup(p1, p2, [p3, p4, p5]);

  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 201,
      json: vi.fn().mockResolvedValue({ html_url: 'http://url' }),
    });
  });

  it('creates issue with player code and version', async () => {
    const result = await reportBadGroup({
      reporterName: 'TestUser',
      reporterId: '12345',
      title: 'Bad Algo',
      description: 'Too many melee',
      players,
      groups: [group],
    });

    expect(result.html_url).toBe('http://url');

    const fetchCall = vi.mocked(global.fetch).mock.calls[0];
    const body = JSON.parse(fetchCall[1]!.body as string) as {
      title: string;
      body: string;
      labels: string[];
    };

    expect(body.title).toBe('[Bad Group] Bad Algo');
    expect(body.body).toContain('Too many melee');
    expect(body.body).toContain('WoWPlayer.create("Player1"');
    expect(body.labels).toEqual(['bug', 'bad-group']);

    const expectedVersion =
      '[`abc1234`](https://github.com/owner/repo/commit/abc123456)';
    expect(body.body).toContain(`**Version:** ${expectedVersion}`);
  });

  it('renders prior rounds when supplied', async () => {
    const priorTank = WoWPlayer.create('PriorTank', ['Tank']);
    const priorHealer = WoWPlayer.create('PriorHealer', ['Healer']);
    const priorDps1 = WoWPlayer.create('PriorDps1', ['Melee']);
    const priorDps2 = WoWPlayer.create('PriorDps2', ['Ranged']);
    const priorDps3 = WoWPlayer.create('PriorDps3', ['Melee']);
    const priorRound1 = [
      new WoWGroup(priorTank, priorHealer, [priorDps1, priorDps2, priorDps3]),
    ];

    await reportBadGroup({
      reporterName: 'TestUser',
      reporterId: '12345',
      title: 'Repeat pairing',
      description: 'Got grouped with same person twice',
      players,
      groups: [group],
      priorRounds: [priorRound1],
    });

    const fetchCall = vi.mocked(global.fetch).mock.calls[0];
    const body = JSON.parse(fetchCall[1]!.body as string) as { body: string };

    expect(body.body).toContain('**Prior Rounds:**');
    expect(body.body).toContain('PriorTank');
    expect(body.body).toContain('PriorHealer');
  });

  it('omits prior rounds section when not supplied or empty', async () => {
    await reportBadGroup({
      reporterName: 'TestUser',
      reporterId: '12345',
      title: 'No history',
      description: 'First round of the night',
      players,
      groups: [group],
      priorRounds: [],
    });

    const fetchCall = vi.mocked(global.fetch).mock.calls[0];
    const body = JSON.parse(fetchCall[1]!.body as string) as { body: string };

    expect(body.body).not.toContain('**Prior Rounds:**');
  });
});
