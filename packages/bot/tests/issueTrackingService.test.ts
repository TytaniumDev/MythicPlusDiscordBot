import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSet = vi.fn().mockResolvedValue(undefined);
const mockDelete = vi.fn().mockResolvedValue(undefined);
const mockGet = vi.fn();
const mockDoc = vi.fn().mockReturnValue({ set: mockSet, delete: mockDelete, get: mockGet });
const mockCollection = vi.fn().mockReturnValue({ doc: mockDoc });

vi.mock('../src/core/firebaseService.js', () => ({
  FirebaseService: {
    getInstance: () => ({
      db: { collection: mockCollection },
      isAvailable: () => true,
    }),
  },
  SERVER_TIMESTAMP: 'SERVER_TIMESTAMP',
}));

import { IssueTrackingService } from '../src/services/issueTrackingService.js';

describe('IssueTrackingService', () => {
  let service: IssueTrackingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new IssueTrackingService();
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
  });

  describe('deleteTracking', () => {
    it('deletes the document from the issueTracking collection', async () => {
      await service.deleteTracking(42);

      expect(mockCollection).toHaveBeenCalledWith('issueTracking');
      expect(mockDoc).toHaveBeenCalledWith('42');
      expect(mockDelete).toHaveBeenCalled();
    });
  });
});
