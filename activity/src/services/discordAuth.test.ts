import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  authorizeWithDiscord: vi.fn(),
  exchange: vi.fn(),
  httpsCallable: vi.fn(),
  signInWithCustomToken: vi.fn(),
  onAuthStateChanged: vi.fn(),
}));

vi.mock('../firebase', () => ({
  auth: { name: 'test-auth' },
  authReady: Promise.resolve(),
  functions: { name: 'test-functions' },
}));
vi.mock('../discordSdk', () => ({ authorizeWithDiscord: mocks.authorizeWithDiscord }));
vi.mock('firebase/functions', () => ({ httpsCallable: mocks.httpsCallable }));
vi.mock('firebase/auth', () => ({
  signInWithCustomToken: mocks.signInWithCustomToken,
  onAuthStateChanged: mocks.onAuthStateChanged,
}));

import { discordIdFromUser, signInWithDiscord, watchDiscordSignIn } from './discordAuth';
import { useAppStore } from '../store/store';

beforeEach(() => {
  mocks.httpsCallable.mockReturnValue(mocks.exchange);
});

afterEach(() => {
  vi.clearAllMocks();
  useAppStore.setState({ verifiedDiscordId: null });
});

describe('discordIdFromUser', () => {
  it('returns the uid of a user signed in with Discord', () => {
    expect(discordIdFromUser({ isAnonymous: false, uid: '123456789012345678' })).toBe('123456789012345678');
  });

  it('returns null for anonymous users and no user', () => {
    expect(discordIdFromUser({ isAnonymous: true, uid: 'abc123' })).toBeNull();
    expect(discordIdFromUser(null)).toBeNull();
  });

  it('returns null for a non-numeric uid', () => {
    expect(discordIdFromUser({ isAnonymous: false, uid: 'not-a-snowflake' })).toBeNull();
  });
});

describe('signInWithDiscord', () => {
  it('trades the Discord code for a custom token and signs in with it', async () => {
    mocks.authorizeWithDiscord.mockResolvedValue('oauth-code');
    mocks.exchange.mockResolvedValue({ data: { customToken: 'custom-token' } });
    mocks.signInWithCustomToken.mockResolvedValue({ user: { uid: '123456789012345678' } });

    await expect(signInWithDiscord()).resolves.toBe('123456789012345678');

    expect(mocks.httpsCallable).toHaveBeenCalledWith({ name: 'test-functions' }, 'discordSignIn');
    expect(mocks.exchange).toHaveBeenCalledWith({ code: 'oauth-code' });
    expect(mocks.signInWithCustomToken).toHaveBeenCalledWith({ name: 'test-auth' }, 'custom-token');
  });

  it('stops when the user closes the Discord consent modal', async () => {
    mocks.authorizeWithDiscord.mockRejectedValue(new Error('closed'));

    await expect(signInWithDiscord()).rejects.toThrow('closed');
    expect(mocks.exchange).not.toHaveBeenCalled();
    expect(mocks.signInWithCustomToken).not.toHaveBeenCalled();
  });
});

describe('watchDiscordSignIn', () => {
  it('mirrors the Firebase Auth user into verifiedDiscordId', () => {
    watchDiscordSignIn();
    const listener = mocks.onAuthStateChanged.mock.calls[0][1] as (user: unknown) => void;

    listener({ isAnonymous: false, uid: '123456789012345678' });
    expect(useAppStore.getState().verifiedDiscordId).toBe('123456789012345678');

    listener({ isAnonymous: true, uid: 'anon' });
    expect(useAppStore.getState().verifiedDiscordId).toBeNull();
  });
});
