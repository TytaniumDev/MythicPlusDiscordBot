from typing import List
import random
from models import WoWPlayer, WoWGroup

DEBUG = True


def log(s):
    if DEBUG:
        print(s)


# The last set of groups
# We'll try to match people with new players if possible
lastGroups = []


def create_mythic_plus_groups(players: List[WoWPlayer], debug=True) -> List[WoWGroup]:
    global DEBUG
    DEBUG = debug

    groups: List[WoWGroup] = []

    players = players.copy()
    usedPlayers = set()

    maximumPossibleGroups = len(players) // 5

    # Tanks
    main_tanks = [p for p in players if p.tankMain]
    off_tanks = [p for p in players if p.offtank and not p.tankMain]
    random.shuffle(main_tanks)
    random.shuffle(off_tanks)
    available_tanks = main_tanks + off_tanks
    log(f"Available tanks: {len(available_tanks)}\nMain tank: {main_tanks} --- Offtank: {off_tanks}")

    # Healers
    main_healers = [p for p in players if p.healerMain]
    off_healers = [p for p in players if p.offhealer and not p.healerMain]
    random.shuffle(main_healers)
    random.shuffle(off_healers)
    available_healers = main_healers + off_healers
    log(f"Available healers: {len(available_healers)}\nMain heals: {main_healers} --- Offheals: {off_healers}")
    offhealersToGrab = len(main_healers) < maximumPossibleGroups

    # DPS
    main_dps = [p for p in players if p.dpsMain]
    off_dps = [p for p in players if p.offdps and not p.dpsMain]
    random.shuffle(main_dps)
    random.shuffle(off_dps)
    available_dps = main_dps + off_dps
    log(f"Available DPS: {len(available_dps)}\nMain DPS: {main_dps} --- Off DPS: {off_dps}")

    # Utilities
    brez_players = [p for p in players if p.hasBrez]
    random.shuffle(brez_players)
    lust_players = [p for p in players if p.hasLust]
    random.shuffle(lust_players)
    log(f"Players with battle res: {brez_players}")
    log(f"Players with bloodlust: {lust_players}")

    # Helper functions
    def removePlayer(player: WoWPlayer):
        if player is None:
            return
        usedPlayers.add(player)
        if player in available_tanks:
            available_tanks.remove(player)
        if player in available_healers:
            available_healers.remove(player)
        if player in available_dps:
            available_dps.remove(player)
        if player in main_tanks:
            main_tanks.remove(player)
        if player in off_tanks:
            off_tanks.remove(player)
        if player in main_healers:
            main_healers.remove(player)
        if player in off_healers:
            off_healers.remove(player)
        if player in main_dps:
            main_dps.remove(player)
        if player in off_dps:
            off_dps.remove(player)

    def grabNextAvailablePlayer(role_list: List[WoWPlayer]) -> WoWPlayer:
        player = next((p for p in role_list if p not in usedPlayers), None)
        removePlayer(player)
        return player

    #
    # Start forming full groups
    #
    groups = [(WoWGroup()) for _ in range(maximumPossibleGroups)]

    # Fill out each full group in stages, parallelized
    # Grab a tank
    for currentGroup in groups:
        currentGroup.tank = grabNextAvailablePlayer(available_tanks)
        log(f"Selected tank: {currentGroup.tank}")
        log(f"After tank selection - Have brez: {currentGroup.has_brez}, have lust: {currentGroup.has_lust}")

    #
    # Fill out utility spots
    #

    # Fill bloodlust spot next because no tanks have bloodlust
    # Will grab either a healer or a dps
    for currentGroup in groups:
        if not currentGroup.has_lust:
            lust_player = grabNextAvailablePlayer((p for p in lust_players if p not in available_tanks))

            if lust_player is not None:
                if lust_player.healerMain or (offhealersToGrab > 0 and lust_player.offhealer):
                    currentGroup.healer = lust_player
                    if lust_player.offhealer:
                        offhealersToGrab -= 1
                        log(f"{currentGroup.tank.name}'s group - Selected lust player - offhealer: {lust_player}")
                    else:
                        log(f"{currentGroup.tank.name}'s group - Selected lust player - healer: {lust_player}")
                elif lust_player.dpsMain:
                    currentGroup.dps.append(lust_player)
                    log(f"{currentGroup.tank.name}'s group - Selected lust player - dps: {lust_player}")
            else:
                log(f"{currentGroup.tank.name}'s group - No more lust players available")
        else:
            log(f"{currentGroup.tank.name}'s group - Already have a lust")

    # Now grab a brez if we don't have one
    # Will grab either a healer or a dps
    for currentGroup in groups:
        if not currentGroup.has_brez:
            if currentGroup.healer is not None:
                # We have a healer already, so grab a dps brez
                brez_player = grabNextAvailablePlayer((p for p in brez_players if p not in available_tanks and p not in available_healers))
            else:
                # We don't have a healer, so grab any brez
                brez_player = grabNextAvailablePlayer((p for p in brez_players if p not in available_tanks))

            if brez_player is not None:
                if brez_player.healerMain  or (offhealersToGrab > 0 and brez_player.offhealer):
                    currentGroup.healer = brez_player
                    if brez_player.offhealer:
                        offhealersToGrab -= 1
                        log(f"{currentGroup.tank.name}'s group - Selected brez player - offhealer: {brez_player}")
                    else:
                        log(f"{currentGroup.tank.name}'s group - Selected brez player - healer: {brez_player}")
                elif brez_player.dpsMain:
                    currentGroup.dps.append(brez_player)
                    log(f"{currentGroup.tank.name}'s group - Selected brez player - dps: {brez_player}")
            else:
                log(f"{currentGroup.tank.name}'s group - No more brez players available")
        else:
            log(f"{currentGroup.tank.name}'s group - Already have a brez")

    # If we still don't have a healer, grab one now
    for currentGroup in groups:
        if currentGroup.healer is None:
            currentGroup.healer = grabNextAvailablePlayer((p for p in available_healers))
            log(f"{currentGroup.tank.name}'s group - Selected healer: {currentGroup.healer}")
            log(f"{currentGroup.tank.name}'s group - After healer selection - Have brez: {currentGroup.has_brez}, have lust: {currentGroup.has_lust}")
        else:
            log(f"{currentGroup.tank.name}'s group - Healer already selected: {currentGroup.healer}")

    #
    # Now fill out dps spots
    #

    # Try to grab a ranged dps if we don't have one
    for currentGroup in groups:
        if not currentGroup.has_ranged:
            ranged_dps = grabNextAvailablePlayer((p for p in available_dps if p.ranged))
            if ranged_dps is not None:
                currentGroup.dps.append(ranged_dps)
                log(f"{currentGroup.tank.name}'s group - Added ranged DPS: {ranged_dps}")

    # Fill the rest of the dps slots with anyone left
    for currentGroup in groups:
        while len(currentGroup.dps) < 3:
            dps_player = grabNextAvailablePlayer(available_dps)
            if dps_player is None:
                break
            currentGroup.dps.append(dps_player)
            log(f"{currentGroup.tank.name}'s group - Selected DPS: {dps_player}")
        log(f"Formed group: {currentGroup}")

    # We've filled out all the full groups we can, now deal with any remainder players
    while len(usedPlayers) < len(players):
        log(f'Making a remainder group with these players: {[p.name for p in players if p not in usedPlayers]}')
        remainderGroup = WoWGroup()
        log(f"remainderGroup start: {remainderGroup}")  
        while len(usedPlayers) < len(players):
            player = grabNextAvailablePlayer((p for p in players if p not in usedPlayers))
            if player is not None:
                if remainderGroup.tank is None and (player.tankMain or player.offtank):
                    remainderGroup.tank = player
                    log(f"Remainder group - Selected tank: {player}")
                    continue
                elif remainderGroup.healer is None and (player.healerMain or player.offhealer):
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

    global lastGroups
    lastGroups.clear()
    lastGroups = groups
    return groups
