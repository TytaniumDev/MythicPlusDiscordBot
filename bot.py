import discord
import os
import asyncio
from discord.ext import commands
from services.group_service import GroupService

# Load environment variables
# config.py does load_dotenv(), but we can do it explicitly if we want.
# Assuming config imported implicitly or we just trust os.getenv
from dotenv import load_dotenv
load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN")
if not BOT_TOKEN:
    raise ValueError("BOT_TOKEN environment variable is required. Please check your .env file.")

intents = discord.Intents.default()
intents.message_content = True
intents.members = True

class MythicBot(commands.Bot):
    def __init__(self):
        super().__init__(command_prefix=["!", "/"], intents=intents)
        self.group_service = GroupService()

    async def setup_hook(self):
        print("Loading extensions...")
        initial_extensions = [
            "cogs.general",
            "cogs.roles",
            "cogs.groups",
            "cogs.debug",
        ]
        for extension in initial_extensions:
            try:
                await self.load_extension(extension)
                print(f"Loaded extension: {extension}")
            except Exception as e:
                print(f"Failed to load extension {extension}: {e}")

        print("Syncing commands...")
        try:
            synced = await self.tree.sync()
            print(f"Synced {len(synced)} commands.")
        except Exception as e:
            print(f"Failed to sync commands: {e}")

bot = MythicBot()

@bot.event
async def on_ready():
    print(f"Logged in as {bot.user} (ID: {bot.user.id})")

# Global error handler for unhandled command errors
@bot.event
async def on_command_error(ctx, error):
    if isinstance(error, commands.CommandNotFound):
        return  # Ignore unknown commands
    if isinstance(error, commands.MissingPermissions):
        await ctx.send("❌ You don't have permission to use this command.")
        return
    if isinstance(error, commands.CommandOnCooldown):
        await ctx.send(f"❌ Command is on cooldown. Try again in {error.retry_after:.1f} seconds.")
        return
    # Log other errors
    print(f"Error in {ctx.command}: {error}")
    await ctx.send("❌ An error occurred while processing your command. Please try again later.")

if __name__ == "__main__":
    try:
        bot.run(BOT_TOKEN)
    except discord.LoginFailure:
        print("❌ Failed to login. Please check your BOT_TOKEN.")
    except Exception as e:
        print(f"❌ Fatal error starting bot: {e}")
