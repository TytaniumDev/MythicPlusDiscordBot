import logging
import random

from .models import WoWGroup, WoWPlayer

logger = logging.getLogger(__name__)


def _tank_name(group: WoWGroup) -> str:
    """Safe access for log messages; tank may be None in remainder groups."""
    return group.tank.name if group.tank else "?"


# Per-guild history of last groups — avoids cross-guild contamination.
_lastGroups: dict[int | None, list[WoWGroup]] = {}


def clear():
    _lastGroups.clear()


def set_last_groups(groups: list[WoWGroup], guild_id: int | None = None) -> None:
    """Injects group history for testing."""
    _lastGroups[guild_id] = groups


def create_mythic_plus_groups(
    players: list[WoWPlayer], debug: bool = True, guild_id: int | None = None
) -> list[WoWGroup]:
    lastGroups = _lastGroups.get(guild_id, [])

    # Logging for reproduction
    logger.info("Starting group creation for %d players", len(players))
    logger.info("Input Players: [%s]", ", ".join(p.toTestString() for p in players))
    logger.info(
        "Last Groups (to avoid teammates): [%s]",
        ", ".join(g.toTestString() for g in lastGroups),
    )

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
    logger.debug(
        "Available tanks: %d\nMain tank: %s --- Offtank: %s",
        len(available_tanks),
        main_tanks,
        off_tanks,
    )

    # Healers
    main_healers = [p for p in players if p.healerMain]
    off_healers = [p for p in players if p.offhealer and not p.healerMain]
    random.shuffle(main_healers)
    random.shuffle(off_healers)
    available_healers = main_healers + off_healers
    logger.debug(
        "Available healers: %d\nMain heals: %s --- Offheals: %s",
        len(available_healers),
        main_healers,
        off_healers,
    )
    offhealersToGrab = max(0, maximumPossibleGroups - len(main_healers))

    # DPS
    main_dps = [p for p in players if p.dpsMain]
    off_dps = [p for p in players if p.offdps and not p.dpsMain]
    random.shuffle(main_dps)
    random.shuffle(off_dps)
    available_dps = main_dps + off_dps
    logger.debug(
        "Available DPS: %d\nMain DPS: %s --- Off DPS: %s",
        len(available_dps),
        main_dps,
        off_dps,
    )

    # Utilities
    brez_players = [p for p in players if p.hasBrez]
    random.shuffle(brez_players)
    lust_players = [p for p in players if p.hasLust]
    random.shuffle(lust_players)
    logger.debug("Players with battle res: %s", brez_players)
    logger.debug("Players with bloodlust: %s", lust_players)

    # Helper functions
    def removePlayer(player: WoWPlayer | None) -> None:
        if player is None:
            return
        usedPlayers.add(player)

        # Optimization: Only check lists the player is actually in based on their roles
        # This avoids O(N) scans on irrelevant lists.

        # Tank lists
        if player.tankMain:
            if player in main_tanks:
                main_tanks.remove(player)
            if player in available_tanks:
                available_tanks.remove(player)
        elif player.offtank:
            if player in off_tanks:
                off_tanks.remove(player)
            if player in available_tanks:
                available_tanks.remove(player)

        # Healer lists
        if player.healerMain:
            if player in main_healers:
                main_healers.remove(player)
            if player in available_healers:
                available_healers.remove(player)
        elif player.offhealer:
            if player in off_healers:
                off_healers.remove(player)
            if player in available_healers:
                available_healers.remove(player)

        # DPS lists
        if player.dpsMain:
            if player in main_dps:
                main_dps.remove(player)
            if player in available_dps:
                available_dps.remove(player)
        elif player.offdps:
            if player in off_dps:
                off_dps.remove(player)
            if player in available_dps:
                available_dps.remove(player)

        # Utility lists
        if player.hasBrez and player in brez_players:
            brez_players.remove(player)

        if player.hasLust and player in lust_players:
            lust_players.remove(player)

    def grabNextAvailablePlayer(
        availablePlayers: list[WoWPlayer],
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
                logger.debug(
                    "Removing %s because they were in a previous group with %s",
                    p.name,
                    teammate_match,
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
            available_tanks, currentGroup, debug
        )
        logger.debug("Selected tank: %s", currentGroup.tank)
        logger.debug(
            "After tank selection - Have brez: %s, have lust: %s",
            currentGroup.has_brez,
            currentGroup.has_lust,
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
                        logger.debug(
                            "%s's group - Selected lust player - offhealer: %s",
                            _tank_name(currentGroup),
                            lust_player,
                        )
                    else:
                        logger.debug(
                            "%s's group - Selected lust player - healer: %s",
                            _tank_name(currentGroup),
                            lust_player,
                        )
                elif lust_player.dpsMain:
                    currentGroup.dps.append(lust_player)
                    logger.debug(
                        "%s's group - Selected lust player - dps: %s",
                        _tank_name(currentGroup),
                        lust_player,
                    )
            else:
                logger.debug(
                    "%s's group - No more lust players available",
                    _tank_name(currentGroup),
                )
        else:
            logger.debug("%s's group - Already have a lust", _tank_name(currentGroup))

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
                    currentGroup,
                    debug,
                )
            else:
                # We don't have a healer, so grab any brez
                brez_player = grabNextAvailablePlayer(
                    [p for p in brez_players if p not in available_tanks],
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
                        logger.debug(
                            "%s's group - Selected brez player - offhealer: %s",
                            _tank_name(currentGroup),
                            brez_player,
                        )
                    else:
                        logger.debug(
                            "%s's group - Selected brez player - healer: %s",
                            _tank_name(currentGroup),
                            brez_player,
                        )
                elif brez_player.dpsMain:
                    currentGroup.dps.append(brez_player)
                    logger.debug(
                        "%s's group - Selected brez player - dps: %s",
                        _tank_name(currentGroup),
                        brez_player,
                    )
            else:
                logger.debug(
                    "%s's group - No more brez players available",
                    _tank_name(currentGroup),
                )
        else:
            logger.debug("%s's group - Already have a brez", _tank_name(currentGroup))

    # If we still don't have a healer, grab one now
    for currentGroup in groups:
        if currentGroup.healer is None:
            mainHealer = grabNextAvailablePlayer(
                list(main_healers), currentGroup, debug
            )
            if mainHealer is not None:
                currentGroup.healer = mainHealer
                logger.debug(
                    "%s's group - Selected main healer: %s",
                    _tank_name(currentGroup),
                    currentGroup.healer,
                )
            else:
                offHealer = grabNextAvailablePlayer(
                    list(available_healers), currentGroup, debug
                )
                if offHealer is not None:
                    currentGroup.healer = offHealer
                    logger.debug(
                        "%s's group - Selected offhealer: %s",
                        _tank_name(currentGroup),
                        currentGroup.healer,
                    )
                else:
                    logger.debug(
                        "%s's group - No more healers available",
                        _tank_name(currentGroup),
                    )
            logger.debug(
                "%s's group - After healer selection - Have brez: %s, have lust: %s",
                _tank_name(currentGroup),
                currentGroup.has_brez,
                currentGroup.has_lust,
            )
        else:
            logger.debug(
                "%s's group - Healer already selected: %s",
                _tank_name(currentGroup),
                currentGroup.healer,
            )

    #
    # Now fill out dps spots
    #

    # Try to grab a ranged dps if we don't have one
    for currentGroup in groups:
        if not currentGroup.has_ranged:
            ranged_dps = grabNextAvailablePlayer(
                [p for p in available_dps if p.ranged], currentGroup, debug
            )
            if ranged_dps is not None:
                currentGroup.dps.append(ranged_dps)
                logger.debug(
                    "%s's group - Added ranged DPS: %s",
                    _tank_name(currentGroup),
                    ranged_dps,
                )

    # Fill the rest of the dps slots with anyone left
    for currentGroup in groups:
        while len(currentGroup.dps) < 3:
            dps_player = grabNextAvailablePlayer(available_dps, currentGroup, debug)
            if dps_player is None:
                break
            currentGroup.dps.append(dps_player)
            logger.debug(
                "%s's group - Selected DPS: %s", _tank_name(currentGroup), dps_player
            )
        logger.debug("Formed group: %s", currentGroup)

    # We've filled out all the full groups we can, now deal with any remainder players
    while len(usedPlayers) < len(players):
        logger.debug(
            "Making a remainder group with these players: %s",
            [p.name for p in players if p not in usedPlayers],
        )
        remainderGroup = WoWGroup()
        logger.debug("remainderGroup start: %s", remainderGroup)
        while len(usedPlayers) < len(players):
            player = grabNextAvailablePlayer(
                [p for p in players if p not in usedPlayers],
                remainderGroup,
                debug,
            )
            if player is not None:
                if remainderGroup.tank is None and (player.tankMain or player.offtank):
                    remainderGroup.tank = player
                    logger.debug("Remainder group - Selected tank: %s", player)
                    continue
                elif remainderGroup.healer is None and (
                    player.healerMain or player.offhealer
                ):
                    remainderGroup.healer = player
                    logger.debug("Remainder group - Selected healer: %s", player)
                    continue
                elif len(remainderGroup.dps) < 3 and (player.dpsMain or player.offdps):
                    remainderGroup.dps.append(player)
                    logger.debug("Remainder group - Selected DPS: %s", player)
                    continue
                else:
                    # Everything is full, make another group
                    usedPlayers.remove(player)
                    logger.debug(
                        "Remainder group - Player did not fit any role: %s", player
                    )
                    break
            else:
                logger.debug("No more players to add to remainder group")
                break
        logger.debug("Formed remainder group: %s", remainderGroup)
        logger.debug(
            "usedPlayers: %d, total players: %d", len(usedPlayers), len(players)
        )
        groups.append(remainderGroup)

    _lastGroups[guild_id] = groups

    # Log final results
    logger.info("Group creation complete. Formed %d groups.", len(groups))
    for i, g in enumerate(groups, 1):
        logger.info("Group %d: %s", i, g.toTestString())

    return groups
