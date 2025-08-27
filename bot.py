from enum import member
from typing import List
from dataclasses import dataclass
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
ctx = None # Channel context
channel = None # Channel the command was typed in

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
    ctx = ctx
    channel = ctx.channel
    await coreWheelAI(ctx, debug = True)

# !wheel
# Generates a series of embed messages that shows groups of players split
# into 5 person teams based on their assigned roles in discord.
# 
# The available roles are:
# Tank, Healer, DPS, Tank Offspec, Healer Offspec, DPS Offspec
@bot.command()
async def wheel(ctx):
    ctx = ctx
    channel = ctx.channel
    await coreWheelAI(ctx = ctx)

all_players = []

@dataclass(frozen=True, eq=False)
class WoWPlayer:
    name: str
    roles: list
    
    # Main roles
    tankMain: bool = False
    healerMain: bool = False
    dpsMain: bool = False

    # Offspecs
    offtank: bool = False
    offhealer: bool = False
    offdps: bool = False

    # Types of DPS
    ranged: bool = False
    melee: bool = False

    # Utility
    hasBrez: bool = False
    hasLust: bool = False
    
    def __hash__(self):
        return hash(self.name)
    
    def __eq__(self, other):
        if not isinstance(other, WoWPlayer):
            return NotImplemented
        return self.name == other.name

    @classmethod
    def create(cls, name: str, roles: list) -> 'WoWPlayer':
        # Calculate all the boolean flags
        tankMain = 'Tank' in roles
        healerMain = 'Healer' in roles
        dpsMain = any(role in roles for role in ['DPS', 'Ranged', 'Melee'])
        offtank = 'Tank Offspec' in roles
        offhealer = 'Healer Offspec' in roles
        offdps = 'DPS Offspec' in roles
        ranged = 'Ranged' in roles
        melee = 'Melee' in roles
        hasBrez = 'Brez' in roles
        hasLust = 'Lust' in roles
        
        # Create the instance with all flags set
        return cls(
            name=name,
            roles=roles,
            tankMain=tankMain,
            healerMain=healerMain,
            dpsMain=dpsMain,
            offtank=offtank,
            offhealer=offhealer,
            offdps=offdps,
            ranged=ranged,
            melee=melee,
            hasBrez=hasBrez,
            hasLust=hasLust
        )
    
    def __eq__(self, other):
        if not isinstance(other, WoWPlayer):
            return NotImplemented
        return self.name == other.name

@dataclass
class WoWGroup:
    tank: WoWPlayer = None
    healer: WoWPlayer = None
    dps1: WoWPlayer = None
    dps2: WoWPlayer = None
    dps3: WoWPlayer = None

    @property
    def has_brez(self):
        return any(p and p.hasBrez for p in [self.tank, self.healer, self.dps1, self.dps2, self.dps3])
    
    @property
    def has_lust(self):
        return any(p and p.hasLust for p in [self.tank, self.healer, self.dps1, self.dps2, self.dps3])
    
    @property
    def has_ranged(self):
        return any(p and p.ranged for p in [self.tank, self.healer, self.dps1, self.dps2, self.dps3])
    
    @property
    def is_complete(self):
        return all(p is not None for p in [self.tank, self.healer, self.dps1, self.dps2, self.dps3])
    
    @property
    def size(self):
        return sum(1 for p in [self.tank, self.healer, self.dps1, self.dps2, self.dps3] if p is not None)



# Gathers the player info from the discord and fills out the all_players list.
def fillPlayerList(members):
    for member in members:
        player = WoWPlayer.create(name=WoWName(member), roles=[role.name for role in member.roles])
        all_players.append(player)
        

async def coreWheelAI(ctx, debug: bool = None):
    debug = False if debug is None else debug

    # Get the members of the channel we want to use to fill the roles
    if debug:
        # Testing Code
        testChannel = discord.utils.get(ctx.guild.channels, name='path-of-exile')
        members = [member for member in testChannel.members if member.bot == False]
    else:
        members = [member for member in channel.members if member.bot == False]

    fillPlayerList(members)
    groups = create_mythic_plus_groups(all_players)
    
    for i, group in enumerate(groups, 1):
        # Step 3: Print out the group in an embed to keep it tidy
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

