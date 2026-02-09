import asyncio
import logging

import discord

from core.config import (
    ROLE_BREZ,
    ROLE_DPS,
    ROLE_DPS_OFFSPEC,
    ROLE_HEALER,
    ROLE_HEALER_OFFSPEC,
    ROLE_LUST,
    ROLE_RANGED,
    ROLE_TANK,
    ROLE_TANK_OFFSPEC,
)
from core.models import WoWPlayer
from core.storage import get_player_preference

logger = logging.getLogger(__name__)


def get_wow_name(
    member: discord.Member | discord.User, debug: bool | None = None
) -> str:
    """
    Returns the member's nickname if it exists, or their normal Discord name if
    they don't have a nickname set.

    Args:
        member: The Discord Member or User object.
        debug: Optional flag to enable debug logging.

    Returns:
        str: The sanitized display name (dots removed).
    """
    nick = getattr(member, "nick", None)
    if debug:
        logger.debug(
            "get_wow_name - Member: %s\nNick: %s\nGlobal: %s",
            member,
            nick,
            member.global_name,
        )

    # Priority: Nickname (guild) -> Global Name -> Username/Discriminator
    if nick is not None:
        raw_name = str(nick)
    elif member.global_name is not None:
        raw_name = member.global_name
    else:
        raw_name = str(member)

    return raw_name.replace(".", "")


async def _show_typing(
    channel: discord.abc.Messageable | discord.abc.GuildChannel,
    duration: int,
    debug_mode: bool = False,
) -> None:
    """
    Internal helper to show typing indicator for a specified duration.

    Args:
        channel: The channel to show typing in.
        duration: How long (in seconds) to show typing.
        debug_mode: If True, skips the sleep for faster testing.
    """
    if not debug_mode:
        async with channel.typing():
            await asyncio.sleep(duration)


async def show_long_typing(
    channel: discord.abc.Messageable | discord.abc.GuildChannel,
    debug_mode: bool = False,
) -> None:
    """
    Shows a typing indicator for 2 seconds to simulate thinking.

    Args:
        channel: The channel to show typing in.
        debug_mode: If True, skips the wait.
    """
    await _show_typing(channel, 2, debug_mode)


async def show_short_typing(
    channel: discord.abc.Messageable | discord.abc.GuildChannel,
    debug_mode: bool = False,
) -> None:
    """
    Shows a typing indicator for 1 second to simulate thinking.

    Args:
        channel: The channel to show typing in.
        debug_mode: If True, skips the wait.
    """
    await _show_typing(channel, 1, debug_mode)


def get_masked_name(name: str) -> str:
    """
    Returns a masked string of '?' characters with the same length as the input name.

    Args:
        name: The string to mask.

    Returns:
        str: A string of '?' characters of equal length.
    """
    return "?" * len(name)


def _get_player_from_member(member: discord.Member) -> WoWPlayer | None:
    """
    Creates a WoWPlayer instance from a Discord member.

    Args:
        member: The Discord member to convert.

    Returns:
        WoWPlayer | None: The created player object, or None if no valid roles/preferences found.
    """
    name = get_wow_name(member)

    # Check for persistent preferences first
    saved_roles = get_player_preference(name)
    if saved_roles:
        logger.info("Creating WoWPlayer for %s from SAVED roles: %s", name, saved_roles)
        return WoWPlayer.create(name=name, roles=saved_roles)

    # Fallback to Discord roles
    # Check if user has more than just @everyone role
    if len(member.roles) > 1:
        discord_role_names = [role.name for role in member.roles]
        logger.info(
            "Creating WoWPlayer for %s from DISCORD roles: %s",
            name,
            discord_role_names,
        )
        player = WoWPlayer.create(name=name, roles=discord_role_names)
        if player.hasRoles():
            return player

        logger.info(
            " - No valid roles found for %s (roles: %s), skipping.",
            name,
            discord_role_names,
        )

    return None


def get_player_list(members: list[discord.Member]) -> list[WoWPlayer]:
    """
    Gathers the player info from the discord members list.

    Args:
        members: List of Discord members to process.

    Returns:
        list[WoWPlayer]: List of valid WoWPlayer objects.
    """
    players = []
    for member in members:
        player = _get_player_from_member(member)
        if player:
            players.append(player)
    return players


def get_debug_players() -> list[WoWPlayer]:
    """
    Returns a list of hardcoded WoWPlayer objects for testing and debug purposes.
    Ensures consistent data for verifying group creation logic.

    Returns:
        list[WoWPlayer]: A list of predefined test players.
    """
    return [
        WoWPlayer.create(
            "Martz", [ROLE_HEALER, ROLE_TANK_OFFSPEC, ROLE_DPS_OFFSPEC, ROLE_BREZ]
        ),
        WoWPlayer.create("KingofSkillz", [ROLE_DPS, ROLE_RANGED, ROLE_LUST]),
        WoWPlayer.create("chaoswaffles", [ROLE_DPS, ROLE_TANK_OFFSPEC]),
        WoWPlayer.create("Upartyhardy", [ROLE_DPS, ROLE_RANGED]),
        WoWPlayer.create("Pandemonium", [ROLE_TANK, ROLE_DPS_OFFSPEC, ROLE_BREZ]),
        WoWPlayer.create("Will", [ROLE_DPS]),
        WoWPlayer.create(
            "Tytanium", [ROLE_DPS, ROLE_HEALER_OFFSPEC, ROLE_RANGED, ROLE_LUST]
        ),
        WoWPlayer.create("hammer13", [ROLE_DPS]),
        WoWPlayer.create("Ultra9", [ROLE_DPS, ROLE_RANGED, ROLE_LUST]),
        WoWPlayer.create("DrZoidberg", [ROLE_DPS, ROLE_RANGED]),
        WoWPlayer.create("Player1x", [ROLE_DPS, ROLE_HEALER_OFFSPEC, ROLE_LUST]),
        WoWPlayer.create("lizardtotem", [ROLE_HEALER, ROLE_DPS_OFFSPEC]),
        WoWPlayer.create("rorschach128", [ROLE_DPS]),
    ]
