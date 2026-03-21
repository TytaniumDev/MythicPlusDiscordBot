import type { Role, Utility } from '@mythicplus/shared';
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

const MAIN_ROLE_MAP: Record<string, Role> = { Tank: 'tank', Healer: 'healer', Ranged: 'ranged', Melee: 'melee' };
const OFFSPEC_MAP: Record<string, Role> = { 'Tank Offspec': 'tank', 'Healer Offspec': 'healer', 'Ranged Offspec': 'ranged', 'Melee Offspec': 'melee' };
const UTILITY_MAP: Record<string, Utility> = { Brez: 'brez', Lust: 'lust' };

/** Convert a set of role button IDs back to WoWPlayer role fields. */
export function roleStringsToPlayerFields(roles: Iterable<string>): { mainRole: Role | null; offspecs: Role[]; utilities: Utility[] } {
  let mainRole: Role | null = null;
  const offspecs: Role[] = [];
  const utilities: Utility[] = [];
  for (const r of roles) {
    if (MAIN_ROLE_MAP[r]) mainRole = MAIN_ROLE_MAP[r];
    else if (OFFSPEC_MAP[r]) offspecs.push(OFFSPEC_MAP[r]);
    else if (UTILITY_MAP[r]) utilities.push(UTILITY_MAP[r]);
  }
  return { mainRole, offspecs, utilities };
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

/**
 * Pure function to compute the next role set after toggling a role button.
 * Handles main/offspec swap logic:
 * - Switching main spec removes it from offspec and swaps old main into offspec
 * - Adding an offspec that matches current main is a no-op
 */
export function computeToggledRoles(
  prev: ReadonlySet<string>,
  roleId: string,
  mutuallyExclusive: boolean,
): Set<string> {
  const next = new Set(prev);

  if (next.has(roleId)) {
    next.delete(roleId);
    return next;
  }

  if (mutuallyExclusive) {
    const oldMain = MAIN_SPEC_BUTTONS.find((b) => next.has(b.id));
    MAIN_SPEC_BUTTONS.forEach((b) => next.delete(b.id));
    next.add(roleId);

    // If the new main was an offspec, swap: remove it from offspec, add old main as offspec
    const newOffspecId = `${roleId} Offspec`;
    if (next.has(newOffspecId)) {
      next.delete(newOffspecId);
      if (oldMain) {
        next.add(`${oldMain.id} Offspec`);
      }
    }
  } else {
    // Offspec toggle: don't allow offspec matching current main
    const mainId = roleId.replace(' Offspec', '');
    if (MAIN_SPEC_BUTTONS.some((b) => b.id === mainId && next.has(b.id))) {
      return new Set(prev); // no-op
    }
    next.add(roleId);
  }

  return next;
}

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
