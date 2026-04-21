import type { CharacterClass } from '@mythicplus/shared';

// Blizzard's official WoW class colors, keyed by canonical class name.
const CLASS_COLORS: Record<CharacterClass, string> = {
  'Death Knight': '#C41E3A',
  'Demon Hunter': '#A330C9',
  'Druid': '#FF7C0A',
  'Evoker': '#33937F',
  'Hunter': '#AAD372',
  'Mage': '#3FC7EB',
  'Monk': '#00FF98',
  'Paladin': '#F48CBA',
  'Priest': '#FFFFFF',
  'Rogue': '#FFF468',
  'Shaman': '#0070DD',
  'Warlock': '#8788EE',
  'Warrior': '#C69B6D',
};

export function getClassColor(className: CharacterClass | null | undefined): string | null {
  if (!className) return null;
  return CLASS_COLORS[className] ?? null;
}
