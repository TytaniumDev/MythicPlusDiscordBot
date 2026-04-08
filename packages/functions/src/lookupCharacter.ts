import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getBattleNetClient } from './battlenet.js';
import { getUtilitiesForClass, getRoleForSpec } from '@mythicplus/shared';
import { enforceRateLimit } from './rateLimit.js';
import type { Role, Utility } from '@mythicplus/shared';

export interface CharacterResult {
  name: string;
  realm: string;
  class: string;
  role: Role;
  utilities: Utility[];
  mediaUrl: string | null;
}

// Pure logic — testable without Firebase
export function buildCharacterResult(
  profile: {
    name: string;
    realm: { slug: string; name: string };
    character_class: { name: string };
    active_specialization?: { name: string };
    active_spec?: { name: string };
  },
  media: { assets: Array<{ key: string; value: string }> } | null,
): CharacterResult {
  const className = profile.character_class.name;
  const spec = profile.active_specialization ?? profile.active_spec;
  const specName = spec?.name ?? 'Unknown';

  const insetAsset = media?.assets?.find(a => a.key === 'inset');
  const mediaUrl = insetAsset?.value ?? null;

  return {
    name: profile.name,
    realm: profile.realm.name,
    class: className,
    role: getRoleForSpec(specName, className),
    utilities: getUtilitiesForClass(className),
    mediaUrl,
  };
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1 day

export const lookupCharacter = onCall(
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }
    await enforceRateLimit(request.auth.uid, 'lookupCharacter', 30, 60000);
    const { name, realm, region } = request.data as {
      name?: string;
      realm?: string;
      region?: string;
    };

    if (!name || !realm || !region) {
      throw new HttpsError('invalid-argument', 'name, realm, and region are required');
    }

    // Validate inputs contain only valid WoW name/realm slug characters (letters, digits, hyphens, spaces, apostrophes)
    const validPattern = /^[a-zA-Z0-9\s'-]+$/;
    if (!validPattern.test(name) || !validPattern.test(realm) || !validPattern.test(region)) {
      throw new HttpsError('invalid-argument', 'Invalid characters in name, realm, or region');
    }

    const db = getFirestore();
    const cacheRef = db.doc(`characters/${region}/${realm.toLowerCase()}/${name.toLowerCase()}`);

    // Check cache
    const cached = await cacheRef.get();
    if (cached.exists) {
      const data = cached.data();
      if (data) {
        const cachedAt = data.cachedAt as Timestamp;
        if (cachedAt && Date.now() - cachedAt.toMillis() < CACHE_TTL_MS) {
          return data.result as CharacterResult;
        }
      }
    }

    // Fetch from Battle.net
    const client = getBattleNetClient();

    const profile = await client.getCharacterProfile(region, realm.toLowerCase(), name);
    if (!profile || !profile.character_class) {
      throw new HttpsError('not-found', `Character "${name}" not found on ${realm}`);
    }

    const media = await client.getCharacterMedia(region, realm.toLowerCase(), name);
    const result = buildCharacterResult(profile, media);

    // Write to cache
    await cacheRef.set({
      result,
      cachedAt: FieldValue.serverTimestamp(),
    });

    return result;
  },
);
