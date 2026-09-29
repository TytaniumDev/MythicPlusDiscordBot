/**
 * firestore.rules against the Firestore emulator. Every "allows" case mirrors
 * (or, where it can, calls) a write in src/services/, so a rules change that would
 * break the activity fails here; the "rejects" cases pin down what the rules
 * exist to block.
 *
 * Run via ./scripts/emulator-test.sh (from repo root).
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';
import { getApps, initializeApp as initializeAdminApp } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import {
  ALL_ROLES,
  CHARACTER_CLASSES,
  WoWGroup,
  WoWPlayer,
  bumpPairCounts,
  decodeGroupHistoryRounds,
  encodeGroupHistoryRounds,
  todayPST,
  type WoWGroupDict,
} from '@mythicplus/shared';
import { ensureLobby, lobbyReset, startSpin } from '../src/services/lobby';

const projectId = process.env.GCLOUD_PROJECT;
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
if (!projectId || !emulatorHost) {
  throw new Error('Run rules tests via ./scripts/emulator-test.sh — they need the Firestore emulator.');
}
const [host, port] = [emulatorHost.slice(0, emulatorHost.lastIndexOf(':')), Number(emulatorHost.slice(emulatorHost.lastIndexOf(':') + 1))];

// The bot's view: Admin SDK, rules bypassed. Used to seed and inspect.
if (getApps().length === 0) initializeAdminApp({ projectId });
const admin = getAdminFirestore();

const clientApps: FirebaseApp[] = [];

/** A browser client; `uid` null means it hasn't finished signing in. */
function client(uid: string | null): Firestore {
  const app = initializeApp({ projectId, apiKey: 'rules-test' }, `client-${clientApps.length}`);
  clientApps.push(app);
  const db = getFirestore(app);
  connectFirestoreEmulator(db, host, port, uid ? { mockUserToken: { user_id: uid } } : undefined);
  return db;
}

const GUILD_ID = '100000000000000001';
const CHANNEL_ID = '200000000000000002';
const PLAYER_ID = '300000000000000003';

const tank = WoWPlayer.create('Tankone', ['Tank', 'Brez'], '1001', 'Tankone-Stormrage').toDict();
const healer = WoWPlayer.create('Healone', ['Healer'], '1002', 'Healone-Stormrage').toDict();
const dps = ['1003', '1004', '1005'].map((id) =>
  WoWPlayer.create(`Dps${id}`, ['Ranged'], id, `Dps${id}-Stormrage`).toDict(),
);
const GROUP: WoWGroupDict = { tank, healer, dps };
const PLAYERS = [tank, healer, ...dps];

