import random
from .models import WoWPlayer, WoWGroup
from config import (
    ROLE_TANK, ROLE_HEALER, ROLE_DPS, ROLE_RANGED, ROLE_BREZ, ROLE_LUST
)

_debug = True


def log(s: str) -> None:
    if _debug:
        print(s)


def _tank_name(group: WoWGroup) -> str:
    """Safe access for log messages; tank may be None in remainder groups."""
    return group.tank.name if group.tank else "?"


# The last set of groups
# We'll try to match people with new players if possible
lastGroups = []


def clear():
    global lastGroups
    lastGroups = []


def create_mythic_plus_groups(
    players: list[WoWPlayer], debug: bool = True
) -> list[WoWGroup]:
    global _debug, lastGroups
    _debug = debug
    if _debug:
        print(f"DEBUG: lastGroups size at start: {len(lastGroups)}")

    # Pre-compute teammate lookups for O(1) check
    # Maps player name -> set of former teammates
    last_groups_dict = {}
    for group in lastGroups:
        members = group.players
        for member in members:
            if member.name not in last_groups_dict:
                last_groups_dict[member.name] = set()
            last_groups_dict[member.name].update(m.name for m in members if m != member)

    groups: list[WoWGroup] = []

    players = players.copy()
    usedPlayers = set()

    maximumPossibleGroups = len(players) // 5

    # Tanks
    main_tanks = [p for p in players if p.tankMain]
    off_tanks = [p for p in players if p.offtank and not p.tankMain]
    random.shuffle(main_tanks)
    random.shuffle(off_tanks)
    available_tanks = main_tanks + off_tanks
    log(
        f"Available tanks: {len(available_tanks)}\nMain tank: {main_tanks} --- Offtank: {off_tanks}"
    )

    # Healers
    main_healers = [p for p in players if p.healerMain]
    off_healers = [p for p in players if p.offhealer and not p.healerMain]
    random.shuffle(main_healers)
    random.shuffle(off_healers)
    available_healers = main_healers + off_healers
    log(
        f"Available healers: {len(available_healers)}\nMain heals: {main_healers} --- Offheals: {off_healers}"
    )
    offhealersToGrab = len(main_healers) < maximumPossibleGroups

    # DPS
    main_dps = [p for p in players if p.dpsMain]
    off_dps = [p for p in players if p.offdps and not p.dpsMain]
    random.shuffle(main_dps)
    random.shuffle(off_dps)
    available_dps = main_dps + off_dps
    log(
        f"Available DPS: {len(available_dps)}\nMain DPS: {main_dps} --- Off DPS: {off_dps}"
    )

    # Utilities
    brez_players = [p for p in players if p.hasBrez]
    random.shuffle(brez_players)
    lust_players = [p for p in players if p.hasLust]
    random.shuffle(lust_players)
    log(f"Players with battle res: {brez_players}")
    log(f"Players with bloodlust: {lust_players}")

    # Helper functions
    def removePlayer(player: WoWPlayer | None) -> None:
        if player is None:
            return
        usedPlayers.add(player)

        # Optimization: use a list of lists to iterate over all relevant lists
        all_lists = [
            available_tanks,
            available_healers,
            available_dps,
            main_tanks,
            off_tanks,
            main_healers,
            off_healers,
            main_dps,
            off_dps,
            brez_players,
            lust_players,
        ]
        for lst in all_lists:
            if player in lst:
                lst.remove(player)

    def grabNextAvailablePlayer(
        availablePlayers: list[WoWPlayer],
        role: str,
        group: WoWGroup,
        debug: bool = True,
    ) -> WoWPlayer | None:
        # Filter out players that were in the same group as any of the current group members last time
        teammates = group.players
        filteredList = []

        # Pre-check: Find all players that are ineligible due to previous grouping
        ineligible_players = set()
        for teammate in teammates:
            if teammate.name in last_groups_dict:
                ineligible_players.update(last_groups_dict[teammate.name])

        for p in availablePlayers:
            if p.name in ineligible_players:
                if debug:
                    # Find which teammate they were with for the log
                    teammate_match = next(
                        (
                            t.name
                            for t in teammates
                            if t.name in last_groups_dict
                            and p.name in last_groups_dict[t.name]
                        ),
                        "someone",
                    )
                    print(
                        f"Removing {p.name} because they were in a previous group with {teammate_match}"
                    )
                continue
            filteredList.append(p)

        # Try to grab a player from the filtered list first
        for player in filteredList:
            if player not in usedPlayers:
                removePlayer(player)
                return player

        # The fallback if we can't find a player who hasn't played with this group before
        for player in availablePlayers:
            if player not in usedPlayers:
                removePlayer(player)
                return player

        return None

    #
    # Start forming full groups
    #
    groups = [(WoWGroup()) for _ in range(maximumPossibleGroups)]

    # Fill out each full group in stages, parallelized
    # Grab a tank
    for currentGroup in groups:
        currentGroup.tank = grabNextAvailablePlayer(
            available_tanks, ROLE_TANK, currentGroup, debug
        )
        log(f"Selected tank: {currentGroup.tank}")
        log(
            f"After tank selection - Have brez: {currentGroup.has_brez}, have lust: {currentGroup.has_lust}"
        )

    #
    # Fill out utility spots
    #

    # Fill bloodlust spot next because no tanks have bloodlust
    # Will grab either a healer or a dps
    for currentGroup in groups:
        if not currentGroup.has_lust:
            lust_player = grabNextAvailablePlayer(
                [p for p in lust_players if p not in available_tanks],
                ROLE_LUST,
                currentGroup,
                debug,
            )

            if lust_player is not None:
                if lust_player.healerMain or (
                    offhealersToGrab > 0 and lust_player.offhealer
                ):
                    currentGroup.healer = lust_player
                    if lust_player.offhealer:
                        offhealersToGrab -= 1
                        log(
                            f"{_tank_name(currentGroup)}'s group - Selected lust player - offhealer: {lust_player}"
                        )
                    else:
                        log(
                            f"{_tank_name(currentGroup)}'s group - Selected lust player - healer: {lust_player}"
                        )
                elif lust_player.dpsMain:
                    currentGroup.dps.append(lust_player)
                    log(
                        f"{_tank_name(currentGroup)}'s group - Selected lust player - dps: {lust_player}"
                    )
            else:
                log(
                    f"{_tank_name(currentGroup)}'s group - No more lust players available"
                )
        else:
            log(f"{_tank_name(currentGroup)}'s group - Already have a lust")

    # Now grab a brez if we don't have one
    # Will grab either a healer or a dps
    for currentGroup in groups:
        if not currentGroup.has_brez:
            if currentGroup.healer is not None:
                # We have a healer already, so grab a dps brez
                brez_player = grabNextAvailablePlayer(
                    [
                        p
                        for p in brez_players
                        if p not in available_tanks and p not in available_healers
                    ],
                    ROLE_BREZ,
                    currentGroup,
                    debug,
                )
            else:
                # We don't have a healer, so grab any brez
                brez_player = grabNextAvailablePlayer(
                    [p for p in brez_players if p not in available_tanks],
                    ROLE_BREZ,
                    currentGroup,
                    debug,
                )

            if brez_player is not None:
                if brez_player.healerMain or (
                    offhealersToGrab > 0 and brez_player.offhealer
                ):
                    currentGroup.healer = brez_player
                    if brez_player.offhealer:
                        offhealersToGrab -= 1
                        log(
                            f"{_tank_name(currentGroup)}'s group - Selected brez player - offhealer: {brez_player}"
                        )
                    else:
                        log(
                            f"{_tank_name(currentGroup)}'s group - Selected brez player - healer: {brez_player}"
                        )
                elif brez_player.dpsMain:
                    currentGroup.dps.append(brez_player)
                    log(
                        f"{_tank_name(currentGroup)}'s group - Selected brez player - dps: {brez_player}"
                    )
            else:
                log(
                    f"{_tank_name(currentGroup)}'s group - No more brez players available"
                )
        else:
            log(f"{_tank_name(currentGroup)}'s group - Already have a brez")

    # If we still don't have a healer, grab one now
    for currentGroup in groups:
        if currentGroup.healer is None:
            mainHealer = grabNextAvailablePlayer(
                list(main_healers), ROLE_HEALER, currentGroup, debug
            )
            if mainHealer is not None:
                currentGroup.healer = mainHealer
                log(
                    f"{_tank_name(currentGroup)}'s group - Selected main healer: {currentGroup.healer}"
                )
            else:
                offHealer = grabNextAvailablePlayer(
                    list(available_healers), ROLE_HEALER, currentGroup, debug
                )
                if offHealer is not None:
                    currentGroup.healer = offHealer
                    log(
                        f"{_tank_name(currentGroup)}'s group - Selected offhealer: {currentGroup.healer}"
                    )
                else:
                    log(
                        f"{_tank_name(currentGroup)}'s group - No more healers available"
                    )
            log(
                f"{_tank_name(currentGroup)}'s group - After healer selection - Have brez: {currentGroup.has_brez}, have lust: {currentGroup.has_lust}"
            )
        else:
            log(
                f"{_tank_name(currentGroup)}'s group - Healer already selected: {currentGroup.healer}"
            )

    #
    # Now fill out dps spots
    #

    # Try to grab a ranged dps if we don't have one
    for currentGroup in groups:
        if not currentGroup.has_ranged:
            ranged_dps = grabNextAvailablePlayer(
                [p for p in available_dps if p.ranged], ROLE_RANGED, currentGroup, debug
            )
            if ranged_dps is not None:
                currentGroup.dps.append(ranged_dps)
                log(
                    f"{_tank_name(currentGroup)}'s group - Added ranged DPS: {ranged_dps}"
                )

    # Fill the rest of the dps slots with anyone left
    for currentGroup in groups:
        while len(currentGroup.dps) < 3:
            dps_player = grabNextAvailablePlayer(
                available_dps, ROLE_DPS, currentGroup, debug
            )
            if dps_player is None:
                break
            currentGroup.dps.append(dps_player)
            log(f"{_tank_name(currentGroup)}'s group - Selected DPS: {dps_player}")
        log(f"Formed group: {currentGroup}")

    # We've filled out all the full groups we can, now deal with any remainder players
    while len(usedPlayers) < len(players):
        log(
            f"Making a remainder group with these players: {[p.name for p in players if p not in usedPlayers]}"
        )
        remainderGroup = WoWGroup()
        log(f"remainderGroup start: {remainderGroup}")
        while len(usedPlayers) < len(players):
            # No constant for "remainder" specifically in config.py, so we'll use ROLE_DPS as a placeholder
            # or just leave it as "remainder" if it's not a role.
            # But "lust" and "brez" ARE roles in the config.
            player = grabNextAvailablePlayer(
                [p for p in players if p not in usedPlayers],
                "remainder",
                remainderGroup,
                debug,
            )
            if player is not None:
                if remainderGroup.tank is None and (player.tankMain or player.offtank):
                    remainderGroup.tank = player
                    log(f"Remainder group - Selected tank: {player}")
                    continue
                elif remainderGroup.healer is None and (
                    player.healerMain or player.offhealer
                ):
                    remainderGroup.healer = player
                    log(f"Remainder group - Selected healer: {player}")
                    continue
                elif len(remainderGroup.dps) < 3 and (player.dpsMain or player.offdps):
                    remainderGroup.dps.append(player)
                    log(f"Remainder group - Selected DPS: {player}")
                    continue
                else:
                    # Everything is full, make another group
                    usedPlayers.remove(player)
                    log(f"Remainder group - Player did not fit any role: {player}")
                    break
            else:
                log("No more players to add to remainder group")
                break
        log(f"Formed remainder group: {remainderGroup}")
        log(f"usedPlayers: {len(usedPlayers)}, total players: {len(players)}")
        groups.append(remainderGroup)

    lastGroups.clear()
    lastGroups = groups
    return groups
