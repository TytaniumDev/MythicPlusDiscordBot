import { describe, it, expect } from 'vitest';
import { clampKeyLevel, estimateTimedScore, KEY_LEVEL_DEFAULT, KEY_LEVEL_MAX, KEY_LEVEL_MIN } from './keyLevel';

describe('estimateTimedScore', () => {
  it('returns the linear approximation for valid levels', () => {
    expect(estimateTimedScore(2)).toBe(75);
    expect(estimateTimedScore(10)).toBe(195);
    expect(estimateTimedScore(12)).toBe(225);
    expect(estimateTimedScore(20)).toBe(345);
  });

  it('returns 0 for sub-minimum or invalid input', () => {
    expect(estimateTimedScore(0)).toBe(0);
    expect(estimateTimedScore(1)).toBe(0);
    expect(estimateTimedScore(NaN)).toBe(0);
    expect(estimateTimedScore(-5)).toBe(0);
  });

  it('grows monotonically per level', () => {
    for (let n = KEY_LEVEL_MIN; n < KEY_LEVEL_MAX; n++) {
      expect(estimateTimedScore(n + 1)).toBeGreaterThan(estimateTimedScore(n));
    }
  });
});

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

  it('parses numeric strings (localStorage round-trip)', () => {
    expect(clampKeyLevel('14')).toBe(14);
    expect(clampKeyLevel('25')).toBe(KEY_LEVEL_MAX);
  });
});
