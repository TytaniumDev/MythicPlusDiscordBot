import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { onReady } from '../../src/events/ready.js';
import { FirebaseService } from '../../src/core/firebaseService.js';
import { getPreferenceService } from '../../src/core/preferenceService.js';
import logger from '../../src/core/logger.js';

vi.mock('../../src/core/preferenceService.js', () => {
  return {
    getPreferenceService: vi.fn(),
  };
});

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
  let mockLoadCache: Mock;
  let mockIsAvailable: Mock;
  let mockDeleteOldDocs: Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    mockLoadCache = vi.fn().mockResolvedValue(undefined);
    vi.mocked(getPreferenceService).mockReturnValue({
      loadCache: mockLoadCache,
    } as unknown as ReturnType<typeof getPreferenceService>);

    mockIsAvailable = vi.fn().mockReturnValue(true);
    mockDeleteOldDocs = vi.fn().mockResolvedValue(undefined);

    vi.mocked(FirebaseService.getInstance).mockReturnValue({
      isAvailable: mockIsAvailable,
      deleteOldDocs: mockDeleteOldDocs,
    } as unknown as FirebaseService);
  });

  it('loads preference cache and cleans up old docs when firebase is available', async () => {
    await onReady();

    expect(getPreferenceService).toHaveBeenCalled();
    expect(mockLoadCache).toHaveBeenCalled();

    expect(FirebaseService.getInstance).toHaveBeenCalled();
    expect(mockIsAvailable).toHaveBeenCalled();

    const maxAge = 24 * 60 * 60;
    expect(mockDeleteOldDocs).toHaveBeenCalledWith('guilds', maxAge);
    expect(mockDeleteOldDocs).toHaveBeenCalledWith('channels', maxAge);
    expect(mockDeleteOldDocs).toHaveBeenCalledTimes(2);

    expect(logger.info).toHaveBeenCalledWith('Bot ready — preference cache loaded and old docs cleaned up.');
  });

  it('loads preference cache but skips cleanup when firebase is not available', async () => {
    mockIsAvailable.mockReturnValue(false);

    await onReady();

    expect(getPreferenceService).toHaveBeenCalled();
    expect(mockLoadCache).toHaveBeenCalled();

    expect(FirebaseService.getInstance).toHaveBeenCalled();
    expect(mockIsAvailable).toHaveBeenCalled();

    expect(mockDeleteOldDocs).not.toHaveBeenCalled();

    expect(logger.info).toHaveBeenCalledWith('Bot ready — preference cache loaded and old docs cleaned up.');
  });
});
