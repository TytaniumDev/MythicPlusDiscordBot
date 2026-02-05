import base64
import json
import logging
import os
import urllib.parse
from typing import cast

import discord
from discord import app_commands
from discord.ext import commands

from core.issues import BadGroupIssueModal, report_bad_group
from core.models import WoWGroup, WoWPlayer

logger = logging.getLogger(__name__)


class Groups(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

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
    async def activity(
        self, ctx: commands.Context[commands.Bot], debug: bool = False
    ) -> None:
        """Starts an enhanced wheel and creates a Discord Activity invite for the voice channel."""
        await ctx.defer()
        try:
            if not hasattr(self.bot, "group_service"):
                await ctx.send("❌ GroupService not initialized.")
                return

            # Get group data (this handles checking for players/channels)
            result = await self.bot.group_service.get_groups_data(ctx, debug=debug)
            if not result:
                return  # Error message already sent

            # Save results for !badgroup
            if ctx.guild:
                self.bot.group_service.last_results[ctx.guild.id] = result

            players = cast(list[WoWPlayer], result["players"])
            groups = cast(list[WoWGroup], result["groups"])

            # 1. Post Spoilers
            spoiler_msg = "**🙈 Spoilers (Results):**\n"
            for i, group in enumerate(groups, 1):
                tank = group.tank.name if group.tank else "None"
                healer = group.healer.name if group.healer else "None"
                dps = ", ".join([p.name for p in group.dps])
                spoiler_msg += (
                    f"||**Group {i}**: Tank: {tank} | Healer: {healer} | DPS: {dps}||\n"
                )
            await ctx.send(spoiler_msg)

            # 2. Prepare Data for Activity
            candidates_data = {
                "tanks": [p.name for p in players if p.tankMain or p.offtank],
                "healers": [p.name for p in players if p.healerMain or p.offhealer],
                "dps": [p.name for p in players if p.dpsMain or p.offdps],
            }

            groups_data = []
            for group in groups:
                groups_data.append(
                    {
                        "tank": group.tank.name if group.tank else None,
                        "healer": group.healer.name if group.healer else None,
                        "dps": [p.name for p in group.dps],
                    }
                )

            json_data = json.dumps({"candidates": candidates_data, "groups": groups_data})
            encoded_data_b64 = base64.b64encode(json_data.encode("utf-8")).decode("utf-8")
            encoded_data = urllib.parse.quote(encoded_data_b64)

            # 3. Create Links
            if ctx.author.voice and ctx.author.voice.channel:
                channel = ctx.author.voice.channel
                app_id = os.getenv("DISCORD_APPLICATION_ID")

                # Create Embedded Invite
                invite_url = "N/A"
                if app_id:
                    invite = await channel.create_invite(
                        target_type=discord.InviteTarget.embedded_application,
                        target_application_id=int(app_id),
                        max_age=300,  # 5 minutes
                    )
                    invite_url = invite.url

                # Create Direct Link (fallback/primary for data)
                activity_url_base = os.getenv("ACTIVITY_URL")

                msg = "🎮 **Join the Activity!**\n"
                msg += f"**Voice Channel Activity:** {invite_url}\n"

                if activity_url_base:
                     # Ensure trailing slash logic if needed, but assuming user provides base
                     direct_link = f"{activity_url_base}?data={encoded_data}"
                     msg += f"**Browser Link (Pre-filled):** [Click Here]({direct_link})\n"
                else:
                     msg += "⚠️ `ACTIVITY_URL` not set in .env. Cannot generate pre-filled browser link."

                await ctx.send(msg)

            else:
                await ctx.send(
                    "❌ You must be in a voice channel to start an activity."
                )

        except discord.HTTPException as e:
            await ctx.send(f"❌ Discord API Error: {e.status} - {e.text}")
        except Exception as e:
            await ctx.send("❌ An unexpected error occurred. Please try again later.")
            logger.error("Error in activity command: %s", e)

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
        """Report a bad set of groups to the developers."""
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
