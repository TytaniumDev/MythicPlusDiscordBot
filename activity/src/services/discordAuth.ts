import { onAuthStateChanged, signInWithCustomToken, type User } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, authReady, functions } from '../firebase';
import { authorizeWithDiscord } from '../discordSdk';
import { useAppStore } from '../store/store';

// Optional "Sign in with Discord" inside the Discord activity. Everyone starts
// signed in anonymously (firebase.ts). A player who opts in trades a Discord
// OAuth2 code for a Firebase custom token (the `discordSignIn` Cloud Function)
// whose uid is their Discord ID. Firebase Auth persists that session, so later
// launches restore it without asking again.

/** The Discord ID of a user signed in with Discord; null for anonymous users. */
export function discordIdFromUser(user: Pick<User, 'isAnonymous' | 'uid'> | null): string | null {
  if (!user || user.isAnonymous) return null;
  return /^[0-9]+$/.test(user.uid) ? user.uid : null;
}

/** Keep `verifiedDiscordId` in the store in step with the Firebase Auth user. */
export function watchDiscordSignIn(): () => void {
  if (!auth) return () => {};
  return onAuthStateChanged(auth, (user) => {
    useAppStore.getState().setVerifiedDiscordId(discordIdFromUser(user));
  });
}

/**
 * Run the Discord sign-in flow and resolve with the verified Discord ID.
 * Rejects if the user closes Discord's consent modal or any step fails; the
 * anonymous session is left in place either way.
 */
export async function signInWithDiscord(): Promise<string> {
  if (!auth) throw new Error('Firebase Auth is not available');
  const code = await authorizeWithDiscord();
  const exchange = httpsCallable<{ code: string }, { customToken: string }>(functions, 'discordSignIn');
  // The callable needs request.auth, which the anonymous session provides.
  await authReady;
  const { data } = await exchange({ code });
  const { user } = await signInWithCustomToken(auth, data.customToken);
  return user.uid;
}
