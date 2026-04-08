import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FirebaseService } from '../src/core/firebaseService.js';

describe('Issue Subscription Logic', () => {
  let service: FirebaseService;

  function createMockDb() {
    const mockDocRef = {
      get: vi.fn(),
      set: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
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

  describe('subscribeToIssue', () => {
    it('creates a new subscription if none exists', async () => {
      const { db, mockDocRef } = createMockDb();
      service.db = db as unknown as FirebaseService['db'];
      mockDocRef.get.mockResolvedValue({ exists: false });

      await service.subscribeToIssue(123, 'user_1');

      expect(db.collection).toHaveBeenCalledWith('issueSubscriptions');
      expect(db.collection('issueSubscriptions').doc).toHaveBeenCalledWith('123');
      expect(mockDocRef.set).toHaveBeenCalledWith(expect.objectContaining({
        issueNumber: 123,
        userIds: ['user_1'],
      }));
    });

    it('updates an existing subscription', async () => {
      const { db, mockDocRef } = createMockDb();
      service.db = db as unknown as FirebaseService['db'];
      mockDocRef.get.mockResolvedValue({ exists: true });

      await service.subscribeToIssue(123, 'user_2');

      expect(mockDocRef.update).toHaveBeenCalledWith(expect.objectContaining({
        userIds: expect.anything(), // ARRAY_UNION is mocked as identity or similar
      }));
    });
  });

  describe('unsubscribeFromIssue', () => {
    it('removes a user from subscription', async () => {
      const { db, mockDocRef } = createMockDb();
      service.db = db as unknown as FirebaseService['db'];

      await service.unsubscribeFromIssue(123, 'user_1');

      expect(db.collection).toHaveBeenCalledWith('issueSubscriptions');
      expect(db.collection('issueSubscriptions').doc).toHaveBeenCalledWith('123');
      expect(mockDocRef.update).toHaveBeenCalledWith(expect.objectContaining({
        userIds: expect.anything(),
      }));
    });
  });
});
