import { describe, expect, it, vi, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({ callable: vi.fn(), reportError: vi.fn() }));
vi.mock('../firebase', () => ({ authReady: Promise.resolve(), functions: { name: 'test-functions' } }));
vi.mock('firebase/functions', () => ({ httpsCallable: () => mocks.callable }));
vi.mock('../lib/sentry', () => ({ reportError: mocks.reportError }));

import { lookupCharacter } from './characterLookup';

/** An error shaped like the ones the Firebase callable SDK throws. */
function callableError(code: string): Error {
  return Object.assign(new Error(code), { code });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('lookupCharacter', () => {
  it('returns the character the function found', async () => {
    const character = {
      name: 'Tytanium',
      realm: 'Stormrage',
      class: 'Warrior',
      role: 'tank',
      utilities: [],
      mediaUrl: 'https://render.worldofwarcraft.com/us/character/stormrage/1/2-avatar.jpg',
    };
    mocks.callable.mockResolvedValue({ data: character });

    expect(await lookupCharacter('Tytanium', 'stormrage', 'us')).toEqual({ status: 'found', character });
  });

  it('passes forceRefresh through to the function', async () => {
    mocks.callable.mockResolvedValue({ data: {} });

    await lookupCharacter('Tytanium', 'stormrage', 'us', { forceRefresh: true });

    expect(mocks.callable).toHaveBeenCalledWith({ name: 'Tytanium', realm: 'stormrage', region: 'us', forceRefresh: true });
  });

  it.each(['functions/not-found', 'functions/invalid-argument'])(
    'reports %s as not found, without telling Sentry',
    async (code) => {
      mocks.callable.mockRejectedValue(callableError(code));

      expect(await lookupCharacter('Tytanium', 'stormrage', 'us')).toEqual({ status: 'notFound' });
      expect(mocks.reportError).not.toHaveBeenCalled();
    },
  );

  it.each(['functions/unavailable', 'functions/resource-exhausted', 'functions/internal'])(
    'reports %s as a failed lookup, not a missing character',
    async (code) => {
      mocks.callable.mockRejectedValue(callableError(code));

      expect(await lookupCharacter('Tytanium', 'stormrage', 'us')).toEqual({ status: 'failed' });
      expect(mocks.reportError).toHaveBeenCalledOnce();
    },
  );
});
