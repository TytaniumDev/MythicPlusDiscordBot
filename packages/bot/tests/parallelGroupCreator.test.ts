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
  HealerMonk,
  HealerPriest,
  Mage,
  Paladin,
  BalanceDruid,
  FeralDruid,
  Rogue,
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

  it('does not consume healer-capable offtank when non-healer offtank available', () => {
    // Reproduction of production bug: 15 players, Quill (healer main + offtank)
    // was consumed as tank instead of jim (melee main + offtank only).
    // Run multiple trials to account for shuffle nondeterminism.
    for (let trial = 0; trial < 20; trial++) {
      clear();
      const players = [
        WoWPlayer.create('Temma', ['Tank', 'Melee Offspec', 'Brez']),
        WoWPlayer.create('Gazzi', ['Tank', 'Brez']),
        WoWPlayer.create('Quill', [
          'Healer',
          'Tank Offspec',
          'Ranged Offspec',
          'Melee Offspec',
          'Brez',
        ]),
        WoWPlayer.create('Sorovar', ['Healer']),
        WoWPlayer.create('Vanyali', ['Ranged']),
        WoWPlayer.create('Tytaniormu', ['Ranged', 'Lust']),
        WoWPlayer.create('Heretofore', ['Ranged', 'Lust']),
        WoWPlayer.create('Poppybrosjr', ['Ranged', 'Lust']),
        WoWPlayer.create('Volkareth', ['Ranged', 'Healer Offspec', 'Lust']),
        WoWPlayer.create('John G', ['Melee', 'Brez']),
        WoWPlayer.create('jim', ['Melee', 'Tank Offspec']),
        WoWPlayer.create('Raxef', ['Melee']),
        WoWPlayer.create('Mickey', ['Melee']),
        WoWPlayer.create('Khurri', ['Melee', 'Brez']),
        WoWPlayer.create('Blueshift', ['Ranged', 'Lust']),
      ];
      const groups = createMythicPlusGroups(players);

      // With 15 players, should form 3 complete groups
      const completeGroups = groups.filter((g) => g.isComplete);
      expect(completeGroups.length).toBe(3);

      // Healer main should never be placed as tank
      for (const group of groups) {
        if (group.tank !== null) {
          expect(group.tank.healerMain).toBe(false);
        }
      }
    }
  });

  it('remainder places healer main as healer not tank even with offtank', () => {
    // 7 players = 1 full group + 2 remainder.
    // The remainder healer main with offtank should be placed as healer.
    for (let trial = 0; trial < 20; trial++) {
      clear();
      const players = [
        TankWarrior('Tank1'),
        HealerPriest('Healer1'),
        Mage('Mage1'),
        Rogue('Rogue1'),
        Rogue('Rogue2'),
        // Remainder players:
        HealerMonk('HealerOfftank', { offtank: true }),
        Rogue('PureDPS'),
      ];
      const groups = createMythicPlusGroups(players);

      // HealerOfftank should never be placed as tank
      for (const group of groups) {
        if (group.tank?.name === 'HealerOfftank') {
          expect.fail('Healer main was placed as tank in remainder');
        }
      }

      // HealerOfftank should be placed as healer in one of the groups
      const asHealer = groups.some((g) => g.healer?.name === 'HealerOfftank');
      expect(asHealer).toBe(true);
    }
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
