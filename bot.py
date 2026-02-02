import discord
import os
import asyncio
from discord.ext import commands
from dotenv import load_dotenv
from models import WoWPlayer
from parallel_group_creator import create_mythic_plus_groups
from oldbot import oldCoreWheel

load_dotenv()

# Path to assets
ASSETS_DIR = "assets"
SPIN_SOUND = os.path.join(ASSETS_DIR, "spin.ogg")
REVEAL_SOUND = os.path.join(ASSETS_DIR, "reveal.ogg")
WHEEL_GIF = os.path.join(ASSETS_DIR, "wheel.gif")
BOT_TOKEN = os.getenv("BOT_TOKEN")
if not BOT_TOKEN:
    raise ValueError("BOT_TOKEN environment variable is required. Please check your .env file.")
PLACEHOLDER_CHAR = ':question:'

intents = discord.Intents.default()
intents.message_content = True
intents.members = True

bot = commands.Bot(command_prefix=["!", "/"], intents=intents)

debug = False

# Store last results per-server (guild) to avoid race conditions
# Format: {guild_id: {"players": list, "groups": list}}
last_results = {}

# Locks per server to prevent concurrent group creation
# Format: {guild_id: asyncio.Lock}
server_locks = {}

# Returns the member's nickname if it exists, or their normal Discord name if
# they don't have a nickname set.
# This corresponds to the member's WoW in game name, usually.
def WoWName(member, debug: bool = None):
    if debug: print(f"WoWName - Member: {member}\nNick: {member.nick}\nGlobal: {member.global_name}")
    rawName =  member.nick if member.nick != None else member.global_name if member.global_name != None else str(member)
    return rawName.replace('.', '')

async def showLongTyping(channel, debug_mode: bool = False):
    # Skip sleeps in debug mode for faster testing
    if not debug_mode:
        async with channel.typing():
            await asyncio.sleep(2)

async def showShortTyping(channel, debug_mode: bool = False):
    # Skip sleeps in debug mode for faster testing
    if not debug_mode:
        async with channel.typing():
            await asyncio.sleep(1)

def dashed(name):
     return '?' * len(name)

async def join_voice_channel(ctx):
    """Joins the voice channel of the command author."""
    if ctx.author.voice:
        channel = ctx.author.voice.channel
        if ctx.voice_client:
            if ctx.voice_client.channel != channel:
                await ctx.voice_client.move_to(channel)
        else:
            await channel.connect()
        return ctx.voice_client
    return None

async def play_sound(voice_client, sound_path):
    """Plays a sound file in the given voice client."""
    if voice_client and os.path.exists(sound_path):
        try:
            if voice_client.is_playing():
                voice_client.stop()
            voice_client.play(discord.FFmpegPCMAudio(sound_path))
            # We don't necessarily want to wait for the whole sound if it's a loop
        except Exception as e:
            print(f"Error playing sound {sound_path}: {e}")

# !test
# Runs the !wheel function, but hardcoded to use testing data in my personal
# discord server.
@bot.command()
async def test(ctx):
    try:
        await coreWheel(ctx, debugValue=True)
    except discord.HTTPException as e:
        await ctx.send(f"❌ Discord API Error: {e.status} - {e.text}")
    except Exception as e:
        await ctx.send("❌ An unexpected error occurred. Please try again later.")
        print(f"Error in test command: {e}")

# !wheel
# Generates a series of embed messages that shows groups of players split
# into 5 person teams based on their assigned roles in discord.
#
# The available roles are:
# Tank, Healer, DPS, Tank Offspec, Healer Offspec, DPS Offspec
@bot.command()
async def wheel(ctx):
    try:
        await coreWheel(ctx=ctx, debugValue=False)
    except discord.HTTPException as e:
        await ctx.send(f"❌ Discord API Error: {e.status} - {e.text}")
    except Exception as e:
        await ctx.send("❌ An unexpected error occurred. Please try again later.")
        print(f"Error in wheel command: {e}")

