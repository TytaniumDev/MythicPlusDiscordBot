/**
 * Integration test: the bot's lobby tracking against the Firestore emulator,
 * with a fake Discord guild standing in for discord.js. Covers the contract
 * the activity relies on: every lobby doc gets its voice `members`, they stay
 * in sync with voice changes, tracking survives a restart, and an emptied
 * lobby is deleted while its guild doc survives.
 *
 * Run via: ./scripts/emulator-test.sh (from repo root)
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import admin from 'firebase-admin';
import { WoWPlayer } from '@mythicplus/shared';
import { FirebaseService } from '../../src/core/firebaseService.js';
import { SessionService, type Bot, type Guild, type VoiceChannel } from '../../src/services/sessionService.js';

const shouldRun = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

const GUILD_ID = '9000';
const CHANNEL_ID = '9001';

type FakeMember = VoiceChannel['members'][number];

function member(id: string, displayName: string, bot = false): FakeMember {
  return { id, nick: displayName, global_name: null, bot, toString: () => displayName };
}

/**
 * A mutable stand-in for the discord.js guild cache. Tests move members
 * between voice channels and then hand the before/after states to the bot,
 * the way main.ts adapts a VoiceStateUpdate event.
 */
class FakeDiscord implements Bot {
  private channels = new Map<string, FakeMember[]>();

  join(channelId: string, m: FakeMember): void {
    this.channels.set(channelId, [...(this.channels.get(channelId) ?? []), m]);
  }

  leave(channelId: string, memberId: string): void {
    this.channels.set(channelId, (this.channels.get(channelId) ?? []).filter((m) => m.id !== memberId));
  }

  voiceState(channelId: string) {
    return { channel: { id: channelId, members: this.channels.get(channelId) ?? [] } };
  }

  get_guild(id: string): Guild | null {
    if (id !== GUILD_ID) return null;
    const toChannel = (channelId: string, members: FakeMember[]): VoiceChannel => ({
      id: channelId,
      name: `Voice ${channelId}`,
      members,
      send: async () => undefined,
    });
    return {
      id,
      name: 'Fake Guild',
      voice_channels: [...this.channels].map(([cid, ms]) => toChannel(cid, ms)),
      get_channel: (cid) => (this.channels.has(cid) ? toChannel(cid, this.channels.get(cid)!) : null),
    };
  }
}

