import { WoWGroup, WoWPlayer } from './models.js';

/** Per-guild history of all rounds tonight — avoids cross-guild contamination. */
const groupHistory = new Map<string | number | null, WoWGroup[][]>();

/**
 * Drop the entire per-guild pair-history map. Intended only for tests that
 * need a clean module state between cases.
 */
export function clear(): void {
  groupHistory.clear();
}

/**
 * Seed a guild's pair-history with previously persisted rounds. Called when a
 * guild's stored history is rehydrated for the current PST day (see
 * `todayPST()`); on day rollover the guild is reseeded with an empty array so
 * pair penalties don't leak across days.
 */
export function setGroupHistory(rounds: WoWGroup[][], guildId: string | number | null = null): void {
  groupHistory.set(guildId, rounds);
}

/** Fisher-Yates shuffle (in-place). */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Remove a player by name-equality from a list (in-place). */
function removeFromList(list: WoWPlayer[], player: WoWPlayer): void {
  const idx = list.findIndex((p) => p.equals(player));
  if (idx !== -1) list.splice(idx, 1);
}

/**
 * Canonical key for an unordered name pair, so `pairCounts.get(pairKey(a, b))`
 * yields the same value regardless of argument order. Mirrored verbatim by
 * the Lua addon's pair-count map — keep the format byte-for-byte identical.
 */
export function pairKey(a: string, b: string): string {
  return a < b ? a + '|' + b : b + '|' + a;
}

/**
 * Slot in a `WoWGroup` (independent of `Role` from types.ts: there ranged/melee
 * are distinct, here both fall under `'dps'`). Tagged so `dpsIdx` is only
 * present where it's meaningful.
 */
type SlotInfo =
  | { slot: 'tank' }
  | { slot: 'healer' }
  | { slot: 'dps'; dpsIdx: number };

/** Identify which slot a player occupies in a group, or null if absent. */
function findSlot(group: WoWGroup, player: WoWPlayer): SlotInfo | null {
  if (group.tank?.equals(player)) return { slot: 'tank' };
  if (group.healer?.equals(player)) return { slot: 'healer' };
  const dpsIdx = group.dps.findIndex((p) => p.equals(player));
  if (dpsIdx !== -1) return { slot: 'dps', dpsIdx };
  return null;
}

/** Mutate `group` in place, placing `player` at the slot described by `info`. */
function setSlot(group: WoWGroup, info: SlotInfo, player: WoWPlayer): void {
  if (info.slot === 'tank') group.tank = player;
  else if (info.slot === 'healer') group.healer = player;
  else group.dps[info.dpsIdx] = player;
}

/**
 * Whether `player` is a legal occupant of `slot`. Mirrors the constraints the
 * fill phases impose: tanks cannot be healer-mains, tank slot needs a tank-
 * capable player, healer slot needs a healer-capable player, DPS accepts any
 * player with a DPS spec or offspec.
 */
function canFillSlot(player: WoWPlayer, slot: SlotInfo['slot']): boolean {
  if (slot === 'tank') return (player.tankMain || player.offtank) && !player.healerMain;
  if (slot === 'healer') return player.healerMain || player.offhealer;
  return player.dpsMain || player.offdps;
}

/**
 * Lexicographic score for a group set:
 *   - `maxPerPlayer`: worst-case count of repeat-teammates any single player has
 *   - `total`: sum of pair-counts for every unique pair across all groups
 *
 * Smaller is better on both axes; `maxPerPlayer` dominates because the user-
 * facing complaint is "*I* keep getting grouped with X again", not "the
 * algorithm-wide repeat sum is high".
 */
function scoreGroups(
  groups: readonly WoWGroup[],
  pairCounts: Map<string, number>,
): { maxPerPlayer: number; total: number } {
  let maxPerPlayer = 0;
  let perPlayerSum = 0;
  for (const g of groups) {
    const ms = g.players;
    for (let i = 0; i < ms.length; i++) {
      let perPlayer = 0;
      for (let j = 0; j < ms.length; j++) {
        if (i === j) continue;
        perPlayer += pairCounts.get(pairKey(ms[i].name, ms[j].name)) ?? 0;
      }
      if (perPlayer > maxPerPlayer) maxPerPlayer = perPlayer;
      perPlayerSum += perPlayer;
    }
  }
  // Each unique pair is summed twice across the players' perPlayer counts.
  return { maxPerPlayer, total: perPlayerSum / 2 };
}

