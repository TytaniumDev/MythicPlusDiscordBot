import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/core/config.js', () => ({
  GIT_SHA: 'abc123456789',
  GITHUB_REPO_OWNER: 'Owner',
  GITHUB_REPO_NAME: 'Repo',
  DISCORD_APPLICATION_ID: '12345',
  BOT_INVITE_PERMISSIONS: 274878221376,
  DEVELOPER_ID: 999,
  LOG_FILE: '/tmp/test.log',
  BOT_TOKEN: undefined,
  FIREBASE_CREDENTIALS_JSON: undefined,
  GITHUB_TOKEN: 'fake',
  ACTIVITY_URL: undefined,
  PLACEHOLDER_CHAR: '❓',
}));

vi.mock('os', () => ({
  loadavg: vi.fn().mockReturnValue([0.5, 0.4, 0.3]),
}));

import { GeneralHandler, type GeneralContext, type VoiceClient } from '../src/commands/general.js';
import type { AffixDisplay } from '@mythicplus/shared';
import * as config from '../src/core/config.js';

function makeCtx(overrides: Partial<GeneralContext> = {}): GeneralContext {
  return {
    guild: overrides.guild === undefined ? { id: '12345' } : overrides.guild,
    send: vi.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GeneralHandler.version', () => {
  it('shows commit link when GIT_SHA is set', async () => {
    const handler = new GeneralHandler();
    const ctx = makeCtx();

    await handler.version(ctx);

    expect(ctx.send).toHaveBeenCalledOnce();
    const [, options] = vi.mocked(ctx.send).mock.calls[0];
    const embed = (options as Record<string, any>).embed; // eslint-disable-line @typescript-eslint/no-explicit-any

    expect(embed.title).toBe('Bot Version');
    const commitField = embed.fields.find((f: any) => f.name === 'Commit'); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(commitField).toBeTruthy();
    expect(commitField.value).toContain('abc1234');
    expect(commitField.value).toContain(
      'https://github.com/Owner/Repo/commit/abc123456789',
    );
  });

  it('shows unknown when GIT_SHA is empty', async () => {
    // Temporarily change the mocked config value
    const original = config.GIT_SHA;
    Object.defineProperty(config, 'GIT_SHA', { value: null, writable: true, configurable: true });

    const handler = new GeneralHandler();
    const ctx = makeCtx();

    await handler.version(ctx);

    const [, options] = vi.mocked(ctx.send).mock.calls[0];
    const embed = (options as Record<string, any>).embed; // eslint-disable-line @typescript-eslint/no-explicit-any
    const commitField = embed.fields.find((f: any) => f.name === 'Commit'); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(commitField.value).toBe('unknown');

    // Restore
    Object.defineProperty(config, 'GIT_SHA', { value: original, writable: true, configurable: true });
  });
});

describe('GeneralHandler.status', () => {
  it('shows uptime, ping, and system load', async () => {
    const handler = new GeneralHandler(0.05); // 50ms latency
    // Set start time to simulate 60 seconds of uptime
    const now = Date.now() / 1000;
    handler._setStartTime(now - 60);

    const ctx = makeCtx({ guild: { id: '12345' } });

    await handler.status(ctx);

    expect(ctx.send).toHaveBeenCalledOnce();
    const [, options] = vi.mocked(ctx.send).mock.calls[0];
    const embed = (options as Record<string, any>).embed; // eslint-disable-line @typescript-eslint/no-explicit-any

    expect(embed.title).toBe('Bot Status');

    const fields: Record<string, string> = {};
    for (const f of embed.fields) {
      fields[f.name] = f.value;
    }

    expect(fields['Uptime']).toBe('0:01:00');
    expect(fields['Ping']).toBe('50ms');
    expect(fields['Commit']).toBe('[`abc1234`](https://github.com/Owner/Repo/commit/abc123456789)');
    expect(fields['System Load']).toBe('0.50, 0.40, 0.30');
    expect(embed.footer.text).toContain('Server ID: 12345');
  });
});

