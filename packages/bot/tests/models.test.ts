import { describe, it, expect, beforeEach } from 'vitest';
import {
  WoWPlayer,
  WoWGroup,
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
} from '@mythicplus/shared';

describe('WoWPlayer', () => {
  it('creates a tank', () => {
    const player = WoWPlayer.create('TankPlayer', [ROLE_TANK]);
    expect(player.tankMain).toBe(true);
    expect(player.healerMain).toBe(false);
    expect(player.dpsMain).toBe(false);
  });

  it('creates a healer', () => {
    const player = WoWPlayer.create('HealerPlayer', [ROLE_HEALER]);
    expect(player.tankMain).toBe(false);
    expect(player.healerMain).toBe(true);
    expect(player.dpsMain).toBe(false);
  });

  it('creates DPS variations', () => {
    const ranged = WoWPlayer.create('RangedPlayer', [ROLE_RANGED]);
    expect(ranged.dpsMain).toBe(true);
    expect(ranged.ranged).toBe(true);
    expect(ranged.melee).toBe(false);

    const melee = WoWPlayer.create('MeleePlayer', [ROLE_MELEE]);
    expect(melee.dpsMain).toBe(true);
    expect(melee.melee).toBe(true);
    expect(melee.ranged).toBe(false);
  });

  it('creates offspecs', () => {
    const player = WoWPlayer.create('OffspecPlayer', [
      ROLE_TANK_OFFSPEC,
      ROLE_HEALER_OFFSPEC,
      ROLE_RANGED_OFFSPEC,
    ]);
    expect(player.offtank).toBe(true);
    expect(player.offhealer).toBe(true);
    expect(player.offdps).toBe(true);
    expect(player.offranged).toBe(true);
  });

  it('creates offspec melee', () => {
    const player = WoWPlayer.create('OffMelee', [ROLE_MELEE_OFFSPEC]);
    expect(player.offdps).toBe(true);
    expect(player.offmelee).toBe(true);
    expect(player.offranged).toBe(false);
  });

  it('creates utilities', () => {
    const player = WoWPlayer.create('UtilPlayer', [ROLE_BREZ, ROLE_LUST]);
    expect(player.hasBrez).toBe(true);
    expect(player.hasLust).toBe(true);
  });

  it('checks hasRoles', () => {
    const noRole = WoWPlayer.create('NoRole', []);
    expect(noRole.hasRoles()).toBe(false);

    const hasRole = WoWPlayer.create('HasRole', [ROLE_TANK]);
    expect(hasRole.hasRoles()).toBe(true);

    const offspecOnly = WoWPlayer.create('OffspecOnly', [ROLE_MELEE_OFFSPEC]);
    expect(offspecOnly.hasRoles()).toBe(true);
  });

  it('creates with discord ID', () => {
    const player = WoWPlayer.create('TestPlayer', [ROLE_TANK], '12345');
    expect(player.discordId).toBe('12345');
    expect(player.tankMain).toBe(true);
  });

  it('defaults discord ID to empty', () => {
    const player = WoWPlayer.create('TestPlayer', [ROLE_TANK]);
    expect(player.discordId).toBe('');
  });

  it('serializes and deserializes', () => {
    const original = WoWPlayer.create('TestPlayer', [ROLE_TANK, ROLE_BREZ], '99999');
    const data = original.toDict();
    const restored = WoWPlayer.fromDict(data);

    expect(original.name).toBe(restored.name);
    expect(original.discordId).toBe(restored.discordId);
    expect(original.tankMain).toBe(restored.tankMain);
    expect(original.hasBrez).toBe(restored.hasBrez);
    expect(original.equals(restored)).toBe(true);
    expect(data.discordId).toBe('99999');
  });

  it('deserializes with missing discord ID', () => {
    const data = {
      name: 'Legacy',
      roles: { tankMain: true },
    };
    const player = WoWPlayer.fromDict(data);
    expect(player.discordId).toBe('');
    expect(player.tankMain).toBe(true);
  });

  it('creates with inGameName', () => {
    const player = WoWPlayer.create('Panda', [ROLE_TANK], '123', 'Pandemonium-Sargeras');
    expect(player.inGameName).toBe('Pandemonium-Sargeras');
    expect(player.inviteName).toBe('Pandemonium-Sargeras');
  });

  it('inviteName falls back to name when inGameName is empty', () => {
    const player = WoWPlayer.create('Panda', [ROLE_TANK], '123');
    expect(player.inGameName).toBe('');
    expect(player.inviteName).toBe('Panda');
  });

  it('round-trips inGameName through toDict/fromDict', () => {
    const original = WoWPlayer.create('Panda', [ROLE_TANK, ROLE_BREZ], '123', 'Pandemonium-Sargeras');
    const data = original.toDict();
    expect(data.inGameName).toBe('Pandemonium-Sargeras');

    const restored = WoWPlayer.fromDict(data);
    expect(restored.inGameName).toBe('Pandemonium-Sargeras');
    expect(restored.inviteName).toBe('Pandemonium-Sargeras');
  });

  it('fromDict handles missing inGameName', () => {
    const data = {
      name: 'Panda',
      discordId: '123',
      mainRole: 'tank' as const,
      offspecs: [],
      utilities: [],
    };
    const player = WoWPlayer.fromDict(data);
    expect(player.inGameName).toBe('');
    expect(player.inviteName).toBe('Panda');
  });

  it('fromFlags accepts inGameName', () => {
    const player = WoWPlayer.fromFlags({
      name: 'Panda',
      discordId: '123',
      inGameName: 'Pandemonium-Sargeras',
      tankMain: true,
    });
    expect(player.inGameName).toBe('Pandemonium-Sargeras');
    expect(player.inviteName).toBe('Pandemonium-Sargeras');
  });
});

