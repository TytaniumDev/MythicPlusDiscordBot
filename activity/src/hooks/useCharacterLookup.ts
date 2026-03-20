import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import type { Role, Utility } from '@mythicplus/shared';

export interface CharacterData {
  name: string;
  realm: string;
  class: string;
  role: Role;
  utilities: Utility[];
  mediaUrl: string | null;
}

export function useCharacterLookup() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function lookup(name: string, realm: string, region: string): Promise<CharacterData | null> {
    setLoading(true);
    setError(null);

    try {
      const fn = httpsCallable<
        { name: string; realm: string; region: string },
        CharacterData
      >(functions, 'lookupCharacter');

      const result = await fn({ name, realm, region });
      return result.data;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Character lookup failed';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { lookup, loading, error };
}
