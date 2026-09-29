import { FieldValue } from 'firebase-admin/firestore';
import type { CharacterResult } from './lookupCharacter.js';

/** Unused entries are deleted by the `expireAt` TTL policy (firestore.indexes.json). */
const CHARACTER_CACHE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Path of a character's Battle.net lookup cache doc. The collection is flat
 * (one fixed collection ID) so a Firestore TTL policy can cover it.
 */
export function characterCachePath(region: string, realm: string, name: string): string {
  return `characterCache/${region.toLowerCase()}:${realm.toLowerCase()}:${name.toLowerCase()}`;
}

/** A cache doc for this lookup result. Every write pushes its expiry out. */
export function characterCacheEntry(result: CharacterResult): Record<string, unknown> {
  return {
    result,
    cachedAt: FieldValue.serverTimestamp(),
    expireAt: new Date(Date.now() + CHARACTER_CACHE_RETENTION_MS),
  };
}
