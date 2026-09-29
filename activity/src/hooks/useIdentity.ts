import { useCallback } from 'react';
import { useAppStore } from '../store/store';
import { getParticipants } from '../discordSdk';
import { WoWPlayer } from '../types';
import { firestoreService } from '../services/firestoreService';
import { demoService } from '../services/demoService';
import { reportError } from '../lib/sentry';
import { loadStoredDiscordId, saveStoredDiscordId } from '../lib/storedDiscordId';

function getSessionService() {
  return useAppStore.getState().isDemoMode ? demoService : firestoreService;
}

function stripDots(s: string): string {
  return s.replace(/\./g, '');
}

interface CommitOptions {
  /** When true, also write the discordId to localStorage. Skip when the call
   *  site is *reading* from localStorage (the value is already there). */
  persist: boolean;
}

/** Release a claim this client made, so the picker stops showing that player as claimed. */
function releaseClaim(discordId: string): void {
  getSessionService().unclaimPlayer(discordId).catch((err) => {
    reportError(err, { tag: 'useIdentity.unclaimPlayer' });
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
  if (previousId && previousId !== player.discordId) releaseClaim(previousId);
  if (!player.discordId) return;
  if (opts.persist) {
    saveStoredDiscordId(player.discordId);
  }
  getSessionService().claimPlayer(player.discordId).catch((err) => {
    reportError(err, { tag: 'useIdentity.claimPlayer' });
  });
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
      releaseClaim(state.currentPlayerId);
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

    // Auto-match via Discord participants
    const participants = await getParticipants();
    if (participants.length === 0) return;

    for (const participant of participants) {
      const pName = stripDots(participant.nickname ?? participant.global_name ?? participant.username);
      const match = players.find((p) => p.name === pName);
      if (match && match.discordId) {
        commitIdentity(match, { persist: true });
        return;
      }
    }

    // Try matching by discordId directly
    const participantIds = new Set(participants.map((p) => p.id));
    const idMatches = players.filter((p) => p.discordId && participantIds.has(p.discordId));
    if (idMatches.length === 1) {
      commitIdentity(idMatches[0], { persist: true });
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
