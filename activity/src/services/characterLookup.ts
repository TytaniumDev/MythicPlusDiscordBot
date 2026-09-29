import { httpsCallable } from 'firebase/functions';
import { functions, authReady } from '../firebase';
import { useAppStore } from '../store/store';
import { lookupCharacterProfile } from './raiderioService';
import { reportError } from '../lib/sentry';
import { toCharacterClass } from '@mythicplus/shared';
import type { CharacterClass, Role, Utility } from '@mythicplus/shared';

// Callable error codes meaning the name itself can't be looked up: no such
// character, or input that failed validation. Not reported to Sentry. Any
// other failure (Battle.net down, rate limit, offline) says nothing about the
// name, and is reported.
const NOT_FOUND_CODES = new Set([
  'functions/not-found',
  'functions/invalid-argument',
  'functions/failed-precondition',
]);

function isNotFoundError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const code = (err as { code?: string }).code;
  return typeof code === 'string' && NOT_FOUND_CODES.has(code);
}

interface CharacterData {
  name: string;
  realm: string;
  class: CharacterClass | null;
  role: Role;
  utilities: Utility[];
  mediaUrl: string | null;
}

/**
 * `notFound`: the name doesn't resolve to a character. `failed`: the lookup
 * itself failed, so the name may well be right and is worth retrying.
 */
export type CharacterLookupResult =
  | { status: 'found'; character: CharacterData }
  | { status: 'notFound' }
  | { status: 'failed' };

const RAIDERIO_ROLE_MAP: Record<string, Role> = {
  tank: 'tank',
  healing: 'healer',
  dps: 'melee', // Raider.io doesn't distinguish melee/ranged — default to melee
};

/**
 * Look a character up through the `lookupCharacter` Cloud Function (Raider.io
 * in demo mode). `forceRefresh` skips the function's one-day cache.
 */
export async function lookupCharacter(
  name: string,
  realm: string,
  region: string,
  options?: { forceRefresh?: boolean },
): Promise<CharacterLookupResult> {
  try {
    if (useAppStore.getState().isDemoMode) {
      const profile = await lookupCharacterProfile(name, realm, region);
      if (!profile) return { status: 'notFound' };
      return {
        status: 'found',
        character: {
          name: profile.name,
          realm: profile.realm,
          class: toCharacterClass(profile.className),
          role: RAIDERIO_ROLE_MAP[profile.role] ?? 'melee',
          utilities: [],
          mediaUrl: profile.thumbnailUrl || null,
        },
      };
    }

    const fn = httpsCallable<
      { name: string; realm: string; region: string; forceRefresh?: boolean },
      CharacterData
    >(functions, 'lookupCharacter');

    await authReady;
    const result = await fn({ name, realm, region, forceRefresh: options?.forceRefresh });
    return { status: 'found', character: result.data };
  } catch (err: unknown) {
    if (isNotFoundError(err)) return { status: 'notFound' };
    reportError(err, { tag: 'characterLookup.lookupCharacter' });
    return { status: 'failed' };
  }
}
