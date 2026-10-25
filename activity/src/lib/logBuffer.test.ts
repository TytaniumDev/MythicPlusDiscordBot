import { afterEach, describe, expect, it } from 'vitest';
import { LOG_BUFFER_SIZE, clearLogs, formatLogs, recordLog } from './logBuffer';

afterEach(() => {
  clearLogs();
});

describe('logBuffer', () => {
  it('formats each line with its time and level, oldest first', () => {
    recordLog('info', ['first']);
    recordLog('warn', ['second', 2]);
    const lines = formatLogs().split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^\d{4}-\d{2}-\d{2}T.+Z \[info\] first$/);
    expect(lines[1]).toMatch(/\[warn\] second 2$/);
  });

  it('writes objects as JSON and errors with their message', () => {
    recordLog('error', [{ code: 4006 }, new Error('boom')]);
    expect(formatLogs()).toContain('{"code":4006} Error: boom');
  });

  it('keeps only the most recent lines', () => {
    for (let i = 0; i < LOG_BUFFER_SIZE + 5; i++) recordLog('log', [`line ${i}`]);
    const lines = formatLogs().split('\n');
    expect(lines).toHaveLength(LOG_BUFFER_SIZE);
    expect(lines[0]).toContain('line 5');
  });

  it('scrubs Discord IDs', () => {
    recordLog('log', ['member 123456789012345678 joined']);
    expect(formatLogs()).toContain('member [REDACTED_ID] joined');
  });
});
