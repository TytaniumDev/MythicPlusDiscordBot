import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { onReady } from '../../src/events/ready.js';
import { FirebaseService } from '../../src/core/firebaseService.js';
import logger from '../../src/core/logger.js';

vi.mock('../../src/core/firebaseService.js', () => {
  return {
    FirebaseService: {
      getInstance: vi.fn(),
    },
  };
});

vi.mock('../../src/core/logger.js', () => {
  return {
    default: {
      info: vi.fn(),
      error: vi.fn(),
    },
  };
});

describe('onReady', () => {
  let mockIsAvailable: Mock;
  let mockDeleteOldDocs: Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    mockIsAvailable = vi.fn().mockReturnValue(true);
    mockDeleteOldDocs = vi.fn().mockResolvedValue(undefined);

    vi.mocked(FirebaseService.getInstance).mockReturnValue({
      isAvailable: mockIsAvailable,
      deleteOldDocs: mockDeleteOldDocs,
    } as unknown as FirebaseService);
  });

  it('cleans up old lobby docs when firebase is available', async () => {
    await onReady();

    expect(FirebaseService.getInstance).toHaveBeenCalled();
    expect(mockIsAvailable).toHaveBeenCalled();

    // Only abandoned lobbies are swept; guild docs hold durable history.
    const maxAge = 24 * 60 * 60;
    expect(mockDeleteOldDocs).toHaveBeenCalledWith('channels', maxAge);
    expect(mockDeleteOldDocs).toHaveBeenCalledTimes(1);

    expect(logger.info).toHaveBeenCalledWith('Bot ready — old lobby docs cleaned up.');
  });

  it('skips cleanup when firebase is not available', async () => {
    mockIsAvailable.mockReturnValue(false);

    await onReady();

    expect(FirebaseService.getInstance).toHaveBeenCalled();
    expect(mockIsAvailable).toHaveBeenCalled();

    expect(mockDeleteOldDocs).not.toHaveBeenCalled();

    expect(logger.info).toHaveBeenCalledWith('Bot ready — old lobby docs cleaned up.');
  });
});
