import { doc, increment, runTransaction, serverTimestamp, type Firestore, type SetOptions } from 'firebase/firestore';
import {
  WoWGroup,
  createMythicPlusGroups,
  encodeGroupHistoryRounds,
  seasonPairsUpdate,
  setGroupHistory,
  todayPST,
} from '@mythicplus/shared';
import type { WoWGroupDict } from '@mythicplus/shared';
import type { ChannelData, GuildData, WoWPlayer } from '../types';
import { eligibleSpinPlayers } from '../lib/spinEligibility';
import { decodeChannelData, decodeGuildData } from './firestoreDecoders';

// Lobby writes that take more than one field or a read first. The Firestore
// service and the firestore.rules tests both call these, so the rules are
// tested against the writes the activity really makes.

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

/**
 * Back to an empty lobby, for a new round or a cancelled spin. Sit-outs apply
 * to one round, so they reset too.
 */
export function lobbyReset(): Pick<ChannelData, 'status' | 'groups' | 'revealedGroups' | 'sittingOut'> {
  return { status: 'lobby', groups: [], revealedGroups: 0, sittingOut: [] };
}

/**
 * Today's rounds from a guild's group history, or none when the history is
 * from another day.
 */
export function todaysRounds(guild: GuildData | null | undefined, todayIso: string): WoWGroupDict[][] {
  const history = guild?.groupHistory;
  return history && history.date === todayIso ? history.rounds : [];
}

/**
 * Start a round in one transaction: read the lobby and its guild, form groups
 * from `players` minus the lobby's sit-outs, and write the round together
 * with the guild's group history and season pair counts.
 *
 * No screen shows the round, this client's included, until the server has
 * accepted it, so every client animates the same groups; a write that shows
 * locally first would put a rejected second Spin click's groups on one
 * screen. Resolves false when the lobby isn't waiting for a spin (someone
 * else started one). Season pairs are skipped without a `seasonSlug` and for
 * debug lobbies. The caller must be signed in (firestore.rules).
 */
export async function startSpin(
  db: Firestore,
  channelId: string,
  players: readonly WoWPlayer[],
  seasonSlug: string | null,
  today: string = todayPST(),
): Promise<boolean> {
  const lobbyRef = doc(db, 'channels', channelId);
  return runTransaction(db, async (transaction) => {
    const lobbySnap = await transaction.get(lobbyRef);
    if (!lobbySnap.exists()) return false;
    // Listeners report malformed docs; here the defaults are enough.
    const lobby = decodeChannelData(lobbySnap.data(), channelId).value;
    if (lobby.status !== 'lobby') return false;

    const guildId = lobby.guildId || null;
    const guildRef = guildId ? doc(db, 'guilds', guildId) : null;
    const guildSnap = guildRef ? await transaction.get(guildRef) : null;
    const guild = guildId && guildSnap?.exists() ? decodeGuildData(guildSnap.data(), guildId).value : null;

    // Today's history steers the algorithm away from repeat groupings.
    const history = todaysRounds(guild, today);
    setGroupHistory(history.map((round) => round.map((g) => WoWGroup.fromDict(g))), guildId);
    const groups = createMythicPlusGroups(eligibleSpinPlayers(players, lobby.sittingOut ?? []), true, guildId);
    const groupDicts = groups.map((g) => g.toDict());

    transaction.update(lobbyRef, { status: 'spinning', groups: groupDicts, revealedGroups: 0 });

    if (guildRef) {
      const pairs = seasonSlug && !lobby.isDebug
        ? seasonPairsUpdate(guild?.seasonPairs ?? null, seasonSlug, groups, increment)
        : null;
      const groupHistory = { date: today, rounds: encodeGroupHistoryRounds([...history, groupDicts]) };
      // One write for both. A pairs replace names its fields; with none, or
      // with increments, a merge updates just these two.
      const options: SetOptions = pairs && 'mergeFields' in pairs.options
        ? { mergeFields: ['groupHistory', ...pairs.options.mergeFields] }
        : { merge: true };
      transaction.set(guildRef, { groupHistory, ...pairs?.data }, options);
    }
    return true;
  });
}
