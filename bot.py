from enum import member
import discord
import os
import random
import asyncio
import urllib.parse
from discord.ext import commands
from dotenv import load_dotenv

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
def WoWName(member):
    print(f"WoWName - Member: {member}\nNick: {member.nick}\nGlobal: {member.global_name}")
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

all_players = []

class WoWPlayer:
    # Main roles
    tankMain = False
    healerMain = False
    dpsMain = False

    # Offspecs
    offtank = False
    offhealer = False
    offdps = False

    # Types of DPS
    ranged = False
    melee = False

    # Utility
    hasBrez = False
    hasLust = False

    def __init__(self, name, roles):
        self.name = name
        self.roles = roles

        # Set the main role booleans based on the given roles.
        if 'Tank' in roles:
            self.tankMain = True
        if 'Healer' in roles:
            self.healerMain = True
        if 'DPS' in roles:
            self.dpsMain = True
        if 'Ranged' in roles:
            self.dpsMain = True
            self.ranged = True
        if 'Melee' in roles:
            self.dpsMain = True
            self.melee = True

        #  Set the offspec role booleans based on the given roles.
        roles = [role.name for role in member.roles]
        if 'Tank Offspec' in roles:
            self.offtank = True
        if 'Healer Offspec' in roles:
            self.offhealer = True
        if 'DPS Offspec' in roles:
            self.offdps = True

        # Add party utilities
        if 'Brez' in roles:
            self.hasBrez = True
        if 'Lust' in roles:
            self.hasLust = True

    def __str__(self):
        return f'WoWPlayer(name={self.name}, roles={self.roles})'
    
    def __eq__(self, other):
        if not isinstance(other, WoWPlayer):
            return NotImplemented
        return self.name == other.name

# Gathers the player info from the discord and fills out the all_players list.
def fillPlayerList(members):
    for member in members:
        player = WoWPlayer(name=WoWName(member), roles=[role.name for role in member.roles])
        all_players.append(player)
        

