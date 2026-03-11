import { describe, it, expect } from 'vitest';
import { WoWPlayer, WoWGroup, generateInviteCommand, ROLE_TANK, ROLE_HEALER, ROLE_MELEE, ROLE_RANGED, ROLE_BREZ, ROLE_LUST } from '@mythicplus/shared';

describe('generateInviteCommand', () => {
  it('generates command for a full group', () => {
    const tank = WoWPlayer.create('TankPlayer', [ROLE_TANK]);
    const healer = WoWPlayer.create('HealerPlayer', [ROLE_HEALER]);
    const dps1 = WoWPlayer.create('DPS1', [ROLE_MELEE]);
    const dps2 = WoWPlayer.create('DPS2', [ROLE_RANGED]);
    const dps3 = WoWPlayer.create('DPS3', [ROLE_MELEE]);

    const group = new WoWGroup(tank, healer, [dps1, dps2, dps3]);
    const cmd = generateInviteCommand(group.toDict());

    expect(cmd).toBe(
      '/run local p={"HealerPlayer","DPS1","DPS2","DPS3"} for _,n in ipairs(p) do C_PartyInfo.InviteUnit(n) end',
    );
  });

  it('excludes the tank from invite list', () => {
    const tank = WoWPlayer.create('TankPlayer', [ROLE_TANK]);
    const healer = WoWPlayer.create('HealerPlayer', [ROLE_HEALER]);
    const dps1 = WoWPlayer.create('DPS1', [ROLE_MELEE]);

    const group = new WoWGroup(tank, healer, [dps1]);
    const cmd = generateInviteCommand(group.toDict());

    expect(cmd).toContain('"HealerPlayer"');
    expect(cmd).toContain('"DPS1"');
    expect(cmd).not.toContain('"TankPlayer"');
  });

  it('uses inGameName when set', () => {
    const tank = WoWPlayer.create('Tank', [ROLE_TANK], '', 'Tank-Sargeras');
    const healer = WoWPlayer.create('Healer', [ROLE_HEALER], '', 'Healer-Proudmoore');
    const dps1 = WoWPlayer.create('DPS1', [ROLE_MELEE], '', 'DPS1-Illidan');

    const group = new WoWGroup(tank, healer, [dps1]);
    const cmd = generateInviteCommand(group.toDict());

    expect(cmd).toContain('"Healer-Proudmoore"');
    expect(cmd).toContain('"DPS1-Illidan"');
    expect(cmd).not.toContain('"Tank-Sargeras"');
  });

  it('falls back to name when inGameName is empty', () => {
    const tank = WoWPlayer.create('Tank', [ROLE_TANK]);
    const healer = WoWPlayer.create('Healer', [ROLE_HEALER]);

    const group = new WoWGroup(tank, healer, []);
    const cmd = generateInviteCommand(group.toDict());

    expect(cmd).toContain('"Healer"');
  });

  it('handles realm names with hyphens', () => {
    const tank = WoWPlayer.create('Tank', [ROLE_TANK]);
    const healer = WoWPlayer.create('Healer', [ROLE_HEALER], '', 'Healbot-Area-52');

    const group = new WoWGroup(tank, healer, []);
    const cmd = generateInviteCommand(group.toDict());

    expect(cmd).toContain('"Healbot-Area-52"');
  });

  it('returns empty string for empty group', () => {
    const group = new WoWGroup(null, null, []);
    const cmd = generateInviteCommand(group.toDict());
    expect(cmd).toBe('');
  });

  it('returns empty string for tank-only group', () => {
    const tank = WoWPlayer.create('Tank', [ROLE_TANK]);
    const group = new WoWGroup(tank, null, []);
    const cmd = generateInviteCommand(group.toDict());
    expect(cmd).toBe('');
  });

  it('works with group missing tank', () => {
    const healer = WoWPlayer.create('Healer', [ROLE_HEALER]);
    const dps1 = WoWPlayer.create('DPS1', [ROLE_MELEE]);

    const group = new WoWGroup(null, healer, [dps1]);
    const cmd = generateInviteCommand(group.toDict());

    expect(cmd).toContain('"Healer"');
    expect(cmd).toContain('"DPS1"');
  });

  it('splits command when exceeding 255 chars', () => {
    const tank = WoWPlayer.create('T', [ROLE_TANK]);
    const healer = WoWPlayer.create('H', [ROLE_HEALER], '',
      'AVeryLongPlayerNameThatTakesUpSpace-AVeryLongServerNameThatAlsoTakesUpLotsOfSpace');
    const dps1 = WoWPlayer.create('D1', [ROLE_MELEE], '',
      'AnotherVeryLongPlayerName-AnotherVeryLongServerNameHere');
    const dps2 = WoWPlayer.create('D2', [ROLE_RANGED], '',
      'YetAnotherLongPlayerName-YetAnotherLongServerNameHere');
    const dps3 = WoWPlayer.create('D3', [ROLE_MELEE], '',
      'StillAnotherLongName-StillAnotherLongServerNameHere');

    const group = new WoWGroup(tank, healer, [dps1, dps2, dps3]);
    const cmd = generateInviteCommand(group.toDict());

    // Should be split into multiple lines
    const lines = cmd.split('\n');
    expect(lines.length).toBeGreaterThan(1);

    // Each line should be a valid /run command under 255 chars
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(255);
      expect(line).toMatch(/^\/run local p=\{/);
      expect(line).toContain('C_PartyInfo.InviteUnit');
    }
  });
});