function isBetterScore(
  candidate: { maxPerPlayer: number; total: number },
  current: { maxPerPlayer: number; total: number },
): boolean {
  if (candidate.maxPerPlayer !== current.maxPerPlayer) {
    return candidate.maxPerPlayer < current.maxPerPlayer;
  }
  return candidate.total < current.total;
}

/**
 * Try every legal pairwise swap; apply the best one if it strictly improves
 * the lexicographic score. Returns true if a swap was applied.
 */
function trySingleSwap(
  groups: WoWGroup[],
  pairCounts: Map<string, number>,
  origBrez: boolean[],
  origLust: boolean[],
): boolean {
  let bestScore = scoreGroups(groups, pairCounts);
  let bestSwap:
    | { gi: WoWGroup; gj: WoWGroup; pa: WoWPlayer; sa: SlotInfo; pb: WoWPlayer; sb: SlotInfo }
    | null = null;

  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      const gi = groups[i];
      const gj = groups[j];
      const playersI = gi.players;
      const playersJ = gj.players;
      for (const pa of playersI) {
        const sa = findSlot(gi, pa);
        if (!sa) continue;
        for (const pb of playersJ) {
          const sb = findSlot(gj, pb);
          if (!sb) continue;
          if (!canFillSlot(pa, sb.slot) || !canFillSlot(pb, sa.slot)) continue;

          setSlot(gi, sa, pb);
          setSlot(gj, sb, pa);
          const utilityOk = (!origBrez[i] || gi.hasBrez)
            && (!origLust[i] || gi.hasLust)
            && (!origBrez[j] || gj.hasBrez)
            && (!origLust[j] || gj.hasLust);
          if (utilityOk) {
            const candidate = scoreGroups(groups, pairCounts);
            if (isBetterScore(candidate, bestScore)) {
              bestScore = candidate;
              bestSwap = { gi, gj, pa, sa, pb, sb };
            }
          }
          setSlot(gi, sa, pa);
          setSlot(gj, sb, pb);
        }
      }
    }
  }

  if (!bestSwap) return false;
  setSlot(bestSwap.gi, bestSwap.sa, bestSwap.pb);
  setSlot(bestSwap.gj, bestSwap.sb, bestSwap.pa);
  return true;
}

/**
 * Escape single-swap local minima by rotating one player between three
 * groups (gi → gj → gk → gi). Some optimal assignments — particularly when
 * tank/healer placements are interdependent — are unreachable via any
 * single 2-swap because each individual swap looks worse than the current
 * state, but the composite 3-cycle improves it. Returns true if a cycle
 * was applied.
 */
function tryThreeCycle(
  groups: WoWGroup[],
  pairCounts: Map<string, number>,
  origBrez: boolean[],
  origLust: boolean[],
): boolean {
  if (groups.length < 3) return false;

  let bestScore = scoreGroups(groups, pairCounts);
  let bestCycle:
    | {
      gi: WoWGroup; pi: WoWPlayer; si: SlotInfo;
      gj: WoWGroup; pj: WoWPlayer; sj: SlotInfo;
      gk: WoWGroup; pk: WoWPlayer; sk: SlotInfo;
    }
    | null = null;

  // For any triple of groups (A, B, C) there are 6 ordered iterations but only
  // 2 distinct cycles: (A→B→C→A) and (A→C→B→A). Constraining j > i and k > i
  // (with k != j) hits both per triple while skipping the 4 duplicate rotations.
  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      for (let k = i + 1; k < groups.length; k++) {
        if (k === j) continue;
        const gi = groups[i];
        const gj = groups[j];
        const gk = groups[k];
        const playersI = gi.players;
        const playersJ = gj.players;
        const playersK = gk.players;
        for (const pi of playersI) {
          const si = findSlot(gi, pi);
          if (!si) continue;
          for (const pj of playersJ) {
            const sj = findSlot(gj, pj);
            if (!sj) continue;
            if (!canFillSlot(pi, sj.slot)) continue;
            for (const pk of playersK) {
              const sk = findSlot(gk, pk);
              if (!sk) continue;
              if (!canFillSlot(pj, sk.slot) || !canFillSlot(pk, si.slot)) continue;

              setSlot(gi, si, pk);
              setSlot(gj, sj, pi);
              setSlot(gk, sk, pj);
              const utilityOk = (!origBrez[i] || gi.hasBrez)
                && (!origLust[i] || gi.hasLust)
                && (!origBrez[j] || gj.hasBrez)
                && (!origLust[j] || gj.hasLust)
                && (!origBrez[k] || gk.hasBrez)
                && (!origLust[k] || gk.hasLust);
              if (utilityOk) {
                const candidate = scoreGroups(groups, pairCounts);
                if (isBetterScore(candidate, bestScore)) {
                  bestScore = candidate;
                  bestCycle = { gi, pi, si, gj, pj, sj, gk, pk, sk };
                }
              }
              setSlot(gi, si, pi);
              setSlot(gj, sj, pj);
              setSlot(gk, sk, pk);
            }
          }
        }
      }
    }
  }

  if (!bestCycle) return false;
  setSlot(bestCycle.gi, bestCycle.si, bestCycle.pk);
  setSlot(bestCycle.gj, bestCycle.sj, bestCycle.pi);
  setSlot(bestCycle.gk, bestCycle.sk, bestCycle.pj);
  return true;
}

