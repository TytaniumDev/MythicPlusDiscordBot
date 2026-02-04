import discord
from discord.ext import commands
from core.role_ui import RoleBoardView, create_role_board_embed
from core.storage import get_player_preference, clear_player_preference
from utils.data_helpers import getPlayerList
from utils.discord_helpers import WoWName
from config import ALL_ROLES

class Roles(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    async def launch_role_board(self, ctx):
        if not ctx.guild:
            msg = "❌ This command can only be used in a server."
            if hasattr(ctx, "interaction") and ctx.interaction:
                await ctx.send(msg, ephemeral=True)
            else:
                await ctx.send(msg)
            return

        # Determine target channel: Voice channel if available, otherwise current text channel
        if ctx.author.voice and ctx.author.voice.channel:
            target_channel = ctx.author.voice.channel
        else:
            target_channel = ctx.channel

        async def update_board(interaction, board_message):
            # Re-fetch members from the channel to ensure we have the latest state.
            channel = ctx.guild.get_channel(target_channel.id)
            if not channel:
                 return

            members = [m for m in channel.members if not m.bot]
            players = getPlayerList(members)
            embed = create_role_board_embed(players)

            await board_message.edit(embed=embed)

        # Initial render
        members = [m for m in target_channel.members if not m.bot]
        players = getPlayerList(members)
        embed = create_role_board_embed(players)
        view = RoleBoardView(update_callback=update_board)

        await ctx.send(embed=embed, view=view)

    @commands.hybrid_command(name="roles")
    async def roles(self, ctx):
        """Opens the Mythic+ Role Board for the current voice channel."""
        await self.launch_role_board(ctx)

    @commands.hybrid_command(name="readycheck")
    async def readycheck(self, ctx):
        """Alias for /roles. Opens the Mythic+ Role Board."""
        await self.launch_role_board(ctx)

    @commands.command()
    async def rolecheck(self, ctx):
        """List saved roles for everyone in the current voice channel (or recent players)."""
        channel = ctx.author.voice.channel if ctx.author.voice else ctx.channel
        members = [m for m in channel.members if not m.bot]

        if not members:
            await ctx.send("No members found in the channel.")
            return

        embed = discord.Embed(title="Saved Roles Check", color=discord.Color.blue())

        found_any = False
        for member in members:
            name = WoWName(member)
            saved_roles = get_player_preference(name)
            if saved_roles:
                embed.add_field(name=name, value=", ".join(saved_roles), inline=False)
                found_any = True
            else:
                # Check if they have discord roles at least
                discord_roles = [r.name for r in member.roles if r.name in ALL_ROLES]
                if discord_roles:
                     embed.add_field(name=f"{name} (Discord Only)", value=", ".join(discord_roles), inline=False)
                     found_any = True

        if not found_any:
            await ctx.send("No saved roles found for anyone in this channel.")
        else:
            await ctx.send(embed=embed)

    @commands.command()
    async def clearrole(self, ctx, name: str = None):
        """Clear your saved roles, or a specific character's roles."""
        if name is None:
            name = WoWName(ctx.author)
            success = clear_player_preference(name)
            if success:
                await ctx.send(f"✅ Cleared your saved roles, **{name}**.")
            else:
                await ctx.send(f"❌ You had no saved roles, **{name}**.")
        else:
            # Check if user has permission to clear others? Assuming guild context for now.
            success = clear_player_preference(name)
            if success:
                await ctx.send(f"✅ Cleared saved roles for **{name}**.")
            else:
                await ctx.send(f"❌ No saved roles found for **{name}**.")

async def setup(bot):
    await bot.add_cog(Roles(bot))
