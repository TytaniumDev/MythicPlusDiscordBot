import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Sentry from '@sentry/node';
import { initSentry, reportError } from '../src/core/sentry.js';
import logger from '../src/core/logger.js';
import * as config from '../src/core/config.js';

vi.mock('@sentry/node', () => ({
  init: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock('../src/core/logger.js', () => ({
  default: {
    error: vi.fn(),
  },
}));

vi.mock('../src/core/config.js', () => ({
  SENTRY_DSN: 'https://test@sentry.io/123',
  GIT_SHA: 'abcdef123',
}));

describe('sentry.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initSentry', () => {
    it('initializes sentry when DSN is present', () => {
      initSentry();
      expect(Sentry.init).toHaveBeenCalledWith(expect.objectContaining({
        dsn: 'https://test@sentry.io/123',
        release: 'mythicplus-bot@abcdef123',
      }));
    });

    it('does not initialize sentry when DSN is not present', () => {
      vi.spyOn(config, 'SENTRY_DSN', 'get').mockReturnValue(undefined as any);
      initSentry();
      expect(Sentry.init).not.toHaveBeenCalled();
    });

    it('initializes sentry without release when GIT_SHA is not present', () => {
      vi.spyOn(config, 'SENTRY_DSN', 'get').mockReturnValue('https://test@sentry.io/123');
      vi.spyOn(config, 'GIT_SHA', 'get').mockReturnValue(undefined as any);
      initSentry();
      expect(Sentry.init).toHaveBeenCalledWith(expect.objectContaining({
        dsn: 'https://test@sentry.io/123',
        release: undefined,
      }));
    });

    it('uses NODE_ENV for environment or fallback to production', () => {
      const originalNodeEnv = process.env.NODE_ENV;

      process.env.NODE_ENV = 'development';
      initSentry();
      expect(Sentry.init).toHaveBeenCalledWith(expect.objectContaining({
        environment: 'development',
      }));

      delete process.env.NODE_ENV;
      initSentry();
      expect(Sentry.init).toHaveBeenCalledWith(expect.objectContaining({
        environment: 'production',
      }));

      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  describe('reportError', () => {
    it('calls logger and captureException', () => {
      const err = new Error('Test error');
      reportError(err);
      expect(logger.error).toHaveBeenCalledWith('Error: Test error');
      expect(Sentry.captureException).toHaveBeenCalledWith(err, undefined);
    });

    it('uses handler tag in log message if provided', () => {
      const err = new Error('Test error');
      reportError(err, { tags: { handler: 'myHandler' } });
      expect(logger.error).toHaveBeenCalledWith('[myHandler] Error: Test error');
      expect(Sentry.captureException).toHaveBeenCalledWith(err, { tags: { handler: 'myHandler' } });
    });
  });
});