/**
 * Local-search post-processing: swap pairs of players between groups if doing
 * so lowers the lexicographic `(maxPerPlayer, total)` score. The greedy fill
 * passes optimize each group as it is built, which strands the last-filled
 * group with the leftover DPS and can leave one player with 2+ repeat
 * teammates even though a strictly better assignment exists. This pass cleans
 * that up without changing role assignments or utility coverage. See issue
 * #512 for the motivating scenario.
 *
 * Two phases run alternately until both quiesce. Single-swap exploration
 * handles the common cases. A 3-cycle pass escapes local minima that single
 * swaps can't see — typically when tank or healer placements would all need
 * to rotate between groups simultaneously to improve the score.
 *
 * Constraints preserved:
 *   - Role compatibility for each slot (tank/healer/DPS slot occupants).
 *   - No healer-main placed as tank.
 *   - Brez/lust coverage of any group that originally had it.
 *   - Group sizes (only same-cardinality slot swaps occur).
 *
 * Mirrored in Lua by the MythicPlusWheel addon — keep behavior in sync.
 */
function diversifyGroups(groups: WoWGroup[], pairCounts: Map<string, number>): void {
  if (pairCounts.size === 0) return;

  const completeGroups = groups.filter((g) => g.isComplete);
  if (completeGroups.length < 2) return;

  const origBrez = completeGroups.map((g) => g.hasBrez);
  const origLust = completeGroups.map((g) => g.hasLust);

  // Outer loop bounded so a hostile pair-count map can't make this run away;
  // each phase already converges in O(complete-groups) iterations in practice.
  const maxOuter = completeGroups.length * 4;
  for (let outer = 0; outer < maxOuter; outer++) {
    let progress = false;
    while (trySingleSwap(completeGroups, pairCounts, origBrez, origLust)) {
      progress = true;
    }
    if (tryThreeCycle(completeGroups, pairCounts, origBrez, origLust)) {
      progress = true;
    }
    if (!progress) return;
  }
}

/**
 * Form balanced Mythic+ groups from a player pool. Used by both the bot
 * (Discord-only `/wheel`) and the frontend (Activity spin), and mirrored in
 * Lua by the MythicPlusWheel addon — keep behavior in sync if you change it.
 *
 * Three things that aren't obvious from the signature:
 *
 * 1. **Diversity across rounds.** A pair-count matrix tracks how often each
 *    pair of players has shared a group tonight, scoped per `guildId`. The
 *    grabber-loop scoring penalizes repeats, so successive `/wheel` calls or
 *    Activity spins in the same guild produce minimally repeated groupings.
 *
 * 2. **Per-guild history.** `guildId: null` falls back to a single shared
 *    bucket (suitable for tests and single-guild bots). Multi-guild bots
 *    must always pass a real guild ID, otherwise round histories collide.
 *
 * 3. **Fill order encodes priority.** Tank → lust → brez → healer → ranged →
 *    remaining DPS. Earlier slots' utility coverage is enforced before later
 *    slots compete for the remaining player pool, which is why the algorithm
 *    sometimes "skips" the obviously-best DPS to satisfy lust/brez coverage.
 *
 * The `_debug` parameter is currently a no-op — kept for API compatibility
 * with the Lua sibling, which uses it to gate verbose logging.
 */
