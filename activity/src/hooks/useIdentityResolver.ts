import { useEffect, useMemo, useRef } from 'react';
import { useIdentity } from './useIdentity';
import { WoWPlayer } from '../types';

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

  const { resolveIdentity } = identity;
  useEffect(() => {
    if (playersRef.current.length > 0) {
      resolveIdentity(playersRef.current).catch(console.error);
    }
  }, [membershipKey, resolveIdentity]);

  return identity;
}
