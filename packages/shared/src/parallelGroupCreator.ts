import { WoWGroup, WoWPlayer } from './models.js';

/** Per-guild history of last groups — avoids cross-guild contamination. */
const lastGroups = new Map<string | number | null, WoWGroup[]>();

export function clear(): void {
  lastGroups.clear();
}

export function setLastGroups(groups: WoWGroup[], guildId: string | number | null = null): void {
  lastGroups.set(guildId, groups);
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

/** Check if a player (by name) is in a list. */
function isInList(list: WoWPlayer[], player: WoWPlayer): boolean {
  return list.some((p) => p.equals(player));
}

export function createMythicPlusGroups(
  players: WoWPlayer[],
  _debug = true,
  guildId: string | number | null = null,
): WoWGroup[] {
  const previousGroups = lastGroups.get(guildId) ?? [];

  // Pre-compute teammate lookups for O(1) check
  const lastGroupsDict = new Map<string, Set<string>>();
  for (const group of previousGroups) {
    const members = group.players;
    for (const member of members) {
      const existing = lastGroupsDict.get(member.name);
      const teammates = existing ?? new Set<string>();
      if (!existing) lastGroupsDict.set(member.name, teammates);
      for (const m of members) {
        if (!m.equals(member)) teammates.add(m.name);
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

  // Healers
  const mainHealers = shuffle(players.filter((p) => p.healerMain));
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
  ): WoWPlayer | null {
    const teammates = group.players;
    const filteredList: WoWPlayer[] = [];

    // Pre-check: Find all players that are ineligible due to previous grouping
    const ineligiblePlayers = new Set<string>();
    for (const teammate of teammates) {
      const prev = lastGroupsDict.get(teammate.name);
      if (prev) {
        for (const name of prev) ineligiblePlayers.add(name);
      }
    }

    for (const p of availablePlayers) {
      if (ineligiblePlayers.has(p.name)) continue;
      filteredList.push(p);
    }

    // Try to grab a player from the filtered list first
    for (const player of filteredList) {
      if (!usedPlayers.has(player.name)) {
        removePlayer(player);
        return player;
      }
    }

    // Fallback if we can't find a player who hasn't played with this group before
    for (const player of availablePlayers) {
      if (!usedPlayers.has(player.name)) {
        removePlayer(player);
        return player;
      }
    }

    return null;
  }

  // Start forming full groups
  for (let i = 0; i < maximumPossibleGroups; i++) {
    groups.push(new WoWGroup());
  }

  // Fill out each full group in stages
  // Grab a tank
  for (const currentGroup of groups) {
    currentGroup.tank = grabNextAvailablePlayer(availableTanks, currentGroup);
  }

  // Fill bloodlust spot next because no tanks have bloodlust
  for (const currentGroup of groups) {
    if (!currentGroup.hasLust) {
      const lustPlayer = grabNextAvailablePlayer(
        lustPlayers.filter((p) => !isInList(availableTanks, p)),
        currentGroup,
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

  // Now grab a brez if we don't have one
  for (const currentGroup of groups) {
    if (!currentGroup.hasBrez) {
      let brezPlayer: WoWPlayer | null;
      if (currentGroup.healer !== null) {
        // We have a healer already, so grab a dps brez
        brezPlayer = grabNextAvailablePlayer(
          brezPlayers.filter(
            (p) => !isInList(availableTanks, p) && !isInList(availableHealers, p),
          ),
          currentGroup,
        );
      } else {
        // We don't have a healer, so grab any brez
        brezPlayer = grabNextAvailablePlayer(
          brezPlayers.filter((p) => !isInList(availableTanks, p)),
          currentGroup,
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

  // If we still don't have a healer, grab one now
  for (const currentGroup of groups) {
    if (currentGroup.healer === null) {
      const mainHealer = grabNextAvailablePlayer([...mainHealers], currentGroup);
      if (mainHealer !== null) {
        currentGroup.healer = mainHealer;
      } else {
        const offHealer = grabNextAvailablePlayer([...availableHealers], currentGroup);
        if (offHealer !== null) {
          currentGroup.healer = offHealer;
        }
      }
    }
  }

  // Try to grab a ranged dps if we don't have one
  for (const currentGroup of groups) {
    if (!currentGroup.hasRanged) {
      const rangedDps = grabNextAvailablePlayer(
        availableDps.filter((p) => p.ranged),
        currentGroup,
      );
      if (rangedDps !== null) {
        currentGroup.dps.push(rangedDps);
      }
    }
  }

  // Fill the rest of the dps slots with anyone left
  for (const currentGroup of groups) {
    while (currentGroup.dps.length < 3) {
      const dpsPlayer = grabNextAvailablePlayer(availableDps, currentGroup);
      if (dpsPlayer === null) break;
      currentGroup.dps.push(dpsPlayer);
    }
  }

  // Handle remainder players
  while (usedPlayers.size < players.length) {
    const remainderGroup = new WoWGroup();
    while (usedPlayers.size < players.length) {
      const player = grabNextAvailablePlayer(
        players.filter((p) => !usedPlayers.has(p.name)),
        remainderGroup,
      );
      if (player !== null) {
        let placed = false;

        // Priority 1: place by main role
        if (!placed && remainderGroup.tank === null && player.tankMain) {
          remainderGroup.tank = player;
          placed = true;
        }
        if (!placed && remainderGroup.healer === null && player.healerMain) {
          remainderGroup.healer = player;
          placed = true;
        }
        if (!placed && remainderGroup.dps.length < 3 && player.dpsMain) {
          remainderGroup.dps.push(player);
          placed = true;
        }

        // Priority 2: place by offspec
        if (!placed && remainderGroup.tank === null && player.offtank) {
          remainderGroup.tank = player;
          placed = true;
        }
        if (!placed && remainderGroup.healer === null && player.offhealer) {
          remainderGroup.healer = player;
          placed = true;
        }
        if (!placed && remainderGroup.dps.length < 3 && player.offdps) {
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

  lastGroups.set(guildId, groups);
  return groups;
}
