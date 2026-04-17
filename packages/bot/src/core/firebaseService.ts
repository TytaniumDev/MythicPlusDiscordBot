import { createRequire } from 'node:module';
import logger from './logger.js';
import * as config from './config.js';
import type { AffixDisplay } from '@mythicplus/shared';

// Sentinel for Firestore server timestamps.
// Replaced with FieldValue.serverTimestamp() at initialization time.
export let SERVER_TIMESTAMP: unknown = { __sentinel: 'serverTimestamp' };

// Sentinel for Firestore field deletion.
// Replaced with FieldValue.delete() at initialization time.
export let DELETE_FIELD: unknown = null;

// Atomic array operations.
// Replaced with FieldValue.arrayUnion/arrayRemove at initialization time.
export let ARRAY_UNION: (...elements: unknown[]) => unknown = (...elements) => elements;
export let ARRAY_REMOVE: (...elements: unknown[]) => unknown = (...elements) => elements;

// Firebase Admin SDK types — imported dynamically to allow mocking
type FirebaseDb = {
  collection: (name: string) => FirebaseCollection;
  batch: () => FirebaseBatch;
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
  deleteGuildDoc(guildId: string): Promise<void>;
  getAffixes(): Promise<AffixDisplay[] | null>;
  getGroupHistory(guildId: string): Promise<{ date: string; rounds: Record<string, unknown>[][] } | null>;
  saveGroupHistory(guildId: string, history: { date: string; rounds: Record<string, unknown>[][] }): Promise<void>;
  getOrCreateChannelDoc(
    channelId: string,
    guildId: string,
    channelName: string,
    debug?: boolean,
  ): Promise<string>;
  updateChannelDoc(channelId: string, data: Record<string, unknown>): Promise<void>;
  deleteChannelDoc(channelId: string): Promise<void>;
  deleteOldDocs(collection: string, seconds: number): Promise<number>;
  deleteAllInCollection(collection: string): Promise<number>;
  listenForBadGroupReports(
    callback: (docId: string, data: Record<string, unknown>) => void,
  ): { unsubscribe(): void } | null;
  listenForGuildRefreshRequests(
    callback: (guildId: string, data: Record<string, unknown>) => void,
  ): { unsubscribe(): void } | null;
  listenForChannelPlayerRefreshRequests(
    callback: (channelId: string, data: Record<string, unknown>) => void,
  ): { unsubscribe(): void } | null;
  deleteDoc(collectionName: string, docId: string): Promise<void>;
  listenForChannelRemovedDocs(
    callback: (docId: string) => void,
  ): { unsubscribe(): void } | null;
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
      ARRAY_UNION = (...elements: unknown[]) => admin.firestore.FieldValue.arrayUnion(...elements);
      ARRAY_REMOVE = (...elements: unknown[]) => admin.firestore.FieldValue.arrayRemove(...elements);
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

  async deleteGuildDoc(guildId: string): Promise<void> {
    if (!this.db) return;
    const docRef = this.db.collection('guilds').doc(guildId);
    await docRef.delete();
    logger.debug(`Deleted guild doc ${guildId} from Firestore`);
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
        players: [],
        groups: [],
        isDebug: debug,
        createdAt: SERVER_TIMESTAMP,
        lastActive: SERVER_TIMESTAMP,
      });
    } else {
      await docRef.update({
        lastActive: SERVER_TIMESTAMP,
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
        logger.error(`Bad group report listener error: ${errArgs[0]}`);
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
        logger.error(`Guild refresh listener error: ${errArgs[0]}`);
      },
    );

    return { unsubscribe: unsubscribe as () => void };
  }

  listenForChannelPlayerRefreshRequests(
    callback: (channelId: string, data: Record<string, unknown>) => void,
  ): { unsubscribe(): void } | null {
    if (!this.db) return null;

    const collectionRef = this.db.collection('channels');

    const unsubscribe = collectionRef.onSnapshot(
      (...args: unknown[]) => {
        const snapshot = args[0] as { docChanges(): { type: string; doc: FirebaseDocSnapshot }[] };
        for (const change of snapshot.docChanges()) {
          if (change.type === 'added' || change.type === 'modified') {
            const data = change.doc.data();
            if (data && data.refreshPlayers) {
              callback(change.doc.id, data);
            }
          }
        }
      },
      (...errArgs: unknown[]) => {
        logger.error(`Channel player refresh listener error: ${errArgs[0]}`);
      },
    );

    return { unsubscribe: unsubscribe as () => void };
  }

  /**
   * Fetches the current Mythic+ affix data from Firestore.
   *
   * @returns An array of AffixDisplay objects if successful, or null if the
   * database is unavailable or the document does not exist/is invalid.
   */
  async getAffixes(): Promise<AffixDisplay[] | null> {
    if (!this.db) return null;
    try {
      const snap = await this.db.collection('config').doc('affixes').get();
      if (snap.exists) {
        const data = snap.data();
        if (data && Array.isArray(data.affixes)) {
          return data.affixes as AffixDisplay[];
        }
      }
      return null;
    } catch (e) {
      logger.warn(`Failed to fetch affixes from Firestore: ${e}`);
      return null;
    }
  }

  async getGroupHistory(guildId: string): Promise<{ date: string; rounds: Record<string, unknown>[][] } | null> {
    if (!this.db) return null;
    const docRef = this.db.collection('guilds').doc(guildId);
    const doc = await docRef.get();
    if (!doc.exists) return null;
    const data = doc.data();
    const raw = data?.groupHistory as { date: string; rounds: unknown[] } | undefined;
    if (!raw) return null;
    // Wire format wraps each round as { groups: [...] } because Firestore rejects
    // nested arrays. Tolerate the legacy flat shape in case older data exists.
    const rounds = (raw.rounds ?? []).map((r) => {
      if (r && typeof r === 'object' && 'groups' in r && Array.isArray((r as { groups: unknown }).groups)) {
        return (r as { groups: Record<string, unknown>[] }).groups;
      }
      return Array.isArray(r) ? (r as Record<string, unknown>[]) : [];
    });
    return { date: raw.date, rounds };
  }

  async saveGroupHistory(guildId: string, history: { date: string; rounds: Record<string, unknown>[][] }): Promise<void> {
    if (!this.db) return;
    const docRef = this.db.collection('guilds').doc(guildId);
    // Wrap each round as { groups: [...] } — Firestore rejects nested arrays.
    const wireRounds = history.rounds.map((round) => ({ groups: round }));
    await docRef.set(
      { groupHistory: { date: history.date, rounds: wireRounds } },
      { merge: true },
    );
  }

  async deleteDoc(collectionName: string, docId: string): Promise<void> {
    if (!this.db) return;
    const docRef = this.db.collection(collectionName).doc(docId);
    await docRef.delete();
  }

  listenForChannelRemovedDocs(
    callback: (docId: string) => void,
  ): { unsubscribe(): void } | null {
    if (!this.db) return null;

    const collectionRef = this.db.collection('channels');

    const unsubscribe = collectionRef.onSnapshot(
      (...args: unknown[]) => {
        const snapshot = args[0] as { docChanges(): { type: string; doc: FirebaseDocSnapshot }[] };
        for (const change of snapshot.docChanges()) {
          if (change.type === 'removed') {
            callback(change.doc.id);
          }
        }
      },
      (...errArgs: unknown[]) => {
        logger.error(`Channel removed listener error: ${errArgs[0]}`);
      },
    );

    return { unsubscribe: unsubscribe as () => void };
  }

  // Collection Operations

  /**
   * Helper method to delete documents in batches of 500.
   *
   * @param docs - Array of FirebaseDocSnapshot to delete.
   * @returns Total count of documents deleted.
   */
  private async _deleteDocumentsInBatches(docs: FirebaseDocSnapshot[]): Promise<number> {
    if (!this.db || docs.length === 0) return 0;

    let batch = this.db.batch();
    let count = 0;
    const promises: Promise<unknown>[] = [];

    for (const doc of docs) {
      batch.delete(doc.ref);
      count++;
      if (count % 500 === 0) {
        promises.push(batch.commit());
        batch = this.db.batch();
      }
    }

    if (count % 500 !== 0) {
      promises.push(batch.commit());
    }

    await Promise.all(promises);
    return count;
  }

  async deleteOldDocs(collection: string, seconds: number): Promise<number> {
    if (!this.db) return 0;

    const db = this.db;
    const cutoff = new Date(Date.now() - seconds * 1000);

    const snapshot = await db.collection(collection).where('lastActive', '<', cutoff).get();
    const count = await this._deleteDocumentsInBatches(snapshot.docs);

    if (count > 0) {
      logger.info(
        `Deleted ${count} old doc(s) from ${collection} (older than ${seconds} seconds)`,
      );
    }

    return count;
  }

  async deleteAllInCollection(collection: string): Promise<number> {
    if (!this.db) return 0;

    const db = this.db;
    const snapshot = await db.collection(collection).get();
    const count = await this._deleteDocumentsInBatches(snapshot.docs);

    if (count > 0) {
      logger.info(`Deleted all ${count} doc(s) from ${collection} collection`);
    }

    return count;
  }
}
