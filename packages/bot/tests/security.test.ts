import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to mock the config before importing security
vi.mock('../src/core/config.js', () => ({
  BOT_TOKEN: undefined as string | undefined,
  FIREBASE_CREDENTIALS_JSON: undefined as string | undefined,
  GITHUB_TOKEN: undefined as string | undefined,
}));

import * as config from '../src/core/config.js';
import { obfuscatePii, sanitizeLogs, sanitizeForGithub } from '../src/core/security.js';

// Helper to set config values for tests
function setConfig(overrides: Partial<typeof config>) {
  Object.assign(config, overrides);
}

describe('sanitizeLogs', () => {
  afterEach(() => {
    setConfig({
      BOT_TOKEN: undefined,
      FIREBASE_CREDENTIALS_JSON: undefined,
      GITHUB_TOKEN: undefined,
    });
  });

  it('redacts all secret types', () => {
    setConfig({
      BOT_TOKEN: 'SECRET_TOKEN',
      FIREBASE_CREDENTIALS_JSON: '{"private_key": "abc"}',
      GITHUB_TOKEN: 'ghp_secret',
    });

    const logs =
      'Error: Invalid token SECRET_TOKEN provided. also gh: ghp_secret and fb: {"private_key": "abc"}';
    const sanitized = sanitizeLogs(logs);

    expect(sanitized).not.toBeNull();
    expect(sanitized!).not.toContain('SECRET_TOKEN');
    expect(sanitized!).toContain('[REDACTED_BOT_TOKEN]');
    expect(sanitized!).not.toContain('ghp_secret');
    expect(sanitized!).toContain('[REDACTED_GITHUB_TOKEN]');
    expect(sanitized!).not.toContain('{"private_key": "abc"}');
    expect(sanitized!).toContain('[REDACTED_FIREBASE_CREDENTIALS]');
  });

  it('returns unchanged when no secrets', () => {
    const logs = 'Just some normal logs.';
    expect(sanitizeLogs(logs)).toBe(logs);
  });

  it('returns null for null input', () => {
    expect(sanitizeLogs(null)).toBeNull();
  });

  it('returns empty string for empty input', () => {
    expect(sanitizeLogs('')).toBe('');
  });
});

describe('obfuscatePii', () => {
  it('redacts Discord object repr', () => {
    const text = "<Member id=123456789012345678 name='JohnDoe' discriminator='1234'>";
    const result = obfuscatePii(text);
    expect(result).not.toContain('123456789012345678');
    expect(result).not.toContain('JohnDoe');
    expect(result).toContain('[REDACTED_ID]');
    expect(result).toContain('[REDACTED]');
  });

  it('redacts voice channel repr', () => {
    const text = "<VoiceChannel id=987654321098765432 name='Gaming Lounge'>";
    const result = obfuscatePii(text);
    expect(result).not.toContain('987654321098765432');
    expect(result).not.toContain('Gaming Lounge');
  });

  it('redacts user context line', () => {
    const text = 'User: JohnDoe (123456789012345678)';
    const result = obfuscatePii(text);
    expect(result).not.toContain('JohnDoe');
    expect(result).not.toContain('123456789012345678');
    expect(result).toContain('[REDACTED_USER]');
    expect(result).toContain('[REDACTED_ID]');
  });

  it('redacts channel context line', () => {
    const text = 'Channel: #my-secret-channel';
    const result = obfuscatePii(text);
    expect(result).not.toContain('my-secret-channel');
    expect(result).toContain('[REDACTED_CHANNEL]');
  });

  it('redacts bare snowflake IDs', () => {
    const text = 'Error for guild 123456789012345678 in channel 987654321098765432';
    const result = obfuscatePii(text);
    expect(result).not.toContain('123456789012345678');
    expect(result).not.toContain('987654321098765432');
    expect(result.match(/\[REDACTED_ID\]/g)?.length).toBe(2);
  });

  it('preserves short numbers', () => {
    const text = 'Error code 12345 at line 67';
    expect(obfuscatePii(text)).toBe(text);
  });

  it('redacts username#discriminator', () => {
    const text = 'Something about CoolUser#9876 happened';
    const result = obfuscatePii(text);
    expect(result).not.toContain('CoolUser#9876');
    expect(result).toContain('[REDACTED_USER]');
  });

  it('redacts username with spaces#discriminator', () => {
    const text = 'Something about Cool User#9876 happened';
    const result = obfuscatePii(text);
    expect(result).not.toContain('Cool User#9876');
    expect(result).toContain('[REDACTED_USER]');
  });

  it("redacts Discord object repr with single quote in name", () => {
    const text =
      "<Member id=123456789012345678 name='O'Reilly' discriminator='1234'>";
    const result = obfuscatePii(text);
    expect(result).not.toContain("O'Reilly");
    expect(result).not.toContain('123456789012345678');
  });

  it('redacts user context with parens in name', () => {
    const text = 'User: Name(Tag) (123456789012345678)';
    const result = obfuscatePii(text);
    expect(result).not.toContain('Name(Tag)');
    expect(result).not.toContain('123456789012345678');
  });

  it('handles empty string', () => {
    expect(obfuscatePii('')).toBe('');
  });

  it('handles no PII', () => {
    const text = 'Just a normal error message with no PII';
    expect(obfuscatePii(text)).toBe(text);
  });

  it('preserves code paths', () => {
    const text = 'File "/app/cogs/groups.py", line 45, in wheel';
    expect(obfuscatePii(text)).toBe(text);
  });

  it('handles full context string', () => {
    const text = [
      'App Command: /wheel',
      'User: Tytanium (202184987469021184)',
      "Channel: <VoiceChannel id=123456789012345678 name='Gaming'>",
    ].join('\n');
    const result = obfuscatePii(text);
    expect(result).not.toContain('Tytanium');
    expect(result).not.toContain('202184987469021184');
    expect(result).not.toContain('Gaming');
    expect(result).toContain('/wheel');
  });
});

describe('sanitizeForGithub', () => {
  beforeEach(() => {
    setConfig({
      BOT_TOKEN: undefined,
      FIREBASE_CREDENTIALS_JSON: undefined,
      GITHUB_TOKEN: undefined,
    });
  });

  it('chains both sanitizers', () => {
    setConfig({ BOT_TOKEN: 'SECRET_TOKEN' });
    const text = 'Token SECRET_TOKEN\nUser: JohnDoe (123456789012345678)';
    const result = sanitizeForGithub(text);
    expect(result).not.toContain('SECRET_TOKEN');
    expect(result).not.toContain('JohnDoe');
    expect(result).not.toContain('123456789012345678');
  });

  it('handles empty string', () => {
    expect(sanitizeForGithub('')).toBe('');
  });
});
