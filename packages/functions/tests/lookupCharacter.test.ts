import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildCharacterResult, lookupCharacter } from '../src/lookupCharacter';
import { HttpsError } from 'firebase-functions/v2/https';

// Mock firebase-admin
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockUpdate = vi.fn();
const mockRunTransaction = vi.fn();
const mockDoc = vi.fn();

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(() => ({
    doc: mockDoc,
    runTransaction: mockRunTransaction,
  })),
  FieldValue: {
    serverTimestamp: vi.fn(() => 'mock-timestamp'),
  },
  Timestamp: {
    now: vi.fn(() => ({ toMillis: () => Date.now() })),
  },
}));

vi.mock('firebase-functions/v2/https', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase-functions/v2/https')>();
  return {
    ...actual,
    onCall: vi.fn((opts, handler) => {
      const fn = handler;
      (fn as any).run = handler;
      return fn;
    }),
  };
});

const mockGetCharacterProfile = vi.fn();
const mockGetCharacterMedia = vi.fn();

vi.mock('../src/battlenet.js', () => ({
  getBattleNetClient: vi.fn(() => ({
    getCharacterProfile: mockGetCharacterProfile,
    getCharacterMedia: mockGetCharacterMedia,
  })),
}));

describe('buildCharacterResult', () => {
  it('builds result from Battle.net profile and media data', () => {
    const profile = {
      name: 'Tytanium',
      realm: { slug: 'stormrage', name: 'Stormrage' },
      character_class: { name: 'Warrior' },
      active_specialization: { name: 'Protection' },
    };
    const media = {
      assets: [{ key: 'inset', value: 'https://render.worldofwarcraft.com/us/character/inset.jpg' }],
    };

    const result = buildCharacterResult(profile, media);

    expect(result).toEqual({
      name: 'Tytanium',
      realm: 'Stormrage',
      class: 'Warrior',
      role: 'tank',
      utilities: [],
      mediaUrl: 'https://render.worldofwarcraft.com/us/character/inset.jpg',
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

describe('lookupCharacter rate limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws resource-exhausted when rate limit is exceeded', async () => {
    const mockRequest = {
      auth: { uid: 'test-uid' },
      data: { name: 'Test', realm: 'Test', region: 'us' },
    };

    mockDoc.mockReturnValue({
      get: mockGet,
      set: mockSet,
      update: mockUpdate,
    });

    mockRunTransaction.mockImplementation(async (callback) => {
      const transaction = {
        get: vi.fn().mockResolvedValue({
          data: () => ({
            count: 5,
            lastReset: { toMillis: () => Date.now() },
          }),
        }),
        set: mockSet,
        update: mockUpdate,
      };
      return callback(transaction);
    });

    // We need to call the actual handler. Since we mocked onCall to return the handler, we can call it directly.
    await expect((lookupCharacter as any).run(mockRequest))
      .rejects.toThrow(new HttpsError('resource-exhausted', 'Rate limit exceeded'));
  });

  it('resets count after 1 minute', async () => {
    const mockRequest = {
      auth: { uid: 'test-uid' },
      data: { name: 'Test', realm: 'Test', region: 'us' },
    };

    mockDoc.mockReturnValue({
      get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ result: {} }) }),
      set: vi.fn().mockResolvedValue({}),
    });

    mockRunTransaction.mockImplementation(async (callback) => {
      const transaction = {
        get: vi.fn().mockResolvedValue({
          data: () => ({
            count: 5,
            lastReset: { toMillis: () => Date.now() - 61000 }, // 61 seconds ago
          }),
        }),
        set: mockSet,
        update: mockUpdate,
      };
      return callback(transaction);
    });

    // Mock Battle.net responses so the function doesn't throw not-found
    mockGetCharacterProfile.mockResolvedValue({
      name: 'Test',
      realm: { name: 'Test' },
      character_class: { name: 'Warrior' },
    });
    mockGetCharacterMedia.mockResolvedValue({ assets: [] });

    // Should not throw, should instead call transaction.set to reset
    await (lookupCharacter as any).run(mockRequest);
    expect(mockSet).toHaveBeenCalled();
  });
});