describe('WoWGroup', () => {
  let tank: WoWPlayer;
  let healer: WoWPlayer;
  let dps1: WoWPlayer;
  let dps2: WoWPlayer;
  let dps3: WoWPlayer;
  let lustPlayer: WoWPlayer;

  beforeEach(() => {
    tank = WoWPlayer.create('Tank', [ROLE_TANK]);
    healer = WoWPlayer.create('Healer', [ROLE_HEALER]);
    dps1 = WoWPlayer.create('DPS1', [ROLE_MELEE]);
    dps2 = WoWPlayer.create('DPS2', [ROLE_RANGED]);
    dps3 = WoWPlayer.create('DPS3', [ROLE_MELEE, ROLE_BREZ]);
    lustPlayer = WoWPlayer.create('LustPlayer', [ROLE_RANGED, ROLE_LUST]);
  });

  it('computes group properties', () => {
    const group = new WoWGroup(tank, healer, [dps1, dps2, dps3]);

    expect(group.isComplete).toBe(true);
    expect(group.size).toBe(5);
    expect(group.hasBrez).toBe(true);
    expect(group.hasRanged).toBe(true);
    expect(group.hasLust).toBe(false);
  });

  it('detects incomplete group', () => {
    const group = new WoWGroup(tank, healer, [dps1]);
    expect(group.isComplete).toBe(false);
    expect(group.size).toBe(3);
  });

  it('detects lust', () => {
    const group = new WoWGroup(tank, healer, [dps1, dps2, lustPlayer]);
    expect(group.hasLust).toBe(true);
  });

  it('serializes', () => {
    const group = new WoWGroup(tank, healer, [dps1]);
    const data = group.toDict();

    expect(data.tank!.name).toBe('Tank');
    expect(data.healer!.name).toBe('Healer');
    expect(data.dps.length).toBe(1);
    expect(data.dps[0].name).toBe('DPS1');
  });

  it('round-trip serializes', () => {
    const group = new WoWGroup(tank, healer, [dps1, dps2, dps3]);
    const data = group.toDict();
    const restored = WoWGroup.fromDict(data);

    expect(restored.tank!.equals(group.tank!)).toBe(true);
    expect(restored.healer!.equals(group.healer!)).toBe(true);
    expect(restored.dps.length).toBe(3);
    for (let i = 0; i < group.dps.length; i++) {
      expect(restored.dps[i].equals(group.dps[i])).toBe(true);
    }
    expect(restored.hasBrez).toBe(group.hasBrez);
    expect(restored.hasLust).toBe(group.hasLust);
  });

  it('deserializes empty group', () => {
    const data = { tank: null, healer: null, dps: [] };
    const restored = WoWGroup.fromDict(data);

    expect(restored.tank).toBeNull();
    expect(restored.healer).toBeNull();
    expect(restored.dps).toEqual([]);
  });
});
