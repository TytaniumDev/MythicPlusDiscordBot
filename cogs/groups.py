import discord
from discord.ext import commands
import os

class Groups(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @property
    def service(self):
        return self.bot.group_service

    @commands.command()
    async def wheel(self, ctx):
        try:
            await self.service.coreWheel(ctx=ctx, debugValue=False)
        except discord.HTTPException as e:
            await ctx.send(f"❌ Discord API Error: {e.status} - {e.text}")
        except Exception as e:
            await ctx.send("❌ An unexpected error occurred. Please try again later.")
            print(f"Error in wheel command: {e}")

    @commands.command()
    async def newwheel(self, ctx):
        try:
            await self.service.coreWheel(ctx=ctx, debugValue=False, enhanced=True)
        except discord.HTTPException as e:
            await ctx.send(f"❌ Discord API Error: {e.status} - {e.text}")
        except Exception as e:
            await ctx.send("❌ An unexpected error occurred. Please try again later.")
            print(f"Error in newwheel command: {e}")

    @commands.command()
    async def activity(self, ctx):
        try:
            # Run enhanced wheel
            await self.service.coreWheel(ctx=ctx, debugValue=False, enhanced=True)

            # Then create activity invite
            if ctx.author.voice:
                channel = ctx.author.voice.channel
                # You'll need to set your APPLICATION_ID in .env
                app_id = os.getenv("DISCORD_APPLICATION_ID")
                if app_id:
                    invite = await channel.create_invite(
                        target_type=discord.InviteTarget.embedded_application,
                        target_application_id=int(app_id),
                        max_age=300 # 5 minutes
                    )
                    await ctx.send(f"🎮 Join the spinning wheel activity! {invite.url}")
                else:
                    await ctx.send("⚠️ DISCORD_APPLICATION_ID not configured in .env. Cannot start activity.")
            else:
                await ctx.send("❌ You must be in a voice channel to start an activity.")

        except discord.HTTPException as e:
            await ctx.send(f"❌ Discord API Error: {e.status} - {e.text}")
        except Exception as e:
            await ctx.send("❌ An unexpected error occurred. Please try again later.")
            print(f"Error in activity command: {e}")

async def setup(bot):
    await bot.add_cog(Groups(bot))
