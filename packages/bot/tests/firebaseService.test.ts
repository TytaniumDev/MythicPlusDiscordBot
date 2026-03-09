import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FirebaseService } from '../src/core/firebaseService.js';

// Helper to create mock docs
function createMockDoc(id: string) {
  return {
    id,
    reference: { delete: vi.fn() },
  };
}

describe('FirebaseService.deleteOldDocs', () => {
  let service: FirebaseService;
  let mockDb: ReturnType<typeof createMockDb>;

  function createMockDb() {
    const mockBatch = {
      delete: vi.fn(),
      commit: vi.fn(),
    };
    const mockQuery = {
      stream: vi.fn().mockReturnValue([]),
    };
    const mockCollection = {
      where: vi.fn().mockReturnValue(mockQuery),
      stream: vi.fn().mockReturnValue([]),
      document: vi.fn(),
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
    mockDb.mockQuery.stream.mockReturnValue([]);
    const deleted = await service.deleteOldDocs('channels', 3600);
    expect(deleted).toBe(0);
  });

  it('deletes single batch (< 500 docs)', async () => {
    const numDocs = 10;
    const docs = Array.from({ length: numDocs }, (_, i) => createMockDoc(`doc_${i}`));
    mockDb.mockQuery.stream.mockReturnValue(docs);

    const deleted = await service.deleteOldDocs('guilds', 3600);
    expect(deleted).toBe(numDocs);
    expect(mockDb.mockBatch.delete).toHaveBeenCalledTimes(numDocs);
    expect(mockDb.mockBatch.commit).toHaveBeenCalled();
  });

  it('handles multi-batch (> 500 docs)', async () => {
    const numDocs = 550;
    const docs = Array.from({ length: numDocs }, (_, i) => createMockDoc(`doc_${i}`));
    mockDb.mockQuery.stream.mockReturnValue(docs);

    const batch1 = { delete: vi.fn(), commit: vi.fn() };
    const batch2 = { delete: vi.fn(), commit: vi.fn() };
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
    mockDb.mockQuery.stream.mockReturnValue(docs);

    const batch1 = { delete: vi.fn(), commit: vi.fn() };
    mockDb.db.batch.mockReturnValueOnce(batch1).mockReturnValueOnce({ delete: vi.fn(), commit: vi.fn() });

    const deleted = await service.deleteOldDocs('guilds', 3600);
    expect(deleted).toBe(numDocs);
    expect(batch1.delete).toHaveBeenCalledTimes(500);
    expect(batch1.commit).toHaveBeenCalled();
  });

  it('works for both collection names', async () => {
    mockDb.mockQuery.stream.mockReturnValue([]);
    await service.deleteOldDocs('guilds', 3600);
    expect(mockDb.db.collection).toHaveBeenCalledWith('guilds');

    await service.deleteOldDocs('channels', 3600);
    expect(mockDb.db.collection).toHaveBeenCalledWith('channels');
  });
});

describe('FirebaseService.deleteAllInCollection', () => {
  let service: FirebaseService;

  function createMockDb() {
    const mockBatch = {
      delete: vi.fn(),
      commit: vi.fn(),
    };
    const mockCollection = {
      stream: vi.fn().mockReturnValue([]),
      document: vi.fn(),
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
    mockDb.mockCollection.stream.mockReturnValue([]);

    const deleted = await service.deleteAllInCollection('sessions');
    expect(deleted).toBe(0);
  });

  it('deletes all docs', async () => {
    service = Object.create(FirebaseService.prototype);
    const mockDb = createMockDb();
    service.db = mockDb.db as unknown as FirebaseService['db'];

    const docs = Array.from({ length: 3 }, () => ({
      reference: { delete: vi.fn() },
    }));
    mockDb.mockCollection.stream.mockReturnValue(docs);

    const deleted = await service.deleteAllInCollection('sessions');
    expect(deleted).toBe(3);
    expect(mockDb.mockBatch.delete).toHaveBeenCalledTimes(3);
    expect(mockDb.mockBatch.commit).toHaveBeenCalled();
  });
});
