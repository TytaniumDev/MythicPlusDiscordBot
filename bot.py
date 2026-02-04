import io
import traceback
from typing import Any

import discord
from discord import app_commands
from discord.ext import commands

from core.config import BOT_TOKEN, DEVELOPER_ID
from services.group_service import GroupService

intents = discord.Intents.default()
intents.message_content = True
intents.members = True


class MythicPlusBot(commands.Bot):
    def __init__(self):
        super().__init__(command_prefix=["!", "/"], intents=intents)
        self.group_service = GroupService()

    async def _send_error_to_dev(
        self, error: BaseException, context_info: str = "Unknown Context"
    ) -> None:
        """Sends a detailed error message and traceback to the developer via DM."""
        try:
            dev = self.get_user(DEVELOPER_ID) or await self.fetch_user(DEVELOPER_ID)
            if not dev:
                print(f"Could not find developer with ID {DEVELOPER_ID}")
                return

            tb_str = "".join(
                traceback.format_exception(type(error), error, error.__traceback__)
            )

            message = f"⚠️ **Bot Error Detected**\n**Context:** {context_info}\n**Error:** `{error}`"

            if len(tb_str) + len(message) < 1900:
                await dev.send(f"{message}\n```python\n{tb_str}\n```")
            else:
                # If traceback is too long, send it as a file
                await dev.send(
                    message,
                    file=discord.File(
                        fp=io.BytesIO(tb_str.encode("utf-8")),
                        filename="traceback.txt",
                    ),
                )
        except Exception as e:
            print(f"Failed to send error DM to developer: {e}")
            print(f"Original error in {context_info}: {error}")

    async def setup_hook(self):
        # Load extensions
        await self.load_extension("cogs.general")
        await self.load_extension("cogs.roles")
        await self.load_extension("cogs.groups")
        await self.load_extension("cogs.debug")

        # Register app command error handler
        self.tree.on_error = self.on_app_command_error

        print("Syncing commands...")
        try:
            synced = await self.tree.sync()
            print(f"Synced {len(synced)} commands.")
        except Exception as e:
            print(f"Failed to sync commands: {e}")

    async def on_ready(self):
        if self.user:
            print(f"Logged in as {self.user} (ID: {self.user.id})")

    async def on_app_command_error(
        self, interaction: discord.Interaction, error: app_commands.AppCommandError
    ) -> None:
        """Handles errors in slash commands."""
        if isinstance(error, app_commands.CommandOnCooldown):
            await interaction.response.send_message(
                f"❌ Command is on cooldown. Try again in {error.retry_after:.1f} seconds.",
                ephemeral=True,
            )
            return

        # Log and notify developer for other errors
        context = (
            f"App Command: /{interaction.command.name if interaction.command else 'Unknown'}\n"
            f"User: {interaction.user} ({interaction.user.id})\n"
            f"Channel: {interaction.channel}"
        )
        await self._send_error_to_dev(error, context)

        print(f"App Command Error: {error}")
        if not interaction.response.is_done():
            await interaction.response.send_message(
                "❌ An error occurred while processing your command. Please try again later.",
                ephemeral=True,
            )
        else:
            await interaction.followup.send(
                "❌ An error occurred while processing your command. Please try again later.",
                ephemeral=True,
            )

    async def on_error(self, event_method: str, *args: Any, **kwargs: Any) -> None:
        """Handles errors in events."""
        import sys

        _, error, _ = sys.exc_info()
        if error:
            context = f"Event: {event_method}\nArgs: {args}\nKwargs: {kwargs}"
            await self._send_error_to_dev(error, context)
            print(f"Error in event {event_method}: {error}")
        else:
            print(f"Error in event {event_method} (no exception info)")

    async def on_command_error(
        self,
        context: commands.Context[Any],
        exception: commands.CommandError,
    ) -> None:
        if isinstance(exception, commands.CommandNotFound):
            return  # Ignore unknown commands
        if isinstance(exception, commands.MissingPermissions):
            await context.send("❌ You don't have permission to use this command.")
            return
        if isinstance(exception, commands.CommandOnCooldown):
            await context.send(
                f"❌ Command is on cooldown. Try again in {exception.retry_after:.1f} seconds."
            )
            return

        # Log and notify developer for other errors
        context_info = (
            f"Command: !{context.command}\n"
            f"User: {context.author} ({context.author.id})\n"
            f"Channel: {context.channel}"
        )
        await self._send_error_to_dev(exception, context_info)

        print(f"Error in {context.command}: {exception}")
        await context.send(
            "❌ An error occurred while processing your command. Please try again later."
        )


bot = MythicPlusBot()


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
