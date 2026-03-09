import { WoWPlayer } from '@mythicplus/shared';

// Tanks
export function TankPaladin(
  name: string,
  { offhealer = false, offdps = false } = {},
): WoWPlayer {
  return WoWPlayer.fromFlags({
    name,
    tankMain: true,
    hasBrez: true,
    offhealer,
    offdps,
  });
}

export function TankWarrior(name: string, { offdps = false } = {}): WoWPlayer {
  return WoWPlayer.fromFlags({ name, tankMain: true, offdps });
}

export function TankDruid(
  name: string,
  { offhealer = false, offdps = false } = {},
): WoWPlayer {
  return WoWPlayer.fromFlags({
    name,
    tankMain: true,
    hasBrez: true,
    offhealer,
    offdps,
  });
}

export function TankDeathKnight(name: string, { offdps = false } = {}): WoWPlayer {
  return WoWPlayer.fromFlags({ name, tankMain: true, hasBrez: true, offdps });
}

export function TankMonk(
  name: string,
  { offhealer = false, offdps = false } = {},
): WoWPlayer {
  return WoWPlayer.fromFlags({ name, tankMain: true, offhealer, offdps });
}

export function TankDemonHunter(name: string, { offdps = false } = {}): WoWPlayer {
  return WoWPlayer.fromFlags({ name, tankMain: true, offdps });
}

// Healers
export function HealerPaladin(
  name: string,
  { offtank = false, offdps = false } = {},
): WoWPlayer {
  return WoWPlayer.fromFlags({
    name,
    healerMain: true,
    hasBrez: true,
    offtank,
    offdps,
  });
}

export function HealerPriest(name: string, { offdps = false } = {}): WoWPlayer {
  return WoWPlayer.fromFlags({ name, healerMain: true, offdps });
}

export function HealerShaman(name: string, { offdps = false } = {}): WoWPlayer {
  return WoWPlayer.fromFlags({ name, healerMain: true, hasLust: true, offdps });
}

export function HealerDruid(
  name: string,
  { offtank = false, offdps = false } = {},
): WoWPlayer {
  return WoWPlayer.fromFlags({
    name,
    healerMain: true,
    hasBrez: true,
    offtank,
    offdps,
  });
}

export function HealerEvoker(name: string, { offdps = false } = {}): WoWPlayer {
  return WoWPlayer.fromFlags({ name, healerMain: true, hasLust: true, offdps });
}

export function HealerMonk(
  name: string,
  { offtank = false, offdps = false } = {},
): WoWPlayer {
  return WoWPlayer.fromFlags({ name, healerMain: true, offtank, offdps });
}

// DPS
export function DeathKnight(name: string, { offtank = false } = {}): WoWPlayer {
  return WoWPlayer.fromFlags({
    name,
    dpsMain: true,
    melee: true,
    hasBrez: true,
    offtank,
  });
}

export function DemonHunter(name: string, { offtank = false } = {}): WoWPlayer {
  return WoWPlayer.fromFlags({ name, dpsMain: true, melee: true, offtank });
}

export function BalanceDruid(
  name: string,
  { offtank = false, offhealer = false } = {},
): WoWPlayer {
  return WoWPlayer.fromFlags({
    name,
    dpsMain: true,
    ranged: true,
    hasBrez: true,
    offhealer,
    offtank,
  });
}

export function FeralDruid(
  name: string,
  { offtank = false, offhealer = false } = {},
): WoWPlayer {
  return WoWPlayer.fromFlags({
    name,
    dpsMain: true,
    melee: true,
    hasBrez: true,
    offhealer,
    offtank,
  });
}

export function Evoker(name: string, { offhealer = false } = {}): WoWPlayer {
  return WoWPlayer.fromFlags({
    name,
    dpsMain: true,
    ranged: true,
    hasLust: true,
    offhealer,
  });
}

export function Hunter(name: string): WoWPlayer {
  return WoWPlayer.fromFlags({
    name,
    dpsMain: true,
    ranged: true,
    hasLust: true,
  });
}

export function Mage(name: string): WoWPlayer {
  return WoWPlayer.fromFlags({
    name,
    dpsMain: true,
    ranged: true,
    hasLust: true,
  });
}

export function Monk(
  name: string,
  { offtank = false, offhealer = false } = {},
): WoWPlayer {
  return WoWPlayer.fromFlags({ name, dpsMain: true, melee: true, offhealer, offtank });
}

export function Paladin(
  name: string,
  { offtank = false, offhealer = false } = {},
): WoWPlayer {
  return WoWPlayer.fromFlags({
    name,
    dpsMain: true,
    melee: true,
    hasBrez: true,
    offhealer,
    offtank,
  });
}

export function Priest(name: string, { offhealer = false } = {}): WoWPlayer {
  return WoWPlayer.fromFlags({ name, dpsMain: true, ranged: true, offhealer });
}

export function Rogue(name: string): WoWPlayer {
  return WoWPlayer.fromFlags({ name, dpsMain: true, melee: true });
}

export function Shaman(name: string, { offhealer = false } = {}): WoWPlayer {
  return WoWPlayer.fromFlags({
    name,
    dpsMain: true,
    ranged: true,
    hasLust: true,
    offhealer,
  });
}

export function Warlock(name: string): WoWPlayer {
  return WoWPlayer.fromFlags({ name, dpsMain: true, ranged: true });
}

export function Warrior(name: string, { offtank = false } = {}): WoWPlayer {
  return WoWPlayer.fromFlags({ name, dpsMain: true, melee: true, offtank });
}
