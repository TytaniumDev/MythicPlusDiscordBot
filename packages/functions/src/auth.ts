import type { CallableRequest } from 'firebase-functions/v2/https';

/**
 * The caller's Discord ID when they signed in with Discord (`discordSignIn`
 * mints a custom token whose uid is their Discord ID); null for anonymous
 * callers.
 */
export function discordIdFromAuth(auth: CallableRequest['auth']): string | null {
  if (!auth || auth.token.firebase?.sign_in_provider !== 'custom') return null;
  return /^[0-9]+$/.test(auth.uid) ? auth.uid : null;
}
