import { describe, it, expect } from 'vitest';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { discordIdFromAuth } from '../src/auth';

function auth(uid: string, provider: string): CallableRequest['auth'] {
  return { uid, token: { firebase: { sign_in_provider: provider } } } as unknown as CallableRequest['auth'];
}

describe('discordIdFromAuth', () => {
  it('returns the uid of a Discord sign-in', () => {
    expect(discordIdFromAuth(auth('123456789012345678', 'custom'))).toBe('123456789012345678');
  });

  it('returns null for anonymous callers, even with a numeric uid', () => {
    expect(discordIdFromAuth(auth('123456789012345678', 'anonymous'))).toBeNull();
  });

  it('returns null for a non-numeric custom uid or no auth', () => {
    expect(discordIdFromAuth(auth('not-a-snowflake', 'custom'))).toBeNull();
    expect(discordIdFromAuth(undefined)).toBeNull();
  });
});
