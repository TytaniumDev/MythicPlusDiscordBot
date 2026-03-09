import { WoWPlayer, WheelEntry } from '../types';

export interface RoleTag {
  label: string;
  cssClass: string;
}

export function hasAnyRole(p: WoWPlayer): boolean {
  return p.roles.tankMain || p.roles.healerMain || p.roles.dpsMain ||
    p.roles.offtank || p.roles.offhealer || p.roles.offdps ||
    p.roles.offranged || p.roles.offmelee;
}

export function getRoleTags(p: WoWPlayer): RoleTag[] {
  const tags: RoleTag[] = [];

  if (!hasAnyRole(p)) {
    tags.push({ label: 'No roles', cssClass: 'tag-unassigned' });
    return tags;
  }

  // Main roles
  if (p.roles.tankMain) tags.push({ label: 'Tank', cssClass: 'tag-tank' });
  if (p.roles.healerMain) tags.push({ label: 'Healer', cssClass: 'tag-healer' });
  if (p.roles.ranged) tags.push({ label: 'Ranged', cssClass: 'tag-dps' });
  if (p.roles.melee) tags.push({ label: 'Melee', cssClass: 'tag-dps' });

  // Offspecs (only show if the corresponding main spec is not active)
  if (p.roles.offtank && !p.roles.tankMain) tags.push({ label: 'Offtank', cssClass: 'tag-tank tag-offspec' });
  if (p.roles.offhealer && !p.roles.healerMain) tags.push({ label: 'Offheal', cssClass: 'tag-healer tag-offspec' });
  if (p.roles.offranged && !p.roles.ranged) tags.push({ label: 'Off Ranged', cssClass: 'tag-dps tag-offspec' });
  if (p.roles.offmelee && !p.roles.melee) tags.push({ label: 'Off Melee', cssClass: 'tag-dps tag-offspec' });

  // Utilities
  if (p.roles.hasBrez) tags.push({ label: 'Brez', cssClass: 'tag-brez' });
  if (p.roles.hasLust) tags.push({ label: 'Lust', cssClass: 'tag-lust' });

  return tags;
}

export function getPrimaryRole(p: WoWPlayer): string {
  if (p.roles.tankMain) return 'tank';
  if (p.roles.healerMain) return 'healer';
  if (p.roles.ranged) return 'ranged';
  if (p.roles.melee) return 'melee';
  return 'unassigned';
}

export function formatRoleName(role: string): string {
  if (role === 'unassigned') return 'Unassigned';
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
}

export function utilityIcons(player?: WoWPlayer | null): string {
  if (!player) return '';
  let icons = '';
  if (player.roles.hasBrez) icons += ' \u26B0\uFE0F';
  if (player.roles.hasLust) icons += ' \uD83C\uDFBA';
  return icons;
}

export function playerRolesToStringArray(p: WoWPlayer): string[] {
  const roles: string[] = [];
  if (p.roles.tankMain) roles.push('Tank');
  if (p.roles.healerMain) roles.push('Healer');
  if (p.roles.ranged) roles.push('Ranged');
  if (p.roles.melee) roles.push('Melee');
  if (p.roles.offtank) roles.push('Tank Offspec');
  if (p.roles.offhealer) roles.push('Healer Offspec');
  if (p.roles.offranged) roles.push('Ranged Offspec');
  if (p.roles.offmelee) roles.push('Melee Offspec');
  if (p.roles.hasBrez) roles.push('Brez');
  if (p.roles.hasLust) roles.push('Lust');
  return roles;
}

export interface RoleButtonDef {
  id: string;
  label: string;
  activeClass: string;
}

export const MAIN_SPEC_BUTTONS: RoleButtonDef[] = [
  { id: 'Tank', label: 'Tank', activeClass: 'active-tank' },
  { id: 'Healer', label: 'Healer', activeClass: 'active-healer' },
  { id: 'Ranged', label: 'Ranged', activeClass: 'active-dps' },
  { id: 'Melee', label: 'Melee', activeClass: 'active-dps' },
];

export const OFFSPEC_BUTTONS: RoleButtonDef[] = [
  { id: 'Tank Offspec', label: 'Tank', activeClass: 'active-tank' },
  { id: 'Healer Offspec', label: 'Healer', activeClass: 'active-healer' },
  { id: 'Ranged Offspec', label: 'Ranged', activeClass: 'active-dps' },
  { id: 'Melee Offspec', label: 'Melee', activeClass: 'active-dps' },
];

export const UTILITY_BUTTONS: RoleButtonDef[] = [
  { id: 'Brez', label: 'Brez', activeClass: 'active-brez' },
  { id: 'Lust', label: 'Lust', activeClass: 'active-lust' },
];

export function initPools(players: WoWPlayer[]): { tanks: WheelEntry[]; healers: WheelEntry[]; dps: WheelEntry[] } {
  const tanks = players
    .filter((p) => p.roles.tankMain || p.roles.offtank)
    .map((p) => ({ name: p.name, isOffspec: !p.roles.tankMain }));

  const healers = players
    .filter((p) => p.roles.healerMain || p.roles.offhealer)
    .map((p) => ({ name: p.name, isOffspec: !p.roles.healerMain }));

  const dps = players
    .filter((p) => p.roles.dpsMain || p.roles.offdps)
    .map((p) => ({ name: p.name, isOffspec: !p.roles.dpsMain }));

  return { tanks, healers, dps };
}
