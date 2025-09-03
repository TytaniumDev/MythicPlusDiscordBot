import discord
import os
import asyncio
from discord.ext import commands
from dotenv import load_dotenv
from models import WoWPlayer
from group_creator import create_mythic_plus_groups
from oldbot import oldCoreWheel

load_dotenv()
BOT_TOKEN = os.getenv("BOT_TOKEN")
PLACEHOLDER_CHAR = ':question:'

intents = discord.Intents.default()
intents.message_content = True
intents.members = True

client = discord.Client(intents=intents)
bot = commands.Bot(command_prefix=["!", "/"], intents=intents)

# Returns the member's nickname if it exists, or their normal Discord name if
# they don't have a nickname set.
# This corresponds to the member's WoW in game name, usually. 
def WoWName(member, debug: bool = None):
    if debug: print(f"WoWName - Member: {member}\nNick: {member.nick}\nGlobal: {member.global_name}")
    rawName =  member.nick if member.nick != None else member.global_name if member.global_name != None else str(member)
    return rawName.replace('.', '')

async def showLongTyping(channel):
     async with channel.typing():
            await asyncio.sleep(2)

async def showShortTyping(channel):
     async with channel.typing():
            await asyncio.sleep(1)

def dashed(name):
     return '?' * len(name)

# !test
# Runs the !wheel function, but hardcoded to use testing data in my personal
# discord server.
@bot.command()
async def test(ctx):
    await coreWheel(ctx, debug = True)

# !wheel
# Generates a series of embed messages that shows groups of players split
# into 5 person teams based on their assigned roles in discord.
# 
# The available roles are:
# Tank, Healer, DPS, Tank Offspec, Healer Offspec, DPS Offspec
@bot.command()
async def wheel(ctx):
    await coreWheel(ctx = ctx)

# !oldwheel
# Generates a series of embed messages that shows groups of players split
# into 5 person teams based on their assigned roles in discord.
# 
# The available roles are:
# Tank, Healer, DPS, Tank Offspec, Healer Offspec, DPS Offspec
@bot.command()
async def oldwheel(ctx):
    await oldCoreWheel(ctx = ctx)

# Gathers the player info from the discord and returns a list of WoWPlayer objects.
def getPlayerList(members) -> list[WoWPlayer]:
    players = []
    for member in members:
        if(len(member.roles) > 1):
            print(f'Creating WoWPlayer for {member.name}, roles are {[role.name for role in member.roles]}')
            player = WoWPlayer.create(name=WoWName(member), roles=[role.name for role in member.roles])
            players.append(player)
    return players


async def coreWheel(ctx, debug: bool = None):
    debug = False if debug is None else debug
    channel = ctx.channel

    # Get the members of the channel we want to use to fill the roles
    if debug:
        # Testing Code
        testChannel = discord.utils.get(ctx.guild.channels, name='path-of-exile')
        members = [member for member in testChannel.members if member.bot == False]
    else:
        members = [member for member in channel.members if member.bot == False]

    players = getPlayerList(members)
    groups = create_mythic_plus_groups(players)
    
    for i, group in enumerate(groups, 1):
        # Print out the group in an embed to keep it tidy
        embed = discord.Embed()
        embed.title = f"Group {i}"
        
        # Get player names or placeholders
        tank_name = group.tank.name if group.tank else PLACEHOLDER_CHAR
        healer_name = group.healer.name if group.healer else PLACEHOLDER_CHAR
        dps1_name = group.dps1.name if group.dps1 else PLACEHOLDER_CHAR
        dps2_name = group.dps2.name if group.dps2 else PLACEHOLDER_CHAR
        dps3_name = group.dps3.name if group.dps3 else PLACEHOLDER_CHAR

        # Find players with utilities
        brez_player = next((p.name for p in [group.tank, group.healer, group.dps1, group.dps2, group.dps3] if p and p.hasBrez), "None")
        lust_player = next((p.name for p in [group.tank, group.healer, group.dps1, group.dps2, group.dps3] if p and p.hasLust), "None")

        embed.add_field(name='Tank', value=f'{dashed(tank_name)}')\
             .add_field(name='Healer', value=f'{dashed(healer_name)}')\
             .add_field(name='DPS', value=f'{dashed(dps1_name)}, {dashed(dps2_name)}, {dashed(dps3_name)}')\
             .add_field(name='Battle Res', value=f'{dashed(brez_player)}', inline=True)\
             .add_field(name='Bloodlust', value=f'{dashed(lust_player)}', inline=True)
        
        embedMessage = await ctx.send(embed = embed)
        await showShortTyping(channel)
        embedMessage = await embedMessage.edit(embed = embed.set_field_at(index=0, name='Tank', value=f'{tank_name}'))
        await showShortTyping(channel)
        embedMessage = await embedMessage.edit(embed = embed.set_field_at(index=1, name='Healer', value=f'{healer_name}'))
        await showShortTyping(channel)
        embedMessage = await embedMessage.edit(embed = embed.set_field_at(index=2, name='DPS', value=f'{dps1_name}, {dashed(dps2_name)}, {dashed(dps3_name)}'))
        await showShortTyping(channel)
        embedMessage = await embedMessage.edit(embed = embed.set_field_at(index=2, name='DPS', value=f'{dps1_name}, {dps2_name}, {dashed(dps3_name)}'))
        await showShortTyping(channel)
        embedMessage = await embedMessage.edit(embed = embed.set_field_at(index=2, name='DPS', value=f'{dps1_name}, {dps2_name}, {dps3_name}'))
        embedMessage = await embedMessage.edit(embed = embed.set_field_at(index=3, name='Battle Res', value=f'{brez_player}'))
        embedMessage = await embedMessage.edit(embed = embed.set_field_at(index=4, name='Bloodlust', value=f'{lust_player}'))


bot.run(BOT_TOKEN)
