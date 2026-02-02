import discord
import os
import asyncio
import random
import time
import datetime
from discord.ext import commands
from dotenv import load_dotenv
from models import WoWPlayer
from parallel_group_creator import create_mythic_plus_groups
from storage import get_player_preference, get_all_preferences, clear_player_preference
from role_ui import RoleView
from config import ALL_ROLES

load_dotenv()
BOT_TOKEN = os.getenv("BOT_TOKEN")
if not BOT_TOKEN:
    raise ValueError("BOT_TOKEN environment variable is required. Please check your .env file.")
PLACEHOLDER_CHAR = ':question:'

intents = discord.Intents.default()
intents.message_content = True
intents.members = True

bot = commands.Bot(command_prefix=["!", "/"], intents=intents)
start_time = time.time()

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
@bot.command()
async def wheel(ctx):
    """Generates groups with the existing animation style."""
    try:
        await coreWheel(ctx=ctx, debugValue=False, use_new_animation=False)
    except discord.HTTPException as e:
        await ctx.send(f"❌ Discord API Error: {e.status} - {e.text}")
    except Exception as e:
        await ctx.send("❌ An unexpected error occurred. Please try again later.")
        print(f"Error in wheel command: {e}")

# !newwheel
@bot.command()
async def newwheel(ctx):
    """Generates groups with the NEW rolling reveal animation."""
    try:
        await coreWheel(ctx=ctx, debugValue=False, use_new_animation=True)
    except discord.HTTPException as e:
        await ctx.send(f"❌ Discord API Error: {e.status} - {e.text}")
    except Exception as e:
        await ctx.send("❌ An unexpected error occurred. Please try again later.")
        print(f"Error in newwheel command: {e}")

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
        name = WoWName(member)
        # Check for persistent preferences first
        saved_roles = get_player_preference(name)

        if saved_roles:
            print(f'Creating WoWPlayer for {name} from SAVED roles: {saved_roles}')
            player = WoWPlayer.create(name=name, roles=saved_roles)
            players.append(player)
        elif len(member.roles) > 1:
            print(f'Creating WoWPlayer for {name} from DISCORD roles: {[role.name for role in member.roles]}')
            player = WoWPlayer.create(name=name, roles=[role.name for role in member.roles])
            if(player.hasRoles()):
                players.append(player)
            else:
                print(f' - No valid roles found for {player}, skipping.')
    return players

@bot.command()
async def roles(ctx):
    """Set your persistent WoW roles."""
    name = WoWName(ctx.author)
    saved_roles = get_player_preference(name)
    view = RoleView(name, saved_roles)
    await ctx.send(f"Select your roles for **{name}**:", view=view, ephemeral=True)

@bot.command()
async def rolecheck(ctx):
    """List saved roles for everyone in the current voice channel (or recent players)."""
    channel = ctx.author.voice.channel if ctx.author.voice else ctx.channel
    members = [m for m in channel.members if not m.bot]

    if not members:
        await ctx.send("No members found in the channel.")
        return

    embed = discord.Embed(title="Saved Roles Check", color=discord.Color.blue())

    found_any = False
    for member in members:
        name = WoWName(member)
        saved_roles = get_player_preference(name)
        if saved_roles:
            embed.add_field(name=name, value=", ".join(saved_roles), inline=False)
            found_any = True
        else:
            # Check if they have discord roles at least
            discord_roles = [r.name for r in member.roles if r.name in ALL_ROLES]
            if discord_roles:
                 embed.add_field(name=f"{name} (Discord Only)", value=", ".join(discord_roles), inline=False)
                 found_any = True

    if not found_any:
        await ctx.send("No saved roles found for anyone in this channel.")
    else:
        await ctx.send(embed=embed)

@bot.command()
async def status(ctx):
    """Check the bot's status and uptime."""
    uptime_seconds = int(time.time() - start_time)
    uptime_str = str(datetime.timedelta(seconds=uptime_seconds))

    embed = discord.Embed(title="Bot Status", color=discord.Color.green())
    embed.add_field(name="Uptime", value=uptime_str, inline=True)
    embed.add_field(name="Ping", value=f"{round(bot.latency * 1000)}ms", inline=True)

    try:
        load1, load5, load15 = os.getloadavg()
        embed.add_field(name="System Load", value=f"{load1:.2f}, {load5:.2f}, {load15:.2f}", inline=False)
    except:
        pass

    embed.set_footer(text=f"Server ID: {ctx.guild.id if ctx.guild else 'DM'}")
    await ctx.send(embed=embed)

@bot.command()
async def clearrole(ctx, name: str = None):
    """Clear your saved roles, or a specific character's roles."""
    if name is None:
        name = WoWName(ctx.author)
        success = clear_player_preference(name)
        if success:
            await ctx.send(f"✅ Cleared your saved roles, **{name}**.")
        else:
            await ctx.send(f"❌ You had no saved roles, **{name}**.")
    else:
        # Check if user has permission to clear others? Assuming guild context for now.
        success = clear_player_preference(name)
        if success:
            await ctx.send(f"✅ Cleared saved roles for **{name}**.")
        else:
            await ctx.send(f"❌ No saved roles found for **{name}**.")


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


