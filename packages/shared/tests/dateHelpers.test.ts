import { afterEach, describe, expect, it, vi } from 'vitest';
import { todayPST } from '../src/dateHelpers';

describe('todayPST', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the previous calendar date when UTC has rolled over but PST has not', () => {
    // 03:00 UTC on 2026-04-07 is 20:00 (8pm) the previous day in PST/PDT.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-07T03:00:00Z'));
    expect(todayPST()).toBe('2026-04-06');
  });

  it('returns the same calendar date when UTC and PST are aligned within the day', () => {
    // 15:00 UTC on 2026-04-07 is 08:00 PDT same day.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-07T15:00:00Z'));
    expect(todayPST()).toBe('2026-04-07');
  });

  it('formats the result as ISO YYYY-MM-DD', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T20:00:00Z'));
    const result = todayPST();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result).toBe('2026-01-01');
  });

  it('handles winter PST (UTC-8) date crossover', () => {
    // 07:00 UTC on 2026-01-15 is 23:00 PST the previous day.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T07:00:00Z'));
    expect(todayPST()).toBe('2026-01-14');
  });
});