# !oldwheel
# Generates a series of embed messages that shows groups of players split
# into 5 person teams based on their assigned roles in discord.
#
# The available roles are:
# Tank, Healer, DPS, Tank Offspec, Healer Offspec, DPS Offspec
@bot.command()
async def oldwheel(ctx):
    try:
        await oldCoreWheel(ctx = ctx)
    except discord.HTTPException as e:
        await ctx.send(f"❌ Discord API Error: {e.status} - {e.text}")
    except Exception as e:
        await ctx.send("❌ An unexpected error occurred. Please try again later.")
        print(f"Error in oldwheel command: {e}")


@bot.command()
async def testcase(ctx):
    try:
        await printPlayerList(ctx=ctx)
    except discord.HTTPException as e:
        await ctx.send(f"❌ Discord API Error: {e.status} - {e.text}")
    except Exception as e:
        await ctx.send("❌ An unexpected error occurred. Please try again later.")
        print(f"Error in testcase command: {e}")


# Gathers the player info from the discord and returns a list of WoWPlayer objects.
def getPlayerList(members) -> list[WoWPlayer]:
    players = []
    for member in members:
        if(len(member.roles) > 1):
            print(f'Creating WoWPlayer for {WoWName(member)}, roles are {[role.name for role in member.roles]}')
            player = WoWPlayer.create(name=WoWName(member), roles=[role.name for role in member.roles])
            if(player.hasRoles()):
                players.append(player)
            else:
                print(f' - No valid roles found for {player}, skipping.')
    return players


async def printPlayerList(ctx):
    channel = ctx.channel
    guild_id = ctx.guild.id if ctx.guild else None
    
    if not guild_id:
        await ctx.send("❌ This command can only be used in a server.")
        return
    
    # Get last results for this server
    if guild_id not in last_results:
        await ctx.send("❌ No previous results found for this server. Run `!wheel` first.")
        return
    
    result = last_results[guild_id]
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


async def _execute_coreWheel(ctx, channel, guild_id, debug, enhanced=False):
    """Internal function that performs the actual group creation (called within lock)."""
    voice_client = None
    if enhanced:
        voice_client = await join_voice_channel(ctx)

    # Get the members of the channel we want to use to fill the roles
    if debug:
        # Testing Code
        testChannel = discord.utils.get(ctx.guild.channels, name='path-of-exile')
        members = [member for member in testChannel.members if member.bot == False]
    else:
        members = [member for member in channel.members if member.bot == False]

    players = getPlayerList(members)
    groups = create_mythic_plus_groups(players, debug=debug)
    
    # Store results per-server to avoid race conditions
    last_results[guild_id] = {
        "players": list(players),  # Store a copy to avoid reference issues
        "groups": list(groups)     # Store a copy to avoid reference issues
    }

    for i, group in enumerate(groups, 1):
        # Print out the group in an embed to keep it tidy
        embed = discord.Embed()
        embed.title = f"Group {i}"

        # Get player names or placeholders
        tank_name = group.tank.name if group.tank else PLACEHOLDER_CHAR
        healer_name = group.healer.name if group.healer else PLACEHOLDER_CHAR
        dps1_name = group.dps[0].name if len(group.dps) > 0 else PLACEHOLDER_CHAR
        dps2_name = group.dps[1].name if len(group.dps) > 1 else PLACEHOLDER_CHAR
        dps3_name = group.dps[2].name if len(group.dps) > 2 else PLACEHOLDER_CHAR

        # Find players with utilities
        brez_player = next(
            (p.name for p in [group.tank, group.healer] + group.dps if p and p.hasBrez),
            "None",
        )
        lust_player = next(
            (p.name for p in [group.tank, group.healer] + group.dps if p and p.hasLust),
            "None",
        )

        if debug:
            embed.add_field(name='Tank', value=f'{tank_name}')\
                .add_field(name='Healer', value=f'{healer_name}')\
                .add_field(name='DPS', value=f'{dps1_name}, {dps2_name}, {dps3_name}')\
                .add_field(name='Battle Res', value=f'{brez_player}', inline=True)\
            .add_field(name='Bloodlust', value=f'{lust_player}', inline=True)
            embedMessage = await ctx.send(embed = embed)
        else:
            if enhanced:
                if os.path.exists(WHEEL_GIF):
                    await ctx.send(file=discord.File(WHEEL_GIF))
                await play_sound(voice_client, SPIN_SOUND)
                await asyncio.sleep(2)

            embed.add_field(name='Tank', value=f'{dashed(tank_name)}')\
                .add_field(name='Healer', value=f'{dashed(healer_name)}')\
                .add_field(name='DPS', value=f'{dashed(dps1_name)}, {dashed(dps2_name)}, {dashed(dps3_name)}')\
                .add_field(name='Battle Res', value=f'{dashed(brez_player)}', inline=True)\
                .add_field(name='Bloodlust', value=f'{dashed(lust_player)}', inline=True)

            embedMessage = await ctx.send(embed = embed)
            await showShortTyping(channel, debug_mode=debug)
            if enhanced: await play_sound(voice_client, REVEAL_SOUND)
            embedMessage = await embedMessage.edit(embed = embed.set_field_at(index=0, name='Tank', value=f'{tank_name}'))
            await showShortTyping(channel, debug_mode=debug)
            if enhanced: await play_sound(voice_client, REVEAL_SOUND)
            embedMessage = await embedMessage.edit(embed = embed.set_field_at(index=1, name='Healer', value=f'{healer_name}'))
            await showShortTyping(channel, debug_mode=debug)
            if enhanced: await play_sound(voice_client, REVEAL_SOUND)
            embedMessage = await embedMessage.edit(embed = embed.set_field_at(index=2, name='DPS', value=f'{dps1_name}, {dashed(dps2_name)}, {dashed(dps3_name)}'))
            await showShortTyping(channel, debug_mode=debug)
            if enhanced: await play_sound(voice_client, REVEAL_SOUND)
            embedMessage = await embedMessage.edit(embed = embed.set_field_at(index=2, name='DPS', value=f'{dps1_name}, {dps2_name}, {dashed(dps3_name)}'))
            await showShortTyping(channel, debug_mode=debug)
            if enhanced: await play_sound(voice_client, REVEAL_SOUND)
            embedMessage = await embedMessage.edit(embed = embed.set_field_at(index=2, name='DPS', value=f'{dps1_name}, {dps2_name}, {dps3_name}'))
            embedMessage = await embedMessage.edit(embed = embed.set_field_at(index=3, name='Battle Res', value=f'{brez_player}'))
            embedMessage = await embedMessage.edit(embed = embed.set_field_at(index=4, name='Bloodlust', value=f'{lust_player}'))


