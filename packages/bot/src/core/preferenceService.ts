import logger from './logger.js';
import { FirebaseService, SERVER_TIMESTAMP } from './firebaseService.js';
import {
  clearPlayerPreference,
  getAllPreferences,
  getPlayerPreference,
  setPlayerPreference,
} from './storage.js';

export interface IPreferenceService {
  loadCache(): Promise<void>;
  getPreference(discordId: string): Promise<string[] | null>;
  setPreference(discordId: string, name: string, roles: string[], inGameName?: string): Promise<void>;
  clearPreference(discordId: string): Promise<void>;
  refreshPreference(discordId: string): Promise<void>;
  getPreferenceSync(discordId: string): string[] | null;
  getPreferenceByNameSync(name: string): string[] | null;
  getInGameNameSync(discordId: string): string;
  getMediaUrlSync(discordId: string): string | null;
  resolveDiscordId(name: string): string | null;
}

let _instance: PreferenceService | null = null;

export function getPreferenceService(): PreferenceService {
  if (!_instance) {
    _instance = new PreferenceService();
  }
  return _instance;
}

/** Reset singleton — for testing only. */
export function _resetInstance(): void {
  _instance = null;
}

export class PreferenceService implements IPreferenceService {
  firebase: FirebaseService;
  private _cache: Record<string, string[]> = {};
  private _nameToId: Record<string, string> = {};
  private _inGameNameCache: Record<string, string> = {};
  private _mediaUrlCache: Record<string, string> = {};

  constructor(firebase?: FirebaseService) {
    this.firebase = firebase ?? FirebaseService.getInstance();
  }

  private _firebaseOk(): boolean {
    return this.firebase.isAvailable();
  }

  // Async Methods (Firestore + fallback)

  async loadCache(): Promise<void> {
    if (!this._firebaseOk()) {
      this._loadFromLocal();
      return;
    }

    try {
      const docs = await this._fetchAllPreferences();
      for (const [discordId, data] of Object.entries(docs)) {
        const roles = (data.roles as string[]) ?? [];
        const name = (data.wowName as string) ?? '';
        const inGameName = (data.inGameName as string) ?? '';
        const mediaUrl = (data.mediaUrl as string) ?? '';
        this._cache[discordId] = roles;
        if (name) this._nameToId[name] = discordId;
        if (inGameName) this._inGameNameCache[discordId] = inGameName;
        if (mediaUrl) this._mediaUrlCache[discordId] = mediaUrl;
      }
      logger.info(`Loaded ${Object.keys(docs).length} preferences from Firestore`);
    } catch {
      logger.error('Failed to load preferences from Firestore, using local');
      this._loadFromLocal();
    }
  }

  private _loadFromLocal(): void {
    const local = getAllPreferences();
    for (const [name, roles] of Object.entries(local)) {
      this._nameToId[name] = name;
      this._cache[name] = roles;
    }
  }

