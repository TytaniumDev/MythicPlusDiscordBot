from core.models import WoWPlayer
from core.storage import get_player_preference
from utils.discord_helpers import WoWName

# Gathers the player info from the discord and returns a list of WoWPlayer objects.
def getPlayerList(members) -> list[WoWPlayer]:
    players = []
    for member in members:
        name = WoWName(member)
        # Check for persistent preferences first
        saved_roles = get_player_preference(name)

        if saved_roles:
            print(f'Creating WoWPlayer for {name} from SAVED roles: {saved_roles}')
            player = WoWPlayer.create(name=name, roles=saved_roles)
            players.append(player)
        elif len(member.roles) > 1:
            print(f'Creating WoWPlayer for {name} from DISCORD roles: {[role.name for role in member.roles]}')
            player = WoWPlayer.create(name=name, roles=[role.name for role in member.roles])
            if(player.hasRoles()):
                players.append(player)
            else:
                print(f' - No valid roles found for {player}, skipping.')
    return players
