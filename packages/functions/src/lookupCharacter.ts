import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { BattleNetClient } from './battlenet.js';
import { getUtilitiesForClass, getRoleForSpec } from '@mythicplus/shared';
import { defineSecret } from 'firebase-functions/params';
import type { Role, Utility } from '@mythicplus/shared';

const bnetClientId = defineSecret('BNET_CLIENT_ID');
const bnetClientSecret = defineSecret('BNET_CLIENT_SECRET');

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
    active_specialization: { name: string };
  },
  media: { assets: Array<{ key: string; value: string }> } | null,
): CharacterResult {
  const className = profile.character_class.name;
  const specName = profile.active_specialization.name;

  const mainRawAsset = media?.assets?.find(a => a.key === 'main-raw');
  const mediaUrl = mainRawAsset?.value ?? null;

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
  { secrets: [bnetClientId, bnetClientSecret] },
  async (request) => {
    const { name, realm, region } = request.data as {
      name?: string;
      realm?: string;
      region?: string;
    };

    if (!name || !realm || !region) {
      throw new HttpsError('invalid-argument', 'name, realm, and region are required');
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
    const client = new BattleNetClient(bnetClientId.value(), bnetClientSecret.value());

    const profile = await client.getCharacterProfile(region, realm.toLowerCase(), name);
    if (!profile) {
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
