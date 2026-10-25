import { httpsCallable } from 'firebase/functions';
import { authReady, functions } from '../firebase';

/**
 * Ask the `syncLobbyMembers` Cloud Function to rewrite the lobby's `members`
 * from the people who have this activity instance open. It reads them from
 * Discord, so the caller only names the instance. Resolves whether `members`
 * changed.
 */
export async function syncLobbyMembers(channelId: string, instanceId: string): Promise<boolean> {
  const call = httpsCallable<{ channelId: string; instanceId: string }, { changed: boolean }>(
    functions,
    'syncLobbyMembers',
  );
  await authReady;
  const result = await call({ channelId, instanceId });
  return result.data.changed;
}
