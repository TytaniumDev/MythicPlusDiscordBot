import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { lobbyMemberName, parseLobbyMembers } from '@mythicplus/shared';
import { fetchActivityInstance, fetchGuildMemberNames, type ActivityInstance } from './discordApi.js';
import { lobbySyncUpdate, newcomers, parseLobbySyncRequest, rosterFor } from './lobbySync.js';
import { enforceRateLimit } from './rateLimit.js';

const botToken = defineSecret('BOT_TOKEN');
const discordApplicationId = defineSecret('DISCORD_APPLICATION_ID');

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  const timestamp = value as { toDate?: () => Date } | null | undefined;
  return typeof timestamp?.toDate === 'function' ? timestamp.toDate() : null;
}

type RejectCode = 'unauthenticated' | 'invalid-argument' | 'permission-denied' | 'failed-precondition';

/** Log why a sync was turned down (the client only sees the error), then return the error to throw. */
function reject(code: RejectCode, message: string, context: Record<string, unknown> = {}): HttpsError {
  logger.warn(`syncLobbyMembers refused: ${message}`, { code, ...context });
  return new HttpsError(code, message);
}

/**
 * Write a lobby's `members` from the people who have its activity open. Any
 * client in the activity can ask; the roster comes from Discord's record of
 * the activity instance, not from the caller, so a client can't add or drop
 * anyone. Names come from the server's member list.
 */
export const syncLobbyMembers = onCall(
  { secrets: [botToken, discordApplicationId] },
  async (request) => {
    if (!request.auth) {
      throw reject('unauthenticated', 'Authentication required');
    }
    await enforceRateLimit(request.auth.uid, 'syncLobbyMembers', 30, 60000);

    const sync = parseLobbySyncRequest(request.data);
    if (!sync) {
      throw reject('invalid-argument', 'A sync needs a channel and an activity instance');
    }

    const token = botToken.value().trim();
    let instance: ActivityInstance | null;
    try {
      instance = await fetchActivityInstance(token, discordApplicationId.value().trim(), sync.instanceId);
    } catch (e) {
      logger.error('Failed to read an activity instance', e);
      throw new HttpsError('unavailable', 'Could not reach Discord');
    }
    if (!instance || instance.channelId !== sync.channelId || !instance.guildId) {
      throw reject('permission-denied', 'The activity is not running in this channel', {
        channelId: sync.channelId,
        instanceFound: instance !== null,
        instanceChannelId: instance?.channelId ?? null,
        instanceGuildId: instance?.guildId ?? null,
      });
    }
    const guildId = instance.guildId;

    const db = getFirestore();
    const ref = db.doc(`channels/${sync.channelId}`);
    const lobby = (await ref.get()).data();
    if (!lobby) {
      throw reject('failed-precondition', 'This channel has no lobby', { channelId: sync.channelId });
    }
    if (lobby.guildId !== guildId) {
      throw reject('permission-denied', 'The activity is not running in this channel', {
        channelId: sync.channelId,
        lobbyGuildId: typeof lobby.guildId === 'string' ? lobby.guildId : null,
        instanceGuildId: guildId,
      });
    }

    // Names are read once per newcomer; members who stay keep theirs.
    const names = new Map<string, string>();
    try {
      await Promise.all(newcomers(instance.userIds, parseLobbyMembers(lobby.members)).map(async (id) => {
        const member = await fetchGuildMemberNames(token, guildId, id);
        if (member) names.set(id, lobbyMemberName(member));
      }));
    } catch (e) {
      logger.error('Failed to read lobby member names', e);
      throw new HttpsError('unavailable', 'Could not reach Discord');
    }

    const changed = await db.runTransaction(async (transaction) => {
      const current = (await transaction.get(ref)).data();
      if (!current) return false;
      const members = parseLobbyMembers(current.members);
      const update = lobbySyncUpdate(
        {
          members,
          instanceId: typeof current.instanceId === 'string' ? current.instanceId : null,
          expireAt: toDate(current.expireAt),
        },
        sync.instanceId,
        rosterFor(instance.userIds, members, names),
        Date.now(),
      );
      if (!update) return false;
      transaction.update(ref, { ...update, lastActive: FieldValue.serverTimestamp() });
      return true;
    });
    if (changed) {
      logger.info('syncLobbyMembers updated a lobby', { channelId: sync.channelId, members: instance.userIds.length });
    }
    return { changed };
  },
);