###
### AI Generated section
###
def create_mythic_plus_groups(players: List[WoWPlayer]) -> List[WoWGroup]:
    # Create a copy of the players list
    players = players.copy()
    
    # Sort players into main and off-role pools
    main_tanks = [p for p in players if p.tankMain]
    off_tanks = [p for p in players if p.offtank and not p.tankMain]  # Only include pure off-tanks
    random.shuffle(main_tanks)
    random.shuffle(off_tanks)
    tanks = main_tanks + off_tanks  # Maintain priority by concatenating after shuffling
    
    main_healers = [p for p in players if p.healerMain]
    off_healers = [p for p in players if p.offhealer and not p.healerMain]  # Only include pure off-healers
    random.shuffle(main_healers)
    random.shuffle(off_healers)
    healers = main_healers + off_healers  # Maintain priority by concatenating after shuffling
    
    main_dps = [p for p in players if p.dpsMain]
    off_dps = [p for p in players if p.offdps and not p.dpsMain]  # Only include pure off-dps
    random.shuffle(main_dps)
    random.shuffle(off_dps)
    dps = main_dps + off_dps  # Maintain priority by concatenating after shuffling
    
    # Track used players to avoid duplicates
    used_players = set()
    groups = []
    
    while len(tanks) > 0 and len(healers) > 0 and len(dps) >= 3:
        current_group = WoWGroup()
        
        # Add tank
        tank = tanks[0]
        current_group.tank = tank
        used_players.add(tank)
        tanks.remove(tank)
        
        # Add healer
        healer = healers[0]
        current_group.healer = healer
        used_players.add(healer)
        healers.remove(healer)
        
        # Select DPS prioritizing missing utilities and ranged if needed
        remaining_dps = [p for p in dps if p not in used_players]
        # Split remaining DPS into main and off specs
        remaining_main_dps = [p for p in remaining_dps if p.dpsMain]
        remaining_off_dps = [p for p in remaining_dps if p.offdps and not p.dpsMain]
        dps_slots = ['dps1', 'dps2', 'dps3']
        
        for dps_slot in dps_slots:
            priority_dps = None
            
            # First try to find a main spec DPS with required utilities
            if remaining_main_dps:
                if not current_group.has_brez and not current_group.has_lust:
                    priority_dps = next((p for p in remaining_main_dps if p.hasBrez and p.hasLust), None)
                elif not current_group.has_brez:
                    priority_dps = next((p for p in remaining_main_dps if p.hasBrez), None)
                elif not current_group.has_lust:
                    priority_dps = next((p for p in remaining_main_dps if p.hasLust), None)
                
                if not priority_dps and not current_group.has_ranged and dps_slot != 'dps3':
                    priority_dps = next((p for p in remaining_main_dps if p.ranged), None)
                
                if not priority_dps:
                    priority_dps = remaining_main_dps[0] if remaining_main_dps else None

            # If no suitable main spec DPS found, try off spec
            if not priority_dps and remaining_off_dps:
                if not current_group.has_brez and not current_group.has_lust:
                    priority_dps = next((p for p in remaining_off_dps if p.hasBrez and p.hasLust), None)
                elif not current_group.has_brez:
                    priority_dps = next((p for p in remaining_off_dps if p.hasBrez), None)
                elif not current_group.has_lust:
                    priority_dps = next((p for p in remaining_off_dps if p.hasLust), None)
                
                if not priority_dps and not current_group.has_ranged and dps_slot != 'dps3':
                    priority_dps = next((p for p in remaining_off_dps if p.ranged), None)
                
                if not priority_dps:
                    priority_dps = remaining_off_dps[0] if remaining_off_dps else None
            
            if priority_dps:
                setattr(current_group, dps_slot, priority_dps)
                used_players.add(priority_dps)
                dps.remove(priority_dps)
                if priority_dps in remaining_main_dps:
                    remaining_main_dps.remove(priority_dps)
                if priority_dps in remaining_off_dps:
                    remaining_off_dps.remove(priority_dps)
        
        groups.append(current_group)
    
    # Handle remaining players
    if any(p for p in players if p not in used_players):
        remaining_group = WoWGroup()
        remaining_players = [p for p in players if p not in used_players]
        random.shuffle(remaining_players)
        
        # Try to organize remaining players into roles if possible
        remaining_tanks = [p for p in remaining_players if p.tankMain or p.offtank]
        remaining_healers = [p for p in remaining_players if p.healerMain or p.offhealer]
        remaining_dps = [p for p in remaining_players if p.dpsMain or p.offdps]
        
        if remaining_tanks:
            remaining_group.tank = remaining_tanks[0]
            remaining_players.remove(remaining_tanks[0])
        
        if remaining_healers:
            remaining_group.healer = remaining_healers[0]
            remaining_players.remove(remaining_healers[0])
        
        # Fill remaining DPS slots
        dps_count = 0
        for player in remaining_players[:3]:  # Take up to 3 players for DPS
            if dps_count == 0:
                remaining_group.dps1 = player
            elif dps_count == 1:
                remaining_group.dps2 = player
            elif dps_count == 2:
                remaining_group.dps3 = player
            dps_count += 1
        
        groups.append(remaining_group)
    
    return groups

def print_group_details(groups: List[List[WoWPlayer]]):
    for i, group in enumerate(groups, 1):
        print(f"\nGroup {i} ({len(group)} players):")
        roles = {
            "Tank": next((p.name for p in group if p.tankMain or p.offtank), "None"),
            "Healer": next((p.name for p in group if p.healerMain or p.offhealer), "None"),
            "DPS": [p.name for p in group if p.dpsMain or p.offdps]
        }
        print(f"Tank: {roles['Tank']}")
        print(f"Healer: {roles['Healer']}")
        print(f"DPS: {', '.join(roles['DPS'])}")
        print(f"Has Brez: {any(p.hasBrez for p in group)}")
        print(f"Has Lust: {any(p.hasLust for p in group)}")
        print(f"Has Ranged: {any(p.ranged for p in group)}")  










bot.run(BOT_TOKEN)
