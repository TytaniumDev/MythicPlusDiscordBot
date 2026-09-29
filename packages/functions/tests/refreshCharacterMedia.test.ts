import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);
const mockUpdate = vi.fn();
const mockBatchSet = vi.fn();
let preferenceDocs: { id: string; data: Record<string, unknown> }[] = [];

vi.mock('firebase-functions/params', () => ({
  defineSecret: (name: string) => ({ name, value: () => `${name}-value` }),
}));
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    collection: () => ({
      get: async () => ({ docs: preferenceDocs.map((d) => ({ id: d.id, data: () => d.data })) }),
    }),
    doc: (path: string) => ({ path, update: mockUpdate }),
    batch: () => ({ set: mockBatchSet, commit: () => Promise.resolve() }),
  }),
  FieldValue: { delete: () => 'delete', serverTimestamp: () => 'server-timestamp' },
}));
vi.mock('firebase-functions', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

// Import after mocks so the module under test sees them.
import { classifyDocs, runRefresh } from '../src/refreshCharacterMedia';

describe('classifyDocs — targets', () => {
  it('returns linkedCharacter-sourced targets for docs with a valid linkedCharacter', () => {
    const { targets, clears } = classifyDocs([
      {
        id: 'user-1',
        data: {
          linkedCharacter: { name: 'Tytanium', realm: 'stormrage', region: 'us' },
        },
      },
    ]);

    expect(targets).toEqual([
      {
        discordId: 'user-1',
        linkedCharacter: { name: 'Tytanium', realm: 'stormrage', region: 'us' },
        source: 'linkedCharacter',
      },
    ]);
    expect(clears).toEqual([]);
  });

  it('falls back to parsing inGameName when linkedCharacter is missing', () => {
    const { targets } = classifyDocs([
      { id: 'user-1', data: { inGameName: 'Tytanium-Stormrage' } },
      { id: 'user-2', data: { inGameName: "Kel'thuzad - Area 52" } },
    ]);

    expect(targets).toEqual([
      {
        discordId: 'user-1',
        linkedCharacter: { name: 'Tytanium', realm: 'stormrage', region: 'us' },
        source: 'inGameName',
      },
      {
        discordId: 'user-2',
        linkedCharacter: { name: "Kel'thuzad", realm: 'area-52', region: 'us' },
        source: 'inGameName',
      },
    ]);
  });

  it('prefers linkedCharacter over inGameName when both are present', () => {
    const { targets } = classifyDocs([
      {
        id: 'user-1',
        data: {
          inGameName: 'Oldname-OtherRealm',
          linkedCharacter: { name: 'Tytanium', realm: 'stormrage', region: 'us' },
        },
      },
    ]);

    expect(targets).toEqual([
      {
        discordId: 'user-1',
        linkedCharacter: { name: 'Tytanium', realm: 'stormrage', region: 'us' },
        source: 'linkedCharacter',
      },
    ]);
  });

  it('falls back to inGameName when linkedCharacter is incomplete', () => {
    const { targets } = classifyDocs([
      {
        id: 'user-1',
        data: {
          inGameName: 'Tytanium-Stormrage',
          linkedCharacter: { name: 'Tytanium', realm: '', region: 'us' },
        },
      },
      {
        id: 'user-2',
        data: {
          inGameName: 'Firemage-Uldum',
          linkedCharacter: null,
        },
      },
    ]);

    expect(targets).toEqual([
      {
        discordId: 'user-1',
        linkedCharacter: { name: 'Tytanium', realm: 'stormrage', region: 'us' },
        source: 'inGameName',
      },
      {
        discordId: 'user-2',
        linkedCharacter: { name: 'Firemage', realm: 'uldum', region: 'us' },
        source: 'inGameName',
      },
    ]);
  });

  it('falls back to inGameName when linkedCharacter has wrong types', () => {
    const { targets } = classifyDocs([
      {
        id: 'user-1',
        data: {
          inGameName: 'Tytanium-Stormrage',
          linkedCharacter: { name: 123, realm: 'stormrage', region: 'us' },
        },
      },
    ]);

    expect(targets).toEqual([
      {
        discordId: 'user-1',
        linkedCharacter: { name: 'Tytanium', realm: 'stormrage', region: 'us' },
        source: 'inGameName',
      },
    ]);
  });

  it('produces valid slugs even with stray whitespace around hyphens', () => {
    const { targets } = classifyDocs([
      { id: 'user-1', data: { inGameName: 'Char-Azjol - Nerub' } },
    ]);

    expect(targets).toEqual([
      {
        discordId: 'user-1',
        linkedCharacter: { name: 'Char', realm: 'azjol-nerub', region: 'us' },
        source: 'inGameName',
      },
    ]);
  });
});

describe('classifyDocs — clears', () => {
  it('flags docs with inGameName but no realm', () => {
    const { clears } = classifyDocs([
      { id: 'user-1', data: { inGameName: 'Kyle', roles: ['Melee'] } },
      { id: 'user-2', data: { inGameName: 'Tytanium-', roles: ['Tank'] } },
    ]);

    expect(clears).toEqual(['user-1', 'user-2']);
  });

  it('flags docs with stale character fields but no valid identity', () => {
    const { clears } = classifyDocs([
      { id: 'user-1', data: { wowName: 'Legacy-Name', roles: ['Healer'] } },
      { id: 'user-2', data: { mediaUrl: 'https://example/cached.jpg' } },
      // Incomplete linkedCharacter + only legacy wowName → falls through to clear.
      {
        id: 'user-3',
        data: {
          linkedCharacter: { name: 'X', realm: '', region: 'us' },
          wowName: 'OldName',
        },
      },
    ]);

    expect(clears).toEqual(['user-1', 'user-2', 'user-3']);
  });

  it('flags docs with an empty-string inGameName (treated as stale field)', () => {
    // `'' != null` is true, so hasAnyCharacterField picks this up. This is
    // intentional: an empty inGameName is garbage data worth cleaning up.
    const { clears } = classifyDocs([
      { id: 'user-1', data: { inGameName: '', roles: ['Tank'] } },
    ]);

    expect(clears).toEqual(['user-1']);
  });

  it('does not flag docs with a valid linkedCharacter', () => {
    const { clears } = classifyDocs([
      {
        id: 'user-1',
        data: { linkedCharacter: { name: 'Tytanium', realm: 'stormrage', region: 'us' } },
      },
    ]);

    expect(clears).toEqual([]);
  });

  it('does not flag docs with a parseable inGameName', () => {
    const { clears } = classifyDocs([
      { id: 'user-1', data: { inGameName: 'Tytanium-Stormrage' } },
    ]);

    expect(clears).toEqual([]);
  });

  it('does not flag docs with roles but no character fields', () => {
    const { targets, clears } = classifyDocs([
      { id: 'user-1', data: { roles: ['Tank'] } },
      { id: 'user-2', data: {} },
    ]);

    expect(targets).toEqual([]);
    expect(clears).toEqual([]);
  });
});

describe('runRefresh', () => {
  const AVATAR = 'https://render.worldofwarcraft.com/us/character/stormrage/31/256146207-avatar.jpg';
  const PROFILE = {
    name: 'Tytanium',
    realm: { slug: 'stormrage', name: 'Stormrage' },
    character_class: { name: 'Warrior' },
    active_specialization: { name: 'Protection' },
  };
  const MEDIA = { assets: [{ key: 'avatar', value: AVATAR }] };

  /** Answer Battle.net: a token, then these statuses for the profile and media requests. */
  function stubBattleNet(profileStatus: number, mediaStatus = 200) {
    mockFetch.mockImplementation(async (url: string) => {
      if (url === 'https://oauth.battle.net/token') {
        return { ok: true, status: 200, json: async () => ({ access_token: 'token', expires_in: 86400 }) };
      }
      const isMedia = url.includes('/character-media');
      const status = isMedia ? mediaStatus : profileStatus;
      return { ok: status === 200, status, json: async () => (isMedia ? MEDIA : PROFILE) };
    });
  }

  beforeEach(() => {
    preferenceDocs = [{ id: 'user-1', data: { inGameName: 'Tytanium-Stormrage', roles: ['Tank'] } }];
    mockFetch.mockReset();
    mockUpdate.mockReset().mockResolvedValue(undefined);
    mockBatchSet.mockReset();
  });

  it.each([429, 500, 503])('leaves a name-only doc alone when Battle.net answers %i', async (status) => {
    stubBattleNet(status, status);

    const summary = await runRefresh();

    expect(summary).toEqual({ total: 1, refreshed: 0, skipped: 0, failed: 1, cleared: 0 });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockBatchSet).not.toHaveBeenCalled();
  });

  it('clears a name-only doc when Battle.net has no such character', async () => {
    stubBattleNet(404, 404);

    const summary = await runRefresh();

    expect(summary).toEqual({ total: 1, refreshed: 0, skipped: 0, failed: 0, cleared: 1 });
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ inGameName: 'delete', mediaUrl: 'delete' }));
  });

  it('refreshes the portrait and backfills linkedCharacter', async () => {
    stubBattleNet(200);

    const summary = await runRefresh();

    expect(summary.refreshed).toBe(1);
    expect(mockBatchSet).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'preferences/user-1' }),
      expect.objectContaining({
        mediaUrl: AVATAR,
        characterClass: 'Warrior',
        linkedCharacter: { name: 'Tytanium', realm: 'stormrage', region: 'us' },
      }),
      { merge: true },
    );
  });

  it('keeps the stored portrait when only the media request fails', async () => {
    stubBattleNet(200, 503);

    const summary = await runRefresh();

    expect(summary.refreshed).toBe(1);
    // Only the preferences write: no mediaUrl in it, and the lookup cache
    // (which holds the fallback portrait) is left as it was.
    expect(mockBatchSet).toHaveBeenCalledTimes(1);
    const payload = mockBatchSet.mock.calls[0][1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('mediaUrl');
    expect(payload.characterClass).toBe('Warrior');
  });
});
