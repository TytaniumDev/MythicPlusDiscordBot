import { useState } from 'react';
import { lookupCharacter, type CharacterLookupResult } from '../services/characterLookup';

/** `lookupCharacter` plus a `loading` flag for the UI (not set by `silent` lookups). */
export function useCharacterLookup() {
  const [loading, setLoading] = useState(false);

  async function lookup(
    name: string,
    realm: string,
    region: string,
    options?: { silent?: boolean; forceRefresh?: boolean },
  ): Promise<CharacterLookupResult> {
    const silent = options?.silent === true;
    if (!silent) setLoading(true);
    try {
      return await lookupCharacter(name, realm, region, { forceRefresh: options?.forceRefresh });
    } finally {
      if (!silent) setLoading(false);
    }
  }

  return { lookup, loading };
}
