import { useEffect } from 'react';
import { useIdentity } from './useIdentity';
import { WoWPlayer } from '../types';

/**
 * Automatically resolves the current user's identity when players change.
 * Call this hook in any view that needs identity-based highlighting.
 */
export function useIdentityResolver(players: WoWPlayer[]) {
  const identity = useIdentity();

  useEffect(() => {
    if (players.length > 0) {
      identity.resolveIdentity(players).catch(console.error);
    }
  }, [players, identity.resolveIdentity]);

  return identity;
}
