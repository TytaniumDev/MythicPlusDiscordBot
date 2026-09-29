import { createRequire } from 'node:module';
import {
  decodeGroupHistoryRounds,
  encodeGroupHistoryRounds,
  parsePlayerPreferences,
  parseSeasonPairs,
  type LobbyMember,
  type PlayerPreferences,
  type WoWGroupDict,
} from '@mythicplus/shared';
import logger from './logger.js';
import { reportError } from './sentry.js';
import * as config from './config.js';

// Sentinel for Firestore server timestamps.
// Replaced with FieldValue.serverTimestamp() at initialization time.
export let SERVER_TIMESTAMP: unknown = { __sentinel: 'serverTimestamp' };

// Sentinel for Firestore field deletion.
// Replaced with FieldValue.delete() at initialization time.
export let DELETE_FIELD: unknown = null;

/**
 * A lobby the bot hasn't written to for this long is deleted by the
 * `channels.expireAt` TTL policy (firestore.indexes.json). The bot writes
 * `members` on every voice change and for every lobby when it starts.
 */
const LOBBY_TTL_MS = 24 * 60 * 60 * 1000;

/** `lastActive` plus the TTL expiry, stamped on every bot write to a lobby. */
function lobbyActivity(): { lastActive: unknown; expireAt: Date } {
  return { lastActive: SERVER_TIMESTAMP, expireAt: new Date(Date.now() + LOBBY_TTL_MS) };
}

// Firebase Admin SDK types — imported dynamically to allow mocking
type FirebaseDb = {
  collection: (name: string) => FirebaseCollection;
  batch: () => FirebaseBatch;
  getAll: (...refs: FirebaseDocRef[]) => Promise<FirebaseDocSnapshot[]>;
};

type FirebaseCollection = {
  doc: (id: string) => FirebaseDocRef;
  where: (field: string, op: string, value: unknown) => FirebaseQuery;
  get: () => Promise<{ docs: FirebaseDocSnapshot[] }>;
  onSnapshot: (callback: (...args: unknown[]) => void, onError?: (...args: unknown[]) => void) => unknown;
};

type FirebaseQuery = {
  get: () => Promise<{ docs: FirebaseDocSnapshot[] }>;
};

type FirebaseDocRef = {
  get: () => Promise<FirebaseDocSnapshot>;
  set: (data: Record<string, unknown>, options?: { merge?: boolean }) => Promise<void>;
  update: (data: Record<string, unknown>) => Promise<void>;
  delete: () => Promise<void>;
  onSnapshot: (callback: (...args: unknown[]) => void) => unknown;
};

type FirebaseDocSnapshot = {
  exists: boolean;
  id: string;
  ref: FirebaseDocRef;
  data: () => Record<string, unknown> | null;
};

type FirebaseBatch = {
  delete: (ref: FirebaseDocRef) => void;
  commit: () => Promise<void>;
};

export interface IFirebaseService {
  db: FirebaseDb | null;
  isAvailable(): boolean;
  getOrCreateGuildDoc(
    guildId: string,
    guildName?: string,
    guildIconUrl?: string,
  ): Promise<string>;
  updateGuildDoc(guildId: string, data: Record<string, unknown>): Promise<void>;
  getGroupHistory(guildId: string): Promise<{ date: string; rounds: WoWGroupDict[][] } | null>;
  saveGroupHistory(guildId: string, history: { date: string; rounds: WoWGroupDict[][] }): Promise<void>;
  getSeasonConfig(): Promise<{ slug: string; blizzardSeasonId: number; expansionId: number } | null>;
  getSeasonPairs(guildId: string): Promise<{ seasonSlug: string; counts: Record<string, number> } | null>;
  saveSeasonPairs(guildId: string, pairs: { seasonSlug: string; counts: Record<string, number> }): Promise<void>;
  getOrCreateChannelDoc(
    channelId: string,
    guildId: string,
    channelName: string,
    debug?: boolean,
  ): Promise<string>;
  updateChannelDoc(channelId: string, data: Record<string, unknown>): Promise<void>;
  setChannelMembers(channelId: string, members: LobbyMember[]): Promise<void>;
  deleteChannelDoc(channelId: string): Promise<void>;
  getPreferences(discordIds: string[]): Promise<Map<string, PlayerPreferences>>;
  listenForBadGroupReports(
    callback: (docId: string, data: Record<string, unknown>) => void,
  ): { unsubscribe(): void } | null;
  listenForGuildRefreshRequests(
    callback: (guildId: string, data: Record<string, unknown>) => void,
  ): { unsubscribe(): void } | null;
  listenForChannels(handlers: ChannelListenerHandlers): { unsubscribe(): void } | null;
  deleteDoc(collectionName: string, docId: string): Promise<void>;
}

