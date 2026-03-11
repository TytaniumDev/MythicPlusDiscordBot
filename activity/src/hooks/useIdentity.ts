import { useCallback } from 'react';
import { useAppStore } from '../store/store';
import { getParticipants } from '../discordSdk';
import { WoWPlayer } from '../types';

function stripDots(s: string): string {
  return s.replace(/\./g, '');
}

function getIdentityStorageKey(guildId: string | null): string {
  return `wheelson-player-${guildId ?? 'unknown'}`;
}

export function useIdentity() {
  const currentPlayerId = useAppStore((s) => s.currentPlayerId);
  const identityResolved = useAppStore((s) => s.identityResolved);

  const resolveIdentity = useCallback(async (players: WoWPlayer[]) => {
    const state = useAppStore.getState();

    if (state.identityResolved && state.currentPlayerId) {
      const stillHere = players.some((p) => p.discordId === state.currentPlayerId);
      if (stillHere) return;
      // Player left — re-resolve
      useAppStore.getState().resetIdentity();
    }

    const guildId = useAppStore.getState().currentGuildId;

    // Check localStorage
    const stored = localStorage.getItem(getIdentityStorageKey(guildId));
    if (stored) {
      const match = players.find((p) => p.discordId === stored);
      if (match) {
        useAppStore.getState().setIdentity(match.discordId ?? null, match.name);
        useAppStore.getState().setIdentityResolved(true);
        return;
      }
    }

    // Auto-match via Discord participants
    const participants = await getParticipants();
    if (participants.length > 0) {
      for (const participant of participants) {
        const pName = stripDots(participant.nickname ?? participant.global_name ?? participant.username);
        const match = players.find((p) => p.name === pName);
        if (match && match.discordId) {
          useAppStore.getState().setIdentity(match.discordId, match.name);
          useAppStore.getState().setIdentityResolved(true);
          localStorage.setItem(getIdentityStorageKey(guildId), match.discordId);
          return;
        }
      }

      // Try matching by discordId directly
      const participantIds = new Set(participants.map((p) => p.id));
      const idMatches = players.filter((p) => p.discordId && participantIds.has(p.discordId));
      if (idMatches.length === 1) {
        const match = idMatches[0];
        useAppStore.getState().setIdentity(match.discordId ?? null, match.name);
        useAppStore.getState().setIdentityResolved(true);
        if (match.discordId) {
          localStorage.setItem(getIdentityStorageKey(guildId), match.discordId);
        }
        return;
      }
    }

    // No match found — identity remains unresolved (chips won't highlight)
  }, []);

  return {
    resolveIdentity,
    currentPlayerId,
    identityResolved,
  };
}
