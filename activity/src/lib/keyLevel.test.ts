import { describe, it, expect } from 'vitest';
import {
  clampKeyLevel,
  computeSuggestedKeyLevel,
  KEY_LEVEL_DEFAULT,
  KEY_LEVEL_MAX,
  KEY_LEVEL_MIN,
} from './keyLevel';

describe('clampKeyLevel', () => {
  it('passes through valid integer levels', () => {
    expect(clampKeyLevel(KEY_LEVEL_MIN)).toBe(KEY_LEVEL_MIN);
    expect(clampKeyLevel(12)).toBe(12);
    expect(clampKeyLevel(KEY_LEVEL_MAX)).toBe(KEY_LEVEL_MAX);
  });

  it('clamps out-of-range numbers', () => {
    expect(clampKeyLevel(-5)).toBe(KEY_LEVEL_MIN);
    expect(clampKeyLevel(0)).toBe(KEY_LEVEL_MIN);
    expect(clampKeyLevel(99)).toBe(KEY_LEVEL_MAX);
  });

  it('rounds non-integer values', () => {
    expect(clampKeyLevel(11.6)).toBe(12);
    expect(clampKeyLevel(11.4)).toBe(11);
  });

  it('falls back to default for unparseable input', () => {
    expect(clampKeyLevel(NaN)).toBe(KEY_LEVEL_DEFAULT);
    expect(clampKeyLevel('not-a-number')).toBe(KEY_LEVEL_DEFAULT);
    expect(clampKeyLevel(undefined)).toBe(KEY_LEVEL_DEFAULT);
    expect(clampKeyLevel(null)).toBe(KEY_LEVEL_DEFAULT);
  });

  it('parses numeric strings', () => {
    expect(clampKeyLevel('14')).toBe(14);
    expect(clampKeyLevel('25')).toBe(KEY_LEVEL_MAX);
  });
});

describe('computeSuggestedKeyLevel', () => {
  it('returns median-of-medians + 1 for a uniform group', () => {
    expect(
      computeSuggestedKeyLevel([
        [11, 11, 11, 11],
        [11, 11, 11, 11],
        [11, 11, 11, 11],
      ]),
    ).toBe(12);
  });

  it('takes the median across players, not the mean', () => {
    // Player medians: 8, 11, 11, 11, 14 → group median 11 → +1 = 12.
    expect(
      computeSuggestedKeyLevel([
        [8, 8],
        [11, 11],
        [11, 11],
        [11, 11],
        [14, 14],
      ]),
    ).toBe(12);
  });

  it('handles fractional player medians via the outer round/clamp', () => {
    // Player medians: 11.5 (avg of 11,12), 12 → group median 11.75 → +1 = 12.75 → 13.
    expect(
      computeSuggestedKeyLevel([
        [11, 12],
        [12, 12],
      ]),
    ).toBe(13);
  });

  it('skips players with no runs', () => {
    expect(
      computeSuggestedKeyLevel([
        [],
        [11, 11],
        [11, 11],
      ]),
    ).toBe(12);
  });

  it('returns null when no player has any runs', () => {
    expect(computeSuggestedKeyLevel([])).toBeNull();
    expect(computeSuggestedKeyLevel([[], [], []])).toBeNull();
  });

  it('clamps results into the supported range', () => {
    expect(computeSuggestedKeyLevel([[KEY_LEVEL_MAX, KEY_LEVEL_MAX]])).toBe(KEY_LEVEL_MAX);
    expect(computeSuggestedKeyLevel([[1]])).toBe(KEY_LEVEL_MIN);
  });
});
