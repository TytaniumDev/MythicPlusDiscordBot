export type SessionStatus = 'lobby' | 'request_spin' | 'spinning' | 'completed';

export type Role = 'tank' | 'healer' | 'ranged' | 'melee';
export type Utility = 'brez' | 'lust';

export const CHARACTER_CLASSES = [
  'Death Knight',
  'Demon Hunter',
  'Druid',
  'Evoker',
  'Hunter',
  'Mage',
  'Monk',
  'Paladin',
  'Priest',
  'Rogue',
  'Shaman',
  'Warlock',
  'Warrior',
] as const;

export type CharacterClass = (typeof CHARACTER_CLASSES)[number];

/** Safely narrow an arbitrary value to CharacterClass, or null if it isn't a known class. */
export function toCharacterClass(raw: unknown): CharacterClass | null {
  if (typeof raw !== 'string') return null;
  return (CHARACTER_CLASSES as readonly string[]).includes(raw) ? (raw as CharacterClass) : null;
}

const ROLES: readonly Role[] = ['tank', 'healer', 'ranged', 'melee'];
const UTILITIES: readonly Utility[] = ['brez', 'lust'];

/** Safely narrow an arbitrary value to Role, or null if it isn't a known role. */
export function toRole(raw: unknown): Role | null {
  if (typeof raw !== 'string') return null;
  return (ROLES as readonly string[]).includes(raw) ? (raw as Role) : null;
}

/** Safely narrow an arbitrary value to Utility, or null if it isn't a known utility. */
export function toUtility(raw: unknown): Utility | null {
  if (typeof raw !== 'string') return null;
  return (UTILITIES as readonly string[]).includes(raw) ? (raw as Utility) : null;
}

export interface WoWPlayerDict {
  [key: string]: unknown;
  name: string;
  discordId: string;
  inGameName?: string;
  mainRole: Role | null;
  offspecs: Role[];
  utilities: Utility[];
  mediaUrl?: string | null;
  characterClass?: CharacterClass | null;
}

export interface AffixDisplay {
  id: number;
  name: string;
  nickname: string | null;
  keystoneLevel: string;
  wowheadUrl: string;
  color: string;
}

export interface WoWGroupDict {
  [key: string]: unknown;
  tank: WoWPlayerDict | null;
  healer: WoWPlayerDict | null;
  dps: WoWPlayerDict[];
}
