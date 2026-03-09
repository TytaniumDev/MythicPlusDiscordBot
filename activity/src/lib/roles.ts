import { WoWPlayer, WheelEntry } from '../types';

export interface RoleTag {
  label: string;
  cssClass: string;
}

export function hasAnyRole(p: WoWPlayer): boolean {
  return p.mainRole !== null || p.offspecs.length > 0;
}

export function getRoleTags(p: WoWPlayer): RoleTag[] {
  const tags: RoleTag[] = [];

  if (!hasAnyRole(p)) {
    tags.push({ label: 'No roles', cssClass: 'tag-unassigned' });
    return tags;
  }

  // Main roles
  if (p.mainRole === 'tank') tags.push({ label: 'Tank', cssClass: 'tag-tank' });
  if (p.mainRole === 'healer') tags.push({ label: 'Healer', cssClass: 'tag-healer' });
  if (p.mainRole === 'ranged') tags.push({ label: 'Ranged', cssClass: 'tag-dps' });
  if (p.mainRole === 'melee') tags.push({ label: 'Melee', cssClass: 'tag-dps' });

  // Offspecs (only show if the corresponding main spec is not active)
  if (p.offspecs.includes('tank') && p.mainRole !== 'tank') tags.push({ label: 'Offtank', cssClass: 'tag-tank tag-offspec' });
  if (p.offspecs.includes('healer') && p.mainRole !== 'healer') tags.push({ label: 'Offheal', cssClass: 'tag-healer tag-offspec' });
  if (p.offspecs.includes('ranged') && p.mainRole !== 'ranged') tags.push({ label: 'Off Ranged', cssClass: 'tag-dps tag-offspec' });
  if (p.offspecs.includes('melee') && p.mainRole !== 'melee') tags.push({ label: 'Off Melee', cssClass: 'tag-dps tag-offspec' });

  // Utilities
  if (p.utilities.includes('brez')) tags.push({ label: 'Brez', cssClass: 'tag-brez' });
  if (p.utilities.includes('lust')) tags.push({ label: 'Lust', cssClass: 'tag-lust' });

  return tags;
}

export function getPrimaryRole(p: WoWPlayer): string {
  return p.mainRole ?? 'unassigned';
}

export function formatRoleName(role: string): string {
  if (role === 'unassigned') return 'Unassigned';
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
}

export function utilityIcons(player?: WoWPlayer | null): string {
  if (!player) return '';
  let icons = '';
  if (player.utilities.includes('brez')) icons += ' \u26B0\uFE0F';
  if (player.utilities.includes('lust')) icons += ' \uD83C\uDFBA';
  return icons;
}

export function playerRolesToStringArray(p: WoWPlayer): string[] {
  const roles: string[] = [];
  if (p.mainRole === 'tank') roles.push('Tank');
  if (p.mainRole === 'healer') roles.push('Healer');
  if (p.mainRole === 'ranged') roles.push('Ranged');
  if (p.mainRole === 'melee') roles.push('Melee');
  if (p.offspecs.includes('tank')) roles.push('Tank Offspec');
  if (p.offspecs.includes('healer')) roles.push('Healer Offspec');
  if (p.offspecs.includes('ranged')) roles.push('Ranged Offspec');
  if (p.offspecs.includes('melee')) roles.push('Melee Offspec');
  if (p.utilities.includes('brez')) roles.push('Brez');
  if (p.utilities.includes('lust')) roles.push('Lust');
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
    .filter((p) => p.mainRole === 'tank' || p.offspecs.includes('tank'))
    .map((p) => ({ name: p.name, isOffspec: p.mainRole !== 'tank' }));

  const healers = players
    .filter((p) => p.mainRole === 'healer' || p.offspecs.includes('healer'))
    .map((p) => ({ name: p.name, isOffspec: p.mainRole !== 'healer' }));

  const dps = players
    .filter((p) => p.mainRole === 'ranged' || p.mainRole === 'melee' || p.offspecs.includes('ranged') || p.offspecs.includes('melee'))
    .map((p) => ({ name: p.name, isOffspec: p.mainRole !== 'ranged' && p.mainRole !== 'melee' }));

  return { tanks, healers, dps };
}
