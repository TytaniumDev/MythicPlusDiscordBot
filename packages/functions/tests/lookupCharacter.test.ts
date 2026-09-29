import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CallableRequest } from 'firebase-functions/v2/https';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);
const mockCacheGet = vi.fn();
const mockCacheSet = vi.fn();

vi.mock('firebase-functions/params', () => ({
  defineSecret: (name: string) => ({ name, value: () => `${name}-value` }),
}));
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({ doc: () => ({ get: mockCacheGet, set: mockCacheSet }) }),
  FieldValue: { serverTimestamp: () => 'server-timestamp' },
}));
vi.mock('firebase-functions', () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));
vi.mock('../src/rateLimit', () => ({ enforceRateLimit: () => Promise.resolve() }));

// Import after mocks so the module under test sees them.
import { BattleNetClient } from '../src/battlenet';
import { buildCharacterResult, fetchCharacter, lookupCharacter, pickMediaUrl } from '../src/lookupCharacter';

const RENDER_BASE = 'https://render.worldofwarcraft.com/us/character/stormrage/31/256146207';

const PROFILE = {
  name: 'Tytanium',
  realm: { slug: 'stormrage', name: 'Stormrage' },
  character_class: { name: 'Warrior' },
  active_specialization: { name: 'Protection' },
};
const MEDIA = { assets: [{ key: 'avatar', value: `${RENDER_BASE}-avatar.jpg` }] };

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
  mockFetch.mockReset();
  mockCacheGet.mockReset().mockResolvedValue({ data: () => undefined });
  mockCacheSet.mockReset().mockResolvedValue(undefined);
});

describe('buildCharacterResult', () => {
  it('builds result from Battle.net profile and media data', () => {
    const profile = {
      name: 'Tytanium',
      realm: { slug: 'stormrage', name: 'Stormrage' },
      character_class: { name: 'Warrior' },
      active_specialization: { name: 'Protection' },
      last_login_timestamp: 1790000000000,
    };
    const media = {
      assets: [
        { key: 'inset', value: `${RENDER_BASE}-inset.jpg` },
        { key: 'avatar', value: `${RENDER_BASE}-avatar.jpg` },
      ],
    };

    const result = buildCharacterResult(profile, media);

    expect(result).toEqual({
      name: 'Tytanium',
      realm: 'Stormrage',
      class: 'Warrior',
      role: 'tank',
      utilities: [],
      mediaUrl: `${RENDER_BASE}-avatar.jpg?v=1790000000000`,
    });
  });

  it('returns null mediaUrl when media response is null', () => {
    const profile = {
      name: 'Firemage',
      realm: { slug: 'illidan', name: 'Illidan' },
      character_class: { name: 'Mage' },
      active_specialization: { name: 'Fire' },
    };

    const result = buildCharacterResult(profile, null);

    expect(result.mediaUrl).toBeNull();
    expect(result.role).toBe('ranged');
    expect(result.utilities).toEqual(['lust']);
  });

  it('maps Evoker to lust only (no brez)', () => {
    const profile = {
      name: 'Scaleface',
      realm: { slug: 'area-52', name: 'Area 52' },
      character_class: { name: 'Evoker' },
      active_specialization: { name: 'Devastation' },
    };

    const result = buildCharacterResult(profile, null);

    expect(result.utilities).toEqual(['lust']);
  });
});

