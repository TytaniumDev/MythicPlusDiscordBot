import { useCallback } from 'react';
import { useAppStore } from '../store/store';
import { WoWPlayer } from '../types';
import { reportError } from '../lib/sentry';
import { loadStoredDiscordId, saveStoredDiscordId } from '../lib/storedDiscordId';
import { getSessionService } from './useSession';

interface CommitOptions {
  /** When true, also write the discordId to localStorage. Skip when the call
   *  site is *reading* from localStorage (the value is already there). */
  persist: boolean;
}

/**
 * Claim a player in the current lobby, or release a claim this client made so
 * the picker stops showing that player as claimed.
 */
function setClaim(discordId: string, claimed: boolean): void {
  const channelId = useAppStore.getState().currentChannelId;
  if (!channelId) return;
  const service = getSessionService();
  const write = claimed ? service.claimPlayer(channelId, discordId) : service.unclaimPlayer(channelId, discordId);
  write.catch((err) => {
    reportError(err, { tag: claimed ? 'useIdentity.claimPlayer' : 'useIdentity.unclaimPlayer' });
  });
}

/**
 * Commit a resolved identity to the store and (optionally) persistence.
 * Always sets identity + resolved flag, and releases the claim on the player
 * this client was before (a re-pick). Only writes localStorage and claims the
 * player when there's a non-null discordId, since both are keyed off it.
 */
function commitIdentity(player: WoWPlayer, opts: CommitOptions): void {
  const store = useAppStore.getState();
  const previousId = store.currentPlayerId;
  store.setIdentity(player.discordId ?? null, player.name);
  store.setIdentityResolved(true);
  if (previousId && previousId !== player.discordId) setClaim(previousId, false);
  if (!player.discordId) return;
  if (opts.persist) {
    saveStoredDiscordId(player.discordId);
  }
  setClaim(player.discordId, true);
}

export function useIdentity() {
  const currentPlayerId = useAppStore((s) => s.currentPlayerId);
  const currentPlayerName = useAppStore((s) => s.currentPlayerName);
  const identityResolved = useAppStore((s) => s.identityResolved);

  const resolveIdentity = useCallback(async (players: WoWPlayer[]) => {
    const state = useAppStore.getState();
    const verifiedId = state.verifiedDiscordId;
    const verifiedPlayer = verifiedId ? players.find((p) => p.discordId === verifiedId) : undefined;

    if (state.identityResolved && state.currentPlayerId) {
      const stillHere = players.some((p) => p.discordId === state.currentPlayerId);
      const replacedBySignIn = verifiedPlayer != null && verifiedPlayer.discordId !== state.currentPlayerId;
      if (stillHere && !replacedBySignIn) return;
      // Player left, or the signed-in Discord user is here as someone else — re-resolve
      setClaim(state.currentPlayerId, false);
      state.resetIdentity();
    }

    // A Discord sign-in is proof of identity: use it and never guess past it.
    if (verifiedId) {
      if (verifiedPlayer) commitIdentity(verifiedPlayer, { persist: true });
      return;
    }

    // Check localStorage — value is already persisted, so don't re-write it.
    const stored = loadStoredDiscordId();
    if (stored) {
      const match = players.find((p) => p.discordId === stored);
      if (match) {
        commitIdentity(match, { persist: false });
        return;
      }
    }

    // Otherwise: no match — identity selector will show in lobby
  }, []);

  const selectPlayer = useCallback((player: WoWPlayer) => {
    commitIdentity(player, { persist: true });
  }, []);

  return {
    resolveIdentity,
    selectPlayer,
    currentPlayerId,
    currentPlayerName,
    identityResolved,
  };
}
