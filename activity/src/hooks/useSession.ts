import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/store';
import { firestoreService } from '../services/firestoreService';
import { demoService } from '../services/demoService';
import type { SessionService } from '../services/types';

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
