import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => ({ __op: 'serverTimestamp' }) },
}));

import { characterCacheEntry, characterCachePath } from '../src/characterCache';
import type { CharacterResult } from '../src/lookupCharacter';

afterEach(() => {
  vi.useRealTimers();
});

describe('characterCachePath', () => {
  it('keys the flat cache collection by lowercased region, realm and name', () => {
    expect(characterCachePath('US', 'Area 52', 'Bob')).toBe('characterCache/us:area 52:bob');
  });
});

describe('characterCacheEntry', () => {
  it('stores the result with a server timestamp and a 30-day expiry', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);
    const result = { name: 'Bob' } as unknown as CharacterResult;
    expect(characterCacheEntry(result)).toEqual({
      result,
      cachedAt: { __op: 'serverTimestamp' },
      expireAt: new Date(1_700_000_000_000 + 30 * 24 * 60 * 60 * 1000),
    });
  });
});
