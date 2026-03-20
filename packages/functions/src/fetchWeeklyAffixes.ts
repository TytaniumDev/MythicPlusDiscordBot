import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getBattleNetClient } from './battlenet.js';
import { resolveAffixDisplay, BARGAIN_AFFIXES, type AffixDisplay } from './affixMetadata.js';

export interface AffixDocument {
  period: number;
  region: string;
  lastUpdated: FieldValue | Date;
  affixes: AffixDisplay[];
}

// Pure logic — testable without Firebase
export function buildAffixDocument(
  periodData: { id: number; affix_details: Array<{ id: number; name: string }> },
  region: string,
): Omit<AffixDocument, 'lastUpdated'> & { lastUpdated: Date } {
  const affixes: AffixDisplay[] = [];

  for (const affix of periodData.affix_details) {
    const display = resolveAffixDisplay(affix.id);
    if (display) affixes.push(display);
  }

  // Sort by keystone level appearance: Lindormi's (+2) → Bargain (+4) → Fort/Tyran (+7) → Guile (+12)
  const SORT_ORDER: Record<number, number> = { 165: 0, 147: 3, 10: 2, 9: 2 };
  Object.keys(BARGAIN_AFFIXES).forEach(id => { SORT_ORDER[Number(id)] = 1; });
  affixes.sort((a, b) => (SORT_ORDER[a.id] ?? 99) - (SORT_ORDER[b.id] ?? 99));

  return {
    period: periodData.id,
    region,
    lastUpdated: new Date(),
    affixes,
  };
}

// Firebase Cloud Function
export const fetchWeeklyAffixes = onSchedule(
  {
    schedule: 'every tuesday 17:00',
    timeZone: 'UTC',
  },
  async () => {
    const client = getBattleNetClient();
    const region = 'us';

    const periodIndex = await client.getMythicKeystonePeriodIndex(region);
    if (!periodIndex) throw new Error('Failed to fetch period index');

    const currentPeriodId = periodIndex.current_period.id;

    const periodResponse = await client.apiCall(
      region,
      `/data/wow/mythic-keystone/period/${currentPeriodId}?namespace=dynamic-${region}&locale=en_US`,
    );
    if (!periodResponse.ok) throw new Error(`Failed to fetch period ${currentPeriodId}`);
    const periodData = await periodResponse.json();

    const doc = buildAffixDocument(periodData, region);

    const db = getFirestore();
    await db.doc('config/affixes').set({
      ...doc,
      lastUpdated: FieldValue.serverTimestamp(),
    });
  },
);
