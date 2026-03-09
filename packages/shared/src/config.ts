// Discord role name constants (platform-agnostic defaults)
// Bot-specific env var overrides live in packages/bot/src/core/config.ts

export const ROLE_TANK = 'Tank';
export const ROLE_HEALER = 'Healer';
export const ROLE_RANGED = 'Ranged';
export const ROLE_MELEE = 'Melee';
export const ROLE_TANK_OFFSPEC = 'Tank Offspec';
export const ROLE_HEALER_OFFSPEC = 'Healer Offspec';
export const ROLE_RANGED_OFFSPEC = 'Ranged Offspec';
export const ROLE_MELEE_OFFSPEC = 'Melee Offspec';
export const ROLE_BREZ = 'Brez';
export const ROLE_LUST = 'Lust';

export const ALL_ROLES = [
  ROLE_TANK,
  ROLE_HEALER,
  ROLE_RANGED,
  ROLE_MELEE,
  ROLE_TANK_OFFSPEC,
  ROLE_HEALER_OFFSPEC,
  ROLE_RANGED_OFFSPEC,
  ROLE_MELEE_OFFSPEC,
  ROLE_BREZ,
  ROLE_LUST,
] as const;

export type RoleName = (typeof ALL_ROLES)[number];
