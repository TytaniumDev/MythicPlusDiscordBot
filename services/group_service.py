import asyncio
import os
from typing import cast

import discord
from discord.ext import commands

from core.config import (
    PLACEHOLDER_CHAR,
    REVEAL_SOUND,
    SPIN_SOUND,
    WHEEL_GIF,
)
from core.models import WoWGroup, WoWPlayer
from core.parallel_group_creator import create_mythic_plus_groups
from core.utils import (
    dashed,
    getPlayerList,
    join_voice_channel,
    play_sound,
    showShortTyping,
)


class GroupService:
    def __init__(self):
        # Store last results per-server (guild) to avoid race conditions
        # Format: {guild_id: {"players": [...], "groups": [...]}}
        self.last_results: dict[int, dict[str, list[WoWPlayer] | list[WoWGroup]]] = {}

        # Locks per server to prevent concurrent group creation
        # Format: {guild_id: asyncio.Lock}
        self.server_locks: dict[int, asyncio.Lock] = {}

    async def core_wheel(
        self,
        ctx: commands.Context[commands.Bot],
        debug_value: bool | None = None,
        enhanced: bool = False,
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
            await self._execute_core_wheel(ctx, channel, guild_id, debug, enhanced)

    async def _execute_core_wheel(
        self,
        ctx: commands.Context[commands.Bot],
        channel: discord.abc.GuildChannel | discord.abc.Messageable,
        guild_id: int,
        debug: bool,
        enhanced: bool = False,
    ) -> None:
        """Internal function that performs the actual group creation (called within lock)."""
        voice_client: discord.VoiceClient | None = None
        if enhanced:
            voice_client = await join_voice_channel(ctx)

        # Get the members of the channel we want to use to fill the roles
        if debug:
            # Testing Code - guild is guaranteed to exist since guild_id was passed
            if ctx.guild is None:
                members = []
            else:
                testChannel = discord.utils.get(
                    ctx.guild.channels, name="path-of-exile"
                )
                if testChannel is None or not hasattr(testChannel, "members"):
                    members = []
                else:
                    members = [m for m in testChannel.members if not m.bot]
        else:
            members = cast(
                list[discord.Member],
                [m for m in channel.members if not m.bot],
            )

        if not members:
            await ctx.send("❌ No players found in the channel.")
            return

        players = getPlayerList(members)
        if not players:
            await ctx.send("❌ No players with valid roles found.")
            return

        groups = create_mythic_plus_groups(players, debug=debug)

        # Store results per-server to avoid race conditions
        self.last_results[guild_id] = {"players": list(players), "groups": list(groups)}

        for i, group in enumerate(groups, 1):
            # Print out the group in an embed to keep it tidy
            embed = discord.Embed(color=discord.Color.gold())
            embed.title = f"Group {i}"

            # Get player names or placeholders
            tank_name = group.tank.name if group.tank else PLACEHOLDER_CHAR
            healer_name = group.healer.name if group.healer else PLACEHOLDER_CHAR
            dps1_name = group.dps[0].name if len(group.dps) > 0 else PLACEHOLDER_CHAR
            dps2_name = group.dps[1].name if len(group.dps) > 1 else PLACEHOLDER_CHAR
            dps3_name = group.dps[2].name if len(group.dps) > 2 else PLACEHOLDER_CHAR

            # Find players with utilities
            brez_player = next(
                (
                    p.name
                    for p in [group.tank, group.healer] + group.dps
                    if p and p.hasBrez
                ),
                "None",
            )
            lust_player = next(
                (
                    p.name
                    for p in [group.tank, group.healer] + group.dps
                    if p and p.hasLust
                ),
                "None",
            )

            if debug:
                embed.add_field(name="Tank", value=f"{tank_name}").add_field(
                    name="Healer", value=f"{healer_name}"
                ).add_field(
                    name="DPS", value=f"{dps1_name}, {dps2_name}, {dps3_name}"
                ).add_field(
                    name="Battle Res", value=f"{brez_player}", inline=True
                ).add_field(name="Bloodlust", value=f"{lust_player}", inline=True)
                embedMessage = await ctx.send(embed=embed)
            else:
                if enhanced:
                    if os.path.exists(WHEEL_GIF):
                        await ctx.send(file=discord.File(WHEEL_GIF))
                    await play_sound(voice_client, SPIN_SOUND)
                    await asyncio.sleep(2)

                embed.add_field(name="Tank", value=f"{dashed(tank_name)}").add_field(
                    name="Healer", value=f"{dashed(healer_name)}"
                ).add_field(
                    name="DPS",
                    value=f"{dashed(dps1_name)}, {dashed(dps2_name)}, {dashed(dps3_name)}",
                ).add_field(
                    name="Battle Res", value=f"{dashed(brez_player)}", inline=True
                ).add_field(
                    name="Bloodlust", value=f"{dashed(lust_player)}", inline=True
                )

                embedMessage = await ctx.send(embed=embed)
                await showShortTyping(channel, debug_mode=debug)
                if enhanced:
                    await play_sound(voice_client, REVEAL_SOUND)
                embedMessage = await embedMessage.edit(
                    embed=embed.set_field_at(index=0, name="Tank", value=f"{tank_name}")
                )
                await showShortTyping(channel, debug_mode=debug)
                if enhanced:
                    await play_sound(voice_client, REVEAL_SOUND)
                embedMessage = await embedMessage.edit(
                    embed=embed.set_field_at(
                        index=1, name="Healer", value=f"{healer_name}"
                    )
                )
                await showShortTyping(channel, debug_mode=debug)
                if enhanced:
                    await play_sound(voice_client, REVEAL_SOUND)
                embedMessage = await embedMessage.edit(
                    embed=embed.set_field_at(
                        index=2,
                        name="DPS",
                        value=f"{dps1_name}, {dashed(dps2_name)}, {dashed(dps3_name)}",
                    )
                )
                await showShortTyping(channel, debug_mode=debug)
                if enhanced:
                    await play_sound(voice_client, REVEAL_SOUND)
                embedMessage = await embedMessage.edit(
                    embed=embed.set_field_at(
                        index=2,
                        name="DPS",
                        value=f"{dps1_name}, {dps2_name}, {dashed(dps3_name)}",
                    )
                )
                await showShortTyping(channel, debug_mode=debug)
                if enhanced:
                    await play_sound(voice_client, REVEAL_SOUND)
                embedMessage = await embedMessage.edit(
                    embed=embed.set_field_at(
                        index=2,
                        name="DPS",
                        value=f"{dps1_name}, {dps2_name}, {dps3_name}",
                    )
                )
                embedMessage = await embedMessage.edit(
                    embed=embed.set_field_at(
                        index=3, name="Battle Res", value=f"{brez_player}"
                    )
                )
                embedMessage = await embedMessage.edit(
                    embed=embed.set_field_at(
                        index=4, name="Bloodlust", value=f"{lust_player}"
                    )
                )
