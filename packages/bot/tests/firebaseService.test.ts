import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WoWPlayer, WoWGroup, type WoWGroupDict } from '@mythicplus/shared';
import { FirebaseService } from '../src/core/firebaseService.js';

// Helper to create mock docs
function createMockDoc(id: string) {
  return {
    id,
    ref: { delete: vi.fn() },
  };
}


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

describe('FirebaseService.deleteOldDocs', () => {
  let service: FirebaseService;
  let mockDb: ReturnType<typeof createMockDb>;

  function createMockDb() {
    const mockBatch = {
      delete: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    };
    const mockQuery = {
      get: vi.fn().mockResolvedValue({ docs: [] }),
    };
    const mockCollection = {
      where: vi.fn().mockReturnValue(mockQuery),
      get: vi.fn().mockResolvedValue({ docs: [] }),
      doc: vi.fn(),
    };
    const db = {
      collection: vi.fn().mockReturnValue(mockCollection),
      batch: vi.fn().mockReturnValue(mockBatch),
    };
    return { db, mockCollection, mockQuery, mockBatch };
  }

  beforeEach(() => {
    service = Object.create(FirebaseService.prototype);
    mockDb = createMockDb();
    // Bypass constructor by directly setting db
    service.db = mockDb.db as unknown as FirebaseService['db'];
  });

  it('handles no matching docs', async () => {
    mockDb.mockQuery.get.mockResolvedValue({ docs: [] });
    const deleted = await service.deleteOldDocs('channels', 3600);
    expect(deleted).toBe(0);
  });

  it('deletes single batch (< 500 docs)', async () => {
    const numDocs = 10;
    const docs = Array.from({ length: numDocs }, (_, i) => createMockDoc(`doc_${i}`));
    mockDb.mockQuery.get.mockResolvedValue({ docs });

    const deleted = await service.deleteOldDocs('guilds', 3600);
    expect(deleted).toBe(numDocs);
    expect(mockDb.mockBatch.delete).toHaveBeenCalledTimes(numDocs);
    expect(mockDb.mockBatch.commit).toHaveBeenCalled();
  });

  it('handles multi-batch (> 500 docs)', async () => {
    const numDocs = 550;
    const docs = Array.from({ length: numDocs }, (_, i) => createMockDoc(`doc_${i}`));
    mockDb.mockQuery.get.mockResolvedValue({ docs });

    const batch1 = { delete: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) };
    const batch2 = { delete: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) };
    mockDb.db.batch.mockReturnValueOnce(batch1).mockReturnValueOnce(batch2);

    const deleted = await service.deleteOldDocs('channels', 3600);
    expect(deleted).toBe(numDocs);
    expect(mockDb.db.batch).toHaveBeenCalledTimes(2);
    expect(batch1.delete).toHaveBeenCalledTimes(500);
    expect(batch1.commit).toHaveBeenCalledTimes(1);
    expect(batch2.delete).toHaveBeenCalledTimes(50);
    expect(batch2.commit).toHaveBeenCalledTimes(1);
  });

  it('handles exact batch boundary (500 docs)', async () => {
    const numDocs = 500;
    const docs = Array.from({ length: numDocs }, (_, i) => createMockDoc(`doc_${i}`));
    mockDb.mockQuery.get.mockResolvedValue({ docs });

    const batch1 = { delete: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) };
    mockDb.db.batch
      .mockReturnValueOnce(batch1)
      .mockReturnValueOnce({ delete: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) });

    const deleted = await service.deleteOldDocs('guilds', 3600);
    expect(deleted).toBe(numDocs);
    expect(batch1.delete).toHaveBeenCalledTimes(500);
    expect(batch1.commit).toHaveBeenCalled();
  });

  it('works for both collection names', async () => {
    mockDb.mockQuery.get.mockResolvedValue({ docs: [] });
    await service.deleteOldDocs('guilds', 3600);
    expect(mockDb.db.collection).toHaveBeenCalledWith('guilds');

    await service.deleteOldDocs('channels', 3600);
    expect(mockDb.db.collection).toHaveBeenCalledWith('channels');
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

describe('FirebaseService.deleteAllInCollection', () => {
  let service: FirebaseService;

  function createMockDb() {
    const mockBatch = {
      delete: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    };
    const mockCollection = {
      get: vi.fn().mockResolvedValue({ docs: [] }),
      doc: vi.fn(),
      where: vi.fn(),
    };
    return {
      db: {
        collection: vi.fn().mockReturnValue(mockCollection),
        batch: vi.fn().mockReturnValue(mockBatch),
      },
      mockCollection,
      mockBatch,
    };
  }

  it('handles empty collection', async () => {
    service = Object.create(FirebaseService.prototype);
    const mockDb = createMockDb();
    service.db = mockDb.db as unknown as FirebaseService['db'];
    mockDb.mockCollection.get.mockResolvedValue({ docs: [] });

    const deleted = await service.deleteAllInCollection('sessions');
    expect(deleted).toBe(0);
  });

  it('deletes all docs', async () => {
    service = Object.create(FirebaseService.prototype);
    const mockDb = createMockDb();
    service.db = mockDb.db as unknown as FirebaseService['db'];

    const docs = Array.from({ length: 3 }, () => ({
      ref: { delete: vi.fn() },
    }));
    mockDb.mockCollection.get.mockResolvedValue({ docs });

    const deleted = await service.deleteAllInCollection('sessions');
    expect(deleted).toBe(3);
    expect(mockDb.mockBatch.delete).toHaveBeenCalledTimes(3);
    expect(mockDb.mockBatch.commit).toHaveBeenCalled();
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