async def coreWheel(ctx, debugValue: bool = None, enhanced: bool = False):
    global debug
    debug = False if debugValue is None else debugValue
    channel = ctx.channel
    guild_id = ctx.guild.id if ctx.guild else None
    
    if not guild_id:
        await ctx.send("❌ This command can only be used in a server.")
        return
    
    # Get or create a lock for this server to prevent concurrent executions
    if guild_id not in server_locks:
        server_locks[guild_id] = asyncio.Lock()
    
    server_lock = server_locks[guild_id]
    
    # Check if lock is already acquired (another command is running)
    # Note: There's a small race condition window here, but it's acceptable for this use case
    if server_lock.locked():
        await ctx.send("⏳ Another group creation is already in progress for this server. Please wait for it to complete.")
        return
    
    # Acquire the lock and execute (only one command per server at a time)
    async with server_lock:
        await _execute_coreWheel(ctx, channel, guild_id, debug, enhanced)


@bot.command()
async def newwheel(ctx):
    try:
        await coreWheel(ctx=ctx, debugValue=False, enhanced=True)
    except discord.HTTPException as e:
        await ctx.send(f"❌ Discord API Error: {e.status} - {e.text}")
    except Exception as e:
        await ctx.send("❌ An unexpected error occurred. Please try again later.")
        print(f"Error in newwheel command: {e}")

@bot.command()
async def activity(ctx):
    try:
        # Run enhanced wheel
        await coreWheel(ctx=ctx, debugValue=False, enhanced=True)

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


@bot.event
async def on_voice_state_update(member, before, after):
    """Automatically disconnects the bot if it's the only one left in the voice channel."""
    voice_client = member.guild.voice_client
    if voice_client and len(voice_client.channel.members) == 1:
        await voice_client.disconnect()


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

# Run the bot
try:
    bot.run(BOT_TOKEN)
except discord.LoginFailure:
    print("❌ Failed to login. Please check your BOT_TOKEN.")
except Exception as e:
    print(f"❌ Fatal error starting bot: {e}")
