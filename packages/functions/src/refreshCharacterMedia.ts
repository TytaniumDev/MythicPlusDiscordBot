import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getBattleNetClient, type BattleNetClient } from './battlenet.js';
import { buildCharacterResult } from './lookupCharacter.js';
import { enforceRateLimit } from './rateLimit.js';

interface LinkedCharacter {
  name: string;
  realm: string;
  region: string;
}

export interface RefreshTarget {
  discordId: string;
  linkedCharacter: LinkedCharacter;
}

export interface RefreshSummary {
  total: number;
  refreshed: number;
  skipped: number;
  failed: number;
}

// Pure extraction — testable without Firestore.
export function extractRefreshTargets(
  docs: { id: string; data: Record<string, unknown> }[],
): RefreshTarget[] {
  const targets: RefreshTarget[] = [];
  for (const doc of docs) {
    const linked = doc.data.linkedCharacter as LinkedCharacter | undefined;
    if (!linked || typeof linked.name !== 'string' || typeof linked.realm !== 'string' || typeof linked.region !== 'string') continue;
    if (!linked.name || !linked.realm || !linked.region) continue;
    targets.push({ discordId: doc.id, linkedCharacter: linked });
  }
  return targets;
}

async function refreshOne(client: BattleNetClient, target: RefreshTarget): Promise<{ mediaUrl: string | null; characterClass: string | null } | null> {
  const { name, realm, region } = target.linkedCharacter;
  const profile = await client.getCharacterProfile(region, realm.toLowerCase(), name);
  if (!profile || !profile.character_class) return null;
  const media = await client.getCharacterMedia(region, realm.toLowerCase(), name);
  const result = buildCharacterResult(profile, media);
  return { mediaUrl: result.mediaUrl, characterClass: result.class };
}

export async function runRefresh(): Promise<RefreshSummary> {
  const db = getFirestore();
  const snapshot = await db.collection('preferences').get();
  const targets = extractRefreshTargets(
    snapshot.docs.map(d => ({ id: d.id, data: d.data() })),
  );

  const client = getBattleNetClient();
  const summary: RefreshSummary = { total: targets.length, refreshed: 0, skipped: 0, failed: 0 };

  for (const target of targets) {
    try {
      const result = await refreshOne(client, target);
      if (!result) {
        summary.skipped += 1;
        continue;
      }
      await db.doc(`preferences/${target.discordId}`).set(
        {
          mediaUrl: result.mediaUrl,
          characterClass: result.characterClass,
          mediaUrlUpdatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      summary.refreshed += 1;
    } catch (err) {
      summary.failed += 1;
      console.warn(`[refreshCharacterMedia] ${target.discordId} (${target.linkedCharacter.name}-${target.linkedCharacter.realm}) failed:`, err);
    }
  }

  console.log(`[refreshCharacterMedia] ${JSON.stringify(summary)}`);
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
export const refreshCharacterMediaNow = onCall(
  { enforceAppCheck: true, timeoutSeconds: 540 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }
    await enforceRateLimit(request.auth.uid, 'refreshCharacterMediaNow', 2, 3600000);
    return runRefresh();
  },
);
