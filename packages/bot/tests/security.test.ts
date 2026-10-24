import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to mock the config before importing security
vi.mock('../src/core/config.js', () => ({
  BOT_TOKEN: undefined as string | undefined,
  FIREBASE_CREDENTIALS_JSON: undefined as string | undefined,
  GITHUB_TOKEN: undefined as string | undefined,
  SENTRY_DSN: undefined as string | undefined,
  DISCORD_APPLICATION_ID: undefined as string | undefined,
}));

import * as config from '../src/core/config.js';
import { sanitizeLogs, sanitizeForGithub } from '../src/core/security.js';

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
      SENTRY_DSN: undefined,
      DISCORD_APPLICATION_ID: undefined,
    });
  });

  it('redacts all secret types', () => {
    setConfig({
      BOT_TOKEN: 'SECRET_TOKEN',
      FIREBASE_CREDENTIALS_JSON: '{"private_key": "abc"}',
      GITHUB_TOKEN: 'ghp_secret',
      SENTRY_DSN: 'https://foo@bar.ingest.sentry.io/12345',
      DISCORD_APPLICATION_ID: '123456789',
    });

    const logs =
      'Error: Invalid token SECRET_TOKEN provided. also gh: ghp_secret and fb: {"private_key": "abc"} with dsn: https://foo@bar.ingest.sentry.io/12345 app_id: 123456789';
    const sanitized = sanitizeLogs(logs);

    expect(sanitized).not.toBeNull();
    expect(sanitized!).not.toContain('SECRET_TOKEN');
    expect(sanitized!).toContain('[REDACTED_BOT_TOKEN]');
    expect(sanitized!).not.toContain('ghp_secret');
    expect(sanitized!).toContain('[REDACTED_GITHUB_TOKEN]');
    expect(sanitized!).not.toContain('{"private_key": "abc"}');
    expect(sanitized!).toContain('[REDACTED_FIREBASE_CREDENTIALS]');
    expect(sanitized!).not.toContain('https://foo@bar.ingest.sentry.io/12345');
    expect(sanitized!).toContain('[REDACTED_SENTRY_DSN]');
    expect(sanitized!).not.toContain('123456789');
    expect(sanitized!).toContain('[REDACTED_DISCORD_APPLICATION_ID]');
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

describe('sanitizeForGithub', () => {
  beforeEach(() => {
    setConfig({
      BOT_TOKEN: undefined,
      FIREBASE_CREDENTIALS_JSON: undefined,
      GITHUB_TOKEN: undefined,
      SENTRY_DSN: undefined,
      DISCORD_APPLICATION_ID: undefined,
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
