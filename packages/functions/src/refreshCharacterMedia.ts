import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { getFirestore, FieldValue, type Firestore } from 'firebase-admin/firestore';
import { getBattleNetClient, type BattleNetClient } from './battlenet.js';
import { buildCharacterResult, type CharacterResult } from './lookupCharacter.js';
import { enforceRateLimit } from './rateLimit.js';

interface LinkedCharacter {
  name: string;
  realm: string;
  region: string;
}

// Tracks where a target came from so we can decide what to do when the
// Battle.net lookup fails: previously-verified targets get a pass on transient
// failures, while inGameName-derived targets indicate stale/invalid user input
// and get their character fields cleared.
export type TargetSource = 'linkedCharacter' | 'inGameName';

export interface RefreshTarget {
  discordId: string;
  linkedCharacter: LinkedCharacter;
  source: TargetSource;
}

export interface RefreshSummary {
  total: number;
  refreshed: number;
  skipped: number;
  failed: number;
  cleared: number;
}

// Fields we clear when a doc's character data is unresolvable. Roles and
// updatedAt stay — users keep their role selections across name re-entry.
const CHARACTER_FIELDS_TO_CLEAR = [
  'inGameName',
  'linkedCharacter',
  'mediaUrl',
  'characterClass',
  'mediaUrlUpdatedAt',
  'wowName', // legacy, no readers remain
] as const;

const DEFAULT_REGION = 'us';

