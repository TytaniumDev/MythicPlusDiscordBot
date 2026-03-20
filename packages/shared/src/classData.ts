import type { Role, Utility } from './types.js';

const CLASS_UTILITIES: Record<string, Utility[]> = {
  'Death Knight': ['brez'],
  'Druid': ['brez'],
  'Warlock': ['brez'],
  'Paladin': ['brez'],
  'Warrior': ['brez'],
  'Mage': ['lust'],
  'Shaman': ['lust'],
  'Evoker': ['lust'],
  'Hunter': ['brez', 'lust'],
};

export function getUtilitiesForClass(className: string): Utility[] {
  return CLASS_UTILITIES[className] ?? [];
}

const TANK_SPECS = new Set([
  'Protection',  // Warrior, Paladin
  'Blood',       // Death Knight
  'Vengeance',   // Demon Hunter
  'Guardian',    // Druid
  'Brewmaster',  // Monk
]);

const HEALER_SPECS = new Set([
  'Holy',          // Priest, Paladin
  'Discipline',    // Priest
  'Restoration',   // Druid, Shaman
  'Mistweaver',    // Monk
  'Preservation',  // Evoker
]);

// Ranged specs mapped as class:spec to avoid ambiguity (Frost Mage = ranged, Frost DK = melee)
const RANGED_CLASS_SPECS = new Set([
  'Mage:Frost',
  'Mage:Fire',
  'Mage:Arcane',
  'Druid:Balance',
  'Priest:Shadow',
  'Shaman:Elemental',
  'Warlock:Affliction',
  'Warlock:Demonology',
  'Warlock:Destruction',
  'Hunter:Beast Mastery',
  'Hunter:Marksmanship',
  'Evoker:Devastation',
  'Evoker:Augmentation',
  'Demon Hunter:Devourer',
]);

export function getRoleForSpec(specName: string, className: string): Role {
  if (TANK_SPECS.has(specName)) return 'tank';
  if (HEALER_SPECS.has(specName)) return 'healer';
  if (RANGED_CLASS_SPECS.has(`${className}:${specName}`)) return 'ranged';
  return 'melee';
}