async def roll_reveal(ctx, message, embed, field_index, field_name, final_value, members, debug_mode=False, prefix="", suffix=""):
    """Effect that 'rolls' through names for suspense."""
    if debug_mode:
        embed.set_field_at(index=field_index, name=field_name, value=final_value)
        return await message.edit(embed=embed)

    rolls = 2
    for _ in range(rolls):
        fake_name = WoWName(random.choice(members)) if members else "???"
        embed.set_field_at(index=field_index, name=field_name, value=f"{prefix}*{dashed(fake_name)}*{suffix}")
        await message.edit(embed=embed)
        await asyncio.sleep(0.6)

    embed.set_field_at(index=field_index, name=field_name, value=final_value)
    return await message.edit(embed=embed)

async def _execute_coreWheel(ctx, channel, guild_id, debug, use_new_animation=False):
    """Internal function that performs the actual group creation (called within lock)."""
    # Get the members of the channel we want to use to fill the roles
    if debug:
        # Testing Code
        testChannel = discord.utils.get(ctx.guild.channels, name='path-of-exile')
        members = [member for member in testChannel.members if member.bot == False]
    else:
        # Use voice channel members if possible, otherwise text channel members
        voice_channel = ctx.author.voice.channel if ctx.author.voice else None
        if voice_channel:
            members = [member for member in voice_channel.members if member.bot == False]
        else:
            members = [member for member in channel.members if member.bot == False]

    if not members:
        await ctx.send("❌ No players found in the channel.")
        return

    players = getPlayerList(members)
    if not players:
        await ctx.send("❌ No players with valid roles found.")
        return

    groups = create_mythic_plus_groups(players, debug=debug)
    
    # Store results per-server to avoid race conditions
    last_results[guild_id] = {
        "players": list(players),
        "groups": list(groups)
    }

    for i, group in enumerate(groups, 1):
        # Print out the group in an embed to keep it tidy
        embed = discord.Embed(color=discord.Color.gold())
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
            await ctx.send(embed=embed)
        else:
            embed.add_field(name='Tank', value=f'{dashed("Taaaank")}')\
                .add_field(name='Healer', value=f'{dashed("Heeealer")}')\
                .add_field(name='DPS', value=f'{dashed("DPS 1")}, {dashed("DPS 2")}, {dashed("DPS 3")}')\
                .add_field(name='Battle Res', value=f'{dashed("Breeez")}', inline=True)\
                .add_field(name='Bloodlust', value=f'{dashed("Luust")}', inline=True)

            embedMessage = await ctx.send(embed=embed)

            if use_new_animation:
                # Reveal Tank
                embedMessage = await roll_reveal(ctx, embedMessage, embed, 0, 'Tank', tank_name, members, debug)
                await asyncio.sleep(0.5)

                # Reveal Healer
                embedMessage = await roll_reveal(ctx, embedMessage, embed, 1, 'Healer', healer_name, members, debug)
                await asyncio.sleep(0.5)
            else:
                # Old style reveal
                await showShortTyping(channel, debug_mode=debug)
                embed.set_field_at(index=0, name='Tank', value=f'{tank_name}')
                embedMessage = await embedMessage.edit(embed=embed)

                await showShortTyping(channel, debug_mode=debug)
                embed.set_field_at(index=1, name='Healer', value=f'{healer_name}')
                embedMessage = await embedMessage.edit(embed=embed)

            # Reveal DPS one by one
            if use_new_animation:
                # DPS 1
                embedMessage = await roll_reveal(ctx, embedMessage, embed, 2, 'DPS', f'{dps1_name}, {dashed("DPS 2")}, {dashed("DPS 3")}', members, debug, suffix=f', {dashed("DPS 2")}, {dashed("DPS 3")}')
                await asyncio.sleep(0.5)

                # DPS 2
                embedMessage = await roll_reveal(ctx, embedMessage, embed, 2, 'DPS', f'{dps1_name}, {dps2_name}, {dashed("DPS 3")}', members, debug, prefix=f'{dps1_name}, ', suffix=f', {dashed("DPS 3")}')
                await asyncio.sleep(0.5)

                # DPS 3
                embedMessage = await roll_reveal(ctx, embedMessage, embed, 2, 'DPS', f'{dps1_name}, {dps2_name}, {dps3_name}', members, debug, prefix=f'{dps1_name}, {dps2_name}, ')
            else:
                # Reveal DPS one by one (Old style)
                # DPS 1
                embed.set_field_at(index=2, name='DPS', value=f'{dps1_name}, {dashed("DPS 2")}, {dashed("DPS 3")}')
                embedMessage = await embedMessage.edit(embed=embed)
                await asyncio.sleep(0.8)

                # DPS 2
                embed.set_field_at(index=2, name='DPS', value=f'{dps1_name}, {dps2_name}, {dashed("DPS 3")}')
                embedMessage = await embedMessage.edit(embed=embed)
                await asyncio.sleep(0.8)

                # DPS 3
                embed.set_field_at(index=2, name='DPS', value=f'{dps1_name}, {dps2_name}, {dps3_name}')
                embedMessage = await embedMessage.edit(embed=embed)

            # Reveal Utilities
            embed.set_field_at(index=3, name='Battle Res', value=brez_player)
            embed.set_field_at(index=4, name='Bloodlust', value=lust_player)
            await embedMessage.edit(embed=embed)


async def coreWheel(ctx, debugValue: bool = None, use_new_animation: bool = False):
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
        await _execute_coreWheel(ctx, channel, guild_id, debug, use_new_animation)


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
