import { createRequire } from 'node:module';
import logger from './logger.js';
import * as config from './config.js';

// Sentinel for Firestore server timestamps.
// Replaced with FieldValue.serverTimestamp() at initialization time.
export const SERVER_TIMESTAMP = { __sentinel: 'serverTimestamp' } as const;

// Firebase Admin SDK types — imported dynamically to allow mocking
type FirebaseDb = {
  collection: (name: string) => FirebaseCollection;
  batch: () => FirebaseBatch;
};

type FirebaseCollection = {
  doc: (id: string) => FirebaseDocRef;
  where: (field: string, op: string, value: unknown) => FirebaseQuery;
  get: () => Promise<{ docs: FirebaseDocSnapshot[] }>;
  onSnapshot: (callback: (...args: unknown[]) => void) => unknown;
};

type FirebaseQuery = {
  get: () => Promise<{ docs: FirebaseDocSnapshot[] }>;
};

type FirebaseDocRef = {
  get: () => Promise<FirebaseDocSnapshot>;
  set: (data: Record<string, unknown>) => Promise<void>;
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
    guildId: number,
    guildName?: string,
    guildIconUrl?: string,
  ): Promise<string>;
  updateGuildDoc(guildId: string, data: Record<string, unknown>): Promise<void>;
  deleteGuildDoc(guildId: string): Promise<void>;
  getOrCreateChannelDoc(
    channelId: number,
    guildId: number,
    channelName: string,
    debug?: boolean,
  ): Promise<string>;
  updateChannelDoc(channelId: string, data: Record<string, unknown>): Promise<void>;
  deleteChannelDoc(channelId: string): Promise<void>;
  deleteOldDocs(collection: string, seconds: number): Promise<number>;
  deleteAllInCollection(collection: string): Promise<number>;
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
        // App already initialized
      }
      this.db = admin.firestore() as FirebaseDb;
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
    guildId: number,
    guildName?: string,
    guildIconUrl?: string,
  ): Promise<string> {
    if (!this.db) throw new Error('Firebase is not initialized.');

    const docId = String(guildId);
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
    channelId: number,
    guildId: number,
    channelName: string,
    debug = false,
  ): Promise<string> {
    if (!this.db) throw new Error('Firebase is not initialized.');

    const docId = String(channelId);
    const docRef = this.db.collection('channels').doc(docId);

    const doc = await docRef.get();
    if (!doc.exists) {
      await docRef.set({
        channelId: docId,
        channelName,
        guildId: String(guildId),
        status: 'lobby',
        players: [],
        groups: [],
        isDebug: debug,
        announceResults: true,
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

  // Collection Operations

  async deleteOldDocs(collection: string, seconds: number): Promise<number> {
    if (!this.db) return 0;

    const db = this.db;
    const cutoff = new Date(Date.now() - seconds * 1000);

    const snapshot = await db.collection(collection).where('lastActive', '<', cutoff).get();
    let batch = db.batch();
    let count = 0;

    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
      count++;
      if (count % 500 === 0) {
        await batch.commit();
        batch = db.batch();
      }
    }

    if (count % 500 !== 0) {
      await batch.commit();
    }

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

    let batch = db.batch();
    let count = 0;

    for (const docSnap of snapshot.docs) {
      batch.delete(docSnap.ref);
      count++;
      if (count % 500 === 0) {
        await batch.commit();
        batch = db.batch();
      }
    }

    if (count % 500 !== 0) {
      await batch.commit();
    }

    if (count > 0) {
      logger.info(`Deleted all ${count} doc(s) from ${collection} collection`);
    }

    return count;
  }
}
