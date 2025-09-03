from typing import List
import random
from models import WoWPlayer, WoWGroup

DEBUG = False


def log(s):
    if DEBUG:
        print(s)


def create_mythic_plus_groups(players: List[WoWPlayer], debug=False) -> List[WoWGroup]:
    DEBUG = debug

    # Create a copy of the players list and track used players
    players = players.copy()
    used_players = set()
    groups = []

    # Keep track of utility players for even distribution
    brez_players = [p for p in players if p.hasBrez]
    lust_players = [p for p in players if p.hasLust]
    # Ensure utility players are at the front of the DPS lists for better distribution
    main_dps = [p for p in players if p.dpsMain and (p.hasBrez or p.hasLust)] + \
               [p for p in players if p.dpsMain and not p.hasBrez and not p.hasLust]
    log(f"Players with battle res: {brez_players}")
    log(f"Players with bloodlust: {lust_players}")

    # Sort players into role pools
    # First, sort players by utilities to ensure even distribution
    utility_dps = [p for p in players if p.dpsMain and (p.hasBrez or p.hasLust)]
    regular_dps = [p for p in players if p.dpsMain and not p.hasBrez and not p.hasLust]

    main_tanks = [p for p in players if p.tankMain]
    off_tanks = [p for p in players if p.offtank and not p.tankMain]
    random.shuffle(main_tanks)
    random.shuffle(off_tanks)
    available_tanks = main_tanks + off_tanks
    log(f"Available tanks (main + off): {len(available_tanks)}")

    main_healers = [p for p in players if p.healerMain]
    off_healers = [p for p in players if p.offhealer and not p.healerMain]
    random.shuffle(main_healers)
    random.shuffle(off_healers)
    available_healers = main_healers + off_healers
    log(f"Available healers (main + off): {len(available_healers)}")

    # Prioritize utility DPS first, then regular DPS
    random.shuffle(utility_dps)
    random.shuffle(regular_dps)
    main_dps = utility_dps + regular_dps

    off_dps = [p for p in players if p.offdps and not p.dpsMain]
    random.shuffle(off_dps)
    available_dps = main_dps + off_dps
    log(f"Available DPS (main + off): {len(available_dps)}")

    def removePlayer(player: WoWPlayer):
        if player is None:
            return
        used_players.add(player)
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

    def canFormGroup(tank: WoWPlayer, healer: WoWPlayer, remaining_dps: List[WoWPlayer]) -> bool:
        # Check if we have enough players for a complete group
        return tank is not None and healer is not None and len(remaining_dps) >= 3

    def getNextAvailablePlayer(role_list: List[WoWPlayer]) -> WoWPlayer:
        return next((p for p in role_list if p not in used_players), None)

    def get_group_utilities(group: WoWGroup) -> tuple[bool, bool]:
        # Returns a tuple of (has_brez, has_lust) for the given group
        members = [p for p in [group.tank, group.healer, group.dps1, group.dps2, group.dps3] if p is not None]
        has_brez = any(p.hasBrez for p in members)
        has_lust = any(p.hasLust for p in members)
        return has_brez, has_lust

    def count_utilities_per_group():
        # Returns lists of groups that have each utility
        groups_with_brez = []
        groups_with_lust = []
        for idx, group in enumerate(groups):
            has_brez, has_lust = get_group_utilities(group)
            if has_brez:
                groups_with_brez.append(idx)
            if has_lust:
                groups_with_lust.append(idx)
        return groups_with_brez, groups_with_lust

    def selectDPS(remaining_dps: List[WoWPlayer], current_group: WoWGroup, max_groups: int) -> WoWPlayer:
        # Get available DPS that haven't been used yet
        available_dps = [p for p in remaining_dps if p not in used_players]
        if not available_dps:
            return None

        # Check current group utilities
        has_brez, has_lust = get_group_utilities(current_group)

        # Check utility distribution across all groups
        groups_with_brez, groups_with_lust = count_utilities_per_group()

        # Count how many groups could potentially have both utilities
        remaining_brez = len([p for p in players if p.hasBrez and p not in used_players])
        remaining_lust = len([p for p in players if p.hasLust and p not in used_players])
        potential_utility_groups = min(remaining_brez, remaining_lust)

        # Try to pair utilities in groups when possible
        if potential_utility_groups > len([g for g in groups if g.has_brez and g.has_lust]):
            if not has_brez and not has_lust:
                # Try to get either utility, prioritizing brez
                brez_dps = next((p for p in available_dps if p.hasBrez), None)
                if brez_dps:
                    return brez_dps
                lust_dps = next((p for p in available_dps if p.hasLust), None)
                if lust_dps:
                    return lust_dps
            elif has_brez and not has_lust:
                # If we have brez but no lust, try to get lust in same group
                lust_dps = next((p for p in available_dps if p.hasLust), None)
                if lust_dps:
                    return lust_dps
            elif has_lust and not has_brez:
                # If we have lust but no brez, try to get brez in same group
                brez_dps = next((p for p in available_dps if p.hasBrez), None)
                if brez_dps:
                    return brez_dps

        # If we can't pair utilities or don't need to, try to get ranged if needed
        if not current_group.has_ranged:
            ranged_dps = next((p for p in available_dps if p.ranged), None)
            if ranged_dps:
                return ranged_dps

        # If all special requirements fail, just take the first available DPS
        return available_dps[0] if available_dps else None

    # Calculate maximum possible complete groups
    # For incomplete group test, set to 0 if we can't make any complete groups
    total_players = len(players)
    min_role_counts = [len(available_tanks), len(available_healers), len(available_dps) // 3]

    if all(count > 0 for count in min_role_counts):
        max_by_role = min(min_role_counts)
        max_by_total = total_players // 5  # Each complete group needs exactly 5 players
        max_possible_groups = min(max_by_role, max_by_total)
    else:
        max_possible_groups = 0  # Can't make complete groups, handle as partial group case

    log(f"Maximum possible complete groups: {max_possible_groups}")

    # Create complete groups first
    while max_possible_groups > 0 and canFormGroup(getNextAvailablePlayer(available_tanks), 
                                                 getNextAvailablePlayer(available_healers),
                                                 [p for p in available_dps if p not in used_players]):
        current_group = WoWGroup()

        # Assign tank
        tank = getNextAvailablePlayer(available_tanks)
        current_group.tank = tank
        removePlayer(tank)

        # Assign healer
        healer = getNextAvailablePlayer(available_healers)
        current_group.healer = healer
        removePlayer(healer)

        # Assign DPS
        remaining_dps = [p for p in available_dps if p not in used_players]
        for dps_slot in ['dps1', 'dps2', 'dps3']:
            dps = selectDPS(remaining_dps, current_group, max_possible_groups)
            if dps:
                setattr(current_group, dps_slot, dps)
                removePlayer(dps)

        groups.append(current_group)
        max_possible_groups -= 1

    # Handle remaining players - try to form complete groups
    def try_complete_group(remaining: List[WoWPlayer], require_complete: bool = True, try_incomplete: bool = False) -> WoWGroup:
        """Attempt to create a complete group from the remaining players."""
        def find_best_dps(available: List[WoWPlayer], group: WoWGroup, slot_num: int) -> WoWPlayer:
            """Find the best DPS for the current slot considering utilities and balance."""
            # Try to get brez first if we still need it across all groups
            remaining_groups_needed = max_possible_groups - len(groups)
            if remaining_groups_needed > 0 and not any(g.has_brez for g in groups) and not group.has_brez:
                dps = next((p for p in available if p.hasBrez), None)
                if dps:
                    return dps

            if slot_num == 0 and not group.has_brez:
                # Try to get brez first for this group
                dps = next((p for p in available if p.hasBrez), None)
                if dps:
                    return dps

            if slot_num == 1 and group.has_brez and not group.has_lust:
                # If we have brez but no lust, try to pair them
                dps = next((p for p in available if p.hasLust), None)
                if dps:
                    return dps

            if not group.has_ranged:
                # Try to get at least one ranged DPS
                dps = next((p for p in available if p.ranged), None)
                if dps:
                    return dps

            # If no special requirements, try main spec then off spec
            dps = next((p for p in available if p.dpsMain), None)
            if not dps:
                dps = next((p for p in available if p.offdps), None)
            if not dps and available:
                dps = available[0]

            return dps

        group = WoWGroup()
        used = set()
        min_members = 1 if try_incomplete else (2 if require_complete else 3)

        # For complete groups or first group, prioritize utility distribution
        is_first_group = len(groups) == 0
        need_utilities = is_first_group or require_complete

        # First check if we have a tank with brez
        tank = None
        if need_utilities:
            tank = next((p for p in remaining if p.tankMain and p.hasBrez), None)
        if not tank:
            tank = next((p for p in remaining if p.tankMain), None)
        if not tank and not require_complete:
            tank = next((p for p in remaining if p.offtank), None)

        if tank:
            group.tank = tank
            used.add(tank)

        # Check for healer with brez if we still need it
        healer = None
        if need_utilities and not group.has_brez:
            healer = next((p for p in remaining if p not in used and p.healerMain and p.hasBrez), None)
            if not healer:
                healer = next((p for p in remaining if p not in used and p.offhealer and p.hasBrez), None)
        if not healer:
            healer = next((p for p in remaining if p not in used and p.healerMain), None)
            if not healer and not require_complete:
                healer = next((p for p in remaining if p not in used and p.offhealer), None)

        if healer:
            group.healer = healer
            used.add(healer)

        # Try to fill DPS slots
        available_dps = [p for p in remaining if p not in used]
        for i, slot in enumerate(['dps1', 'dps2', 'dps3']):
            if available_dps:
                dps = find_best_dps(available_dps, group, i)
                if dps:
                    setattr(group, slot, dps)
                    used.add(dps)
                    available_dps.remove(dps)

        # Return group if it meets requirements
        if require_complete and not group.is_complete:
            # If this is our last chance to form a group, try to salvage what we can
            if try_incomplete and group.size > 0:
                return group
            return None

        if group.size >= min_members:
            # For real groups or first group, ensure we have brez if possible
            if need_utilities and not group.has_brez:
                remaining_brez = [p for p in remaining if p not in used and p.hasBrez]
                if remaining_brez:
                    # Try to swap a non-utility player with a brez player
                    for member in [group.tank, group.healer, group.dps1, group.dps2, group.dps3]:
                        if member and not member.hasBrez:
                            for brez_player in remaining_brez:
                                if (member.tankMain and brez_player.tankMain) or \
                                   (member.healerMain and brez_player.healerMain) or \
                                   (member.dpsMain and brez_player.dpsMain):
                                    # Swap players
                                    if member == group.tank:
                                        group.tank = brez_player
                                    elif member == group.healer:
                                        group.healer = brez_player
                                    elif member == group.dps1:
                                        group.dps1 = brez_player
                                    elif member == group.dps2:
                                        group.dps2 = brez_player
                                    elif member == group.dps3:
                                        group.dps3 = brez_player
                                    break
            return group

        if try_incomplete and len(remaining) > 0:
            # For single-member groups, prefer tanks then healers then DPS
            if not group.tank:
                group.tank = next((p for p in remaining), None)
            return group

        return None

    # Try to form complete groups from remaining players
    while True:
        remaining_players = [p for p in players if p not in used_players]
        if not remaining_players:
            break

        log(f"--- Handling {len(remaining_players)} remaining players ---")

        # Create a new group
        new_group = None

        # If we have no target groups or haven't reached our target yet
        if max_possible_groups == 0 or len(groups) < max_possible_groups:
            # First try to form a complete group
            require_complete = (max_possible_groups > 0)
            new_group = try_complete_group(remaining_players, require_complete=require_complete, try_incomplete=False)

        # If we couldn't form a complete group, try an incomplete group
        if not new_group:
            # For last remaining group, allow single-member groups
            if len(remaining_players) == 1:
                new_group = try_complete_group(remaining_players, require_complete=False, try_incomplete=True)
            elif len(remaining_players) >= 2:
                # Try incomplete group with at least 2 members first
                new_group = try_complete_group(remaining_players, require_complete=False, try_incomplete=True)

        # If we have a group, add it
        if new_group:
            # Remove used players
            for player in [new_group.tank, new_group.healer, new_group.dps1, new_group.dps2, new_group.dps3]:
                if player:
                    removePlayer(player)
            groups.append(new_group)
            log(
                f'Added {"complete" if new_group.is_complete else "partial"} group with {new_group.size} players'
            )

            # If we've hit our target and all groups are complete, we're done
            if max_possible_groups > 0 and len(groups) >= max_possible_groups and all(g.is_complete for g in groups):
                break

            # Continue if we can create more groups
            if max_possible_groups > 0 and len(groups) >= max_possible_groups:
                # If we're past target but have remaining players, try one more time to form a group
                remaining_players = [p for p in players if p not in used_players]
                if len(remaining_players) > 0:
                    new_group = try_complete_group(remaining_players, require_complete=False, try_incomplete=True)
                    if new_group:
                        for player in [new_group.tank, new_group.healer, new_group.dps1, new_group.dps2, new_group.dps3]:
                            if player:
                                removePlayer(player)
                        groups.append(new_group)
                        log(f"Added extra partial group with {new_group.size} players")
                break
            elif len(remaining_players) >= 1:
                continue
            else:
                break

    DEBUG = False
    return groups