// Mirrors activity/src/components/RoleEditor.tsx. Apostrophes are stripped
// entirely (Kel'Thuzad → kelthuzad); any other non-alphanumeric run collapses
// to a single hyphen so inputs with stray spacing (e.g. "Azjol - Nerub") still
// produce a valid slug.
function realmToSlug(realm: string): string {
  return realm
    .trim()
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseInGameName(input: string): { name: string; realm: string } | null {
  const trimmed = input.trim();
  const dashIdx = trimmed.indexOf('-');
  if (dashIdx === -1) return null;
  const name = trimmed.slice(0, dashIdx).trim();
  const realm = trimmed.slice(dashIdx + 1).trim();
  if (!name || !realm) return null;
  return { name, realm: realmToSlug(realm) };
}

function readLinkedCharacter(data: Record<string, unknown>): LinkedCharacter | null {
  const linked = data.linkedCharacter as LinkedCharacter | undefined;
  if (!linked) return null;
  if (typeof linked.name !== 'string' || typeof linked.realm !== 'string' || typeof linked.region !== 'string') return null;
  if (!linked.name || !linked.realm || !linked.region) return null;
  return linked;
}

function hasAnyCharacterField(data: Record<string, unknown>): boolean {
  return CHARACTER_FIELDS_TO_CLEAR.some((f) => data[f] != null);
}

export interface ClassifiedDocs {
  // BN-resolvable. Preferred source: linkedCharacter (server-verified),
  // falling back to parsed inGameName for older docs.
  targets: RefreshTarget[];
  // Unresolvable without user input (inGameName has no realm, or stale
  // character-ish fields with no valid identity). Character fields get
  // cleared so the user is prompted to re-enter on next activity open.
  // Roles are preserved.
  clears: string[];
}

// Pure classification — testable without Firestore. Single pass: each doc
// lands in exactly one of { targets, clears, neither (no character data) }.
export function classifyDocs(
  docs: { id: string; data: Record<string, unknown> }[],
): ClassifiedDocs {
  const targets: RefreshTarget[] = [];
  const clears: string[] = [];
  for (const doc of docs) {
    const linked = readLinkedCharacter(doc.data);
    if (linked) {
      targets.push({ discordId: doc.id, linkedCharacter: linked, source: 'linkedCharacter' });
      continue;
    }
    const inGameName = typeof doc.data.inGameName === 'string' ? doc.data.inGameName : '';
    const parsed = inGameName ? parseInGameName(inGameName) : null;
    if (parsed) {
      targets.push({
        discordId: doc.id,
        linkedCharacter: { name: parsed.name, realm: parsed.realm, region: DEFAULT_REGION },
        source: 'inGameName',
      });
      continue;
    }
    if (hasAnyCharacterField(doc.data)) clears.push(doc.id);
  }
  return { targets, clears };
}

async function clearCharacterFields(db: Firestore, discordId: string): Promise<void> {
  const updates: Record<string, FieldValue> = {};
  for (const f of CHARACTER_FIELDS_TO_CLEAR) updates[f] = FieldValue.delete();
  await db.doc(`preferences/${discordId}`).update(updates);
}

async function refreshOne(client: BattleNetClient, target: RefreshTarget): Promise<CharacterResult | null> {
  const { name, realm, region } = target.linkedCharacter;
  const profile = await client.getCharacterProfile(region, realm.toLowerCase(), name);
  if (!profile || !profile.character_class) return null;
  const media = await client.getCharacterMedia(region, realm.toLowerCase(), name);
  return buildCharacterResult(profile, media);
}

export async function runRefresh(): Promise<RefreshSummary> {
  const db = getFirestore();
  const snapshot = await db.collection('preferences').get();
  const { targets, clears } = classifyDocs(
    snapshot.docs.map(d => ({ id: d.id, data: d.data() })),
  );

  const client = getBattleNetClient();
  const summary: RefreshSummary = {
    total: targets.length + clears.length,
    refreshed: 0,
    skipped: 0,
    failed: 0,
    cleared: 0,
  };

  // Proactive clears: docs with no parseable character identity. No BN call.
  // Kept sequential rather than a single batch: a batch fails atomically, so
  // one concurrently-deleted doc would mark all clears as failed. At current
  // scale (<20 clears/week) the per-doc cost is negligible.
  for (const discordId of clears) {
    try {
      await clearCharacterFields(db, discordId);
      summary.cleared += 1;
    } catch (err) {
      summary.failed += 1;
      logger.warn(`[refreshCharacterMedia] ${discordId} clear failed`, err);
    }
  }

  for (const target of targets) {
    try {
      const result = await refreshOne(client, target);
      if (!result) {
        // Source discriminates what "no profile returned" means:
        // - linkedCharacter: previously verified; probably a transient BN/Blizzard
        //   hiccup. Leave the doc alone.
        // - inGameName: user's typed name didn't resolve (typo, deleted char,
        //   non-US realm). Clear character fields so they're prompted to re-enter.
        if (target.source === 'inGameName') {
          await clearCharacterFields(db, target.discordId);
          summary.cleared += 1;
        } else {
          summary.skipped += 1;
        }
        continue;
      }

      // Build payload without nulls — a transient Battle.net media failure
      // returns mediaUrl: null, and { merge: true } would otherwise wipe
      // the previously-stored URL. Only write fields we successfully resolved.
      // Always write linkedCharacter: idempotent for docs that already had it,
      // backfills for docs whose target was derived from inGameName.
      const payload: Record<string, unknown> = {
        linkedCharacter: target.linkedCharacter,
        mediaUrlUpdatedAt: FieldValue.serverTimestamp(),
      };
      if (result.mediaUrl != null) payload.mediaUrl = result.mediaUrl;
      if (result.class != null) payload.characterClass = result.class;

      const { name, realm, region } = target.linkedCharacter;
      const batch = db.batch();
      batch.set(db.doc(`preferences/${target.discordId}`), payload, { merge: true });
      // Also refresh the lookupCharacter cache doc so subsequent UI lookups
      // don't reintroduce stale mediaUrl within the 24h cache TTL.
      batch.set(
        db.doc(`characters/${region}/${realm.toLowerCase()}/${name.toLowerCase()}`),
        { result, cachedAt: FieldValue.serverTimestamp() },
      );
      await batch.commit();

      summary.refreshed += 1;
    } catch (err) {
      summary.failed += 1;
      logger.warn(`[refreshCharacterMedia] ${target.discordId} (${target.linkedCharacter.name}-${target.linkedCharacter.realm}) failed`, err);
    }
  }

  logger.info('[refreshCharacterMedia] summary', summary);
  return summary;
}

// Scheduled: Tuesday 18:00 PT, 2h after the affixes job at 16:00 PT.
// Runs after the NA weekly reset so portraits reflect the new week's gear.
export const refreshCharacterMedia = onSchedule(
  {
    schedule: 'every tuesday 18:00',
    timeZone: 'America/Los_Angeles',
    timeoutSeconds: 540,
  },
  async () => {
    await runRefresh();
  },
);

// On-demand: callable for manual refresh (e.g. after deploy, or if scheduled run failed).
// enforceAppCheck=false matches lookupCharacter — the activity does not initialize
// App Check, so enforcing it would silently reject every call.
export const refreshCharacterMediaNow = onCall(
  { enforceAppCheck: false, timeoutSeconds: 540 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }
    await enforceRateLimit(request.auth.uid, 'refreshCharacterMediaNow', 2, 3600000);
    return runRefresh();
  },
);
