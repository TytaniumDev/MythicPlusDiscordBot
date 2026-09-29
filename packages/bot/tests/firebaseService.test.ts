import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WoWPlayer, WoWGroup, type WoWGroupDict } from '@mythicplus/shared';
import { FieldValue } from 'firebase-admin/firestore';
import { FirebaseService } from '../src/core/firebaseService.js';


describe('FirebaseService.getOrCreateGuildDoc', () => {
  let service: FirebaseService;

  function createMockDbWithDocRef() {
    const mockDocRef = {
      get: vi.fn(),
      set: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn(),
      onSnapshot: vi.fn(),
    };
    const mockCollection = {
      doc: vi.fn().mockReturnValue(mockDocRef),
      where: vi.fn(),
      get: vi.fn(),
      onSnapshot: vi.fn(),
    };
    const db = {
      collection: vi.fn().mockReturnValue(mockCollection),
      batch: vi.fn(),
    };
    return { db, mockCollection, mockDocRef };
  }

  beforeEach(() => {
    service = Object.create(FirebaseService.prototype);
  });

  it('throws error when db is not initialized', async () => {
    service.db = null;
    await expect(service.getOrCreateGuildDoc('123')).rejects.toThrow('Firebase is not initialized.');
  });

  it('creates new document when it does not exist', async () => {
    const { db, mockDocRef } = createMockDbWithDocRef();
    service.db = db as unknown as FirebaseService['db'];
    mockDocRef.get.mockResolvedValue({ exists: false, data: () => null });

    const result = await service.getOrCreateGuildDoc('123', 'My Guild', 'http://icon.url');

    expect(result).toBe('123');
    expect(db.collection).toHaveBeenCalledWith('guilds');
    expect(db.collection('guilds').doc).toHaveBeenCalledWith('123');
    expect(mockDocRef.set).toHaveBeenCalledWith({
      guildId: '123',
      voiceChannels: [],
      createdAt: expect.anything(),
      lastActive: expect.anything(),
      guildName: 'My Guild',
      guildIconUrl: 'http://icon.url',
    });
  });

  it('updates existing document when it exists', async () => {
    const { db, mockDocRef } = createMockDbWithDocRef();
    service.db = db as unknown as FirebaseService['db'];
    mockDocRef.get.mockResolvedValue({ exists: true, data: () => ({ guildId: '123' }) });

    const result = await service.getOrCreateGuildDoc('123', 'Updated Guild');

    expect(result).toBe('123');
    expect(mockDocRef.update).toHaveBeenCalledWith({
      lastActive: expect.anything(),
      guildName: 'Updated Guild',
    });
  });
});

describe('FirebaseService.updateGuildDoc', () => {
  let service: FirebaseService;

  function createMockDbWithDocRef() {
    const mockDocRef = {
      get: vi.fn(),
      set: vi.fn(),
      update: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn(),
      onSnapshot: vi.fn(),
    };
    const mockCollection = {
      doc: vi.fn().mockReturnValue(mockDocRef),
      where: vi.fn(),
      get: vi.fn(),
      onSnapshot: vi.fn(),
    };
    const db = {
      collection: vi.fn().mockReturnValue(mockCollection),
      batch: vi.fn(),
    };
    return { db, mockCollection, mockDocRef };
  }

  beforeEach(() => {
    service = Object.create(FirebaseService.prototype);
  });

  it('returns early when db is null', async () => {
    service.db = null;
    await service.updateGuildDoc('123', { field: 'value' });
    // No error thrown
  });

  it('calls docRef.update with correct arguments', async () => {
    const { db, mockDocRef } = createMockDbWithDocRef();
    service.db = db as unknown as FirebaseService['db'];

    await service.updateGuildDoc('123', { someField: 'newValue' });

    expect(db.collection).toHaveBeenCalledWith('guilds');
    expect(db.collection('guilds').doc).toHaveBeenCalledWith('123');
    expect(mockDocRef.update).toHaveBeenCalledWith({ someField: 'newValue' });
  });
});

describe('FirebaseService lobby expiry', () => {
  const NOW = 1_700_000_000_000;
  const EXPIRE_AT = new Date(NOW + 24 * 60 * 60 * 1000);
  let service: FirebaseService;
  let mockDocRef: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mockDocRef = {
      get: vi.fn(),
      set: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
    };
    service = Object.create(FirebaseService.prototype);
    service.db = {
      collection: vi.fn().mockReturnValue({ doc: vi.fn().mockReturnValue(mockDocRef) }),
    } as unknown as FirebaseService['db'];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sets expireAt 24h out when writing lobby members', async () => {
    await service.setChannelMembers('c1', [{ discordId: '1', name: 'Ay' }]);
    expect(mockDocRef.update).toHaveBeenCalledWith({
      members: [{ discordId: '1', name: 'Ay' }],
      lastActive: expect.anything(),
      expireAt: EXPIRE_AT,
    });
  });

  it('sets expireAt when creating a lobby', async () => {
    mockDocRef.get.mockResolvedValue({ exists: false });
    await service.getOrCreateChannelDoc('c1', 'g1', 'Voice');
    expect(mockDocRef.set).toHaveBeenCalledWith(expect.objectContaining({ expireAt: EXPIRE_AT }));
  });

  it('refreshes expireAt when reusing a lobby', async () => {
    mockDocRef.get.mockResolvedValue({ exists: true });
    await service.getOrCreateChannelDoc('c1', 'g1', 'Voice');
    expect(mockDocRef.update).toHaveBeenCalledWith(expect.objectContaining({ expireAt: EXPIRE_AT }));
  });
});

