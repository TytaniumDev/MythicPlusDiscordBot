import { describe, expect, it } from 'vitest';
import { SYNC_STAGGER_MS, idsKey, lobbyNeedsSync, memberIdsKey, syncDelayMs } from './lobbySync';

describe('idsKey', () => {
  it('is the same for the same set of IDs in any order', () => {
    expect(idsKey(['2', '1', '2'])).toBe(idsKey(['1', '2']));
    expect(memberIdsKey([{ discordId: '2', name: 'B' }, { discordId: '1', name: 'A' }])).toBe('1,2');
    expect(memberIdsKey(undefined)).toBe('');
  });
});

describe('lobbyNeedsSync', () => {
  it('is false when the roster matches and came from this instance', () => {
    expect(lobbyNeedsSync('1,2', '1,2', 'i-1', 'i-1')).toBe(false);
  });

  it('is true when someone opened or closed the activity', () => {
    expect(lobbyNeedsSync('1,2,3', '1,2', 'i-1', 'i-1')).toBe(true);
    expect(lobbyNeedsSync('1', '1,2', 'i-1', 'i-1')).toBe(true);
  });

  it('is true for a roster from an earlier run of the activity', () => {
    expect(lobbyNeedsSync('1,2', '1,2', 'i-old', 'i-1')).toBe(true);
    expect(lobbyNeedsSync('1,2', '1,2', null, 'i-1')).toBe(true);
  });
});

describe('syncDelayMs', () => {
  it('lets the lowest ID ask first and staggers the rest', () => {
    expect(syncDelayMs(['30', '10', '20'], '10')).toBe(0);
    expect(syncDelayMs(['30', '10', '20'], '30')).toBe(2 * SYNC_STAGGER_MS);
  });

  it('puts a client that does not know who it is last', () => {
    expect(syncDelayMs(['30', '10'], null)).toBe(2 * SYNC_STAGGER_MS);
    expect(syncDelayMs(['30', '10'], '99')).toBe(2 * SYNC_STAGGER_MS);
  });
});