export interface ChannelListenerHandlers {
  /** A lobby doc appeared (including every existing doc when the listener starts). */
  onAdded(channelId: string, data: Record<string, unknown>): void;
  onRemoved(channelId: string): void;
}

let instance: FirebaseService | null = null;

export class FirebaseService implements IFirebaseService {
  db: FirebaseDb | null = null;

  constructor() {
    this._initializeFirebase();
  }

  static getInstance(): FirebaseService {
    if (!instance) {
      instance = new FirebaseService();
    }
    return instance;
  }

  private _initializeFirebase(): void {
    try {
      if (!config.FIREBASE_CREDENTIALS_JSON) {
        logger.warn(
          'FIREBASE_CREDENTIALS_JSON not set. Firebase features will be disabled.',
        );
        return;
      }

      let credDict: Record<string, unknown>;
      try {
        credDict = JSON.parse(config.FIREBASE_CREDENTIALS_JSON) as Record<
          string,
          unknown
        >;
      } catch {
        logger.error(
          'Failed to parse FIREBASE_CREDENTIALS_JSON. Ensure the JSON is valid.',
        );
        this.db = null;
        return;
      }

      // Use createRequire for CJS interop in ESM context
      const esmRequire = createRequire(import.meta.url);
      const admin = esmRequire('firebase-admin');
      const cert = admin.credential.cert(credDict);
      try {
        admin.initializeApp({ credential: cert });
      } catch {
        // intentional: initializeApp throws if called twice (e.g. in tests
        // that import this module multiple times). Reusing the existing
        // default app is the desired behavior.
        void 0;
      }
      this.db = admin.firestore() as FirebaseDb;
      SERVER_TIMESTAMP = admin.firestore.FieldValue.serverTimestamp();
      DELETE_FIELD = admin.firestore.FieldValue.delete();
      logger.info('Firebase initialized successfully.');
    } catch (e) {
      const errType = e instanceof Error ? e.constructor.name : String(e);
      logger.error(`Failed to initialize Firebase: ${errType}`);
      this.db = null;
    }
  }

  isAvailable(): boolean {
    return this.db !== null;
  }

  // Guild Doc Operations

  async getOrCreateGuildDoc(
    guildId: string,
    guildName?: string,
    guildIconUrl?: string,
  ): Promise<string> {
    if (!this.db) throw new Error('Firebase is not initialized.');

    const docId = guildId;
    const docRef = this.db.collection('guilds').doc(docId);

    const guildFields: Record<string, unknown> = {};
    if (guildName !== undefined) guildFields.guildName = guildName;
    if (guildIconUrl !== undefined) guildFields.guildIconUrl = guildIconUrl;

    const doc = await docRef.get();
    if (!doc.exists) {
      await docRef.set({
        guildId: docId,
        voiceChannels: [],
        createdAt: SERVER_TIMESTAMP,
        lastActive: SERVER_TIMESTAMP,
        ...guildFields,
      });
    } else {
      await docRef.update({
        lastActive: SERVER_TIMESTAMP,
        ...guildFields,
      });
    }

    return docId;
  }

