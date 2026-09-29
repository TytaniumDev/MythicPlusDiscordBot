import { useCallback, useState } from 'react';
import { useAppStore } from '../store/store';
import { signInWithDiscord } from '../services/discordAuth';
import { reportError } from '../lib/sentry';
import { useIdentity } from './useIdentity';

/**
 * State and action for the opt-in "Sign in with Discord" button. `signIn`
 * resolves true when the signed-in player is in the current lobby: they are
 * then selected as the current player, replacing any earlier pick.
 */
export function useDiscordSignIn() {
  const available = useAppStore((s) => s.discordSignInAvailable);
  const verifiedDiscordId = useAppStore((s) => s.verifiedDiscordId);
  const { selectPlayer } = useIdentity();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const signIn = useCallback(async (): Promise<boolean> => {
    setPending(true);
    setFailed(false);
    try {
      const discordId = await signInWithDiscord();
      const me = useAppStore.getState().players.find((p) => p.discordId === discordId);
      if (!me) return false;
      selectPlayer(me);
      return true;
    } catch (err) {
      reportError(err, { tag: 'useDiscordSignIn.signIn' });
      setFailed(true);
      return false;
    } finally {
      setPending(false);
    }
  }, [selectPlayer]);

  return { available, verifiedDiscordId, pending, failed, signIn };
}
