from typing import cast

import discord
from discord.ext import commands

from core.config import ALL_ROLES
from core.role_ui import (
    PlayerRoleInfo,
    RoleBoardView,
    create_role_board_embed,
    create_role_check_embed,
)
from core.storage import clear_player_preference, get_player_preference
from core.utils import get_player_list, get_wow_name


class Roles(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    async def _launch_role_board(self, ctx: commands.Context[commands.Bot]) -> None:
        if not ctx.guild:
            msg = "❌ This command can only be used in a server."
            if hasattr(ctx, "interaction") and ctx.interaction:
                await ctx.send(msg, ephemeral=True)
            else:
                await ctx.send(msg)
            return

        # Capture guild reference for the nested function (already validated above)
        guild = ctx.guild

        # Determine target channel: Voice channel if available, otherwise current text channel
        if ctx.author.voice and ctx.author.voice.channel:
            target_channel = ctx.author.voice.channel
        else:
            target_channel = ctx.channel

        async def update_board(
            interaction: discord.Interaction,
            board_message: discord.Message,
        ) -> None:
            # Re-fetch members from the channel to ensure we have the latest state.
            channel = guild.get_channel(target_channel.id)
            if not channel:
                return

            members = [m for m in channel.members if not m.bot]
            players = get_player_list(cast(list[discord.Member], members))
            embed = create_role_board_embed(players)

            await board_message.edit(embed=embed)

            # Sync updated roles to Firebase if an activity session is active
            groups_cog = self.bot.get_cog("Groups")
            if groups_cog is not None and hasattr(groups_cog, "session_service"):
                session_svc = groups_cog.session_service  # type: ignore[attr-defined]
                if guild.id in session_svc.active_sessions:
                    await session_svc.update_guild_voice_states(guild)

        # Initial render
        members = [m for m in target_channel.members if not m.bot]
        players = get_player_list(cast(list[discord.Member], members))
        embed = create_role_board_embed(players)
        view = RoleBoardView(update_callback=update_board)

        await ctx.send(embed=embed, view=view)

    @commands.hybrid_command(name="roles")
    async def roles(self, ctx: commands.Context[commands.Bot]) -> None:
        """Opens the Mythic+ Role Board for the current voice channel."""
        await self._launch_role_board(ctx)

    @commands.hybrid_command(name="readycheck")
    async def readycheck(self, ctx: commands.Context[commands.Bot]) -> None:
        """Alias for /roles. Opens the Mythic+ Role Board."""
        await self._launch_role_board(ctx)

    @commands.command()
    async def rolecheck(self, ctx: commands.Context[commands.Bot]) -> None:
        """List saved roles for everyone in the current voice channel (or recent players)."""
        voice_channel = ctx.author.voice.channel if ctx.author.voice else None
        channel = voice_channel if voice_channel else ctx.channel
        members = [m for m in channel.members if not m.bot]

        if not members:
            await ctx.send("No members found in the channel.")
            return

        player_infos: list[PlayerRoleInfo] = []
        for member in members:
            name = get_wow_name(cast(discord.Member, member))
            saved_roles = get_player_preference(name)
            if saved_roles:
                player_infos.append(PlayerRoleInfo(name=name, roles=saved_roles))
            else:
                # Check if they have discord roles at least
                discord_roles = [r.name for r in member.roles if r.name in ALL_ROLES]
                if discord_roles:
                    player_infos.append(
                        PlayerRoleInfo(
                            name=name, roles=discord_roles, is_discord_roles=True
                        )
                    )

        if not player_infos:
            await ctx.send("No saved roles found for anyone in this channel.")
        else:
            embed = create_role_check_embed(player_infos)
            await ctx.send(embed=embed)

    @commands.command()
    async def clearrole(
        self, ctx: commands.Context[commands.Bot], name: str | None = None
    ) -> None:
        """Clear your saved roles, or a specific character's roles."""
        if name is None:
            name = get_wow_name(ctx.author)
            success = clear_player_preference(name)
            if success:
                await ctx.send(f"✅ Cleared your saved roles, **{name}**.")
            else:
                await ctx.send(f"❌ You had no saved roles, **{name}**.")
        else:
            # Check if they have permission to clear others? Assuming guild context for now.
            success = clear_player_preference(name)
            if success:
                await ctx.send(f"✅ Cleared saved roles for **{name}**.")
            else:
                await ctx.send(f"❌ No saved roles found for **{name}**.")


async def setup(bot: commands.Bot):
    await bot.add_cog(Roles(bot))
