import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IssueTrackingService } from '../src/services/issueTrackingService.js';
import type { FirebaseService } from '../src/core/firebaseService.js';

// Re-export so the import in the service file resolves SERVER_TIMESTAMP
vi.mock('../src/core/firebaseService.js', () => ({
  FirebaseService: { getInstance: () => ({}) },
  SERVER_TIMESTAMP: 'SERVER_TIMESTAMP',
}));

describe('IssueTrackingService', () => {
  const mockSet = vi.fn().mockResolvedValue(undefined);
  const mockDelete = vi.fn().mockResolvedValue(undefined);
  const mockDoc = vi.fn().mockReturnValue({ set: mockSet, delete: mockDelete });
  const mockCollection = vi.fn().mockReturnValue({ doc: mockDoc });

  const mockFirebase = {
    db: { collection: mockCollection },
    isAvailable: () => true,
  } as unknown as FirebaseService;

  let service: IssueTrackingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new IssueTrackingService(mockFirebase);
  });

  describe('trackIssue', () => {
    it('writes a document to the issueTracking collection', async () => {
      await service.trackIssue({
        issueNumber: 42,
        discordUserId: '123456789',
        issueUrl: 'https://github.com/owner/repo/issues/42',
        issueTitle: 'Fix the thing',
      });

      expect(mockCollection).toHaveBeenCalledWith('issueTracking');
      expect(mockDoc).toHaveBeenCalledWith('42');
      expect(mockSet).toHaveBeenCalledWith({
        discordUserId: '123456789',
        issueUrl: 'https://github.com/owner/repo/issues/42',
        issueTitle: 'Fix the thing',
        createdAt: 'SERVER_TIMESTAMP',
      });
    });

    it('returns early when Firebase is unavailable', async () => {
      const nullDbService = new IssueTrackingService({ db: null } as unknown as FirebaseService);

      await nullDbService.trackIssue({
        issueNumber: 1,
        discordUserId: '999',
        issueUrl: 'https://example.com',
        issueTitle: 'Test',
      });

      expect(mockSet).not.toHaveBeenCalled();
    });
  });

  describe('deleteTracking', () => {
    it('deletes the document from the issueTracking collection', async () => {
      await service.deleteTracking(42);

      expect(mockCollection).toHaveBeenCalledWith('issueTracking');
      expect(mockDoc).toHaveBeenCalledWith('42');
      expect(mockDelete).toHaveBeenCalled();
    });

    it('returns early when Firebase is unavailable', async () => {
      const nullDbService = new IssueTrackingService({ db: null } as unknown as FirebaseService);

      await nullDbService.deleteTracking(1);

      expect(mockDelete).not.toHaveBeenCalled();
    });
  });
});
