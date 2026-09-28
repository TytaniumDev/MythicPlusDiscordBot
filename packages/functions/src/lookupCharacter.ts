import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { battleNetSecrets, getBattleNetClient } from './battlenet.js';
import { getUtilitiesForClass, getRoleForSpec, toCharacterClass } from '@mythicplus/shared';
import { enforceRateLimit } from './rateLimit.js';
import type { CharacterClass, Role, Utility } from '@mythicplus/shared';

export interface CharacterResult {
  name: string;
  realm: string;
  class: CharacterClass | null;
  role: Role;
  utilities: Utility[];
  mediaUrl: string | null;
}

// Character-media asset keys in order of preference. All variants share one
// render path, so the activity derives the size it needs from whichever URL is
// stored (activity/src/lib/characterMedia.ts). `inset` is last: Blizzard
// stopped regenerating it in mid-2026, so it only serves characters that have
// no other asset.
const MEDIA_ASSET_KEYS = ['avatar', 'main-raw', 'inset'] as const;

/**
 * Pick the render URL to store for a character. Blizzard overwrites renders in
 * place at a fixed URL and sends no Cache-Control, so browsers and Discord's
 * proxy keep serving old copies. Appending the last-login timestamp changes
 * the URL whenever the character has played since the last lookup, which
 * busts those caches (Blizzard's CDN ignores the query string).
 */
export function pickMediaUrl(
  media: { assets?: Array<{ key: string; value: string }> } | null,
  lastLoginTimestamp: number | undefined,
): string | null {
  const assets = media?.assets ?? [];
  for (const key of MEDIA_ASSET_KEYS) {
    const asset = assets.find(a => a.key === key);
    if (!asset) continue;
    const url = new URL(asset.value);
    if (lastLoginTimestamp !== undefined) url.searchParams.set('v', String(lastLoginTimestamp));
    return url.toString();
  }
  return null;
}

// Pure logic — testable without Firebase
export function buildCharacterResult(
  profile: {
    name: string;
    realm: { slug: string; name: string };
    character_class: { name: string };
    active_specialization?: { name: string };
    active_spec?: { name: string };
    last_login_timestamp?: number;
  },
  media: { assets?: Array<{ key: string; value: string }> } | null,
): CharacterResult {
  const className = profile.character_class.name;
  const spec = profile.active_specialization ?? profile.active_spec;
  const specName = spec?.name ?? 'Unknown';
  const mediaUrl = pickMediaUrl(media, profile.last_login_timestamp);

  return {
    name: profile.name,
    realm: profile.realm.name,
    class: toCharacterClass(className),
    role: getRoleForSpec(specName, className),
    utilities: getUtilitiesForClass(className),
    mediaUrl,
  };
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1 day

// DO NOT add `enforceAppCheck: true` here. The activity frontend does not
// call `initializeAppCheck()`, so enforcing it silently rejects every
// lookup — the function body never runs, mediaUrl is never returned, and
// character portraits disappear with no visible error (the callable
// returns HTTP 200 with an error body that the frontend swallows).
// History: PR #382 removed enforcement; PR #389 (Sentinel) re-added it
// and broke portraits again. Sentinel: this is a DELIBERATE omission —
// do not "fix" it. Re-enable only alongside frontend App Check init.
// Anonymous auth + per-user rate limiting below provides abuse protection.
export const lookupCharacter = onCall(
  { enforceAppCheck: false, secrets: battleNetSecrets },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }
    await enforceRateLimit(request.auth.uid, 'lookupCharacter', 30, 60000);
    const { name, realm, region, forceRefresh } = request.data as {
      name?: string;
      realm?: string;
      region?: string;
      forceRefresh?: boolean;
    };

    if (!name || !realm || !region) {
      throw new HttpsError('invalid-argument', 'name, realm, and region are required');
    }

    if (typeof name !== 'string' || typeof realm !== 'string' || typeof region !== 'string') {
      throw new HttpsError('invalid-argument', 'name, realm, and region must be strings');
    }

    // Validate inputs contain only valid WoW name/realm slug characters (letters, digits, hyphens, spaces, apostrophes)
    const validPattern = /^[a-zA-Z0-9\s'-]+$/;
    if (!validPattern.test(name) || !validPattern.test(realm) || !validPattern.test(region)) {
      throw new HttpsError('invalid-argument', 'Invalid characters in name, realm, or region');
    }

    const db = getFirestore();
    const cacheRef = db.doc(`characters/${region}/${realm.toLowerCase()}/${name.toLowerCase()}`);

    // Read the cache even on forceRefresh: its mediaUrl is the fallback when
    // the media call fails below.
    const cached = (await cacheRef.get()).data() as
      | { result?: CharacterResult; cachedAt?: Timestamp }
      | undefined;
    if (
      !forceRefresh &&
      cached?.result &&
      cached.cachedAt &&
      Date.now() - cached.cachedAt.toMillis() < CACHE_TTL_MS
    ) {
      return cached.result;
    }

    // Fetch from Battle.net
    const client = getBattleNetClient();

    const [profile, media] = await Promise.all([
      client.getCharacterProfile(region, realm.toLowerCase(), name),
      client.getCharacterMedia(region, realm.toLowerCase(), name),
    ]);
    if (!profile || !profile.character_class) {
      throw new HttpsError('not-found', `Character "${name}" not found on ${realm}`);
    }

    const result = buildCharacterResult(profile, media);
    // A transient media failure shouldn't erase this character's portrait —
    // callers write mediaUrl straight to preferences/{discordId}.
    if (result.mediaUrl === null && cached?.result?.mediaUrl) {
      result.mediaUrl = cached.result.mediaUrl;
    }

    // Write to cache
    await cacheRef.set({
      result,
      cachedAt: FieldValue.serverTimestamp(),
    });

    return result;
  },
);