describe('FirebaseService.deleteDoc', () => {
  let service: FirebaseService;

  function createMockDbWithDocRef() {
    const mockDocRef = {
      get: vi.fn(),
      set: vi.fn(),
      update: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined),
      onSnapshot: vi.fn(),
    };
    const mockCollection = {
      doc: vi.fn().mockReturnValue(mockDocRef),
      where: vi.fn(),
      get: vi.fn(),
      onSnapshot: vi.fn(),
    };
    const db = {
      collection: vi.fn().mockReturnValue(mockCollection),
      batch: vi.fn(),
    };
    return { db, mockCollection, mockDocRef };
  }

  beforeEach(() => {
    service = Object.create(FirebaseService.prototype);
  });

  it('does nothing when db is null', async () => {
    service.db = null;
    await service.deleteDoc('test-collection', 'test-doc-id');
    // No error thrown
  });

  it('deletes document with given collection and docId', async () => {
    const { db, mockDocRef } = createMockDbWithDocRef();
    service.db = db as unknown as FirebaseService['db'];

    await service.deleteDoc('test-collection', 'test-doc-id');

    expect(db.collection).toHaveBeenCalledWith('test-collection');
    expect(db.collection('test-collection').doc).toHaveBeenCalledWith('test-doc-id');
    expect(mockDocRef.delete).toHaveBeenCalledTimes(1);
  });
});

describe('FirebaseService.getGroupHistory', () => {
  let service: FirebaseService;

  function createMockDbWithDocRef() {
    const mockDocRef = {
      get: vi.fn(),
      set: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      onSnapshot: vi.fn(),
    };
    const mockCollection = {
      doc: vi.fn().mockReturnValue(mockDocRef),
      where: vi.fn(),
      get: vi.fn(),
      onSnapshot: vi.fn(),
    };
    const db = {
      collection: vi.fn().mockReturnValue(mockCollection),
      batch: vi.fn(),
    };
    return { db, mockCollection, mockDocRef };
  }

  beforeEach(() => {
    service = Object.create(FirebaseService.prototype);
  });

  it('returns null when db is null', async () => {
    service.db = null;
    const result = await service.getGroupHistory('123');
    expect(result).toBeNull();
  });

  it('returns null when guild doc does not exist', async () => {
    const { db, mockDocRef } = createMockDbWithDocRef();
    service.db = db as unknown as FirebaseService['db'];
    mockDocRef.get.mockResolvedValue({ exists: false, data: () => null });

    const result = await service.getGroupHistory('123');
    expect(result).toBeNull();
    expect(db.collection).toHaveBeenCalledWith('guilds');
  });

  it('returns null when guild doc has no groupHistory field', async () => {
    const { db, mockDocRef } = createMockDbWithDocRef();
    service.db = db as unknown as FirebaseService['db'];
    mockDocRef.get.mockResolvedValue({
      exists: true,
      data: () => ({ guildId: '123' }),
    });

    const result = await service.getGroupHistory('123');
    expect(result).toBeNull();
  });

  it('returns groupHistory from guild doc', async () => {
    const tank = WoWPlayer.create('Tank1', ['Tank']);
    const group = new WoWGroup(tank, null, []);
    const rounds: WoWGroupDict[][] = [[group.toDict()]];

    const { db, mockDocRef } = createMockDbWithDocRef();
    service.db = db as unknown as FirebaseService['db'];
    mockDocRef.get.mockResolvedValue({
      exists: true,
      data: () => ({ guildId: '123', groupHistory: { date: '2026-04-07', rounds } }),
    });

    const result = await service.getGroupHistory('123');
    expect(result).toEqual({ date: '2026-04-07', rounds });
  });
});

