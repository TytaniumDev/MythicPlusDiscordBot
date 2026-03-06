import asyncio
from typing import cast

import discord
from discord.ext import commands

from core.group_ui import announce_group
from core.models import WoWGroup, WoWPlayer
from core.parallel_group_creator import create_mythic_plus_groups
from core.utils import (
    get_debug_players,
    get_player_list,
)


class GroupService:
    def __init__(self):
        # Store last results per-server (guild) to avoid race conditions
        # Format: {guild_id: {"players": [...], "groups": [...]}}
        self.last_results: dict[int, dict[str, list[WoWPlayer] | list[WoWGroup]]] = {}

        # Locks per server to prevent concurrent group creation
        # Format: {guild_id: asyncio.Lock}
        self.server_locks: dict[int, asyncio.Lock] = {}

    async def get_groups_data(
        self,
        ctx: commands.Context[commands.Bot],
        debug: bool = False,
    ) -> dict[str, list[WoWPlayer] | list[WoWGroup]] | None:
        """
        Calculates groups without announcing them.
        Returns a dict with 'players' and 'groups' keys, or None if validation fails.
        Sends error messages to ctx if validation fails.
        """
        channel = ctx.channel

        # Get the members of the channel we want to use to fill the roles
        if debug:
            # Testing Code - use hardcoded players to ensure reliability
            players = get_debug_players()
        else:
            members = cast(
                list[discord.Member],
                [m for m in channel.members if not m.bot],
            )

            if not members:
                await ctx.send("❌ No players found in the channel.")
                return None

            players = get_player_list(members)
        if not players:
            await ctx.send("❌ No players with valid roles found.")
            return None

        guild_id = ctx.guild.id if ctx.guild else None
        groups = create_mythic_plus_groups(players, debug=debug, guild_id=guild_id)

        return {"players": list(players), "groups": list(groups)}

    async def core_wheel(
        self,
        ctx: commands.Context[commands.Bot],
        debug_value: bool | None = None,
    ) -> None:
        debug = False if debug_value is None else debug_value
        channel = ctx.channel
        guild_id = ctx.guild.id if ctx.guild else None

        if not guild_id:
            await ctx.send("❌ This command can only be used in a server.")
            return

        # Get or create a lock for this server to prevent concurrent executions
        if guild_id not in self.server_locks:
            self.server_locks[guild_id] = asyncio.Lock()

        server_lock = self.server_locks[guild_id]

        # Check if lock is already acquired (another command is running)
        if server_lock.locked():
            await ctx.send(
                "⏳ Another group creation is already in progress for this server. Please wait for it to complete."
            )
            return

        # Acquire the lock and execute (only one command per server at a time)
        async with server_lock:
            await self._execute_core_wheel(ctx, channel, guild_id, debug)

    async def _execute_core_wheel(
        self,
        ctx: commands.Context[commands.Bot],
        channel: discord.abc.GuildChannel | discord.abc.Messageable,
        guild_id: int,
        debug: bool,
    ) -> None:
        """Internal function that performs the actual group creation (called within lock)."""
        result = await self.get_groups_data(ctx, debug)
        if not result:
            return

        # Store results per-server to avoid race conditions
        self.last_results[guild_id] = result
        groups = cast(list[WoWGroup], result["groups"])

        for i, group in enumerate(groups, 1):
            await announce_group(ctx, channel, group, i, debug)
