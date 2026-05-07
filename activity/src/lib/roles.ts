import type { Role, Utility } from '@mythicplus/shared';
import { WoWPlayer, WheelEntry } from '../types';

export interface RoleTag {
  label: string;
  cssClass: string;
}

interface RoleTagDef {
  role: Role;
  /** String id used by RoleEditor button toggles (e.g. 'Tank'). */
  stringId: string;
  mainLabel: string;
  mainClass: string;
  offspecLabel: string;
  offspecClass: string;
}

const ROLE_TAG_DEFS: readonly RoleTagDef[] = [
  { role: 'tank',   stringId: 'Tank',   mainLabel: 'Tank',   mainClass: 'tag-tank',   offspecLabel: 'Offtank',    offspecClass: 'tag-tank tag-offspec' },
  { role: 'healer', stringId: 'Healer', mainLabel: 'Healer', mainClass: 'tag-healer', offspecLabel: 'Offheal',    offspecClass: 'tag-healer tag-offspec' },
  { role: 'ranged', stringId: 'Ranged', mainLabel: 'Ranged', mainClass: 'tag-dps',    offspecLabel: 'Off Ranged', offspecClass: 'tag-dps tag-offspec' },
  { role: 'melee',  stringId: 'Melee',  mainLabel: 'Melee',  mainClass: 'tag-dps',    offspecLabel: 'Off Melee',  offspecClass: 'tag-dps tag-offspec' },
];

interface UtilityTagDef {
  utility: Utility;
  stringId: string;
  label: string;
  cssClass: string;
}

const UTILITY_TAG_DEFS: readonly UtilityTagDef[] = [
  { utility: 'brez', stringId: 'Brez', label: 'Brez', cssClass: 'tag-brez' },
  { utility: 'lust', stringId: 'Lust', label: 'Lust', cssClass: 'tag-lust' },
];

export function hasAnyRole(p: WoWPlayer): boolean {
  return p.mainRole !== null || p.offspecs.length > 0;
}

export function getRoleTags(p: WoWPlayer): RoleTag[] {
  if (!hasAnyRole(p)) {
    return [{ label: 'No roles', cssClass: 'tag-unassigned' }];
  }

  const tags: RoleTag[] = [];
  for (const def of ROLE_TAG_DEFS) {
    if (p.mainRole === def.role) tags.push({ label: def.mainLabel, cssClass: def.mainClass });
  }
  // Offspec tags are only shown when the corresponding main spec is not active.
  for (const def of ROLE_TAG_DEFS) {
    if (p.offspecs.includes(def.role) && p.mainRole !== def.role) {
      tags.push({ label: def.offspecLabel, cssClass: def.offspecClass });
    }
  }
  for (const def of UTILITY_TAG_DEFS) {
    if (p.utilities.includes(def.utility)) tags.push({ label: def.label, cssClass: def.cssClass });
  }
  return tags;
}

export function getPrimaryRole(p: WoWPlayer): string {
  return p.mainRole ?? 'unassigned';
}

export function formatRoleName(role: string): string {
  if (role === 'unassigned') return 'Unassigned';
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
}

/** CSS variable color for a role key (including 'unassigned'). */
export const ROLE_COLOR_MAP: Record<string, string> = {
  tank: 'var(--color-tank)',
  healer: 'var(--color-healer)',
  ranged: 'var(--color-dps)',
  melee: 'var(--color-dps)',
  unassigned: 'var(--text-secondary)',
};

export function getRoleColor(role: string): string {
  return ROLE_COLOR_MAP[role] ?? ROLE_COLOR_MAP.unassigned;
}

/** Display labels keyed by role. */
export const ROLE_LABELS: Record<string, string> = {
  tank: 'Tank',
  healer: 'Healer',
  ranged: 'Ranged',
  melee: 'Melee',
  unassigned: 'Unassigned',
};

export function utilityIcons(player?: WoWPlayer | null): string {
  if (!player) return '';
  let icons = '';
  if (player.utilities.includes('brez')) icons += ' \u26B0\uFE0F';
  if (player.utilities.includes('lust')) icons += ' \uD83C\uDFBA';
  return icons;
}

const offspecStringId = (def: RoleTagDef): string => `${def.stringId} Offspec`;

const MAIN_ROLE_MAP: Record<string, Role> = Object.fromEntries(
  ROLE_TAG_DEFS.map((d) => [d.stringId, d.role]),
);
const OFFSPEC_MAP: Record<string, Role> = Object.fromEntries(
  ROLE_TAG_DEFS.map((d) => [offspecStringId(d), d.role]),
);
const UTILITY_MAP: Record<string, Utility> = Object.fromEntries(
  UTILITY_TAG_DEFS.map((d) => [d.stringId, d.utility]),
);

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
  for (const def of ROLE_TAG_DEFS) {
    if (p.mainRole === def.role) roles.push(def.stringId);
  }
  for (const def of ROLE_TAG_DEFS) {
    if (p.offspecs.includes(def.role)) roles.push(offspecStringId(def));
  }
  for (const def of UTILITY_TAG_DEFS) {
    if (p.utilities.includes(def.utility)) roles.push(def.stringId);
  }
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
  const entry = (p: WoWPlayer, isOffspec: boolean): WheelEntry => ({
    name: p.name,
    isOffspec,
    mediaUrl: p.mediaUrl ?? null,
    characterClass: p.characterClass ?? null,
  });

  const tanks = players
    .filter((p) => p.mainRole === 'tank' || p.offspecs.includes('tank'))
    .map((p) => entry(p, p.mainRole !== 'tank'));

  const healers = players
    .filter((p) => p.mainRole === 'healer' || p.offspecs.includes('healer'))
    .map((p) => entry(p, p.mainRole !== 'healer'));

  const dps = players
    .filter((p) => p.mainRole === 'ranged' || p.mainRole === 'melee' || p.offspecs.includes('ranged') || p.offspecs.includes('melee'))
    .map((p) => entry(p, p.mainRole !== 'ranged' && p.mainRole !== 'melee'));

  return { tanks, healers, dps };
}

/** A player is "ready" when they have a WoW name and a main role. */
export function isPlayerReady(p: WoWPlayer): boolean {
  return !!p.inGameName && p.mainRole !== null;
}

/** Players not in the sitting-out set. Players without a discordId are always active. */
function activePlayers(players: WoWPlayer[], sittingOut: string[]): WoWPlayer[] {
  return players.filter((p) => !p.discordId || !sittingOut.includes(p.discordId));
}

/** Count ready players from a list, excluding sitting-out players. */
export function getReadyCount(players: WoWPlayer[], sittingOut: string[]): { ready: number; total: number } {
  const active = activePlayers(players, sittingOut);
  return { ready: active.filter(isPlayerReady).length, total: active.length };
}

/** Categorize unready players for the spin warning dialog. */
export function categorizeUnreadyPlayers(players: WoWPlayer[], sittingOut: string[]): {
  missingRole: WoWPlayer[];
  missingNameOnly: WoWPlayer[];
  missingCharacterLookup: WoWPlayer[];
} {
  const active = activePlayers(players, sittingOut);
  return {
    missingRole: active.filter((p) => p.mainRole === null),
    missingNameOnly: active.filter((p) => p.mainRole !== null && !p.inGameName),
    missingCharacterLookup: active.filter(
      (p) => p.mainRole !== null && !!p.inGameName && !p.mediaUrl,
    ),
  };
}