describe('FirebaseService.saveGroupHistory', () => {
  let service: FirebaseService;

  function createMockDbWithDocRef() {
    const mockDocRef = {
      get: vi.fn(),
      set: vi.fn(),
      update: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn(),
      onSnapshot: vi.fn(),
    };
    const mockCollection = {
      doc: vi.fn().mockReturnValue(mockDocRef),
      where: vi.fn(),
      get: vi.fn(),
      onSnapshot: vi.fn(),
    };
    const db = {
      collection: vi.fn().mockReturnValue(mockCollection),
      batch: vi.fn(),
    };
    return { db, mockCollection, mockDocRef };
  }

  beforeEach(() => {
    service = Object.create(FirebaseService.prototype);
  });

  it('does nothing when db is null', async () => {
    service.db = null;
    await service.saveGroupHistory('123', { date: '2026-04-07', rounds: [] });
  });

  it('upserts guild doc with groupHistory using set with merge', async () => {
    const tank = WoWPlayer.create('Tank1', ['Tank']);
    const group = new WoWGroup(tank, null, []);
    const rounds: WoWGroupDict[][] = [[group.toDict()]];
    const history = { date: '2026-04-07', rounds };

    const { db, mockDocRef } = createMockDbWithDocRef();
    mockDocRef.set.mockResolvedValue(undefined);
    service.db = db as unknown as FirebaseService['db'];

    await service.saveGroupHistory('456', history);

    expect(db.collection).toHaveBeenCalledWith('guilds');
    // Wire format wraps each round as { groups: [...] } to avoid Firestore's
    // nested-array restriction.
    expect(mockDocRef.set).toHaveBeenCalledWith(
      {
        groupHistory: {
          date: history.date,
          rounds: history.rounds.map((round) => ({ groups: round })),
        },
      },
      { merge: true },
    );
  });

  it('reads wire-format groupHistory (rounds wrapped as { groups: [...] })', async () => {
    const tank = WoWPlayer.create('Tank1', ['Tank']);
    const group = new WoWGroup(tank, null, []);
    const groupDict = group.toDict();

    const { db, mockDocRef } = createMockDbWithDocRef();
    service.db = db as unknown as FirebaseService['db'];
    mockDocRef.get.mockResolvedValue({
      exists: true,
      data: () => ({
        guildId: '123',
        groupHistory: {
          date: '2026-04-07',
          rounds: [{ groups: [groupDict] }],
        },
      }),
    });

    const result = await service.getGroupHistory('123');
    expect(result).toEqual({ date: '2026-04-07', rounds: [[groupDict]] });
  });
});

describe('FirebaseService.getSeasonConfig', () => {
  let service: FirebaseService;

  function createMockDbWithDocRef() {
    const mockDocRef = {
      get: vi.fn(),
      set: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      onSnapshot: vi.fn(),
    };
    const mockCollection = {
      doc: vi.fn().mockReturnValue(mockDocRef),
      where: vi.fn(),
      get: vi.fn(),
      onSnapshot: vi.fn(),
    };
    const db = {
      collection: vi.fn().mockReturnValue(mockCollection),
      batch: vi.fn(),
    };
    return { db, mockCollection, mockDocRef };
  }

  beforeEach(() => {
    service = Object.create(FirebaseService.prototype);
  });

  it('returns null when db is null', async () => {
    service.db = null;
    const result = await service.getSeasonConfig();
    expect(result).toBeNull();
  });

  it('returns null when config/season does not exist', async () => {
    const { db, mockDocRef } = createMockDbWithDocRef();
    service.db = db as unknown as FirebaseService['db'];
    mockDocRef.get.mockResolvedValue({ exists: false, data: () => null });

    const result = await service.getSeasonConfig();
    expect(result).toBeNull();
    expect(db.collection).toHaveBeenCalledWith('config');
    expect(db.collection('config').doc).toHaveBeenCalledWith('season');
  });

  it('returns slug, blizzardSeasonId, and expansionId', async () => {
    const { db, mockDocRef } = createMockDbWithDocRef();
    service.db = db as unknown as FirebaseService['db'];
    mockDocRef.get.mockResolvedValue({
      exists: true,
      data: () => ({
        slug: 'season-mn-1',
        blizzardSeasonId: 17,
        expansionId: 11,
      }),
    });

    const result = await service.getSeasonConfig();
    expect(result).toEqual({
      slug: 'season-mn-1',
      blizzardSeasonId: 17,
      expansionId: 11,
    });
  });

  it('returns null when fields are missing or wrong type', async () => {
    const { db, mockDocRef } = createMockDbWithDocRef();
    service.db = db as unknown as FirebaseService['db'];
    mockDocRef.get.mockResolvedValue({
      exists: true,
      data: () => ({ slug: 'season-mn-1' }),
    });

    const result = await service.getSeasonConfig();
    expect(result).toBeNull();
  });
});

