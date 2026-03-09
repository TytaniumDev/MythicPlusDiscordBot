import logger from './logger.js';
import * as config from './config.js';

// Firebase Admin SDK types — imported dynamically to allow mocking
type FirebaseDb = {
  collection: (name: string) => FirebaseCollection;
  batch: () => FirebaseBatch;
};

type FirebaseCollection = {
  document: (id: string) => FirebaseDocRef;
  where: (field: string, op: string, value: unknown) => FirebaseQuery;
  stream: () => FirebaseDocSnapshot[];
  on_snapshot: (callback: (...args: unknown[]) => void) => unknown;
};

type FirebaseQuery = {
  stream: () => FirebaseDocSnapshot[];
};

type FirebaseDocRef = {
  get: () => FirebaseDocSnapshot;
  set: (data: Record<string, unknown>) => void;
  update: (data: Record<string, unknown>) => void;
  delete: () => void;
  on_snapshot: (callback: (...args: unknown[]) => void) => unknown;
};

type FirebaseDocSnapshot = {
  exists: boolean;
  id: string;
  reference: FirebaseDocRef;
  to_dict: () => Record<string, unknown> | null;
};

type FirebaseBatch = {
  delete: (ref: FirebaseDocRef) => void;
  commit: () => void;
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

      // Dynamic import to avoid issues when firebase-admin is not available
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const admin = require('firebase-admin');
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
    const docRef = this.db.collection('guilds').document(docId);

    const guildFields: Record<string, unknown> = {};
    if (guildName !== undefined) guildFields.guildName = guildName;
    if (guildIconUrl !== undefined) guildFields.guildIconUrl = guildIconUrl;

    const doc = docRef.get();
    if (!doc.exists) {
      docRef.set({
        guildId: docId,
        voiceChannels: [],
        createdAt: 'SERVER_TIMESTAMP',
        lastActive: 'SERVER_TIMESTAMP',
        ...guildFields,
      });
    } else {
      docRef.update({
        lastActive: 'SERVER_TIMESTAMP',
        ...guildFields,
      });
    }

    return docId;
  }

  async updateGuildDoc(guildId: string, data: Record<string, unknown>): Promise<void> {
    if (!this.db) return;
    const docRef = this.db.collection('guilds').document(guildId);
    docRef.update(data);
  }

  async deleteGuildDoc(guildId: string): Promise<void> {
    if (!this.db) return;
    const docRef = this.db.collection('guilds').document(guildId);
    docRef.delete();
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
    const docRef = this.db.collection('channels').document(docId);

    const doc = docRef.get();
    if (!doc.exists) {
      docRef.set({
        channelId: docId,
        channelName,
        guildId: String(guildId),
        status: 'lobby',
        players: [],
        groups: [],
        isDebug: debug,
        announceResults: true,
        createdAt: 'SERVER_TIMESTAMP',
        lastActive: 'SERVER_TIMESTAMP',
      });
    } else {
      docRef.update({
        lastActive: 'SERVER_TIMESTAMP',
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
    const docRef = this.db.collection('channels').document(channelId);
    docRef.update(data);
  }

  async deleteChannelDoc(channelId: string): Promise<void> {
    if (!this.db) return;
    const docRef = this.db.collection('channels').document(channelId);
    docRef.delete();
    logger.debug(`Deleted channel doc ${channelId} from Firestore`);
  }

  // Collection Operations

  async deleteOldDocs(collection: string, seconds: number): Promise<number> {
    if (!this.db) return 0;

    const db = this.db;
    const cutoff = new Date(Date.now() - seconds * 1000);

    const refs = db.collection(collection).where('lastActive', '<', cutoff).stream();
    let batch = db.batch();
    let count = 0;

    for (const doc of refs) {
      batch.delete(doc.reference);
      count++;
      if (count % 500 === 0) {
        batch.commit();
        batch = db.batch();
      }
    }

    if (count % 500 !== 0) {
      batch.commit();
    }

    if (count > 0) {
      logger.info(
        `Deleted ${count} old doc(s) from ${collection} (older than ${seconds} seconds)`,
      );
    }

    return refs.length;
  }

  async deleteAllInCollection(collection: string): Promise<number> {
    if (!this.db) return 0;

    const db = this.db;
    const refs = db.collection(collection).stream();

    let batch = db.batch();
    let count = 0;

    for (const docSnap of refs) {
      batch.delete(docSnap.reference);
      count++;
      if (count % 500 === 0) {
        batch.commit();
        batch = db.batch();
      }
    }

    if (count % 500 !== 0) {
      batch.commit();
    }

    if (count > 0) {
      logger.info(`Deleted all ${count} doc(s) from ${collection} collection`);
    }

    return refs.length;
  }
}
