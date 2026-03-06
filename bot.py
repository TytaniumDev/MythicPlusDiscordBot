import io
import logging
import traceback
from typing import Any

import discord
from discord import app_commands
from discord.ext import commands

from core.config import BOT_TOKEN, DEVELOPER_ID, LOG_FILE
from core.firebase_service import FirebaseService
from core.issues import create_error_issue
from services.group_service import GroupService

# Age in seconds beyond which abandoned docs are deleted on bot startup (24 hours).
FIREBASE_DOC_MAX_AGE_SECONDS = 24 * 60 * 60

intents = discord.Intents.default()
intents.message_content = True
intents.members = True

logger = logging.getLogger(__name__)


class MythicPlusBot(commands.Bot):
    def __init__(self):
        super().__init__(command_prefix=["!", "/"], intents=intents)
        self.group_service = GroupService()

    async def close(self) -> None:
        # Shut down Firestore listeners from the Groups cog
        groups_cog = self.cogs.get("Groups")
        if groups_cog and hasattr(groups_cog, "session_service"):
            groups_cog.session_service.shutdown()  # pyright: ignore[reportAttributeAccessIssue]
        await super().close()

    async def _send_error_to_dev(
        self, error: BaseException, context_info: str = "Unknown Context"
    ) -> None:
        """Sends a detailed error message and traceback to the developer via DM."""
        dev: discord.User | None = None
        try:
            dev = self.get_user(DEVELOPER_ID) or await self.fetch_user(DEVELOPER_ID)
            if not dev:
                logger.error("Could not find developer with ID %s", DEVELOPER_ID)
                return

            tb_str = "".join(
                traceback.format_exception(type(error), error, error.__traceback__)
            )

            message = f"⚠️ **Bot Error Detected**\n**Context:** {context_info}\n**Error:** `{error}`"
            files = []

            # Attach traceback if too long
            if len(tb_str) + len(message) >= 1900:
                files.append(
                    discord.File(
                        fp=io.BytesIO(tb_str.encode("utf-8")),
                        filename="traceback.txt",
                    )
                )
            else:
                message += f"\n```python\n{tb_str}\n```"

            # Attach recent logs
            import os

            if os.path.exists(LOG_FILE):
                files.append(discord.File(LOG_FILE))

            await dev.send(message, files=files)

        except Exception as e:
            logger.error("Failed to send error DM to developer: %s", e)
            logger.error("Original error in %s: %s", context_info, error)

        # Auto-create GitHub issue with PII obfuscated (fire-and-forget)
        issue = await create_error_issue(error, context_info)
        if issue and dev:
            try:
                await dev.send(f"📋 GitHub issue: {issue['html_url']}")
            except Exception as e:
                logger.warning("Failed to send GitHub issue follow-up DM: %s", e)

    async def setup_hook(self):
        # Load extensions
        await self.load_extension("cogs.general")
        await self.load_extension("cogs.roles")
        await self.load_extension("cogs.groups")
        await self.load_extension("cogs.debug")

        # Register app command error handler
        self.tree.on_error = self.on_app_command_error

        logger.info("Syncing commands...")
        try:
            synced = await self.tree.sync()
            logger.info("Synced %d commands.", len(synced))
        except discord.HTTPException as e:
            # Check both e.code and the response text for the "Entry Point" error (50240)
            if e.code == 50240 or "50240" in str(e):
                registered_commands = [cmd.name for cmd in self.tree.get_commands()]
                logger.error(
                    "Failed to sync commands: Primary Entry Point command is missing from the tree (Error 50240). "
                    "If you have 'Primary Entry Point' enabled in the Discord Developer Portal, "
                    "you must include a command with the same name in your bot's tree, or disable "
                    "Primary Entry Point if you are only using /activity manually.\n"
                    f"Registered Global Commands: {registered_commands}"
                )
            else:
                logger.error(
                    "Failed to sync commands: %s (Status: %d, Code: %s)",
                    e,
                    e.status,
                    e.code,
                )
        except Exception as e:
            logger.error("Failed to sync commands: %s", e)

    async def on_ready(self):
        if self.user:
            logger.info("Logged in as %s (ID: %s)", self.user, self.user.id)
        # Clean up abandoned docs (e.g. frontend closed without completing).
        firebase = FirebaseService()
        if firebase.is_available():
            await firebase.delete_old_docs("guilds", FIREBASE_DOC_MAX_AGE_SECONDS)
            await firebase.delete_old_docs("channels", FIREBASE_DOC_MAX_AGE_SECONDS)

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

        logger.error("App Command Error: %s", error)
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
            logger.error("Error in event %s: %s", event_method, error)
        else:
            logger.warning("Error in event %s (no exception info)", event_method)

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

        logger.error("Error in %s: %s", context.command, exception)
        await context.send(
            "❌ An error occurred while processing your command. Please try again later."
        )


bot = MythicPlusBot()


if __name__ == "__main__":
    if not BOT_TOKEN:
        raise ValueError(
            "BOT_TOKEN environment variable is required. Please check your .env file."
        )

    # Setup logging
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)

    # File Handler
    from logging.handlers import RotatingFileHandler

    file_handler = RotatingFileHandler(
        filename=LOG_FILE,
        encoding="utf-8",
        mode="a",
        maxBytes=5 * 1024 * 1024,
        backupCount=1,
    )
    file_handler.setFormatter(
        logging.Formatter("%(asctime)s:%(levelname)s:%(name)s: %(message)s")
    )
    root_logger.addHandler(file_handler)

    # Stream Handler (Console)
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(
        logging.Formatter("%(asctime)s:%(levelname)s:%(name)s: %(message)s")
    )
    root_logger.addHandler(console_handler)

    try:
        bot.run(BOT_TOKEN, log_handler=None)
    except discord.LoginFailure:
        logger.error("❌ Failed to login. Please check your BOT_TOKEN.")
    except Exception as e:
        # Log exception type only; message may contain request/response data.
        logger.fatal("❌ Fatal error starting bot: %s", type(e).__name__)
