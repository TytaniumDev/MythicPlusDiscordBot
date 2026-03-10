import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FirebaseService } from '../src/core/firebaseService.js';

// Helper to create mock docs
function createMockDoc(id: string) {
  return {
    id,
    ref: { delete: vi.fn() },
  };
}

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
