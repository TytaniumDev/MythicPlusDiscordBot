import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAppStore } from '../store/store';
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
        affixes: [
          { id: 165, name: "Lindormi's Guidance", nickname: 'training wheels', keystoneLevel: '+2–5', wowheadUrl: 'https://www.wowhead.com/affix=165/lindormis-guidance', color: '#22c55e' },
          { id: 160, name: "Xal'atath's Bargain: Devour", nickname: 'dispel', keystoneLevel: '+4–11', wowheadUrl: 'https://www.wowhead.com/affix=160/xalataths-bargain-devour', color: '#a855f7' },
          { id: 10, name: 'Fortified', nickname: null, keystoneLevel: '+7', wowheadUrl: 'https://www.wowhead.com/affix=10/fortified', color: '#ef4444' },
          { id: 147, name: "Xal'atath's Guile", nickname: 'death penalty', keystoneLevel: '+12', wowheadUrl: 'https://www.wowhead.com/affix=147/xalataths-guile', color: '#f59e0b' },
        ],
      });
      return;
    }

    const unsub = onSnapshot(
      doc(db, 'config', 'affixes'),
      (snap) => {
        if (snap.exists()) setData(snap.data() as AffixData);
      },
      (error) => console.error('[Wheelson] Failed to load affixes:', error),
    );
    return unsub;
  }, [isDemoMode]);

  return data;
}
