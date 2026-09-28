import { useMemo } from 'react';
import { WoWPlayer as Player } from '@mythicplus/shared';
import { useAppStore } from '../store/store';
import { useMyDiscordId } from './useSession';
import type { WoWPlayer } from '../types';

export interface MyProfile {
  /** Null until the user has picked themselves (or did on an earlier visit). */
  discordId: string | null;
  /** The user's lobby entry, or one built from their preferences doc outside a lobby. */
  player: WoWPlayer | null;
  displayName: string | null;
}

/** The current user's profile, read from their `preferences` doc. */
export function useMyProfile(): MyProfile {
  const discordId = useMyDiscordId();
  const currentPlayerName = useAppStore((s) => s.currentPlayerName);
  const lobbyPlayer = useAppStore((s) =>
    discordId ? s.players.find((p) => p.discordId === discordId) ?? null : null,
  );
  const profile = useAppStore((s) => (discordId ? s.profiles[discordId] ?? null : null));

  const player = useMemo<WoWPlayer | null>(() => {
    if (!discordId) return null;
    if (lobbyPlayer) return lobbyPlayer;
    return Player.fromPreferences({ discordId, name: currentPlayerName ?? '' }, profile).toDict();
  }, [discordId, lobbyPlayer, profile, currentPlayerName]);

  const displayName = player?.inGameName?.split('-')[0] || currentPlayerName || player?.name || null;

  return { discordId, player, displayName };
}
