import { useEffect, useMemo } from 'react';
import { useAppStore } from '../store/store';
import { firestoreService } from '../services/firestoreService';
import { demoService } from '../services/demoService';
import type { SessionService } from '../services/types';
import type { AppState } from '../store/types';
import { loadStoredDiscordId } from '../lib/storedDiscordId';

/** The session service for this mode: in-memory for the demo, Firestore otherwise. */
export function getSessionService(isDemoMode = useAppStore.getState().isDemoMode): SessionService {
  return isDemoMode ? demoService : firestoreService;
}

export function useSessionService(): SessionService {
  const isDemoMode = useAppStore((s) => s.isDemoMode);
  return getSessionService(isDemoMode);
}

export function useGuildSubscription() {
  const currentGuildId = useAppStore((s) => s.currentGuildId);
  const launchChannelId = useAppStore((s) => s.discordChannelId);
  const isDemoMode = useAppStore((s) => s.isDemoMode);

  useEffect(() => {
    if (!currentGuildId) return;
    return getSessionService(isDemoMode).subscribeToGuild(currentGuildId, launchChannelId);
  }, [currentGuildId, launchChannelId, isDemoMode]);
}

export function useChannelSubscription() {
  const currentChannelId = useAppStore((s) => s.currentChannelId);
  const isDemoMode = useAppStore((s) => s.isDemoMode);

  useEffect(() => {
    if (!currentChannelId) return;
    return getSessionService(isDemoMode).subscribeToChannel(currentChannelId);
  }, [currentChannelId, isDemoMode]);
}

/**
 * Follow the preferences docs for everyone in the lobby plus the current user
 * (whose profile the avatar shows on every view). As that set changes, only
 * the players who joined or left are followed or dropped. Demo mode and
 * `?data=` fixtures (no guild ID) seed `profiles` directly instead.
 */
export function useProfilesSubscription() {
  const live = useAppStore((s) => !!s.currentGuildId && !s.isDemoMode);
  const players = useAppStore((s) => s.players);
  const myDiscordId = useMyDiscordId();

  const idsKey = useMemo(() => {
    const ids = new Set(players.map((p) => p.discordId));
    if (myDiscordId) ids.add(myDiscordId);
    return [...ids].sort().join(',');
  }, [players, myDiscordId]);

  // Kept apart from the effect below, whose reruns must not stop everything.
  useEffect(() => {
    if (!live) return;
    return () => firestoreService.followProfiles([]);
  }, [live]);

  useEffect(() => {
    if (live) firestoreService.followProfiles(idsKey ? idsKey.split(',') : []);
  }, [live, idsKey]);
}

/**
 * The current user's Discord ID: the resolved identity, then a Discord
 * sign-in, then the one remembered from an earlier visit. Null until one of
 * those exists.
 */
export function selectMyDiscordId(s: AppState): string | null {
  return s.currentPlayerId ?? s.verifiedDiscordId ?? loadStoredDiscordId();
}

export function useMyDiscordId(): string | null {
  return useAppStore(selectMyDiscordId);
}
