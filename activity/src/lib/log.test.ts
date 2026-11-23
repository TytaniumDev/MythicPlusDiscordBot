import { afterEach, describe, expect, it, vi } from 'vitest';
import { logInfo, logTimed, logWarn } from './log';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('log', () => {
  it('writes tagged lines, with data when there is some', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logInfo('lobby', 'open');
    logWarn('sync', 'failed', { count: 2 });
    expect(info).toHaveBeenCalledWith('[Wheelson] [lobby] open');
    expect(warn).toHaveBeenCalledWith('[Wheelson] [sync] failed', { count: 2 });
  });
});

describe('logTimed', () => {
  it('logs how long the work took and passes its result through', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    await expect(logTimed('lobby', 'open lobby', async () => 42)).resolves.toBe(42);
    expect(info.mock.calls[0][0]).toMatch(/^\[Wheelson\] \[lobby\] open lobby took \d+ms$/);
  });

  it('warns how long the work ran before failing, and rethrows', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const err = new Error('denied');
    await expect(logTimed('profile', 'save roles', async () => { throw err; })).rejects.toBe(err);
    expect(warn.mock.calls[0][0]).toMatch(/save roles failed after \d+ms$/);
    expect(warn.mock.calls[0][1]).toEqual({ error: 'Error: denied' });
  });
});
