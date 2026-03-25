import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { resolveAffixDisplay, STATIC_AFFIXES, BARGAIN_AFFIXES, type AffixDisplay } from './affixMetadata.js';

export interface AffixDocument {
  period: number;
  region: string;
  lastUpdated: FieldValue | Date;
  affixes: AffixDisplay[];
}

// Pure logic — testable without Firebase
export function buildAffixDocument(
  affixIds: number[],
  region: string,
): Omit<AffixDocument, 'lastUpdated'> & { lastUpdated: Date } {
  const affixes: AffixDisplay[] = [];

  for (const id of affixIds) {
    const display = resolveAffixDisplay(id);
    if (display) affixes.push(display);
  }

  // Lindormi's Guidance is always active at +2–5 but Raider.IO omits it
  const lindormis = STATIC_AFFIXES.find(a => a.id === 165);
  if (lindormis && !affixes.some(a => a.id === 165)) {
    affixes.push(lindormis);
  }

  // Sort by keystone level appearance: Lindormi's (+2) → Bargain (+4) → Fort (+7) → Tyran (+7) → Guile (+12)
  const SORT_ORDER: Record<number, number> = { 165: 0, 147: 4, 10: 2, 9: 3 };
  Object.keys(BARGAIN_AFFIXES).forEach(id => { SORT_ORDER[Number(id)] = 1; });
  affixes.sort((a, b) => (SORT_ORDER[a.id] ?? 99) - (SORT_ORDER[b.id] ?? 99));

  return {
    period: 0,
    region,
    lastUpdated: new Date(),
    affixes,
  };
}

const RAIDERIO_AFFIXES_URL = 'https://raider.io/api/v1/mythic-plus/affixes?region=us&locale=en';

// Shared logic: fetch current affixes from Raider.IO and write to Firestore
export async function fetchAndWriteAffixes(): Promise<Omit<AffixDocument, 'lastUpdated'> & { lastUpdated: Date }> {
  const response = await fetch(RAIDERIO_AFFIXES_URL);
  if (!response.ok) throw new Error(`Raider.IO request failed: ${response.status}`);

  const data = await response.json();
  const affixIds: number[] = data.affix_details.map((a: { id: number }) => a.id);

  const doc = buildAffixDocument(affixIds, 'us');

  const db = getFirestore();
  await db.doc('config/affixes').set({
    ...doc,
    lastUpdated: FieldValue.serverTimestamp(),
  });

  return doc;
}

// Scheduled: fires weekly on Tuesdays
export const fetchWeeklyAffixes = onSchedule(
  {
    // Fires 2 hours after NA weekly reset (15:00 UTC). EU resets Wednesday 04:00 UTC,
    // but affixes are the same globally so NA timing is fine for all regions.
    schedule: 'every tuesday 17:00',
    timeZone: 'UTC',
  },
  async () => {
    await fetchAndWriteAffixes();
  },
);

// On-demand: callable for manual refresh (e.g. after deploy, or if scheduled run failed)
export const refreshAffixes = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }
  const doc = await fetchAndWriteAffixes();
  return { period: doc.period, region: doc.region, affixCount: doc.affixes.length };
});