describe('GeneralHandler.affixes', () => {
  const sampleAffixes: AffixDisplay[] = [
    { id: 165, name: "Lindormi's Guidance", nickname: 'training wheels', keystoneLevel: '+2–5', wowheadUrl: 'https://www.wowhead.com/affix=165/lindormis-guidance', color: '#22c55e' },
    { id: 160, name: "Xal'atath's Bargain: Devour", nickname: 'Dispel Allies', keystoneLevel: '+4–11', wowheadUrl: 'https://www.wowhead.com/affix=160/xalataths-bargain-devour', color: '#a855f7' },
    { id: 10, name: 'Fortified', nickname: null, keystoneLevel: '+7', wowheadUrl: 'https://www.wowhead.com/affix=10/fortified', color: '#ef4444' },
    { id: 147, name: "Xal'atath's Guile", nickname: 'death penalty', keystoneLevel: '+12', wowheadUrl: 'https://www.wowhead.com/affix=147/xalataths-guile', color: '#f59e0b' },
  ];

  it('sends an ephemeral embed with all affixes', async () => {
    const handler = new GeneralHandler();
    const ctx = makeCtx();

    await handler.affixes(ctx, sampleAffixes);

    expect(ctx.send).toHaveBeenCalledOnce();
    const [, options] = vi.mocked(ctx.send).mock.calls[0];
    const opts = options as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(opts.ephemeral).toBe(true);

    const embed = opts.embed;
    expect(embed.title).toBe("This Week's Affixes");
    const value: string = embed.fields[0].value;
    expect(value).toContain("Lindormi's Guidance");
    expect(value).toContain('training wheels');
    expect(value).toContain('Fortified');
    expect(value).toContain('+7');
    expect(value).toContain("Xal'atath's Guile");
    expect(value).toContain('death penalty');
  });

  it('includes wowhead links for each affix', async () => {
    const handler = new GeneralHandler();
    const ctx = makeCtx();

    await handler.affixes(ctx, sampleAffixes);

    const [, options] = vi.mocked(ctx.send).mock.calls[0];
    const value: string = (options as any).embed.fields[0].value; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(value).toContain('https://www.wowhead.com/affix=165/lindormis-guidance');
    expect(value).toContain('https://www.wowhead.com/affix=10/fortified');
  });

  it('omits nickname when null', async () => {
    const handler = new GeneralHandler();
    const ctx = makeCtx();

    const affixes: AffixDisplay[] = [
      { id: 10, name: 'Fortified', nickname: null, keystoneLevel: '+7', wowheadUrl: 'https://www.wowhead.com/affix=10/fortified', color: '#ef4444' },
    ];

    await handler.affixes(ctx, affixes);

    const [, options] = vi.mocked(ctx.send).mock.calls[0];
    const value: string = (options as any).embed.fields[0].value; // eslint-disable-line @typescript-eslint/no-explicit-any
    // Should not have a trailing dash/em-dash for null nicknames
    expect(value).not.toContain('— *');
  });
});

describe('GeneralHandler.onVoiceStateUpdate', () => {
  it('disconnects when bot is the only one left', async () => {
    const handler = new GeneralHandler();

    const voiceClient: VoiceClient = {
      channel: { members: ['bot_only'] },
      disconnect: vi.fn().mockResolvedValue(undefined),
    };

    await handler.onVoiceStateUpdate(voiceClient);

    expect(voiceClient.disconnect).toHaveBeenCalledWith({ force: false });
  });

  it('does not disconnect when others are present', async () => {
    const handler = new GeneralHandler();

    const voiceClient: VoiceClient = {
      channel: { members: ['bot', 'human'] },
      disconnect: vi.fn().mockResolvedValue(undefined),
    };

    await handler.onVoiceStateUpdate(voiceClient);

    expect(voiceClient.disconnect).not.toHaveBeenCalled();
  });

  it('does nothing when not in a voice channel', async () => {
    const handler = new GeneralHandler();
    await handler.onVoiceStateUpdate(null);
  });
});
