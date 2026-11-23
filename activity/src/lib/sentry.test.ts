import { afterEach, describe, expect, it, vi } from 'vitest';
import { reportError, sentryTunnel } from './sentry';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('reportError', () => {
  it("logs an Error's message with its tag", () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = new Error('boom');
    reportError(err, { tag: 'test' });
    expect(log).toHaveBeenCalledWith('[Wheelson] [test] boom', err);
  });

  it('spells out plain objects, such as Discord SDK errors', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    reportError({ code: 4006, message: 'Not authenticated or invalid scope' }, { tag: 'sdk' });
    expect(log.mock.calls[0][0]).toBe('[Wheelson] [sdk] {"code":4006,"message":"Not authenticated or invalid scope"}');
  });
});

describe('sentryTunnel', () => {
  it("points at the project's envelope endpoint through the /sentry mapping", () => {
    expect(sentryTunnel('https://abc123@o42.ingest.us.sentry.io/4507654')).toBe('/sentry/api/4507654/envelope/');
  });

  it('gives up on a DSN without a project ID', () => {
    expect(sentryTunnel('https://abc123@o42.ingest.us.sentry.io/')).toBeNull();
    expect(sentryTunnel('not a dsn')).toBeNull();
  });
});
