import { useCallback } from 'react';
import { useAppStore } from '../store/store';
import { getParticipants } from '../discordSdk';
import { WoWPlayer } from '../types';
import { firestoreService } from '../services/firestoreService';
import { demoService } from '../services/demoService';

function getSessionService() {
  return useAppStore.getState().isDemoMode ? demoService : firestoreService;
}

function stripDots(s: string): string {
  return s.replace(/\./g, '');
}

function getIdentityStorageKey(guildId: string | null): string {
  return `wheelson-player-${guildId ?? 'unknown'}`;
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
      console.warn(`[Wheelson:identity] Previously resolved player ${state.currentPlayerId} (${state.currentPlayerName}) not found in players list (${players.length} players). Resetting identity.`);
      useAppStore.getState().resetIdentity();
    }

    const guildId = useAppStore.getState().currentGuildId;

    // Check localStorage
    const stored = localStorage.getItem(getIdentityStorageKey(guildId));
    if (stored) {
      const match = players.find((p) => p.discordId === stored);
      if (match) {
        console.log(`[Wheelson:identity] Restored identity from localStorage: ${match.name} (${match.discordId})`);
        useAppStore.getState().setIdentity(match.discordId ?? null, match.name);
        useAppStore.getState().setIdentityResolved(true);
        if (match.discordId) {
          getSessionService().claimPlayer(match.discordId).catch(console.error);
        }
        return;
      }
      console.warn(`[Wheelson:identity] localStorage had player ${stored} but not found in players list (${players.length} players). IDs: [${players.map(p => p.discordId).join(', ')}]`);
    }

    // Auto-match via Discord participants
    const participants = await getParticipants();
    if (participants.length > 0) {
      for (const participant of participants) {
        const pName = stripDots(participant.nickname ?? participant.global_name ?? participant.username);
        const match = players.find((p) => p.name === pName);
        if (match && match.discordId) {
          console.log(`[Wheelson:identity] Auto-matched via participant name: ${match.name} (${match.discordId})`);
          useAppStore.getState().setIdentity(match.discordId, match.name);
          useAppStore.getState().setIdentityResolved(true);
          localStorage.setItem(getIdentityStorageKey(guildId), match.discordId);
          getSessionService().claimPlayer(match.discordId).catch(console.error);
          return;
        }
      }

      // Try matching by discordId directly
      const participantIds = new Set(participants.map((p) => p.id));
      const idMatches = players.filter((p) => p.discordId && participantIds.has(p.discordId));
      if (idMatches.length === 1) {
        const match = idMatches[0];
        console.log(`[Wheelson:identity] Auto-matched via discordId: ${match.name} (${match.discordId})`);
        useAppStore.getState().setIdentity(match.discordId ?? null, match.name);
        useAppStore.getState().setIdentityResolved(true);
        if (match.discordId) {
          localStorage.setItem(getIdentityStorageKey(guildId), match.discordId);
          getSessionService().claimPlayer(match.discordId).catch(console.error);
        }
        return;
      }

      console.log(`[Wheelson:identity] No auto-match found. Participants: [${participants.map(p => p.id).join(', ')}], Players: [${players.map(p => `${p.name}:${p.discordId}`).join(', ')}]`);
    } else {
      console.log('[Wheelson:identity] No Discord participants available for auto-match');
    }

    // No match found — identity selector will show in lobby
  }, []);

  const selectPlayer = useCallback((player: WoWPlayer) => {
    console.log(`[Wheelson:identity] Manual select: ${player.name} (${player.discordId})`);
    const guildId = useAppStore.getState().currentGuildId;
    useAppStore.getState().setIdentity(player.discordId ?? null, player.name);
    useAppStore.getState().setIdentityResolved(true);
    if (player.discordId) {
      localStorage.setItem(getIdentityStorageKey(guildId), player.discordId);
      getSessionService().claimPlayer(player.discordId).catch(console.error);
    }
  }, []);

  const clearIdentity = useCallback(() => {
    const state = useAppStore.getState();
    const guildId = state.currentGuildId;
    const previousId = state.currentPlayerId;
    console.log(`[Wheelson:identity] Clearing identity: ${previousId} (${state.currentPlayerName})`);
    localStorage.removeItem(getIdentityStorageKey(guildId));
    state.resetIdentity();
    if (previousId) {
      getSessionService().unclaimPlayer(previousId).catch(console.error);
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
