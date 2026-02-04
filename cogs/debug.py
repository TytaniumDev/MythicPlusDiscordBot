import discord
from discord.ext import commands

class Debug(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @property
    def service(self):
        return self.bot.group_service

    # !test
    # Runs the !wheel function, but hardcoded to use testing data in my personal
    # discord server.
    @commands.command()
    async def test(self, ctx):
        try:
            await self.service.coreWheel(ctx, debugValue=True)
        except discord.HTTPException as e:
            await ctx.send(f"❌ Discord API Error: {e.status} - {e.text}")
        except Exception as e:
            await ctx.send("❌ An unexpected error occurred. Please try again later.")
            print(f"Error in test command: {e}")

    @commands.command()
    async def testcase(self, ctx):
        try:
            await self.printPlayerList(ctx=ctx)
        except discord.HTTPException as e:
            await ctx.send(f"❌ Discord API Error: {e.status} - {e.text}")
        except Exception as e:
            await ctx.send("❌ An unexpected error occurred. Please try again later.")
            print(f"Error in testcase command: {e}")

    async def printPlayerList(self, ctx):
        channel = ctx.channel
        guild_id = ctx.guild.id if ctx.guild else None

        if not guild_id:
            await ctx.send("❌ This command can only be used in a server.")
            return

        # Get last results for this server
        if guild_id not in self.service.last_results:
            await ctx.send("❌ No previous results found for this server. Run `!wheel` first.")
            return

        result = self.service.last_results[guild_id]
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

async def setup(bot):
    await bot.add_cog(Debug(bot))