  private async _fetchAllPreferences(): Promise<
    Record<string, Record<string, unknown>>
  > {
    if (!this.firebase.db) return {};

    const result: Record<string, Record<string, unknown>> = {};
    const db = this.firebase.db;
    const snapshot = await db.collection('preferences').get();
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      if (data !== null) {
        result[docSnap.id] = data;
      }
    }
    return result;
  }

  async getPreference(discordId: string): Promise<string[] | null> {
    if (discordId in this._cache) {
      return this._cache[discordId];
    }

    if (this._firebaseOk()) {
      try {
        const data = await this._readFirestorePref(discordId);
        if (data !== null) {
          const roles = (data.roles as string[]) ?? [];
          const name = (data.wowName as string) ?? '';
          const inGameName = (data.inGameName as string) ?? '';
          const mediaUrl = (data.mediaUrl as string) ?? '';
          this._cache[discordId] = roles;
          if (name) this._nameToId[name] = discordId;
          if (inGameName) this._inGameNameCache[discordId] = inGameName;
          if (mediaUrl) this._mediaUrlCache[discordId] = mediaUrl;
          return roles;
        }
      } catch {
        logger.error(`Firestore read failed for ${discordId}`);
      }
    }

    return null;
  }

  async setPreference(discordId: string, name: string, roles: string[], inGameName?: string): Promise<void> {
    this._cache[discordId] = roles;
    this._nameToId[name] = discordId;
    if (inGameName !== undefined) {
      if (inGameName) {
        this._inGameNameCache[discordId] = inGameName;
      } else {
        Reflect.deleteProperty(this._inGameNameCache, discordId);
      }
    }

    if (this._firebaseOk()) {
      try {
        await this._writeFirestorePref(discordId, name, roles, inGameName);
      } catch {
        logger.error(`Firestore write failed for ${discordId}`);
      }
    }

    // Local JSON backup
    setPlayerPreference(name, roles);
  }

  async clearPreference(discordId: string): Promise<void> {
    // Find name for local cleanup
    const name =
      Object.entries(this._nameToId).find(([, did]) => did === discordId)?.[0] ?? null;

    Reflect.deleteProperty(this._cache, discordId);
    Reflect.deleteProperty(this._inGameNameCache, discordId);
    Reflect.deleteProperty(this._mediaUrlCache, discordId);
    this._clearNameMapping(discordId);
    if (name) clearPlayerPreference(name);

    if (this._firebaseOk()) {
      try {
        await this._deleteFirestorePref(discordId);
      } catch {
        logger.error(`Firestore delete failed for ${discordId}`);
      }
    }
  }

  // Sync Methods (cache-only, hot-path reads)

  private _clearNameMapping(discordId: string): void {
    for (const [n, did] of Object.entries(this._nameToId)) {
      if (did === discordId) {
        Reflect.deleteProperty(this._nameToId, n);
        break;
      }
    }
  }

  async refreshPreference(discordId: string): Promise<void> {
    if (!this._firebaseOk()) return;
    try {
      const data = await this._readFirestorePref(discordId);
      if (data !== null) {
        const roles = (data.roles as string[]) ?? [];
        const name = (data.wowName as string) ?? '';
        const inGameName = (data.inGameName as string) ?? '';
        const mediaUrl = (data.mediaUrl as string) ?? '';
        this._cache[discordId] = roles;
        this._clearNameMapping(discordId);
        if (name) this._nameToId[name] = discordId;
        if (inGameName) this._inGameNameCache[discordId] = inGameName;
        else Reflect.deleteProperty(this._inGameNameCache, discordId);
        if (mediaUrl) this._mediaUrlCache[discordId] = mediaUrl;
        else Reflect.deleteProperty(this._mediaUrlCache, discordId);
      } else {
        Reflect.deleteProperty(this._cache, discordId);
        Reflect.deleteProperty(this._inGameNameCache, discordId);
        Reflect.deleteProperty(this._mediaUrlCache, discordId);
        this._clearNameMapping(discordId);
      }
    } catch {
      logger.error(`Firestore refresh failed for ${discordId}`);
    }
  }

  getPreferenceSync(discordId: string): string[] | null {
    return this._cache[discordId] ?? null;
  }

  getInGameNameSync(discordId: string): string {
    return this._inGameNameCache[discordId] ?? '';
  }

  getMediaUrlSync(discordId: string): string | null {
    return this._mediaUrlCache[discordId] ?? null;
  }

  getPreferenceByNameSync(name: string): string[] | null {
    const discordId = this._nameToId[name];
    if (discordId) {
      return this._cache[discordId] ?? null;
    }
    // Fallback to local JSON
    return getPlayerPreference(name);
  }

  resolveDiscordId(name: string): string | null {
    return this._nameToId[name] ?? null;
  }

  // Firestore CRUD helpers — exposed for testing

  async _readFirestorePref(
    discordId: string,
  ): Promise<Record<string, unknown> | null> {
    if (!this.firebase.db) return null;
    const ref = this.firebase.db.collection('preferences').doc(discordId);
    const docSnap = await ref.get();
    if (docSnap.exists) {
      return docSnap.data() as Record<string, unknown>;
    }
    return null;
  }

  async _writeFirestorePref(
    discordId: string,
    name: string,
    roles: string[],
    inGameName?: string,
  ): Promise<void> {
    if (!this.firebase.db) return;
    const ref = this.firebase.db.collection('preferences').doc(discordId);
    const payload: Record<string, unknown> = {
      roles,
      wowName: name,
      updatedAt: SERVER_TIMESTAMP,
    };
    // Only include inGameName when explicitly provided to avoid wiping
    // values set by the activity frontend when the bot saves without it
    if (inGameName !== undefined) {
      payload.inGameName = inGameName;
    }
    await ref.set(payload, { merge: true });
  }

  async _deleteFirestorePref(discordId: string): Promise<void> {
    if (!this.firebase.db) return;
    const ref = this.firebase.db.collection('preferences').doc(discordId);
    await ref.delete();
  }
}
