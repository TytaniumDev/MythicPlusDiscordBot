import { useEffect, useMemo, useRef } from 'react';
import { useAppStore } from '../store/store';
import { firestoreService } from '../services/firestoreService';
import { demoService } from '../services/demoService';
import type { SessionService } from '../services/types';
import { loadStoredDiscordId } from '../lib/storedDiscordId';

export function useSessionService(): SessionService {
  const isDemoMode = useAppStore((s) => s.isDemoMode);
  return isDemoMode ? demoService : firestoreService;
}

export function useGuildSubscription() {
  const currentGuildId = useAppStore((s) => s.currentGuildId);
  const isDemoMode = useAppStore((s) => s.isDemoMode);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!currentGuildId) return;

    if (unsubRef.current) {
      unsubRef.current();
    }

    const service = isDemoMode ? demoService : firestoreService;
    unsubRef.current = service.subscribeToGuild(currentGuildId);

    return () => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, [currentGuildId, isDemoMode]);
}

export function useChannelSubscription() {
  const currentChannelId = useAppStore((s) => s.currentChannelId);
  const isDemoMode = useAppStore((s) => s.isDemoMode);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!currentChannelId || isDemoMode) return;

    if (unsubRef.current) {
      unsubRef.current();
    }

    unsubRef.current = firestoreService.subscribeToChannel(currentChannelId);

    return () => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, [currentChannelId, isDemoMode]);
}

/**
 * Follow the preferences docs for everyone in the lobby plus the current user
 * (whose profile the avatar shows on every view). Resubscribes only when that
 * set of IDs changes. Demo mode and `?data=` fixtures (no guild ID) seed
 * `profiles` directly instead.
 */
export function useProfilesSubscription() {
  const currentGuildId = useAppStore((s) => s.currentGuildId);
  const isDemoMode = useAppStore((s) => s.isDemoMode);
  const players = useAppStore((s) => s.players);
  const myDiscordId = useMyDiscordId();

  const idsKey = useMemo(() => {
    const ids = new Set(players.map((p) => p.discordId));
    if (myDiscordId) ids.add(myDiscordId);
    return [...ids].sort().join(',');
  }, [players, myDiscordId]);

  useEffect(() => {
    if (!currentGuildId || isDemoMode || !idsKey) return;
    return firestoreService.subscribeToProfiles(idsKey.split(','));
  }, [currentGuildId, isDemoMode, idsKey]);
}

/**
 * The current user's Discord ID: the resolved identity, or the one remembered
 * from an earlier visit. Null until one of those exists.
 */
export function useMyDiscordId(): string | null {
  const currentPlayerId = useAppStore((s) => s.currentPlayerId);
  return currentPlayerId ?? loadStoredDiscordId();
}
