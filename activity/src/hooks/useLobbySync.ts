import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store/store';
import { activityInstanceId, getParticipants, onParticipantsChange, type DiscordParticipant } from '../discordSdk';
import { idsKey, lobbyNeedsSync, memberIdsKey, syncDelayMs } from '../lib/lobbySync';
import { syncLobbyMembers } from '../services/lobbyMembers';
import { reportError } from '../lib/sentry';
import { useMyDiscordId } from './useSession';

function participantIds(participants: DiscordParticipant[]): string[] {
  return participants.map((p) => p.id).filter((id) => id !== '');
}

/** The Discord IDs of everyone with this activity instance open, kept current. */
function useParticipantIds(enabled: boolean): string[] {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    getParticipants().then((participants) => {
      if (active) setIds(participantIds(participants));
    }).catch(() => {});
    const unsubscribe = onParticipantsChange((participants) => setIds(participantIds(participants)));
    return () => {
      active = false;
      unsubscribe();
    };
  }, [enabled]);
  return ids;
}

/**
 * Keep the lobby's roster in step with who has the activity open. When the
 * lobby's `members` (or the instance they came from) differ from Discord's
 * participants, one client asks `syncLobbyMembers` to rewrite them; the
 * others see the roster catch up and stand down (lib/lobbySync.ts). Does
 * nothing outside Discord and in the demo.
 */
export function useLobbySync(): void {
  const instanceId = activityInstanceId();
  const channelId = useAppStore((s) => (s.channelData && !s.isDemoMode ? s.currentChannelId : null));
  const membersKey = useAppStore((s) => memberIdsKey(s.channelData?.members));
  const lobbyInstanceId = useAppStore((s) => s.channelData?.instanceId ?? null);
  const myDiscordId = useMyDiscordId();
  const participants = useParticipantIds(instanceId !== null);
  const participantsKey = idsKey(participants);

  // The state last asked about, so a sync Discord can't settle (its record of
  // the instance and the SDK's disagreeing for a moment) isn't retried in a loop.
  const lastAsked = useRef<string | null>(null);

  useEffect(() => {
    if (!instanceId || !channelId || participantsKey === '') return;
    if (!lobbyNeedsSync(participantsKey, membersKey, lobbyInstanceId, instanceId)) return;
    const asking = [channelId, instanceId, lobbyInstanceId, participantsKey, membersKey].join('|');
    if (lastAsked.current === asking) return;

    // A roster that catches up meanwhile reruns this effect, which cancels the wait.
    const timer = setTimeout(() => {
      lastAsked.current = asking;
      syncLobbyMembers(channelId, instanceId).catch((err: unknown) => {
        reportError(err, { tag: 'useLobbySync' });
      });
    }, syncDelayMs(participantsKey.split(','), myDiscordId));
    return () => clearTimeout(timer);
  }, [instanceId, channelId, participantsKey, membersKey, lobbyInstanceId, myDiscordId]);
}