describe('FirebaseService.getSeasonPairs', () => {
  let service: FirebaseService;

  function createMockDbWithDocRef() {
    const mockDocRef = {
      get: vi.fn(),
      set: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      onSnapshot: vi.fn(),
    };
    const mockCollection = {
      doc: vi.fn().mockReturnValue(mockDocRef),
      where: vi.fn(),
      get: vi.fn(),
      onSnapshot: vi.fn(),
    };
    const db = {
      collection: vi.fn().mockReturnValue(mockCollection),
      batch: vi.fn(),
    };
    return { db, mockCollection, mockDocRef };
  }

  beforeEach(() => {
    service = Object.create(FirebaseService.prototype);
  });

  it('returns null when db is null', async () => {
    service.db = null;
    const result = await service.getSeasonPairs('123');
    expect(result).toBeNull();
  });

  it('returns null when guild doc does not exist', async () => {
    const { db, mockDocRef } = createMockDbWithDocRef();
    service.db = db as unknown as FirebaseService['db'];
    mockDocRef.get.mockResolvedValue({ exists: false, data: () => null });

    const result = await service.getSeasonPairs('123');
    expect(result).toBeNull();
    expect(db.collection).toHaveBeenCalledWith('guilds');
    expect(db.collection('guilds').doc).toHaveBeenCalledWith('123');
  });

  it('returns null when guild has no seasonPairs field', async () => {
    const { db, mockDocRef } = createMockDbWithDocRef();
    service.db = db as unknown as FirebaseService['db'];
    mockDocRef.get.mockResolvedValue({
      exists: true,
      data: () => ({ guildId: '123' }),
    });

    const result = await service.getSeasonPairs('123');
    expect(result).toBeNull();
  });

  it('returns seasonSlug and counts', async () => {
    const { db, mockDocRef } = createMockDbWithDocRef();
    service.db = db as unknown as FirebaseService['db'];
    mockDocRef.get.mockResolvedValue({
      exists: true,
      data: () => ({
        seasonPairs: {
          seasonSlug: 'season-mn-1',
          counts: { 'Alice|Bob': 3 },
        },
      }),
    });

    const result = await service.getSeasonPairs('123');
    expect(result).toEqual({
      seasonSlug: 'season-mn-1',
      counts: { 'Alice|Bob': 3 },
    });
  });
});

describe('FirebaseService.bumpSeasonPairs', () => {
  let service: FirebaseService;

  function createMockDbWithDocRef() {
    const mockDocRef = {
      get: vi.fn(),
      set: vi.fn().mockResolvedValue(undefined),
      update: vi.fn(),
      delete: vi.fn(),
      onSnapshot: vi.fn(),
    };
    const mockCollection = {
      doc: vi.fn().mockReturnValue(mockDocRef),
      where: vi.fn(),
      get: vi.fn(),
      onSnapshot: vi.fn(),
    };
    const db = {
      collection: vi.fn().mockReturnValue(mockCollection),
      batch: vi.fn(),
    };
    return { db, mockCollection, mockDocRef };
  }

  function pairGroup(): WoWGroup {
    return new WoWGroup(WoWPlayer.create('Alice', ['Tank']), WoWPlayer.create('Bob', ['Healer']), []);
  }

  beforeEach(() => {
    service = Object.create(FirebaseService.prototype);
  });

  it('does nothing when db is null', async () => {
    service.db = null;
    await service.bumpSeasonPairs('123', 'season-mn-1', [pairGroup()]);
  });

  it('increments each pair in place for the stored season', async () => {
    const { db, mockDocRef } = createMockDbWithDocRef();
    service.db = db as unknown as FirebaseService['db'];
    mockDocRef.get.mockResolvedValue({
      exists: true,
      data: () => ({ seasonPairs: { seasonSlug: 'season-mn-1', counts: { 'Alice|Bob': 3 } } }),
    });

    await service.bumpSeasonPairs('123', 'season-mn-1', [pairGroup()]);

    expect(db.collection).toHaveBeenCalledWith('guilds');
    expect(db.collection('guilds').doc).toHaveBeenCalledWith('123');
    expect(mockDocRef.set).toHaveBeenCalledWith(
      { seasonPairs: { seasonSlug: 'season-mn-1', counts: { 'Alice|Bob': FieldValue.increment(1) } } },
      { merge: true },
    );
  });

  it('replaces the counts when the season changes', async () => {
    const { db, mockDocRef } = createMockDbWithDocRef();
    service.db = db as unknown as FirebaseService['db'];
    mockDocRef.get.mockResolvedValue({
      exists: true,
      data: () => ({ seasonPairs: { seasonSlug: 'season-mn-1', counts: { 'Old|Pair': 99 } } }),
    });

    await service.bumpSeasonPairs('123', 'season-mn-2', [pairGroup()]);

    expect(mockDocRef.set).toHaveBeenCalledWith(
      { seasonPairs: { seasonSlug: 'season-mn-2', counts: { 'Alice|Bob': 1 } } },
      { mergeFields: ['seasonPairs'] },
    );
  });
});
