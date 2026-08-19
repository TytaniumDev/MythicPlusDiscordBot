import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { useAppStore } from '../store/store';
import { lookupCharacterProfile } from '../services/raiderioService';
import { reportError } from '../lib/sentry';
import { toCharacterClass } from '@mythicplus/shared';
import type { CharacterClass, Role, Utility } from '@mythicplus/shared';

// Callable error codes that indicate user input failed validation rather than
// an actionable bug — surface them to the user but don't report to Sentry.
const EXPECTED_LOOKUP_CODES = new Set([
  'functions/not-found',
  'functions/invalid-argument',
  'functions/failed-precondition',
]);

function isExpectedLookupError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const code = (err as { code?: string }).code;
  return typeof code === 'string' && EXPECTED_LOOKUP_CODES.has(code);
}

interface CharacterData {
  name: string;
  realm: string;
  class: CharacterClass | null;
  role: Role;
  utilities: Utility[];
  mediaUrl: string | null;
}

const RAIDERIO_ROLE_MAP: Record<string, Role> = {
  tank: 'tank',
  healing: 'healer',
  dps: 'melee', // Raider.io doesn't distinguish melee/ranged — default to melee
};

export function useCharacterLookup() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function lookup(
    name: string,
    realm: string,
    region: string,
    options?: { silent?: boolean; forceRefresh?: boolean },
  ): Promise<CharacterData | null> {
    const silent = options?.silent === true;
    if (!silent) setLoading(true);
    setError(null);

    const isDemoMode = useAppStore.getState().isDemoMode;

    try {
      if (isDemoMode) {
        const profile = await lookupCharacterProfile(name, realm, region);
        if (!profile) {
          setError('Character not found');
          return null;
        }
        return {
          name: profile.name,
          realm: profile.realm,
          class: toCharacterClass(profile.className),
          role: RAIDERIO_ROLE_MAP[profile.role] ?? 'melee',
          utilities: [],
          mediaUrl: profile.thumbnailUrl || null,
        };
      }

      const fn = httpsCallable<
        { name: string; realm: string; region: string; forceRefresh?: boolean },
        CharacterData
      >(functions, 'lookupCharacter');

      const result = await fn({ name, realm, region, forceRefresh: options?.forceRefresh });
      return result.data;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Character lookup failed';
      if (!isExpectedLookupError(err)) {
        reportError(err, { tag: 'useCharacterLookup.lookup' });
      }
      setError(message);
      return null;
    } finally {
      if (!silent) setLoading(false);
    }
  }

  return { lookup, loading, error };
}