  async updateGuildDoc(guildId: string, data: Record<string, unknown>): Promise<void> {
    if (!this.db) return;
    const docRef = this.db.collection('guilds').doc(guildId);
    await docRef.update(data);
  }

  // Channel Doc Operations

  async getOrCreateChannelDoc(
    channelId: string,
    guildId: string,
    channelName: string,
    debug = false,
  ): Promise<string> {
    if (!this.db) throw new Error('Firebase is not initialized.');

    const docId = channelId;
    const docRef = this.db.collection('channels').doc(docId);

    const doc = await docRef.get();
    if (!doc.exists) {
      await docRef.set({
        channelId: docId,
        channelName,
        guildId,
        status: 'lobby',
        members: [],
        groups: [],
        isDebug: debug,
        createdAt: SERVER_TIMESTAMP,
        ...lobbyActivity(),
      });
    } else {
      await docRef.update({
        ...lobbyActivity(),
        status: 'lobby',
        groups: [],
        isDebug: debug,
      });
    }

    return docId;
  }

  async updateChannelDoc(
    channelId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    if (!this.db) return;
    const docRef = this.db.collection('channels').doc(channelId);
    await docRef.update(data);
  }

  /**
   * Write a lobby's voice membership and push out its expiry. Only the bot
   * writes `members` and `expireAt` (firestore.rules reject client writes).
   */
  async setChannelMembers(channelId: string, members: LobbyMember[]): Promise<void> {
    await this.updateChannelDoc(channelId, { members, ...lobbyActivity() });
  }

  /**
   * Read the preferences docs for these players. Players without a doc are
   * absent from the returned map.
   */
  async getPreferences(discordIds: string[]): Promise<Map<string, PlayerPreferences>> {
    const prefs = new Map<string, PlayerPreferences>();
    if (!this.db || discordIds.length === 0) return prefs;
    const collection = this.db.collection('preferences');
    const snaps = await this.db.getAll(...discordIds.map((id) => collection.doc(id)));
    for (const snap of snaps) {
      if (snap.exists) prefs.set(snap.id, parsePlayerPreferences(snap.data()));
    }
    return prefs;
  }

  async deleteChannelDoc(channelId: string): Promise<void> {
    if (!this.db) return;
    const docRef = this.db.collection('channels').doc(channelId);
    await docRef.delete();
    logger.debug(`Deleted channel doc ${channelId} from Firestore`);
  }

  // Bad Group Report Listener

  listenForBadGroupReports(
    callback: (docId: string, data: Record<string, unknown>) => void,
  ): { unsubscribe(): void } | null {
    if (!this.db) return null;

    const collectionRef = this.db.collection('badGroupReports');
    const unsubscribe = collectionRef.onSnapshot(
      (...args: unknown[]) => {
        const snapshot = args[0] as { docChanges(): { type: string; doc: FirebaseDocSnapshot }[] };
        for (const change of snapshot.docChanges()) {
          if (change.type === 'added') {
            const data = change.doc.data();
            if (data) {
              callback(change.doc.id, data);
            }
          }
        }
      },
      (...errArgs: unknown[]) => {
        reportError(errArgs[0], { tags: { handler: 'firebaseService.badGroupReportListener' } });
      },
    );

    return { unsubscribe: unsubscribe as () => void };
  }

  listenForGuildRefreshRequests(
    callback: (guildId: string, data: Record<string, unknown>) => void,
  ): { unsubscribe(): void } | null {
    if (!this.db) return null;

    const collectionRef = this.db.collection('guilds');

    const unsubscribe = collectionRef.onSnapshot(
      (...args: unknown[]) => {
        const snapshot = args[0] as { docChanges(): { type: string; doc: FirebaseDocSnapshot }[] };
        for (const change of snapshot.docChanges()) {
          if (change.type === 'added' || change.type === 'modified') {
            const data = change.doc.data();
            if (data && data.refreshRequest) {
              callback(change.doc.id, data);
            }
          }
        }
      },
      (...errArgs: unknown[]) => {
        reportError(errArgs[0], { tags: { handler: 'firebaseService.guildRefreshListener' } });
      },
    );

    return { unsubscribe: unsubscribe as () => void };
  }

