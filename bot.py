import discord
from discord.ext import commands

from core.config import BOT_TOKEN
from services.group_service import GroupService

intents = discord.Intents.default()
intents.message_content = True
intents.members = True


class MythicPlusBot(commands.Bot):
    def __init__(self):
        super().__init__(command_prefix=["!", "/"], intents=intents)
        self.group_service = GroupService()

    async def setup_hook(self):
        # Load extensions
        await self.load_extension("cogs.general")
        await self.load_extension("cogs.roles")
        await self.load_extension("cogs.groups")
        await self.load_extension("cogs.debug")

        print("Syncing commands...")
        try:
            synced = await self.tree.sync()
            print(f"Synced {len(synced)} commands.")
        except Exception as e:
            print(f"Failed to sync commands: {e}")


bot = MythicPlusBot()


@bot.event
async def on_ready():
    if bot.user:
        print(f"Logged in as {bot.user} (ID: {bot.user.id})")


@bot.event
async def on_command_error(
    ctx: commands.Context[commands.Bot],
    error: commands.CommandError,
) -> None:
    if isinstance(error, commands.CommandNotFound):
        return  # Ignore unknown commands
    if isinstance(error, commands.MissingPermissions):
        await ctx.send("❌ You don't have permission to use this command.")
        return
    if isinstance(error, commands.CommandOnCooldown):
        await ctx.send(
            f"❌ Command is on cooldown. Try again in {error.retry_after:.1f} seconds."
        )
        return
    # Log other errors
    print(f"Error in {ctx.command}: {error}")
    await ctx.send(
        "❌ An error occurred while processing your command. Please try again later."
    )


if __name__ == "__main__":
    if not BOT_TOKEN:
        raise ValueError(
            "BOT_TOKEN environment variable is required. Please check your .env file."
        )
    try:
        bot.run(BOT_TOKEN)
    except discord.LoginFailure:
        print("❌ Failed to login. Please check your BOT_TOKEN.")
    except Exception as e:
        print(f"❌ Fatal error starting bot: {e}")
