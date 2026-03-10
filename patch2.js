const fs = require('fs');

const file = 'packages/shared/src/parallelGroupCreator.ts';
let code = fs.readFileSync(file, 'utf8');

const targetStr = `  // Start forming full groups
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
        if (remainderGroup.tank === null && (player.tankMain || player.offtank)) {
          remainderGroup.tank = player;
          continue;
        } else if (
          remainderGroup.healer === null &&
          (player.healerMain || player.offhealer)
        ) {
          remainderGroup.healer = player;
          continue;
        } else if (
          remainderGroup.dps.length < 3 &&
          (player.dpsMain || player.offdps)
        ) {
          remainderGroup.dps.push(player);
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
  }`;

const replaceStr = `  // Start forming full groups
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
  }

  function fillBrez(): void {
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
  }

  function fillHealers(): void {
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
  }

  function fillRanged(): void {
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
          players.filter((p) => !usedPlayers.has(p.name)),
          remainderGroup,
        );
        if (player !== null) {
          if (remainderGroup.tank === null && (player.tankMain || player.offtank)) {
            remainderGroup.tank = player;
            continue;
          } else if (
            remainderGroup.healer === null &&
            (player.healerMain || player.offhealer)
          ) {
            remainderGroup.healer = player;
            continue;
          } else if (
            remainderGroup.dps.length < 3 &&
            (player.dpsMain || player.offdps)
          ) {
            remainderGroup.dps.push(player);
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
  handleRemainders();`;

if (!code.includes(targetStr)) {
  console.log("Target string not found!");
} else {
  code = code.replace(targetStr, replaceStr);
  fs.writeFileSync(file, code);
  console.log("Success");
}
