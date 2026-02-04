import discord
from discord.ext import commands
import os
import time
import datetime
from config import BOT_INVITE_PERMISSIONS

class General(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.start_time = time.time()

    @commands.command()
    async def invite(self, ctx):
        """Get the bot invite URL with the configured permissions (for adding the bot to a server)."""
        app_id = self.bot.application_id or os.getenv("DISCORD_APPLICATION_ID")
        if not app_id:
            await ctx.send("❌ Application ID not available. Set DISCORD_APPLICATION_ID in your environment.")
            return
        app_id = int(app_id) if isinstance(app_id, str) else app_id
        permissions = discord.Permissions(BOT_INVITE_PERMISSIONS)
        url = discord.utils.oauth_url(app_id, scopes=["bot"], permissions=permissions)
        await ctx.send(f"**Add this bot to a server:**\n{url}")

    @commands.command()
    async def status(self, ctx):
        """Check the bot's status and uptime."""
        uptime_seconds = int(time.time() - self.start_time)
        uptime_str = str(datetime.timedelta(seconds=uptime_seconds))

        embed = discord.Embed(title="Bot Status", color=discord.Color.green())
        embed.add_field(name="Uptime", value=uptime_str, inline=True)
        embed.add_field(name="Ping", value=f"{round(self.bot.latency * 1000)}ms", inline=True)

        try:
            load1, load5, load15 = os.getloadavg()
            embed.add_field(name="System Load", value=f"{load1:.2f}, {load5:.2f}, {load15:.2f}", inline=False)
        except:
            pass

        embed.set_footer(text=f"Server ID: {ctx.guild.id if ctx.guild else 'DM'}")
        await ctx.send(embed=embed)

    @commands.Cog.listener()
    async def on_voice_state_update(self, member, before, after):
        """Automatically disconnects the bot if it's the only one left in the voice channel."""
        voice_client = member.guild.voice_client
        if voice_client and len(voice_client.channel.members) == 1:
            await voice_client.disconnect()

async def setup(bot):
    await bot.add_cog(General(bot))
