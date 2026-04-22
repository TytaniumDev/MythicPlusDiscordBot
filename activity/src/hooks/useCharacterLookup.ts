import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { useAppStore } from '../store/store';
import { lookupCharacterProfile } from '../services/raiderioService';
import { toCharacterClass } from '@mythicplus/shared';
import type { CharacterClass, Role, Utility } from '@mythicplus/shared';

export interface CharacterData {
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
    options?: { silent?: boolean },
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
        { name: string; realm: string; region: string },
        CharacterData
      >(functions, 'lookupCharacter');

      const result = await fn({ name, realm, region });
      return result.data;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Character lookup failed';
      console.warn('[Wheelson] lookupCharacter callable failed:', err);
      setError(message);
      return null;
    } finally {
      if (!silent) setLoading(false);
    }
  }

  return { lookup, loading, error };
}