export function createMythicPlusGroups(
  players: WoWPlayer[],
  _debug = true,
  guildId: string | number | null = null,
): WoWGroup[] {
  const rounds = groupHistory.get(guildId) ?? [];

  // Build pair-count matrix from all rounds: how many times each pair has been grouped
  const pairCounts = new Map<string, number>();
  for (const round of rounds) {
    for (const group of round) {
      const members = group.players;
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          const key = pairKey(members[i].name, members[j].name);
          pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
        }
      }
    }
  }

  const groups: WoWGroup[] = [];
  players = [...players];
  const usedPlayers = new Set<string>(); // Track by name

  const maximumPossibleGroups = Math.floor(players.length / 5);

  // Tanks — partition offtanks so healer-capable players are used last
  const mainTanks = shuffle(players.filter((p) => p.tankMain));
  const offTanks = shuffle(
    players.filter((p) => p.offtank && !p.tankMain && !p.healerMain && !p.offhealer),
  );
  const offTanksWithHeal = shuffle(
    players.filter((p) => p.offtank && !p.tankMain && (p.healerMain || p.offhealer)),
  );
  const availableTanks = [...mainTanks, ...offTanks, ...offTanksWithHeal];

  // Healers — partition so DPS-capable healers are used last (mirrors tank logic)
  const pureMainHealers = shuffle(players.filter((p) => p.healerMain && !p.offdps));
  const flexMainHealers = shuffle(players.filter((p) => p.healerMain && p.offdps));
  const mainHealers = [...pureMainHealers, ...flexMainHealers];
  const offHealers = shuffle(players.filter((p) => p.offhealer && !p.healerMain));
  const availableHealers = [...mainHealers, ...offHealers];
  let offhealersToGrab = Math.max(0, maximumPossibleGroups - mainHealers.length);

  // DPS
  const mainDps = shuffle(players.filter((p) => p.dpsMain));
  const offDps = shuffle(players.filter((p) => p.offdps && !p.dpsMain));
  const availableDps = [...mainDps, ...offDps];

  // Utilities
  const brezPlayers = shuffle(players.filter((p) => p.hasBrez));
  const lustPlayers = shuffle(players.filter((p) => p.hasLust));

  function removePlayer(player: WoWPlayer | null): void {
    if (player === null) return;
    usedPlayers.add(player.name);

    // Tank lists
    if (player.tankMain) {
      removeFromList(mainTanks, player);
      removeFromList(availableTanks, player);
    } else if (player.offtank) {
      removeFromList(offTanks, player);
      removeFromList(offTanksWithHeal, player);
      removeFromList(availableTanks, player);
    }

    // Healer lists
    if (player.healerMain) {
      removeFromList(mainHealers, player);
      removeFromList(availableHealers, player);
    } else if (player.offhealer) {
      removeFromList(offHealers, player);
      removeFromList(availableHealers, player);
    }

    // DPS lists
    if (player.dpsMain) {
      removeFromList(mainDps, player);
      removeFromList(availableDps, player);
    } else if (player.offdps) {
      removeFromList(offDps, player);
      removeFromList(availableDps, player);
    }

    // Utility lists
    if (player.hasBrez) removeFromList(brezPlayers, player);
    if (player.hasLust) removeFromList(lustPlayers, player);
  }

  function grabNextAvailablePlayer(
    availablePlayers: WoWPlayer[],
    group: WoWGroup,
    predicate?: (player: WoWPlayer) => boolean,
  ): WoWPlayer | null {
    const teammates = group.players;

    let bestPlayer: WoWPlayer | null = null;
    let bestScore = Infinity;

    for (const player of availablePlayers) {
      if (usedPlayers.has(player.name)) continue;
      if (predicate && !predicate(player)) continue;

      // Score = total times this player has been grouped with current teammates
      let score = 0;
      for (const teammate of teammates) {
        score += pairCounts.get(pairKey(player.name, teammate.name)) ?? 0;
      }

      if (score < bestScore) {
        bestScore = score;
        bestPlayer = player;

        // ⚡ Bolt Opt: Absolute optimal score reached, skip checking remaining players
        if (bestScore === 0) break;
      }
    }

    if (bestPlayer) {
      removePlayer(bestPlayer);
    }

    return bestPlayer;
  }

  // Start forming full groups
  for (let i = 0; i < maximumPossibleGroups; i++) {
    groups.push(new WoWGroup());
  }

  function fillTanks(): void {
    for (const currentGroup of groups) {
      currentGroup.tank = grabNextAvailablePlayer(availableTanks, currentGroup);
    }
  }

  function fillLust(): void {
    for (const currentGroup of groups) {
      if (!currentGroup.hasLust) {
        const lustPlayer = grabNextAvailablePlayer(
          lustPlayers,
          currentGroup,
          // ⚡ Bolt Opt: O(1) property check replaces O(N) array search
          (p) => !(p.tankMain || p.offtank),
        );

        if (lustPlayer !== null) {
          if (lustPlayer.healerMain || (offhealersToGrab > 0 && lustPlayer.offhealer)) {
            currentGroup.healer = lustPlayer;
            if (lustPlayer.offhealer) offhealersToGrab--;
          } else if (lustPlayer.dpsMain) {
            currentGroup.dps.push(lustPlayer);
          }
        }
      }
    }
  }

  function fillBrez(): void {
    for (const currentGroup of groups) {
      if (!currentGroup.hasBrez) {
        let brezPlayer: WoWPlayer | null;
        if (currentGroup.healer !== null) {
          // We have a healer already, so grab a dps brez
          brezPlayer = grabNextAvailablePlayer(
            brezPlayers,
            currentGroup,
            // ⚡ Bolt Opt: O(1) property check replaces O(N) array search
            (p) => !(p.tankMain || p.offtank) && !(p.healerMain || p.offhealer),
          );
        } else {
          // We don't have a healer, so grab any brez
          brezPlayer = grabNextAvailablePlayer(
            brezPlayers,
            currentGroup,
            // ⚡ Bolt Opt: O(1) property check replaces O(N) array search
            (p) => !(p.tankMain || p.offtank),
          );
        }

        if (brezPlayer !== null) {
          if (brezPlayer.healerMain || (offhealersToGrab > 0 && brezPlayer.offhealer)) {
            currentGroup.healer = brezPlayer;
            if (brezPlayer.offhealer) offhealersToGrab--;
          } else if (brezPlayer.dpsMain) {
            currentGroup.dps.push(brezPlayer);
          }
        }
      }
    }
  }

  function fillHealers(): void {
    for (const currentGroup of groups) {
      if (currentGroup.healer === null) {
        const mainHealer = grabNextAvailablePlayer(mainHealers, currentGroup);
        if (mainHealer !== null) {
          currentGroup.healer = mainHealer;
        } else {
          const offHealer = grabNextAvailablePlayer(availableHealers, currentGroup);
          if (offHealer !== null) {
            currentGroup.healer = offHealer;
          }
        }
      }
    }
  }

  function fillRanged(): void {
    for (const currentGroup of groups) {
      if (!currentGroup.hasRanged) {
        const rangedDps = grabNextAvailablePlayer(
          availableDps,
          currentGroup,
          (p) => p.ranged,
        );
        if (rangedDps !== null) {
          currentGroup.dps.push(rangedDps);
        }
      }
    }
  }

  function fillRemainingDps(): void {
    for (const currentGroup of groups) {
      while (currentGroup.dps.length < 3) {
        const dpsPlayer = grabNextAvailablePlayer(availableDps, currentGroup);
        if (dpsPlayer === null) break;
        currentGroup.dps.push(dpsPlayer);
      }
    }
  }

  function handleRemainders(): void {
    while (usedPlayers.size < players.length) {
      const remainderGroup = new WoWGroup();
      while (usedPlayers.size < players.length) {
        const player = grabNextAvailablePlayer(
          players,
          remainderGroup,
          (p) => !usedPlayers.has(p.name),
        );
        if (player !== null) {
          let placed = false;

          // Priority 1: place by main role
          if (player.tankMain && remainderGroup.tank === null) {
            remainderGroup.tank = player;
            placed = true;
          } else if (player.healerMain && remainderGroup.healer === null) {
            remainderGroup.healer = player;
            placed = true;
          } else if (player.dpsMain && remainderGroup.dps.length < 3) {
            remainderGroup.dps.push(player);
            placed = true;
          }
          // Priority 2: place by offspec
          else if (player.offtank && remainderGroup.tank === null) {
            remainderGroup.tank = player;
            placed = true;
          } else if (player.offhealer && remainderGroup.healer === null) {
            remainderGroup.healer = player;
            placed = true;
          } else if (player.offdps && remainderGroup.dps.length < 3) {
            remainderGroup.dps.push(player);
            placed = true;
          }

          if (placed) {
            continue;
          } else {
            // Everything is full, make another group
            usedPlayers.delete(player.name);
            break;
          }
        } else {
          break;
        }
      }
      groups.push(remainderGroup);
    }
  }

  // Fill out each full group in stages
  fillTanks();
  fillLust();
  fillBrez();
  fillHealers();
  fillRanged();
  fillRemainingDps();
  handleRemainders();

  diversifyGroups(groups, pairCounts);

  groupHistory.set(guildId, [...rounds, groups]);
  return groups;
}