describe.skipIf(!shouldRun)('lobby tracking against the Firestore emulator', () => {
  let db: admin.firestore.Firestore;
  let firebase: FirebaseService;
  let discord: FakeDiscord;
  const listeners: { unsubscribe(): void }[] = [];

  function startBot(): SessionService {
    const service = new SessionService(discord, firebase);
    const listener = service.listen();
    if (listener) listeners.push(listener);
    return service;
  }

  /** Create a lobby the way the activity does: status lobby, no members. */
  async function createLobby(channelId = CHANNEL_ID): Promise<void> {
    await db.collection('channels').doc(channelId).set({
      channelId,
      channelName: 'Mythic+',
      guildId: GUILD_ID,
      status: 'lobby',
      groups: [],
    });
  }

  async function membersOf(channelId = CHANNEL_ID): Promise<unknown> {
    return (await db.collection('channels').doc(channelId).get()).data()?.members;
  }

  async function clear(collection: string): Promise<void> {
    const snap = await db.collection(collection).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }

  beforeAll(() => {
    if (!admin.apps.length) {
      admin.initializeApp({ projectId: 'demo-wheelson-emulator' });
    }
    db = admin.firestore();
    // Same constructor bypass as firestoreWireFormat: the real one wants a
    // service-account credential the emulator doesn't need.
    firebase = Object.create(FirebaseService.prototype);
    (firebase as unknown as { db: admin.firestore.Firestore }).db = db;
  });

  beforeEach(async () => {
    discord = new FakeDiscord();
    await Promise.all(['channels', 'guilds', 'preferences'].map(clear));
  });

  afterEach(() => {
    for (const l of listeners.splice(0)) l.unsubscribe();
  });

  it('publishes voice members when a lobby doc appears', async () => {
    discord.join(CHANNEL_ID, member('1', 'Mr.Tank'));
    discord.join(CHANNEL_ID, member('2', 'Healer'));
    discord.join(CHANNEL_ID, member('3', 'Music', true));
    startBot();

    await createLobby();

    await vi.waitFor(async () => {
      expect(await membersOf()).toEqual([
        { discordId: '1', name: 'MrTank' },
        { discordId: '2', name: 'Healer' },
      ]);
    });
  });

  it('picks up existing lobbies after a restart', async () => {
    discord.join(CHANNEL_ID, member('1', 'Tank'));
    await createLobby();

    // A fresh SessionService has no in-memory state, like a restarted bot.
    const service = startBot();

    await vi.waitFor(async () => {
      expect(await membersOf()).toEqual([{ discordId: '1', name: 'Tank' }]);
    });
    expect(service.activeChannels.get(CHANNEL_ID)).toBe(GUILD_ID);
  });

  it('keeps members in sync as people join and leave voice', async () => {
    discord.join(CHANNEL_ID, member('1', 'Tank'));
    const service = startBot();
    await createLobby();
    await vi.waitFor(async () => expect(await membersOf()).toHaveLength(1));

    const beforeJoin = { channel: null };
    discord.join(CHANNEL_ID, member('2', 'Healer'));
    await service.onVoiceStateUpdate(beforeJoin, discord.voiceState(CHANNEL_ID));
    expect(await membersOf()).toEqual([
      { discordId: '1', name: 'Tank' },
      { discordId: '2', name: 'Healer' },
    ]);

    discord.leave(CHANNEL_ID, '1');
    await service.onVoiceStateUpdate(discord.voiceState(CHANNEL_ID), { channel: null });
    expect(await membersOf()).toEqual([{ discordId: '2', name: 'Healer' }]);
  });

  it('deletes an emptied lobby but never its guild doc', async () => {
    await db.collection('guilds').doc(GUILD_ID).set({ guildId: GUILD_ID, groupHistory: { date: '2026-01-01', rounds: [] } });
    discord.join(CHANNEL_ID, member('1', 'Tank'));
    const service = startBot();
    await createLobby();
    await vi.waitFor(() => expect(service.activeChannels.has(CHANNEL_ID)).toBe(true));

    discord.leave(CHANNEL_ID, '1');
    await service.onVoiceStateUpdate(discord.voiceState(CHANNEL_ID), { channel: null });

    expect((await db.collection('channels').doc(CHANNEL_ID).get()).exists).toBe(false);
    expect((await db.collection('guilds').doc(GUILD_ID).get()).exists).toBe(true);
    expect(service.activeChannels.has(CHANNEL_ID)).toBe(false);
  });

  it('stops tracking a lobby whose doc is deleted elsewhere', async () => {
    discord.join(CHANNEL_ID, member('1', 'Tank'));
    const service = startBot();
    await createLobby();
    await vi.waitFor(() => expect(service.activeChannels.has(CHANNEL_ID)).toBe(true));

    await db.collection('channels').doc(CHANNEL_ID).delete();

    await vi.waitFor(() => expect(service.activeChannels.has(CHANNEL_ID)).toBe(false));
    // A later voice change must not resurrect or write to the gone lobby.
    discord.join(CHANNEL_ID, member('2', 'Healer'));
    await service.onVoiceStateUpdate({ channel: null }, discord.voiceState(CHANNEL_ID));
    expect((await db.collection('channels').doc(CHANNEL_ID).get()).exists).toBe(false);
  });

  it('reads preferences and joins them with members for /wheel', async () => {
    await db.collection('preferences').doc('1').set({
      roles: ['Tank', 'Brez', 'NotARole'],
      inGameName: 'Gazzi-Illidan',
      mediaUrl: 'https://render.worldofwarcraft.com/us/character/x.jpg',
      characterClass: 'Paladin',
      wowName: 'legacy',
    });

    const prefs = await firebase.getPreferences(['1', '2']);

    expect([...prefs.keys()]).toEqual(['1']);
    const tank = WoWPlayer.fromPreferences({ discordId: '1', name: 'Gazzi' }, prefs.get('1') ?? null);
    expect(tank.toDict()).toEqual({
      name: 'Gazzi',
      discordId: '1',
      inGameName: 'Gazzi-Illidan',
      mainRole: 'tank',
      offspecs: [],
      utilities: ['brez'],
      mediaUrl: 'https://render.worldofwarcraft.com/us/character/x.jpg',
      characterClass: 'Paladin',
    });
    const newcomer = WoWPlayer.fromPreferences({ discordId: '2', name: 'New' }, prefs.get('2') ?? null);
    expect(newcomer.hasRoles()).toBe(false);
  });
});
