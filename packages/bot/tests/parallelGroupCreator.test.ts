import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  WoWPlayer,
  WoWGroup,
  clear,
  setGroupHistory,
  createMythicPlusGroups,
  pairKey,
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

      // With 15 players, should form exactly 3 complete groups (no remainders)
      expect(groups.length).toBe(3);
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

  it('prefers pure healers over flex healers so versatile players can fill DPS', () => {
    // Reproduction of issue #317: Quill (healer main + many offspecs including DPS)
    // was placed as healer instead of Selinora (pure healer, no offspecs), leaving
    // Group 3 short one DPS and creating a 4th remainder group with just Selinora.
    // Fix: pure healers (no offdps) are preferred before flex healers (have offdps).
    for (let trial = 0; trial < 20; trial++) {
      clear();
      const players = [
        WoWPlayer.create('Vanyali', ['Ranged']),
        WoWPlayer.create('jim', ['Melee', 'Tank Offspec']),
        WoWPlayer.create('Temma', ['Tank', 'Melee Offspec', 'Brez']),
        WoWPlayer.create('Sorovar', ['Healer', 'Ranged Offspec']),
        WoWPlayer.create('Blueshift', ['Ranged']),
        WoWPlayer.create('Quill', [
          'Healer',
          'Tank Offspec',
          'Healer Offspec',
          'Ranged Offspec',
          'Melee Offspec',
          'Brez',
        ]),
        WoWPlayer.create('FourX', ['Ranged']),
        WoWPlayer.create('Gazzi', ['Tank', 'Brez']),
        WoWPlayer.create('Poppybrosjr', ['Ranged', 'Lust']),
        WoWPlayer.create('Tytaniormu', ['Ranged', 'Lust']),
        WoWPlayer.create('Volkareth', ['Ranged', 'Healer Offspec', 'Lust']),
        WoWPlayer.create('Agromat', ['Melee']),
        WoWPlayer.create('Mickey', ['Melee']),
        WoWPlayer.create('Selinora', ['Healer']),
        WoWPlayer.create('Cyonoc', ['Healer', 'Brez']),
        WoWPlayer.create('Alchemy', ['Ranged', 'Brez']),
      ];
      const groups = createMythicPlusGroups(players);

      // With 16 players = floor(16/5)=3 full groups + 1 remainder player.
      // The first 3 groups must always be complete.
      const mainGroups = groups.slice(0, 3);
      for (const group of mainGroups) {
        expect(group.isComplete).toBe(true);
      }

      // Pure healers (Selinora, Cyonoc) must never be in a remainder group
      // when a flex healer could have taken a DPS slot instead.
      const remainderPlayers = groups
        .slice(3)
        .flatMap((g) => g.players);
      expect(remainderPlayers.find((p) => p.name === 'Selinora')).toBeUndefined();
      expect(remainderPlayers.find((p) => p.name === 'Cyonoc')).toBeUndefined();
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

    // Setup history: Tank played with DPS1, DPS2, DPS3. The earlier healer
    // isn't here tonight; a group needs one to count as having played.
    const g1 = new WoWGroup();
    g1.tank = tank;
    g1.healer = HealerDruid('Earlier Healer');
    g1.dps = [dps1, dps2, dps3];
    setGroupHistory([[g1]]);

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

  it('uses multi-round history to maximize diversity', () => {
    const tank = TankWarrior('Tank');
    const healer = HealerPriest('Healer');
    const dps1 = Warrior('DPS1');
    const dps2 = Warrior('DPS2');
    const dps3 = Warrior('DPS3');
    const dps4 = Warrior('DPS4');
    const dps5 = Warrior('DPS5');
    const dps6 = Warrior('DPS6');

    // Round 1: Tank played with DPS1, DPS2, DPS3. The earlier healers aren't
    // here tonight; a group needs one to count as having played.
    const r1g1 = new WoWGroup();
    r1g1.tank = tank;
    r1g1.healer = HealerDruid('Earlier Healer 1');
    r1g1.dps = [dps1, dps2, dps3];

    // Round 2: Tank played with DPS1 again (so DPS1 has count=2 with Tank)
    const r2g1 = new WoWGroup();
    r2g1.tank = tank;
    r2g1.healer = HealerDruid('Earlier Healer 2');
    r2g1.dps = [dps1, dps4, dps5];

    setGroupHistory([
      [r1g1],
      [r2g1],
    ]);

    const allPlayers = [tank, healer, dps1, dps2, dps3, dps4, dps5, dps6];
    const groups = createMythicPlusGroups(allPlayers);

    expect(groups.length).toBeGreaterThanOrEqual(1);
    const group = groups[0];
    expect(group.tank!.equals(tank)).toBe(true);

    // DPS6 has count=0 with tank, DPS3 has count=1, DPS2 has count=1.
    // DPS1 has count=2. Algorithm should prefer DPS6 and the count=1 players.
    const dpsNames = group.dps.map((p) => p.name);
    expect(dpsNames).not.toContain('DPS1');
    expect(dpsNames).toContain('DPS6');
  });

  it('reaches the global minimum pair-overlap on the issue #512 input', () => {
    // Reproduction of issue #512. With the captured prior rounds, the greedy
    // fillRemainingDps pass leaves the last-filled group with leftover DPS
    // and produces total pair-overlap up to 14 across runs (avg ~10.5). A
    // brute-force search of valid 3-group partitions for this input shows
    // the global minimum total pair-overlap is 10. The post-processing
    // diversifyGroups step in createMythicPlusGroups should reach that
    // minimum on every spin so a player like Tyt isn't stranded with two
    // already-seen teammates while a strictly better assignment exists.
    for (let trial = 0; trial < 25; trial++) {
      clear();

      const Gazzi = WoWPlayer.create('Gazzi (Nikki)', ['Tank', 'Brez']);
      const Sorovar = WoWPlayer.create('Sorovar (Jeremy)', ['Healer', 'Ranged Offspec']);
      const Poppy = WoWPlayer.create('Poppybrosjr (Steve)', ['Ranged', 'Lust']);
      const JohnG = WoWPlayer.create('John G', ['Melee', 'Tank Offspec', 'Brez']);
      const Marti = WoWPlayer.create('Martichoux (Erik)', ['Ranged', 'Ranged Offspec', 'Lust']);
      const Temma = WoWPlayer.create('Temma (Ben)', ['Tank', 'Melee Offspec', 'Brez']);
      const Quill = WoWPlayer.create('Quill (Josh)', [
        'Healer',
        'Tank Offspec',
        'Ranged Offspec',
        'Melee Offspec',
        'Brez',
      ]);
      const Volk = WoWPlayer.create('Volkareth (Graham)', ['Ranged', 'Lust']);
      const Alch = WoWPlayer.create('Alchemy (Yamyam)', ['Ranged', 'Brez']);
      const Mickey = WoWPlayer.create('Mickey (rook (AJ))', ['Melee']);
      const Drach = WoWPlayer.create('Drachlyn (Evan)', ['Tank', 'Brez']);
      const Cyonoc = WoWPlayer.create('Cyonoc (Kyle)', ['Healer', 'Healer Offspec', 'Brez']);
      const Tyt = WoWPlayer.create('Tytaniormu (Tyler)', ['Ranged', 'Lust']);
      const Blue = WoWPlayer.create('Blueshift (Bevan)', ['Ranged']);
      const jim = WoWPlayer.create('jim (Stink)', ['Melee', 'Tank Offspec']);
      const Raxef = WoWPlayer.create('Raxef', ['Melee']);

      const mkGroup = (
        tank: WoWPlayer | null,
        healer: WoWPlayer | null,
        dps: WoWPlayer[],
      ): WoWGroup => {
        const g = new WoWGroup();
        g.tank = tank;
        g.healer = healer;
        g.dps = [...dps];
        return g;
      };

      const r1 = [
        mkGroup(Gazzi, Cyonoc, [Volk, Mickey, JohnG]),
        mkGroup(Drach, Quill, [Poppy, jim, Alch]),
        mkGroup(Temma, Sorovar, [Blue, Tyt]),
      ];
      const r2 = [
        mkGroup(Drach, Sorovar, [Volk, Marti, Raxef]),
        mkGroup(Gazzi, Quill, [Tyt, jim, Mickey]),
        mkGroup(Temma, Cyonoc, [Poppy, Blue, Alch]),
      ];

      setGroupHistory([r1, r2]);

      const players = [
        Gazzi, Sorovar, Poppy, JohnG, Marti,
        Temma, Quill, Volk, Alch, Mickey,
        Drach, Cyonoc, Tyt, Blue, jim,
      ];
      const groups = createMythicPlusGroups(players);
      expect(groups.length).toBe(3);

      const pairCount = new Map<string, number>();
      for (const round of [r1, r2]) {
        for (const grp of round) {
          const ms = grp.players;
          for (let i = 0; i < ms.length; i++) {
            for (let j = i + 1; j < ms.length; j++) {
              const a = ms[i].name, b = ms[j].name;
              const key = a < b ? `${a}|${b}` : `${b}|${a}`;
              pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
            }
          }
        }
      }

      let totalOverlap = 0;
      for (const group of groups) {
        const ms = group.players;
        for (let i = 0; i < ms.length; i++) {
          for (let j = i + 1; j < ms.length; j++) {
            const a = ms[i].name, b = ms[j].name;
            const key = a < b ? `${a}|${b}` : `${b}|${a}`;
            totalOverlap += pairCount.get(key) ?? 0;
          }
        }
      }

      expect(
        totalOverlap,
        `total pair overlap was ${totalOverlap} on trial ${trial}, expected the proven global minimum of 10`,
      ).toBe(10);
    }
  });
});

describe('GroupCreator sit-out rotation and incomplete groups', () => {
  const mkGroup = (
    tank: WoWPlayer | null,
    healer: WoWPlayer | null,
    dps: WoWPlayer[],
  ): WoWGroup => {
    const g = new WoWGroup();
    g.tank = tank;
    g.healer = healer;
    g.dps = [...dps];
    return g;
  };

  /** A group plays if it has a tank and a healer; everyone else sat out. */
  const plays = (group: WoWGroup): boolean => group.tank !== null && group.healer !== null;

  const names = (group: WoWGroup): string[] => group.players.map((p) => p.name);
  const sitters = (groups: WoWGroup[]): string[] =>
    groups.filter((g) => !plays(g)).flatMap(names);

  /** Times each player sat out across `rounds`. */
  const sitCountsOf = (rounds: WoWGroup[][]): Map<string, number> => {
    const counts = new Map<string, number>();
    for (const round of rounds) {
      for (const group of round) {
        if (plays(group)) continue;
        for (const name of names(group)) counts.set(name, (counts.get(name) ?? 0) + 1);
      }
    }
    return counts;
  };

  /**
   * Repeat score over the playing groups: the worst player's repeat count
   * with their teammates, and the total over all pairs. Only groups that
   * played count as having played together.
   */
  const repeatScore = (
    groups: WoWGroup[],
    rounds: WoWGroup[][],
  ): { maxPerPlayer: number; total: number } => {
    const counts = new Map<string, number>();
    for (const round of rounds) {
      for (const group of round.filter(plays)) {
        const ms = group.players;
        for (let i = 0; i < ms.length; i++) {
          for (let j = i + 1; j < ms.length; j++) {
            const key = pairKey(ms[i].name, ms[j].name);
            counts.set(key, (counts.get(key) ?? 0) + 1);
          }
        }
      }
    }
    let maxPerPlayer = 0;
    let total = 0;
    for (const group of groups.filter(plays)) {
      const ms = group.players;
      for (let i = 0; i < ms.length; i++) {
        let perPlayer = 0;
        for (let j = 0; j < ms.length; j++) {
          if (i === j) continue;
          const c = counts.get(pairKey(ms[i].name, ms[j].name)) ?? 0;
          perPlayer += c;
          if (j > i) total += c;
        }
        maxPerPlayer = Math.max(maxPerPlayer, perPlayer);
      }
    }
    return { maxPerPlayer, total };
  };

  afterEach(() => {
    clear();
    vi.restoreAllMocks();
  });

  it('seats players who sat out earlier, even at the cost of a repeat teammate', () => {
    // D4-D6 played with the tank in round 1 and sat out round 2; D1-D3 are
    // new. Avoiding repeats alone would seat the fresh D1-D3 and sit D4-D6
    // out again. Sit-outs rotate first, so D4-D6 play.
    for (let trial = 0; trial < 25; trial++) {
      clear();
      const tank = WoWPlayer.create('T', ['Tank']);
      const healer = WoWPlayer.create('H', ['Healer']);
      const dps = [1, 2, 3, 4, 5, 6].map((i) => WoWPlayer.create(`D${i}`, ['Melee']));
      const [d1, d2, d3, d4, d5, d6] = dps;
      const earlier = [1, 2, 3].map((i) => WoWPlayer.create(`Earlier${i}`, ['Melee']));
      const history = [
        [mkGroup(tank, WoWPlayer.create('Earlier Healer 1', ['Healer']), [d4, d5, d6])],
        [
          mkGroup(tank, WoWPlayer.create('Earlier Healer 2', ['Healer']), earlier),
          mkGroup(null, null, [d4, d5, d6]),
        ],
      ];
      // Through the Firestore wire format, as the bot and activity load it:
      // the sit-out group must keep its empty tank and healer slots.
      setGroupHistory(history.map((round) => round.map((g) => WoWGroup.fromDict(g.toDict()))));

      const groups = createMythicPlusGroups([tank, healer, ...dps]);

      expect(groups[0].isComplete).toBe(true);
      expect(names(groups[0]).sort()).toEqual(['D4', 'D5', 'D6', 'H', 'T']);
      expect(sitters(groups).sort()).toEqual([d1, d2, d3].map((p) => p.name).sort());
    }
  });

  it('does not sit the same people again on the issue #654 input', () => {
    // Reproduction of issue #654 (16 players, four earlier rounds). Round 5
    // needs one player to sit out. Before sit-outs rotated, someone who had
    // already sat out tonight sat again on ~94% of spins, though a DPS who
    // hadn't sat yet was available.
    for (let trial = 0; trial < 25; trial++) {
      clear();
      const eyebeam = WoWPlayer.create('Eyebeam', ['Tank', 'Ranged Offspec']);
      const sorovar = WoWPlayer.create('Sorovar (Jeremy)', ['Healer', 'Ranged Offspec']);
      const poppy = WoWPlayer.create('Poppybrosjr (Steve)', ['Ranged', 'Lust']);
      const mista = WoWPlayer.create('mistaaytch', ['Ranged', 'Brez']);
      const vanyali = WoWPlayer.create('Vanyali ((K/H)ailey)', ['Ranged']);
      const temma = WoWPlayer.create('Temma (Ben)', ['Tank', 'Brez']);
      const quill = WoWPlayer.create('Quill (Josh)', [
        'Healer',
        'Tank Offspec',
        'Ranged Offspec',
        'Melee Offspec',
        'Brez',
      ]);
      const tyt = WoWPlayer.create('Tytaniormu (Tyler)', ['Ranged', 'Lust']);
      const johnG = WoWPlayer.create('John G', ['Melee', 'Tank Offspec', 'Brez']);
      const gutter = WoWPlayer.create('Gutterhero (Daniel)', ['Melee']);
      const gazzi = WoWPlayer.create('Gazzi (Nikki)', ['Tank', 'Brez']);
      const selinora = WoWPlayer.create('Selinora(CJ)', ['Healer']);
      const glod = WoWPlayer.create('Glodskegg (Graham)', ['Ranged', 'Brez']);
      const mickey = WoWPlayer.create('Mickey (rook (AJ))', ['Melee']);
      const raxef = WoWPlayer.create('Raxef', ['Melee', 'Melee Offspec']);
      const khurri = WoWPlayer.create('Khurri (Caitlin)', ['Melee', 'Melee Offspec', 'Brez']);
      const coriander = WoWPlayer.create('Coriander (Bevan)', ['Ranged', 'Lust']);
      const drachlyn = WoWPlayer.create('Drachlyn (Evan)', ['Tank', 'Brez']);
      const jim = WoWPlayer.create('jim (Stink)', ['Melee']);

      const history = [
        [mkGroup(null, null, [coriander])],
        [
          mkGroup(gazzi, quill, [vanyali, glod, eyebeam]),
          mkGroup(drachlyn, sorovar, [poppy, johnG, khurri]),
          mkGroup(temma, null, [tyt, mickey, mista]),
          mkGroup(null, null, [coriander, jim, gutter]),
        ],
        [
          mkGroup(temma, selinora, [poppy, eyebeam, gutter]),
          mkGroup(gazzi, sorovar, [tyt, raxef, johnG]),
          mkGroup(drachlyn, quill, [coriander, mickey, mista]),
          mkGroup(null, null, [glod, khurri, vanyali]),
        ],
        [
          mkGroup(eyebeam, selinora, [tyt, khurri, mickey]),
          mkGroup(temma, sorovar, [coriander, glod, raxef]),
          mkGroup(gazzi, quill, [poppy, mista, gutter]),
          mkGroup(null, null, [vanyali, johnG]),
        ],
      ];
      setGroupHistory(history);

      const players = [
        eyebeam, sorovar, poppy, mista, vanyali, temma, quill, tyt,
        johnG, gutter, gazzi, selinora, glod, mickey, raxef, khurri,
      ];
      const groups = createMythicPlusGroups(players);

      expect(groups.filter((g) => g.isComplete)).toHaveLength(3);
      const sitCounts = sitCountsOf(history);
      const sat = sitters(groups);
      expect(sat).toHaveLength(1);
      expect(sitCounts.get(sat[0]) ?? 0, `${sat[0]} sat again on trial ${trial}`).toBe(0);
    }
  });

  it('never trades a main tank or healer for an offspec from an incomplete group', () => {
    // The main tank and healer have played with everyone in the complete
    // group; the offspec-only tank and healer in the short group (which
    // would pug its DPS) haven't. Swapping them in would clear every repeat,
    // but a player from an incomplete group may only take a complete group's
    // slot if they suit it at least as well.
    for (let trial = 0; trial < 25; trial++) {
      clear();
      const mainTank = WoWPlayer.create('MainTank', ['Tank']);
      const mainHealer = WoWPlayer.create('MainHealer', ['Healer']);
      const dps = [1, 2, 3].map((i) => WoWPlayer.create(`D${i}`, ['Melee']));
      const offTank = WoWPlayer.create('OffTank', ['Tank Offspec']);
      const offHealer = WoWPlayer.create('OffHealer', ['Healer Offspec']);
      setGroupHistory([[mkGroup(mainTank, mainHealer, dps)]]);

      const groups = createMythicPlusGroups([mainTank, mainHealer, ...dps, offTank, offHealer]);

      const complete = groups.filter((g) => g.isComplete);
      expect(complete).toHaveLength(1);
      expect(complete[0].tank?.name).toBe('MainTank');
      expect(complete[0].healer?.name).toBe('MainHealer');
    }
  });

  it("keeps a complete group's ranged DPS when trading with a player sitting out", () => {
    // The only ranged player has played with the tank and healer. Swapping
    // them for the leftover melee would clear both repeats, but would leave
    // the complete group with no ranged DPS.
    for (let trial = 0; trial < 25; trial++) {
      clear();
      const tank = WoWPlayer.create('T', ['Tank']);
      const healer = WoWPlayer.create('H', ['Healer']);
      const ranged = WoWPlayer.create('R', ['Ranged']);
      const melee = [1, 2, 3].map((i) => WoWPlayer.create(`M${i}`, ['Melee']));
      setGroupHistory([[mkGroup(tank, healer, [ranged])]]);

      const groups = createMythicPlusGroups([tank, healer, ranged, ...melee]);

      expect(groups).toHaveLength(2);
      expect(groups[0].isComplete).toBe(true);
      expect(groups[0].hasRanged).toBe(true);
      expect(names(groups[0])).toContain('R');
    }
  });

  it('never gives anyone two repeat teammates on the issue #625 input', () => {
    // Reproduction of issue #625 (18 players, one earlier round). Glodskegg,
    // Martichoux and Raxef sat out round 1, so they play this round. Across
    // the playing groups nobody can avoid every repeat (Gazzi's group always
    // has one), but nobody should get two repeat teammates.
    for (let trial = 0; trial < 25; trial++) {
      clear();
      const gazzi = WoWPlayer.create('Gazzi (Nikki)', ['Tank', 'Brez']);
      const quill = WoWPlayer.create('Quill (Josh)', [
        'Healer',
        'Tank Offspec',
        'Ranged Offspec',
        'Melee Offspec',
        'Brez',
      ]);
      const tyt = WoWPlayer.create('Tytaniormu (Tyler)', ['Ranged', 'Lust']);
      const marti = WoWPlayer.create('Martichoux (Erik)', ['Ranged', 'Ranged Offspec', 'Lust']);
      const gutter = WoWPlayer.create('Gutterhero (Daniel)', ['Melee']);
      const temma = WoWPlayer.create('Temma (Ben)', ['Tank', 'Melee Offspec', 'Brez']);
      const sorovar = WoWPlayer.create('Sorovar (Jeremy)', ['Healer', 'Ranged Offspec']);
      const poppy = WoWPlayer.create('Poppybrosjr (Steve)', ['Ranged', 'Lust']);
      const raxef = WoWPlayer.create('Raxef', ['Melee', 'Melee Offspec']);
      const mickey = WoWPlayer.create('Mickey (rook (AJ))', ['Melee']);
      const hung = WoWPlayer.create('HungFarLow', ['Tank']);
      const selinora = WoWPlayer.create('Selinora(CJ)', ['Healer']);
      const coriander = WoWPlayer.create('Coriander (Bevan)', ['Ranged', 'Lust']);
      const glod = WoWPlayer.create('Glodskegg (Graham)', ['Ranged', 'Brez']);
      const jim = WoWPlayer.create('jim (Stink)', ['Melee']);
      const vanyali = WoWPlayer.create('Vanyali ((K/H)ailey)', ['Ranged']);
      const khurri = WoWPlayer.create('Khurri (Caitlin)', ['Melee', 'Melee Offspec', 'Brez']);
      const johnG = WoWPlayer.create('John G', ['Melee', 'Tank Offspec', 'Brez']);
      const fourX = WoWPlayer.create('FourX (Andrew)', ['Ranged', 'Lust']);

      const history = [[
        mkGroup(gazzi, selinora, [tyt, khurri, poppy]),
        mkGroup(temma, quill, [fourX, jim, mickey]),
        mkGroup(johnG, sorovar, [coriander, gutter, vanyali]),
        mkGroup(null, null, [glod, marti, raxef]),
      ]];
      setGroupHistory(history);

      const players = [
        gazzi, quill, tyt, marti, gutter, temma, sorovar, poppy, raxef,
        mickey, hung, selinora, coriander, glod, jim, vanyali, khurri, johnG,
      ];
      const groups = createMythicPlusGroups(players);

      expect(groups).toHaveLength(4);
      expect(groups.filter((g) => g.isComplete)).toHaveLength(3);
      expect(sitters(groups)).not.toEqual(
        expect.arrayContaining([expect.stringMatching(/^(Glodskegg|Martichoux|Raxef)/)]),
      );
      const score = repeatScore(groups, history);
      expect(score.maxPerPlayer, `trial ${trial}`).toBe(1);
      expect(score.total, `trial ${trial}`).toBeLessThanOrEqual(3);
    }
  });

  it('keeps every spin valid across random lobbies with history', () => {
    // Seeded so a failure reproduces. Each lobby's history comes from the
    // algorithm's own earlier rounds, as on a real night.
    let seed = 12345;
    const random = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    vi.spyOn(Math, 'random').mockImplementation(random);

    const mains = ['Tank', 'Healer', 'Ranged', 'Melee'];
    const offspecs = ['Tank Offspec', 'Healer Offspec', 'Ranged Offspec', 'Melee Offspec'];
    for (let lobby = 0; lobby < 150; lobby++) {
      clear();
      const size = 5 + Math.floor(random() * 26);
      const players = Array.from({ length: size }, (_, i) => {
        const roles = [mains[Math.floor(random() * mains.length)]];
        for (const off of offspecs) if (random() < 0.2) roles.push(off);
        if (random() < 0.3) roles.push('Brez');
        if (random() < 0.25) roles.push('Lust');
        return WoWPlayer.create(`L${lobby}P${i}`, roles);
      });

      for (let round = 0; round < 3; round++) {
        const attending = players.filter(() => random() < 0.85);
        const groups = createMythicPlusGroups(attending);

        const placed = groups.flatMap(names);
        expect(placed.sort()).toEqual(attending.map((p) => p.name).sort());
        for (const group of groups) {
          expect(group.size).toBeLessThanOrEqual(5);
          if (!group.isComplete) continue;
          // The fill step may tank with a healer-main who has a tank offspec
          // when nobody else can; the swap pass never moves one into a tank slot.
          expect(group.tank!.tankMain || group.tank!.offtank).toBe(true);
          expect(group.healer!.healerMain || group.healer!.offhealer).toBe(true);
          for (const d of group.dps) expect(d.dpsMain || d.offdps).toBe(true);
        }
      }
    }
  });
});
