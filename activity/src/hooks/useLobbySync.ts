import { useEffect, useRef, type MutableRefObject } from 'react';
import { useAppStore } from '../store/store';
import { activityInstanceId } from '../discordSdk';
import { syncLobbyMembers } from '../services/lobbyMembers';
import { reportError } from '../lib/sentry';
import { logInfo, logWarn } from '../lib/log';

/** How often an open lobby asks again, to pick up people who joined or left. */
export const SYNC_INTERVAL_MS = 15_000;

const TAG = 'useLobbySync';

/**
 * Ask for a sync. A sync that keeps failing is reported once, not every
 * interval, until one succeeds again; `failures` counts the ones in a row.
 * Later failures, a changed roster and a recovery are logged for bug reports;
 * a sync that changed nothing isn't, since one runs every interval.
 */
function requestSync(channelId: string, instanceId: string, failures: MutableRefObject<number>): void {
  syncLobbyMembers(channelId, instanceId).then(
    (changed) => {
      if (failures.current > 0) logInfo(TAG, `sync recovered after ${failures.current} failed`);
      if (changed) logInfo(TAG, 'sync changed the roster');
      failures.current = 0;
    },
    (err: unknown) => {
      failures.current += 1;
      if (failures.current === 1) reportError(err, { tag: TAG });
      else logWarn(TAG, `sync failed ${failures.current} times in a row`, { error: String(err) });
    },
  );
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
  const failures = useRef(0);

  useEffect(() => {
    if (!channelId) return;
    if (!instanceId) {
      logWarn(TAG, 'no Discord activity instance, so the roster will not sync');
      return;
    }
    logInfo(TAG, 'first sync');
    requestSync(channelId, instanceId, failures);
  }, [instanceId, channelId]);

  useEffect(() => {
    if (!instanceId || !channelId || !gathering) return;
    logInfo(TAG, `syncing every ${SYNC_INTERVAL_MS / 1000}s while players gather`);
    const timer = setInterval(() => requestSync(channelId, instanceId, failures), SYNC_INTERVAL_MS);
    return () => {
      clearInterval(timer);
      logInfo(TAG, 'stopped syncing on an interval');
    };
  }, [instanceId, channelId, gathering]);
}
