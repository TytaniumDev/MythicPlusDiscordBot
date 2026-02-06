import logging
from typing import cast

import discord
from discord import app_commands
from discord.ext import commands

from core import config
from core.issues import BadGroupIssueModal, report_bad_group
from core.models import WoWPlayer
from services.session_service import SessionService

logger = logging.getLogger(__name__)


class Groups(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self.session_service = SessionService(bot)

    @commands.hybrid_command(name="wheel")
    async def wheel(self, ctx: commands.Context[commands.Bot]) -> None:
        """Generates a series of embed messages that shows groups of players split into 5 person teams."""
        await ctx.defer()
        try:
            if hasattr(self.bot, "group_service"):
                await self.bot.group_service.core_wheel(ctx, debug_value=False)
            else:
                await ctx.send("❌ GroupService not initialized.")
        except discord.HTTPException as e:
            await ctx.send(f"❌ Discord API Error: {e.status} - {e.text}")
        except Exception as e:
            await ctx.send("❌ An unexpected error occurred. Please try again later.")
            logger.error("Error in wheel command: %s", e)

    @commands.hybrid_command(name="newwheel")
    async def newwheel(self, ctx: commands.Context[commands.Bot]) -> None:
        """Generates groups with an enhanced rolling reveal animation and sound effects."""
        await ctx.defer()
        try:
            if hasattr(self.bot, "group_service"):
                await self.bot.group_service.core_wheel(
                    ctx, debug_value=False, enhanced=True
                )
            else:
                await ctx.send("❌ GroupService not initialized.")
        except discord.HTTPException as e:
            await ctx.send(f"❌ Discord API Error: {e.status} - {e.text}")
        except Exception as e:
            await ctx.send("❌ An unexpected error occurred. Please try again later.")
            logger.error("Error in newwheel command: %s", e)

    @commands.hybrid_command(name="activity")
    async def activity(self, ctx: commands.Context[commands.Bot]) -> None:
        """Starts an enhanced wheel and creates a Discord Activity invite for the voice channel."""
        await self._execute_activity(ctx, debug=False)

    @commands.hybrid_command(name="wheelson")
    async def wheelson(self, ctx: commands.Context[commands.Bot]) -> None:
        """Starts an enhanced wheel and creates a Discord Activity invite for the voice channel."""
        await self._execute_activity(ctx, debug=False)

    @commands.command(name="activitytest", hidden=True)
    async def activitytest(self, ctx: commands.Context[commands.Bot]) -> None:
        """Hidden prefix command to test the activity with debug data."""
        await self._execute_activity(ctx, debug=True)

    async def _execute_activity(
        self, ctx: commands.Context[commands.Bot], debug: bool
    ) -> None:
        """Internal helper to execute the activity logic with optional debug data."""
        await ctx.defer()
        try:
            if not hasattr(self.bot, "group_service"):
                await ctx.send("❌ GroupService not initialized.")
                return

            # Check if user is in voice
            if not (ctx.author.voice and ctx.author.voice.channel):
                await ctx.send(
                    "❌ You must be in a voice channel to start an activity."
                )
                return

            # Use get_groups_data merely to validate and get initial players.
            # We don't need the groups calculated yet.
            result = await self.bot.group_service.get_groups_data(ctx, debug=debug)
            if not result:
                return  # Error message already sent

            players = cast(list[WoWPlayer], result["players"])

            # Create Session in Firebase
            session_id = await self.session_service.create_session(
                ctx, players, debug=debug
            )

            if not session_id:
                await ctx.send("❌ Failed to create session. Is Firebase configured?")
                return

            # Create Links
            channel = ctx.author.voice.channel
            app_id = config.DISCORD_APPLICATION_ID

            # Create Embedded Invite
            invite_url = "N/A"
            if app_id:
                invite = await channel.create_invite(
                    target_type=discord.InviteTarget.embedded_application,
                    target_application_id=int(app_id),
                    max_age=300,  # 5 minutes
                )
                invite_url = invite.url

            # Create Direct Link
            activity_url_base = config.ACTIVITY_URL

            msg = "🎮 **Join the Activity!**\n"
            msg += f"**Voice Channel Activity:** {invite_url}\n"

            if activity_url_base:
                direct_link = f"{activity_url_base}?sessionId={session_id}"
                msg += f"**Browser Link:** [Click Here]({direct_link})\n"
            else:
                msg += "⚠️ `ACTIVITY_URL` not set in .env."

            await ctx.send(msg)

        except discord.HTTPException as e:
            await ctx.send(f"❌ Discord API Error: {e.status} - {e.text}")
        except Exception as e:
            await ctx.send("❌ An unexpected error occurred. Please try again later.")
            logger.error("Error in activity command: %s", e)

    @commands.Cog.listener()
    async def on_voice_state_update(
        self,
        member: discord.Member,
        before: discord.VoiceState,
        after: discord.VoiceState,
    ) -> None:
        """
        Listen for voice state updates to sync the lobby.
        """
        # We only care if someone joined or left a channel that has an active session
        channel = after.channel or before.channel
        if not channel:
            return

        # Check if we have a session for this channel
        if channel.id in self.session_service.active_sessions:
            members = [m for m in channel.members if not m.bot]
            # Update lobby
            await self.session_service.update_lobby_players(channel.id, members)

    @commands.hybrid_command(
        name="badgroup", description="Report a bad set of groups to the developers."
    )
    @app_commands.describe(
        title="What's the issue? (e.g. Too many melee in Group 1)",
        description="Please explain why these groups are not ideal...",
    )
    async def badgroup(
        self,
        ctx: commands.Context[commands.Bot],
        title: str | None = None,
        *,
        description: str | None = None,
    ):
        """
        Report a bad set of groups to the developers.
        NOTE: Bad group reports MUST ALWAYS include logs for debugging purposes.
        Do not add a toggle to disable log inclusion for this command.
        """
        if not hasattr(self.bot, "group_service"):
            await ctx.send("❌ GroupService not initialized.", ephemeral=True)
            return

        guild_id = ctx.guild.id if ctx.guild else None
        if not guild_id or guild_id not in self.bot.group_service.last_results:
            await ctx.send(
                "❌ No group creation data found for this server. Run /wheel first.",
                ephemeral=True,
            )
            return

        last_results = self.bot.group_service.last_results[guild_id]

        # If called via slash command without arguments, open the modal
        if ctx.interaction and title is None:
            await ctx.interaction.response.send_modal(BadGroupIssueModal(last_results))
            return

        # If arguments are provided (either prefix or slash), process directly
        if not title or not description:
            await ctx.send(
                "❌ Please provide both a title and a description when using the prefix command. "
                'Usage: `!badgroup "Title" Description` or use `/badgroup` to open a modal.',
                ephemeral=True,
            )
            return

        # Process the report
        await ctx.defer(ephemeral=True)
        try:
            issue = await report_bad_group(ctx.author, last_results, title, description)
            await ctx.send(
                f"✅ Bad group reported successfully: {issue['html_url']}",
                ephemeral=True,
            )
        except Exception as e:
            logger.error("Error creating GitHub issue via badgroup command: %s", e)
            await ctx.send(f"❌ Failed to create issue: {e}", ephemeral=True)


async def setup(bot: commands.Bot):
    await bot.add_cog(Groups(bot))
