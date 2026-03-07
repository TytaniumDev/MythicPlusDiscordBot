import asyncio
import logging

import discord

from core.config import (
    ROLE_BREZ,
    ROLE_HEALER,
    ROLE_HEALER_OFFSPEC,
    ROLE_LUST,
    ROLE_MELEE,
    ROLE_MELEE_OFFSPEC,
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


def _get_player_from_member(member: discord.Member) -> WoWPlayer:
    """
    Creates a WoWPlayer instance from a Discord member.
    Uses saved preferences only — no Discord role fallback.
    """
    name = get_wow_name(member)
    saved_roles = get_player_preference(name)
    if saved_roles:
        return WoWPlayer.create(name=name, roles=saved_roles)
    return WoWPlayer(name=name)


def get_player_list(members: list[discord.Member]) -> list[WoWPlayer]:
    """Gathers the player info from the discord and returns a list of WoWPlayer objects."""
    return [_get_player_from_member(member) for member in members]


def get_debug_players() -> list[WoWPlayer]:
    """
    Returns a list of hardcoded WoWPlayer objects for testing and debug purposes.
    Ensures consistent data for verifying group creation logic.
    """
    return [
        WoWPlayer.create(
            "Martz", [ROLE_HEALER, ROLE_TANK_OFFSPEC, ROLE_MELEE_OFFSPEC, ROLE_BREZ]
        ),
        WoWPlayer.create("KingofSkillz", [ROLE_RANGED, ROLE_LUST]),
        WoWPlayer.create("chaoswaffles", [ROLE_MELEE, ROLE_TANK_OFFSPEC]),
        WoWPlayer.create("Upartyhardy", [ROLE_RANGED]),
        WoWPlayer.create("Pandemonium", [ROLE_TANK, ROLE_MELEE_OFFSPEC, ROLE_BREZ]),
        WoWPlayer.create("Will", [ROLE_MELEE]),
        WoWPlayer.create("Tytanium", [ROLE_RANGED, ROLE_HEALER_OFFSPEC, ROLE_LUST]),
        WoWPlayer.create("hammer13", [ROLE_MELEE]),
        WoWPlayer.create("Ultra9", [ROLE_RANGED, ROLE_LUST]),
        WoWPlayer.create("DrZoidberg", [ROLE_RANGED]),
        WoWPlayer.create("Player1x", [ROLE_RANGED, ROLE_HEALER_OFFSPEC, ROLE_LUST]),
        WoWPlayer.create("lizardtotem", [ROLE_HEALER, ROLE_MELEE_OFFSPEC]),
        WoWPlayer.create("rorschach128", [ROLE_MELEE]),
    ]
