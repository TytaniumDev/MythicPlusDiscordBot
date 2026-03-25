import type { AffixDisplay } from './types.js';

// Static affixes (always present this season)
export const STATIC_AFFIXES: AffixDisplay[] = [
  {
    id: 165,
    name: "Lindormi's Guidance",
    nickname: 'training wheels',
    keystoneLevel: '+2–5',
    wowheadUrl: 'https://www.wowhead.com/affix=165/lindormis-guidance',
    color: '#22c55e',
  },
  {
    id: 147,
    name: "Xal'atath's Guile",
    nickname: 'death penalty',
    keystoneLevel: '+12',
    wowheadUrl: 'https://www.wowhead.com/affix=147/xalataths-guile',
    color: '#f59e0b',
  },
];

// Weekly rotating Xal'atath's Bargain variants
export const BARGAIN_AFFIXES: Record<number, AffixDisplay> = {
  148: { id: 148, name: "Xal'atath's Bargain: Ascendant", nickname: 'Kick/CC 10 Orbs', keystoneLevel: '+4–11', wowheadUrl: 'https://www.wowhead.com/affix=148/xalataths-bargain-ascendant', color: '#a855f7' },
  158: { id: 158, name: "Xal'atath's Bargain: Voidbound", nickname: 'Kill Add', keystoneLevel: '+4–11', wowheadUrl: 'https://www.wowhead.com/affix=158/xalataths-bargain-voidbound', color: '#a855f7' },
  162: { id: 162, name: "Xal'atath's Bargain: Pulsar", nickname: 'Touch 5 Orbs', keystoneLevel: '+4–11', wowheadUrl: 'https://www.wowhead.com/affix=162/xalataths-bargain-pulsar', color: '#a855f7' },
  160: { id: 160, name: "Xal'atath's Bargain: Devour", nickname: 'Dispel Allies', keystoneLevel: '+4–11', wowheadUrl: 'https://www.wowhead.com/affix=160/xalataths-bargain-devour', color: '#a855f7' },
};

// Fort/Tyran
export const FORT_TYRAN_AFFIXES: Record<number, AffixDisplay> = {
  10: { id: 10, name: 'Fortified', nickname: null, keystoneLevel: '+7', wowheadUrl: 'https://www.wowhead.com/affix=10/fortified', color: '#ef4444' },
  9: { id: 9, name: 'Tyrannical', nickname: null, keystoneLevel: '+7', wowheadUrl: 'https://www.wowhead.com/affix=9/tyrannical', color: '#ef4444' },
};

export function resolveAffixDisplay(affixId: number): AffixDisplay | null {
  return STATIC_AFFIXES.find(a => a.id === affixId)
    ?? BARGAIN_AFFIXES[affixId]
    ?? FORT_TYRAN_AFFIXES[affixId]
    ?? null;
}
