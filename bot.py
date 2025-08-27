from typing import List
from dataclasses import dataclass
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

@dataclass(frozen=True, eq=False)
class WoWPlayer:
    name: str
    
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
    
    def __str__(self):
        return self.name
    
    def __repr__(self):
        return self.__str__()

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



# Gathers the player info from the discord and returns a list of [WoWPlayer]s.
def getPlayerList(members) -> List[WoWPlayer]:
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


def create_mythic_plus_groups(players: List[WoWPlayer]) -> List[WoWGroup]:
    # Create a copy of the players list
    players = players.copy()
    
    # Keep track of utility players for even distribution
    brez_players = set(p for p in players if p.hasBrez)
    lust_players = set(p for p in players if p.hasLust)
    print(f'Players with battle res: {brez_players}')
    print(f'Players with bloodlust: {lust_players}')
    
    # Sort players into main and off-role pools
    main_tanks = [p for p in players if p.tankMain]
    print(f'Main tanks: {main_tanks}')
    off_tanks = [p for p in players if p.offtank and not p.tankMain]  # Only include pure off-tanks
    print(f'Off tanks: {off_tanks}')
    random.shuffle(main_tanks)
    random.shuffle(off_tanks)
    tanks = main_tanks + off_tanks  # Maintain priority by concatenating after shuffling
    print(f'Combined tanks: {tanks}')
    
    main_healers = [p for p in players if p.healerMain]
    print(f'Main healers: {main_healers}')
    off_healers = [p for p in players if p.offhealer and not p.healerMain]  # Only include pure off-healers
    print(f'Off healers: {off_healers}')
    random.shuffle(main_healers)
    random.shuffle(off_healers)
    healers = main_healers + off_healers  # Maintain priority by concatenating after shuffling
    print(f'Combined healers: {healers}')

    main_dps = [p for p in players if p.dpsMain]
    print(f'Main DPS: {main_dps}')
    off_dps = [p for p in players if p.offdps and not p.dpsMain]  # Only include pure off-dps
    print(f'Off DPS: {off_dps}')
    random.shuffle(main_dps)
    random.shuffle(off_dps)
    dps = main_dps + off_dps  # Maintain priority by concatenating after shuffling
    print(f'Combined DPS: {dps}')
    
    # Track used players to avoid duplicates
    used_players = set()
    groups = []

    def removePlayer(player: WoWPlayer, slot: str):
        print(f'Removing {player} from available players, went into group {len(groups) + 1} as a {slot}')
        used_players.add(player)
        tanks.remove(player) if player in tanks else None
        healers.remove(player) if player in healers else None
        dps.remove(player) if player in dps else None

    while len(tanks) > 0 and len(healers) > 0 and len(dps) >= 3:
        print(f'--- New Group {len(groups) + 1} ---')
        current_group = WoWGroup()
        
        # Add tank
        tank = tanks[0]
        current_group.tank = tank
        removePlayer(tank, 'Tank')

        # Add healer
        healer = healers[0]
        current_group.healer = healer
        removePlayer(healer, 'Healer')

        # Select DPS prioritizing missing utilities and ranged if needed
        remaining_dps = [p for p in dps if p not in used_players]
        # Split remaining DPS into main and off specs
        remaining_main_dps = [p for p in remaining_dps if p.dpsMain]
        remaining_off_dps = [p for p in remaining_dps if p.offdps and not p.dpsMain]
        dps_slots = ['dps1', 'dps2', 'dps3']
        
        # Count remaining utility players
        remaining_brez = len([p for p in brez_players if p not in used_players])
        remaining_lust = len([p for p in lust_players if p not in used_players])
        remaining_groups = min(len(tanks), len(healers))  # We can only make as many groups as we have tanks or healers
        print(f'Remaining groups possible: {remaining_groups}')
        print(f'Remaining brez players: {remaining_brez}')
        print(f'Remaining lust players: {remaining_lust}')
        
       
        for dps_slot in dps_slots:
            priority_dps = None
             # Decide if this group should get utility players
            should_get_brez = not current_group.has_brez and remaining_brez > remaining_groups - len(groups) - 1
            should_get_lust = not current_group.has_lust and remaining_lust > remaining_groups - len(groups) - 1
            print(f'Group {len(groups) + 1} should get brez: {should_get_brez}, should get lust: {should_get_lust}')

            
            # First try to find a main spec DPS with required utilities
            if remaining_main_dps:
                print('Looking in main dps')
                if should_get_brez:
                    priority_dps = next((p for p in remaining_main_dps if p.hasBrez), None)
                    print(f'Group {len(groups) + 1} needs brez, found {priority_dps} to fill')

                if not priority_dps and should_get_lust:
                    priority_dps = next((p for p in remaining_main_dps if p.hasLust), None)
                    print(f'Group {len(groups) + 1} needs lust, found {priority_dps} to fill')
                
                if not priority_dps and not current_group.has_ranged:
                    priority_dps = next((p for p in remaining_main_dps if p.ranged), None)
                    print(f'Group {len(groups) + 1} needs ranged, found {priority_dps} to fill')

                if not priority_dps:
                    priority_dps = remaining_main_dps[0] if remaining_main_dps else None
                    print(f'No special requirements, taking first available main dps: {priority_dps}')

            # If no suitable main spec DPS found, try off spec
            if not priority_dps and remaining_off_dps:
                print('Looking in offspec dps')
                if should_get_brez:
                    priority_dps = next((p for p in remaining_off_dps if p.hasBrez), None)
                    print(f'Group {len(groups) + 1} needs brez, found {priority_dps} to fill')

                if not priority_dps and should_get_lust:
                    priority_dps = next((p for p in remaining_off_dps if p.hasLust), None)
                    print(f'Group {len(groups) + 1} needs lust, found {priority_dps} to fill')

                if not priority_dps and not current_group.has_ranged:
                    priority_dps = next((p for p in remaining_off_dps if p.ranged), None)
                    print(f'Group {len(groups) + 1} needs ranged, found {priority_dps} to fill')

                if not priority_dps:
                    priority_dps = remaining_off_dps[0] if remaining_off_dps else None
                    print(f'No special requirements, taking first available off spec dps: {priority_dps}')

            if priority_dps:
                print(f'Adding {priority_dps} to group {len(groups) + 1} in slot {dps_slot}')
                setattr(current_group, dps_slot, priority_dps)
                removePlayer(priority_dps, dps_slot)
                if priority_dps in remaining_main_dps:
                    remaining_main_dps.remove(priority_dps)
                if priority_dps in remaining_off_dps:
                    remaining_off_dps.remove(priority_dps)
        
        groups.append(current_group)
    
    # Handle remaining players
    if any(p for p in players if p not in used_players):
        remaining_group = WoWGroup()
        remaining_players = [p for p in players if p not in used_players]
        print(f'--- Leftover players: {remaining_players} ---')
        
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

bot.run(BOT_TOKEN)
