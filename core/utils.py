import asyncio
import logging

import discord

from core.models import WoWPlayer
from core.storage import get_player_preference

logger = logging.getLogger(__name__)


def get_wow_name(
    member: discord.Member | discord.User, debug: bool | None = None
) -> str:
    """
    Returns the member's nickname if it exists, or their normal Discord name if
    they don't have a nickname set.
    This corresponds to the member's WoW in game name, usually.
    """
    nick = getattr(member, "nick", None)
    if debug:
        logger.debug(
            "get_wow_name - Member: %s\nNick: %s\nGlobal: %s",
            member,
            nick,
            member.global_name,
        )

    if nick is not None:
        raw_name = str(nick)
    elif member.global_name is not None:
        raw_name = member.global_name
    else:
        raw_name = str(member)

    return raw_name.replace(".", "")


async def show_long_typing(
    channel: discord.abc.Messageable | discord.abc.GuildChannel,
    debug_mode: bool = False,
) -> None:
    # Skip sleeps in debug mode for faster testing
    if not debug_mode:
        async with channel.typing():
            await asyncio.sleep(2)


async def show_short_typing(
    channel: discord.abc.Messageable | discord.abc.GuildChannel,
    debug_mode: bool = False,
) -> None:
    # Skip sleeps in debug mode for faster testing
    if not debug_mode:
        async with channel.typing():
            await asyncio.sleep(1)


def get_masked_name(name: str) -> str:
    """
    Returns a masked string of '?' characters with the same length as the input name.
    Used for creating suspense in UI elements.
    """
    return "?" * len(name)


def _get_player_from_member(member: discord.Member) -> WoWPlayer | None:
    """
    Creates a WoWPlayer instance from a Discord member.
    Prioritizes saved preferences over Discord roles.
    """
    name = get_wow_name(member)
    # Check for persistent preferences first
    saved_roles = get_player_preference(name)

    if saved_roles:
        logger.info("Creating WoWPlayer for %s from SAVED roles: %s", name, saved_roles)
        return WoWPlayer.create(name=name, roles=saved_roles)

    if len(member.roles) > 1:
        logger.info(
            "Creating WoWPlayer for %s from DISCORD roles: %s",
            name,
            [role.name for role in member.roles],
        )
        player = WoWPlayer.create(name=name, roles=[role.name for role in member.roles])
        if player.hasRoles():
            return player
        else:
            logger.info(" - No valid roles found for %s, skipping.", name)

    return None


def get_player_list(members: list[discord.Member]) -> list[WoWPlayer]:
    """Gathers the player info from the discord and returns a list of WoWPlayer objects."""
    players = []
    for member in members:
        player = _get_player_from_member(member)
        if player:
            players.append(player)
    return players