async function clearEmulator(): Promise<void> {
  const res = await fetch(
    `http://${emulatorHost}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
    { method: 'DELETE' },
  );
  if (!res.ok) throw new Error(`Failed to clear the emulator: ${res.status}`);
}

async function seedGuild(extra: Record<string, unknown> = {}): Promise<void> {
  await admin.doc(`guilds/${GUILD_ID}`).set({
    guildId: GUILD_ID,
    guildName: 'Rules Test Guild',
    voiceChannels: [{ id: CHANNEL_ID, name: 'Lobby', userCount: 5 }],
    ...extra,
  });
}

async function seedChannel(status: 'lobby' | 'spinning' | 'completed'): Promise<void> {
  await admin.doc(`channels/${CHANNEL_ID}`).set({
    channelId: CHANNEL_ID,
    channelName: 'Lobby',
    guildId: GUILD_ID,
    status,
    members: [tank, healer, ...dps].map((p) => ({ discordId: p.discordId, name: p.name })),
    groups: status === 'lobby' ? [] : [GROUP],
    revealedGroups: 0,
    sittingOut: [],
    isDebug: false,
    // The bot stamps a TTL expiry on every lobby write.
    expireAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
}

async function allowed(write: Promise<unknown>): Promise<void> {
  await write; // a rejection fails the test with the rules error
}

async function denied(write: Promise<unknown>): Promise<void> {
  await expect(write).rejects.toMatchObject({ code: 'permission-denied' });
}

let db: Firestore;

beforeEach(async () => {
  await clearEmulator();
  db = client('anonymous-user');
});

afterAll(async () => {
  await Promise.all(clientApps.map((app) => deleteApp(app)));
});

describe('guilds', () => {
  const guildRef = () => doc(db, 'guilds', GUILD_ID);

  it('allows setting up a new guild (createGuildEntry)', async () => {
    await allowed(setDoc(guildRef(), {
      guildId: GUILD_ID,
      voiceChannels: [],
      refreshRequest: serverTimestamp(),
      createdAt: serverTimestamp(),
      lastActive: serverTimestamp(),
    }, { merge: true }));
  });

  it('allows the guild setup merge over an existing guild without touching its history', async () => {
    await seedGuild({ groupHistory: { date: todayPST(), rounds: encodeGroupHistoryRounds([[GROUP]]) } });
    await allowed(setDoc(guildRef(), {
      guildId: GUILD_ID,
      voiceChannels: [],
      refreshRequest: serverTimestamp(),
      createdAt: serverTimestamp(),
      lastActive: serverTimestamp(),
    }, { merge: true }));
    expect((await admin.doc(`guilds/${GUILD_ID}`).get()).get('groupHistory.date')).toBe(todayPST());
  });

  it('allows requesting a channel refresh (refreshChannels)', async () => {
    await seedGuild();
    await allowed(updateDoc(guildRef(), { refreshRequest: serverTimestamp() }));
  });

  it('rejects writes from a client that has not signed in', async () => {
    await seedGuild();
    await denied(updateDoc(doc(client(null), 'guilds', GUILD_ID), { refreshRequest: serverTimestamp() }));
  });

  it('rejects changing bot-owned fields', async () => {
    await seedGuild();
    await denied(updateDoc(guildRef(), { guildName: 'Renamed' }));
    await denied(updateDoc(guildRef(), { voiceChannels: [{ id: '1', name: 'Fake', userCount: 1 }] }));
  });

  it('rejects malformed history, unknown fields, bad IDs and deletes', async () => {
    await seedGuild();
    await denied(setDoc(guildRef(), { groupHistory: { date: 'today', rounds: [] } }, { merge: true }));
    await denied(updateDoc(guildRef(), { hacked: true }));
    await denied(setDoc(doc(db, 'guilds', 'not-a-snowflake'), { guildId: 'not-a-snowflake' }));
    await denied(deleteDoc(guildRef()));
  });
});

describe('channels', () => {
  const channelRef = () => doc(db, 'channels', CHANNEL_ID);

  it('allows opening a lobby (selectChannel, createGuildEntry)', async () => {
    await seedGuild();
    await allowed(ensureLobby(db, CHANNEL_ID, 'Lobby', GUILD_ID));
    expect((await admin.doc(`channels/${CHANNEL_ID}`).get()).get('status')).toBe('lobby');
  });

  it('joins an existing lobby without resetting its round (selectChannel)', async () => {
    await seedGuild();
    await seedChannel('spinning');
    await admin.doc(`channels/${CHANNEL_ID}`).update({ sittingOut: ['1005'] });
    await allowed(ensureLobby(db, CHANNEL_ID, 'Lobby', GUILD_ID));
    const lobby = await admin.doc(`channels/${CHANNEL_ID}`).get();
    expect(lobby.get('status')).toBe('spinning');
    expect(lobby.get('groups')).toHaveLength(1);
    expect(lobby.get('sittingOut')).toEqual(['1005']);
    expect(lobby.get('members')).toHaveLength(5);
  });

  it('allows a full round: spin, reveal, finish (from every client), new round', async () => {
    await seedGuild();
    await seedChannel('lobby');
    await expect(startSpin(db, CHANNEL_ID, PLAYERS, 'season-1')).resolves.toBe(true);
    await allowed(updateDoc(channelRef(), { revealedGroups: 1 }));
    await allowed(updateDoc(channelRef(), { status: 'completed' }));
    await allowed(updateDoc(channelRef(), { status: 'completed' }));
    await allowed(updateDoc(channelRef(), lobbyReset()));
  });

  it('allows cancelling a spin back to the lobby (cancelToLobby)', async () => {
    await seedGuild();
    await seedChannel('spinning');
    await allowed(updateDoc(channelRef(), lobbyReset()));
  });

  it('allows claiming a player and sitting out (setSittingOut)', async () => {
    await seedGuild();
    await seedChannel('lobby');
    await allowed(updateDoc(channelRef(), { claimedPlayers: arrayUnion('1001') }));
    await allowed(updateDoc(channelRef(), { claimedPlayers: arrayRemove('1001') }));
    await allowed(updateDoc(channelRef(), { sittingOut: arrayUnion('1002') }));
    await allowed(updateDoc(channelRef(), { sittingOut: arrayRemove('1002') }));
  });

  describe('a spin (requestSpin)', () => {
    const guildDoc = () => admin.doc(`guilds/${GUILD_ID}`).get();
    const lobbyGroups = async () => (await admin.doc(`channels/${CHANNEL_ID}`).get()).get('groups') as WoWGroupDict[];
    const pairsOf = (groups: WoWGroupDict[]) => bumpPairCounts({}, groups.map((g) => WoWGroup.fromDict(g)));

    it('starts the round with its history and season pairs in one write', async () => {
      await seedGuild();
      await seedChannel('lobby');
      await expect(startSpin(db, CHANNEL_ID, PLAYERS, 'season-1')).resolves.toBe(true);

      const groups = await lobbyGroups();
      expect(groups).toHaveLength(1);
      const guild = await guildDoc();
      expect(guild.get('groupHistory.date')).toBe(todayPST());
      expect(decodeGroupHistoryRounds(guild.get('groupHistory.rounds'))).toEqual([groups]);
      expect(guild.get('seasonPairs')).toEqual({ seasonSlug: 'season-1', counts: pairsOf(groups) });
    });

    it("adds to today's history and this season's pairs", async () => {
      await seedGuild({
        groupHistory: { date: todayPST(), rounds: encodeGroupHistoryRounds([[GROUP]]) },
        seasonPairs: { seasonSlug: 'season-1', counts: { 'Other|Pair': 2, 'Healone|Tankone': 4 } },
      });
      await seedChannel('lobby');
      await startSpin(db, CHANNEL_ID, PLAYERS, 'season-1');

      const groups = await lobbyGroups();
      const guild = await guildDoc();
      expect(decodeGroupHistoryRounds(guild.get('groupHistory.rounds'))).toEqual([[GROUP], groups]);
      expect(guild.get('seasonPairs.counts')).toEqual({ ...pairsOf(groups), 'Other|Pair': 2, 'Healone|Tankone': 5 });
    });

    it("replaces last season's pairs", async () => {
      await seedGuild({ seasonPairs: { seasonSlug: 'season-0', counts: { 'Other|Pair': 9 } } });
      await seedChannel('lobby');
      await startSpin(db, CHANNEL_ID, PLAYERS, 'season-1');

      expect((await guildDoc()).get('seasonPairs')).toEqual({ seasonSlug: 'season-1', counts: pairsOf(await lobbyGroups()) });
    });

    it('keeps sitting-out players out, and a debug lobby out of the season pairs', async () => {
      await seedGuild();
      await seedChannel('lobby');
      await admin.doc(`channels/${CHANNEL_ID}`).update({ sittingOut: ['1005'], isDebug: true });
      await startSpin(db, CHANNEL_ID, PLAYERS, 'season-1');

      const placed = (await lobbyGroups()).flatMap((g) => [g.tank, g.healer, ...g.dps]).filter((p) => p !== null);
      expect(placed.map((p) => p.discordId)).not.toContain('1005');
      const guild = await guildDoc();
      expect(guild.get('groupHistory')).toBeDefined();
      expect(guild.get('seasonPairs')).toBeUndefined();
    });

    it('starts nothing over a round in progress (a second Spin click)', async () => {
      await seedGuild();
      await seedChannel('spinning');
      await expect(startSpin(db, CHANNEL_ID, PLAYERS, 'season-1')).resolves.toBe(false);

      expect(await lobbyGroups()).toEqual([GROUP]);
      expect((await guildDoc()).get('groupHistory')).toBeUndefined();
    });
  });

  it('rejects a second spin over a round in progress', async () => {
    await seedGuild();
    await seedChannel('spinning');
    await denied(updateDoc(channelRef(), { status: 'spinning', groups: [GROUP, GROUP], revealedGroups: 0 }));
  });

  it('rejects skipping or reversing a round', async () => {
    await seedGuild();
    await seedChannel('lobby');
    await denied(updateDoc(channelRef(), { status: 'completed' }));
    await seedChannel('completed');
    await denied(updateDoc(channelRef(), { status: 'spinning', groups: [GROUP] }));
  });

  it('rejects clients writing the lobby members, even empty', async () => {
    await seedGuild();
    await seedChannel('lobby');
    await denied(updateDoc(channelRef(), { members: [{ discordId: '1001', name: 'Tankone' }] }));
    await denied(updateDoc(channelRef(), { members: [] }));
    await denied(setDoc(doc(db, 'channels', '200000000000000009'), {
      channelId: '200000000000000009',
      guildId: GUILD_ID,
      status: 'lobby',
      members: [],
    }));
  });

  it('rejects clients setting or clearing the TTL expiry', async () => {
    await seedGuild();
    await seedChannel('lobby');
    await denied(updateDoc(channelRef(), { expireAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) }));
    await denied(updateDoc(channelRef(), { expireAt: null }));
    await denied(setDoc(doc(db, 'channels', '200000000000000009'), {
      channelId: '200000000000000009',
      guildId: GUILD_ID,
      status: 'lobby',
      expireAt: new Date(),
    }));
  });

  it('rejects the retired players and refreshPlayers fields', async () => {
    await seedGuild();
    await seedChannel('lobby');
    await denied(updateDoc(channelRef(), { players: [] }));
    await denied(updateDoc(channelRef(), { refreshPlayers: true }));
  });

  it('rejects moving a lobby to another guild, unknown fields and unsigned clients', async () => {
    await seedGuild();
    await seedChannel('lobby');
    await denied(updateDoc(channelRef(), { guildId: '999' }));
    await denied(updateDoc(channelRef(), { hacked: true }));
    await denied(updateDoc(doc(client(null), 'channels', CHANNEL_ID), { claimedPlayers: arrayUnion('1001') }));
  });

  it('rejects a lobby for a guild that does not exist', async () => {
    await denied(setDoc(channelRef(), {
      channelId: CHANNEL_ID,
      channelName: '',
      guildId: GUILD_ID,
      status: 'lobby',
      groups: [],
    }));
  });
});

describe('preferences', () => {
  const prefRef = (id = PLAYER_ID) => doc(db, 'preferences', id);

  it('allows saving every role the activity offers (saveRoles)', async () => {
    await allowed(setDoc(prefRef(), {
      roles: [...ALL_ROLES],
      inGameName: 'Tankone-Stormrage',
      updatedAt: serverTimestamp(),
    }, { merge: true }));
  });

  it('allows linking a character of every class (saveLinkedCharacter)', async () => {
    for (const characterClass of CHARACTER_CLASSES) {
      await allowed(setDoc(prefRef(), {
        linkedCharacter: { name: 'Tankone', realm: 'stormrage', region: 'us' },
        updatedAt: serverTimestamp(),
        mediaUrl: 'https://render.worldofwarcraft.com/us/character/stormrage/1/1001-avatar.jpg?v=1',
        mediaUrlUpdatedAt: serverTimestamp(),
        characterClass,
      }, { merge: true }));
    }
    await allowed(setDoc(prefRef(), {
      linkedCharacter: { name: 'Tankone', realm: 'stormrage', region: 'us' },
      updatedAt: serverTimestamp(),
      mediaUrl: null,
      mediaUrlUpdatedAt: serverTimestamp(),
      characterClass: null,
    }, { merge: true }));
  });

  it('allows updating roles on a doc that has fields clients never write', async () => {
    await admin.doc(`preferences/${PLAYER_ID}`).set({ roles: ['Tank'], wowName: 'Legacy', legacyField: 'kept' });
    await allowed(setDoc(prefRef(), { roles: ['Healer'], inGameName: '', updatedAt: serverTimestamp() }, { merge: true }));
  });

  it('rejects unknown roles, off-CDN portraits and unknown fields', async () => {
    await denied(setDoc(prefRef(), { roles: ['Admin'], updatedAt: serverTimestamp() }, { merge: true }));
    await denied(setDoc(prefRef(), { mediaUrl: 'https://example.com/face.jpg' }, { merge: true }));
    await denied(setDoc(prefRef(), { characterClass: 'Bard' }, { merge: true }));
    await denied(setDoc(prefRef(), { isAdmin: true }, { merge: true }));
    await denied(setDoc(prefRef(), { wowName: 'Retired' }, { merge: true }));
  });

  it('rejects non-Discord IDs, deletes and unsigned clients', async () => {
    await denied(setDoc(prefRef('someone'), { roles: ['Tank'] }));
    await admin.doc(`preferences/${PLAYER_ID}`).set({ roles: ['Tank'] });
    await denied(deleteDoc(prefRef()));
    await denied(setDoc(doc(client(null), 'preferences', PLAYER_ID), { roles: ['Tank'] }, { merge: true }));
  });
});

describe('badGroupReports', () => {
  const report = (overrides: Record<string, unknown> = {}) => ({
    title: 'Two tanks in one group',
    description: 'Tankone and Tanktwo both landed in group 1.',
    reporterName: 'Healone',
    reporterId: '1002',
    guildId: GUILD_ID,
    players: [tank, healer, ...dps],
    groups: [GROUP],
    priorRounds: encodeGroupHistoryRounds([]),
    createdAt: serverTimestamp(),
    ...overrides,
  });

  it('allows filing a report (reportBadGroup)', async () => {
    await seedGuild();
    await allowed(addDoc(collection(db, 'badGroupReports'), report()));
  });

  it('rejects reports for unknown guilds, extra fields and reads', async () => {
    await denied(addDoc(collection(db, 'badGroupReports'), report()));
    await seedGuild();
    await denied(addDoc(collection(db, 'badGroupReports'), report({ labels: ['urgent'] })));
    await admin.doc('badGroupReports/r1').set(report({ createdAt: new Date() }));
    await denied(getDoc(doc(db, 'badGroupReports', 'r1')));
  });
});

describe('server-only collections', () => {
  it('rejects client writes to config, rate limits, the character cache and issue tracking', async () => {
    await denied(setDoc(doc(db, 'config', 'affixes'), { affixes: [] }));
    await denied(setDoc(doc(db, 'rateLimits', 'x_lookupCharacter'), { count: 0 }));
    await denied(setDoc(doc(db, 'characterCache', 'us:stormrage:tankone'), { result: {} }));
    await denied(setDoc(doc(db, 'issueTracking', '1'), { discordUserId: PLAYER_ID }));
  });
});
