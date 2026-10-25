import { afterEach, describe, expect, it, vi } from 'vitest';
import { logInfo, logWarn } from './log';

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
