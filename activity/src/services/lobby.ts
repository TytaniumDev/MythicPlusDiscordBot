import { doc, runTransaction, serverTimestamp, type Firestore } from 'firebase/firestore';
import type { ChannelData } from '../types';

type NewLobbyDoc = Omit<ChannelData, 'members' | 'revealedGroups' | 'claimedPlayers' | 'staticWheel'>;

/**
 * An empty lobby as the activity creates it. `members` and `expireAt` are left
 * to the bot: firestore.rules reject them from clients.
 */
export function newLobbyDoc(channelId: string, channelName: string, guildId: string): NewLobbyDoc {
  return {
    channelId,
    channelName,
    guildId,
    status: 'lobby',
    groups: [],
    sittingOut: [],
    isDebug: false,
    createdAt: serverTimestamp(),
    lastActive: serverTimestamp(),
  };
}

/**
 * Open the lobby for a voice channel unless it already exists. An existing
 * lobby is joined as it is: writing over it would reset the round in progress,
 * and everyone's sit-outs, for the whole channel. The caller must be signed in
 * (firestore.rules).
 */
export async function ensureLobby(
  db: Firestore,
  channelId: string,
  channelName: string,
  guildId: string,
): Promise<void> {
  const ref = doc(db, 'channels', channelId);
  await runTransaction(db, async (transaction) => {
    if ((await transaction.get(ref)).exists()) return;
    transaction.set(ref, newLobbyDoc(channelId, channelName, guildId));
  });
}