describe('pickMediaUrl', () => {
  it('prefers avatar over main-raw and inset', () => {
    const media = {
      assets: [
        { key: 'inset', value: `${RENDER_BASE}-inset.jpg` },
        { key: 'main-raw', value: `${RENDER_BASE}-main-raw.png` },
        { key: 'avatar', value: `${RENDER_BASE}-avatar.jpg` },
      ],
    };

    expect(pickMediaUrl(media, undefined)).toBe(`${RENDER_BASE}-avatar.jpg`);
  });

  it('falls back to main-raw, then inset', () => {
    expect(pickMediaUrl({ assets: [{ key: 'main-raw', value: `${RENDER_BASE}-main-raw.png` }] }, undefined))
      .toBe(`${RENDER_BASE}-main-raw.png`);
    expect(pickMediaUrl({ assets: [{ key: 'inset', value: `${RENDER_BASE}-inset.jpg` }] }, undefined))
      .toBe(`${RENDER_BASE}-inset.jpg`);
  });

  it('appends the last-login timestamp as a cache-busting version', () => {
    const media = { assets: [{ key: 'avatar', value: `${RENDER_BASE}-avatar.jpg` }] };

    expect(pickMediaUrl(media, 1790000000000)).toBe(`${RENDER_BASE}-avatar.jpg?v=1790000000000`);
  });

  it('keeps an existing query string when adding the version', () => {
    const media = { assets: [{ key: 'avatar', value: `${RENDER_BASE}-avatar.jpg?alt=x` }] };

    expect(pickMediaUrl(media, 5)).toBe(`${RENDER_BASE}-avatar.jpg?alt=x&v=5`);
  });

  it('returns null when no known asset is present', () => {
    expect(pickMediaUrl({ assets: [{ key: 'main', value: `${RENDER_BASE}-main.jpg` }] }, 5)).toBeNull();
    expect(pickMediaUrl({ assets: [] }, 5)).toBeNull();
    expect(pickMediaUrl({}, 5)).toBeNull();
    expect(pickMediaUrl(null, 5)).toBeNull();
  });
});

describe('fetchCharacter', () => {
  const client = new BattleNetClient('client-id', 'client-secret');

  it('looks the character up with a lowercase realm slug', async () => {
    stubBattleNet(200);

    const result = await fetchCharacter(client, 'us', 'Stormrage', 'Tytanium');

    expect(result).toMatchObject({ name: 'Tytanium', class: 'Warrior', mediaUrl: `${RENDER_BASE}-avatar.jpg` });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/profile/wow/character/stormrage/tytanium?'),
      expect.anything(),
    );
  });

  it('returns null when Battle.net has no such character', async () => {
    stubBattleNet(404, 404);

    expect(await fetchCharacter(client, 'us', 'stormrage', 'Nobody')).toBeNull();
  });

  it('throws when Battle.net is failing, so an outage never reads as not found', async () => {
    stubBattleNet(503);

    await expect(fetchCharacter(client, 'us', 'stormrage', 'Tytanium')).rejects.toThrow('503');
  });

  it('keeps the character but drops the portrait when only the media request fails', async () => {
    stubBattleNet(200, 503);

    const result = await fetchCharacter(client, 'us', 'stormrage', 'Tytanium');

    expect(result).toMatchObject({ name: 'Tytanium', class: 'Warrior', mediaUrl: null });
  });
});

describe('lookupCharacter', () => {
  function callWith(data: unknown) {
    const request = { data, auth: { uid: 'anon-uid', token: {} } } as unknown as CallableRequest<unknown>;
    return lookupCharacter.run(request);
  }

  const lookup = { name: 'Tytanium', realm: 'stormrage', region: 'us' };

  it('rejects with not-found when Battle.net has no such character', async () => {
    stubBattleNet(404, 404);

    await expect(callWith(lookup)).rejects.toMatchObject({ code: 'not-found' });
  });

  it('rejects with unavailable, not not-found, when Battle.net is failing', async () => {
    stubBattleNet(429, 429);

    await expect(callWith(lookup)).rejects.toMatchObject({ code: 'unavailable' });
    expect(mockCacheSet).not.toHaveBeenCalled();
  });

  it('falls back to the cached portrait when only the media request fails', async () => {
    const cachedUrl = `${RENDER_BASE}-avatar.jpg?v=1`;
    mockCacheGet.mockResolvedValue({
      data: () => ({ result: { mediaUrl: cachedUrl }, cachedAt: { toMillis: () => 0 } }),
    });
    stubBattleNet(200, 503);

    const result = await callWith(lookup);

    expect(result).toMatchObject({ name: 'Tytanium', mediaUrl: cachedUrl });
    expect(mockCacheSet).toHaveBeenCalledWith(expect.objectContaining({
      result: expect.objectContaining({ mediaUrl: cachedUrl }),
    }));
  });
});
