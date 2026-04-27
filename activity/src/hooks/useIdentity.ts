import { useCallback } from 'react';
import { useAppStore } from '../store/store';
import { getParticipants } from '../discordSdk';
import { WoWPlayer } from '../types';
import { firestoreService } from '../services/firestoreService';
import { demoService } from '../services/demoService';
import { reportError } from '../lib/sentry';

function getSessionService() {
  return useAppStore.getState().isDemoMode ? demoService : firestoreService;
}

function stripDots(s: string): string {
  return s.replace(/\./g, '');
}

function getIdentityStorageKey(guildId: string | null): string {
  return `wheelson-player-${guildId ?? 'unknown'}`;
}

interface CommitOptions {
  /** When true, also write the discordId to localStorage. Skip when the call
   *  site is *reading* from localStorage (the value is already there). */
  persist: boolean;
}

/**
 * Commit a resolved identity to the store and (optionally) persistence.
 * Always sets identity + resolved flag; only writes localStorage and claims
 * the player when there's a non-null discordId, since both are keyed off it.
 */
function commitIdentity(player: WoWPlayer, guildId: string | null, opts: CommitOptions): void {
  const store = useAppStore.getState();
  store.setIdentity(player.discordId ?? null, player.name);
  store.setIdentityResolved(true);
  if (!player.discordId) return;
  if (opts.persist) {
    localStorage.setItem(getIdentityStorageKey(guildId), player.discordId);
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

    if (state.identityResolved && state.currentPlayerId) {
      const stillHere = players.some((p) => p.discordId === state.currentPlayerId);
      if (stillHere) return;
      // Player left — re-resolve
      state.resetIdentity();
    }

    // Re-read state — `resetIdentity()` above may have mutated, and we want
    // the post-reset `currentGuildId` (in practice unchanged, but the fresh
    // read keeps us robust if guild teardown ever moves into resetIdentity).
    const guildId = useAppStore.getState().currentGuildId;

    // Check localStorage — value is already persisted, so don't re-write it.
    const stored = localStorage.getItem(getIdentityStorageKey(guildId));
    if (stored) {
      const match = players.find((p) => p.discordId === stored);
      if (match) {
        commitIdentity(match, guildId, { persist: false });
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
        commitIdentity(match, guildId, { persist: true });
        return;
      }
    }

    // Try matching by discordId directly
    const participantIds = new Set(participants.map((p) => p.id));
    const idMatches = players.filter((p) => p.discordId && participantIds.has(p.discordId));
    if (idMatches.length === 1) {
      commitIdentity(idMatches[0], guildId, { persist: true });
    }

    // Otherwise: no match — identity selector will show in lobby
  }, []);

  const selectPlayer = useCallback((player: WoWPlayer) => {
    const guildId = useAppStore.getState().currentGuildId;
    commitIdentity(player, guildId, { persist: true });
  }, []);

  const clearIdentity = useCallback(() => {
    const state = useAppStore.getState();
    const guildId = state.currentGuildId;
    const previousId = state.currentPlayerId;
    localStorage.removeItem(getIdentityStorageKey(guildId));
    state.resetIdentity();
    if (previousId) {
      getSessionService().unclaimPlayer(previousId).catch((err) => {
        reportError(err, { tag: 'useIdentity.unclaimPlayer' });
      });
    }
  }, []);

  return {
    resolveIdentity,
    selectPlayer,
    clearIdentity,
    currentPlayerId,
    currentPlayerName,
    identityResolved,
  };
}
