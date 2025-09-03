from typing import List, Optional
from models import WoWPlayer, WoWGroup


def create_mythic_plus_groups(players: List[WoWPlayer]) -> List[WoWGroup]:
    # Create empty groups list
    groups: List[WoWGroup] = []
    remaining_players = players.copy()

    # Keep creating groups until we can't make any more complete ones
    while remaining_players:
        group = WoWGroup()

        # Try to fill the group with main spec players first
        # Tank selection - prefer main tanks with utility
        tanks = [p for p in remaining_players if p.tankMain]
        if not tanks:  # Try offtanks if no main tanks available
            tanks = [p for p in remaining_players if p.offtank]

        if tanks:
            # Prioritize tanks with brez if no group has brez yet
            brez_tanks = [t for t in tanks if t.hasBrez]
            if brez_tanks and not any(g.has_brez for g in groups):
                group.tank = brez_tanks[0]
            else:
                group.tank = tanks[0]
            remaining_players.remove(group.tank)

        # Healer selection - prefer main healers
        healers = [p for p in remaining_players if p.healerMain]
        if not healers:  # Try offhealers if no main healers available
            healers = [p for p in remaining_players if p.offhealer]

        if healers:
            # Prioritize healers with utility (brez/lust) if group needs it
            if not group.has_brez:
                brez_healers = [h for h in healers if h.hasBrez]
                if brez_healers:
                    group.healer = brez_healers[0]
                    remaining_players.remove(group.healer)
                    healers.remove(group.healer)

            if not group.healer and not group.has_lust:
                lust_healers = [h for h in healers if h.hasLust]
                if lust_healers:
                    group.healer = lust_healers[0]
                    remaining_players.remove(group.healer)
                    healers.remove(group.healer)

            if not group.healer and healers:
                group.healer = healers[0]
                remaining_players.remove(group.healer)

        # DPS selection
        dps_slots = ["dps1", "dps2", "dps3"]
        main_dps = [p for p in remaining_players if p.dpsMain]
        off_dps = [p for p in remaining_players if p.offdps]

        for slot in dps_slots:
            if not main_dps and not off_dps:
                break

            available_dps = main_dps if main_dps else off_dps
            selected_dps = None

            # Prioritize getting one ranged DPS if we don't have one
            if not group.has_ranged:
                ranged_dps = [d for d in available_dps if d.ranged]
                if ranged_dps:
                    selected_dps = ranged_dps[0]

            # If we still need brez and haven't selected a dps yet
            if not selected_dps and not group.has_brez:
                brez_dps = [d for d in available_dps if d.hasBrez]
                if brez_dps:
                    selected_dps = brez_dps[0]

            # If we still need lust and haven't selected a dps yet
            if not selected_dps and not group.has_lust:
                lust_dps = [d for d in available_dps if d.hasLust]
                if lust_dps:
                    selected_dps = lust_dps[0]

            # If we still haven't selected anyone, take the first available
            if not selected_dps and available_dps:
                selected_dps = available_dps[0]

            if selected_dps:
                setattr(group, slot, selected_dps)
                remaining_players.remove(selected_dps)
                if selected_dps in main_dps:
                    main_dps.remove(selected_dps)
                if selected_dps in off_dps:
                    off_dps.remove(selected_dps)

        # Add the group if it has at least one player
        if group.size > 0:
            groups.append(group)
        else:
            break

    return groups
