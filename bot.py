import discord
import os
import random
import asyncio
from discord.ext import commands
from dotenv import load_dotenv

load_dotenv()
BOT_TOKEN = os.getenv("BOT_TOKEN")
PLACEHOLDER_CHAR = ':question:'

intents = discord.Intents.default()
intents.message_content = True
intents.members = True

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
async def test(ctx):
    await coreWheel(ctx, debug = True)

@bot.command()
async def testGreedy(ctx):
    await coreWheel(ctx, debug = True, useOffspecInPartialGroup = True)

@bot.command()
async def wheel(ctx):
    await coreWheel(ctx = ctx, useOffspecInPartialGroup = False)

@bot.command()
async def greedyWheel(ctx):
    await coreWheel(ctx = ctx, useOffspecInPartialGroup = True)


async def coreWheel(ctx, debug: bool = None, useOffspecInPartialGroup: bool = None):
    debug = False if debug is None else debug
    useOffspecInPartialGroup = False if useOffspecInPartialGroup is None else useOffspecInPartialGroup

    # Set up a list for each role
    tanks = []
    healers = []
    dps = []

    offtanks = []
    offhealers = []
    offdps = []

    def removeFromRoleLists(member):
         tanks.remove(member)
         healers.remove(member)
         dps.remove(member)
         offtanks.remove(member)
         offhealers.remove(member)
         offdps.remove(member)

    # Save a reference to the channel the command was typed in
    channel = ctx.channel

    # Grab all members in the channel the message was sent in
    if debug:
        # Testing Code
        testChannel = discord.utils.get(ctx.guild.channels, name='path-of-exile')
        members = [member for member in testChannel.members if member.bot == False]
    else:
        members = [member for member in ctx.channel.members if member.bot == False]

    # Add each member to one of the primary role buckets, in Tank > Healer > DPS priority
    for member in members:
        roles = [role.name for role in member.roles]
        if 'Tank' in roles:
            tanks.append(WoWName(member))
        elif 'Healer' in roles:
            healers.append(WoWName(member))
        elif 'DPS' in roles:
            dps.append(WoWName(member))

        # Add each member to the offspec role buckets they belong to
        roles = [role.name for role in member.roles]
        if 'Tank Offspec' in roles:
            offtanks.append(WoWName(member))
        if 'Healer Offspec' in roles:
            offhealers.append(WoWName(member))
        if 'DPS Offspec' in roles:
            offdps.append(WoWName(member))
    

    # Debugging help
    if(debug):
        print(f'Tanks: {tanks}')
        print(f'Healers: {healers}')
        print(f'DPS: {dps}')
        print(f'Offtanks: {offtanks}')
        print(f'Offhealers: {offhealers}')
        print(f'OffDPS: {offdps}')

    # Sort everyone into groups of 5, with 1 tank, 1 healer, and 3 dps.
    #
    # First we need to sanitize the tank, heal, and dps lists to have things
    # be balanced in the 1-1-3 ratio.
     
    numberOfGroupsToPullOffspecInto = len(members) // 5
    if useOffspecInPartialGroup:
        numberOfGroupsToPullOffspecInto += 1

    # Make sure we have enough tanks, healers, and dps in that order of importance.
    # If we don't have enough, remove someone from the appropriate offspec list.

    haveEnoughMainSpecTanks = len(tanks) >= numberOfGroupsToPullOffspecInto
    haveEnoughMainSpecHealers = len(healers) >= numberOfGroupsToPullOffspecInto
    haveEnoughMainSpecDPS = len(dps) >= numberOfGroupsToPullOffspecInto

    # First try to pull offspec DPS into the tank role
    if not haveEnoughMainSpecTanks:
        print('Filling tanks with dps')
        # Start with filling the tank role with dps
        availableDPSToTank = list(set(dps).intersection(offtanks))
        print(f'Available DPS to tank: {availableDPSToTank}')
        if availableDPSToTank:
            # Move random DPS into the tank role
            random.shuffle(availableDPSToTank)
            for x in range(numberOfGroupsToPullOffspecInto - len(tanks)):
                if availableDPSToTank:
                    tankingDPS = availableDPSToTank.pop()
                    tanks.append(tankingDPS)
                    dps.remove(tankingDPS)
                    print(f'Assigning {tankingDPS} from dps to tank')
                else:
                    break

    # Next try to pull offspec DPS into the healer role
    if not haveEnoughMainSpecHealers:
        print('Filling healers with dps')
        # Start with filling the healer role with dps
        availableDPSToHeal = list(set(dps).intersection(offhealers))
        print(f'Available DPS to heal: {availableDPSToHeal}')
        if availableDPSToHeal:
            # Move random DPS into the healer role
            random.shuffle(availableDPSToHeal)
            for x in range(numberOfGroupsToPullOffspecInto - len(healers)):
                if availableDPSToHeal:
                    healingDPS = availableDPSToHeal.pop()
                    healers.append(healingDPS)
                    dps.remove(healingDPS)
                    print(f'Assigning {healingDPS} from dps to heals')
                else:
                    break

    # Check again to see if we now have enough tanks and healers
    haveEnoughTanks = len(tanks) >= numberOfGroupsToPullOffspecInto
    haveEnoughHealers = len(healers) >= numberOfGroupsToPullOffspecInto

    print(f'Have enough tanks? {haveEnoughTanks}. Have enough healers? {haveEnoughHealers}')






    # Finally, we want these groups to be roughly random, so we'll:
    # 1) Shuffle all of the primary role lists
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
