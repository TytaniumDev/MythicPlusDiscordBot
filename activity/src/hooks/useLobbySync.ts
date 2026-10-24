import { useEffect } from 'react';
import { useAppStore } from '../store/store';
import { activityInstanceId } from '../discordSdk';
import { syncLobbyMembers } from '../services/lobbyMembers';
import { reportError } from '../lib/sentry';

/** How often an open lobby asks again, to pick up people who joined or left. */
export const SYNC_INTERVAL_MS = 15_000;

function requestSync(channelId: string, instanceId: string): void {
  syncLobbyMembers(channelId, instanceId).catch((err: unknown) => {
    reportError(err, { tag: 'useLobbySync' });
  });
}

/**
 * Keep the lobby's roster to the people who have the activity open.
 * `syncLobbyMembers` reads them from Discord itself and writes only on a
 * change, so the client just has to ask: once when it opens the lobby (which
 * also clears an earlier run's round), then every `SYNC_INTERVAL_MS` while
 * players gather. Discord doesn't tell an activity that hasn't authenticated
 * who joins or leaves, so it can't ask only when that happens. Does nothing
 * outside Discord and in the demo.
 */
export function useLobbySync(): void {
  const instanceId = activityInstanceId();
  const channelId = useAppStore((s) => (s.channelData && !s.isDemoMode ? s.currentChannelId : null));
  const gathering = useAppStore((s) => s.channelData?.status === 'lobby');

  useEffect(() => {
    if (!instanceId || !channelId) return;
    requestSync(channelId, instanceId);
  }, [instanceId, channelId]);

  useEffect(() => {
    if (!instanceId || !channelId || !gathering) return;
    const timer = setInterval(() => requestSync(channelId, instanceId), SYNC_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [instanceId, channelId, gathering]);
}
