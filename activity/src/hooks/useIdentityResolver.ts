import { useEffect, useMemo, useRef } from 'react';
import { useIdentity } from './useIdentity';
import { useAppStore } from '../store/store';
import { WoWPlayer } from '../types';
import { reportError } from '../lib/sentry';

/**
 * Automatically resolves the current user's identity when players change.
 * Call this hook in any view that needs identity-based highlighting.
 */
export function useIdentityResolver(players: WoWPlayer[]) {
  const identity = useIdentity();

  // Firestore snapshots produce a new `players` array ref on every update
  // (including keystrokes). Reduce to a membership signature so we only
  // re-resolve when the set of discordIds actually changes.
  const membershipKey = useMemo(
    () =>
      players
        .map((p) => p.discordId ?? `\0${p.name}`)
        .sort()
        .join(','),
    [players],
  );

  const playersRef = useRef(players);
  playersRef.current = players;

  // Also re-resolve when the user signs in with Discord mid-session.
  const verifiedDiscordId = useAppStore((s) => s.verifiedDiscordId);

  const { resolveIdentity } = identity;
  useEffect(() => {
    if (playersRef.current.length > 0) {
      resolveIdentity(playersRef.current).catch((err) => {
        reportError(err, { tag: 'useIdentityResolver.resolveIdentity' });
      });
    }
  }, [membershipKey, verifiedDiscordId, resolveIdentity]);

  return identity;
}
