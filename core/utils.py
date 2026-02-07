import asyncio
import logging
import pathlib
from typing import cast

import discord
from discord.ext import commands

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


async def join_voice_channel(
    ctx: commands.Context[commands.Bot],
) -> discord.VoiceClient | None:
    """Joins the voice channel of the command author."""
    if not ctx.author.voice or not ctx.author.voice.channel:
        return None

    channel = ctx.author.voice.channel
    if ctx.voice_client:
        if ctx.voice_client.channel != channel:
            await ctx.voice_client.move_to(channel)
    else:
        await channel.connect()
    return cast(discord.VoiceClient | None, ctx.voice_client)


async def play_sound(voice_client: discord.VoiceClient | None, sound_path: str) -> None:
    """Plays a sound file in the given voice client."""
    if not voice_client:
        return

    path = pathlib.Path(sound_path)
    if not path.exists():
        logger.warning("Sound file not found: %s", sound_path)
        return

    try:
        if voice_client.is_playing():
            voice_client.stop()
        voice_client.play(discord.FFmpegPCMAudio(str(path)))
        # We don't necessarily want to wait for the whole sound if it's a loop
    except Exception as e:
        logger.error("Error playing sound %s: %s", sound_path, e)


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