async def coreWheel(ctx, debug: bool = None):
    debug = False if debug is None else debug
    
    # Save a reference to the channel the command was typed in
    channel = ctx.channel

    # Set up a list for each role
    tanks = []
    healers = []
    dps = []

    offtanks = []
    offhealers = []
    offdps = []


    # Get the members of the channel we want to use to fill the roles
    if debug:
        # Testing Code
        testChannel = discord.utils.get(ctx.guild.channels, name='path-of-exile')
        members = [member for member in testChannel.members if member.bot == False]
    else:
        members = [member for member in channel.members if member.bot == False]

    fillPlayerList(members)

    print(f'Tanks: {tanks}')
    print(f'Healers: {healers}')
    print(f'DPS: {dps}')
    print(f'Offtanks: {offtanks}')
    print(f'Offhealers: {offhealers}')
    print(f'OffDPS: {offdps}')

    # Figure out how many groups we'll have, and what the size of our partial
    # group would be for use later on.
    totalPlayers = min((len(tanks) + len(healers) + len(dps)), len(members))
    numberOfFullGroups = totalPlayers // 5
    partialGroupSize = totalPlayers % 5
    print(f'Should be able to make {numberOfFullGroups} full groups')
    print(f'Partial group will be {partialGroupSize} people')

    # First pass: Check to see if we have too many of any role. If we do, we 
    # should assign that number of extras to offspecs where they are needed.
    def recalculateExtras():
        nonlocal extraTanks
        nonlocal extraHealers
        nonlocal extraDPS
        extraTanks = len(tanks)-numberOfFullGroups
        extraHealers = len(healers)-numberOfFullGroups
        extraDPS = len(dps)-(numberOfFullGroups*3)
        print(f'We have {extraTanks} extra tanks')
        print(f'We have {extraHealers} extra healers')
        print(f'We have {extraDPS} extra dps')

    extraTanks = 0
    extraHealers = 0
    extraDPS = 0
    recalculateExtras()

    # Do a first pass where we just reassign any "extra" people to offspec roles
    # where they're needed.
    #
    # This does not cover the weird case where we have:
    # 0 tanks, 2 healers, 8 dps
    # Only healers offspec tank
    # Dps only offspecs healing
    # In this situation, nobody would get reassigned to tanks because there 
    # weren't "extra" healers.
    print('\nFirst pass - moving extras around\n')

    # Fill in tanks with extra people
    if extraTanks < 0 and extraHealers > 0:
        # We have extra healers, so pull from that group first
        pullOffspecFromGroup(numberToPull=min(abs(extraTanks), extraHealers), fromGroup=healers, offspecGroup=offtanks, toGroup=tanks)
        recalculateExtras()
    if extraTanks < 0 and extraDPS > 0:
         # We have extra dps, so pull from that group next
        pullOffspecFromGroup(numberToPull=min(abs(extraTanks), extraDPS), fromGroup=dps, offspecGroup=offtanks, toGroup=tanks)
        recalculateExtras()

    # Fill in healers with extra people
    if extraHealers < 0 and extraTanks > 0:
        # We have extra tanks, so pull from that group first
        pullOffspecFromGroup(numberToPull=min(abs(extraHealers), extraTanks), fromGroup=tanks, offspecGroup=offhealers, toGroup=healers)
        recalculateExtras()
    if extraHealers < 0 and extraDPS > 0:
         # We have extra dps, so pull from that group next
        pullOffspecFromGroup(numberToPull=min(abs(extraHealers), extraDPS), fromGroup=dps, offspecGroup=offhealers, toGroup=healers)
        recalculateExtras()

    # Fill in dps with extra people
    if extraDPS < 0 and extraHealers > 0:
        # We have extra healers, so pull from that group first
        pullOffspecFromGroup(numberToPull=min(abs(extraDPS), extraHealers), fromGroup=healers, offspecGroup=offdps, toGroup=dps)
        recalculateExtras()
    if extraDPS < 0 and extraTanks > 0:
         # We have extra tanks, so pull from that group next
        pullOffspecFromGroup(numberToPull=min(abs(extraDPS), extraTanks), fromGroup=tanks, offspecGroup=offdps, toGroup=dps)
        recalculateExtras()

    print(f'\nAfter first pass, we have {len(tanks)} tanks, {len(healers)} healers, {len(dps)} dps\n')
   
    # Do a second pass where we force people out of main spec roles to fill in
    # gaps. This handles the above weird case with the 0 tanks, 2 healers, 8 dps.
    for x in range(2):
        # Fill in tanks
        if extraTanks < 0:
            print('Second round pulling healer to tank')
            # We have extra healers, so pull from that group first
            pullOffspecFromGroup(numberToPull=abs(extraTanks), fromGroup=healers, offspecGroup=offtanks, toGroup=tanks)
            recalculateExtras()

            print('Second round pulling dps to tank')
            # We have extra dps, so pull from that group next
            pullOffspecFromGroup(numberToPull=abs(extraTanks), fromGroup=dps, offspecGroup=offtanks, toGroup=tanks)
            recalculateExtras()

        # Fill in healers
        if extraHealers < 0:
            print('Second round pulling tank to heal')
            # We have extra tanks, so pull from that group first
            pullOffspecFromGroup(numberToPull=abs(extraHealers), fromGroup=tanks, offspecGroup=offhealers, toGroup=healers)
            recalculateExtras()

            print('Second round pulling dps to heal')
            # We have extra dps, so pull from that group next
            pullOffspecFromGroup(numberToPull=abs(extraHealers), fromGroup=dps, offspecGroup=offhealers, toGroup=healers)
            recalculateExtras()

        # Fill in dps
        if extraDPS < 0:
            print('Second round pulling heal to dps')
            # We have extra healers, so pull from that group first
            pullOffspecFromGroup(numberToPull=abs(extraDPS), fromGroup=healers, offspecGroup=offdps, toGroup=dps)
            recalculateExtras()

            print('Second round pulling tank to dps')
            # We have extra tanks, so pull from that group next
            pullOffspecFromGroup(numberToPull=abs(extraDPS), fromGroup=tanks, offspecGroup=offdps, toGroup=dps)
            recalculateExtras()
        print(f'\nAfter second pass round {x}, we have {len(tanks)} tanks, {len(healers)} healers, {len(dps)} dps\n')

    await printGroups(ctx, channel, tanks, healers, dps)


# Pulls one user from one group and puts them in another, as long as they're 
# also part of the offspec group.
#
# For example, to pull from DPS and into the Tank role, the arguments would be:
#    fromGroup: dps
#    offspecGroup: offtanks
#    toGroup: tanks
#
# This will result in a random dps that has the offtank role into the tank
# group, and remove them from the dps group.
def pullOffspecFromGroup(numberToPull: int, fromGroup: list, offspecGroup: list, toGroup: list):
    availableToPull = list(set(fromGroup).intersection(offspecGroup))
    print(f'Available users to pull: {availableToPull}')
    if availableToPull:
        # Move random user into the to group
        random.shuffle(availableToPull)
        for x in range(numberToPull):
            if availableToPull:
                pulledUser = availableToPull.pop()
                toGroup.append(pulledUser)
                fromGroup.remove(pulledUser)
                print(f'Assigning {pulledUser} to new group')
            else:
                break


# Prints out groups with the given tanks, healers, and dps to one Discord embed
# message per group.
#
# Does not have any fancy logic to arrange groups, just does the Discord embed
# sending. The tanks, healers, and dps should be the exact roles each of those
# users will fill.
async def printGroups(ctx, channel, tanks, healers, dps):
    # We want these groups to be roughly random, so we'll:
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
