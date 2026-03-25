import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAppStore } from '../store/store';
import { STATIC_AFFIXES, resolveAffixDisplay } from '@mythicplus/shared';
import type { AffixDisplay } from '@mythicplus/shared';

interface AffixData {
  period: number;
  region: string;
  affixes: AffixDisplay[];
}

export function useAffixes(): AffixData | null {
  const [data, setData] = useState<AffixData | null>(null);
  const isDemoMode = useAppStore(s => s.isDemoMode);

  useEffect(() => {
    if (isDemoMode) {
      setData({
        period: 0,
        region: 'us',
        affixes: [165, 160, 10, 147]
          .map(id => resolveAffixDisplay(id))
          .filter((a): a is AffixDisplay => a !== null),
      });
      return;
    }

    const unsub = onSnapshot(
      doc(db, 'config', 'affixes'),
      (snap) => {
        if (snap.exists()) {
          setData(snap.data() as AffixData);
        } else {
          // Weekly Cloud Function hasn't run yet — show static affixes as fallback
          setData({ period: 0, region: 'us', affixes: STATIC_AFFIXES });
        }
      },
      (error) => console.error('[Wheelson] Failed to load affixes:', error),
    );
    return unsub;
  }, [isDemoMode]);

  return data;
}
