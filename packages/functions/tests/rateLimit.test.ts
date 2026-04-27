import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// FieldValue.increment is a sentinel; we just need to identify it in assertions.
const incrementSentinel = { __op: 'increment', amount: 1 };

const mockGet = vi.fn();
const mockSet = vi.fn();
const mockUpdate = vi.fn();
const mockDoc = vi.fn();
const mockRunTransaction = vi.fn();

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    doc: mockDoc,
    runTransaction: mockRunTransaction,
  }),
  FieldValue: {
    increment: (n: number) => ({ __op: 'increment', amount: n }),
  },
}));

// Import after mock so the module under test sees the mocked module.
import { enforceRateLimit } from '../src/rateLimit';

const FIXED_NOW = 1_700_000_000_000;

function setupTransaction(docData: { count: number; resetAt: number } | undefined) {
  mockGet.mockResolvedValue({
    exists: docData !== undefined,
    data: () => docData,
  });
  mockRunTransaction.mockImplementation(async (cb: (t: unknown) => Promise<void>) => {
    await cb({ get: mockGet, set: mockSet, update: mockUpdate });
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
  mockGet.mockReset();
  mockSet.mockReset();
  mockUpdate.mockReset();
  mockDoc.mockReset();
  mockRunTransaction.mockReset();
  mockDoc.mockImplementation((path: string) => ({ __ref: path }));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('enforceRateLimit', () => {
  it('initializes the rate-limit doc when it does not exist', async () => {
    setupTransaction(undefined);

    await expect(enforceRateLimit('user-1', 'lookupCharacter')).resolves.toBeUndefined();

    expect(mockDoc).toHaveBeenCalledWith('rateLimits/user-1_lookupCharacter');
    expect(mockSet).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledWith(
      { __ref: 'rateLimits/user-1_lookupCharacter' },
      { count: 1, resetAt: FIXED_NOW + 60000 },
    );
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('resets the window when the previous resetAt is in the past', async () => {
    setupTransaction({ count: 25, resetAt: FIXED_NOW - 1 });

    await expect(enforceRateLimit('user-2', 'lookupCharacter')).resolves.toBeUndefined();

    expect(mockSet).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledWith(
      { __ref: 'rateLimits/user-2_lookupCharacter' },
      { count: 1, resetAt: FIXED_NOW + 60000 },
    );
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('throws an HttpsError with code "resource-exhausted" when the limit is met', async () => {
    setupTransaction({ count: 30, resetAt: FIXED_NOW + 1000 });

    await expect(enforceRateLimit('user-3', 'lookupCharacter')).rejects.toMatchObject({
      code: 'resource-exhausted',
    });

    expect(mockSet).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('increments the counter when within the window and below the limit', async () => {
    setupTransaction({ count: 5, resetAt: FIXED_NOW + 30000 });

    await expect(enforceRateLimit('user-4', 'refreshCharacterMediaNow')).resolves.toBeUndefined();

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith(
      { __ref: 'rateLimits/user-4_refreshCharacterMediaNow' },
      { count: incrementSentinel },
    );
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('respects custom maxRequests/windowMs across multiple calls', async () => {
    // First call: doc absent → t.set with count: 1, resetAt: now + customWindowMs.
    setupTransaction(undefined);
    await enforceRateLimit('user-5', 'lookupCharacter', 2, 60000);
    expect(mockSet).toHaveBeenLastCalledWith(
      { __ref: 'rateLimits/user-5_lookupCharacter' },
      { count: 1, resetAt: FIXED_NOW + 60000 },
    );

    // Second call: under limit → increment.
    setupTransaction({ count: 1, resetAt: FIXED_NOW + 60000 });
    await enforceRateLimit('user-5', 'lookupCharacter', 2, 60000);
    expect(mockUpdate).toHaveBeenLastCalledWith(
      { __ref: 'rateLimits/user-5_lookupCharacter' },
      { count: incrementSentinel },
    );

    // Third call: count === maxRequests → throws.
    setupTransaction({ count: 2, resetAt: FIXED_NOW + 60000 });
    await expect(enforceRateLimit('user-5', 'lookupCharacter', 2, 60000)).rejects.toMatchObject({
      code: 'resource-exhausted',
    });
  });
});
