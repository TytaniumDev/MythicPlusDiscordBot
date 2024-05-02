import discord
import os
import random
import asyncio
from discord.ext import commands
from dotenv import load_dotenv

load_dotenv()
BOT_TOKEN = os.getenv("BOT_TOKEN")
DEBUG = True
PLACEHOLDER_CHAR = ':question:'

intents = discord.Intents.all()
intents.message_content = True

client = discord.Client(intents=intents)
bot = commands.Bot(command_prefix="!", intents=intents)


# Returns the member's nickname if it exists, or their normal Discord name if
# they don't have a nickname set.
# This corresponds to the member's WoW in game name, usually. 
def WoWName(member):
    return member.nick if member.nick != None else member.global_name

async def showLongTyping(channel):
     async with channel.typing():
            await asyncio.sleep(2)

async def showShortTyping(channel):
     async with channel.typing():
            await asyncio.sleep(1)

def dashed(name):
     return '?' * len(name)

@bot.command()
async def wheel(ctx):
    # Set up a list for each role
    tanks = []
    healers = []
    dps = []

    # Save a reference to the channel the command was typed in
    channel = ctx.channel

    # Grab all members in the channel the message was sent in
    if DEBUG:
        # Testing Code
        testChannel = discord.utils.get(ctx.guild.channels, name='path-of-exile')
        members = [member for member in testChannel.members if member.bot == False]
    else:
        members = [member for member in ctx.channel.members if member.bot == False]

    # Add each member to one of the role buckets, in Tank > Healer > DPS priority
    for member in members:
        roles = [role.name for role in member.roles]
        if 'Tank' in roles:
            tanks.append(WoWName(member))
        elif 'Healer' in roles:
            healers.append(WoWName(member))
        elif 'DPS' in roles:
            dps.append(WoWName(member))
        elif 'Ranged' in roles:
            dps.append(WoWName(member))
        elif 'Melee' in roles:
            dps.append(WoWName(member))
    

    # Debugging help
    if(DEBUG):
        print(f'In {ctx.channel} the members are {members}')
        print(f'Member roles are {[member.roles for member in members]}')

    # Sort everyone into groups of 5, with 1 tank, 1 healer, and 3 dps.
    # We want these groups to be roughly random, so we'll:
    # 1) Shuffle all of the role lists
    # 2) Pop 1 tank, 1 healer, and 3 dps from the respective lists
    # 3) Print out that group to the channel
    # 4) Start again at step 2 until all lists are empty.

    # Step 1
    random.shuffle(tanks)
    random.shuffle(healers)
    random.shuffle(dps)

    groupNumber = 1
    while tanks or healers or dps:
        # Show typing indicator for *SUSPENSE*
        await showLongTyping(channel)

        # Step 2: Assemble the group
        tank = tanks.pop() if tanks else PLACEHOLDER_CHAR
        healer = healers.pop() if healers else PLACEHOLDER_CHAR
        dps1 = dps.pop() if dps else PLACEHOLDER_CHAR
        dps2 = dps.pop() if dps else PLACEHOLDER_CHAR
        dps3 = dps.pop() if dps else PLACEHOLDER_CHAR

        # Step 3: Print out the group in an embed to keep it tidy
        embed = discord.Embed()
        embed.title = f"Group {groupNumber}"
        embed.add_field(name='Tank', value=f'{dashed(tank)}').add_field(name='Healer', value=f'{dashed(healer)}').add_field(name='DPS', value=f'{dashed(dps1)}, {dashed(dps2)}, {dashed(dps3)}')
        embedMessage = await ctx.send(embed = embed)
        await showShortTyping(channel)
        embedMessage = await embedMessage.edit(embed = embed.set_field_at(index=0, name='Tank', value=f'{tank}'))
        await showShortTyping(channel)
        embedMessage = await embedMessage.edit(embed = embed.set_field_at(index=1, name='Healer', value=f'{healer}'))
        await showShortTyping(channel)
        embedMessage = await embedMessage.edit(embed = embed.set_field_at(index=2, name='DPS', value=f'{dps1}, {dashed(dps2)}, {dashed(dps3)}'))
        await showShortTyping(channel)
        embedMessage = await embedMessage.edit(embed = embed.set_field_at(index=2, name='DPS', value=f'{dps1}, {dps2}, {dashed(dps3)}'))
        await showShortTyping(channel)
        embedMessage = await embedMessage.edit(embed = embed.set_field_at(index=2, name='DPS',value=f'{dps1}, {dps2}, {dps3}'))

        # Step 4: Increment the group number and loop again
        groupNumber += 1

bot.run(BOT_TOKEN)
