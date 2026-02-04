import logging
import os

import discord
from discord.ext import commands

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
    async def activity(self, ctx: commands.Context[commands.Bot]) -> None:
        """Starts an enhanced wheel and creates a Discord Activity invite for the voice channel."""
        await ctx.defer()
        try:
            # Run enhanced wheel
            if hasattr(self.bot, "group_service"):
                await self.bot.group_service.core_wheel(
                    ctx, debug_value=False, enhanced=True
                )
            else:
                await ctx.send("❌ GroupService not initialized.")
                return

            # Then create activity invite
            if ctx.author.voice and ctx.author.voice.channel:
                channel = ctx.author.voice.channel
                # You'll need to set your APPLICATION_ID in .env
                app_id = os.getenv("DISCORD_APPLICATION_ID")
                if app_id:
                    invite = await channel.create_invite(
                        target_type=discord.InviteTarget.embedded_application,
                        target_application_id=int(app_id),
                        max_age=300,  # 5 minutes
                    )
                    await ctx.send(f"🎮 Join the spinning wheel activity! {invite.url}")
                else:
                    await ctx.send(
                        "⚠️ DISCORD_APPLICATION_ID not configured in .env. Cannot start activity."
                    )
            else:
                await ctx.send(
                    "❌ You must be in a voice channel to start an activity."
                )

        except discord.HTTPException as e:
            await ctx.send(f"❌ Discord API Error: {e.status} - {e.text}")
        except Exception as e:
            await ctx.send("❌ An unexpected error occurred. Please try again later.")
            logger.error("Error in activity command: %s", e)


async def setup(bot: commands.Bot):
    await bot.add_cog(Groups(bot))
