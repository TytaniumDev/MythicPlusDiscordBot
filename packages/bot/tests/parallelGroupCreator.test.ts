import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  WoWPlayer,
  WoWGroup,
  clear,
  setLastGroups,
  createMythicPlusGroups,
} from '@mythicplus/shared';
import {
  TankWarrior,
  TankDeathKnight,
  HealerDruid,
  HealerPriest,
  Mage,
  Paladin,
  BalanceDruid,
  FeralDruid,
  Warrior,
} from './prebuiltClasses.js';

describe('GroupCreator', () => {
  // Real example players
  let cynoc: WoWPlayer;
  let gazzi: WoWPlayer;
  let temma: WoWPlayer;
  let moriim: WoWPlayer;
  let sorovar: WoWPlayer;
  let selinora: WoWPlayer;
  let tytanium: WoWPlayer;
  let widdershins: WoWPlayer;
  let bevan: WoWPlayer;
  let poppybros: WoWPlayer;
  let mickey: WoWPlayer;
  let johng: WoWPlayer;
  let justine: WoWPlayer;
  let raxef: WoWPlayer;
  let kat: WoWPlayer;

  beforeEach(() => {
    clear();
    cynoc = WoWPlayer.create('Cynoc', ['Tank', 'Melee Offspec']);
    gazzi = WoWPlayer.create('Gazzi', ['Tank', 'Brez']);
    temma = WoWPlayer.create('Temma', ['Tank', 'Melee', 'Brez']);
    moriim = WoWPlayer.create('Moriim', [
      'Tank Offspec',
      'Healer Offspec',
      'Melee',
      'Ranged',
    ]);
    sorovar = WoWPlayer.create('Sorovar', ['Healer']);
    selinora = WoWPlayer.create('Selinora', ['Healer']);
    tytanium = WoWPlayer.create('Tytanium', ['Healer Offspec', 'Melee', 'Brez']);
    widdershins = WoWPlayer.create('Widdershins', [
      'Healer Offspec',
      'Ranged',
      'Lust',
    ]);
    bevan = WoWPlayer.create('Bevan', ['Ranged']);
    poppybros = WoWPlayer.create('Poppybros', ['Ranged', 'Lust']);
    mickey = WoWPlayer.create('Mickey', ['Melee']);
    johng = WoWPlayer.create('John G.', ['Melee', 'Brez']);
    justine = WoWPlayer.create('Justine', ['Melee', 'Brez']);
    raxef = WoWPlayer.create('Raxef', ['Melee']);
    kat = WoWPlayer.create('Kat', ['Melee']);
  });

  afterEach(() => {
    clear();
  });

  it('handles real world scenario', () => {
    const players = [
      cynoc, gazzi, temma, moriim, sorovar, selinora,
      tytanium, widdershins, bevan, poppybros, mickey,
      johng, justine, raxef, kat,
    ];
    const groups = createMythicPlusGroups(players);

    expect(groups.length).toBe(3);
    for (const group of groups) {
      expect(group.isComplete).toBe(true);
    }

    const utilityGroups = groups.filter((g) => g.hasBrez && g.hasLust);
    expect(utilityGroups.length).toBeGreaterThanOrEqual(2);

    for (const group of groups) {
      expect(group.hasBrez).toBe(true);
    }
  });

  it('handles small incomplete group', () => {
    const players = [gazzi, sorovar, tytanium, poppybros, raxef, temma, johng];
    const groups = createMythicPlusGroups(players);

    expect(groups.length).toBe(2);
    expect(groups[0].isComplete).toBe(true);
  });

  it('handles smallest incomplete group with just dps', () => {
    const players = [gazzi, sorovar, tytanium, poppybros, raxef, johng];
    const groups = createMythicPlusGroups(players);

    expect(groups.length).toBe(2);
    expect(groups[0].isComplete).toBe(true);
  });

  it('handles smallest incomplete group with just a tank', () => {
    const players = [gazzi, sorovar, tytanium, poppybros, raxef, temma];
    const groups = createMythicPlusGroups(players);

    expect(groups.length).toBe(2);
    expect(groups[0].isComplete).toBe(true);
  });

  it('handles smallest incomplete group with just a healer', () => {
    const players = [gazzi, sorovar, tytanium, poppybros, raxef, selinora];
    const groups = createMythicPlusGroups(players);

    expect(groups.length).toBe(2);
    expect(groups[0].isComplete).toBe(true);
  });

  it('distributes utilities', () => {
    const players = [
      TankWarrior('Tank1'),
      TankDeathKnight('Brez1'),
      HealerDruid('Brez2'),
      HealerPriest('Healer2'),
      Mage('Lust1'),
      Mage('Lust2'),
      Warrior('Warrior1'),
      Warrior('Warrior2'),
      FeralDruid('Feral1'),
      FeralDruid('Feral2'),
    ];
    const groups = createMythicPlusGroups(players);

    for (const group of groups) {
      expect(group.hasBrez && group.hasLust).toBe(true);
    }
  });

  it('uses offspecs when main specs exhausted', () => {
    const players = [
      TankWarrior('Tank1'),
      Paladin('Offtank', { offtank: true }),
      HealerDruid('Healer1'),
      BalanceDruid('Offhealer', { offhealer: true }),
      Mage('Mage1'),
      Mage('Mage2'),
      Warrior('Warrior1'),
      Warrior('Warrior2'),
      FeralDruid('Feral1'),
      FeralDruid('Feral2'),
    ];
    const groups = createMythicPlusGroups(players);

    expect(groups.length).toBe(2);
    for (const group of groups) {
      expect(group.isComplete).toBe(true);
    }
  });

  it('balances ranged and melee', () => {
    const players = [
      TankWarrior('Tank1'),
      TankWarrior('Tank2'),
      HealerDruid('Healer1'),
      HealerDruid('Healer2'),
      Mage('Mage1'),
      Mage('Mage2'),
      Warrior('Warrior1'),
      Warrior('Warrior2'),
      FeralDruid('Feral1'),
      FeralDruid('Feral2'),
    ];
    const groups = createMythicPlusGroups(players);

    expect(groups.length).toBe(2);
    for (const group of groups) {
      expect(group.hasRanged).toBe(true);
    }
  });

  it('handles weird remainder groups', () => {
    const players = [
      TankWarrior('Tank1'),
      TankWarrior('Tank2'),
      TankWarrior('Tank3'),
      TankWarrior('Tank4'),
      HealerDruid('Healer1'),
      Mage('Mage1'),
      Mage('Mage2'),
      Warrior('Warrior1'),
      Warrior('Warrior3'),
      Warrior('Warrior5'),
      Warrior('Warrior2'),
      FeralDruid('Feral1', { offhealer: true }),
      FeralDruid('Feral2'),
    ];
    const groups = createMythicPlusGroups(players);

    expect(groups.length).toBe(4);
    expect(groups[2].size).toBe(1);
    expect(groups[3].size).toBe(2);
  });

  it('avoids old teammates when possible', () => {
    const tank = TankWarrior('Tank');
    const healer = HealerPriest('Healer');
    const dps1 = Warrior('DPS1');
    const dps2 = Warrior('DPS2');
    const dps3 = Warrior('DPS3');
    const dps4 = Warrior('DPS4');
    const dps5 = Warrior('DPS5');
    const dps6 = Warrior('DPS6');

    // Setup history: Tank played with DPS1, DPS2, DPS3
    const g1 = new WoWGroup();
    g1.tank = tank;
    g1.dps = [dps1, dps2, dps3];
    setLastGroups([g1]);

    const allPlayers = [tank, healer, dps1, dps2, dps3, dps4, dps5, dps6];
    const groups = createMythicPlusGroups(allPlayers);

    expect(groups.length).toBeGreaterThanOrEqual(1);
    const group = groups[0];

    expect(group.tank!.equals(tank)).toBe(true);
    expect(group.healer!.equals(healer)).toBe(true);

    const dpsNames = new Set(group.dps.map((p) => p.name));
    const expectedFreshDps = new Set(['DPS4', 'DPS5', 'DPS6']);
    const intersection = new Set([...dpsNames].filter((n) => expectedFreshDps.has(n)));
    expect(intersection.size).toBe(3);
  });
});
