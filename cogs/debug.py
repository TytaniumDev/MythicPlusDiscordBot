import logging

import discord
from discord.ext import commands

logger = logging.getLogger(__name__)


class Debug(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @commands.command()
    async def test(self, ctx: commands.Context[commands.Bot]) -> None:
        try:
            # Assumes group_service is attached to bot
            if hasattr(self.bot, "group_service"):
                await self.bot.group_service.core_wheel(ctx, debug_value=True)
            else:
                await ctx.send("❌ GroupService not initialized.")
        except discord.HTTPException as e:
            await ctx.send(f"❌ Discord API Error: {e.status} - {e.text}")
        except Exception as e:
            await ctx.send("❌ An unexpected error occurred. Please try again later.")
            logger.error("Error in test command: %s", e)

    @commands.command()
    async def testcase(self, ctx: commands.Context[commands.Bot]) -> None:
        try:
            await self._print_player_list(ctx)
        except discord.HTTPException as e:
            await ctx.send(f"❌ Discord API Error: {e.status} - {e.text}")
        except Exception as e:
            await ctx.send("❌ An unexpected error occurred. Please try again later.")
            logger.error("Error in testcase command: %s", e)

    async def _print_player_list(self, ctx: commands.Context[commands.Bot]) -> None:
        channel = ctx.channel
        guild_id = ctx.guild.id if ctx.guild else None

        if not guild_id:
            await ctx.send("❌ This command can only be used in a server.")
            return

        if not hasattr(self.bot, "group_service"):
            await ctx.send("❌ GroupService not initialized.")
            return

        # Get last results for this server
        last_results = self.bot.group_service.last_results
        if guild_id not in last_results:
            await ctx.send(
                "❌ No previous results found for this server. Run `!wheel` first."
            )
            return

        result = last_results[guild_id]
        players = result.get("players", [])
        groups = result.get("groups", [])

        await channel.send(
            "players = [{}]".format(
                ", ".join(player.toTestString() for player in players)
            )
        )
        await channel.send(
            "Groups:\n\n{}".format(
                "\n\n".join(group.toTestString() for group in groups)
            )
        )


async def setup(bot: commands.Bot):
    await bot.add_cog(Debug(bot))