  async getGroupHistory(guildId: string): Promise<{ date: string; rounds: WoWGroupDict[][] } | null> {
    if (!this.db) return null;
    const docRef = this.db.collection('guilds').doc(guildId);
    const doc = await docRef.get();
    if (!doc.exists) return null;
    const data = doc.data();
    const raw = data?.groupHistory as { date: string; rounds: unknown[] } | undefined;
    if (!raw) return null;
    const rounds = decodeGroupHistoryRounds(raw.rounds ?? []);
    return { date: raw.date, rounds };
  }

  async saveGroupHistory(guildId: string, history: { date: string; rounds: WoWGroupDict[][] }): Promise<void> {
    if (!this.db) return;
    const docRef = this.db.collection('guilds').doc(guildId);
    const wireRounds = encodeGroupHistoryRounds(history.rounds);
    await docRef.set(
      { groupHistory: { date: history.date, rounds: wireRounds } },
      { merge: true },
    );
  }

  async getSeasonConfig(): Promise<{ slug: string; blizzardSeasonId: number; expansionId: number } | null> {
    if (!this.db) return null;
    const docRef = this.db.collection('config').doc('season');
    const doc = await docRef.get();
    if (!doc.exists) return null;
    const data = doc.data() ?? {};
    if (
      typeof data.slug !== 'string' ||
      typeof data.blizzardSeasonId !== 'number' ||
      typeof data.expansionId !== 'number'
    ) {
      return null;
    }
    return {
      slug: data.slug,
      blizzardSeasonId: data.blizzardSeasonId,
      expansionId: data.expansionId,
    };
  }

  async getSeasonPairs(
    guildId: string,
  ): Promise<{ seasonSlug: string; counts: Record<string, number> } | null> {
    if (!this.db) return null;
    const docRef = this.db.collection('guilds').doc(guildId);
    const doc = await docRef.get();
    if (!doc.exists) return null;
    const data = doc.data() ?? {};
    return parseSeasonPairs(data.seasonPairs);
  }

  async saveSeasonPairs(
    guildId: string,
    pairs: { seasonSlug: string; counts: Record<string, number> },
  ): Promise<void> {
    if (!this.db) return;
    const docRef = this.db.collection('guilds').doc(guildId);
    await docRef.set({ seasonPairs: pairs }, { merge: true });
  }

  async deleteDoc(collectionName: string, docId: string): Promise<void> {
    if (!this.db) return;
    const docRef = this.db.collection(collectionName).doc(docId);
    await docRef.delete();
  }

  /**
   * Follow the set of lobby docs. `added` fires for every existing doc when the
   * listener starts, so the bot rebuilds its lobby tracking after a restart.
   * Modifications are ignored: the bot's own `members` writes would otherwise
   * echo back.
   */
  listenForChannels(handlers: ChannelListenerHandlers): { unsubscribe(): void } | null {
    if (!this.db) return null;

    const collectionRef = this.db.collection('channels');

    const unsubscribe = collectionRef.onSnapshot(
      (...args: unknown[]) => {
        const snapshot = args[0] as { docChanges(): { type: string; doc: FirebaseDocSnapshot }[] };
        for (const change of snapshot.docChanges()) {
          if (change.type === 'added') {
            handlers.onAdded(change.doc.id, change.doc.data() ?? {});
          } else if (change.type === 'removed') {
            handlers.onRemoved(change.doc.id);
          }
        }
      },
      (...errArgs: unknown[]) => {
        reportError(errArgs[0], { tags: { handler: 'firebaseService.channelListener' } });
      },
    );

    return { unsubscribe: unsubscribe as () => void };
  }

  // Collection Operations


}
